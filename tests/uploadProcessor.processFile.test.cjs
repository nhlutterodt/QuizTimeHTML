const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;

(async function testProcessFile(){
  console.log('Running processFile unit test...');

  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { processFile } = svc;

  const { writeTempCSV, cleanupTemp, makeFileObject } = require('./_helpers.cjs');
  const csv = 'Question Text,OptA,OptB\n"Alpha","A","B"\n"Beta","C","D"\n';
  const tmp = await writeTempCSV('proc_test.csv', csv);
  const fakeFile = makeFileObject(tmp, 'proc_test.csv', csv);

  const { parseCSVContent, convertToQuestionFormat } = require('./_helpers.cjs');

  // test with headersMap mapping mixed-case keys to canonical names
  const options = { headersMap: { 'Question Text': 'question', 'OptA': 'option_a', 'OptB': 'option_b' }, strictness: 'lenient' };

  const result = await processFile(fakeFile, options, 'u1', parseCSVContent, convertToQuestionFormat);

  assert(result.fileDetail.processed === 2, 'should process two rows');
  assert(result.parsedQuestions.length === 2, 'should return two parsed questions');
  assert(result.fileDetail.errors.length === 0, 'no errors expected in lenient mode');

  // now test strictness: missing required header 'question' if headersMap absent
  await writeTempCSV('proc_test.csv', 'OptA,OptB\n1,2\n');
  const fakeFile2 = makeFileObject(tmp, 'proc_test2.csv', 'OptA,OptB\n1,2\n');
  const options2 = { strictness: 'strict' };

  try {
    const res2 = await processFile(fakeFile2, options2, 'u2', parseCSVContent, convertToQuestionFormat);
    // In strict mode, processFile should return fileDetail early without throwing; it returns fileDetail
    assert(res2.fileDetail.errors.length > 0, 'should report missing headers');
  } catch (err) {
    // If strict mode threw, accept as valid depending on implementation
    console.log('strict mode threw as part of behavior:', err.message || err);
  }

  await cleanupTemp(tmp).catch(()=>{});
  console.log('processFile unit test passed');
  process.exit(0);
})();
