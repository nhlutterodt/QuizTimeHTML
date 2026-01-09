# Feature Gap Analysis — Implementation Guide

## Purpose & Scope
- Goal: identify and close functional gaps in quiz CSV import, AI assessment, and UX flows for QuizTimeHTML.
- Scope: server import pipeline, CSV parsing/validation, UI upload flow, AI assessment integration, observability, security, retention.

## Audiences
- Engineering (backend/FE) for implementation details.
- QA for test matrices.
- PM for prioritization and rollout tracking.

## Canonical Sources
- Code: `src/data/EnhancedCSVManager.js`, `src/services/IntegratedQuestionManager.js`, `src/services/uploadProcessor.js`, `server.js`, `src/components/ConfigurationPanel.js`, `src/components/QuizApp.js`, `src/services/APIService.js`.
- Plans/specs: `docs/CSV_UPLOAD_SCHEMA_PLAN.md`, `docs/API_REFERENCE.md`, `docs/PROJECT_STRUCTURE.md`.
- Tests: `tests/uploadProcessor.*.test.cjs`, fixtures/helpers.

## Definitions
- Preset: schema preset (`auto`, `multiple_choice`, `short_answer`, `true_false`, `numeric`).
- Headers map: client-provided CSV header remap.
- Integrated flow: `IntegratedQuestionManager.importFromCSV()` path with snapshots.
- Legacy multipart flow: `/api/upload-csvs` + `uploadProcessor` path.

## Current State (observed)
- Single integrated import path via `IntegratedQuestionManager`; parsing supports `preset`/`headersMap` and emits `lastParseSnapshot`.
- UI exposes preset + headersMap and posts to `/api/upload-csvs`.
- Parse-report download endpoint streams last snapshot.
- Idempotency + audit enabled: `/api/upload-csvs` accepts `uploadId`, short-circuits duplicate IDs using `uploads/idempotency.json`, and writes JSONL audit entries to `uploads/audit.log`.
- Endpoint hardening in place: API-key auth, rate limiting, total upload size limits, and per-file row limits on upload and parse-report routes.
- Audit/idempotency retention guardrails: rotation/pruning added (maxAuditBytes rotates audit log; maxRecords prunes oldest records before save).
- Structured JSON logging with requestId, guarded `/ops/metrics` snapshot, and periodic uploads cleanup (env-driven retention + interval) to bound temp storage growth.

## Target Feature Set
- Single source of truth for import pipeline.
- Idempotent uploads with `uploadId`.
- Authn/z + rate limits on uploads and parse-report.
- Metrics/audit trail + temp-file retention policy.
- Full preset validation and header mapping UI.
- CI coverage: integration for uploads, parse-report streaming, idempotency.

## Gap Log (living)
- G1: Dual pipelines -> inconsistent validation/snapshots. **Resolved (WS1)**
- G2: No idempotency store for uploads. **Resolved (WS2)**
- G3: No auth/rate-limit on upload/report endpoints. **Resolved (WS3)**
- G4: Limited observability/audit/retention. **Resolved (WS4)**
- G5: Tests missing for integrated import + parse-report streaming + idempotency. **Mostly covered; observability metrics test added; keep adding as WS4 expands.**

## Prioritized Workstreams
1) Consolidate upload/import flow (one pipeline). **Done (WS1)**
2) Add idempotency + audit trail. **Done (WS2)**
3) Harden endpoints (auth, rate-limit, limits, error schema). **Done (WS3)**
4) Observability & retention (metrics, temp-file cleanup, rotation cadence, structured logs). **Done (WS4)**
5) Tests/CI (integration + idempotency + parse-report streaming + observability). **Ongoing**

## Per-Workstream Template (fill for each)
- Objective & success criteria
- API contract changes
- UX changes
- Data/model changes
- Rollout/validation steps
- Test cases

## Workstream 1: Consolidate upload/import flow (plan)
- Objective: single import pipeline using IntegratedQuestionManager so validation, merge strategies, and parse snapshots are consistent across all uploads (including multipart UI uploads).
- Approach: keep `/api/upload-csvs` contract but delegate processing to IntegratedQuestionManager per uploaded file (read file -> importFromCSV with preset/headersMap/options), aggregate summary, persist question bank, and update `lastImportParseSnapshot` for parse-report download.
- Success criteria:
	- All uploads (single/multi) pass through IntegratedQuestionManager; no divergent validation paths remain.
	- Preset + headersMap honored; merge strategies behave as before; question_bank persistence unchanged.
	- Parse-report download returns the latest snapshot from the consolidated flow.
	- Backward compatibility: existing clients/tests continue to work; API shape unchanged.
- API contract changes: none breaking; add optional `uploadId` passthrough; server continues to accept `options`, `preset`, `headersMap` in multipart form.
- UX changes: none; existing ConfigurationPanel upload UI continues to call `/api/upload-csvs`.
- Data/model changes: reuse existing question_bank format; append uploads metadata as today.
- Rollout/validation steps:
	1) Implement delegation from upload endpoint to IntegratedQuestionManager; retire duplicate parsing in uploadProcessor.
	2) Ensure parse-report endpoint reads the latest snapshot produced during uploads.
	3) Run regression tests with existing CSV fixtures; verify question_bank diffs are nil.
	4) Verify parse-report download succeeds after upload.
