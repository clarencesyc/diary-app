/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Main Entry Point & Event Orchestration
   ═══════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { dom, $, $$ } from './dom.js';
import { renderCalendar } from './calendar.js';
import { renderEntries, toggleSort, initContextMenu } from './entries.js';
import { buildSizeCarousel, buildTodoSizeCarousel, navigateCarousel, navigateTodoCarousel, openDrawer, closeDrawer, onChooseSize, onChooseTodoSize, onImageSelected, onConfirmYes, onConfirmNo } from './drawer.js';
import { openAddModal, closeAddModal, showModalStep, bindColorPicker, bindVisibilityOptions, createFile, createDiary } from './modals.js';
import { saveEntries } from './state.js';
import { showToast } from './utils.js';
import { cancelPlacement, rerenderPlacedWidgets } from './widgets.js';
import { bindTodoComposeSheetEvents, bindTodoGroupRenameEvents, bindTodoResizeSheetEvents } from './todo.js';
import { updateGridDimensionsFromContainer, buildLegoGrid } from './grid.js';
import { renderBreadcrumbs } from './folderManager.js';
import { renderStorageBox } from './storageBox.js';
import { closeBookEditor, turnPageLeft, turnPageRight, renderBookSpread, openPageOverview, closePageOverview } from './bookEditor.js';


/* ── Initialization ──────────────────────────────────── */
function init() {
  renderCalendar();
  renderEntries();
  renderBreadcrumbs();
  renderStorageBox();
  initContextMenu();
  buildSizeCarousel();
  buildTodoSizeCarousel();
  bindTodoComposeSheetEvents();
  bindTodoGroupRenameEvents();
  bindTodoResizeSheetEvents();
  bindEvents();
}


/* ── Event Binding ───────────────────────────────────── */
function bindEvents() {
  // Add modal
  dom.addBtn?.addEventListener('click', openAddModal);
  dom.addModalClose?.addEventListener('click', closeAddModal);
  dom.addModalOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.addModalOverlay) closeAddModal();
  });

  // Modal navigation
  dom.chooseFile?.addEventListener('click', () => showModalStep('file'));
  dom.chooseDiary?.addEventListener('click', () => showModalStep('diary'));
  dom.fileBack?.addEventListener('click', () => showModalStep('choose'));
  dom.diaryBack?.addEventListener('click', () => showModalStep('choose'));

  // Color pickers
  if (dom.fileColorPicker) bindColorPicker(dom.fileColorPicker);
  if (dom.diaryColorPicker) bindColorPicker(dom.diaryColorPicker);

  // Visibility options
  if (dom.fileVisibility) bindVisibilityOptions(dom.fileVisibility, dom.fileAllowedUsers);
  if (dom.diaryVisibility) bindVisibilityOptions(dom.diaryVisibility);

  // Create buttons
  dom.fileCreateBtn?.addEventListener('click', createFile);
  dom.diaryCreateBtn?.addEventListener('click', createDiary);

  // Sort
  dom.sortBtn?.addEventListener('click', toggleSort);

  // Calendar
  dom.calPrev?.addEventListener('click', () => { state.calendarDate.setMonth(state.calendarDate.getMonth() - 1); renderCalendar(); });
  dom.calNext?.addEventListener('click', () => { state.calendarDate.setMonth(state.calendarDate.getMonth() + 1); renderCalendar(); });

  // Editor (Book UI)
  dom.editorBack?.addEventListener('click', closeBookEditor);
  dom.editorSave?.addEventListener('click', () => {
    saveEntries();
    showToast('Diary saved!');
  });
  
  // Book navigation
  document.getElementById('book-prev')?.addEventListener('click', turnPageLeft);
  document.getElementById('book-next')?.addEventListener('click', turnPageRight);
  document.getElementById('book-spine')?.addEventListener('click', openPageOverview);
  document.getElementById('close-overview')?.addEventListener('click', closePageOverview);

  // Drawer
  dom.drawerOverlay?.addEventListener('click', (e) => {
    if (e.target === dom.drawerOverlay) closeDrawer();
  });

  // Drawer tabs
  dom.drawerTabs?.addEventListener('click', (e) => {
    const tab = e.target.closest('.drawer-tab');
    if (!tab) return;
    $$('.drawer-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    $$('.tab-content').forEach((c) => c.classList.add('hidden'));
    $(`#tab-${tabName}`).classList.remove('hidden');
  });

  // Carousel navigation
  dom.carouselPrev?.addEventListener('click', () => navigateCarousel(-1));
  dom.carouselNext?.addEventListener('click', () => navigateCarousel(1));

  // Choose size
  dom.btnChooseSize?.addEventListener('click', onChooseSize);
  dom.btnChooseTodoSize?.addEventListener('click', onChooseTodoSize);

  // To-Do carousel navigation
  dom.todoCarouselPrev?.addEventListener('click', () => navigateTodoCarousel(-1));
  dom.todoCarouselNext?.addEventListener('click', () => navigateTodoCarousel(1));

  // File input change
  dom.fileInputHidden?.addEventListener('change', onImageSelected);

  // Confirm dialog
  dom.confirmYes?.addEventListener('click', onConfirmYes);
  dom.confirmNo?.addEventListener('click', onConfirmNo);

  // Cancel placement
  dom.cancelPlacement?.addEventListener('click', cancelPlacement);

  // Responsive grid
  window.addEventListener('resize', () => {
    if (!dom.editorPage.classList.contains('active')) return;
    updateGridDimensionsFromContainer();
    buildLegoGrid();
    rerenderPlacedWidgets();
  });

  // Book Overview
  dom.bookSpine?.addEventListener('click', openPageOverview);
  dom.closeOverviewBtn?.addEventListener('click', closePageOverview);
}


/* ── Boot ─────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
