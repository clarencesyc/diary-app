/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Add Modal (File/Diary Creation)
   ═══════════════════════════════════════════════════════════ */

import { state, saveEntries } from './state.js';
import { dom, $ } from './dom.js';
import { showToast } from './utils.js';
import { renderEntries } from './entries.js';
import { openEditor } from './editor.js';


/* ── Open / Close Modal ──────────────────────────────── */
export function openAddModal() {
  showModalStep('choose');
  dom.addModalOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.addModalOverlay.classList.add('active'));
}

export function closeAddModal() {
  dom.addModalOverlay.classList.remove('active');
  setTimeout(() => dom.addModalOverlay.classList.add('hidden'), 150);
  resetModalForms();
  editingEntryId = null;
  dom.fileCreateBtn.textContent = 'Create File';
  dom.diaryCreateBtn.textContent = 'Create Diary';
}


/* ── Modal Steps ─────────────────────────────────────── */
export function showModalStep(step) {
  dom.stepChoose.classList.add('hidden');
  dom.stepFile.classList.add('hidden');
  dom.stepDiary.classList.add('hidden');
  $(`#modal-step-${step}`).classList.remove('hidden');
}


/* ── Reset Forms ─────────────────────────────────────── */
function resetModalForms() {
  dom.fileTitleInput.value = '';
  dom.diaryTitleInput.value = '';
  dom.fileAllowedUsers.value = '';
  dom.fileAllowedUsers.classList.add('hidden');

  resetColorPicker(dom.fileColorPicker, '#8b5cf6');
  resetColorPicker(dom.diaryColorPicker, '#ec4899');
  resetVisibility(dom.fileVisibility, 'public');
  resetVisibility(dom.diaryVisibility, 'public');
}

function resetColorPicker(container, defaultColor) {
  container.querySelectorAll('.color-swatch').forEach((s) => {
    s.classList.toggle('active', s.dataset.color === defaultColor);
  });
}

function resetVisibility(container, defaultVis) {
  container.querySelectorAll('.vis-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.vis === defaultVis);
  });
}


/* ── Color Picker ────────────────────────────────────── */
export function bindColorPicker(container) {
  container.addEventListener('click', (e) => {
    const swatch = e.target.closest('.color-swatch');
    if (!swatch) return;
    container.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
    swatch.classList.add('active');
  });
}

function getSelectedColor(container) {
  const active = container.querySelector('.color-swatch.active');
  return active ? active.dataset.color : '#8b5cf6';
}


/* ── Visibility ──────────────────────────────────────── */
export function bindVisibilityOptions(container, allowedInput) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.vis-btn');
    if (!btn) return;
    container.querySelectorAll('.vis-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    if (allowedInput) {
      allowedInput.classList.toggle('hidden', btn.dataset.vis !== 'allowed');
    }
  });
}

function getSelectedVisibility(container) {
  const active = container.querySelector('.vis-btn.active');
  return active ? active.dataset.vis : 'public';
}


/* ── Edit Mode State ───────────────────────────────────── */
let editingEntryId = null;

export function openEditModal(entry) {
  editingEntryId = entry.id;
  dom.addModalOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.addModalOverlay.classList.add('active'));

  if (entry.type === 'file') {
    showModalStep('file');
    dom.fileTitleInput.value = entry.title;
    resetColorPicker(dom.fileColorPicker, entry.color);
    resetVisibility(dom.fileVisibility, entry.visibility);
    if (entry.visibility === 'allowed') {
      dom.fileAllowedUsers.classList.remove('hidden');
      dom.fileAllowedUsers.value = entry.allowedUsers ? entry.allowedUsers.join(', ') : '';
    } else {
      dom.fileAllowedUsers.classList.add('hidden');
    }
    dom.fileCreateBtn.textContent = 'Save Changes';
  } else {
    showModalStep('diary');
    dom.diaryTitleInput.value = entry.title;
    resetColorPicker(dom.diaryColorPicker, entry.color);
    resetVisibility(dom.diaryVisibility, entry.visibility);
    dom.diaryCreateBtn.textContent = 'Save Changes';
  }
}

/* ── Create / Update File ────────────────────────────── */
export function createFile() {
  const title = dom.fileTitleInput.value.trim() || 'Untitled File';
  const color = getSelectedColor(dom.fileColorPicker);
  const visibility = getSelectedVisibility(dom.fileVisibility);
  const allowedUsers = visibility === 'allowed'
    ? dom.fileAllowedUsers.value.split(',').map((u) => u.trim()).filter(Boolean)
    : [];

  if (editingEntryId) {
    const entry = state.entries.find(e => e.id === editingEntryId);
    if (entry) {
      entry.title = title;
      entry.color = color;
      entry.visibility = visibility;
      entry.allowedUsers = allowedUsers;
      showToast(`File "${title}" updated`);
    }
  } else {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'file',
      title,
      color,
      visibility,
      allowedUsers,
      createdAt: new Date().toISOString(),
      parentId: state.currentFolderId,
    };
    state.entries.push(entry);
    showToast(`File "${title}" created`);
  }

  saveEntries();
  closeAddModal();
  renderEntries();
}

/* ── Create / Update Diary ───────────────────────────── */
export function createDiary() {
  const title = dom.diaryTitleInput.value.trim() || 'Untitled Diary';
  const color = getSelectedColor(dom.diaryColorPicker);
  const visibility = getSelectedVisibility(dom.diaryVisibility);

  if (editingEntryId) {
    const entry = state.entries.find(e => e.id === editingEntryId);
    if (entry) {
      entry.title = title;
      entry.color = color;
      entry.visibility = visibility;
      showToast(`Diary "${title}" updated`);
    }
    saveEntries();
    closeAddModal();
    renderEntries();
  } else {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: 'diary',
      title,
      color,
      visibility,
      createdAt: new Date().toISOString(),
      parentId: state.currentFolderId,
      pages: [
        {
          id: 'page-' + Date.now() + Math.random().toString(36).slice(2, 6),
          title: 'Page 1',
          mapLocation: null,
          widgets: []
        }
      ],
      titleFontSize: 28,
    };
    state.entries.push(entry);
    saveEntries();
    closeAddModal();
    openEditor(entry);
    showToast(`Diary "${title}" created`);
  }
}
