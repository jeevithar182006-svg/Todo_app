import './style.css';

type Status = 'todo' | 'in-progress' | 'done';
type Priority = 'low' | 'medium' | 'high';
type Task = { id: string; title: string; description: string; status: Status; priority: Priority; due: string; tags: string[] };
type Report = { total: number; done: number; inProgress: number; overdue: number; dueSoon: number; byPriority: Record<Priority, number> };

const app = document.querySelector<HTMLDivElement>('#app')!;
let tasks: Task[] = [];
let activeView = 'all';
let search = '';
let statusFilter = 'all';
let priorityFilter = 'all';
let dueFilter = 'all';

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (date: string) => date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00`)) : 'No due date';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!response.ok) throw new Error((await response.json()).error || 'Something went wrong');
  return response.status === 204 ? undefined as T : response.json();
}

function filteredTasks() {
  return tasks.filter((task) => {
    const matchesView = activeView === 'all' || (activeView === 'today' ? task.due === today() : activeView === 'overdue' ? task.status !== 'done' && task.due < today() : task.status === activeView);
    const matchesSearch = `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesDue = dueFilter === 'all' || (dueFilter === 'no-date' ? !task.due : dueFilter === 'week' ? task.due >= today() && task.due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : task.due < today() && task.status !== 'done');
    return matchesView && matchesSearch && matchesStatus && matchesPriority && matchesDue;
  });
}

function render() {
  const visible = filteredTasks();
  app.innerHTML = `<div class="shell">
    <aside class="sidebar"><div class="brand"><span class="brand-mark">D</span><span>daymark</span></div><p class="eyebrow">MARKDOWN TASK LEDGER</p>
      <nav>${[['all', 'All work'], ['today', 'Today'], ['in-progress', 'In progress'], ['overdue', 'Overdue'], ['done', 'Completed']].map(([key, label]) => `<button class="nav-item ${activeView === key ? 'active' : ''}" data-view="${key}"><span class="nav-dot ${key}"></span>${label}<span class="nav-count">${key === 'all' ? tasks.length : key === 'today' ? tasks.filter((t) => t.due === today()).length : key === 'overdue' ? tasks.filter((t) => t.status !== 'done' && t.due < today()).length : tasks.filter((t) => t.status === key).length}</span></button>`).join('')}</nav>
      <div class="sidebar-note"><span class="file-icon">⌁</span><div><strong>tasks.md</strong><small>Single source of truth</small></div></div>
    </aside>
    <main class="main"><header class="topbar"><div><p class="eyebrow">${new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()).toUpperCase()}</p><h1>Make the day count.</h1></div><button class="primary" data-action="new">+ New task</button></header>
      <section class="metrics"><div class="metric"><span>Active focus</span><strong>${tasks.filter((t) => t.status !== 'done').length}</strong><small>tasks left to move</small></div><div class="metric accent"><span>Completed</span><strong>${tasks.filter((t) => t.status === 'done').length}</strong><small>${tasks.length ? Math.round(tasks.filter((t) => t.status === 'done').length / tasks.length * 100) : 0}% of your ledger</small></div><div class="metric"><span>Due soon</span><strong>${tasks.filter((t) => t.status !== 'done' && t.due >= today() && t.due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)).length}</strong><small>within the next 7 days</small></div></section>
      <section class="workspace"><div class="list-panel"><div class="section-heading"><div><p class="eyebrow">TASK QUEUE</p><h2>${activeView === 'all' ? 'Everything in motion' : activeView === 'today' ? 'Today’s focus' : activeView === 'overdue' ? 'Needs attention' : activeView === 'done' ? 'Work shipped' : 'In progress'}</h2></div><span class="result-count">${visible.length} shown</span></div>
        <div class="toolbar"><label class="search"><span>⌕</span><input id="search" value="${escapeHtml(search)}" placeholder="Search tasks or tags" /></label><select id="status"><option value="all">Any status</option><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Completed</option></select><select id="priority"><option value="all">Any priority</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select><select id="due"><option value="all">Any due date</option><option value="week">Due this week</option><option value="overdue">Overdue</option><option value="no-date">No due date</option></select></div>
        <div class="task-list">${visible.length ? visible.map(taskCard).join('') : `<div class="empty"><span>◌</span><h3>No tasks in this view</h3><p>Try widening your filters or create a new task.</p></div>`}</div></div><aside class="report-panel"><div class="section-heading"><div><p class="eyebrow">WEEKLY REPORT</p><h2>Work pulse</h2></div><button class="icon-button" data-action="refresh" title="Refresh report">↻</button></div><div id="report"></div></aside></section>
    </main></div>`;
  document.querySelector<HTMLSelectElement>('#status')!.value = statusFilter; document.querySelector<HTMLSelectElement>('#priority')!.value = priorityFilter; document.querySelector<HTMLSelectElement>('#due')!.value = dueFilter;
  bindEvents(); loadReport();
}

function taskCard(task: Task) { const isOverdue = task.status !== 'done' && task.due && task.due < today(); return `<article class="task-card ${task.status === 'done' ? 'complete' : ''}"><button class="check ${task.status === 'done' ? 'checked' : ''}" data-toggle="${task.id}" aria-label="Toggle task">${task.status === 'done' ? '✓' : ''}</button><div class="task-content"><div class="task-top"><h3>${escapeHtml(task.title)}</h3><span class="priority ${task.priority}">${task.priority}</span></div><p>${escapeHtml(task.description)}</p><div class="task-meta"><span class="due ${isOverdue ? 'late' : ''}">◷ ${isOverdue ? 'Overdue · ' : ''}${formatDate(task.due)}</span>${task.tags.map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}</div></div><div class="task-actions"><button data-edit="${task.id}" title="Edit task">✎</button><button data-delete="${task.id}" title="Delete task">×</button></div></article>`; }

