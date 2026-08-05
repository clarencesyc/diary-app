/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — To-Do Widget Logic
   ═══════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './utils.js';


let todoComposeContext = null;
let todoRenameContext = null;
let todoResizeContext = null;


export function ensureTodoWidgetData(w) {
  if (!Array.isArray(w.groups)) w.groups = [];
  if (!Array.isArray(w.tasks)) w.tasks = [];
  if (w.activeTab == null) w.activeTab = 'all';
}


export function createTodoGroup(w) {
  ensureTodoWidgetData(w);
  const group = {
    id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `그룹${w.groups.length + 1}`,
  };
  w.groups.push(group);
  w.activeTab = group.id;
  return group;
}


function getVisibleTasks(w) {
  ensureTodoWidgetData(w);
  if (w.activeTab === 'all') return w.tasks;
  return w.tasks.filter((t) => t.groupId === w.activeTab);
}


export function refreshTodoTaskList(el, w) {
  ensureTodoWidgetData(w);

  const body = el.querySelector('.todo-widget-body');
  if (!body) return;

  const emptyEl = body.querySelector('.todo-empty');
  const listEl = body.querySelector('.todo-task-list');
  if (!emptyEl || !listEl) return;

  const visible = getVisibleTasks(w);

  if (visible.length === 0) {
    emptyEl.classList.remove('hidden');
    listEl.replaceChildren();
    listEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');
  listEl.replaceChildren();

  visible.forEach((task) => {
    const item = document.createElement('li');
    item.className = 'todo-task-item' + (task.completed ? ' todo-task-item--completed' : '');
    item.dataset.taskId = task.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-task-check' + (task.completed ? ' todo-task-check--done' : '');
    check.dataset.action = 'toggle-task';
    check.dataset.taskId = task.id;
    check.setAttribute('aria-label', task.completed ? '완료 취소' : '완료 표시');

    const title = document.createElement('span');
    title.className = 'todo-task-title';
    title.textContent = task.title;

    item.appendChild(check);
    item.appendChild(title);
    listEl.appendChild(item);
  });
}


export function buildTodoWidgetShell() {
  return `
    <div class="todo-widget">
      <header class="todo-widget-header">
        <div class="todo-widget-tabs"></div>
        <button type="button" class="todo-tab-add" aria-label="그룹 추가">+</button>
        <button type="button" class="todo-widget-resize" aria-label="크기 변경" title="크기 변경">⤢</button>
        <button type="button" class="widget-delete todo-widget-delete" title="Remove widget">✕</button>
      </header>
      <div class="todo-widget-body">
        <p class="todo-empty">아직 할 일이 없습니다.</p>
        <ul class="todo-task-list hidden"></ul>
      </div>
      <button type="button" class="todo-fab" aria-label="할 일 추가">+</button>
    </div>
  `;
}


export function refreshTodoTabs(el, w) {
  const tabsContainer = el.querySelector('.todo-widget-tabs');
  if (!tabsContainer) return;

  tabsContainer.replaceChildren();

  const allTab = document.createElement('button');
  allTab.type = 'button';
  allTab.className = 'todo-tab' + (w.activeTab === 'all' ? ' todo-tab--active' : '');
  allTab.textContent = '전체';
  tabsContainer.appendChild(allTab);

  w.groups.forEach((group) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'todo-tab' + (w.activeTab === group.id ? ' todo-tab--active' : '');
    tab.dataset.groupId = group.id;
    tab.textContent = group.name;
    tabsContainer.appendChild(tab);
  });

  const activeTab = tabsContainer.querySelector('.todo-tab--active');
  if (activeTab) {
    activeTab.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  refreshTodoTaskList(el, w);
}


function getActiveGroup(w) {
  ensureTodoWidgetData(w);
  if (w.activeTab === 'all') return null;
  return w.groups.find((g) => g.id === w.activeTab) ?? null;
}


function getTodoWidgetElement(widgetId) {
  return dom.legoGrid.querySelector(`.placed-widget[data-widget-id="${widgetId}"]`);
}


function createTodoTask(w, title) {
  return {
    id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    groupId: w.activeTab,
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
}


function handleTodoComposeSubmit() {
  if (!todoComposeContext) return;

  const w = state.widgets.find((x) => x.id === todoComposeContext.widgetId);
  if (!w) return;

  ensureTodoWidgetData(w);

  if (w.activeTab === 'all') return;

  const group = w.groups.find((g) => g.id === w.activeTab);
  if (!group) return;

  const title = dom.todoComposeTitle.value.trim();
  if (!title) {
    dom.todoComposeTitle.focus();
    return;
  }

  w.tasks.push(createTodoTask(w, title));
  dom.todoComposeTitle.value = '';
  closeTodoComposeSheet();

  const el = getTodoWidgetElement(w.id);
  if (el) refreshTodoTaskList(el, w);
}


export function openTodoComposeSheet(widgetId, group) {
  if (todoRenameContext?.widgetId === widgetId) {
    closeTodoGroupRenameModal();
  }
  if (todoResizeContext?.widgetId === widgetId) {
    closeTodoResizeSheet();
  }

  todoComposeContext = { widgetId, groupId: group.id };

  dom.todoComposeHeading.textContent = `${group.name}에 할 일 추가`;
  dom.todoComposeTitle.value = '';

  dom.todoComposeOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.todoComposeOverlay.classList.add('active'));
  dom.todoComposeTitle.focus();
}


export function closeTodoComposeSheet() {
  dom.todoComposeOverlay.classList.remove('active');
  setTimeout(() => dom.todoComposeOverlay.classList.add('hidden'), 450);

  dom.todoComposeTitle.value = '';
  todoComposeContext = null;
}


function handleFabClick(el, w) {
  ensureTodoWidgetData(w);

  if (w.groups.length === 0) {
    showToast('먼저 그룹을 추가하세요');
    return;
  }

  if (w.activeTab === 'all') {
    showToast('먼저 그룹을 선택하세요');
    return;
  }

  const group = getActiveGroup(w);
  if (!group) return;

  openTodoComposeSheet(w.id, group);
}


export function openTodoGroupRenameModal(widgetId, group) {
  if (todoComposeContext?.widgetId === widgetId) {
    closeTodoComposeSheet();
  }
  if (todoResizeContext?.widgetId === widgetId) {
    closeTodoResizeSheet();
  }

  todoRenameContext = { widgetId, groupId: group.id };

  dom.todoRenameInput.value = group.name;

  dom.todoRenameOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.todoRenameOverlay.classList.add('active'));
  dom.todoRenameInput.focus();
  dom.todoRenameInput.select();
}


