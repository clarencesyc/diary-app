/* ═══════════════════════════════════════════════════════════
   JSON file persistence for ledger items
   ═══════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ledgers.json');
const CATEGORY_FILE = path.join(DATA_DIR, 'ledger-categories.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'ledger-settings.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }, null, 2));
  }
}

function readCategories() {
  ensureStore();
  if (!fs.existsSync(CATEGORY_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(CATEGORY_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeCategories(data) {
  ensureStore();
  fs.writeFileSync(CATEGORY_FILE, JSON.stringify(data, null, 2));
}

function readSettings() {
  ensureStore();
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function writeSettings(data) {
  ensureStore();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ items }, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeKind(kind) {
  return kind === 'income' ? 'income' : 'expense';
}

function summarize(items) {
  let income = 0;
  let expense = 0;
  items.forEach((i) => {
    const p = Number(i.price) || 0;
    if (normalizeKind(i.kind) === 'income') income += p;
    else expense += p;
  });
  return { income, expense, balance: income - expense };
}

module.exports = {
  listCategories(diaryId) {
    const data = readCategories();
    return Array.isArray(data[diaryId]) ? data[diaryId] : [];
  },

  saveCategories(diaryId, categories) {
    const data = readCategories();
    data[diaryId] = [...new Set((Array.isArray(categories) ? categories : [])
      .map((name) => String(name).trim()).filter(Boolean))];
    writeCategories(data);
    return data[diaryId];
  },

  getSettings(diaryId, widgetId) {
    return readSettings()[`${diaryId}:${widgetId}`] || {};
  },

  saveSettings(diaryId, widgetId, settings) {
    const data = readSettings();
    const cleanTravelers = [...new Set((Array.isArray(settings.travelers) ? settings.travelers : [])
      .map((name) => String(name).trim()).filter(Boolean))];
    data[`${diaryId}:${widgetId}`] = {
      tripStart: String(settings.tripStart || ''),
      tripEnd: String(settings.tripEnd || ''),
      tripBudget: Math.max(0, Number(settings.tripBudget) || 0),
      baseCurrency: String(settings.baseCurrency || 'KRW'),
      localCurrency: String(settings.localCurrency || 'KRW'),
      exchangeRate: Math.max(0, Number(settings.exchangeRate) || 1),
      travelers: cleanTravelers,
    };
    writeSettings(data);
    return data[`${diaryId}:${widgetId}`];
  },

  listByWidget(diaryId, widgetId) {
    return readAll()
      .filter((i) => i.diaryId === diaryId && i.widgetId === widgetId)
      .map((i) => ({ ...i, kind: normalizeKind(i.kind) }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt.localeCompare(b.createdAt));
  },

  create(diaryId, widgetId, payload) {
    const items = readAll();
    const item = {
      id: uid(),
      diaryId,
      widgetId,
      date: payload.date || new Date().toISOString().slice(0, 10),
      content: String(payload.content || '').trim(),
      category: String(payload.category || '').trim(),
      price: Number(payload.price) || 0,
      kind: normalizeKind(payload.kind),
      paymentMethod: String(payload.paymentMethod || '').trim(),
      memo: String(payload.memo || '').trim(),
      recurring: Boolean(payload.recurring),
      recurrenceFrequency: ['week', 'month', 'year'].includes(payload.recurrenceFrequency)
        ? payload.recurrenceFrequency : 'month',
      recurrenceEndDate: payload.recurrenceEndDate ? String(payload.recurrenceEndDate) : '',
      originalAmount: Number(payload.originalAmount) || Number(payload.price) || 0,
      currency: String(payload.currency || 'KRW'),
      exchangeRate: Math.max(0, Number(payload.exchangeRate) || 1),
      payer: String(payload.payer || '').trim(),
      participants: Array.isArray(payload.participants) ? payload.participants.map(String) : [],
      locationName: String(payload.locationName || '').trim(),
      receiptData: String(payload.receiptData || ''),
      recurringSourceId: payload.recurringSourceId ? String(payload.recurringSourceId) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    items.push(item);
    writeAll(items);
    return item;
  },

  update(diaryId, widgetId, itemId, payload) {
    const items = readAll();
    const idx = items.findIndex(
      (i) => i.id === itemId && i.diaryId === diaryId && i.widgetId === widgetId
    );
    if (idx === -1) return null;

    const prev = items[idx];
    items[idx] = {
      ...prev,
      date: payload.date !== undefined ? payload.date : prev.date,
      content: payload.content !== undefined ? String(payload.content).trim() : prev.content,
      category: payload.category !== undefined ? String(payload.category).trim() : prev.category,
      price: payload.price !== undefined ? Number(payload.price) || 0 : prev.price,
      kind: payload.kind !== undefined ? normalizeKind(payload.kind) : normalizeKind(prev.kind),
      paymentMethod:
        payload.paymentMethod !== undefined ? String(payload.paymentMethod).trim() : (prev.paymentMethod || ''),
      memo: payload.memo !== undefined ? String(payload.memo).trim() : (prev.memo || ''),
      recurring: payload.recurring !== undefined ? Boolean(payload.recurring) : Boolean(prev.recurring),
      recurrenceFrequency:
        payload.recurrenceFrequency !== undefined && ['week', 'month', 'year'].includes(payload.recurrenceFrequency)
          ? payload.recurrenceFrequency : (prev.recurrenceFrequency || 'month'),
      recurrenceEndDate:
        payload.recurrenceEndDate !== undefined
          ? (payload.recurrenceEndDate ? String(payload.recurrenceEndDate) : '')
          : (prev.recurrenceEndDate || ''),
      originalAmount: payload.originalAmount !== undefined ? Number(payload.originalAmount) || 0 : (prev.originalAmount ?? prev.price),
      currency: payload.currency !== undefined ? String(payload.currency || 'KRW') : (prev.currency || 'KRW'),
      exchangeRate: payload.exchangeRate !== undefined ? Math.max(0, Number(payload.exchangeRate) || 1) : (prev.exchangeRate || 1),
      payer: payload.payer !== undefined ? String(payload.payer).trim() : (prev.payer || ''),
      participants: payload.participants !== undefined
        ? (Array.isArray(payload.participants) ? payload.participants.map(String) : [])
        : (prev.participants || []),
      locationName: payload.locationName !== undefined ? String(payload.locationName).trim() : (prev.locationName || ''),
      receiptData: payload.receiptData !== undefined ? String(payload.receiptData || '') : (prev.receiptData || ''),
      recurringSourceId:
        payload.recurringSourceId !== undefined
          ? (payload.recurringSourceId ? String(payload.recurringSourceId) : null)
          : (prev.recurringSourceId || null),
      updatedAt: new Date().toISOString(),
    };
    writeAll(items);
    return { ...items[idx], kind: normalizeKind(items[idx].kind) };
  },

  remove(diaryId, widgetId, itemId) {
    const items = readAll();
    const next = items.filter(
      (i) => !(i.id === itemId && i.diaryId === diaryId && i.widgetId === widgetId)
    );
    if (next.length === items.length) return false;
    writeAll(next);
    return true;
  },

  removeByWidget(diaryId, widgetId) {
    const items = readAll();
    const next = items.filter((i) => !(i.diaryId === diaryId && i.widgetId === widgetId));
    writeAll(next);
  },

  summarize,
};
