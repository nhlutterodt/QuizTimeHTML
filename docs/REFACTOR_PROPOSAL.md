
Refactor Proposal — CSV import, parse-reporting, and integration
================================================================

Purpose
-------

This document captures the goals, scope, safety net, and acceptance criteria for a deliberate, professional refactor of the CSV import and integration path (notably `EnhancedCSVManager`, `IntegratedQuestionManager`, server endpoints, and UI hooks).

High-level goals
----------------

- Make the CSV import codebase easier to reason about, test, and maintain.

- Preserve existing behavior and backward compatibility for current CSV imports.

- Improve observability: row-level parse reporting, compact preview for UI, and scalable server-side export.

- Reduce duplication: single canonical import path used by server and any CLI/test harnesses.

- Add a clear testing matrix and CI gates before merging refactor changes.

Scope (in/out)
--------------

In-scope:

- `src/data/EnhancedCSVManager.js` — parsing, normalization, snapshot capture.

- `src/services/IntegratedQuestionManager.js` — merging, duplicate detection, export API.

- `server.js` download/export endpoints and file streaming behavior.

- `src/components/QuizApp.js` UI download hook and event handling.

- Tests, docs, and CI config for the above.

Out-of-scope:

- Major UI redesign of the quiz UX.

- Storage persistence model overhaul (beyond small safety improvements).

Contract (tiny API contracts to preserve)
----------------------------------------

Each important function should document these bullets (inputs / outputs / errors):

- `EnhancedCSVManager.parseCSV(input, options)`

  - Inputs: `string|Buffer|File`, options `{ snapshotRowLimit?: number, headersMap?: object }`

  - Outputs: `{ parsed: Array<Question>, errors: Array<RowError>, warnings: Array<RowWarning>, lastParseSnapshot: Snapshot }`

  - Errors: throws only on catastrophic failure (invalid bytes, OOM). Row-level validation is returned in errors array.

- `IntegratedQuestionManager.importFromCSV(input, options)`

  - Inputs: same as above plus `{ mergeStrategy?: 'skip'|'overwrite'|'merge', snapshotRowLimit?: number }`

  - Outputs: `{ added: number, updated: number, skipped: number, lastParseSnapshot: Snapshot }`

  - Errors: returns result and never throws for row validation; throws only for unexpected system errors.

- `IntegratedQuestionManager.exportLastParseReport()`

  - Server behavior: creates temp-file path and returns metadata so caller or server route can stream the file.

  - Browser behavior: returns `Blob/ObjectUrl`.

  - Always returns a result object describing type: `'server' | 'browser' | 'raw'` and the filename.

Edge cases & non-goals
----------------------

- Large CSV import (>100k rows) may need chunked streaming on server; this refactor will document and add tests for large-batch behavior but defer a full streaming rewrite until validated.

- Duplicate detection fuzzy matching (levenshtein / semantic) is out-of-scope but can be listed as an enhancement item.

Quality gates & acceptance criteria
----------------------------------

Before merging any refactor:

1. Local build passes (no syntax errors).

2. Lint runs clean (or has a documented, agreed exception list).

3. Unit tests: parser (happy path + 3 edge cases), import merge strategies (happy path + duplicate handling), export route test that creates and streams temp-file.

4. Integration smoke test: import sample CSV used by existing tests; UI button still triggers download endpoint.

5. Document changes in `docs/` and update `README-DEV.md` to include the new workflow.

Rollback & safety
-----------------

- All refactors must be done behind feature branches and PRs.

- Keep backward-compatible API surface and add deprecation notices; do not remove public exports without a migration plan.

- Add a fallback path in `server.js` that can use the legacy CSV parsing code if the new path reports failure (short-term).

Suggested phased plan (short)
-----------------------------

Phase 0 — Documentation & tests (this step)

- Produce API docs and refactor proposal. Add unit tests scaffolding for current behavior.

Phase 1 — Small refactors (low-risk)

- Extract parseSnapshot creation out of `parseCSV` into a small helper with unit tests.

- Reduce cognitive complexity in the largest helper functions (split into smaller units).

- Add a centralized "CSV import facade" used by server upload APIs.

Phase 2 — Behavioral improvements & hardening

- Add robust streaming for very-large imports (server-mode).

- Add temp-file retention policy or persist reports for audit.

Phase 3 — Cleanup & polish

- Lint, complexity reduction, and documentation complete.

Next actions
------------

1. Review this proposal and the companion API reference.

2. Approve scope and acceptance criteria or request edits.

3. I will then scaffold unit tests and create small, focused PRs for each Phase 1 item.

Contact
-------

For questions, respond here or open a PR discussion referencing this file.
