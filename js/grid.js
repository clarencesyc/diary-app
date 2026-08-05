/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — LEGO Grid Engine
   ═══════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { dom } from './dom.js';
import { showToast } from './utils.js';
// NOTE: Circular with widgets.js — safe because these are only called at runtime
import { placeWidget, exitPlacementMode } from './widgets.js';

/* ── Grid Dimensions ─────────────────────────────────── */
export function updateGridDimensionsFromContainer() {
  const container = dom.editorWorkspace;
  if (!container) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const cellSize = parseInt(rootStyle.getPropertyValue('--grid-cell')) || 60;
  const gap = parseInt(rootStyle.getPropertyValue('--grid-gap')) || 4;
  const totalCellSize = cellSize + gap;

  const width = container.clientWidth;
  const height = container.clientHeight;

  state.gridCols = Math.max(5, Math.floor(width / totalCellSize));
  state.gridRows = Math.max(5, Math.floor(height / totalCellSize));
}

/* ── Reserve Map Area ────────────────────────────────── */
export function reserveMapArea() {
  const map = dom.editorMap;
  if (!map) return;

  const rootStyle = getComputedStyle(document.documentElement);
  const cellSize = parseInt(rootStyle.getPropertyValue('--grid-cell')) || 60;
  const gap = parseInt(rootStyle.getPropertyValue('--grid-gap')) || 4;
  const totalCellSize = cellSize + gap;

  const mapWidth = map.offsetWidth;
  const mapHeight = map.offsetHeight;

  const wCols = Math.ceil(mapWidth / totalCellSize);
  const wRows = Math.ceil(mapHeight / totalCellSize);

  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      const key = `${r}-${c}`;
      state.occupiedCells[key] = 'map-widget';
      const cell = dom.legoGrid.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
      if (cell) {
        cell.classList.add('occupied');
        cell.style.opacity = '0';
      }
    }
  }
}


/* ── Build Grid ──────────────────────────────────────── */
export function buildLegoGrid() {
  const grid = dom.legoGrid;
  grid.innerHTML = '';
  grid.style.setProperty('--grid-cols', state.gridCols);
  grid.style.setProperty('--grid-rows', state.gridRows);

  for (let r = 0; r < state.gridRows; r++) {
    for (let c = 0; c < state.gridCols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;

      cell.addEventListener('mouseenter', () => onCellHover(r, c));
      cell.addEventListener('mouseleave', () => clearCellHighlights());
      cell.addEventListener('click', () => onCellClick(r, c));

      grid.appendChild(cell);
    }
  }

  // Reserve map area
  reserveMapArea();
}


/* ── Cell Helpers ────────────────────────────────────── */
export function getCell(row, col) {
  return dom.legoGrid.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
}

export function clearCellHighlights() {
  dom.legoGrid.querySelectorAll('.placement-hover, .placement-invalid').forEach((c) => {
    c.classList.remove('placement-hover', 'placement-invalid');
  });
}


/* ── Collision Detection ─────────────────────────────── */

/**
 * Check if a widget of size (wCols × wRows) can be placed at (startRow, startCol).
 */
export function checkPlacement(startRow, startCol, wCols, wRows, ignoreWidgetId = null) {
  const row = Number(startRow);
  const col = Number(startCol);
  const cols = Number(wCols);
  const rows = Number(wRows);

  if (row + rows > state.gridRows) return false;
  if (col + cols > state.gridCols) return false;

  for (let r = row; r < row + rows; r++) {
    for (let c = col; c < col + cols; c++) {
      const key = `${r}-${c}`;
      const occupant = state.occupiedCells[key];
      if (occupant && occupant !== ignoreWidgetId) return false;
    }
  }
  return true;
}

/**
 * Mark cells as occupied by the given widget ID.
 */
export function markCellsOccupied(startRow, startCol, wCols, wRows, widgetId) {
  const row = Number(startRow);
  const col = Number(startCol);
  const cols = Number(wCols);
  const rows = Number(wRows);

  for (let r = row; r < row + rows; r++) {
    for (let c = col; c < col + cols; c++) {
      const key = `${r}-${c}`;
      state.occupiedCells[key] = widgetId;
      const cell = getCell(r, c);
      if (cell) cell.classList.add('occupied');
    }
  }
}

/**
 * Unmark cells for a removed widget.
 */
export function freeCells(widgetId) {
  Object.keys(state.occupiedCells).forEach((key) => {
    if (state.occupiedCells[key] === widgetId) {
      delete state.occupiedCells[key];
      const [r, c] = key.split('-').map(Number);
      const cell = getCell(r, c);
      if (cell) cell.classList.remove('occupied');
    }
  });
}


/* ── Cell Interaction (Hover & Click during placement) ── */

function onCellHover(row, col) {
  if (!state.placementMode || !state.placementSize) return;

  clearCellHighlights();

  const { cols: wCols, rows: wRows } = state.placementSize;
  const canPlace = checkPlacement(row, col, wCols, wRows);

  for (let r = row; r < row + wRows && r < state.gridRows; r++) {
    for (let c = col; c < col + wCols && c < state.gridCols; c++) {
      const cell = getCell(r, c);
      if (cell) {
        cell.classList.add(canPlace ? 'placement-hover' : 'placement-invalid');
      }
    }
  }
}

function onCellClick(row, col) {
  if (!state.placementMode || !state.placementSize) return;
  if (state.placementType !== 'todo' && !state.placementImage) return;

  const { cols: wCols, rows: wRows } = state.placementSize;
  if (!checkPlacement(row, col, wCols, wRows)) {
    showToast('Cannot place here — cells are occupied or out of bounds');
    return;
  }

  placeWidget(row, col, wCols, wRows, state.placementImage);
  exitPlacementMode();
  showToast('Widget placed!');
}
