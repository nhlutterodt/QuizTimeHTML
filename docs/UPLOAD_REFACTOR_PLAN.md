
# Upload Handler Refactor Plan

## Purpose

This document explains a safe, testable refactor of the large `/api/upload-csvs` handler in `server.js`. The goal is to reduce cognitive complexity, improve testability, and make the upload flow easier to maintain while preserving current functionality (headersMap, preset, merge strategies, strictness, backups).

## Scope

- Extract the upload pipeline into a new module: `src/services/uploadProcessor.js`.
- Replace the monolithic handler in `server.js` with a concise orchestrator that delegates to `uploadProcessor`.
- Add unit tests for the new helpers and a small integration test for the full endpoint.
- Keep existing behavior and metadata (backups, upload records, mergeStrategy semantics).

## Assumptions

- The repository uses plain Node/Express (CommonJS) and already provides `parseCSVContent`, `convertToQuestionFormat`, `createBackup`, and `saveQuestionBank` functions available in `server.js`.
- Client now sends `options` JSON and may include `headersMap` and `preset` either inside `options` or as top-level form fields; `APIService` appends them to FormData.
- Minimal surface changes to public behavior required; goal is internal reorganization.

## Checklist (requirements -> status)

- Extract helper functions into `src/services/uploadProcessor.js` — Planned
- Replace handler with orchestrator in `server.js` — Planned
- Keep headersMap/preset support working (server applies mapping) — Planned
- Use `for-of` loops, optional chaining, and remove empty catch blocks — Planned
- Add unit tests and one integration test — Planned
- Run lint/static checks and reduce cognitive complexity warnings — Planned

## Small contract (helpers)

- Function: `processFile(file, options, uploadId)`
  - Input: file object (multer), options (object), uploadId (string)
  - Output: `Promise<FileDetail>` where `FileDetail` = `{ filename, processed, added, updated, skipped, errors }`
  - Errors: resolved into `FileDetail.errors`; throws only for catastrophic IO errors

- Function: `orchestrateUpload(files, options)`
  - Input: files array, options
  - Output: `Promise<{ uploadId, summary, detailsPerFile }>`
  - Errors: throws upward for unrecoverable failures (persist failure, disk error)

## Design & decomposition (helpers to create)

1. `parseCSVContent(csvText)`
   - Keep current implementation (move to module if needed).

2. `applyHeadersMapToRows(rows, headersMap)`
   - Case-insensitive mapping. Returns `{ headers, rows }`.

3. `computePresetRequiredHeaders(preset)`
   - For `multiple_choice`, `true_false`, `short_answer`, etc. Returns array.

4. `validateHeaders(headers, requiredHeaders, strictness)`
   - Returns `{ ok: boolean, missing: string[] }`.

5. `convertAndValidateRow(row, uploadContext)`
   - Wraps `convertToQuestionFormat` + per-row validation (empty question, ID assignment deferred to orchestrator).

6. `processFile(file, options, uploadId)`
   - Reads file, parses CSV, applies headersMap, validates headers, iterates rows using `for-of`, collects file-level detail object. Honors `strictness` (abort on first error in strict mode).

7. `orchestrateUpload(files, options)`
   - Creates uploadId, iterates `files` with `for-of` calling `processFile`, aggregates summary, persists uploadRecord and saves question bank.

## Where to place code

- New file: `src/services/uploadProcessor.js` — exports `orchestrateUpload` and small helpers (most helpers can be exported individually for unit testing).
- Update `server.js` upload handler to call `orchestrateUpload(req.files, options)` and return the result.

## Error handling and cleanup

- File-level parsing/row errors should be collected into the `detailsPerFile.errors` array.
- If `strictness === 'strict'`, the pipeline should stop processing that file (or entire upload, matching current behavior) and return an informative error.
- Always attempt to `fs.unlink()` uploaded temp files in a finally block; do not swallow IO errors — log them.
- For catastrophic persistence errors (saveQuestionBank failure), throw an error so `server.js` returns 500 and cleanup runs.

## Testing strategy

- Unit tests (Jest or the project's test runner)
  - `applyHeadersMapToRows` with mixed-case headersMap.
  - `validateHeaders` with different strictness settings.
  - `convertAndValidateRow` for happy and failing rows.
  - `processFile` with a small CSV sample (2-3 rows) and headersMap applied.

- Integration test
  - Use `supertest` or a simple HTTP POST test to `/api/upload-csvs` with one CSV and a `headersMap` form field; assert `summary.added` increases and no errors returned.

## Edge cases to cover

- `headersMap` maps to existing canonical field names not present in CSV (should still work).
- Duplicate headers after mapping — decide deterministic behavior (first wins) and document it.
- Empty files or files with inconsistent row lengths — collect row errors and continue unless strict.

## Quality gates

1. Unit tests for each helper pass.
2. Integration test for endpoint passes.
3. Static analyzer (get_errors) no longer reports high cognitive complexity on upload handler.
4. Manual E2E: create headersMap with SchemaCreator, upload sample CSV, verify question bank updated.

## Timeline & estimate

- Implementation (helpers + server wiring): 45–75 minutes
- Unit tests + integration test: 30–45 minutes
- Lint fixes & iterations: 15–30 minutes
- Total: ~1.5–2.5 hours depending on test/fix cycles

## Rollback & safety

- Keep `createBackup()` behavior for `mergeStrategy: 'overwrite'` unchanged.
- Commit changes on a feature branch and run tests before merging to `main`.
- If initial run finds regressions, revert the PR and restore `server.js` from git history. Backups of the question bank will be created by existing logic when overwrite strategy is used.

## Deliverables

- `src/services/uploadProcessor.js` with exported helpers and `orchestrateUpload`.
- Updated `server.js` with concise upload orchestrator.
- Unit tests for helpers and one integration test.
- This plan saved as `docs/UPLOAD_REFACTOR_PLAN.md` (you are reading it now).

## Next steps (if you approve)

1. I will implement `src/services/uploadProcessor.js` and the unit tests, then update `server.js` to call it.
2. Run static checks and tests, fix any issues, and report results.

If you prefer to review changes first, I can prepare a draft patch/PR and wait for your approval before applying code changes.

---
Last updated: 2025-09-12
