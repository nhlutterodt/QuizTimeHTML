const express = require('express');
const request = require('supertest');
const { createApiKeyGuard, createRateLimiter } = require('../src/services/uploadGuards.cjs');

(async function runAuthLimitTest() {
  console.log('Running auth/rate-limit middleware test...');

  const app = express();
  const apiKeyGuard = createApiKeyGuard('secret-key');
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1, namespace: 'limit' });

  app.get('/protected', apiKeyGuard, (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/limited', limiter, apiKeyGuard, (_req, res) => {
    res.json({ ok: true });
  });

  // Missing key should 401
  const noKey = await request(app).get('/protected');
  if (noKey.status !== 401) {
    console.error('Expected 401 for missing API key, got', noKey.status);
    process.exit(1);
  }

  // First request with key succeeds on protected route
  const first = await request(app).get('/protected').set('x-api-key', 'secret-key');
  if (first.status !== 200) {
    console.error('Expected 200 for valid API key, got', first.status);
    process.exit(1);
  }

  // Limited route: first ok, second should rate-limit
  const limitedFirst = await request(app).get('/limited').set('x-api-key', 'secret-key');
  if (limitedFirst.status !== 200) {
    console.error('Expected 200 for first limited request, got', limitedFirst.status);
    process.exit(1);
  }

  const limitedSecond = await request(app).get('/limited').set('x-api-key', 'secret-key');
  if (limitedSecond.status !== 429) {
    console.error('Expected 429 for rate limit, got', limitedSecond.status);
    process.exit(1);
  }

  console.log('Auth/rate-limit middleware test passed');
  process.exit(0);
})();
