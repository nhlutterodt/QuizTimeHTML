const assert = require('assert');
const observability = require('../src/services/observability.cjs');

(async function runMetricsTest() {
  console.log('Running observability metrics test...');

  observability.resetMetrics();
  observability.recordUploadSuccess({ requestId: 'r1' });
  observability.recordUploadFailure({ requestId: 'r1' });
  observability.recordUploadReuse({ requestId: 'r2' });
  observability.recordParseReportDownload({ requestId: 'r3' });
  observability.recordAuthFailure('upload', { requestId: 'r4' });
  observability.recordRateLimited('report', { requestId: 'r5' });
  observability.recordCleanupRun(2, { retentionMs: 1000 });

  const snapshot = observability.getMetricsSnapshot();

  try {
    assert.strictEqual(snapshot.uploads.success, 1);
    assert.strictEqual(snapshot.uploads.failure, 1);
    assert.strictEqual(snapshot.uploads.reuse, 1);
    assert.strictEqual(snapshot.parseReportDownloads, 1);
    assert.strictEqual(snapshot.authFailures.upload, 1);
    assert.strictEqual(snapshot.authFailures.report, 0);
    assert.strictEqual(snapshot.rateLimited.report, 1);
    assert.strictEqual(snapshot.cleanup.deletedFiles, 2);
    assert.ok(snapshot.cleanup.lastRun, 'cleanup should set lastRun timestamp');
    console.log('Observability metrics test passed');
    process.exit(0);
  } catch (err) {
    console.error('Observability metrics assertions failed', err);
    process.exit(1);
  }
})();
