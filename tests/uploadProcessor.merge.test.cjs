const path = require('path');
const fs = require('fs').promises;

(async function run(){
  console.log('Running merge-strategy endpoint tests...');

  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { orchestrateUpload } = svc;

  const express = require('express');
  const multer = require('multer');

  const app = express();
  const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

  const { parseCSVContent, convertToQuestionFormat, writeTempCSV, cleanupTemp } = require('./_helpers.cjs');

  app.post('/api/upload-csvs', upload.array('files', 5), async (req, res) => {
    const files = req.files || [];
    const options = JSON.parse(req.body.options || '{}');
    if (req.body.headersMap) {
      try { options.headersMap = JSON.parse(req.body.headersMap); } catch (e) { /* ignore */ }
    }

    // For merge tests we'll prepare a questionBank externally; orchestrateUpload will receive context via closure below
    const questionBank = req.app.get('testQuestionBank') || { questions: [], uploads: [] };

    const context = { parseCSVContent, convertToQuestionFormat, questionBank, saveQuestionBank: async ()=>{}, createBackup: async ()=>{}, findDuplicate: (n, existing)=> existing.find(q=> (q.question||'').toLowerCase().trim()===(n.question||'').toLowerCase().trim()) ? { type: 'text', question: existing.find(q=> (q.question||'').toLowerCase().trim()===(n.question||'').toLowerCase().trim()) } : null, applyMergeStrategy: (n,e,s)=> {
      if (s==='skip') return null;
      if (s==='overwrite') return { ...e, ...n, id: e.id };
      return { ...n };
    } };

    try {
      const result = await orchestrateUpload(files, options, context);
      res.json({ uploadId: result.uploadId, summary: result.summary, detailsPerFile: result.detailsPerFile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const request = require('supertest')(app);
  // Prepare a CSV with a question that matches existing
  const csv = 'question,option_a\n"Merge Q",OrigA\n';
  const tmp = await writeTempCSV('merge_q.csv', csv);

  // Test A: skip should not change existing
  const qbA = { questions: [{ id: 10, question: 'Merge Q', option_a: 'OrigA' }], uploads: [] };
  app.set('testQuestionBank', qbA);
  const resA = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .attach('files', tmp, 'merge_q.csv');
  if (resA.status !== 200) { console.error('merge skip failed', resA.status, resA.body); process.exit(1); }
  if (resA.body.summary.skipped < 1) { console.error('expected skipped >= 1 for skip'); process.exit(1); }

  // Test B: overwrite should update existing entry
  const qbB = { questions: [{ id: 20, question: 'Merge Q', option_a: 'OrigA' }], uploads: [] };
  app.set('testQuestionBank', qbB);
  const resB = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'overwrite' }))
    .attach('files', tmp, 'merge_q.csv');
  if (resB.status !== 200) { console.error('merge overwrite failed', resB.status, resB.body); process.exit(1); }
  if (resB.body.summary.updated < 1) { console.error('expected updated >= 1 for overwrite'); process.exit(1); }

  await cleanupTemp(tmp);

  console.log('merge-strategy endpoint tests passed');
  process.exit(0);
})();
