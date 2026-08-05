import { state, saveEntries } from './state.js';
import { dom } from './dom.js';
import { showToast, escapeHTML } from './utils.js';
import { savePageToStorage } from './storageBox.js';
import { openDrawer } from './drawer.js';
import { updateGridDimensionsFromContainer, buildLegoGrid } from './grid.js';
import { rerenderPlacedWidgets } from './widgets.js';

export function openBookEditor(diary) {
  state.currentDiary = diary;
  state.currentSpreadIndex = 0;
  
  dom.editorPage.classList.add('active');
  dom.mainPage.classList.remove('active');
  
  renderBookSpread();
}

export function closeBookEditor() {
  state.currentDiary = null;
  dom.editorPage.classList.remove('active');
  dom.mainPage.classList.add('active');
}

export function renderBookSpread() {
  if (!state.currentDiary) return;

  const leftPageEl = document.getElementById('page-left');
  const rightPageEl = document.getElementById('page-right');
  
  const pages = state.currentDiary.pages || [];
  
  // Left page
  const leftPageIndex = state.currentSpreadIndex;
  renderPage(leftPageEl, pages[leftPageIndex], leftPageIndex);
  
  // Right page
  const rightPageIndex = state.currentSpreadIndex + 1;
  renderPage(rightPageEl, pages[rightPageIndex], rightPageIndex);

  updateNavButtons();
}

function renderPage(container, pageData, pageIndex) {
  if (!pageData) {
    // Empty State
    container.innerHTML = `
      <div class="page-empty-state">
        <button class="btn-create-new huge" data-index="${pageIndex}">+</button>
      </div>
    `;
    
    // Bind empty state buttons
    container.querySelectorAll('.btn-create-new').forEach(btn => {
      btn.onclick = () => createNewPage(pageIndex);
    });
    
  } else {
    // Active State
    container.innerHTML = `
      <div class="page-active-state" data-page-id="${pageData.id}">
        <div class="page-header">
          <input type="text" class="page-title-input" value="${escapeHTML(pageData.title)}" data-index="${pageIndex}" placeholder="Untitled Page">
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn-add-widget-header" title="Add Widget" style="font-size: 1.5rem; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--accent-1); transition: transform 0.2s;">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <button class="btn-archive" data-index="${pageIndex}" title="Send to Storage" style="font-size: 1.5rem; background: transparent; border: none; box-shadow: none;">📦</button>
          </div>
        </div>
        <div class="page-map-preview">
          <span>Map Location Area</span>
        </div>
        <div class="page-grid-container" style="flex: 1; position: relative; overflow: auto; padding: 10px;">
          <div class="page-grid lego-grid" id="grid-${pageData.id}" style="min-height: 100%;"></div>
        </div>
      </div>
    `;

    // Bind title input
    const titleInput = container.querySelector('.page-title-input');
    titleInput.addEventListener('input', (e) => {
      pageData.title = e.target.value;
      saveEntries();
    });

    // Bind add widget button
    const addWidgetBtn = container.querySelector('.btn-add-widget-header');
    if (addWidgetBtn) {
      addWidgetBtn.onclick = () => openDrawer();
    }

    // Bind archive button
    const archiveBtn = container.querySelector('.btn-archive');
    archiveBtn.onclick = () => {
      if (confirm("Send this page to Storage Box? It will be removed from this diary.")) {
        savePageToStorage(pageData);
        state.currentDiary.pages.splice(pageIndex, 1);
        saveEntries();
        renderBookSpread();
        showToast("Page sent to Storage Box");
      }
    };
    
    // Initialize Grid for this page (requires setting state for grid engine)
    // Wait for DOM paint
    requestAnimationFrame(() => {
      // Temporarily set grid container for the engine
      dom.editorWorkspace = container.querySelector('.page-grid-container');
      dom.legoGrid = container.querySelector('.page-grid');
      state.widgets = pageData.widgets || [];
      
      updateGridDimensionsFromContainer();
      buildLegoGrid();
      rerenderPlacedWidgets();
    });
  }
}

function createNewPage(index) {
  if (!state.currentDiary.pages) state.currentDiary.pages = [];
  
  // Fill any gaps if they clicked a higher index somehow
  while (state.currentDiary.pages.length <= index) {
    state.currentDiary.pages.push(null); 
  }
  
  state.currentDiary.pages[index] = {
    id: 'page-' + Date.now() + Math.random().toString(36).slice(2, 6),
    title: 'New Page',
    mapLocation: null,
    widgets: []
  };
  
  saveEntries();
  renderBookSpread();
}

