/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Ledger Widget (가계부)
   Glass UI + Notion-style categories
   ═══════════════════════════════════════════════════════════ */

import { state } from './state.js';
import { escapeHTML, showToast } from './utils.js';
import {
  fetchLedgerItems,
  createLedgerItem,
  updateLedgerItem,
  deleteLedgerItem,
} from './api.js';

const CAT_COLORS = [
  { bg: 'rgba(139, 92, 246, 0.18)', text: '#6d28d9' },
  { bg: 'rgba(236, 72, 153, 0.18)', text: '#be185d' },
  { bg: 'rgba(14, 165, 233, 0.18)', text: '#0369a1' },
  { bg: 'rgba(16, 185, 129, 0.18)', text: '#047857' },
  { bg: 'rgba(245, 158, 11, 0.22)', text: '#b45309' },
  { bg: 'rgba(244, 63, 94, 0.16)', text: '#be123c' },
];

export function formatWon(n) {
  const num = Number(n) || 0;
  const abs = Math.abs(num).toLocaleString('ko-KR');
  if (num < 0) return `-${abs}원`;
  return `${abs}원`;
}

export function itemKind(item) {
  return item?.kind === 'income' ? 'income' : 'expense';
}

export function summarizeItems(items) {
  let income = 0;
  let expense = 0;
  (items || []).forEach((i) => {
    const p = Number(i.price) || 0;
    if (itemKind(i) === 'income') income += p;
    else expense += p;
  });
  return { income, expense, balance: income - expense };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function diaryId() {
  return state.currentDiary?.id;
}

function catStorageKey() {
  return `memento_categories_${diaryId() || 'global'}`;
}

export function loadCategories() {
  try {
    return JSON.parse(localStorage.getItem(catStorageKey()) || '[]');
  } catch {
    return [];
  }
}

function saveCategories(list) {
  const unique = [...new Set(list.map((c) => c.trim()).filter(Boolean))];
  localStorage.setItem(catStorageKey(), JSON.stringify(unique));
  return unique;
}

export function rememberCategory(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return loadCategories();
  const list = loadCategories();
  if (!list.includes(trimmed)) list.push(trimmed);
  return saveCategories(list);
}

export function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length];
}

function closeAllCategoryMenus(except) {
  document.querySelectorAll('.cat-menu.open').forEach((m) => {
    if (m !== except) m.classList.remove('open');
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.cat-select') && !e.target.closest('.cat-menu')) {
    closeAllCategoryMenus();
  }
});

