const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const express = require('express');
const multer = require('multer');
const request = require('supertest');
const UploadIdempotencyService = require('../src/services/UploadIdempotencyService.cjs');
const { writeTempCSV, cleanupTemp } = require('./_helpers.cjs');

(async function runIdempotencyTest() {
  console.log('Running idempotency + audit test for /api/upload-csvs (stubbed app)...');

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'quiz-idem-'));
  const idempotency = new UploadIdempotencyService(tmpRoot);
  await idempotency.init();
  const actor = { userId: 'test-user', sessionId: 'test-session' };

  let importCallCount = 0;
  const stubManager = {
    async importFromCSV() {
      importCallCount++;
      return {
        summary: { processed: 1, added: 1, updated: 0, skipped: 0, errors: [] },
        parseStats: { total: 1 },
        parseErrors: [],
        parseWarnings: []
      };
    },
    getAllQuestions() { return [{ id: 1, question: 'Stub' }]; },
    metadata: { version: 'test' }
  };

  const app = express();
  const upload = multer({ dest: tmpRoot });

  app.post('/api/upload-csvs', upload.array('files', 5), async (req, res) => {
    const files = req.files || [];
    const options = JSON.parse(req.body.options || '{}');
    if (req.body.uploadId) options.uploadId = options.uploadId || req.body.uploadId;

    const uploadId = options.uploadId || 'test-upload';
    const existing = idempotency.get(uploadId);
    if (existing && existing.status === 'completed') {
      for (const f of files) { try { await fs.unlink(f.path); } catch (e) { /* ignore */ } }
      const cached = { ...(existing.response || {}), uploadId, idempotent: true };
      await idempotency.recordReuse({ uploadId, response: cached, actor });
      return res.json(cached);
    }

    await idempotency.recordStart({
      uploadId,
      options,
      files: files.map(f => ({ name: f.originalname, size: f.size })),
      actor
    });

    const detailsPerFile = [];
    const summary = { processed: 0, added: 0, updated: 0, skipped: 0, errors: [] };

    for (const file of files) {
      const csvContent = await fs.readFile(file.path, 'utf8');
      try {
        const result = await stubManager.importFromCSV(csvContent, options);
        const fileDetail = {
          filename: file.originalname,
          size: file.size,
          processed: result.summary?.processed ?? 0,
          added: result.summary?.added ?? 0,
          updated: result.summary?.updated ?? 0,
          skipped: result.summary?.skipped ?? 0,
          errors: (result.summary?.errors || []).map(e => e.error || e)
        };
        detailsPerFile.push(fileDetail);
        summary.processed += fileDetail.processed;
        summary.added += fileDetail.added;
        summary.updated += fileDetail.updated;
        summary.skipped += fileDetail.skipped;
        summary.errors.push(...fileDetail.errors);
      } finally {
        try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
      }
    }

    const responsePayload = {
      uploadId,
      summary,
      detailsPerFile,
      questionBankStats: {
        totalQuestions: stubManager.getAllQuestions().length,
        totalUploads: 1
      },
      idempotent: false
    };

    await idempotency.recordSuccess({
      uploadId,
      response: responsePayload,
      options,
      files: detailsPerFile,
      actor
    });

    res.json(responsePayload);
  });

  const tmpCSV = await writeTempCSV('idempotency.csv', 'question,correct_answer\n"Q1",A\n');
  const uploadId = 'idempotency-test-1';

  const first = await request(app)
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip', uploadId }))
    .field('uploadId', uploadId)
    .attach('files', tmpCSV, 'idempotency.csv');

  if (first.status !== 200 || first.body.idempotent) {
    console.error('First upload did not succeed as expected', first.status, first.body);
    process.exit(1);
  }

  const second = await request(app)
    .post('/api/upload-csvs')
    .field('options', JSON.stringify({ mergeStrategy: 'skip', uploadId }))
    .field('uploadId', uploadId)
    .attach('files', tmpCSV, 'idempotency.csv');

  if (second.status !== 200 || !second.body.idempotent) {
    console.error('Second upload was not treated as idempotent', second.status, second.body);
    process.exit(1);
  }

  if (importCallCount !== 1) {
    console.error('Idempotency failed: expected 1 import, got', importCallCount);
    process.exit(1);
  }

  // Ensure actor metadata persisted in records
  const store = JSON.parse(await fs.readFile(path.join(tmpRoot, 'idempotency.json'), 'utf8'));
  const storedActor = store.records?.[uploadId]?.actor;
  if (!storedActor || storedActor.userId !== actor.userId || storedActor.sessionId !== actor.sessionId) {
    console.error('Actor metadata missing from idempotency records', storedActor);
    process.exit(1);
  }

  const auditLog = await fs.readFile(path.join(tmpRoot, 'audit.log'), 'utf8').catch(() => '');
  if (!auditLog.includes('reuse')) {
    console.error('Audit log missing reuse entry');
    process.exit(1);
  }

  await cleanupTemp(tmpCSV);
  await fs.rm(tmpRoot, { recursive: true, force: true });
  console.log('Idempotency + audit test passed');
  process.exit(0);
})();
