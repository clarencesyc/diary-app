/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — DOM Cache
   ═══════════════════════════════════════════════════════════ */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);

export const dom = {
  mainPage: $('#main-page'),
  editorPage: $('#editor-page'),
  addModalOverlay: $('#add-modal-overlay'),
  addModal: $('#add-modal'),
  addBtn: $('#add-btn'),
  addModalClose: $('#add-modal-close'),

  // Modal steps
  stepChoose: $('#modal-step-choose'),
  stepFile: $('#modal-step-file'),
  stepDiary: $('#modal-step-diary'),
  chooseFile: $('#choose-file'),
  chooseDiary: $('#choose-diary'),
  fileBack: $('#file-back'),
  diaryBack: $('#diary-back'),

  // File creation
  fileColorPicker: $('#file-color-picker'),
  fileTitleInput: $('#file-title-input'),
  fileVisibility: $('#file-visibility'),
  fileAllowedUsers: $('#file-allowed-users'),
  fileCreateBtn: $('#file-create-btn'),

  // Diary creation
  diaryColorPicker: $('#diary-color-picker'),
  diaryTitleInput: $('#diary-title-input'),
  diaryVisibility: $('#diary-visibility'),
  diaryCreateBtn: $('#diary-create-btn'),

  // Main grid
  entriesGrid: $('#entries-grid'),
  emptyState: $('#empty-state'),
  entryCount: $('#entry-count'),

  // Sort
  sortBtn: $('#sort-btn'),

  // Calendar
  calMonth: $('#cal-month'),
  calDays: $('#cal-days'),
  calPrev: $('#cal-prev'),
  calNext: $('#cal-next'),
  calWeekdays: $('#cal-weekdays'),

  // Editor
  editorBack: $('#editor-back'),
  editorSave: $('#editor-save'),
  editorTitle: $('#editor-title'),
  editorLabel: $('#editor-label'),
  fontDec: $('#font-dec'),
  fontInc: $('#font-inc'),
  fontSizeDisplay: $('#font-size-display'),
  editorWorkspace: $('#editor-workspace'),
  editorMap: $('#editor-map'),
  legoGridContainer: $('#lego-grid-container'),
  legoGrid: $('#lego-grid'),
  
  // Book Overview
  pageOverviewOverlay: $('#page-overview-overlay'),
  closeOverviewBtn: $('#close-overview'),
  overviewGrid: $('#overview-grid'),
  bookSpine: $('#book-spine'),

  // Placement
  placementOverlay: $('#placement-overlay'),
  cancelPlacement: $('#cancel-placement'),

  // FAB
  fabAdd: $('#fab-add'),

  // Drawer
  drawerOverlay: $('#drawer-overlay'),
  drawer: $('#drawer'),
  drawerTabs: $('#drawer-tabs'),
  drawerContent: $('#drawer-content'),
  carouselViewport: $('#carousel-viewport'),
  carouselPrev: $('#carousel-prev'),
  carouselNext: $('#carousel-next'),
  carouselDots: $('#carousel-dots'),
  btnChooseSize: $('#btn-choose-size'),

  // Confirm
  confirmOverlay: $('#confirm-overlay'),
  confirmImage: $('#confirm-image'),
  confirmYes: $('#confirm-yes'),
  confirmNo: $('#confirm-no'),

  // File input
  fileInputHidden: $('#file-input-hidden'),

  // Context Menu
  ctxMenu: $('#context-menu'),
  ctxEdit: $('#ctx-edit'),
  ctxDelete: $('#ctx-delete'),

  // Toast
  toast: $('#toast'),
  toastMsg: $('#toast-msg'),
};
