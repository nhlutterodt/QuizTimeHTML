const path = require('path');
const fs = require('fs').promises;

class UploadIdempotencyService {
  constructor(baseDir, { maxAuditBytes = 5 * 1024 * 1024, maxRecords = 2000 } = {}) {
    this.baseDir = baseDir;
    this.storePath = path.join(baseDir, 'idempotency.json');
    this.auditLogPath = path.join(baseDir, 'audit.log');
    this.maxAuditBytes = maxAuditBytes;
    this.maxRecords = maxRecords;
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
    this.pruneRecords();
    this.store.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.storePath, JSON.stringify(this.store, null, 2), 'utf8');
  }

  get(uploadId) {
    return this.store.records?.[uploadId] || null;
  }

  async recordStart({ uploadId, options = {}, files = [], actor }) {
    this.store.records[uploadId] = {
      ...(this.store.records[uploadId] || {}),
      uploadId,
      status: 'processing',
      startedAt: new Date().toISOString(),
      options,
      files,
      actor: actor || this.store.records[uploadId]?.actor || null
    };
    await this.save();
    await this.appendAudit({ event: 'start', uploadId, files, status: 'processing', actor });
  }

  async recordSuccess({ uploadId, response = {}, files = [], options = {}, actor }) {
    this.store.records[uploadId] = {
      uploadId,
      status: 'completed',
      completedAt: new Date().toISOString(),
      response,
      options,
      files,
      actor: actor || this.store.records[uploadId]?.actor || null
    };
    await this.save();
    await this.appendAudit({ event: 'success', uploadId, status: 'completed', summary: response.summary, actor });
  }

  async recordFailure({ uploadId, error, actor }) {
    this.store.records[uploadId] = {
      ...(this.store.records[uploadId] || {}),
      uploadId,
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: error?.message || String(error),
      actor: actor || this.store.records[uploadId]?.actor || null
    };
    await this.save();
    await this.appendAudit({ event: 'failure', uploadId, status: 'failed', error: error?.message || String(error), actor });
  }

  async recordReuse({ uploadId, response = {}, actor }) {
    await this.appendAudit({ event: 'reuse', uploadId, status: 'completed', summary: response.summary, actor });
  }

  async appendAudit(entry) {
    await this.rotateAuditIfNeeded();
    const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n';
    await fs.appendFile(this.auditLogPath, line, 'utf8');
  }

  pruneRecords() {
    const keys = Object.keys(this.store.records || {});
    if (!this.maxRecords || keys.length <= this.maxRecords) return;
    const sorted = keys.sort((a, b) => {
      const aTime = new Date(this.store.records[a]?.startedAt || 0).getTime();
      const bTime = new Date(this.store.records[b]?.startedAt || 0).getTime();
      return aTime - bTime;
    });
    const toRemove = sorted.slice(0, Math.max(0, sorted.length - this.maxRecords));
    for (const k of toRemove) delete this.store.records[k];
  }

  async rotateAuditIfNeeded() {
    if (!this.maxAuditBytes || this.maxAuditBytes <= 0) return;
    try {
      const stat = await fs.stat(this.auditLogPath);
      if (stat.size <= this.maxAuditBytes) return;
      const backupPath = path.join(this.baseDir, 'audit.log.bak');
      await fs.rename(this.auditLogPath, backupPath).catch(async () => {
        // If rename fails, truncate in place
        await fs.writeFile(this.auditLogPath, '', 'utf8');
      });
      await fs.writeFile(this.auditLogPath, '', 'utf8');
    } catch (e) {
      // File may not exist yet; ignore
    }
  }
}

module.exports = UploadIdempotencyService;
