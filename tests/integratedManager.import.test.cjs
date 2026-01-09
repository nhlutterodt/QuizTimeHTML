const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

(async () => {
  console.log('Running IntegratedQuestionManager import tests...');
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'services', 'IntegratedQuestionManager.js'));
  const mod = await import(moduleUrl.href);
  const IntegratedQuestionManager = mod.default || mod.IntegratedQuestionManager;

  // Happy path: preset + headersMap honored
  {
    const mgr = new IntegratedQuestionManager();
    await mgr.initialize({ questions: [], uploads: [], metadata: {} });

    const csv = 'Question Text,OptA,OptB,correct_answer\n"Capital of France?",Paris,Lyon,A\n';
    const res = await mgr.importFromCSV(csv, {
      preset: 'multiple_choice',
      headersMap: { 'Question Text': 'question', OptA: 'option_a', OptB: 'option_b' },
      mergeStrategy: 'skip',
      snapshotRowLimit: 5,
      uploadId: 'u1'
    });

    assert.strictEqual(res.summary.added, 1, 'should add one question');
    assert.ok(res.lastParseSnapshot, 'snapshot should exist');
    assert.strictEqual(res.lastParseSnapshot.preset, 'multiple_choice');
    assert.deepStrictEqual(res.lastParseSnapshot.headers, ['question', 'option_a', 'option_b', 'correct_answer']);
    assert.strictEqual(res.lastParseSnapshot.snapshotRowLimit, 5);
  }

  // Strict mode: missing required question should surface error
  {
    const mgr = new IntegratedQuestionManager();
    await mgr.initialize({ questions: [], uploads: [], metadata: {} });

    const badCsv = 'OptA,correct_answer\nA,A\n';
    const res = await mgr.importFromCSV(badCsv, {
      preset: 'multiple_choice',
      headersMap: {},
      mergeStrategy: 'skip',
      strictValidation: false, // should not throw; should record parse error
      snapshotRowLimit: 3,
      uploadId: 'u2'
    });

    assert.ok(res.parseErrors.length > 0, 'should collect parse errors');
    assert.ok(res.lastParseSnapshot.totalErrors > 0, 'snapshot should report errors');
  }

  // Export parse report writes temp file and deletes after stream
  {
    const mgr = new IntegratedQuestionManager();
    await mgr.initialize({ questions: [], uploads: [], metadata: {} });
    const csv = 'question,option_a,correct_answer\n"Q?",A,A\n';
    await mgr.importFromCSV(csv, { snapshotRowLimit: 2, uploadId: 'u3' });

    const exportResult = await mgr.exportLastParseReport();
    assert.strictEqual(exportResult.type, 'server', 'export should write temp file in Node');
    assert.ok(fs.existsSync(exportResult.path), 'temp file should exist');

    // Manually delete to avoid residue in case test aborts early
    try { fs.unlinkSync(exportResult.path); } catch (e) { /* ignore */ }
  }

  console.log('IntegratedQuestionManager import tests passed');
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
