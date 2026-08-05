/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Widget Placement, Rendering & Removal
   ═══════════════════════════════════════════════════════════ */

import { state, saveEntries } from './state.js';
import { dom } from './dom.js';
import { showToast } from './utils.js';
import { checkPlacement, markCellsOccupied, freeCells, clearCellHighlights, buildLegoGrid, reserveMapArea } from './grid.js';
import { buildTodoWidgetShell, ensureTodoWidgetData, bindTodoWidgetEvents, refreshTodoTabs, openTodoResizeSheet } from './todo.js';


/* ── Place Widget ────────────────────────────────────── */
export function placeWidget(row, col, wCols, wRows, imageData) {
  let widgetId = `w_${state.widgetIdCounter++}`;
  let type = 'gallery';

  if (state.movingWidget) {
    widgetId = state.movingWidget.id;
    type = state.movingWidget.type;
  } else if (state.placementType) {
    type = state.placementType;
  }

  const widgetData = {
    id: widgetId,
    type,
    row: Number(row),
    col: Number(col),
    cols: Number(wCols),
    rows: Number(wRows),
    imageData,
  };

  if (type === 'todo') {
    if (state.movingWidget) {
      widgetData.groups = state.movingWidget.groups ?? [];
      widgetData.activeTab = state.movingWidget.activeTab ?? 'all';
      widgetData.tasks = state.movingWidget.tasks ?? [];
    } else {
      widgetData.groups = [];
      widgetData.activeTab = 'all';
      widgetData.tasks = [];
    }
  }

  markCellsOccupied(row, col, wCols, wRows, widgetId);
  state.widgets.push(widgetData);

  renderPlacedWidget(widgetData);

  if (!state.movingWidget) {
    showToast('Widget placed');
  } else {
    state.movingWidget = null;
    showToast('Widget moved');
  }

  exitPlacementMode();
  saveEntries();
}


/* ── Render Placed Widget ────────────────────────────── */
export function renderPlacedWidget(w) {
  const grid = dom.legoGrid;
  const rootStyle = getComputedStyle(document.documentElement);
  const cellSize = parseInt(rootStyle.getPropertyValue('--grid-cell')) || 60;
  const gap = parseInt(rootStyle.getPropertyValue('--grid-gap')) || 4;

  const el = document.createElement('div');
  el.className = 'placed-widget';
  el.dataset.widgetId = w.id;

  const updateVisualSize = () => {
    const left = w.col * cellSize + w.col * gap;
    const top = w.row * cellSize + w.row * gap;
    const width = w.cols * cellSize + (w.cols - 1) * gap;
    const height = w.rows * cellSize + (w.rows - 1) * gap;

    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = width + 'px';
    el.style.height = height + 'px';
  };
  
  updateVisualSize();

  if (w.type === 'todo') {
    el.classList.add('placed-widget--todo');
    el.dataset.widgetCols = String(w.cols);
    el.dataset.widgetRows = String(w.rows);
    ensureTodoWidgetData(w);
    el.innerHTML = buildTodoWidgetShell();
    refreshTodoTabs(el, w);
    bindTodoWidgetEvents(el);

    const resizeBtn = el.querySelector('.todo-widget-resize');
    if (resizeBtn) {
      resizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openTodoResizeSheet(w.id);
      });
    }
  } else {
    el.innerHTML = `
      <img src="${w.imageData}" alt="Widget" style="width: 100%; height: 100%; object-fit: cover;" />
      <button class="widget-delete" title="Remove widget">✕</button>
      <div class="resize-handle" title="Drag to resize"></div>
    `;
  }

  el.querySelector('.widget-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    removeWidget(w.id);
  });

  // Long press to pickup and move
  let pressTimer;
  let pressStartX = 0;
  let pressStartY = 0;
  const DRAG_CANCEL_PX = 8;

  const shouldSkipPressStart = (target) => {
    if (target.closest('button')) return true;
    if (w.type === 'todo' && target.closest('.todo-widget-header')) return true;
    return false;
  };

  const cancelPress = () => clearTimeout(pressTimer);
  const startPress = (clientX, clientY) => {
    pressStartX = clientX;
    pressStartY = clientY;
    pressTimer = setTimeout(() => pickupWidget(w), 500);
  };

  const trackPressMove = (clientX, clientY) => {
    if (!pressTimer) return;
    const dx = clientX - pressStartX;
    const dy = clientY - pressStartY;
    if (Math.hypot(dx, dy) > DRAG_CANCEL_PX) cancelPress();
  };

  el.addEventListener('touchstart', (e) => {
    if (shouldSkipPressStart(e.target)) return;
    const touch = e.touches[0];
    if (!touch) return;
    startPress(touch.clientX, touch.clientY);
  }, { passive: true });
  el.addEventListener('touchend', cancelPress);
  el.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (touch) trackPressMove(touch.clientX, touch.clientY);
  }, { passive: true });

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.classList.contains('resize-handle')) return;
    if (shouldSkipPressStart(e.target)) return;
    startPress(e.clientX, e.clientY);
  });
  el.addEventListener('mousemove', (e) => {
    trackPressMove(e.clientX, e.clientY);
  });
  el.addEventListener('mouseup', cancelPress);
  el.addEventListener('mouseleave', cancelPress);
  
  // Resize logic
  const handle = el.querySelector('.resize-handle');
  
  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Support both touch and mouse
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const startX = clientX;
    const startY = clientY;
    const startCols = w.cols;
    const startRows = w.rows;
    const totalCellSize = cellSize + gap;
    
    freeCells(w.id);
    
    const doResize = (moveEvent) => {
      moveEvent.preventDefault();
      const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const dx = currentX - startX;
      const dy = currentY - startY;
      
      let newCols = Math.max(1, startCols + Math.round(dx / totalCellSize));
      let newRows = Math.max(1, startRows + Math.round(dy / totalCellSize));
      
      newCols = Math.min(newCols, state.gridCols - w.col);
      newRows = Math.min(newRows, state.gridRows - w.row);
      
      if (checkPlacement(w.row, w.col, newCols, newRows)) {
         w.cols = newCols;
         w.rows = newRows;
         updateVisualSize();
      }
    };
    
    const endResize = () => {
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', endResize);
      document.removeEventListener('touchmove', doResize);
      document.removeEventListener('touchend', endResize);
      
      markCellsOccupied(w.row, w.col, w.cols, w.rows, w.id);
      saveEntries();
    };
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', endResize);
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', endResize);
  };
  
  handle.addEventListener('mousedown', startResize);
  handle.addEventListener('touchstart', startResize, { passive: false });

  // Entrance animation
  el.style.opacity = '0';
  el.style.transform = 'scale(0.8)';
  grid.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)';
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';
    // Remove transition after animation to prevent lag during resize
    setTimeout(() => { el.style.transition = ''; }, 200);
  });
}


