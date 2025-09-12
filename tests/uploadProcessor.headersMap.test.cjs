const path = require('path');
const fs = require('fs').promises;

(async function run(){
  console.log('Running headersMap mapping endpoint test...');

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
      try { options.headersMap = JSON.parse(req.body.headersMap); } catch (e) { console.warn('headersMap test: malformed headersMap', e?.message ?? e); }
    }

    const context = { parseCSVContent, convertToQuestionFormat, questionBank: { questions: [], uploads: [] }, saveQuestionBank: async ()=>{}, createBackup: async ()=>{}, findDuplicate: ()=>null, applyMergeStrategy: (n,e,s)=> n };

    try {
      const result = await orchestrateUpload(files, options, context);
      res.json({ uploadId: result.uploadId, summary: result.summary, detailsPerFile: result.detailsPerFile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const request = require('supertest')(app);

  // CSV uses header 'Q' which should be mapped to 'question' via headersMap (case-insensitive)
  const csv = 'Q,option_a\n"Mapped Q",Z\n';
  const tmp = await writeTempCSV('headers_map.csv', csv);

  // headersMap intentionally uses different case
  const headersMap = { 'q': 'question' };

  const res = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .field('headersMap', JSON.stringify(headersMap))
    .attach('files', tmp, 'headers_map.csv');

  if (res.status !== 200) { console.error('headersMap test failed', res.status, res.body); process.exit(1); }
  console.log('headersMap response summary:', res.body.summary);
  if (res.body.summary.added !== 1) { console.error('expected 1 added'); process.exit(1); }

  await cleanupTemp(tmp);

  console.log('headersMap mapping endpoint test passed');
  process.exit(0);
})();
