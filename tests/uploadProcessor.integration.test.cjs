const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

(async function integrationTest(){
  console.log('Running uploadProcessor integration test...');

  const { ensureUploadsDir, writeTempCSV, cleanupTemp, makeFileObject } = require('./_helpers.cjs');
  const csvContent = 'question,option_a,option_b,correct_answer\n"What is 2+2?",4,3,4\n';
  const tmpPath = await writeTempCSV('test_upload.csv', csvContent);
  const fakeFile = makeFileObject(tmpPath, 'test_upload.csv', csvContent);

  const { parseCSVContent, convertToQuestionFormat } = require('./_helpers.cjs');

  const questionBank = { questions: [], uploads: [] };
  const context = { parseCSVContent, convertToQuestionFormat, questionBank, saveQuestionBank: async ()=>{}, createBackup: async ()=>{} };

  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { orchestrateUpload } = svc;

  const result = await orchestrateUpload([fakeFile], { preset: 'multiple_choice' }, context);

  assert(result.summary.added === 1, 'one question should be added');
  assert(questionBank.questions.length === 1, 'questionBank should have one question');

  await cleanupTemp(tmpPath);

  console.log('integration test passed');
  process.exit(0);
})();