- Test cases:
	- Multipart upload with preset=auto and headersMap provided → import succeeds; summary counts correct.
	- Missing required headers (strict vs lenient) propagates expected errors but no crash.
	- Multi-file upload aggregates processed/added/updated/skipped; question_bank updated once.
	- Parse-report download returns JSON with snapshotRowLimit respected and temp file deleted post-stream.
	- Idempotency placeholder: repeated upload with same uploadId does not double-add (once implemented in WS2).

	## Workstream 2: Idempotency + audit (plan & status — completed)
	- Objective: prevent duplicate processing on client/server retries and create an auditable trail of uploads.
	- Approach: accept client `uploadId` on `/api/upload-csvs`; persist an `uploadRecords` store keyed by uploadId with status, counts, checksum, and timestamp; short-circuit repeated uploads; append audit log entries (JSON lines) for each attempt/outcome.
	- Status: Completed (Jan 2026). Artifacts: `uploads/idempotency.json`, `uploads/audit.log`, file-level hashes, UI/API uploadId generation, server short-circuit on duplicate uploadId.
	- Success criteria:
		- Replaying the same `uploadId` is idempotent (no duplicate question additions; same summary returned quickly).
		- Audit log contains uploadId, filename(s), preset/headersMap used, row counts, status, error details if any.
		- Backward compatibility: requests without uploadId still work; defaults prevent cross-user collisions (e.g., prefix with session token or UUID client-side).
	- API contract changes: allow/encourage client-provided `uploadId` (UUID). Optional server-generated UUID when absent. No breaking changes to multipart fields.
	- Data/model changes: add `uploads/audit.log` (JSONL) and `uploads/idempotency.json` to persist upload records; ensure rotation/retention configurable.
	- Rollout/validation steps:
		1) Add uploadId plumbing (APIService/ConfigurationPanel -> server -> IntegratedQuestionManager options).
		2) Implement idempotency store + short-circuit path; include checksum/hash of uploaded content for safety.
		3) Emit audit entries for start/success/failure; ensure temp files cleaned when short-circuiting.
		4) Add integration tests for retry scenarios (same uploadId vs different uploadId) and audit log content.
	- Test cases:
		- First upload with uploadId processes and writes record; second upload with same uploadId returns cached summary and does not mutate question bank.
		- Different uploadId with identical file processes normally (no global dedupe across IDs).
		- Audit log lines include uploadId, filename, preset, headersMap, counts, status, error when applicable.
		- Failure mid-stream still writes a terminal audit entry and leaves consistent idempotency state.

	## Workstream 4: Observability & retention (plan & status — completed)
	- Objective: provide visibility into upload/parse health and bound storage growth for audit/idempotency/temp artifacts.
	- Approach: structured JSON logs with requestId, lightweight metrics counters, guarded `/ops/metrics`, and periodic uploads cleanup using env-driven retention/interval plus existing rotation/pruning knobs.
	- Status: Completed (Jan 2026). Artifacts: `src/services/observability.cjs`, metrics endpoint, requestId middleware, cleanup scheduler, env knobs (`REQUEST_LOG_ENABLED`, `TEMP_RETENTION_DAYS`, `TEMP_CLEAN_INTERVAL_MS`).
	- API contract changes: optional `x-request-id` echoed; `/ops/metrics` guarded by upload API key.
	- Data/model changes: in-memory metrics snapshot (uploads success/failure/reuse, parse-report downloads, auth/rate-limit hits, cleanup counts); structured logs emitted for key events; temp-file cleanup retention defaults applied.
	- Rollout/validation steps:
		1) Add structured logging wrapper (timestamp, requestId, route, status, duration, uploadId) with toggleable verbosity. **Done**
		2) Emit metrics and expose via `/ops/metrics` guarded by API key. **Done**
		3) Implement temp/upload dir cleanup job with age cap; reuse rotation knobs; document defaults. **Done**
		4) Wire configuration to env + docs; ensure safe defaults for prod/test. **Done (defaults logged in server env constants).**
	- Test cases:
		- Log lines produced for success/failure paths include requestId, uploadId, status, duration. **Manual/console validation**
		- Metrics counters increment for success/failure/reuse/download; exposed snapshot matches observed traffic in tests. **Covered in observability metrics unit test.**
		- Temp-file cleanup removes files older than threshold while preserving current uploads; rotation/pruning respects limits. **Covered by scheduler logic; add integration if needed.**
		- Config parsing tolerates missing envs by falling back to safe defaults. **Defaults set in server constants.**

## Testing Matrix (minimum)
- Unit: preset validation, headersMap normalization, merge strategies.
- Integration: multipart upload with preset+headersMap; import idempotency; parse-report download stream.
- Regression: existing CSV fixtures yield unchanged results.
- Negative: missing required headers (strict vs lenient), oversized file, unauthenticated upload.

## Rollout & Ops
- Use feature flag/staged rollout if needed.
- Metrics: uploads success/fail, parse errors, report downloads.
- Playbook: temp-file cleanup cadence; audit log rotation.

## Hygiene
- Keep this file as single source; update after each workstream.
- Link PRs and test evidence to each gap closure.
