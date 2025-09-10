
CSV Upload — Schema Visibility & Selection (Baseline Plan)
=========================================================

Purpose
-------

Provide a baseline design and implementation plan for adding schema visibility and selectable presets to the CSV upload/import flow. This file is the single source of truth for the feature plan and will be iterated on in PRs.

Goals

Project context (how this maps to the repo)
------------------------------------------

This plan must tie directly to the current codebase. Below are the primary files, conventions, and constraints to use when implementing changes.

- CSV parser: `src/data/EnhancedCSVManager.js` — current authoritative CSV import logic. This is the first file to extend to accept `preset` and `headersMap`, and to emit the enhanced `lastParseSnapshot` (compact + full).
- Integration layer: `src/services/IntegratedQuestionManager.js` — orchestrates merges into the question bank. Update this to accept import `preset` and to store `lastImportParseSnapshot` for export.
- Schema definition: `src/models/QuestionSchema.js` — canonical field definitions and validation helpers. Reuse and extend this to include preset-specific validation rules and metadata.
- Server endpoints: `server.js` — existing upload endpoints and the parse-report download endpoint live here. Add/extend upload handling to accept multipart form fields `preset` and `headersMap` and to call the IntegratedQuestionManager facade.
- UI integration: `src/components/QuizApp.js` (and small components under `src/components/*`) — add schema selector and header-mapping preview UI. Keep UI changes minimal and unobtrusive.
- Storage: repo persists question bank to `data/question_bank.json` and uses services in `src/services/StorageService.js` and `src/services/QuestionService.js`. Respect existing storage formats and IDs.
- Tests & scripts: add unit tests under `src/tests/` or `tests/` and use `scripts/` (existing test scripts) for quick local validation. There are existing test CSV samples under `src/data/questions.csv`, `test-questions.csv`, and `questions_sample.csv` to use for integration tests.

Constraints & non-goals specific to this repo
--------------------------------------------

- Preserve existing JSON storage format in `data/question_bank.json` and avoid schema-breaking changes.
- Keep the public HTTP API stable: uploads should continue to work when `preset=auto` or when `headersMap` is omitted.
- Avoid large refactors to UI frameworks — the app uses plain ES module components; add minimal DOM-friendly UI.
- Server environment is Node + Express (no external DB); large reports should use OS temp-files and streaming as in existing parse-export flow.


Phase 1 implementation mapping (concrete tasks)
----------------------------------------------

When executing Phase 1 (scaffold + API surface), make these minimal edits:

- `src/data/EnhancedCSVManager.js`
  - Add optional parameters `preset` and `headersMap` to `parseCSV`.
  - Return `lastParseSnapshot` regardless of preset.

- `src/services/IntegratedQuestionManager.js`
  - Update `importFromCSV` signature to accept `preset` and `headersMap`.
  - Surface `lastImportParseSnapshot` via `exportLastParseReport()`.

- `server.js`
  - Accept multipart uploads with `preset` and `headersMap` (JSON string).
  - Delegate to `IntegratedQuestionManager.importFromCSV(...)`.

- `src/components/QuizApp.js` (UI)
  - Add schema selector dropdown and a small header-mapping preview modal or panel.
  - Send `preset` and `headersMap` with upload requests.

- Tests
  - Add unit tests for header normalization and preset validation under `src/tests/`.

Acceptance mapping (how requirements map to code)
-----------------------------------------------

- Base required fields enforced -> `QuestionSchema.js` + `EnhancedCSVManager.parseCSV` validation step.
- Preset selection UI -> `QuizApp.js` + small UI component.
- Header mapping preview -> `QuizApp.js` UI + server-side `headersMap` parameter consumed by `EnhancedCSVManager`.
- Compact parse preview + downloadable report -> existing parse-report flow (server + `IntegratedQuestionManager.exportLastParseReport`).

- Preserve backward compatibility via an `auto` preset and flexible header mapping.

- Surface row-level errors/warnings (compact preview + downloadable full report) as implemented in the parse-report flow.

Checklist (requirements)
------------------------

- [ ] Base required fields enforced for every import.

- [ ] Preset selection mechanism (Auto / MCQ / Short answer / True-False / Numeric).

- [ ] Preset-specific required/optional fields and normalization rules.

- [ ] Header mapping preview and manual override UI.

