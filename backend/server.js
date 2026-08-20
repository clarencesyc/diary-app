/* ═══════════════════════════════════════════════════════════
   Memento Diary — Backend API
   Serves ledger REST API + static frontend (optional)
   ═══════════════════════════════════════════════════════════ */

const path = require('path');
const express = require('express');
const cors = require('cors');
const ledgerRoutes = require('./routes/ledger');

const app = express();
const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'memento-ledger' });
});

app.use('/api/diaries/:diaryId/ledgers/:widgetId', ledgerRoutes);

// Serve the frontend from project root so one process runs the whole app
app.use(express.static(ROOT));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Memento backend running at http://localhost:${PORT}`);
});