function updateNavButtons() {
  const prevBtn = document.getElementById('book-prev');
  const nextBtn = document.getElementById('book-next');
  
  const pages = state.currentDiary.pages || [];
  
  prevBtn.disabled = state.currentSpreadIndex === 0;
  
  // Can only go next if the current spread is not completely empty
  const hasContentInCurrentSpread = pages[state.currentSpreadIndex] || pages[state.currentSpreadIndex + 1];
  nextBtn.disabled = !hasContentInCurrentSpread;
}

export function turnPageLeft() {
  if (state.currentSpreadIndex > 0) {
    const spread = document.getElementById('book-spread');
    if (spread) {
      spread.classList.add('turning-prev');
      setTimeout(() => {
        state.currentSpreadIndex -= 2;
        renderBookSpread();
        spread.classList.remove('turning-prev');
        spread.classList.add('turning-prev-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            spread.classList.remove('turning-prev-enter');
          });
        });
      }, 300);
    } else {
      state.currentSpreadIndex -= 2;
      renderBookSpread();
    }
  }
}

export function turnPageRight() {
  const pages = state.currentDiary.pages || [];
  const hasContent = pages[state.currentSpreadIndex] || pages[state.currentSpreadIndex + 1];
  if (hasContent) {
    const spread = document.getElementById('book-spread');
    if (spread) {
      spread.classList.add('turning-next');
      setTimeout(() => {
        state.currentSpreadIndex += 2;
        renderBookSpread();
        spread.classList.remove('turning-next');
        spread.classList.add('turning-next-enter');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            spread.classList.remove('turning-next-enter');
          });
        });
      }, 300);
    } else {
      state.currentSpreadIndex += 2;
      renderBookSpread();
    }
  }
}

export function openPageOverview() {
  if (!state.currentDiary) return;
  dom.pageOverviewOverlay.classList.remove('hidden');
  renderOverviewGrid();
}

export function closePageOverview() {
  dom.pageOverviewOverlay.classList.add('hidden');
}

function renderOverviewGrid() {
  const grid = dom.overviewGrid;
  grid.innerHTML = '';
  
  const pages = state.currentDiary.pages || [];
  
  pages.forEach((page, index) => {
    if (!page) return;
    
    const thumb = document.createElement('div');
    thumb.className = 'overview-page-thumb';
    thumb.style.cursor = 'pointer'; // Override cursor: move
    thumb.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    thumb.innerHTML = `
      <div style="position: absolute; top: 5px; right: 5px;">
        <button class="btn-delete-page" data-index="${index}" style="background:transparent; border:none; cursor:pointer; font-size:1.2rem;" title="Delete Page">🗑️</button>
      </div>
      <div style="text-align: center; width: 100%; pointer-events: none;">
        <div style="font-size: 0.8rem; margin-bottom: 10px; opacity: 0.7;">Page ${index + 1}</div>
        <div style="font-size: 1rem; word-break: break-all;">${escapeHTML(page.title || 'Untitled')}</div>
      </div>
    `;
    
    // Bind delete
    const delBtn = thumb.querySelector('.btn-delete-page');
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm('Delete this page permanently?')) {
        state.currentDiary.pages.splice(index, 1);
        saveEntries();
        renderOverviewGrid();
        
        // Adjust current spread index if needed
        if (state.currentSpreadIndex >= state.currentDiary.pages.length && state.currentSpreadIndex > 0) {
           state.currentSpreadIndex = Math.max(0, state.currentDiary.pages.length - (state.currentDiary.pages.length % 2 === 0 ? 2 : 1));
        }
        renderBookSpread();
      }
    };
    
    // Bind click to jump to page
    thumb.onclick = () => {
      // jump to the spread containing this page
      state.currentSpreadIndex = index % 2 === 0 ? index : index - 1;
      closePageOverview();
      renderBookSpread();
    };
    
    grid.appendChild(thumb);
  });
  
  // Update header with diary title
  const header = dom.pageOverviewOverlay.querySelector('.overview-header h3');
  if (header) {
    header.textContent = state.currentDiary.title + ' - Pages';
  }
}

