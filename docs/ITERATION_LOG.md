# Embodied Research Radar — Iteration Log

> **Rule:** Newest entries at the top. Each entry follows the fixed schema below.
> Do not delete old entries. Append new entries at the top.
> If a correction is needed, add a `Correction` sub-section to the existing entry.

---

## Current Stable Release

- **Commit:** e1d69ef
- **Date:** 2026-09-04
- **Paper Count at Release:** 155
- **Production URL:** https://nicholas-steven.github.io/embodied-research-radar/
- **Workflows:** deploy.yml (push), update-radar.yml (daily), refresh-evidence.yml (weekly)

---

## 2026-09-04 — Workflow Cleanup & Production Release

### Goal
Final workflow cleanup before production: remove redundant deploy schedule, unify
data-mutation concurrency, push to production, verify deployment.

### User-visible Changes
None (infrastructure only).

### Technical Changes
- Removed `schedule` trigger from deploy.yml (now only push + workflow_dispatch)
- Unified refresh-evidence.yml concurrency group to `radar-data-mutation` (shared with update-radar.yml)

### Files Changed
- `Modified` `.github/workflows/deploy.yml`
- `Modified` `.github/workflows/refresh-evidence.yml`
- `Modified` `data/research_landscape.json` (regenerated from 155 papers)

### Data / Schema Changes
None.

### Research Logic Changes
None.

### Workflow Changes
- deploy.yml: removed schedule trigger, kept push + workflow_dispatch
- refresh-evidence.yml: concurrency group changed from `evidence-refresh` to `radar-data-mutation`

### Bugs Fixed
None.

### Validation
- unit tests: 97/97 OK
- py_compile: OK
- build_landscape: 155 papers OK
- build_site: OK
- deploy Action: completed/success

### Data Safety
- Papers: 155 (unchanged)
- Remote IDs preserved: 155/155
- Force push: No

### Commit
- `e1d69ef` (deploy.yml schedule removal + concurrency unification)
- `8bdcb08` (add update-radar.yml)

### Deployment
- Deployed. https://nicholas-steven.github.io/embodied-research-radar/

### Decision / Rationale
deploy.yml daily schedule was redundant because update-radar.yml already runs daily
at the same time and triggers deploy via push. Removing it avoids duplicate deploys.
Shared concurrency group prevents update-radar and refresh-evidence from pushing
simultaneously.

---

## 2026-09-04 — Safe Production Release

### Goal
Merge Research Landscape feature into main, preserving all remote paper data.

### User-visible Changes
- New "研究进展与缺口" (Research Landscape) page accessible from sidebar
- Landscape Overview with stats, cross-topic coverage, evidence tiers
- Research Pipeline (9 stages, clickable cards with detail panel)
- Maturity Matrix (13 dimensions)
- Major Research Questions / Needs More Evidence split (6 + 6 gaps)
- External Evidence display per gap with Refresh Evidence panel
- Gap cards with claim version tracking and stale evidence detection
- Pipeline card interaction restored (whole-card click, stopPropagation on buttons)
- 5-column base stats, Chinese-first labels throughout

### Technical Changes
- New `scripts/build_landscape.py` (~970 lines): cross-paper gap analysis engine
- New `scripts/radar/gap_search.py` (~540 lines): external evidence search (OpenAlex, Semantic Scholar, arXiv)
- New `tests/test_landscape.py` (~770 lines): 97 tests covering evidence classification, gap search, claim version, workflow checks
- Modified `scripts/build_site.py`: merges landscape.json into data.json
- Modified `web/assets/app.js`: landscape routing, gap cards, pipeline detail, evidence display
- Modified `web/assets/style.css`: all landscape styles
- Modified `web/index.html`: landscape section and sidebar nav
- Modified `.github/workflows/deploy.yml`: removed update_radar.py, contents:read
- New `.github/workflows/refresh-evidence.yml`: weekly external evidence search
- New `.github/workflows/update-radar.yml`: daily arXiv paper fetch

### Files Changed
- `Added` `scripts/build_landscape.py`
- `Added` `scripts/radar/gap_search.py`
- `Added` `tests/test_landscape.py`
- `Added` `.github/workflows/refresh-evidence.yml`
- `Added` `.github/workflows/update-radar.yml`
- `Added` `data/research_landscape.json`
- `Added` `data/gap_search_results.json`
- `Modified` `scripts/build_site.py`
- `Modified` `.github/workflows/deploy.yml`
- `Modified` `web/assets/app.js`
- `Modified` `web/assets/style.css`
- `Modified` `web/index.html`