- [ ] CSV parser accepts `preset` and `headersMap` and validates rows accordingly.

- [ ] Compact parse preview + downloadable full report available after validation.

- [ ] Unit tests and integration smoke tests for parsing and import.


Preservation Requirements (must preserve)
-----------------------------------------

These items are absolutely required to remain working and unchanged by the refactor. Any change to these must be explicitly reviewed and approved.

Parsing behavior and existing CSV compatibility
---------------------------------------------

- The current CSV parsing semantics in `src/data/EnhancedCSVManager.js` must continue to accept the existing CSV variants used in the repo's test fixtures (`src/data/questions.csv`, `test-questions.csv`, `questions_sample.csv`).
- Header normalization behavior (alias mapping, trimming, quoting rules) must be preserved. Any additional alias rules must be additive only.

Parse snapshot contract
-----------------------

- The `lastParseSnapshot` shape and its presence in parse/import results must be preserved (timestamp, headers, totalRows, totalErrors, totalWarnings, errors[], warnings[], compactErrors[]). The compact vs full behavior must remain: compact preview (default N) and full export via parse-report.

Non-fatal row-level validation
-----------------------------

- Row-level validation failures must continue to be reported in `errors`/`warnings` arrays and not cause whole-import crashes. The API must not change semantics to throw on row validation.

Import merge strategies and ID stability
-------------------------------------

- The `IntegratedQuestionManager` merge strategies (`merge`/`skip`/`overwrite`) must be preserved and respected by new code paths.
- Stable ID generation for existing rows (if system generates ids) must not change for identical input rows, to avoid duplicate detection regressions.

Storage format
--------------

- The on-disk JSON schema for `data/question_bank.json` must remain compatible. If additional metadata is added, it must be namespaced and backwards-compatible.

Server endpoints and download behavior
------------------------------------

- Existing server endpoints must continue to work for existing clients. The new `preset` and `headersMap` inputs are optional — absence must preserve legacy behavior.
- Parse-report export must continue to stream from server temp-file and delete temp-file after streaming (no big memory buffering).

UI behaviors
-----------

- The existing UI flows (upload endpoint, parse-report download button in `QuizApp.js`) must continue to function. Adding the schema selector and mapping UI must be additive and not remove existing controls.

Test harnesses and scripts
-------------------------

- Existing scripts under `scripts/` and test harnesses must continue to run without modification. New tests must be added but not replace current ones.

Acceptance tests (minimal, automated)
------------------------------------

- Run existing test suite and confirm no regressions.
- Run a sample import for each existing CSV fixture and assert identical `added/updated/skipped` counts as before the change.
- Verify `lastParseSnapshot` fields exist and compactErrors length is limited by `snapshotRowLimit`.
- Simulate parse-report download and confirm server streams and temp-file is deleted after successful download.

Non-goals (do not do in this refactor)
------------------------------------

- Do not change the persistence layer to a database or alter `question_bank.json` structure in incompatible ways.
- Do not remove or alter existing public APIs without versioning and migration steps.


Canonical field model
---------------------

Base (always-required) fields

- `question` (string)

- `type` (string) — optional when preset provided; used when auto-detected

Recommended metadata (optional)

- `id` — stable string id (if omitted system may generate)

- `tags` (comma-separated)

- `category`

- `difficulty` (e.g., easy|medium|hard)

- `points` (number)

- `explanation`

- `source`

Preset definitions (summary)
---------------------------

- multiple-choice

  - Required: at least 2 option columns OR single `options` column (delimited)

  - Required: `correct_answer` (option key/index/text)

  - Normalize: accept option columns (option_a..option_d) or `options` string and produce array of options

- short-answer (text)

  - Required: optional `answer` depending on open-endedness

- true-false

  - Required: `correct_answer` (true|false)

- numeric

  - Required: `correct_answer` (number)

  - Optional: `tolerance` (number)

Header normalization and aliasing rules
--------------------------------------

- Normalize headers: trim, lowercase, replace spaces with underscores.

- Known aliases (non-exhaustive):

  - `q`, `question_text` -> `question`

  - `opt_a`, `option_a`, `a` -> `option_a`

  - `ans`, `answer_text`, `correct` -> `correct_answer`

  - Option column detection: match /^opt(ion)?[_-]?[a-z0-9]+$/i or `option_1, option_2` series.

