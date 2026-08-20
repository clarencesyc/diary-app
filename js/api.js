/* ═══════════════════════════════════════════════════════════
   MEMENTO DIARY — Ledger API Client (Backend 통신)
   ═══════════════════════════════════════════════════════════ */

const API_BASE =
  window.MEMENTO_API_BASE !== undefined
    ? window.MEMENTO_API_BASE
    : location.port === '3001'
      ? ''
      : 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg = (body && body.error) || `API error ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

const OFFLINE_QUEUE_KEY = 'memento_ledger_offline_queue';
const ledgerCacheKey = (diaryId, widgetId) => `memento_ledger_cache_${diaryId}_${widgetId}`;
const readCache = (diaryId, widgetId) => JSON.parse(localStorage.getItem(ledgerCacheKey(diaryId, widgetId)) || '[]');
const writeCache = (diaryId, widgetId, items) => localStorage.setItem(ledgerCacheKey(diaryId, widgetId), JSON.stringify(items || []));
const offlinePack = (items) => ({ items, offline: true });
function enqueue(entry) {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  queue.push(entry);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export async function flushLedgerOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  if (!queue.length) return;
  const remaining = [];
  const idMap = {};
  for (const entry of queue) {
    try {
      let path = entry.path;
      Object.entries(idMap).forEach(([temp, real]) => { path = path.replace(encodeURIComponent(temp), encodeURIComponent(real)); });
      const data = await request(path, { method: entry.method, body: entry.payload ? JSON.stringify(entry.payload) : undefined });
      if (entry.tempId && data?.item?.id) idMap[entry.tempId] = data.item.id;
    } catch { remaining.push(entry); }
  }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
}

window.addEventListener('online', () => flushLedgerOfflineQueue().catch(() => {}));

export async function fetchLedgerItems(diaryId, widgetId) {
  try {
    await flushLedgerOfflineQueue();
    const data = await request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`);
    writeCache(diaryId, widgetId, data.items);
    return data;
  } catch { return offlinePack(readCache(diaryId, widgetId)); }
}

export function fetchLedgerCategories(diaryId, widgetId) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/categories`);
}

export function saveLedgerCategories(diaryId, widgetId, categories) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/categories`, {
    method: 'PUT',
    body: JSON.stringify({ categories }),
  });
}

export function fetchLedgerSettings(diaryId, widgetId) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/settings`);
}

export function saveLedgerSettings(diaryId, widgetId, settings) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/settings`, {
    method: 'PUT', body: JSON.stringify(settings),
  });
}

export async function createLedgerItem(diaryId, widgetId, payload) {
  const path = `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`;
  try {
    const data = await request(path, { method: 'POST', body: JSON.stringify(payload) });
    writeCache(diaryId, widgetId, data.items); return data;
  } catch {
    const tempId = `offline_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const item = { ...payload, id: tempId, diaryId, widgetId, createdAt: new Date().toISOString() };
    const items = [...readCache(diaryId, widgetId), item]; writeCache(diaryId, widgetId, items);
    enqueue({ method: 'POST', path, payload, tempId }); return { item, ...offlinePack(items) };
  }
}

export async function updateLedgerItem(diaryId, widgetId, itemId, payload) {
  const path = `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/${encodeURIComponent(itemId)}`;
  try { const data = await request(path, { method: 'PUT', body: JSON.stringify(payload) }); writeCache(diaryId, widgetId, data.items); return data; }
  catch {
    const items = readCache(diaryId, widgetId).map((item) => item.id === itemId ? { ...item, ...payload } : item);
    writeCache(diaryId, widgetId, items); enqueue({ method: 'PUT', path, payload }); return offlinePack(items);
  }
}

export async function deleteLedgerItem(diaryId, widgetId, itemId) {
  const path = `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/${encodeURIComponent(itemId)}`;
  try { const data = await request(path, { method: 'DELETE' }); writeCache(diaryId, widgetId, data.items); return data; }
  catch {
    const items = readCache(diaryId, widgetId).filter((item) => item.id !== itemId);
    writeCache(diaryId, widgetId, items); enqueue({ method: 'DELETE', path }); return offlinePack(items);
  }
}

export function deleteLedgerWidget(diaryId, widgetId) {
  return request(
    `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`,
    { method: 'DELETE' }
  );
}