export function closeTodoGroupRenameModal() {
  dom.todoRenameOverlay.classList.remove('active');
  setTimeout(() => dom.todoRenameOverlay.classList.add('hidden'), 200);

  dom.todoRenameInput.value = '';
  todoRenameContext = null;
}


function handleTodoGroupRenameSubmit() {
  if (!todoRenameContext) return;

  const w = state.widgets.find((x) => x.id === todoRenameContext.widgetId);
  if (!w) return;

  ensureTodoWidgetData(w);

  const group = w.groups.find((g) => g.id === todoRenameContext.groupId);
  if (!group) return;

  const name = dom.todoRenameInput.value.trim();
  if (!name) {
    dom.todoRenameInput.focus();
    return;
  }

  const duplicate = w.groups.some((g) => g.id !== group.id && g.name === name);
  if (duplicate) {
    showToast('이미 같은 이름의 그룹이 있습니다');
    dom.todoRenameInput.focus();
    return;
  }

  group.name = name;
  closeTodoGroupRenameModal();

  const el = getTodoWidgetElement(w.id);
  if (el) refreshTodoTabs(el, w);
}


function buildTodoResizeSizeOptions(w) {
  if (!dom.todoResizeSizeList) return;

  dom.todoResizeSizeList.replaceChildren();

  state.widgetSizes.forEach((size) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'todo-resize-size-option';
    if (w.cols === size.cols && w.rows === size.rows) {
      btn.classList.add('todo-resize-size-option--current');
    }
    btn.dataset.cols = String(size.cols);
    btn.dataset.rows = String(size.rows);

    const label = document.createElement('span');
    label.className = 'todo-resize-size-label';
    label.textContent = size.label;

    const subtitle = document.createElement('span');
    subtitle.className = 'todo-resize-size-subtitle';
    subtitle.textContent = size.subtitle;

    btn.appendChild(label);
    btn.appendChild(subtitle);
    dom.todoResizeSizeList.appendChild(btn);
  });
}


export function openTodoResizeSheet(widgetId) {
  if (!dom.todoResizeOverlay || !dom.todoResizeSizeList) return;

  const w = state.widgets.find((x) => x.id === widgetId);
  if (!w || w.type !== 'todo') return;

  if (todoComposeContext?.widgetId === widgetId) {
    closeTodoComposeSheet();
  }
  if (todoRenameContext?.widgetId === widgetId) {
    closeTodoGroupRenameModal();
  }

  todoResizeContext = { widgetId };
  buildTodoResizeSizeOptions(w);

  dom.todoResizeOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.todoResizeOverlay.classList.add('active'));
}


