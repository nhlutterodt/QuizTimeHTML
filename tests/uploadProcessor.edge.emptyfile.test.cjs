const path = require('path');
const fs = require('fs').promises;

(async function run(){
  console.log('Running empty-file edge-case test...');

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
      res.json({ summary: result.summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const request = require('supertest')(app);
  // Create an empty file
  const tmp = await writeTempCSV('empty.csv', '');

  const res = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .attach('files', tmp, 'empty.csv');

  if (res.status !== 200) { console.error('empty-file test failed', res.status, res.body); process.exit(1); }
  const summary = res.body.summary;
  if (!Array.isArray(summary.errors) || summary.errors.length < 1) { console.error('expected errors array with at least one entry for empty file', summary); process.exit(1); }

  await cleanupTemp(tmp);
  console.log('empty-file edge-case test passed');
  process.exit(0);
})();
