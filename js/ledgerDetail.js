/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Ledger Detail Page
   Full edit + filters + income/expense + monthly summary
   ═══════════════════════════════════════════════════════════ */

import { state, saveEntries } from './state.js';
import { $, $$ } from './dom.js';
import { escapeHTML, navigateTo, showToast } from './utils.js';
import {
  fetchLedgerItems,
  createLedgerItem,
  updateLedgerItem,
  deleteLedgerItem,
} from './api.js';
import {
  formatWon,
  loadCategories,
  colorFor,
  rememberCategory,
  mountCategorySelect,
  itemKind,
  summarizeItems,
  syncCategories,
} from './ledger.js';
import { rerenderPlacedWidgets } from './widgets.js';

const DETAIL_MENU_ID = 'detail';

const filters = {
  dateFrom: '',
  dateTo: '',
  categories: [],
  query: '',
  priceSort: '',
  kind: 'all',
};

const PAYMENT_METHODS = ['현금', '체크카드', '신용카드', '계좌이체'];
const RECURRENCE_OPTIONS = [
  ['week', '매주'], ['month', '매월'], ['year', '매년'],
];

let allItems = [];
let currentWidget = null;
let bound = false;
let dirty = false;
let summaryCursor = new Date(); // month shown in summary card

function diaryId() {
  return state.currentDiary?.id;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${y}. ${m}. ${d}.`;
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthBudget() {
  if (!currentWidget) return 0;
  return Number(currentWidget.monthlyBudgets?.[monthKey(summaryCursor)]) || 0;
}

function setSaveStatus(mode = 'saved') {
  const el = $('#ledger-save-status');
  if (!el) return;
  const labels = { saving: '저장 중…', saved: '✓ 저장됨', error: '저장 실패' };
  el.textContent = labels[mode] || labels.saved;
  el.className = `ledger-save-status is-${mode}`;
}

function closePopovers() {
  $$('.ledger-popover').forEach((p) => p.classList.add('hidden'));
}

function positionPopover(pop, anchor) {
  const rect = anchor.getBoundingClientRect();
  pop.classList.remove('hidden');
  const pw = pop.offsetWidth || 240;
  let left = rect.left;
  let top = rect.bottom + 8;
  if (left + pw > window.innerWidth - 12) left = window.innerWidth - pw - 12;
  if (top + pop.offsetHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - pop.offsetHeight - 8);
  }
  pop.style.left = `${Math.max(12, left)}px`;
  pop.style.top = `${top}px`;
}

function getFilteredSortedItems() {
  let list = [...allItems];

  if (filters.dateFrom) list = list.filter((i) => (i.date || '') >= filters.dateFrom);
  if (filters.dateTo) list = list.filter((i) => (i.date || '') <= filters.dateTo);
  if (filters.categories.length) {
    const set = new Set(filters.categories);
    list = list.filter((i) => set.has(i.category));
  }
  if (filters.query) {
    const q = filters.query.toLocaleLowerCase('ko');
    list = list.filter((i) =>
      [i.content, i.category, i.memo, i.paymentMethod]
        .some((v) => String(v || '').toLocaleLowerCase('ko').includes(q))
    );
  }
  if (filters.kind !== 'all') list = list.filter((i) => itemKind(i) === filters.kind);

  if (filters.priceSort) {
    list.sort((a, b) => {
      const r = (Number(a.price) || 0) - (Number(b.price) || 0);
      return filters.priceSort === 'desc' ? -r : r;
    });
  } else {
    list.sort(
      (a, b) =>
        String(b.date || '').localeCompare(String(a.date || '')) ||
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
  }

  return list;
}

function renderActiveFilterChips() {
  const el = $('#ledger-active-filters');
  if (!el) return;
  const chips = [];

  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom ? formatDisplayDate(filters.dateFrom) : '…';
    const to = filters.dateTo ? formatDisplayDate(filters.dateTo) : '…';
    chips.push(`<span class="ld-chip">기간 ${from} ~ ${to}</span>`);
  }
  if (filters.categories.length) {
    filters.categories.forEach((c) => {
      const col = colorFor(c);
      chips.push(
        `<span class="ld-chip ld-chip-cat" style="background:${col.bg};color:${col.text}">${escapeHTML(c)}</span>`
      );
    });
  }
  if (filters.query) chips.push(`<span class="ld-chip">검색 “${escapeHTML(filters.query)}”</span>`);
  if (filters.priceSort === 'asc') chips.push('<span class="ld-chip">금액 낮은순</span>');
  if (filters.priceSort === 'desc') chips.push('<span class="ld-chip">금액 높은순</span>');

  el.innerHTML = chips.length
    ? chips.join('')
    : '<span class="ld-chip-hint">헤더로 필터·정렬 · 행에서 수입/지출·항목을 편집할 수 있어요</span>';
  $('#ledger-clear-filters')?.classList.toggle('hidden', chips.length === 0);

  $$('.ledger-filter-btn').forEach((btn) => {
    const key = btn.dataset.filter;
    let on = false;
    if (key === 'date') on = !!(filters.dateFrom || filters.dateTo);
    if (key === 'category') on = filters.categories.length > 0;
    if (key === 'price') on = !!filters.priceSort;
    btn.classList.toggle('is-active', on);
  });
}

function paintTotals(list) {
  const { income, expense, balance } = summarizeItems(list);
  const expenseEl = $('#ledger-detail-expense');
  const incomeEl = $('#ledger-detail-income');
  const totalEl = $('#ledger-detail-total');
  const countEl = $('#ledger-detail-count');
  if (expenseEl) expenseEl.textContent = formatWon(expense);
  if (incomeEl) incomeEl.textContent = formatWon(income);
  if (totalEl) {
    totalEl.textContent = formatWon(balance);
    totalEl.classList.toggle('negative', balance < 0);
  }
  if (countEl) countEl.textContent = list.length ? `(${list.length}건)` : '';
}

function renderMonthSummary() {
  const title = $('#lms-title');
  const y = summaryCursor.getFullYear();
  const m = summaryCursor.getMonth() + 1;
  if (title) title.textContent = `${y}년 ${m}월 요약`;

  const key = monthKey(summaryCursor);
  const monthItems = allItems.filter((i) => (i.date || '').startsWith(key));
  const { income, expense, balance } = summarizeItems(monthItems);

  const incomeEl = $('#lms-income');
  const expenseEl = $('#lms-expense');
  const balanceEl = $('#lms-balance');
  if (incomeEl) incomeEl.textContent = formatWon(income);
  if (expenseEl) expenseEl.textContent = formatWon(expense);
  if (balanceEl) {
    balanceEl.textContent = formatWon(balance);
    balanceEl.classList.toggle('negative', balance < 0);
  }

  const budget = currentMonthBudget();
  const budgetInput = $('#lms-budget-input');
  const budgetFill = $('#lms-budget-fill');
  const budgetUsed = $('#lms-budget-used');
  const budgetRemaining = $('#lms-budget-remaining');
  if (budgetInput && document.activeElement !== budgetInput) budgetInput.value = budget || '';
  const usedPct = budget > 0 ? Math.round((expense / budget) * 100) : 0;
  if (budgetFill) {
    budgetFill.style.width = `${Math.min(100, usedPct)}%`;
    budgetFill.classList.toggle('over', usedPct > 100);
  }
  if (budgetUsed) budgetUsed.textContent = budget > 0 ? `사용률 ${usedPct}%` : '사용률 0%';
  if (budgetRemaining) {
    budgetRemaining.textContent = budget > 0
      ? (budget >= expense ? `${formatWon(budget - expense)} 남음` : `${formatWon(expense - budget)} 초과`)
      : '예산을 입력해주세요';
    budgetRemaining.classList.toggle('over', budget > 0 && expense > budget);
  }

  const catsEl = $('#lms-cats');
  if (!catsEl) return;

  const byCat = {};
  monthItems.forEach((i) => {
    if (itemKind(i) !== 'expense') return;
    const name = (i.category || '').trim() || '미분류';
    byCat[name] = (byCat[name] || 0) + (Number(i.price) || 0);
  });

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    catsEl.innerHTML = '<div class="lms-empty">이번 달 지출 내역이 없습니다</div>';
    return;
  }

  const max = entries[0][1] || 1;
  catsEl.innerHTML = entries
    .map(([name, amount]) => {
      const col = colorFor(name);
      const pct = Math.max(6, Math.round((amount / max) * 100));
      return `
        <div class="lms-cat-row">
          <div class="lms-cat-meta">
            <span class="lms-cat-name" style="background:${col.bg};color:${col.text}">${escapeHTML(name)}</span>
            <span class="lms-cat-amount">${formatWon(amount)}</span>
          </div>
          <div class="lms-bar-track">
            <div class="lms-bar-fill" style="width:${pct}%;background:${col.text}"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function destroyRowCats() {
  const rowsEl = $('#ledger-detail-rows');
  rowsEl?.querySelectorAll('.ledger-detail-row').forEach((r) => r._catApi?.destroy?.());
  document.querySelectorAll(`.cat-menu[data-ledger-widget="${DETAIL_MENU_ID}"]`).forEach((m) => m.remove());
}

async function persistRow(row, itemId) {
  if (!currentWidget) return;
  const payload = {
    date: row.querySelector('[data-field="date"]').value,
    content: row.querySelector('[data-field="content"]').value,
    category: row._catApi?.getValue() || '',
    price: Number(row.querySelector('[data-field="price"]').value) || 0,
    kind: row.dataset.kind === 'income' ? 'income' : 'expense',
    paymentMethod: row.querySelector('[data-field="paymentMethod"]')?.value || '',
    memo: row.querySelector('[data-field="memo"]')?.value || '',
    recurring: Boolean(row.querySelector('[data-field="recurring"]')?.checked),
    recurrenceFrequency: row.querySelector('[data-field="recurrenceFrequency"]')?.value || 'month',
    recurrenceEndDate: row.querySelector('[data-field="recurrenceEndDate"]')?.value || '',
  };
  if (payload.category) rememberCategory(payload.category);
  try {
    setSaveStatus('saving');
    const data = await updateLedgerItem(diaryId(), currentWidget.id, itemId, payload);
    allItems = data.items;
    dirty = true;
    paintTotals(getFilteredSortedItems());
    renderActiveFilterChips();
    renderMonthSummary();
    setSaveStatus('saved');
  } catch (err) {
    setSaveStatus('error');
    showToast(err.message || '저장 실패');
    await loadItems();
  }
}

function buildEditableRow(item) {
  const kind = itemKind(item);
  const paymentOptions = ['<option value="">결제수단</option>']
    .concat(PAYMENT_METHODS.map((name) =>
      `<option value="${name}" ${item.paymentMethod === name ? 'selected' : ''}>${name}</option>`
    ))
    .join('');
  const recurrenceOptions = RECURRENCE_OPTIONS.map(([key, label]) =>
    `<option value="${key}" ${(item.recurrenceFrequency || 'month') === key ? 'selected' : ''}>${label}</option>`
  ).join('');
  const row = document.createElement('div');
  row.className = `ledger-detail-row is-editable kind-${kind}`;
  row.dataset.itemId = item.id;
  row.dataset.kind = kind;
  row.innerHTML = `
    <button type="button" class="kind-toggle" data-field="kind" title="수입/지출 전환">${kind === 'income' ? '수입' : '지출'}</button>
    <input class="ledger-cell ledger-cell-date" type="date" data-field="date" value="${escapeHTML(item.date || '')}" />
    <input class="ledger-cell ledger-cell-content" type="text" data-field="content" placeholder="내용 입력" value="${escapeHTML(item.content || '')}" />
    <div class="ledger-cell-category" data-field="category-wrap"></div>
    <input class="ledger-cell ledger-cell-price" type="number" data-field="price" min="0" step="1" placeholder="0" value="${item.price ?? 0}" />
    <button type="button" class="ledger-row-more" aria-expanded="false">상세 ▾</button>
    <button type="button" class="ledger-row-delete" title="삭제">×</button>
    <div class="ledger-row-advanced hidden">
      <label><span>결제수단</span><select class="ledger-cell ledger-payment-select" data-field="paymentMethod">${paymentOptions}</select></label>
      <label class="ledger-memo-wrap"><span>메모</span><input class="ledger-cell ledger-cell-memo" type="text" data-field="memo" placeholder="선택 사항" value="${escapeHTML(item.memo || '')}" /></label>
      <label class="ledger-recurring-toggle" title="설정한 주기마다 이 거래를 자동으로 추가합니다">
        <input type="checkbox" data-field="recurring" aria-label="반복 거래 사용" ${item.recurring ? 'checked' : ''} />
        <span>자동 반복</span>
      </label>
      <label class="ledger-recurrence-field"><span>주기</span><select class="ledger-cell" data-field="recurrenceFrequency">${recurrenceOptions}</select></label>
      <label class="ledger-recurrence-field"><span>종료일</span><input class="ledger-cell" type="date" data-field="recurrenceEndDate" value="${escapeHTML(item.recurrenceEndDate || '')}" /></label>
    </div>
  `;

  const catWrap = row.querySelector('[data-field="category-wrap"]');
  row._catApi = mountCategorySelect(catWrap, item.category || '', () => persistRow(row, item.id), DETAIL_MENU_ID);

  row.querySelectorAll('.ledger-cell, [data-field="recurring"]').forEach((input) => {
    input.addEventListener('change', () => persistRow(row, item.id));
  });

  const advanced = row.querySelector('.ledger-row-advanced');
  const more = row.querySelector('.ledger-row-more');
  const syncRecurringFields = () => {
    const enabled = row.querySelector('[data-field="recurring"]')?.checked;
    row.querySelectorAll('.ledger-recurrence-field select, .ledger-recurrence-field input')
      .forEach((field) => { field.disabled = !enabled; });
  };
  syncRecurringFields();
  row.querySelector('[data-field="recurring"]')?.addEventListener('change', syncRecurringFields);
  more.addEventListener('click', () => {
    const opening = advanced.classList.contains('hidden');
    advanced.classList.toggle('hidden', !opening);
    more.setAttribute('aria-expanded', String(opening));
    more.textContent = opening ? '닫기 ▴' : '상세 ▾';
  });

  row.querySelector('.kind-toggle').addEventListener('click', (e) => {
    e.stopPropagation();
    const next = row.dataset.kind === 'income' ? 'expense' : 'income';
    row.dataset.kind = next;
    row.classList.toggle('kind-income', next === 'income');
    row.classList.toggle('kind-expense', next === 'expense');
    e.currentTarget.textContent = next === 'income' ? '수입' : '지출';
    persistRow(row, item.id);
  });

  row.querySelector('.ledger-row-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!currentWidget) return;
    if (!window.confirm('이 거래 항목을 삭제할까요?')) return;
    try {
      setSaveStatus('saving');
      const data = await deleteLedgerItem(diaryId(), currentWidget.id, item.id);
      allItems = data.items;
      dirty = true;
      renderDetailRows();
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      showToast(err.message || '삭제 실패');
    }
  });

  return row;
}

