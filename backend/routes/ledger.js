/* ═══════════════════════════════════════════════════════════
   Ledger REST routes
   ═══════════════════════════════════════════════════════════ */

const express = require('express');
const store = require('../store');

const router = express.Router({ mergeParams: true });

function pack(items) {
  const summary = store.summarize(items);
  return { items, total: summary.balance, summary };
}

router.get('/', (req, res) => {
  const { diaryId, widgetId } = req.params;
  res.json(pack(store.listByWidget(diaryId, widgetId)));
});

router.get('/categories', (req, res) => {
  res.json({ categories: store.listCategories(req.params.diaryId) });
});

router.put('/categories', (req, res) => {
  const categories = store.saveCategories(req.params.diaryId, req.body?.categories);
  res.json({ categories });
});

router.get('/settings', (req, res) => {
  res.json({ settings: store.getSettings(req.params.diaryId, req.params.widgetId) });
});

router.put('/settings', (req, res) => {
  const settings = store.saveSettings(req.params.diaryId, req.params.widgetId, req.body || {});
  res.json({ settings });
});

router.post('/', (req, res) => {
  const { diaryId, widgetId } = req.params;
  const item = store.create(diaryId, widgetId, req.body || {});
  res.status(201).json({ item, ...pack(store.listByWidget(diaryId, widgetId)) });
});

router.put('/:itemId', (req, res) => {
  const { diaryId, widgetId, itemId } = req.params;
  const item = store.update(diaryId, widgetId, itemId, req.body || {});
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item, ...pack(store.listByWidget(diaryId, widgetId)) });
});

router.delete('/:itemId', (req, res) => {
  const { diaryId, widgetId, itemId } = req.params;
  const ok = store.remove(diaryId, widgetId, itemId);
  if (!ok) return res.status(404).json({ error: 'Item not found' });
  res.json({ ok: true, ...pack(store.listByWidget(diaryId, widgetId)) });
});

router.delete('/', (req, res) => {
  const { diaryId, widgetId } = req.params;
  store.removeByWidget(diaryId, widgetId);
  res.json({ ok: true, items: [], total: 0, summary: { income: 0, expense: 0, balance: 0 } });
});

module.exports = router;