function bindEvents() {
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => button.onclick = () => { activeView = button.dataset.view!; render(); });
  document.querySelector<HTMLInputElement>('#search')!.oninput = (event) => {
    const input = event.target as HTMLInputElement;
    const cursorPosition = input.selectionStart ?? input.value.length;
    search = input.value;
    render();
    const refreshedInput = document.querySelector<HTMLInputElement>('#search');
    refreshedInput?.focus();
    refreshedInput?.setSelectionRange(cursorPosition, cursorPosition);
  };
  document.querySelector<HTMLSelectElement>('#status')!.onchange = (event) => { statusFilter = (event.target as HTMLSelectElement).value; render(); };
  document.querySelector<HTMLSelectElement>('#priority')!.onchange = (event) => { priorityFilter = (event.target as HTMLSelectElement).value; render(); };
  document.querySelector<HTMLSelectElement>('#due')!.onchange = (event) => { dueFilter = (event.target as HTMLSelectElement).value; render(); };
  document.querySelectorAll<HTMLElement>('[data-toggle]').forEach((button) => button.onclick = () => updateTask(button.dataset.toggle!, { status: tasks.find((t) => t.id === button.dataset.toggle)!.status === 'done' ? 'todo' : 'done' }));
  document.querySelectorAll<HTMLElement>('[data-edit]').forEach((button) => button.onclick = () => openModal(tasks.find((t) => t.id === button.dataset.edit)));
  document.querySelectorAll<HTMLElement>('[data-delete]').forEach((button) => button.onclick = () => deleteTask(button.dataset.delete!));
  document.querySelectorAll<HTMLElement>('[data-action="new"]').forEach((button) => button.onclick = () => openModal());
  document.querySelectorAll<HTMLElement>('[data-action="refresh"]').forEach((button) => button.onclick = loadReport);
}

async function updateTask(id: string, patch: Partial<Task>) { await request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ ...tasks.find((task) => task.id === id), ...patch }) }); await loadTasks(); }
async function deleteTask(id: string) { if (confirm('Delete this task?')) { await request(`/api/tasks/${id}`, { method: 'DELETE' }); await loadTasks(); } }
function openModal(task?: Task) { const editing = Boolean(task); const modal = document.createElement('div'); modal.className = 'modal-wrap'; modal.innerHTML = `<div class="modal"><button class="modal-close" data-close>×</button><p class="eyebrow">${editing ? 'EDIT TASK' : 'NEW TASK'}</p><h2>${editing ? 'Shape the next move.' : 'What needs your attention?'}</h2><form id="task-form"><label>Title<input name="title" required value="${escapeHtml(task?.title ?? '')}" placeholder="e.g. Draft the project brief" /></label><label>Notes<textarea name="description" placeholder="Add useful context...">${escapeHtml(task?.description ?? '')}</textarea></label><div class="form-grid"><label>Status<select name="status"><option value="todo">To do</option><option value="in-progress">In progress</option><option value="done">Completed</option></select></label><label>Priority<select name="priority"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label></div><div class="form-grid"><label>Due date<input type="date" name="due" value="${task?.due ?? ''}" /></label><label>Tags<input name="tags" value="${task?.tags.join(', ') ?? ''}" placeholder="design, admin" /></label></div><button class="primary full" type="submit">${editing ? 'Save changes' : 'Add to ledger'}</button></form></div>`; document.body.append(modal); if (task) { (modal.querySelector('[name="status"]') as HTMLSelectElement).value = task.status; (modal.querySelector('[name="priority"]') as HTMLSelectElement).value = task.priority; } modal.querySelector('[data-close]')!.addEventListener('click', () => modal.remove()); modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); }); modal.querySelector('form')!.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget as HTMLFormElement); const payload = { title: data.get('title'), description: data.get('description'), status: data.get('status'), priority: data.get('priority'), due: data.get('due'), tags: String(data.get('tags')).split(',').map((tag) => tag.trim()).filter(Boolean) }; await request(editing ? `/api/tasks/${task!.id}` : '/api/tasks', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(editing ? { ...task, ...payload } : payload) }); modal.remove(); await loadTasks(); }); }

async function loadTasks() { tasks = await request<Task[]>('/api/tasks'); render(); }
async function loadReport() { const report = await request<Report>('/api/report'); const target = document.querySelector<HTMLDivElement>('#report'); if (!target) return; const percent = report.total ? Math.round(report.done / report.total * 100) : 0; target.innerHTML = `<div class="progress-ring" style="--progress: ${percent * 3.6}deg"><div><strong>${percent}%</strong><small>complete</small></div></div><div class="report-stats"><div><span class="legend done"></span><span>Completed</span><strong>${report.done}</strong></div><div><span class="legend active"></span><span>In progress</span><strong>${report.inProgress}</strong></div><div><span class="legend late"></span><span>Overdue</span><strong>${report.overdue}</strong></div></div><div class="report-callout"><strong>${report.dueSoon} due soon</strong><span>Keep the next seven days visible.</span></div><p class="report-footnote">Priority mix · <b>${report.byPriority.high}</b> high · <b>${report.byPriority.medium}</b> medium · <b>${report.byPriority.low}</b> low</p>`; }

loadTasks();