/* ── Remove Widget ───────────────────────────────────── */
export function removeWidget(widgetId) {
  freeCells(widgetId);

  state.widgets = state.widgets.filter((w) => w.id !== widgetId);

  const el = dom.legoGrid.querySelector(`.placed-widget[data-widget-id="${widgetId}"]`);
  if (el) {
    el.style.transition = 'opacity 0.15s, transform 0.15s';
    el.style.opacity = '0';
    el.style.transform = 'scale(0.8)';
    setTimeout(() => el.remove(), 150);
  }

  showToast('Widget removed');
}


export function resizeTodoWidget(widgetId, newCols, newRows) {
  const w = state.widgets.find((x) => x.id === widgetId);
  if (!w || w.type !== 'todo') return false;

  const row = Number(w.row);
  const col = Number(w.col);
  const oldCols = Number(w.cols);
  const oldRows = Number(w.rows);
  const cols = Number(newCols);
  const rows = Number(newRows);

  if (oldCols === cols && oldRows === rows) return true;

  freeCells(widgetId);

  if (!checkPlacement(row, col, cols, rows)) {
    markCellsOccupied(row, col, oldCols, oldRows, widgetId);
    showToast('현재 위치에서는 해당 크기로 변경할 수 없습니다.');
    return false;
  }

  w.row = row;
  w.col = col;
  w.cols = cols;
  w.rows = rows;
  markCellsOccupied(row, col, cols, rows, widgetId);

  const el = dom.legoGrid.querySelector(`.placed-widget[data-widget-id="${widgetId}"]`);
  if (el) el.remove();

  renderPlacedWidget(w);
  return true;
}


/* ── Pickup Widget (Move) ────────────────────────────── */
export function pickupWidget(w) {
  freeCells(w.id);
  state.widgets = state.widgets.filter((x) => x.id !== w.id);
  const el = dom.legoGrid.querySelector(`.placed-widget[data-widget-id="${w.id}"]`);
  if (el) el.remove();

  state.movingWidget = w; // Store to restore if cancelled
  enterPlacementMode({ cols: w.cols, rows: w.rows }, w.imageData, w.type || 'gallery');
}


/* ── Restore Widget (from saved data) ────────────────── */
export function restoreWidget(w) {
  const widgetId = `w_${state.widgetIdCounter++}`;
  const widgetData = { ...w, id: widgetId };

  if (checkPlacement(w.row, w.col, w.cols, w.rows)) {
    markCellsOccupied(w.row, w.col, w.cols, w.rows, widgetId);
    state.widgets.push(widgetData);
    renderPlacedWidget(widgetData);
  }
}


/* ── Re-render all placed widgets ────────────────────── */
export function rerenderPlacedWidgets() {
  dom.legoGrid.querySelectorAll('.placed-widget').forEach((el) => el.remove());

  state.occupiedCells = {};
  dom.legoGrid.querySelectorAll('.grid-cell').forEach((c) => c.classList.remove('occupied'));

  reserveMapArea();

  const currentWidgets = [...state.widgets];
  state.widgets = [];
  currentWidgets.forEach((w) => {
    if (checkPlacement(w.row, w.col, w.cols, w.rows)) {
      markCellsOccupied(w.row, w.col, w.cols, w.rows, w.id);
      state.widgets.push(w);
      renderPlacedWidget(w);
    }
  });
}


/* ── Placement Mode ──────────────────────────────────── */
export function enterPlacementMode(size, imageData, type) {
  state.placementMode = true;
  state.placementSize = size;
  state.placementImage = imageData;
  state.placementType = type;
  dom.placementOverlay.classList.remove('hidden');
  dom.fabAdd.style.display = 'none';
}

export function exitPlacementMode() {
  state.placementMode = false;
  state.placementSize = null;
  state.placementImage = null;
  state.placementType = null;
  state.movingWidget = null;
  dom.placementOverlay.classList.add('hidden');
  dom.fabAdd.style.display = '';
  clearCellHighlights();
}

export function cancelPlacement() {
  if (state.movingWidget) {
    // Restore the widget to its original location
    const w = state.movingWidget;
    markCellsOccupied(w.row, w.col, w.cols, w.rows, w.id);
    state.widgets.push(w);
    renderPlacedWidget(w);
    showToast('Move cancelled');
  } else {
    showToast('Placement cancelled');
  }
  exitPlacementMode();
}