function renderDetailRows() {
  const rowsEl = $('#ledger-detail-rows');
  if (!rowsEl) return;

  destroyRowCats();
  const list = getFilteredSortedItems();
  paintTotals(list);
  renderActiveFilterChips();
  renderMonthSummary();
  rowsEl.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'ledger-empty-hint';
    empty.textContent = allItems.length
      ? '조건에 맞는 항목이 없습니다'
      : '아래 + 로 첫 항목을 추가하세요';
    rowsEl.appendChild(empty);
    return;
  }

  list.forEach((item) => rowsEl.appendChild(buildEditableRow(item)));
}

function syncPopoverUI() {
  const from = $('#ledger-date-from');
  const to = $('#ledger-date-to');
  if (from) from.value = filters.dateFrom || '';
  if (to) to.value = filters.dateTo || '';

  $$('[data-price-sort]').forEach((b) => {
    b.classList.toggle('selected', b.dataset.priceSort === filters.priceSort);
  });

  const catsEl = $('#ledger-pop-cats');
  if (!catsEl) return;
  allItems.forEach((i) => {
    if (i.category) rememberCategory(i.category);
  });
  const allCats = loadCategories();

  if (!allCats.length) {
    catsEl.innerHTML = '<div class="cat-empty">생성된 카테고리가 없습니다</div>';
    return;
  }

  catsEl.innerHTML = allCats
    .map((name) => {
      const col = colorFor(name);
      const checked = filters.categories.includes(name) ? 'checked' : '';
      return `
        <label class="ledger-pop-cat">
          <input type="checkbox" value="${escapeHTML(name)}" ${checked} />
          <span class="cat-option-chip" style="background:${col.bg};color:${col.text}">${escapeHTML(name)}</span>
        </label>
      `;
    })
    .join('');
}

