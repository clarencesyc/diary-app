import { state, saveEntries } from './state.js';
import { dom } from './dom.js';
import { renderEntries } from './entries.js';

export function getParentFolder(folderId) {
  return state.entries.find(e => e.id === folderId && e.type === 'file');
}

export function buildBreadcrumbs() {
  const breadcrumbs = [];
  let currentId = state.currentFolderId;
  
  while (currentId) {
    const folder = getParentFolder(currentId);
    if (folder) {
      breadcrumbs.unshift(folder);
      currentId = folder.parentId;
    } else {
      break;
    }
  }
  return breadcrumbs;
}

export function navigateToFolder(folderId) {
  state.currentFolderId = folderId;
  renderEntries();
  renderBreadcrumbs();
}

export function renderBreadcrumbs() {
  // We'll update the DOM in index.html and main-mid nav.
  const container = document.getElementById('folder-breadcrumbs');
  if (!container) return;
  
  container.innerHTML = '';
  
  const rootBtn = document.createElement('button');
  rootBtn.className = 'breadcrumb-btn';
  rootBtn.textContent = '🏠 Home';
  rootBtn.onclick = () => navigateToFolder(null);
  container.appendChild(rootBtn);
  
  const path = buildBreadcrumbs();
  path.forEach((folder, index) => {
    const separator = document.createElement('span');
    separator.className = 'breadcrumb-separator';
    separator.textContent = '/';
    container.appendChild(separator);
    
    const btn = document.createElement('button');
    btn.className = 'breadcrumb-btn';
    btn.textContent = folder.title;
    btn.onclick = () => navigateToFolder(folder.id);
    container.appendChild(btn);
  });
}
