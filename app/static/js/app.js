/* GDG Todo — frontend JS
 * Talks to the Flask REST API at /api/tasks
 * No build step needed — plain ES2020
 */

const PRIORITY_CONFIG = {
  high: {
    checkClass: 'checked-red',
    badgeClass: 'badge-high',
    dotColor:   '#EA4335',
    statBg:     '#FCE8E6',
    statColor:  '#C5221F',
    label:      'High',
  },
  medium: {
    checkClass: 'checked-yellow',
    badgeClass: 'badge-medium',
    dotColor:   '#FBBC05',
    statBg:     '#FEF7E0',
    statColor:  '#E37400',
    label:      'Medium',
  },
  low: {
    checkClass: 'checked-green',
    badgeClass: 'badge-low',
    dotColor:   '#34A853',
    statBg:     '#E6F4EA',
    statColor:  '#137333',
    label:      'Low',
  },
};

// ── State ──────────────────────────────────────────────
let tasks        = [];
let activeFilter = 'all';

// ── DOM refs ───────────────────────────────────────────
const tasksList      = document.getElementById('tasksList');
const statsRow       = document.getElementById('statsRow');
const taskInput      = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');
const addBtn         = document.getElementById('addBtn');
const filtersEl      = document.getElementById('filters');
const clearDoneBtn   = document.getElementById('clearDone');

// ── API helpers ────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Load tasks ─────────────────────────────────────────
async function loadTasks() {
  tasksList.innerHTML = '<li class="loading">Loading…</li>';
  try {
    tasks = await apiFetch('/api/tasks');
    render();
  } catch (e) {
    tasksList.innerHTML = `<li class="empty-state"><p>Failed to load tasks: ${escHtml(e.message)}</p></li>`;
  }
}

// ── Add task ───────────────────────────────────────────
async function addTask() {
  const text     = taskInput.value.trim();
  const priority = prioritySelect.value;

  if (!text) { taskInput.focus(); return; }

  addBtn.disabled    = true;
  addBtn.textContent = '…';

  try {
    const task = await apiFetch('/api/tasks', {
      method: 'POST',
      body:   JSON.stringify({ text, priority }),
    });
    tasks.unshift(task);
    taskInput.value = '';
    taskInput.focus();
    render();
  } catch (e) {
    alert(`Could not add task: ${e.message}`);
  } finally {
    addBtn.disabled = false;
    addBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1v12M1 7h12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Add`;
  }
}

// ── Toggle done ────────────────────────────────────────
async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const newDone = !task.done;
  task.done = newDone;   // optimistic update
  render();

  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ done: newDone }),
    });
  } catch (e) {
    task.done = !newDone; // rollback
    render();
    console.error('Toggle failed:', e.message);
  }
}

// ── Delete task ────────────────────────────────────────
async function deleteTask(id) {
  const original = [...tasks];
  tasks = tasks.filter(t => t.id !== id); // optimistic
  render();

  try {
    await apiFetch(`/api/tasks/${id}`, { method: 'DELETE' });
  } catch (e) {
    tasks = original; // rollback
    render();
    console.error('Delete failed:', e.message);
  }
}

// ── Clear done ─────────────────────────────────────────
async function clearDone() {
  const original = [...tasks];
  tasks = tasks.filter(t => !t.done); // optimistic
  if (activeFilter === 'done') { activeFilter = 'all'; updateFilterButtons(); }
  render();

  try {
    await apiFetch('/api/tasks/clear-done', { method: 'DELETE' });
  } catch (e) {
    tasks = original; // rollback
    render();
    console.error('Clear done failed:', e.message);
  }
}

// ── Render helpers ─────────────────────────────────────
function getFiltered() {
  if (activeFilter === 'all')  return tasks.filter(t => !t.done);
  if (activeFilter === 'done') return tasks.filter(t => t.done);
  return tasks.filter(t => t.priority === activeFilter && !t.done);
}

function renderStats() {
  const counts = { high: 0, medium: 0, low: 0 };
  tasks.filter(t => !t.done).forEach(t => counts[t.priority]++);

  statsRow.innerHTML = Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => `
    <div class="stat-pill" style="background:${cfg.statBg}">
      <span class="stat-dot" style="background:${cfg.dotColor}"></span>
      <span style="font-size:12px;font-weight:500;color:${cfg.statColor}">
        ${counts[key]} ${cfg.label}
      </span>
    </div>
  `).join('');
}

function renderTasks() {
  const filtered = getFiltered();

  if (filtered.length === 0) {
    tasksList.innerHTML = `
      <li class="empty-state">
        <div class="empty-gdg">
          <span class="empty-dot" style="background:#4285F4"></span>
          <span class="empty-dot" style="background:#EA4335"></span>
          <span class="empty-dot" style="background:#FBBC05"></span>
          <span class="empty-dot" style="background:#34A853"></span>
        </div>
        <p>${activeFilter === 'done' ? 'No completed tasks yet.' : 'No tasks here — add one above!'}</p>
      </li>`;
    return;
  }

  tasksList.innerHTML = filtered.map(task => {
    const cfg      = PRIORITY_CONFIG[task.priority];
    const doneAttr = task.done ? ' done' : '';
    const checkCls = task.done ? ` ${cfg.checkClass}` : '';

    return `
      <li class="task-item${doneAttr}" data-id="${task.id}">
        <button
          class="task-checkbox${checkCls}"
          aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}"
          data-toggle="${task.id}"
        >
          <svg class="check-svg" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M1.5 5.5L3.8 8L8.5 2.5"
              stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <span class="task-text${doneAttr ? ' done' : ''}">${escHtml(task.text)}</span>

        <span class="priority-badge ${cfg.badgeClass}">${cfg.label}</span>

        <button
          class="delete-btn"
          aria-label="Delete task"
          data-delete="${task.id}"
        >×</button>
      </li>`;
  }).join('');
}

function render() {
  renderStats();
  renderTasks();
}

function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === activeFilter);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Event listeners ────────────────────────────────────
addBtn.addEventListener('click', addTask);

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

filtersEl.addEventListener('click', e => {
  const btn = e.target.closest('[data-filter]');
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  updateFilterButtons();
  render();
});

tasksList.addEventListener('click', e => {
  const toggleBtn = e.target.closest('[data-toggle]');
  const deleteBtn = e.target.closest('[data-delete]');

  if (toggleBtn) toggleTask(parseInt(toggleBtn.dataset.toggle, 10));
  if (deleteBtn) deleteTask(parseInt(deleteBtn.dataset.delete, 10));
});

clearDoneBtn.addEventListener('click', clearDone);

// ── Init ───────────────────────────────────────────────
loadTasks();