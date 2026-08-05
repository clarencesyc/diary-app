import { state, saveEntries } from './state.js';
import { renderEntries } from './entries.js';
import { showToast } from './utils.js';

let draggedEntryId = null;
let longPressTimer = null;
let isDragging = false;
let startX = 0, startY = 0;
let cloneEl = null;

const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD = 10;

export function initDragAndDrop(element, entry, onLongPressMenu) {
  element.addEventListener('mousedown', (e) => handlePointerDown(e, entry, onLongPressMenu));
  element.addEventListener('touchstart', (e) => handlePointerDown(e, entry, onLongPressMenu), {passive: false});
}

function handlePointerDown(e, entry, onLongPressMenu) {
  if (e.type === 'mousedown' && e.button !== 0) return;
  
  const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
  const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
  
  startX = clientX;
  startY = clientY;
  isDragging = false;
  
  // Start long press timer
  longPressTimer = setTimeout(() => {
    // If not moved significantly, enter draggable or menu mode
    draggedEntryId = entry.id;
    // Visually indicate readiness (e.g. slight scale up, haptic)
    const el = document.querySelector(`[data-id="${entry.id}"]`);
    if (el) el.classList.add('ready-to-drag');
  }, LONG_PRESS_MS);

  document.addEventListener('mousemove', handlePointerMove);
  document.addEventListener('touchmove', handlePointerMove, {passive: false});
  document.addEventListener('mouseup', handlePointerUp);
  document.addEventListener('touchend', handlePointerUp);
}

function handlePointerMove(e) {
  const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
  const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
  
  const dx = clientX - startX;
  const dy = clientY - startY;
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  if (!isDragging && distance > MOVE_THRESHOLD) {
    if (draggedEntryId) {
      // Initiate drag
      isDragging = true;
      e.preventDefault();
      startDragging(clientX, clientY);
    } else {
      // Cancel long press if moved before timer
      clearTimeout(longPressTimer);
    }
  }
  
  if (isDragging) {
    e.preventDefault();
    updateClonePosition(clientX, clientY);
    highlightDropTargets(clientX, clientY);
  }
}

function handlePointerUp(e) {
  clearTimeout(longPressTimer);
  
  const clientX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;

  if (isDragging) {
    stopDragging(clientX, clientY);
  } else if (draggedEntryId) {
    // Long pressed but didn't drag -> open context menu
    const el = document.querySelector(`[data-id="${draggedEntryId}"]`);
    if (el) el.classList.remove('ready-to-drag');
    // Call the original context menu logic (passing synthetic coords)
    // We will export a hook for this from entries.js
    document.dispatchEvent(new CustomEvent('open-context-menu', { detail: { entryId: draggedEntryId, x: clientX, y: clientY } }));
  }
  
  draggedEntryId = null;
  document.removeEventListener('mousemove', handlePointerMove);
  document.removeEventListener('touchmove', handlePointerMove);
  document.removeEventListener('mouseup', handlePointerUp);
  document.removeEventListener('touchend', handlePointerUp);
}

function startDragging(x, y) {
  const originalEl = document.querySelector(`[data-id="${draggedEntryId}"]`);
  if (!originalEl) return;
  
  originalEl.classList.add('is-dragging-source');
  
  cloneEl = originalEl.cloneNode(true);
  cloneEl.classList.add('drag-clone');
  document.body.appendChild(cloneEl);
  updateClonePosition(x, y);
}

function updateClonePosition(x, y) {
  if (cloneEl) {
    cloneEl.style.left = `${x}px`;
    cloneEl.style.top = `${y}px`;
  }
}

function highlightDropTargets(x, y) {
  document.querySelectorAll('.entry-icon.drop-target').forEach(el => el.classList.remove('drop-target'));
  
  // Find element under pointer
  cloneEl.style.pointerEvents = 'none'; // so we can get element below
  const target = document.elementFromPoint(x, y);
  cloneEl.style.pointerEvents = 'auto';
  
  if (target) {
    const entryEl = target.closest('.entry-icon');
    if (entryEl && entryEl.dataset.id !== draggedEntryId) {
      const targetEntry = state.entries.find(e => e.id === entryEl.dataset.id);
      if (targetEntry && targetEntry.type === 'file') {
        entryEl.classList.add('drop-target');
      }
    }
  }
}

function stopDragging(x, y) {
  if (cloneEl) {
    cloneEl.remove();
    cloneEl = null;
  }
  
  const originalEl = document.querySelector(`[data-id="${draggedEntryId}"]`);
  if (originalEl) {
    originalEl.classList.remove('is-dragging-source', 'ready-to-drag');
  }
  
  const target = document.elementFromPoint(x, y);
  if (target) {
    const entryEl = target.closest('.entry-icon');
    if (entryEl && entryEl.dataset.id !== draggedEntryId) {
      const targetEntry = state.entries.find(e => e.id === entryEl.dataset.id);
      if (targetEntry && targetEntry.type === 'file') {
        // Perform Move
        const dragged = state.entries.find(e => e.id === draggedEntryId);
        if (dragged) {
          dragged.parentId = targetEntry.id;
          saveEntries();
          renderEntries();
          showToast(`Moved to ${targetEntry.title}`);
        }
      }
    }
  }
  
  document.querySelectorAll('.entry-icon.drop-target').forEach(el => el.classList.remove('drop-target'));
}
