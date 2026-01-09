# API Performance & Controls Plan (Jan 2026)

Goal: document and prioritize actions to close API performance/control gaps (rate limiting, resource protection, observability) for QuizTimeHTML.

## Summary of Current Gaps
- Rate limits: in-memory fixed window, IP-only; no `Retry-After`; unbounded bucket growth; no per-key buckets; `/ops/metrics` unbounded.
- Resource protection: uploads read entire files into memory; no request timeout or concurrency guard; only basic size/row caps.
- Observability: counters only; no latency histograms or per-endpoint breakdown; sparse duration logging.
- Docs/config: WS3/WS4 implementations not reflected in gap docs; env defaults not documented.

## Actions & Priorities
1) Rate limiting robustness (P1)
- Replace fixed window with sliding window + eviction; add `Retry-After` + limit headers.
- Support per-API-key buckets (fallback to IP) and trust-proxy handling.
- Add TTL/LRU to cap bucket map size; env-tunable defaults.
- Add rate limit on `/ops/metrics` (low max, short window).

2) Resource protection on uploads (P1)
- Stream CSV parsing (line reader/transform) to cut memory spikes and honor backpressure.
- Add per-request timeout and a small concurrency gate (semaphore) for uploads.
- Fail fast on oversized payloads pre-write where possible; keep total MB and per-file caps with clearer errors.

3) Observability for performance (P2)
- Extend metrics with per-endpoint counters and latency buckets (p50/p95/p99) for upload, parse-report, assess; include rate-limit hits by namespace.
- Add lightweight duration logging on hot paths (requestId/actor), guarded by `REQUEST_LOG_ENABLED`.

4) Documentation & configs (P2)
- Update FEATURE_GAP_REPORT to mark WS3/WS4 done and list the above items explicitly with target defaults.
- Add perf-controls section to README/DEV guide describing env vars (rate limit window/max, request timeout, concurrency cap, streaming toggle).

5) Testing & validation (P1/P2)
- Integration tests: rate-limit headers + `Retry-After`; per-key vs per-IP behavior; `/ops/metrics` limiter.
- Stress-style test: concurrent uploads queue/429 appropriately; streaming handles large files without OOM.
- Metrics shape test once latency fields are added.

## Suggested Env Defaults (for discussion)
- UPLOAD_RATE_LIMIT_MAX=20, UPLOAD_RATE_LIMIT_WINDOW_MS=300000 (sliding window)
- REPORT_RATE_LIMIT_MAX=30, REPORT_RATE_LIMIT_WINDOW_MS=300000
- OPS_RATE_LIMIT_MAX=5, OPS_RATE_LIMIT_WINDOW_MS=10000
- UPLOAD_REQUEST_TIMEOUT_MS=30000, UPLOAD_CONCURRENCY_MAX=4
- UPLOAD_STREAMING_ENABLED=true

## Proposed Order
1) Implement limiter upgrade (sliding window, per-key/IP, eviction, headers, `/ops/metrics` guard).
2) Add concurrency gate + request timeout + streaming parser for uploads.
3) Extend metrics (latency buckets, per-endpoint) and duration logging.
4) Update docs (gap report + README/DEV) and add new tests (rate-limit, streaming stress, metrics shape).
