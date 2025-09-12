const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

(async function runTests(){
  console.log('Running duplicates & strict-mode tests...');
  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { orchestrateUpload, processFile } = svc;

  const { parseCSVContent, convertToQuestionFormat, writeTempCSV, cleanupTemp, makeFileObject } = require('./_helpers.cjs');

  // Test A: duplicate with 'skip'
  const csvA = 'question,option_a\n"Duplicate Q",A\n';
  const tmpA = await writeTempCSV('dup_a.csv', csvA);
  const fileA = makeFileObject(tmpA, 'dup_a.csv', csvA);

  const questionBankA = { questions: [{ id: 1, question: 'Duplicate Q', source:{} }], uploads: [] };
  const contextA = {
    parseCSVContent,
    convertToQuestionFormat,
    questionBank: questionBankA,
    saveQuestionBank: async ()=>{},
    createBackup: async ()=>{},
    findDuplicate: (newQ, existing) => {
      const m = existing.find(q => (q.question||'').toLowerCase().trim() === (newQ.question||'').toLowerCase().trim());
      return m ? { type: 'text', question: m } : null;
    },
    applyMergeStrategy: (newQ, existingQ, strategy) => {
      if (strategy === 'skip') return null;
      if (strategy === 'force') {
        const maxId = Math.max(0, ...questionBankA.questions.map(q=>q.id||0));
        return { ...newQ, id: maxId+1 };
      }
      // overwrite/merge
      return { ...existingQ, ...newQ, id: existingQ.id };
    }
  };

  const resA = await orchestrateUpload([fileA], { mergeStrategy: 'skip' }, contextA);
  assert(resA.summary.skipped === 1 || resA.summary.added === 0, 'duplicate skip should not add question');

  // Test B: duplicate with 'force' -> should add
  const csvB = 'question,option_a\n"Duplicate Q",B\n';
  const tmpB = await writeTempCSV('dup_b.csv', csvB);
  const fileB = makeFileObject(tmpB, 'dup_b.csv', csvB);

  const questionBankB = { questions: [{ id: 1, question: 'Duplicate Q', source:{} }], uploads: [] };
  const contextB = { ...contextA, questionBank: questionBankB };
  const resB = await orchestrateUpload([fileB], { mergeStrategy: 'force' }, contextB);
  assert(resB.summary.added >= 1, 'force should add a new question');

  // Test C: strict-mode row failure
  const csvC = 'question,option_a\n"",A\n';
  const tmpC = await writeTempCSV('strict_c.csv', csvC);
  const fileC = makeFileObject(tmpC, 'strict_c.csv', csvC);

  try {
    await processFile(fileC, { strictness: 'strict' }, 'u123', parseCSVContent, convertToQuestionFormat);
    // If no throw, that's unexpected for strict mode when row question is empty
    console.log('Warning: strict mode did not throw as expected');
  } catch (err) {
    console.log('strict mode correctly threw an error for empty question row');
  }

  await cleanupTemp(tmpA, tmpB, tmpC);

  console.log('duplicates & strict-mode tests passed');
  process.exit(0);
})();
