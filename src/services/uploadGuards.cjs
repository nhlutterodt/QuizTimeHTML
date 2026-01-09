const path = require('path');

function createApiKeyGuard(expectedKey, { onFailure } = {}) {
  if (!expectedKey) {
    return (_req, _res, next) => next();
  }

  return (req, res, next) => {
    const provided = req.header('x-api-key') || req.header('authorization')?.replace(/^(Bearer\s+)/i, '');
    if (provided && provided === expectedKey) {
      return next();
    }
    if (typeof onFailure === 'function') onFailure(req);
    return res.status(401).json({ error: 'Unauthorized' });
  };
}

function createRateLimiter({ windowMs = 300000, maxRequests = 20, namespace = 'default', onLimit } = {}) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = `${namespace}:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
    const windowStart = now - windowMs;
    const entries = (buckets.get(key) || []).filter(ts => ts > windowStart);

    if (entries.length >= maxRequests) {
      if (typeof onLimit === 'function') onLimit(req);
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    entries.push(now);
    buckets.set(key, entries);
    next();
  };
}

function enforceRowLimit(csvContent, limit) {
  if (!Number.isFinite(limit) || limit <= 0) return;
  const lines = String(csvContent).split(/\r?\n/).filter(Boolean);
  const rowCount = Math.max(0, lines.length - 1);
  if (rowCount > limit) {
    throw new Error(`Row limit exceeded (${rowCount}/${limit})`);
  }
}

function enforceTotalSize(files, maxBytes) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) return;
  const total = (files || []).reduce((sum, f) => sum + (f?.size || 0), 0);
  if (total > maxBytes) {
    throw new Error(`Total upload size exceeds limit (${total}/${maxBytes} bytes)`);
  }
}

module.exports = {
  createApiKeyGuard,
  createRateLimiter,
  enforceRowLimit,
  enforceTotalSize
};
