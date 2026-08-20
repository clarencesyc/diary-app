/* ═══════════════════════════════════════════════════════════
   JSON file persistence for ledger items
   ═══════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ledgers.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }, null, 2));
  }
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
