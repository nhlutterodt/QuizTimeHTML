# Feature Gap Report (Jan 2026)

## Scope
- QuizTimeHTML CSV import pipeline, AI assessment proxy, upload UX, observability/security.

## Current State
- Parsing supports `preset` and `headersMap`; produces `lastParseSnapshot`.
- Upload UI sends preset/headersMap; parse-report download streams snapshot.
- Workstream 1 completed: `/api/upload-csvs` delegates to `IntegratedQuestionManager.importFromCSV` (single pipeline). Question bank syncs with manager on startup and after uploads.
- Workstream 2 completed: `/api/upload-csvs` accepts `uploadId`, short-circuits duplicates via `uploads/idempotency.json`, appends JSONL audit lines to `uploads/audit.log`, and hashes each file in response details.
- Tests: full suite passes (`npm test`), including `tests/integratedManager.import.test.cjs` and `tests/upload.idempotency.test.cjs`.

## Gaps Resolved (WS1 & WS2)
- Removed dual validation paths: multipart uploads now use the integrated CSV manager.
- Parse-report export remains compatible and backed by the integrated snapshot.
- Added idempotent uploads with audit logging and per-file checksums; duplicate `uploadId` requests return cached responses without reprocessing.

## Remaining Gaps (to address next)
- Endpoint hardening: authn/z, rate limiting, file/row limits, consistent error schema.
- Observability & retention: metrics, structured logs, temp-file cleanup cadence/rotation for audit/idempotency files.
- Tests/CI: add integration coverage for hardened endpoints and retention behaviors.

## Next Workstreams
- **WS3 Hardening:** auth/rate-limit/file limits and standardized errors.
- **WS4 Observability & Retention:** metrics + temp-file cleanup/rotation.
- **WS5 Tests/CI expansion:** integration and regression coverage for hardening and retention.

## Evidence
- Code: `server.js` (upload consolidation + idempotency), `src/services/UploadIdempotencyService.cjs`, `tests/integratedManager.import.test.cjs`, `tests/upload.idempotency.test.cjs`, `scripts/run-tests.cjs` (suite entry).
- Plan: `docs/FEATURE_GAP_PLAN.md` (WS1/WS2 status), `npm test` passing on 2026-01-09.
