// Self-contained test for rotation and pruning behavior in UploadIdempotencyService
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const UploadIdempotencyService = require('../src/services/UploadIdempotencyService.cjs');

const writeAuditEntries = (filePath, entries) => {
  fs.writeFileSync(filePath, '');
  entries.forEach((entry) => {
    fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`);
  });
};

const readAuditEntries = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
};

(async function runRotationTest() {
  console.log('Running rotation/pruning test for UploadIdempotencyService...');

  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-idem-'));
  try {
    const service = new UploadIdempotencyService(baseDir, { maxRecords: 2, maxAuditBytes: 100 });
    await service.init();

    // Pruning: keep only newest two records
    service.store.records = {
      id1: { uploadId: 'id1', startedAt: '2024-01-01T00:00:00Z' },
      id2: { uploadId: 'id2', startedAt: '2024-01-02T00:00:00Z' },
      id3: { uploadId: 'id3', startedAt: '2024-01-03T00:00:00Z' },
    };
    await service.save();

    const stored = JSON.parse(fs.readFileSync(service.storePath, 'utf8')).records;
    const remainingIds = Object.keys(stored);
    assert.strictEqual(remainingIds.length, 2, 'records should be pruned to maxRecords');
    assert.deepStrictEqual(remainingIds.sort(), ['id2', 'id3']);

    // Rotation: when audit exceeds limit, rotate and keep latest entry
    writeAuditEntries(service.auditLogPath, [
      { uploadId: 'old1', checksum: 'c1', receivedAt: 1 },
      { uploadId: 'old2', checksum: 'c2', receivedAt: 2 },
    ]);

    const beforeSize = fs.statSync(service.auditLogPath).size;
    await service.appendAudit({ event: 'success', uploadId: 'new1', status: 'completed' });
    const afterSize = fs.statSync(service.auditLogPath).size;

    assert.ok(beforeSize > 0, 'audit should have initial content');
    assert.ok(afterSize < beforeSize, 'audit should be rotated to smaller size');

    const entries = readAuditEntries(service.auditLogPath);
    assert.strictEqual(entries.length, 1, 'only latest entry should remain after rotation');
    assert.strictEqual(entries[0].uploadId, 'new1');

    console.log('Rotation/pruning test passed');
    fs.rmSync(baseDir, { recursive: true, force: true });
    process.exit(0);
  } catch (err) {
    console.error('Rotation/pruning test failed:', err);
    fs.rmSync(baseDir, { recursive: true, force: true });
    process.exit(1);
  }
})();