API contract changes (server-side)
----------------------------------

Upload endpoint (existing or new) should accept multipart/form-data with:

- `file` (CSV)

- `preset` (string) — one of `auto|multiple-choice|short-answer|true-false|numeric`

- `headersMap` (JSON string, optional) — explicit map of CSV headers to canonical fields

- `options` (JSON string, optional) — { snapshotRowLimit, mergeStrategy }

Behavior

- Parse CSV using `EnhancedCSVManager.parseCSV(input, { headersMap, snapshotRowLimit, preset })`.

- Validate each row against base + preset rules. Populate `errors` and `warnings` arrays and set `lastParseSnapshot`.

- If `includeFullParseReport` requested, persist or generate full JSON report (same as current export flow).

Client-side UX (minimal scaffold)
--------------------------------

- Schema selector dropdown (default `Auto`).

- "Show required fields" toggle that shows the base + preset fields.

- Header mapping preview: table with CSV headers (left) and mapped canonical field (right, editable dropdown).

- Upload button: sends file + preset + headersMap to server; after response shows compact parse preview and link to download full report.

Validation & error UX
---------------------

- Keep server behavior non-fatal for row-level issues (report in `errors`).

- Show compact preview (first N error rows) with guidance for fixing header mappings.

- Provide a clear message for missing required preset fields (pre-upload check when possible).

Edge cases & notes
------------------

- Auto preset: implement heuristics (presence of option columns → MCQ, boolean column → TF) and require user confirmation when ambiguous.

- Support both multiple option columns and single-delimited `options` column.

- Normalize `correct_answer` provided as text/index/key to canonical format.

- For very large CSVs keep `snapshotRowLimit` low and rely on streamed/downloadable full report.

Testing matrix (minimum)
------------------------

- Unit tests

  - Header normalization and alias mapping

  - Preset validation: MCQ with multiple columns, MCQ with single `options` column, TF, numeric

  - Correct answer normalization (index vs text)

- Integration tests

  - Upload flow: preset=auto with an MCQ CSV -> confirm import + parse snapshot

  - Upload with headersMap override -> ensure mapping used

Rollout plan
------------

Phase 0 — Docs & tests (this file)

Phase 1 — Small UI scaffold (schema selector, header preview) + API change to accept `preset` and `headersMap` and minimal server validation

Phase 2 — Implement preset validations in `EnhancedCSVManager` and unit tests

Phase 3 — Integrate with full parse-report export flow and streamable downloads; polish UI and add end-to-end tests

Next actions (pick one)
-----------------------

- A: I implement Phase 1 now (small PR: UI scaffold + server API surface + tests). I will run tests locally and open a PR.

- B: We iterate on this file — add/remove presets, change fields — until you approve, then I implement.

Notes
-----

Keep changes incremental and behind feature flags/PR branches. Preserve `auto` behavior to avoid breaking existing imports.

---
Last updated: 2025-09-10

Professional integration considerations
-------------------------------------

This section expands the plan with operational and engineering practices expected for production-grade integration.


API & Contract Discipline

Strong contract: document the exact request and response JSON schema for the upload API, including `preset`, `headersMap`, `options`, and error payload shapes. Add JSON Schema files under `docs/schemas/` so clients and tests can validate programmatically.

Versioning: add an optional `api_version` parameter or version the endpoint path (e.g., `/api/v1/upload`) so future breaking changes are explicit.

Idempotency: support an `uploadId` client-provided idempotency key for retries; server must store short-lived idempotency state to avoid duplicate imports.

Backwards Compatibility & Migration

Preserve current behavior for `preset=auto` and when `headersMap` is omitted. Any new required fields must be gated behind a version bump.

Migration strategy: if schema changes are required for `question_bank.json`, provide migration scripts and tests under `scripts/migrations/` that can be run during deployment.

Testing & Quality Gates

Unit tests: parser, header aliasing, preset validators, correct-answer normalization. Place tests in `src/tests/unit/`.

Integration tests: end-to-end CSV upload -> import -> storage update -> parse-report. Place under `src/tests/integration/` and run in CI against a lightweight Node server instance.

End-to-end tests: simulate UI flow (upload UI) using a headless browser (Playwright or Puppeteer) in `ci/e2e/`.