function resetFilters() {
  resetFiltersQuiet();
  syncPopoverUI();
  renderDetailRows();
  showToast('필터가 초기화되었습니다');
}

function resetFiltersQuiet() {
  filters.dateFrom = '';
  filters.dateTo = '';
  filters.categories = [];
  filters.query = '';
  filters.priceSort = '';
  filters.kind = 'all';
  const search = $('#ledger-search');
  if (search) search.value = '';
  syncKindTabs();
}

function syncKindTabs() {
  $$('[data-kind-filter]').forEach((button) => {
    const active = button.dataset.kindFilter === filters.kind;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function nextRecurringDate(iso, frequency) {
  const [year, month, day] = String(iso).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  if (frequency === 'week') date.setUTCDate(date.getUTCDate() + 7);
  else if (frequency === 'year') {
    date.setUTCFullYear(date.getUTCFullYear() + 1);
  } else {
    const targetMonth = date.getUTCMonth() + 1;
    date.setUTCDate(1);
    date.setUTCMonth(targetMonth);
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day || 1, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

async function materializeRecurringItems(items) {
  if (!currentWidget || !diaryId()) return items;
  const today = todayISO();
  const roots = items.filter((i) => i.recurring && !i.recurringSourceId && i.date);
  let next = items;
  for (const root of roots) {
    const children = next
      .filter((i) => i.recurringSourceId === root.id)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let cursor = children.at(-1)?.date || root.date;
    const frequency = root.recurrenceFrequency || 'month';
    let due = nextRecurringDate(cursor, frequency);
    let guard = 0;
    while (due <= today && (!root.recurrenceEndDate || due <= root.recurrenceEndDate) && guard < 60) {
      const data = await createLedgerItem(diaryId(), currentWidget.id, {
        date: due,
        content: root.content,
        category: root.category,
        price: root.price,
        kind: root.kind,
        paymentMethod: root.paymentMethod || '',
        memo: root.memo || '',
        recurring: false,
        recurrenceFrequency: frequency,
        recurrenceEndDate: root.recurrenceEndDate || '',
        recurringSourceId: root.id,
      });
      next = data.items || next;
      cursor = due;
      due = nextRecurringDate(cursor, frequency);
      guard += 1;
    }
  }
  return next;
}

async function loadItems() {
  const id = diaryId();
  if (!id || !currentWidget) return;
  try {
    await syncCategories(currentWidget.id);
    const data = await fetchLedgerItems(id, currentWidget.id);
    allItems = await materializeRecurringItems(data.items || []);
    allItems.forEach((i) => {
      if (i.category) rememberCategory(i.category);
    });
  } catch (err) {
    allItems = [];
    setSaveStatus('error');
    showToast(err.message || '불러오기 실패');
  }
  syncPopoverUI();
  renderDetailRows();
}

async function addItem(kind = 'expense') {
  const id = diaryId();
  if (!id || !currentWidget) {
    showToast('다이어리를 먼저 저장해주세요');
    return;
  }
  try {
    setSaveStatus('saving');
    const data = await createLedgerItem(id, currentWidget.id, {
      date: todayISO(),
      content: '',
      category: '',
      price: 0,
      kind: kind === 'income' ? 'income' : 'expense',
      paymentMethod: '',
      memo: '',
      recurring: false,
      recurrenceFrequency: 'month',
      recurrenceEndDate: '',
    });
    allItems = data.items;
    dirty = true;
    setSaveStatus('saved');
    const newest = allItems[allItems.length - 1];
    if (newest && !getFilteredSortedItems().some((i) => i.id === newest.id)) {
      filters.dateFrom = '';
      filters.dateTo = '';
      filters.categories = [];
      filters.kind = kind === 'income' ? 'income' : 'expense';
      syncPopoverUI();
      syncKindTabs();
      showToast('새 항목이 보이도록 필터를 해제했습니다');
    }
    renderDetailRows();
    const rowsEl = $('#ledger-detail-rows');
    rowsEl
      ?.querySelector(`.ledger-detail-row[data-item-id="${newest?.id}"] [data-field="content"]`)
      ?.focus();
  } catch (err) {
    setSaveStatus('error');
    showToast(err.message || '백엔드에 연결할 수 없습니다');
  }
}

export async function openLedgerDetail(widget) {
  currentWidget = widget;
  dirty = false;
  resetFiltersQuiet();
  summaryCursor = new Date();
  const sub = $('#ledger-detail-sub');
  if (sub) sub.textContent = state.currentDiary?.title || 'Diary';
  const heading = $('.ledger-detail-heading');
  if (heading) heading.textContent = widget.budgetName || 'Budget';
  setSaveStatus('saved');
  navigateTo('ledger-page');
  await loadItems();
}

export function closeLedgerDetail() {
  closePopovers();
  destroyRowCats();
  navigateTo('editor-page');
  currentWidget = null;
  if (dirty) rerenderPlacedWidgets();
  dirty = false;
}

export function bindLedgerDetailEvents() {
  if (bound) return;
  bound = true;

  $('#ledger-detail-back')?.addEventListener('click', closeLedgerDetail);
  $('#ledger-clear-filters')?.addEventListener('click', resetFilters);
  $('#ledger-detail-add-expense')?.addEventListener('click', (e) => {
    e.stopPropagation();
    addItem('expense');
  });
  $('#ledger-detail-add-income')?.addEventListener('click', (e) => {
    e.stopPropagation();
    addItem('income');
  });
  $('#ledger-search')?.addEventListener('input', (e) => {
    filters.query = e.target.value.trim();
    renderDetailRows();
  });
  $$('[data-kind-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filters.kind = button.dataset.kindFilter || 'all';
      syncKindTabs();
      renderDetailRows();
    });
  });
  $('#lms-budget-input')?.addEventListener('change', (e) => {
    if (!currentWidget) return;
    if (!currentWidget.monthlyBudgets) currentWidget.monthlyBudgets = {};
    currentWidget.monthlyBudgets[monthKey(summaryCursor)] = Math.max(0, Number(e.target.value) || 0);
    saveEntries();
    dirty = true;
    renderMonthSummary();
    rerenderPlacedWidgets();
    setSaveStatus('saved');
  });
  $('#ledger-rename')?.addEventListener('click', () => {
    if (!currentWidget) return;
    const next = window.prompt('Budget 이름을 입력하세요', currentWidget.budgetName || 'Budget');
    if (next === null) return;
    currentWidget.budgetName = next.trim() || 'Budget';
    saveEntries();
    dirty = true;
    const heading = $('.ledger-detail-heading');
    if (heading) heading.textContent = currentWidget.budgetName;
    rerenderPlacedWidgets();
    setSaveStatus('saved');
  });
  $('#ledger-export')?.addEventListener('click', () => {
    const rows = getFilteredSortedItems();
    const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const header = ['구분', '날짜', '내용', '카테고리', '금액', '결제수단', '메모', '반복'];
    const body = rows.map((i) => [
      itemKind(i) === 'income' ? '수입' : '지출',
      i.date, i.content, i.category, i.price, i.paymentMethod, i.memo,
      i.recurring
        ? ({ week: '매주', month: '매월', year: '매년' }[i.recurrenceFrequency || 'month'])
        : '',
    ].map(csvCell).join(','));
    const blob = new Blob(['\uFEFF' + [header.map(csvCell).join(','), ...body].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWidget?.budgetName || 'budget'}-${monthKey(summaryCursor)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('#lms-prev')?.addEventListener('click', () => {
    summaryCursor = new Date(summaryCursor.getFullYear(), summaryCursor.getMonth() - 1, 1);
    renderMonthSummary();
  });
  $('#lms-next')?.addEventListener('click', () => {
    summaryCursor = new Date(summaryCursor.getFullYear(), summaryCursor.getMonth() + 1, 1);
    renderMonthSummary();
  });

  $$('.ledger-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.dataset.filter;
      const pop = $(`#ledger-pop-${key}`);
      if (!pop) return;
      const wasOpen = !pop.classList.contains('hidden');
      closePopovers();
      if (wasOpen) return;
      syncPopoverUI();
      positionPopover(pop, btn);
    });
  });

  $('[data-pop-apply="date"]')?.addEventListener('click', () => {
    filters.dateFrom = $('#ledger-date-from')?.value || '';
    filters.dateTo = $('#ledger-date-to')?.value || '';
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      const t = filters.dateFrom;
      filters.dateFrom = filters.dateTo;
      filters.dateTo = t;
    }
    closePopovers();
    renderDetailRows();
  });
  $('[data-pop-clear="date"]')?.addEventListener('click', () => {
    filters.dateFrom = '';
    filters.dateTo = '';
    syncPopoverUI();
    closePopovers();
    renderDetailRows();
  });

  $$('[data-price-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filters.priceSort = btn.dataset.priceSort || '';
      closePopovers();
      renderDetailRows();
    });
  });

  $('[data-pop-apply="category"]')?.addEventListener('click', () => {
    filters.categories = [...($$('#ledger-pop-cats input[type="checkbox"]:checked') || [])].map((i) => i.value);
    closePopovers();
    renderDetailRows();
  });
  $('[data-pop-clear="category"]')?.addEventListener('click', () => {
    filters.categories = [];
    syncPopoverUI();
    closePopovers();
    renderDetailRows();
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('.ledger-popover') || e.target.closest('.ledger-filter-btn')) return;
    closePopovers();
  });
}
