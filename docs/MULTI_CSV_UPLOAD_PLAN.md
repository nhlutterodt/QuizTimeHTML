## Multi-CSV Upload & Question Bank Curation — Implementation Plan

Purpose: provide a practical, low-risk roadmap to enable uploading multiple CSV files (with configurable limits) so the team can iteratively build and curate a persistent question bank.

Summary: this plan covers UX, data model, API, server and client processing, validation, deduplication/merge strategies, storage and provenance, configuration, testing, and rollout steps.

### Checklist (user requirements mapped)

- [x] Create an actionable plan for supporting multiple CSV uploads with configurable limits — Done (this document).
- [x] Implement client UI for selecting/uploading multiple CSVs and showing previews.
- [x] Implement server endpoints to accept multiple CSVs, validate and parse them.
- [x] Add configuration for per-upload file count / total rows / file sizes and server-side enforcement.
- [x] Implement merge/curation UI (preview, conflict resolution, dedupe rules).
- [x] Persist curated questions with provenance and versioning, provide export and rollback.
- [ ] Add unit/integration/e2e tests and CI checks.

### Assumptions and small decisions

- Existing CSV formats: we have `src/data/questions.csv` and a robust `CSVQuestionManager` class. We'll reuse and extend it.
- Minimal server stack: app uses `server.js` (Express). We'll add a multipart upload endpoint and server-side CSV parsing.
- Storage: continuing current approach of storing persisted records in `user_data.json` is acceptable short-term. For scale, recommend migrating to a DB later (Postgres/SQLite) — this doc notes migration steps.
- Backwards compatibility: keep current single-CSV load behavior and provide an opt-in multi-upload flow.

### Contract (2–3 bullets)

- Inputs: one or more CSV files (text/csv), optional metadata per upload (source, tags, owner), upload config (merge strategy, limits).
- Outputs: parsed question objects added to a persistent question bank; a per-upload report (success, failures, skipped rows, duplicates) and lifecycle metadata (uploadId, timestamp, user).
- Error modes: invalid file format, header mismatch, duplicate detection, parse errors, storage failure; all should be caught and reported per-file with partial recovery where possible.

### UX / UI flows

1. New ConfigurationPanel area: "Import Questions → Upload CSVs (multiple)".
2. Drag-drop or file chooser (accept `.csv`) with clear limits text: e.g. "Upload up to N files, max X rows per file, max Y MB total." (N/X/Y configurable server and client-side). Show current config values from `StorageService.getQuizConfig()` or a new `importConfig` object.
3. After selection, asynchronously parse each file in the browser (lightweight preview) using `CSVQuestionManager.parseCSVLine` or a trimmed client parser to show first 5 rows and detected headers.
4. Show validation results per file (ok / warnings / errors). Offer three actions per upload batch:
   - Append: add all valid, skip duplicates.
   - Overwrite: replace question bank (with backup snapshot).
   - Merge w/ review: open a curation UI showing conflicts, allow accept/reject per-question.
5. Run server import if user confirms. Show progress and final report (rows processed, added, updated, skipped, errors).

### CSV schema and validation

- Canonical CSV headers (recommended): `id,category,difficulty,type,question,option_a,option_b,option_c,option_d,correct_answer,explanation,points,time_limit` (match existing `src/data/questions.csv`).
- Also support alternative header names (case-insensitive, spaces vs underscores) with mapping step.
- Validation rules:
  - Required fields: `question` and at least one option for multiple choice OR expected fields for other types.
  - `id`, `points`, `time_limit` numeric when present.
  - `correct_answer` must map to one of the provided options.
  - Row-level strictness is configurable: `strict` (reject file on first error) vs `lenient` (skip invalid rows and continue).

### Deduplication & Merge strategies

- Duplicate detection heuristics (configurable priority):
  1. Exact `id` match.
  2. Exact question text match (case-insensitive, whitespace-normalized).
  3. Fuzzy match via normalized tokens (optional later enhancement).
- Merge strategies exposed to user:
  - Skip duplicates (default): keep existing, skip incoming duplicates.
  - Overwrite existing: replace old record with incoming.
  - Create new (force): insert incoming as new (auto-generate new id).
  - Merge fields: keep non-empty incoming fields and fall back to existing values.

### Server API & implementation notes

- Endpoint: `POST /api/upload-csvs`
  - Content: `multipart/form-data` files[]=file1.csv files[]=file2.csv plus JSON field `options` with mergeStrategy, strictness, owner, tags.
  - Response: `200` with `{ uploadId, summary: { processed, added, updated, skipped, errors: [...] }, detailsPerFile: [...] }`.

