# Intelligent Question Supplementation Feature Plan

**Document Version:** 1.2  
**Date:** 2025-01-09  
**Status:** Implementation Ready

## Objective

Detect when a user requests more quiz questions than are available and provide a safe, auditable AI-driven supplementation flow that requires explicit consent, validates results, and only persists after confirmation.

## Integration summary

- Reuse: `ConfigurationPanel`, `QuestionService`, `APIService`, `APIKeyManager`, `QuestionManager`.
- New: `QuestionSupplementManager` (service), `SupplementationDialog` (UI).

## Key integration points

1. Detection — `ConfigurationPanel.startQuiz()` checks available count and opens the dialog when shortage occurs.

2. Client API — `APIService.supplementQuestions(prompt, options)` calls server `POST /api/supplement-questions`.

3. Persistence — use `QuestionService.questionManager.addQuestions()` then `QuestionService.refreshActiveQuestions()`.

## User flows

### Sufficient

- Requested ≤ available → proceed.

### Shortage + valid API key

- Show `SupplementationDialog` with requested N, available A, missing M = N − A.

- Dialog shows estimated cost/provider calls, sample format (CSV headers), and a "persist" checkbox (default true).

- User confirms → server generation → client shows progress → validation summary → user confirms persist.

### Shortage + no API key

- Dialog offers: proceed with available, upload CSV, or configure API key. No auto-generation.

## Partial-generation policy

- Default: `autoRetryOnPartial = false`.

- If fewer valid items are returned than requested, present counts and offer: Accept partial, Retry now (explicit consent), Schedule later, Abort.

## Contracts (client ↔ server)

Request payload:

{ prompt: string, missingCount: number, schema: object, provider: string, options: { persist: boolean, maxRetries: number } }

Success response:

{ questions: Question[], metadata: { requested: number, generated: number, valid: number, duplicates: number } }

Errors: 400, 401, 422, 429, 500

## Server validation pipeline

- Parse provider text as CSV (strict).
- Validate required fields and normalize enums.
- Deduplicate against existing bank (text normalization / shingling).
- Return validated rows + per-row errors; do not persist without client confirmation.

## Error handling & defaults

- 429: exponential backoff (server) and UI retry option.
- 401/403: prompt for API key re-entry.
- Timeout: default 30s → 504 returned; client offers retry.
- Malformed rows: 422 with per-row errors.

Defaults (configurable):

- Max supplement per request: 50
- Minimum sample size for analysis: 3
- Server maxRetries: 3
- Per-call timeout: 30s
- Concurrent supplements per session: 1

## Tests and rollout

- Unit tests: schema analysis, prompt builder, CSV validation.
- Integration tests: shortage → generate → validate → persist; partial-generation; provider errors.
- Manual checks: happy path, missing API key.

## Files to change

- Modify: `src/components/ConfigurationPanel.js`, `src/services/APIService.js`, `server.js`.
- Add: `src/services/QuestionSupplementManager.js`, `src/components/SupplementationDialog.js`.

---

## Implementation Status

**Configuration Defaults (Confirmed):**
- Max supplement cap: 50
- Minimum sample size: 3
- Max retries: 3
- Per-call timeout (s): 30

**Phase 1:** Core Infrastructure - ✅ Ready for Implementation  
**Phase 2:** Detection and Integration - Pending  
**Phase 3:** Server Implementation - Pending  
**Phase 4:** User Experience - Pending  
**Phase 5:** Testing and Validation - Pending  

This document is now ready for implementation based on the established architecture and confirmed defaults.