export function closeTodoResizeSheet() {
  if (!dom.todoResizeOverlay) return;

  dom.todoResizeOverlay.classList.remove('active');
  setTimeout(() => dom.todoResizeOverlay.classList.add('hidden'), 450);

  if (dom.todoResizeSizeList) dom.todoResizeSizeList.replaceChildren();
  todoResizeContext = null;
}


async function handleTodoResizeSelect(cols, rows) {
  if (!todoResizeContext) return;

  const { widgetId } = todoResizeContext;
  const { resizeTodoWidget } = await import('./widgets.js');

  if (resizeTodoWidget(widgetId, cols, rows)) {
    closeTodoResizeSheet();
  }
}


function toggleTodoTask(w, taskId) {
  ensureTodoWidgetData(w);
  const task = w.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.completed = !task.completed;
}


function setActiveTab(el, w, widgetId, tabId) {
  if (todoComposeContext?.widgetId === widgetId) {
    closeTodoComposeSheet();
  }
  if (todoRenameContext?.widgetId === widgetId) {
    closeTodoGroupRenameModal();
  }
  if (todoResizeContext?.widgetId === widgetId) {
    closeTodoResizeSheet();
  }
  w.activeTab = tabId;
  refreshTodoTabs(el, w);
}


export function bindTodoComposeSheetEvents() {
  dom.todoComposeCancel.addEventListener('click', closeTodoComposeSheet);

  dom.todoComposeSubmit.addEventListener('click', handleTodoComposeSubmit);

  dom.todoComposeOverlay.addEventListener('click', (e) => {
    if (e.target === dom.todoComposeOverlay) closeTodoComposeSheet();
  });
}


export function bindTodoGroupRenameEvents() {
  dom.todoRenameCancel.addEventListener('click', closeTodoGroupRenameModal);

  dom.todoRenameSubmit.addEventListener('click', handleTodoGroupRenameSubmit);

  dom.todoRenameOverlay.addEventListener('click', (e) => {
    if (e.target === dom.todoRenameOverlay) closeTodoGroupRenameModal();
  });

  dom.todoRenameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTodoGroupRenameSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeTodoGroupRenameModal();
    }
  });
}


export function bindTodoResizeSheetEvents() {
  if (!dom.todoResizeOverlay || !dom.todoResizeSizeList || !dom.todoResizeCancel) return;

  dom.todoResizeCancel.addEventListener('click', closeTodoResizeSheet);

  dom.todoResizeOverlay.addEventListener('click', (e) => {
    if (e.target === dom.todoResizeOverlay) closeTodoResizeSheet();
  });

  dom.todoResizeSizeList.addEventListener('click', (e) => {
    const btn = e.target.closest('.todo-resize-size-option');
    if (!btn) return;

    handleTodoResizeSelect(Number(btn.dataset.cols), Number(btn.dataset.rows));
  });
}


export function bindTodoWidgetEvents(el) {
  const root = el.querySelector('.todo-widget');
  if (!root || root.dataset.todoBound) return;
  root.dataset.todoBound = '1';

  const widgetId = el.dataset.widgetId;

  root.addEventListener('click', (e) => {
    const w = state.widgets.find((x) => x.id === widgetId);
    if (!w) return;

    if (e.target.closest('.todo-tab-add')) {
      e.stopPropagation();
      createTodoGroup(w);
      refreshTodoTabs(el, w);
      return;
    }

    if (e.target.closest('.todo-fab')) {
      e.stopPropagation();
      handleFabClick(el, w);
      return;
    }

    const toggleBtn = e.target.closest('[data-action="toggle-task"]');
    if (toggleBtn) {
      e.stopPropagation();
      toggleTodoTask(w, toggleBtn.dataset.taskId);
      refreshTodoTaskList(el, w);
      return;
    }

    const tab = e.target.closest('.todo-tab');
    if (!tab) return;
    e.stopPropagation();

    const tabId = tab.dataset.groupId || 'all';

    if (e.detail === 2 && tab.dataset.groupId && w.activeTab === tab.dataset.groupId) {
      const group = w.groups.find((g) => g.id === tab.dataset.groupId);
      if (group) openTodoGroupRenameModal(widgetId, group);
      return;
    }

    if (w.activeTab === tabId) return;

    setActiveTab(el, w, widgetId, tabId);
  });
}
