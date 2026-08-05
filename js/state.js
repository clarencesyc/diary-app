/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Global State & Persistence
   ═══════════════════════════════════════════════════════════ */

// --- Data Migration for backward compatibility ---
function migrateEntries(entries) {
  if (!Array.isArray(entries)) return [];
  entries.forEach(entry => {
    // Migrate to nested folders
    if (entry.parentId === undefined) {
      entry.parentId = null;
    }
    // Migrate diaries to Book/Page format
    if (entry.type === 'diary' && entry.widgets && !entry.pages) {
      entry.pages = [
        {
          id: 'page-' + Date.now() + Math.random().toString(36).slice(2, 6),
          title: entry.title || 'Page 1',
          mapLocation: null,
          widgets: entry.widgets || []
        }
      ];
      delete entry.widgets;
    }
  });
  return entries;
}

const loadedEntries = migrateEntries(JSON.parse(localStorage.getItem('memento_entries') || '[]'));

export const state = {
  entries: loadedEntries,
  storedPages: JSON.parse(localStorage.getItem('memento_stored_pages') || '[]'),
  currentFolderId: null, // Tracks which folder we are currently viewing (null = root)
  currentDiary: null,
  calendarDate: new Date(),
  sortAsc: true,

  // Editor Book/Page state
  currentSpreadIndex: 0, // 0 means pages 1-2, 2 means pages 3-4, etc.
  
  // Editor grid state (applies to the currently active page being edited)
  gridCols: 10,
  gridRows: 8,
  occupiedCells: {}, // key: "row-col" → widgetId
  widgets: [],       // placed widgets for current active page
  widgetIdCounter: 0,

  // Placement mode
  placementMode: false,
  placementSize: null,
  placementImage: null,
  placementType: null,

  // Carousel
  carouselIndex: 0,
  todoCarouselIndex: 0,
  widgetSizes: [
    { label: '2×2', subtitle: 'Square — Small', cols: 2, rows: 2 },
    { label: '2×3', subtitle: 'Vertical — Small', cols: 2, rows: 3 },
    { label: '3×2', subtitle: 'Horizontal — Small', cols: 3, rows: 2 },
    { label: '3×3', subtitle: 'Square — Medium', cols: 3, rows: 3 },
    { label: '4×2', subtitle: 'Horizontal — Wide', cols: 4, rows: 2 },
    { label: '3×4', subtitle: 'Vertical — Tall', cols: 3, rows: 4 },
    { label: '4×4', subtitle: 'Square — Large', cols: 4, rows: 4 },
    { label: '5×3', subtitle: 'Horizontal — Panoramic', cols: 5, rows: 3 },
  ],

  // Font size for editor title
  titleFontSize: 28,
};


/* ── Persistence ────────────────────────────────────── */
export function saveEntries() {
  localStorage.setItem('memento_entries', JSON.stringify(state.entries));
}

export function saveStoredPages() {
  localStorage.setItem('memento_stored_pages', JSON.stringify(state.storedPages));
}
