const taskList = document.querySelector('#task-list');
const noteList = document.querySelector('#note-list');
const taskForm = document.querySelector('#task-form');
const noteForm = document.querySelector('#note-form');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editFields = document.querySelector('#edit-fields');
const appMessage = document.querySelector('#app-message');

const state = {
  tasks: [],
  notes: [],
  filter: 'all',
  taskLoadError: null,
  noteLoadError: null,
  editType: null,
  editId: null,
  messageTimer: null
};

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function api(path, options = {}) {
  let response;

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  if (response.status === 204) {
    return null;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || 'Something went wrong. Please try again.');
  }

  return result;
}

function showMessage(message, tone = 'error') {
  window.clearTimeout(state.messageTimer);
  appMessage.textContent = message;
  appMessage.classList.remove('hidden', 'is-success');

  if (tone === 'success') {
    appMessage.classList.add('is-success');
    state.messageTimer = window.setTimeout(() => appMessage.classList.add('hidden'), 2800);
  }
}

function updateCounts() {
  const openCount = state.tasks.filter((task) => !task.completed).length;
  document.querySelector('#open-count').textContent = openCount;
  document.querySelector('#task-count').textContent = `${state.tasks.length} ${state.tasks.length === 1 ? 'task' : 'tasks'}`;
  document.querySelector('#note-count').textContent = `${state.notes.length} ${state.notes.length === 1 ? 'note' : 'notes'}`;
  document.querySelector('#note-total-label').textContent = `${state.notes.length} saved`;
}

function formatDueDate(value) {
  if (!value) return '';

  const dueDate = new Date(`${value}T12:00:00`);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDueDate = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const difference = Math.round((startOfDueDate - startOfToday) / 86400000);

  if (difference === 0) return 'Today';
  if (difference === 1) return 'Tomorrow';

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(dueDate);
}

