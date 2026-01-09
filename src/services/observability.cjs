const metrics = {
  uploads: { success: 0, failure: 0, reuse: 0 },
  parseReportDownloads: 0,
  authFailures: { upload: 0, report: 0 },
  rateLimited: { upload: 0, report: 0 },
  cleanup: { runs: 0, deletedFiles: 0, lastRun: null },
  timestamp: new Date().toISOString()
};

function touch() {
  metrics.timestamp = new Date().toISOString();
}

function logEvent(event, data = {}) {
  // Structured JSON log for downstream collection
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

function recordUploadSuccess(meta) {
  metrics.uploads.success += 1;
  touch();
  if (meta) logEvent('upload_success', meta);
}

function recordUploadFailure(meta) {
  metrics.uploads.failure += 1;
  touch();
  if (meta) logEvent('upload_failure', meta);
}

function recordUploadReuse(meta) {
  metrics.uploads.reuse += 1;
  touch();
  if (meta) logEvent('upload_reuse', meta);
}

function recordParseReportDownload(meta) {
  metrics.parseReportDownloads += 1;
  touch();
  if (meta) logEvent('parse_report_download', meta);
}

function recordAuthFailure(kind = 'upload', meta) {
  if (metrics.authFailures[kind] != null) metrics.authFailures[kind] += 1;
  touch();
  if (meta) logEvent('auth_failure', { kind, ...meta });
}

function recordRateLimited(kind = 'upload', meta) {
  if (metrics.rateLimited[kind] != null) metrics.rateLimited[kind] += 1;
  touch();
  if (meta) logEvent('rate_limited', { kind, ...meta });
}

function recordCleanupRun(deletedFiles = 0, meta) {
  metrics.cleanup.runs += 1;
  metrics.cleanup.deletedFiles += deletedFiles;
  metrics.cleanup.lastRun = new Date().toISOString();
  touch();
  if (meta) logEvent('uploads_cleanup', { deletedFiles, ...meta });
}

function resetMetrics() {
  metrics.uploads = { success: 0, failure: 0, reuse: 0 };
  metrics.parseReportDownloads = 0;
  metrics.authFailures = { upload: 0, report: 0 };
  metrics.rateLimited = { upload: 0, report: 0 };
  metrics.cleanup = { runs: 0, deletedFiles: 0, lastRun: null };
  touch();
}

function getMetricsSnapshot() {
  return JSON.parse(JSON.stringify({ ...metrics, snapshotAt: new Date().toISOString() }));
}

module.exports = {
  logEvent,
  getMetricsSnapshot,
  resetMetrics,
  recordUploadSuccess,
  recordUploadFailure,
  recordUploadReuse,
  recordParseReportDownload,
  recordAuthFailure,
  recordRateLimited,
  recordCleanupRun
};