### Data / Schema Changes
- New `data/research_landscape.json`: pipeline, maturity, gaps, directions, evidence_index, external_evidence
- New `data/gap_search_results.json`: per-gap external search results with dedup and classification
- New gap fields: `gap_status`, `claim_version`, `what_has_been_addressed`, `what_remains_open`, `status_reason`
- `data.json` gains `landscape` top-level key
- `data.json` gains `external_update_source` and `external_searched_at`

### Research Logic Changes
- Evidence classification: Direct / Related / Background based on topic + sensor + failure signals
- Claim version tracking: bumped when gap claim is narrowed; stale evidence flagged
- Gap status model: evidence-supported / partially-addressed / open-hypotheses / dataset-limited
- Confidence adjusted by external evidence (counter ≥ 2× supporting AND ≥ 5 → downgrade)
- 3 gaps narrowed (temporal-6d-ft, selective-human-escalation, learning-from-corrections)
- Known misclassification guards documented (HITL regex, feedback disambiguation)

### Workflow Changes
- deploy.yml: removed update_radar.py step, permissions changed to contents:read
- New refresh-evidence.yml: weekly search → commit evidence → push → deploy
- New update-radar.yml: daily fetch → commit papers → push → deploy

### Bugs Fixed
- Pipeline card click interaction regression after CSS layout changes
- Blue underline/dashed decoration on pipeline card children
- Gap card badges squeezing title into narrow column
- `learning-from-corrections` missing claim_version=2
- `test_all_gaps_have_group_field` missing `partially-addressed` in valid set

### Validation
- unit tests: 97/97 OK
- py_compile: OK
- build_landscape: 155 papers OK
- build_site: OK
- HTTP verification: 200 OK
- Deploy Action: completed/success

### Data Safety
- Papers: 88 (local) + 155 (remote) → 155 (merged, all remote preserved)
- Remote IDs preserved: 155/155
- Force push: No

### Commit
- `c54918e` (main feature commit)
- `f4668ba` (merge remote/main)
- `8bdcb08` (add update-radar.yml)

### Deployment
- Deployed. https://nicholas-steven.github.io/embodied-research-radar/

### Decision / Rationale
- Deploy.yml separated from data mutation: deploy only builds, data workflows commit/push
- Claim version system chosen over full re-search on every build (cost/time tradeoff)
- Major / Needs More Evidence split chosen over flat list (user testing showed flat list confused readers)
- Regex-based evidence classification chosen for V1 (LLM-based deferred to future, always optional)

---

## 2026-09-03 — Evidence Audit & Gap Refinement

### Goal
Audit all 12 Research Gap supporting/counter evidence against real paper abstracts.

### User-visible Changes
- Gap descriptions updated to reflect narrowed claims
- Confidence levels adjusted per audit findings
- Evidence-supported Chinese name changed from "较强证据" to "有证据支持"

### Technical Changes
- `_HITL_RE` regex tightened (no longer matches "human demonstration")
- Gap 4 description: "恢复后缺少重新验证" → "恢复后重新验证机制的系统性仍待确认"
- Gap 5 description: focus shifted from "有没有 Temporal F/T" to "是否改善失败状态验证"
- Gap 9 narrowed to VF failure recovery context
- Gap 10: all 26 "supporting" papers reclassified as counter (all doing correction learning)

### Files Changed
- `Modified` `scripts/build_landscape.py`
- `Modified` `web/index.html`

### Validation
- unit tests: 86/86 OK (at time of audit)

### Decision / Rationale
Manual abstract-level audit found systematic over-counting of supporting evidence due to
broad keyword matching ("human", "feedback", "benchmark", "generalization"). Tightened
regex and reclassified where needed.

---

## Historical Milestones (Reconstructed from repository)

*The following milestones are reconstructed from git log and current source files.
Specific dates and details are approximate where not directly verifiable.*

### Initial Release (~2026-08)
- Commit `b41865b`
- Basic radar: arXiv fetch, scoring, demo papers, static site
- Topics: vision-force, failure-understanding, failure-recovery, vla-manipulation, generative-policy
- Research Map with 8 nodes
- Dark mode, responsive layout

### Iterative Radar Updates (2026-08 to 2026-09)
- Daily automated arXiv updates via GitHub Actions
- Paper count grew from ~10 to ~155
- Bug fixes: Pending placeholder rendering, lightbox zoom

### Research Landscape Development (2026-09-03 to 2026-09-04)
- Full landscape analysis engine (build_landscape.py)
- External evidence search (gap_search.py)
- Gap claim version and stale evidence tracking
- Workflow responsibility separation
- Safe production release preserving all remote paper data