Load tests: validate large CSV import behavior (50k+ rows) with sampling; use a small harness (k6 or a Node script) to measure memory and latency.

Test data: add representative CSV fixtures in `tests/fixtures/` covering MCQ, short-answer, TF, numeric, and malformed cases.

PR checks: require unit tests and linters to pass before merge. Add a checklist to PR template referencing these tests.

CI / CD & Release Strategy

CI pipeline (GitHub Actions recommended):

- Steps: install, lint, unit tests, integration tests (start app in background), e2e (optional), build artifact creation.
- Artifacts: packaged server bundle and test reports.

Feature flags: deploy behind a feature flag (env var like CSV_IMPORT_PRESET_V1=true) to test in staging before enabling in prod.

Canary/Gradual rollout: enable feature for a small subset of tenants or traffic before full rollout.

Observability and Monitoring

Metrics: add counters/gauges for uploads (total, success, failures), parse-errors, report-downloads, and average import duration. Emit via a simple in-process metrics collector (Prometheus exposition path) or at least structured logs.

Logs: structured logs for upload events include uploadId, clientIp (if available), preset, fileSize, errorsCount; redact any PII.

Tracing: add lightweight timing/tracing (e.g., OpenTelemetry spans) around parse and import steps for slow-import diagnosis.

Alerts: set alerts for high error rates, elevated parse durations, or large numbers of report downloads.

Security & Privacy

Input validation: reject files larger than a safe maximum (configurable, e.g., 200 MB). Enforce row/column limits to avoid OOM.

Sanitization: strip HTML and script-like content from text fields to prevent injection when content is later displayed.

Secrets detection: scan uploaded CSV for potential secret patterns (API keys, tokens) and either redact or warn — at minimum do not log raw CSV contents.

Access control: the upload and report-download endpoints must validate the requester (session/auth) and only allow authorized users to import or download reports for their organization.

Data residency & retention: document where reports and temp-files are stored and for how long; implement automatic cleanup and retention policy (e.g., delete temp reports after 24 hours).

Performance & Scalability

Streaming parse: for large files, use a streaming parser (line-by-line) and process rows in bounded batches (e.g., 1000 rows) to limit memory usage.

Backpressure & batching: write imports to the question bank in batches and commit periodically to avoid holding large in-memory arrays.

Temp-file handling: write full parse reports to OS temp dir and stream to client; ensure cleanup on success/failure and on process restart (startup cleanup job).

Storage, Retention & Audit

Auditability: maintain an import audit log (append-only) with metadata: uploadId, userId, preset, filename, counts (added/updated/skipped), and timestamp. Store under `logs/imports/` or in a persistent store.

Retention policy: retain parse reports and audit logs for a configurable time window (default 30 days), then rotate/delete.

Error handling, retries & Idempotency

Error payloads: standardize error responses with codes, messages, and optional `details` array for row-level issues. Example: { code: 'PARSE_ERROR', message: 'Row validation failed', details: [{line: 2, message: 'missing id'}] }

Retries: allow safe retry of failed uploads using an `uploadId` idempotency key. For transient errors (disk full, network), provide a retry guidance message.

Rollout, Rollback & Communication

Rollout plan: use feature flags and canary deployment as above. Communicate breaking changes in PRs and release notes.

Rollback plan: provide a one-click rollback path for server deployment and a process to revert recent imports if needed (export current question bank to backups/ timestamped JSON before major changes).

Ownership & Documentation

Code owners: update `CODEOWNERS` to include `src/data/EnhancedCSVManager.js` and `src/services/IntegratedQuestionManager.js` owners so PRs request proper reviews.

Runbook: add a short runbook `docs/runbooks/csv-import-runbook.md` describing how to investigate failed imports, check logs, and recover from partial imports.

API docs: add `docs/schemas/upload-request.json` and `docs/schemas/upload-response.json` and reference them from README.

Acceptance criteria & KPIs
-------------------------

- Correctness: all unit and integration tests pass in CI.
- Reliability: parse error rate < 1% for known-good CSV fixtures; no memory/leak incidents during load tests.
- Performance: average import time for 10k rows < X seconds (define based on environment), parse-report generation should stream and not buffer fully in memory.
- Observability: metrics and logs available and dashboards created for key metrics.

