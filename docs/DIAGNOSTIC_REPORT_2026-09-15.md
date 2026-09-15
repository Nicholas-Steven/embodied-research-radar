# Diagnostic Report — Radar Stalled at 2026-09-10 (written 2026-09-15)

> Status: CONFIRMED with log-level evidence. Supersedes guesswork from the
> initial timing-based diagnosis; keeps `DIAGNOSTIC_REPORT_2026-09-08.md`
> intact as earlier history.

## Symptom

Website stopped showing new papers after 2026-09-10 while GitHub Actions
"Update Radar" runs stayed green every day.

## Root Cause (log-confirmed)

Downloaded the 2026-09-14 run log (run 34827892508) via authenticated `gh`:

- 32 lines of `HTTP Error 429` / `arXiv rate limited (429), waiting ...`
- 5 separate queries exhausted all 5 retries with `429: Too Many Requests`
- Final line: `arXiv returned 429 repeatedly; skipping remaining queries`
  → `collect()` returned a partial/empty candidate list.

`run()` treated that as a normal day: rewrote `papers.json` (only
`generated_at` changed), committed an empty data commit, deploy re-published
an unchanged dataset → green workflow, zero new papers since 09-10.

**Confirmation level: log-level confirmed** (not inferred from timing).

## Contributing Design Defects (all fixed this round)

1. Provider failure returned `[]`/partial list — indistinguishable from a
   quiet day.
2. `generated_at` changed every run → `git diff --cached --quiet` always
   saw "changes" → daily empty commits masked the outage.
3. 21 keyword HTTP queries per run from a shared runner IP → the exact
   pattern arXiv rate-limits.
4. No health counters or summary; failure was invisible without logs.

## Fix Applied (2026-09-15)

- **Primary source**: arXiv OAI-PMH (`https://oaipmh.arxiv.org/oai`,
  `oai_dc`, one ListRecords per category set, 7-day rolling window).
  Verified live: ListSets + ListRecords dry-run OK (97 records/page, no
  resumptionToken needed for daily windows).
- **Fallback**: one broad Search API query with official
  `submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]` window.
- **FetchHealth** struct: attempted/succeeded/rate_limited/failed/exhausted/
  raw/after-dedupe/relevant/new + status HEALTHY/DEGRADED/FAILED.
- **Failure discipline**: `SourceUnhealthyError` → exit 2, papers.json
  byte-identical, no commit, no deploy. Partial harvests (some sets failed)
  also fail loudly.
- **Zero-new discipline**: healthy runs with 0 new papers write nothing
  (generated_at only moves when the dataset actually changes).
- **Backfill executed**: window 2026-09-08→09-15, 5875 usable records
  harvested (checkpointed/resumable), 491 relevant, 466 new papers added;
  185/185 prior IDs preserved; idempotency verified (2nd run: 0 new).
