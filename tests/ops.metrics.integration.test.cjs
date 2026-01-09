const request = require('supertest');

(async function runOpsMetricsIntegration() {
  console.log('Running /ops/metrics integration test against real server...');

  process.env.UPLOAD_API_KEY = 'metrics-key';
  process.env.PARSE_REPORT_API_KEY = 'metrics-key';
  process.env.REQUEST_LOG_ENABLED = 'false';

  const { startServer } = require('../server');
  const { server, port } = await startServer({ port: 0 });
  const agent = request(`http://127.0.0.1:${port}`);

  try {
    const unauth = await agent.get('/ops/metrics');
    if (unauth.status !== 401) {
      console.error('Expected 401 for missing API key, got', unauth.status);
      process.exit(1);
    }

    const auth = await agent.get('/ops/metrics').set('x-api-key', 'metrics-key');
    if (auth.status !== 200) {
      console.error('Expected 200 for authorized metrics request, got', auth.status, auth.body);
      process.exit(1);
    }

    const metrics = auth.body?.metrics;
    if (!metrics || typeof metrics !== 'object') {
      console.error('Metrics snapshot missing or invalid', auth.body);
      process.exit(1);
    }

    const checks = [
      ['uploads.success', metrics.uploads?.success !== undefined],
      ['uploads.failure', metrics.uploads?.failure !== undefined],
      ['uploads.reuse', metrics.uploads?.reuse !== undefined],
      ['parseReportDownloads', metrics.parseReportDownloads !== undefined],
      ['authFailures.upload', metrics.authFailures?.upload !== undefined],
      ['rateLimited.report', metrics.rateLimited?.report !== undefined],
      ['cleanup.runs', metrics.cleanup?.runs !== undefined]
    ];

    for (const [name, ok] of checks) {
      if (!ok) {
        console.error('Missing metric field', name, metrics);
        process.exit(1);
      }
    }

    console.log('Ops metrics integration test passed');
    process.exit(0);
  } catch (err) {
    console.error('Ops metrics integration test failed:', err);
    process.exit(1);
  } finally {
    server.close();
  }
})();
