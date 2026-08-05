/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Widget Drawer & Size Carousel
   ═══════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { dom, $, $$ } from './dom.js';
import { showToast } from './utils.js';
import { enterPlacementMode } from './widgets.js';


/* ── Open / Close Drawer ─────────────────────────────── */
export function openDrawer() {
  dom.drawerOverlay.classList.remove('hidden');
  requestAnimationFrame(() => dom.drawerOverlay.classList.add('active'));

  // Activate Gallery tab by default
  $$('.drawer-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'gallery'));
  $$('.tab-content').forEach((c) => c.classList.add('hidden'));
  $('#tab-gallery').classList.remove('hidden');

  state.carouselIndex = 0;
  updateCarousel();
}

export function closeDrawer() {
  dom.drawerOverlay.classList.remove('active');
  setTimeout(() => dom.drawerOverlay.classList.add('hidden'), 450);
}


/* ── Size Carousel ───────────────────────────────────── */
export function buildSizeCarousel() {
  const viewport = dom.carouselViewport;
  viewport.innerHTML = '';

  state.widgetSizes.forEach((size) => {
    const card = document.createElement('div');
    card.className = 'size-card';

    // Build image preview with aspect ratio
    const preview = document.createElement('div');
    preview.className = 'size-preview';
    preview.style.gridTemplateColumns = `repeat(${size.cols}, 1fr)`;

    // Add placeholder image that matches the aspect ratio
    const imgContainer = document.createElement('div');
    imgContainer.className = 'size-preview-image';
    imgContainer.style.gridColumn = `1 / -1`;
    imgContainer.style.gridRow = `1 / -1`;

    const imgWidth = size.cols * 100;
    const imgHeight = size.rows * 100;
    const img = document.createElement('img');
    img.src = `https://picsum.photos/${imgWidth}/${imgHeight}?random=${size.cols}${size.rows}`;
    img.alt = `${size.label} preview`;
    img.loading = 'lazy';
    imgContainer.appendChild(img);
    preview.appendChild(imgContainer);

    card.innerHTML = `
      <div class="size-label">${size.label}</div>
      <div class="size-dims">${size.subtitle}</div>
    `;
    card.insertBefore(preview, card.firstChild.nextSibling);
    viewport.appendChild(card);
  });

  buildCarouselDots();
  updateCarousel();
}

function buildCarouselDots() {
  const dots = dom.carouselDots;
  dots.innerHTML = '';
  state.widgetSizes.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    if (i === state.carouselIndex) dot.classList.add('active');
    dot.addEventListener('click', () => {
      state.carouselIndex = i;
      updateCarousel();
    });
    dots.appendChild(dot);
  });
}

export function navigateCarousel(dir) {
  const max = state.widgetSizes.length - 1;
  state.carouselIndex = Math.max(0, Math.min(max, state.carouselIndex + dir));
  updateCarousel();
}

function updateCarousel() {
  const cards = dom.carouselViewport.querySelectorAll('.size-card');
  cards.forEach((card) => {
    card.style.transform = `translateX(-${state.carouselIndex * 100}%)`;
  });

  dom.carouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === state.carouselIndex);
  });
}


/* ── Gallery Widget Flow ─────────────────────────────── */
export function onChooseSize() {
  const size = state.widgetSizes[state.carouselIndex];
  state.placementSize = size;

  closeDrawer();

  // Trigger file picker
  setTimeout(() => {
    dom.fileInputHidden.value = '';
    dom.fileInputHidden.click();
  }, 250);
}

export function onImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const imageData = ev.target.result;

    dom.confirmImage.src = imageData;
    dom.confirmOverlay.classList.remove('hidden');
    requestAnimationFrame(() => dom.confirmOverlay.classList.add('active'));

    state.placementImage = imageData;
  };
  reader.readAsDataURL(file);
}

export function onConfirmYes() {
  dom.confirmOverlay.classList.remove('active');
  setTimeout(() => dom.confirmOverlay.classList.add('hidden'), 150);

  enterPlacementMode(state.placementSize, state.placementImage, 'gallery');
}

export function onConfirmNo() {
  dom.confirmOverlay.classList.remove('active');
  setTimeout(() => dom.confirmOverlay.classList.add('hidden'), 150);

  state.placementImage = null;
  showToast('Image import cancelled');

  setTimeout(openDrawer, 200);
}


/* ── To-Do Widget Flow ───────────────────────────────── */
export function buildTodoSizeCarousel() {
  const viewport = dom.todoCarouselViewport;
  viewport.innerHTML = '';

  state.widgetSizes.forEach((size) => {
    const card = document.createElement('div');
    card.className = 'size-card';

    const preview = document.createElement('div');
    preview.className = 'size-preview todo-size-preview';
    preview.style.gridTemplateColumns = `repeat(${size.cols}, 1fr)`;

    const placeholder = document.createElement('div');
    placeholder.className = 'size-preview-todo';
    placeholder.style.gridColumn = '1 / -1';
    placeholder.style.gridRow = '1 / -1';
    placeholder.textContent = 'To-Do';
    preview.appendChild(placeholder);

    card.innerHTML = `
      <div class="size-label">${size.label}</div>
      <div class="size-dims">${size.subtitle}</div>
    `;
    card.insertBefore(preview, card.firstChild.nextSibling);
    viewport.appendChild(card);
  });

  buildTodoCarouselDots();
  updateTodoCarousel();
}

function buildTodoCarouselDots() {
  const dots = dom.todoCarouselDots;
  dots.innerHTML = '';
  state.widgetSizes.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'carousel-dot';
    if (i === state.todoCarouselIndex) dot.classList.add('active');
    dot.addEventListener('click', () => {
      state.todoCarouselIndex = i;
      updateTodoCarousel();
    });
    dots.appendChild(dot);
  });
}

export function navigateTodoCarousel(dir) {
  const max = state.widgetSizes.length - 1;
  state.todoCarouselIndex = Math.max(0, Math.min(max, state.todoCarouselIndex + dir));
  updateTodoCarousel();
}

function updateTodoCarousel() {
  const cards = dom.todoCarouselViewport.querySelectorAll('.size-card');
  cards.forEach((card) => {
    card.style.transform = `translateX(-${state.todoCarouselIndex * 100}%)`;
  });

  dom.todoCarouselDots.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === state.todoCarouselIndex);
  });
}

export function onChooseTodoSize() {
  const size = state.widgetSizes[state.todoCarouselIndex];
  closeDrawer();
  setTimeout(() => {
    enterPlacementMode(size, null, 'todo');
  }, 250);
}