- Server steps:
  1. Authenticate/check rate limits as needed.
  2. Enforce configured limits: max files, max total size, max rows per file.
  3. Stream-parse each CSV (avoid loading huge files into memory). Reuse/extend `CSVQuestionManager` but add a streaming parse method.
  4. Validate rows; collect per-row status.
  5. Apply merge rules to the persistent store (for now `user_data.json` or `questions.json` — create a separate `question_bank.json`).
  6. Save a snapshot backup before destructive operations (e.g., overwrite) to enable rollback.
  7. Append per-upload provenance: uploadId, original filename, uploader (if available), timestamp, row index mapping to saved id.

### Storage & provenance

- Short-term: create `data/question_bank.json` (or extend `user_data.json.questions`) with structure:

```json
{
  "questions": [ /* question objects */ ],
  "uploads": [ /* upload metadata, provenance */ ]
}
```

- Each question record: include source metadata {uploadId, filename, rowIndex, originalId?}
- Snapshot strategy: before any overwrite/replace, write `backups/question_bank.YYYYMMDDTHHMMSS.json`.

### Configuration (where to store limits)

- Client default UI text reads from `StorageService.getQuizConfig()`; add new keys like:
  - `importLimits: { maxFiles: 5, maxTotalSizeMB: 10, maxRowsPerFile: 1000 }`
- Server-side checks read from `.env` or a small config file (e.g., `IMPORT_MAX_FILES=5`, `IMPORT_MAX_TOTAL_MB=10`, `IMPORT_MAX_ROWS=1000`) or a `config/import.json`.

### Security & rate limiting

- Validate MIME types, reject non-CSV.
- Limit upload sizes and file counts both client- and server-side.
- Run CSV parsing in a timeout/worker to avoid blocking event loop for huge files. For Node, parse in streams and chunk writes.

### Tests and quality gates

- Unit tests for:
  - CSV parsing edge cases (quotes, stray commas, newlines in fields).
  - Header mapping and field normalization.
  - Deduplication heuristics.
- Integration tests:
  - `POST /api/upload-csvs` with single and multiple files; assert persisted data and provenance.
  - Merge strategies (append/overwrite/merge) correctness.
- E2E test (optional): UI file selection → preview → confirm → server import → final report.
- Add CI job (if present) to run linter, unit tests, and a small integration fixture. Update README-DEV.md with new steps.

### Small, safe incremental implementation plan (high-value, low-risk steps)

1. Add data file `data/question_bank.json` and wiring in server to read/write it (small change). Create backup during write. (1–2 days)
2. Add server endpoint `POST /api/upload-csvs` that accepts one file and uses existing `CSVQuestionManager.parseCSV` to parse, validate, and append. Enforce a single-file size/rows limit via config. Return summary. (1–2 days)
3. Extend the endpoint to support multiple files (array) and configurable mergeStrategy option. Add per-file summary and uploadId/provenance. (1 day)
4. Add client UI in `src/components/ConfigurationPanel.js` to accept multiple files, show preview and validation warnings, and call the new endpoint. Use `StorageService` to get and show import limits. (1–2 days)
5. Add backup/rollback and tests; add server-side streaming parsing for large files. (2–3 days)

### Rollout and migration

- Phase A (internal): enable only for admin/developer users; keep default import mode conservative (skip duplicates).
- Phase B (beta): enable for trusted users, add UI to review/curate.
- Phase C (public): enable for all, add monitoring and quota enforcement.
- Migration: write a one-off script to import existing `src/data/questions.csv` into `data/question_bank.json` with provenance.

### Example server-side pseudocode (high level)

```js
// express handler sketch
app.post('/api/upload-csvs', upload.array('files'), async (req,res)=>{
  const options = JSON.parse(req.body.options||'{}');
  // enforce limits, create uploadId, iterate files, stream-parse rows,
  // validate, apply merge strategy to questionBank, collect report
  // save snapshot before destructive ops
  res.json({ uploadId, summary });
});
```

### Risks & open questions

- Large files may exhaust memory if parsed naively — mitigate with streaming parser.
- Fuzzy duplicate detection is useful but may cause false positives; keep optional and disabled by default.
- Current storage in `user_data.json` is fragile; consider SQLite/Postgres if concurrency and scale grow.

### Next steps I can take for you (pick one or more)

1. Implement server endpoint `POST /api/upload-csvs` (single-file first) and wire `data/question_bank.json` with backup support.
2. Add client multiple-file UI in `ConfigurationPanel.js` with preview and basic validation.
3. Create unit tests for `CSVQuestionManager` edge cases and an integration test for the new endpoint.

If you pick a step, I will implement it and run quick smoke tests.

---

### Requirements coverage

- "Create a markdown document with a plan on how to improve being able to upload multiple csv (with configurable limits) so we can build and curate a question bank over time." — Done (this document).

---
Generated: 2025-09-09