/* ── Notion-like category select ─────────────────────── */
export function mountCategorySelect(wrap, initialValue, onCommit, widgetId) {
  wrap.className = 'cat-select';
  let value = (initialValue || '').trim();

  wrap.innerHTML = `
    <button type="button" class="cat-trigger" title="카테고리">
      <span class="cat-chip-label"></span>
      <span class="cat-chevron">▾</span>
    </button>
  `;

  const trigger = wrap.querySelector('.cat-trigger');
  const labelEl = wrap.querySelector('.cat-chip-label');

  const menu = document.createElement('div');
  menu.className = 'cat-menu';
  menu.dataset.ledgerWidget = widgetId || '';
  menu.innerHTML = `
    <input class="cat-search" type="text" placeholder="카테고리 검색 또는 생성…" />
    <div class="cat-options"></div>
    <div class="cat-hint">Enter로 새 카테고리 생성</div>
  `;
  document.body.appendChild(menu);

  const search = menu.querySelector('.cat-search');
  const options = menu.querySelector('.cat-options');

  function paintChip() {
    if (value) {
      const c = colorFor(value);
      labelEl.textContent = value;
      labelEl.className = 'cat-chip-label filled';
      labelEl.style.background = c.bg;
      labelEl.style.color = c.text;
      trigger.classList.add('has-value');
    } else {
      labelEl.textContent = '선택';
      labelEl.className = 'cat-chip-label placeholder';
      labelEl.style.background = '';
      labelEl.style.color = '';
      trigger.classList.remove('has-value');
    }
  }

  function renderOptions(filter = '') {
    const q = filter.trim().toLowerCase();
    const cats = loadCategories().filter((c) => !q || c.toLowerCase().includes(q));
    options.innerHTML = '';

    if (!cats.length && !q) {
      options.innerHTML = `<div class="cat-empty">아직 카테고리가 없어요</div>`;
    }

    cats.forEach((name) => {
      const c = colorFor(name);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-option' + (name === value ? ' selected' : '');
      btn.innerHTML = `<span class="cat-option-chip" style="background:${c.bg};color:${c.text}">${escapeHTML(name)}</span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        commit(name);
      });
      options.appendChild(btn);
    });

    if (q && !loadCategories().some((c) => c.toLowerCase() === q)) {
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'cat-option cat-create';
      create.innerHTML = `<strong>${escapeHTML(filter.trim())}</strong> 생성`;
      create.addEventListener('click', (e) => {
        e.stopPropagation();
        commit(filter.trim());
      });
      options.appendChild(create);
    }
  }

  function commit(name) {
    value = String(name || '').trim();
    if (value) rememberCategory(value);
    paintChip();
    menu.classList.remove('open');
    search.value = '';
    onCommit(value);
  }

  function positionMenu() {
    const rect = trigger.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, 168);
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    if (top + 200 > window.innerHeight) top = Math.max(8, rect.top - 4 - Math.min(200, menu.scrollHeight || 160));
    menu.style.position = 'fixed';
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${top}px`;
    menu.style.width = `${menuWidth}px`;
    menu.style.right = 'auto';
  }

  function openMenu() {
    closeAllCategoryMenus(menu);
    menu.classList.add('open');
    search.value = '';
    renderOptions();
    positionMenu();
    requestAnimationFrame(() => {
      positionMenu();
      search.focus();
    });
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    if (menu.classList.contains('open')) menu.classList.remove('open');
    else openMenu();
  });

  search.addEventListener('input', () => renderOptions(search.value));
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      const typed = search.value.trim();
      if (!typed) return;
      const match = loadCategories().find((c) => c.toLowerCase() === typed.toLowerCase());
      commit(match || typed);
    } else if (e.key === 'Escape') {
      menu.classList.remove('open');
    }
  });

  paintChip();

  return {
    getValue: () => value,
    setValue: (v) => {
      value = (v || '').trim();
      paintChip();
    },
    destroy: () => menu.remove(),
  };
}

