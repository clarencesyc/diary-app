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

export function fetchLedgerItems(diaryId, widgetId) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`);
}

export function createLedgerItem(diaryId, widgetId, payload) {
  return request(`/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateLedgerItem(diaryId, widgetId, itemId, payload) {
  return request(
    `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/${encodeURIComponent(itemId)}`,
    { method: 'PUT', body: JSON.stringify(payload) }
  );
}

export function deleteLedgerItem(diaryId, widgetId, itemId) {
  return request(
    `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' }
  );
}

export function deleteLedgerWidget(diaryId, widgetId) {
  return request(
    `/api/diaries/${encodeURIComponent(diaryId)}/ledgers/${encodeURIComponent(widgetId)}`,
    { method: 'DELETE' }
  );
}
