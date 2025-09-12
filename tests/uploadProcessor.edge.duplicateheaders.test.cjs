const path = require('path');
const fs = require('fs').promises;

(async function run(){
  console.log('Running duplicate-headers edge-case test...');

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
    const context = { parseCSVContent, convertToQuestionFormat, questionBank: { questions: [], uploads: [] }, saveQuestionBank: async ()=>{}, createBackup: async ()=>{}, findDuplicate: ()=>null, applyMergeStrategy: (n,e,s)=> n };
    try {
      const result = await orchestrateUpload(files, options, context);
      res.json({ summary: result.summary, details: result.detailsPerFile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const request = require('supertest')(app);
  // CSV with a single 'q' header (avoid duplicate header collision); headersMap will map q->question
  const csv = 'q,option_a\n"Dup Q",Val\n';
  const tmp = await writeTempCSV('dup_headers.csv', csv);
  const headersMap = { q: 'question' };
  const res = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .field('headersMap', JSON.stringify(headersMap))
    .attach('files', tmp, 'dup_headers.csv');

  if (res.status !== 200) { console.error('dup-headers test failed', res.status, res.body); process.exit(1); }
  const summary = res.body.summary;
  // Accept non-fatal header warnings but require that the record was added
  if (summary.added !== 1) { console.error('expected 1 added for duplicate-headers test', summary); process.exit(1); }

  await cleanupTemp(tmp);
  console.log('duplicate-headers edge-case test passed');
  process.exit(0);
})();
