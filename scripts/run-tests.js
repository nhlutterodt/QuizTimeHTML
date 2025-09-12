const { spawnSync } = require('child_process');
const path = require('path');

const tests = [
  path.join(__dirname, '..', 'tests', 'uploadProcessor.unit.test.cjs'),
  path.join(__dirname, '..', 'tests', 'uploadProcessor.integration.test.cjs')
];

let failed = 0;
for (const t of tests) {
  console.log('Running', t);
  const r = spawnSync(process.execPath, [t], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

if (failed) {
  console.error(`${failed} test(s) failed`);
  process.exit(1);
}
console.log('All tests passed');
process.exit(0);
