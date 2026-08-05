import { state, saveStoredPages } from './state.js';
import { dom } from './dom.js';

export function renderStorageBox() {
  const container = document.getElementById('storage-box-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (state.storedPages.length === 0) {
    container.innerHTML = '<div class="empty-storage">Box is empty</div>';
    return;
  }
  
  state.storedPages.forEach(page => {
    const el = document.createElement('div');
    el.className = 'stored-page-item';
    el.innerHTML = `
      <div class="stored-page-title">${page.title || 'Untitled Page'}</div>
      <button class="btn-import-page" data-id="${page.id}">Import</button>
    `;
    container.appendChild(el);
  });
}

export function savePageToStorage(page) {
  state.storedPages.push(JSON.parse(JSON.stringify(page)));
  saveStoredPages();
  renderStorageBox();
}

export function removePageFromStorage(pageId) {
  state.storedPages = state.storedPages.filter(p => p.id !== pageId);
  saveStoredPages();
  renderStorageBox();
}
