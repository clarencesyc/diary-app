import { state, saveEntries } from './state.js';
import { renderBookSpread } from './bookEditor.js';
import { escapeHTML } from './utils.js';

export function openPageOverview() {
  const overlay = document.getElementById('page-overview-overlay');
  const spread = document.getElementById('book-spread');
  if (!overlay || !spread) return;
  
  // Animation: Open rings
  spread.classList.add('rings-open');
  
  setTimeout(() => {
    overlay.classList.remove('hidden');
    renderOverviewGrid();
  }, 400); // Wait for rings opening animation
}

export function closePageOverview() {
  const overlay = document.getElementById('page-overview-overlay');
  const spread = document.getElementById('book-spread');
  if (!overlay || !spread) return;
  
  overlay.classList.add('hidden');
  
  setTimeout(() => {
    spread.classList.remove('rings-open');
    renderBookSpread(); // re-render spread in case pages were moved/deleted
  }, 200);
}

function renderOverviewGrid() {
  const grid = document.getElementById('overview-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const pages = state.currentDiary.pages || [];
  
  pages.forEach((page, index) => {
    const el = document.createElement('div');
    el.className = 'overview-thumbnail' + (page ? '' : ' empty');
    el.draggable = !!page;
    
    if (page) {
      el.innerHTML = `
        <div style="font-size: 0.8rem; font-weight: bold; margin-bottom: 5px;">Pg ${index + 1}</div>
        <div style="font-size: 0.9rem;">${escapeHTML(page.title)}</div>
        <button class="delete-page" data-index="${index}">✕</button>
      `;
      
      // Simple Drag and Drop for reordering
      el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        el.style.opacity = '0.5';
      });
      el.addEventListener('dragend', () => {
        el.style.opacity = '1';
      });
    } else {
      el.innerHTML = `<div>Empty Page</div>`;
    }
    
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = index;
      
      if (fromIndex !== toIndex && !isNaN(fromIndex)) {
        // Swap pages
        const temp = pages[fromIndex];
        pages[fromIndex] = pages[toIndex];
        pages[toIndex] = temp;
        
        // Clean up trailing empty pages
        while(pages.length > 0 && !pages[pages.length-1]) {
          pages.pop();
        }
        
        saveEntries();
        renderOverviewGrid();
      }
    });
    
    grid.appendChild(el);
  });
  
  // Bind delete buttons
  grid.querySelectorAll('.delete-page').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (confirm("Delete this page?")) {
        const idx = parseInt(btn.dataset.index);
        pages[idx] = null; // Mark as empty
        // Clean up trailing empty pages
        while(pages.length > 0 && !pages[pages.length-1]) {
          pages.pop();
        }
        saveEntries();
        renderOverviewGrid();
      }
    };
  });
}
