const path = require('path');
const fs = require('fs').promises;

(async function run(){
  console.log('Running multipart upload endpoint test...');

  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { orchestrateUpload } = svc;

  const express = require('express');
  const multer = require('multer');

  const app = express();
  const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

  const { parseCSVContent, convertToQuestionFormat } = require('./_helpers.cjs');

  app.post('/api/upload-csvs', upload.array('files', 5), async (req, res) => {
    const files = req.files || [];
    const options = JSON.parse(req.body.options || '{}');
    if (req.body.headersMap) {
      try {
        options.headersMap = JSON.parse(req.body.headersMap);
      } catch (e) {
        console.warn('multipart test: malformed headersMap', e?.message ?? e);
      }
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

  const { writeTempCSV, cleanupTemp, makeFileObject } = require('./_helpers.cjs');
  const csv1 = 'question,option_a,correct_answer\n"Multi Q1",A,1\n';
  const csv2 = 'question,option_a,correct_answer\n"Multi Q2",B,2\n';
  const tmp1 = await writeTempCSV('multi_1.csv', csv1);
  const tmp2 = await writeTempCSV('multi_2.csv', csv2);

  const res = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .attach('files', tmp1, 'multi_1.csv')
    .attach('files', tmp2, 'multi_2.csv');

  if (res.status !== 200) { console.error('multipart test failed', res.status, res.body); process.exit(1); }
  console.log('multipart upload summary:', res.body.summary);
  if (res.body.summary.processed !== 2) { console.error('expected 2 processed files'); process.exit(1); }

  await cleanupTemp(tmp1, tmp2);

  console.log('multipart upload endpoint test passed');
  process.exit(0);
})();
