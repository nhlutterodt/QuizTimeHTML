API Reference — CSV import & parse-reporting
===========================================

This file documents the public interfaces and expected behaviors for the CSV import path and the parse-report export helpers. Use these contracts to write tests and to guide any refactors.

1. `EnhancedCSVManager` (`src/data/EnhancedCSVManager.js`)

---

Purpose: Parse CSV input into normalized `Question` objects, capture row-level validation issues and a `lastParseSnapshot` for UI consumption and export.

Function: `parseCSV(input, options)`

- Parameters:
  - `input`: `string | Buffer | File-like` (CSV content)
  - `options`: object (optional)
    - `snapshotRowLimit?: number` — number of rows to include in the compact snapshot (default: 10)
    - `headersMap?: object` — optional mapping for header aliases
    - `encoding?: string` — character encoding (utf-8 default)

Returns: Promise resolving to an object with these keys:

- `parsed` — Array of normalized question objects
- `errors` — Array of row-level error objects
- `warnings` — Array of non-fatal warnings
- `lastParseSnapshot` — Snapshot object with metadata, errors, and warnings

- Failure modes:
  - Row-validation failures are returned in `errors`. The function should only throw for unrecoverable system errors (invalid binary data, insufficient memory).

Snapshot shape (Snapshot):

```json
{
  "timestamp": "ISOString",
  "headers": ["col1","col2"],
  "totalRows": 123,
  "totalErrors": 10,
  "totalWarnings": 2,
  "errors": [],
  "warnings": [],
  "compactErrors": []
}
```

IntegratedQuestionManager (`src/services/IntegratedQuestionManager.js`)

---

Purpose: Accept parsed questions, merge them into the question bank, handle duplicate detection, and expose export helpers for the last parse report.

Function: `importFromCSV(input, options)`

- Parameters:
  - `input`: `string | Buffer | File-like`
  - `options`: {
      `mergeStrategy?: 'skip'|'overwrite'|'merge'` (default: 'merge'),
      `snapshotRowLimit?: number`,
      `includeFullParseReport?: boolean`
    }

- Returns: Promise resolving to:

  ```json
  {
    "added": 0,
    "updated": 0,
    "skipped": 0,
    "lastParseSnapshot": {},
    "compactParseSnapshot": {}
  }
  ```

- Failure modes:
  - Non-fatal row issues are returned in snapshot; throws only for system errors.

Function: `exportLastParseReport()`

- Behavior:
  - Server environment: writes a JSON file to `os.tmpdir` and returns `{ type: 'server', filename, path }`.
  - Browser environment: returns `{ type: 'browser', filename, blob, url }` for immediate download.
  - Fallback: returns `{ type: 'raw', filename, content }`.
  - The caller must stream or download the file and handle deletion if server-mode was used (server endpoint should delete after streaming).


Server endpoint (`server.js`)

---

Endpoint: `GET /api/parse-report/download`

- Behavior contract:
  - Calls `IntegratedQuestionManager.exportLastParseReport()`
  - If server-mode path is returned: respond with streaming read of the temp-file, set `Content-Disposition` to attachment with filename, set `Content-Type` to `application/json`, and delete temp-file after stream end.
  - If raw content returned: respond with `application/json` and `Content-Disposition` attachment.
  - Status codes: `200` on success; `404` if no report exists; `500` on unexpected errors.


Client integration (`src/components/QuizApp.js`)

---

Button: "Download Parse Report"

- Behavior:
  - Calls `/api/parse-report/download`.
  - On `200`: creates a `Blob` from response and triggers download with suggested filename from response headers (or uses filename from JSON metadata).
  - On non-`200`: shows an informative error dialog using the app's notification system.

Testing suggestions
-------------------

- Unit tests:
  - `parseCSV`: happy path (multiple-choice with options), missing required fields returns RowError, header alias mapping works.
  - `importFromCSV`: merging strategies: `'skip'`, `'overwrite'`, `'merge'` behavior.
  - `exportLastParseReport`: Server-mode file creation and JSON schema validation for snapshot.

- Integration tests:
  - Upload sample CSV via existing upload endpoint and verify `question_bank.json` updated correctly and parse-report endpoint returns the downloadable file.

Notes
-----

Keep the CSV parsing deterministic (stable ID generation for identical rows) and make sure parse snapshots are limited by `snapshotRowLimit` by default to avoid memory blowups.
