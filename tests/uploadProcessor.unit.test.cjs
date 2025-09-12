const assert = require('assert');

(async function unitTests(){
  console.log('Running uploadProcessor unit tests...');
  const mod = await import('../src/services/uploadProcessor.js');
  const svc = mod.default || mod;
  const { applyHeadersMapToRows, validateHeaders } = svc;

  // applyHeadersMapToRows
  const rows = [{ 'Question Text': 'Q1', 'Option A': 'A' }, { 'Question Text': 'Q2', 'Option A': 'B' }];
  const map = { 'Question Text': 'question', 'Option A': 'option_a' };
  const res = applyHeadersMapToRows(rows, map);
  assert(Array.isArray(res.rows), 'rows should be an array');
  assert(res.headers.includes('question'), 'headers should include mapped key');
  assert(res.rows[0].question === 'Q1', 'row mapping should rename keys');

  // validateHeaders
  const hdrCheck = validateHeaders(res.headers, ['question', 'option_a']);
  assert(hdrCheck.ok === true, 'validateHeaders should pass when required headers present');

  console.log('unit tests passed');
  process.exit(0);
})();
