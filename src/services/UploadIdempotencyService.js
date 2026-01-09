const path = require('path');
const fs = require('fs').promises;

class UploadIdempotencyService {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.storePath = path.join(baseDir, 'idempotency.json');
    this.auditLogPath = path.join(baseDir, 'audit.log');
    this.store = { records: {}, lastUpdated: null };
  }

  async init() {
    await fs.mkdir(this.baseDir, { recursive: true });
    await this.load();
  }

  async load() {
    try {
      const data = await fs.readFile(this.storePath, 'utf8');
      this.store = JSON.parse(data);
    } catch (e) {
      this.store = { records: {}, lastUpdated: new Date().toISOString() };
      await this.save();
    }
  }

  async save() {
    this.store.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.storePath, JSON.stringify(this.store, null, 2), 'utf8');
  }

  get(uploadId) {
    return this.store.records?.[uploadId] || null;
  }

  async recordStart({ uploadId, options = {}, files = [] }) {
    this.store.records[uploadId] = {
      ...(this.store.records[uploadId] || {}),
      uploadId,
      status: 'processing',
      startedAt: new Date().toISOString(),
      options,
      files
    };
    await this.save();
    await this.appendAudit({ event: 'start', uploadId, files, status: 'processing' });
  }

  async recordSuccess({ uploadId, response = {}, files = [], options = {} }) {
    this.store.records[uploadId] = {
      uploadId,
      status: 'completed',
      completedAt: new Date().toISOString(),
      response,
      options,
      files
    };
    await this.save();
    await this.appendAudit({ event: 'success', uploadId, status: 'completed', summary: response.summary });
  }

  async recordFailure({ uploadId, error }) {
    this.store.records[uploadId] = {
      ...(this.store.records[uploadId] || {}),
      uploadId,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: error?.message || String(error)
    };
    await this.save();
    await this.appendAudit({ event: 'failure', uploadId, status: 'failed', error: error?.message || String(error) });
  }

  async recordReuse({ uploadId, response = {} }) {
    await this.appendAudit({ event: 'reuse', uploadId, status: 'completed', summary: response.summary });
  }

  async appendAudit(entry) {
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    await fs.appendFile(this.auditLogPath, line, 'utf8');
  }
}

module.exports = UploadIdempotencyService;
