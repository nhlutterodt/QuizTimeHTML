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
  // buckets: Map<key, { timestamps: number[] , lastSeen: number }>
  const buckets = new Map();
  const maxBuckets = Number(process.env.RATE_LIMIT_MAX_BUCKETS || 20000);

  function makeKey(req) {
    // Prefer API key when present, else fall back to IP
    const apiKey = req.header('x-api-key') || req.header('authorization')?.replace(/^(Bearer\s+)/i, '');
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
    return `${namespace}:${apiKey || ip}`;
  }

  function evictIfNeeded() {
    if (buckets.size <= maxBuckets) return;
    // Evict least-recently-used (first key in insertion order)
    const firstKey = buckets.keys().next().value;
    if (firstKey) buckets.delete(firstKey);
  }

  return (req, res, next) => {
    try {
      const now = Date.now();
      const key = makeKey(req);
      const windowStart = now - windowMs;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { timestamps: [], lastSeen: now };
      }

      // drop old timestamps
      bucket.timestamps = bucket.timestamps.filter(ts => ts > windowStart);

      const remaining = Math.max(0, maxRequests - bucket.timestamps.length);

      // set rate-limit headers
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));

      if (bucket.timestamps.length >= maxRequests) {
        // compute retry-after in seconds
        const oldest = bucket.timestamps[0] || now;
        const retryAfterMs = Math.max(0, windowMs - (now - oldest));
        const retryAfterSec = Math.ceil(retryAfterMs / 1000) || 1;
        res.setHeader('Retry-After', String(retryAfterSec));
        res.setHeader('X-RateLimit-Reset', String(Math.floor((now + retryAfterMs) / 1000)));
        if (typeof onLimit === 'function') onLimit(req);
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }

      // accept request
      bucket.timestamps.push(now);
      bucket.lastSeen = now;

      // update map as LRU: delete then set to move to newest insertion order
      buckets.delete(key);
      buckets.set(key, bucket);
      evictIfNeeded();

      next();
    } catch (err) {
      // Fail-open on limiter errors to avoid accidental denial-of-service
      console.error('Rate limiter error:', err);
      next();
    }
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
