/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Widget Placement, Rendering & Removal
   ═══════════════════════════════════════════════════════════ */

import { state, saveEntries } from './state.js';
import { dom } from './dom.js';
import { showToast } from './utils.js';
import { checkPlacement, markCellsOccupied, freeCells, clearCellHighlights, buildLegoGrid } from './grid.js';


/* ── Place Widget ────────────────────────────────────── */
export function placeWidget(row, col, wCols, wRows, imageData) {
  let widgetId = `w_${state.widgetIdCounter++}`;
  let type = 'gallery';

  if (state.movingWidget) {
    widgetId = state.movingWidget.id;
    type = state.movingWidget.type;
  }

  const widgetData = {
    id: widgetId,
    type,
    row,
    col,
    cols: wCols,
    rows: wRows,
    imageData,
  };

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

  el.innerHTML = `
    <img src="${w.imageData}" alt="Widget" style="width: 100%; height: 100%; object-fit: cover;" />
    <button class="widget-delete" title="Remove widget">✕</button>
    <div class="resize-handle" title="Drag to resize"></div>
  `;

  el.querySelector('.widget-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    removeWidget(w.id);
  });

  // Long press to pickup and move
  let pressTimer;
  const cancelPress = () => clearTimeout(pressTimer);
  
  el.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('resize-handle')) return;
    pressTimer = setTimeout(() => pickupWidget(w), 500);
  });
  el.addEventListener('touchend', cancelPress);
  el.addEventListener('touchmove', cancelPress);

  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.classList.contains('resize-handle')) return;
    pressTimer = setTimeout(() => pickupWidget(w), 500);
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


/* ── Pickup Widget (Move) ────────────────────────────── */
export function pickupWidget(w) {
  freeCells(w.id);
  state.widgets = state.widgets.filter((x) => x.id !== w.id);
  const el = dom.legoGrid.querySelector(`.placed-widget[data-widget-id="${w.id}"]`);
  if (el) el.remove();

  state.movingWidget = w; // Store to restore if cancelled
  enterPlacementMode({ cols: w.cols, rows: w.rows }, w.imageData);
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
export function enterPlacementMode(size, imageData) {
  state.placementMode = true;
  state.placementSize = size;
  state.placementImage = imageData;
  dom.placementOverlay.classList.remove('hidden');
  dom.fabAdd.style.display = 'none';
}

export function exitPlacementMode() {
  state.placementMode = false;
  state.placementSize = null;
  state.placementImage = null;
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
