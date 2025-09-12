const path = require('path');
const fs = require('fs').promises;

(async function httpTest(){
  console.log('Running HTTP integration test for /api/upload-csvs (in-process app)...');

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
    if (req.body.headersMap) try { options.headersMap = JSON.parse(req.body.headersMap); } catch (e) {}

    const context = { parseCSVContent, convertToQuestionFormat, questionBank: { questions: [], uploads: [] }, saveQuestionBank: async ()=>{}, createBackup: async ()=>{}, findDuplicate: (n, existing)=> existing.find(q=> (q.question||'').toLowerCase().trim()===(n.question||'').toLowerCase().trim()) ? { question: existing.find(q=> (q.question||'').toLowerCase().trim()===(n.question||'').toLowerCase().trim()) } : null, applyMergeStrategy: (n, e, s)=> s==='skip' ? null : (s==='force' ? {...n, id: (Math.max(0, ...context.questionBank.questions.map(q=>q.id||0))+1)} : {...e, ...n}) };

    try {
      const result = await orchestrateUpload(files, options, context);
      res.json({ uploadId: result.uploadId, summary: result.summary, detailsPerFile: result.detailsPerFile });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const request = require('supertest')(app);
  const { writeTempCSV, cleanupTemp, makeFileObject } = require('./_helpers.cjs');
  const csv = 'question,option_a,option_b,correct_answer\n"HTTP Test Q",X,Y,X\n';
  const tmp = await writeTempCSV('http_test.csv', csv);

  const headersMap = { 'question': 'question', 'option_a': 'option_a', 'option_b': 'option_b', 'correct_answer': 'correct_answer' };

  const res = await request
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip' }))
    .field('headersMap', JSON.stringify(headersMap))
    .attach('files', tmp, 'http_test.csv');

  if (res.status !== 200) {
    console.error('Upload endpoint returned non-200:', res.status, res.body);
    process.exit(1);
  }

  console.log('HTTP upload response summary:', res.body.summary);
  if (!res.body.summary) {
    console.error('No summary in response');
    process.exit(1);
  }

  await cleanupTemp(tmp);

  console.log('HTTP integration test passed');
  process.exit(0);
})();