/* ── Build ledger DOM inside a placed widget ─────────── */
export function mountLedgerWidget(container, widget) {
  container.classList.add('ledger-widget');
  container.innerHTML = `
    <button class="widget-delete" title="Remove widget">✕</button>
    <div class="ledger-sheet">
      <div class="ledger-title-row">
        <button type="button" class="ledger-title" data-open-ledger-detail title="상세 가계부 보기">가계부</button>
      </div>
      <div class="ledger-headers">
        <div class="ledger-h ledger-h-date">날짜</div>
        <div class="ledger-h ledger-h-content">내용</div>
        <div class="ledger-h ledger-h-category">카테고리</div>
        <div class="ledger-h ledger-h-price">가격</div>
        <div class="ledger-h-spacer"></div>
      </div>
      <div class="ledger-body">
        <div class="ledger-rows" data-ledger-rows></div>
        <button type="button" class="ledger-add-row" title="항목 추가">
          <span>+</span> 항목 추가
        </button>
      </div>
      <div class="ledger-footer">
        <span class="ledger-total-label">합계</span>
        <span class="ledger-total-value" data-ledger-total>0원</span>
      </div>
    </div>
  `;

  const rowsEl = container.querySelector('[data-ledger-rows]');
  const totalEl = container.querySelector('[data-ledger-total]');
  const addBtn = container.querySelector('.ledger-add-row');

  let items = [];

  function setTotalFromItems(list) {
    const { balance } = summarizeItems(list);
    totalEl.textContent = formatWon(balance);
  }

  function harvestCategoriesFromItems() {
    const fromItems = items.map((i) => i.category).filter(Boolean);
    if (fromItems.length) saveCategories([...loadCategories(), ...fromItems]);
  }

  async function persistRow(row, itemId) {
    const existing = items.find((i) => i.id === itemId);
    const payload = {
      date: row.querySelector('[data-field="date"]').value,
      content: row.querySelector('[data-field="content"]').value,
      category: row._catApi?.getValue() || '',
      price: Number(row.querySelector('[data-field="price"]').value) || 0,
      kind: itemKind(existing),
    };
    if (payload.category) rememberCategory(payload.category);
    try {
      const data = await updateLedgerItem(diaryId(), widget.id, itemId, payload);
      items = data.items;
      setTotalFromItems(items);
    } catch (err) {
      showToast(err.message || '저장 실패');
      await reload();
    }
  }

  function renderRows() {
    rowsEl.querySelectorAll('.ledger-row').forEach((r) => r._catApi?.destroy?.());
    document.querySelectorAll(`.cat-menu[data-ledger-widget="${widget.id}"]`).forEach((m) => m.remove());
    rowsEl.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ledger-empty-hint';
      empty.textContent = '아래 + 로 첫 항목을 추가하세요';
      rowsEl.appendChild(empty);
      return;
    }
    items.forEach((item) => rowsEl.appendChild(buildRow(item)));
  }

  function buildRow(item) {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.dataset.itemId = item.id;
    row.innerHTML = `
      <input class="ledger-cell ledger-cell-date" type="date" data-field="date" value="${escapeHTML(item.date || '')}" />
      <input class="ledger-cell ledger-cell-content" type="text" data-field="content" placeholder="내용 입력" value="${escapeHTML(item.content || '')}" />
      <div class="ledger-cell-category" data-field="category-wrap"></div>
      <input class="ledger-cell ledger-cell-price" type="number" data-field="price" min="0" step="1" placeholder="0" value="${item.price ?? 0}" />
      <button type="button" class="ledger-row-delete" title="삭제">×</button>
    `;

    const catWrap = row.querySelector('[data-field="category-wrap"]');
    row._catApi = mountCategorySelect(catWrap, item.category || '', () => {
      persistRow(row, item.id);
    }, widget.id);

    row.querySelectorAll('.ledger-cell').forEach((input) => {
      input.addEventListener('change', () => persistRow(row, item.id));
    });

    row.querySelector('.ledger-row-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const data = await deleteLedgerItem(diaryId(), widget.id, item.id);
        items = data.items;
        setTotalFromItems(items);
        renderRows();
      } catch (err) {
        showToast(err.message || '삭제 실패');
      }
    });

    return row;
  }

  async function reload() {
    const id = diaryId();
    if (!id) return;
    try {
      const data = await fetchLedgerItems(id, widget.id);
      items = data.items || [];
      harvestCategoriesFromItems();
      setTotalFromItems(items);
      renderRows();
    } catch (err) {
      items = [];
      setTotalFromItems([]);
      renderRows();
      console.warn('[ledger]', err.message);
    }
  }

  addBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const id = diaryId();
    if (!id) {
      showToast('다이어리를 먼저 저장해주세요');
      return;
    }
    try {
      const data = await createLedgerItem(id, widget.id, {
        date: todayISO(),
        content: '',
        category: '',
        price: 0,
        kind: 'expense',
      });
      items = data.items;
      setTotalFromItems(items);
      renderRows();
      const last = rowsEl.querySelector('.ledger-row:last-child [data-field="content"]');
      if (last) last.focus();
    } catch (err) {
      showToast(err.message || '백엔드에 연결할 수 없습니다. npm start 후 다시 시도하세요.');
    }
  });

  container.addEventListener('mousedown', (e) => {
    if (e.target.closest('input, button, .cat-select')) e.stopPropagation();
  });
  container.addEventListener('touchstart', (e) => {
    if (e.target.closest('input, button, .cat-select')) e.stopPropagation();
  }, { passive: true });

  container.querySelector('[data-open-ledger-detail]')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const { openLedgerDetail } = await import('./ledgerDetail.js');
    openLedgerDetail(widget);
  });

  reload();
}
