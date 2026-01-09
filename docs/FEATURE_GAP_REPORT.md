# Feature Gap Report (Jan 2026)

## Scope
- QuizTimeHTML CSV import pipeline, AI assessment proxy, upload UX, observability/security.

## Current State (Jan 2026)
- Parsing supports `preset` and `headersMap`; produces `lastParseSnapshot`.
- Upload UI sends preset/headersMap; parse-report download streams snapshot.
- Workstream 1 completed: `/api/upload-csvs` delegates to `IntegratedQuestionManager.importFromCSV` (single pipeline). Question bank syncs with manager on startup and after uploads.
- Workstream 2 completed: `/api/upload-csvs` accepts `uploadId`, short-circuits duplicates via `uploads/idempotency.json`, appends JSONL audit lines to `uploads/audit.log`, and hashes each file in response details.
- Workstream 3 completed: auth guards, rate limits, size/row limits applied to upload and parse-report endpoints; actor/requestId tagging in logs/metrics.
- Workstream 4 completed: metrics counters, structured logs, cleanup scheduler for uploads dir, idempotency/audit rotation; `/ops/metrics` exposed behind auth.
- Tests: full suite passes (`npm test`), including upload/auth/limit/idempotency and observability metrics tests.

## Gaps Resolved (WS1 & WS2)
- Removed dual validation paths: multipart uploads now use the integrated CSV manager.
- Parse-report export remains compatible and backed by the integrated snapshot.
- Added idempotent uploads with audit logging and per-file checksums; duplicate `uploadId` requests return cached responses without reprocessing.

## Remaining Gaps (performance & controls)
- Rate limiting robustness: fixed-window, IP-only limiter without `Retry-After` or eviction; no per-API-key buckets; `/ops/metrics` unbounded. See plan in `docs/API_PERF_GAP_PLAN.md`.
- Resource protection: uploads read full files into memory; no request timeout or concurrency guard beyond size/row caps.
- Observability depth: counters only—no latency buckets or per-endpoint breakdown; minimal duration logging.
- Docs/config: PERF plan not yet reflected in README/DEV; env defaults for new controls to be documented.

## Next Workstreams
- **WS5 Tests/CI expansion:** keep suite current as new perf controls land (rate-limit headers, streaming stress, metrics shape).
- **Perf & controls plan execution:** implement and validate actions in `docs/API_PERF_GAP_PLAN.md` (limiter upgrade, streaming + concurrency guard, latency metrics, docs updates).

## Evidence
- Code: `server.js` (upload consolidation + idempotency), `src/services/UploadIdempotencyService.cjs`, `tests/integratedManager.import.test.cjs`, `tests/upload.idempotency.test.cjs`, `scripts/run-tests.cjs` (suite entry).
- Plans: `docs/FEATURE_GAP_PLAN.md` (WS1/WS2 status), `docs/API_PERF_GAP_PLAN.md` (perf/controls), `npm test` passing on 2026-01-09.