function formatCreatedAt(value) {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function createEmptyState(mark, title, description, retry) {
  const emptyState = makeElement('div', 'empty-state');
  emptyState.append(makeElement('span', 'empty-mark', mark));
  emptyState.append(makeElement('h3', '', title));
  emptyState.append(makeElement('p', '', description));

  if (retry) {
    const retryButton = makeElement('button', 'retry-button', 'Try again');
    retryButton.type = 'button';
    retryButton.addEventListener('click', retry);
    emptyState.append(retryButton);
  }

  return emptyState;
}

function createActionButton(label, symbol, className, handler) {
  const button = makeElement('button', `icon-button ${className}`, symbol);
  button.type = 'button';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', handler);
  return button;
}

function renderTasks() {
  taskList.replaceChildren();
  taskList.setAttribute('aria-busy', 'false');

  if (state.taskLoadError) {
    taskList.append(createEmptyState('!', 'Tasks could not load', state.taskLoadError, loadTasks));
    return;
  }

  const visibleTasks = state.tasks.filter((task) => {
    if (state.filter === 'active') return !task.completed;
    if (state.filter === 'completed') return task.completed;
    return true;
  });

  if (visibleTasks.length === 0) {
    const hasTasks = state.tasks.length > 0;
    const content = state.filter === 'completed'
      ? ['\u2713', 'Nothing checked off yet', 'Your finished tasks will show up here.']
      : state.filter === 'active' && hasTasks
        ? ['\u2713', 'All caught up', 'Every task on your list is done.']
        : ['\u2726', 'A clean slate', 'Add one small thing you want to get done.'];
    taskList.append(createEmptyState(content[0], content[1], content[2]));
    return;
  }

  visibleTasks.forEach((task) => {
    const item = makeElement('article', `task-item${task.completed ? ' is-complete' : ''}`);
    const checkbox = makeElement('input', 'task-checkbox');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Mark ${task.title} ${task.completed ? 'active' : 'complete'}`);
    checkbox.addEventListener('change', () => toggleTask(task, checkbox.checked));

    const taskMain = makeElement('div', 'task-main');
    taskMain.append(makeElement('h3', 'task-title', task.title));

    const metadata = makeElement('div', 'task-meta');
    const priority = makeElement('span', `priority-badge priority-${task.priority}`, task.priority);
    metadata.append(priority);

    if (task.due_date) {
      const dueLabel = formatDueDate(task.due_date);
      const dueDate = new Date(`${task.due_date}T12:00:00`);
      const today = new Date();
      const overdue = !task.completed && new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      metadata.append(makeElement('span', `due-badge${overdue ? ' is-overdue' : ''}`, `${overdue ? 'Overdue · ' : 'Due '}${dueLabel}`));
    }

    taskMain.append(metadata);
    const actions = makeElement('div', 'item-actions');
    actions.append(createActionButton('Edit task', '\u270e', '', () => openTaskEditor(task)));
    actions.append(createActionButton('Delete task', '\u00d7', 'delete-button', () => deleteTask(task)));
    item.append(checkbox, taskMain, actions);
    taskList.append(item);
  });
}

function renderNotes() {
  noteList.replaceChildren();
  noteList.setAttribute('aria-busy', 'false');

  if (state.noteLoadError) {
    noteList.append(createEmptyState('!', 'Notes could not load', state.noteLoadError, loadNotes));
    return;
  }

  if (state.notes.length === 0) {
    noteList.append(createEmptyState('\u273f', 'No notes yet', 'Save a thought here so it is easy to find later.'));
    return;
  }

  state.notes.forEach((note) => {
    const item = makeElement('article', 'note-item');
    const decoration = makeElement('span', 'note-decoration');
    decoration.setAttribute('aria-hidden', 'true');

    const noteMain = makeElement('div', 'note-main');
    noteMain.append(makeElement('h3', 'note-title', note.title));
    noteMain.append(makeElement('p', 'note-content', note.content));
    noteMain.append(makeElement('time', 'note-date', formatCreatedAt(note.created_at)));

    const actions = makeElement('div', 'item-actions');
    actions.append(createActionButton('Edit note', '\u270e', '', () => openNoteEditor(note)));
    actions.append(createActionButton('Delete note', '\u00d7', 'delete-button', () => deleteNote(note)));
    item.append(decoration, noteMain, actions);
    noteList.append(item);
  });
}

function render() {
  updateCounts();
  renderTasks();
  renderNotes();
}

async function loadTasks() {
  taskList.setAttribute('aria-busy', 'true');
  try {
    const tasks = await api('/api/tasks');
    state.tasks = tasks;
    state.taskLoadError = null;
  } catch (error) {
    state.taskLoadError = error.message;
  }
  render();
}

async function loadNotes() {
  noteList.setAttribute('aria-busy', 'true');
  try {
    const notes = await api('/api/notes');
    state.notes = notes;
    state.noteLoadError = null;
  } catch (error) {
    state.noteLoadError = error.message;
  }
  render();
}

async function loadData() {
  await Promise.all([loadTasks(), loadNotes()]);

  const errors = [state.taskLoadError, state.noteLoadError].filter(Boolean);
  if (errors.length) showMessage(errors.join(' '));
}

async function toggleTask(task, completed) {
  try {
    const updatedTask = await api(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed })
    });
    state.tasks = state.tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    render();
  } catch (error) {
    showMessage(`Could not update this task. ${error.message}`);
    renderTasks();
  }
}

async function deleteTask(task) {
  if (!window.confirm(`Delete “${task.title}”?`)) return;

  try {
    await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    render();
    showMessage('Task deleted.', 'success');
  } catch (error) {
    showMessage(`Could not delete this task. ${error.message}`);
  }
}

async function deleteNote(note) {
  if (!window.confirm(`Delete “${note.title}”?`)) return;

  try {
    await api(`/api/notes/${note.id}`, { method: 'DELETE' });
    state.notes = state.notes.filter((item) => item.id !== note.id);
    render();
    showMessage('Note deleted.', 'success');
  } catch (error) {
    showMessage(`Could not delete this note. ${error.message}`);
  }
}

function appendEditField(labelText, input) {
  const label = makeElement('label', 'edit-field', labelText);
  label.append(input);
  editFields.append(label);
}

function createTextInput(name, value, placeholder = '') {
  const input = document.createElement('input');
  input.name = name;
  input.value = value ?? '';
  input.maxLength = name === 'title' ? 200 : 10000;
  input.required = name === 'title' || name === 'content';

  if (name === 'due_date') {
    input.type = 'date';
    input.required = false;
  } else {
    input.type = 'text';
    input.placeholder = placeholder;
  }

  return input;
}

function createTaskFields(task) {
  editFields.replaceChildren();
  appendEditField('Task title', createTextInput('title', task.title));
  appendEditField('Due date', createTextInput('due_date', task.due_date));

  const priority = document.createElement('select');
  priority.name = 'priority';
  ['low', 'medium', 'high'].forEach((value) => {
    const option = makeElement('option', '', value[0].toUpperCase() + value.slice(1));
    option.value = value;
    option.selected = value === task.priority;
    priority.append(option);
  });
  appendEditField('Priority', priority);

  const completedLabel = makeElement('label', 'edit-checkbox-row');
  const completed = document.createElement('input');
  completed.type = 'checkbox';
  completed.name = 'completed';
  completed.checked = task.completed;
  completedLabel.append(completed, document.createTextNode('Mark as complete'));
  editFields.append(completedLabel);
}

function createNoteFields(note) {
  editFields.replaceChildren();
  appendEditField('Note title', createTextInput('title', note.title));

  const content = document.createElement('textarea');
  content.name = 'content';
  content.maxLength = 10000;
  content.required = true;
  content.value = note.content;
  content.rows = 5;
  appendEditField('Content', content);
}

function openTaskEditor(task) {
  state.editType = 'task';
  state.editId = task.id;
  document.querySelector('#edit-kicker').textContent = 'A LITTLE TWEAK';
  document.querySelector('#edit-heading').textContent = 'Edit task';
  createTaskFields(task);
  editDialog.showModal();
  editFields.querySelector('[name="title"]').focus();
}

function openNoteEditor(note) {
  state.editType = 'note';
  state.editId = note.id;
  document.querySelector('#edit-kicker').textContent = 'A LITTLE TWEAK';
  document.querySelector('#edit-heading').textContent = 'Edit note';
  createNoteFields(note);
  editDialog.showModal();
  editFields.querySelector('[name="title"]').focus();
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = taskForm.querySelector('button[type="submit"]');
  const title = taskForm.elements.title.value.trim();
  if (!title) {
    showMessage('Give your task a title first.');
    taskForm.elements.title.focus();
    return;
  }

  button.disabled = true;
  try {
    const task = await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title,
        due_date: taskForm.elements.due_date.value || null,
        priority: taskForm.elements.priority.value
      })
    });
    state.tasks.push(task);
    taskForm.reset();
    taskForm.elements.priority.value = 'medium';
    state.filter = 'all';
    document.querySelectorAll('[data-filter]').forEach((filterButton) => {
      const selected = filterButton.dataset.filter === 'all';
      filterButton.classList.toggle('is-selected', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    });
    render();
    showMessage('Task added. One little thing at a time.', 'success');
    taskForm.elements.title.focus();
  } catch (error) {
    showMessage(`Could not save this task. ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

noteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = noteForm.querySelector('button[type="submit"]');
  const title = noteForm.elements.title.value.trim();
  const content = noteForm.elements.content.value;
  if (!title || !content.trim()) {
    showMessage('Add a title and a little note content before saving.');
    (!title ? noteForm.elements.title : noteForm.elements.content).focus();
    return;
  }

  button.disabled = true;
  try {
    const note = await api('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ title, content })
    });
    state.notes.push(note);
    noteForm.reset();
    render();
    showMessage('Note saved for later.', 'success');
    noteForm.elements.title.focus();
  } catch (error) {
    showMessage(`Could not save this note. ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle('is-selected', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    });
    renderTasks();
  });
});

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = editForm.querySelector('button[type="submit"]');
  const formData = new FormData(editForm);
  let endpoint;
  let payload;

  if (state.editType === 'task') {
    endpoint = `/api/tasks/${state.editId}`;
    payload = {
      title: formData.get('title').trim(),
      due_date: formData.get('due_date') || null,
      priority: formData.get('priority'),
      completed: formData.has('completed')
    };
  } else {
    endpoint = `/api/notes/${state.editId}`;
    payload = {
      title: formData.get('title').trim(),
      content: formData.get('content')
    };
  }

  submitButton.disabled = true;
  try {
    const updated = await api(endpoint, { method: 'PUT', body: JSON.stringify(payload) });
    if (state.editType === 'task') {
      state.tasks = state.tasks.map((task) => task.id === updated.id ? updated : task);
    } else {
      state.notes = state.notes.map((note) => note.id === updated.id ? updated : note);
    }
    editDialog.close();
    render();
    showMessage(`${state.editType === 'task' ? 'Task' : 'Note'} updated.`, 'success');
  } catch (error) {
    showMessage(`Could not save your changes. ${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('#cancel-edit').addEventListener('click', () => editDialog.close());
document.querySelector('#close-dialog').addEventListener('click', () => editDialog.close());
editDialog.addEventListener('click', (event) => {
  if (event.target === editDialog) editDialog.close();
});

document.querySelector('#today-label').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'long', month: 'long', day: 'numeric'
}).format(new Date());

loadData();