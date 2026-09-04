# Embodied Research Radar — Project Context

> **IMPORTANT:** If this document conflicts with the current repository, the repository
> is authoritative. Update this document after resolving the difference.

**Last Updated:** 2026-09-04
**Current Commit:** e1d69ef
**Default Branch:** main
**Repository:** https://github.com/Nicholas-Steven/embodied-research-radar
**Production Site:** https://nicholas-steven.github.io/embodied-research-radar/

---

## 1. Project Purpose

A personal research radar for embodied intelligence and robotic manipulation.
Automatically fetches papers from arXiv, scores them for relevance to specific
research topics (vision-force fusion, failure understanding, failure recovery,
VLA manipulation, generative policy), and publishes a static website with
search, filtering, paper detail, Research Map, and a Research Landscape page
that identifies cross-paper research gaps and searches external literature for
supporting/counter evidence.

## 2. Current Technology Stack

| Layer | Technology |
|---|---|
| Data pipeline | Python 3.10+ (standard library only, no third-party deps) |
| Frontend | Vanilla HTML / CSS / JavaScript (no framework, no bundler) |
| Hosting | GitHub Pages (static site) |
| CI/CD | GitHub Actions (3 workflows) |
| Data format | JSON files (no database) |
| External APIs | arXiv Atom API, OpenAlex, Semantic Scholar (all optional, degrade gracefully) |

No React, Vue, Node backend, or database.

## 3. Repository Structure

```
config/
  queries.json          # arXiv query groups per research topic
  scoring.json          # relevance scoring weights and bonuses
  topics.json           # topic definitions, research_map, literature_categories
  site.json             # site metadata and base path

data/
  papers.json           # main paper database (pipeline output)
  demo_papers.json      # hand-curated demo papers
  research_landscape.json   # landscape analysis output
  gap_search_results.json   # external evidence search cache

scripts/
  update_radar.py       # CLI entry: fetch + score + enrich + save papers.json
  build_landscape.py    # generate research_landscape.json from papers.json
  build_site.py         # copy web/ → site/, inject data.json
  radar/
    pipeline.py         # main pipeline: collect → dedup → score → AI → save
    arxiv_fetcher.py    # arXiv Atom API fetcher
    scoring.py          # relevance scoring + topic inference
    schema.py           # paper schema, validation, normalization
    ai.py               # optional OpenAI-compatible analysis
    gap_search.py       # external evidence search (OpenAlex, S2, arXiv)

web/
  index.html            # single-page app shell
  assets/
    app.js              # all frontend logic (routing, rendering, interactions)
    style.css           # all styles (CSS variables, dark mode, responsive)
    .nojekyll

site/                   # build output (generated, not source of truth)

tests/
  test_pipeline.py      # pipeline dedup and selection
  test_schema.py        # schema validation and scoring
  test_stability.py     # arXiv 429, LLM retry, merge logic
  test_frontend_layout.py
  test_landscape.py     # landscape analysis, gap search, claim version, workflow checks

.github/workflows/
  deploy.yml            # build + deploy only (no data mutation)
  update-radar.yml      # daily arXiv fetch → commit papers.json → push → deploy
  refresh-evidence.yml  # weekly external evidence search → commit → push → deploy
```

## 4. Core Data Flow

### Paper Radar (daily)

```
arXiv Atom API
    ↓
update_radar.py (--fetch)
    ↓
scripts/radar/pipeline.py
  collect → deduplicate → score → infer topics → optional AI → validate
    ↓
data/papers.json
    ↓
build_landscape.py
    ↓
data/research_landscape.json
    ↓
build_site.py
    ↓
site/ (HTML + CSS + JS + data.json)
    ↓
GitHub Pages
```

### External Evidence (weekly)

```
Research Gap definitions (from build_landscape.py)
    ↓
gap_search.py (--all --refresh)
    ↓
OpenAlex + Semantic Scholar + arXiv
    ↓
deduplicate → classify (SUPPORT / COUNTER / NEUTRAL)
    ↓
data/gap_search_results.json
    ↓
build_landscape.py (merges evidence into landscape)
    ↓
site/assets/data.json (landscape.external_evidence)
```

## 5. Main Website Features

- Today's Radar (default home view)
- Topic filters: Vision-Force, Failure Understanding, Failure Recovery, VLA, Generative Policy
- Core Papers collection
- Research Map (8-node pipeline visualization)
- Research Landscape page:
  - Landscape Overview (stats, cross-topic, evidence tiers)
  - Research Pipeline (9 stages)
  - Maturity Matrix (13 dimensions)
  - Major Research Questions (evidence-supported + partially-addressed)
  - Needs More Evidence (dataset-limited)
  - Possible Research Directions
  - External Evidence display per gap
  - Refresh Evidence panel (CLI command)
- Paper search / filtering / sorting
- Paper Detail (reader view with sections)
- Dark Mode
- Responsive layout (desktop / tablet / mobile)

## 6. Research Landscape Architecture

### Landscape Overview
Three stat groups: base stats (5 cards), cross-topic coverage (3 cards with
Chinese labels), evidence tiers (3 cards with descriptions and footnote about
different counting methods).

### Research Pipeline
9 stages: Perception → Representation → Contact State → Outcome Verification →
Failure Detection → Failure Diagnosis → Recovery Selection → Recovery Action →
Re-verification. Each stage shows paper count, maturity, and opens a detail panel.

### Maturity Matrix
13 dimensions assessed by regex matching against paper text, mapped to
Emerging / Developing / Moderate / Relatively Mature.

### Gap Classification
Gaps split into two sections:
- **Major Research Questions**: `evidence-supported` + `partially-addressed`
- **Needs More Evidence**: `dataset-limited`

Each gap card shows: Chinese title, English title, badges (status + confidence),
question summary. Expanded view shows current progress, missing piece,
supporting/counter evidence, external evidence, refresh button.

### External Evidence
Three sources: OpenAlex, Semantic Scholar, arXiv. Results stored in
`data/gap_search_results.json` with deduplication (DOI > arXiv ID > provider
ID > normalized title). Each paper classified as SUPPORT / COUNTER / NEUTRAL.

## 7. Research Gap Status Model

Three independent dimensions per gap:

| Field | Values | Meaning |
|---|---|---|
| `gap_status` | `evidence-supported`, `partially-addressed`, `open-hypotheses`, `dataset-limited` | Research state of the question |
| `confidence` | `high`, `medium`, `low`, `insufficient` | How confident we are in the status judgment |
| `claim_type` | `fact`, `evidence-based-inference`, `open-hypothesis`, `dataset-limited` | Nature of the statement |

Additional fields: `claim_version`, `what_has_been_addressed`, `what_remains_open`,
`status_reason`. When a gap's claim is substantially narrowed, `claim_version` is
bumped. External evidence carries its own `claim_version`; mismatch →
`evidence_stale = true`.

## 8. Evidence Search Rules

### Evidence Tiers (internal Radar classification)
- **Direct Evidence**: Paper has both vision-force signal AND failure topic AND
  force/tactile sensor signal
- **Related Evidence**: Failure topic + force/contact signal, but no VF topic
- **Background Evidence**: VF topic + failure signal, but no failure topic

### Known Misclassification Guards
- "human demonstration" alone does NOT match HITL regex
- "force feedback" / "tactile feedback" do NOT count as "human correction"
- "failure-recovery" topic alone does NOT equal "vision-force failure recovery"
- Topic intersection ≠ academic coverage (it only reflects Radar tag overlap)
- A paper with only `research_topics: ["failure-recovery"]` and no force sensor
  signal must NOT be classified as Direct Evidence

### Deduplication Priority
1. DOI
2. arXiv ID (normalized, version stripped)
3. Provider ID (Semantic Scholar / OpenAlex)
4. Normalized title (fuzzy match fallback)

## 9. Workflow Architecture

### deploy.yml — Build and Deploy Pages
- **Triggers**: `push` to main/master, `workflow_dispatch`
- **Does**: checkout → validate → build_landscape → build_site → upload artifact → deploy
- **Does NOT**: commit, push, mutate repository data
- **Permissions**: `contents: read`, `pages: write`, `id-token: write`
- **Concurrency**: `group: pages`

### update-radar.yml — Daily Paper Fetch
- **Triggers**: `schedule` (daily UTC 04:00), `workflow_dispatch`
- **Does**: checkout → update_radar.py --fetch → build_landscape → tests → commit → push
- **Commits**: `data/papers.json`, `data/research_landscape.json`
- **Permissions**: `contents: write`
- **Concurrency**: `group: radar-data-mutation`

### refresh-evidence.yml — Weekly Evidence Refresh
- **Triggers**: `schedule` (weekly Monday UTC 02:00), `workflow_dispatch`
- **Does**: checkout → gap_search.py --all --refresh → build_landscape → tests → commit → push
- **Commits**: `data/gap_search_results.json`, `data/research_landscape.json`
- **Permissions**: `contents: write`
- **Concurrency**: `group: radar-data-mutation` (shared with update-radar)

Both data workflows push to main, which triggers deploy.yml once.

## 10. Scheduled Jobs

| Workflow | Purpose | Schedule UTC | Beijing | Japan | Mutates Data | Triggers Deploy |
|---|---|---|---|---|---|---|
| update-radar.yml | Fetch new arXiv papers | Daily 04:00 | 12:00 | 13:00 | Yes | Yes (via push) |
| refresh-evidence.yml | Search external evidence | Mon 02:00 | Mon 10:00 | Mon 11:00 | Yes | Yes (via push) |
| deploy.yml | Build + deploy Pages | On push only | — | — | No | N/A (is deploy) |

## 11. Current Dataset Snapshot

*Snapshot as of 2026-09-04. These values change automatically over time.*

- Total papers: 155
- Vision-Force: 69
- Failure Understanding: 12
- Failure Recovery: 16
- Major Research Questions: 6
- Needs More Evidence: 6

## 12. Important Research Logic Constraints

1. `failure-recovery` topic ≠ vision-force failure recovery direct evidence
2. Radar not finding a paper ≠ academic gap exists
3. More supporting papers ≠ higher confidence
4. Counter evidence means existing work partially/directly addresses the gap
5. After broad claim is narrowed by counter evidence, old evidence cannot be
   directly used for the new claim (claim_version tracking)
6. After claim changes, new queries and evidence are required
7. Dataset-limited questions should not be shown at the same level as
   strong-evidence Research Questions
8. Research Gaps are NOT "world first" or "nobody studied this" declarations
9. Research Opportunities are NOT confirmed novelties
10. Maturity and Gap Confidence are two different dimensions

## 13. Build and Local Run Commands

```bash
# Environment: Python 3.10+, no third-party packages required

# Generate research landscape
python scripts/build_landscape.py

# Build static site
python scripts/build_site.py

# Run all tests
python -m unittest discover -s tests -v

# Syntax check
python -m py_compile scripts/radar/*.py scripts/*.py

# Start local server
python -m http.server 8000 --directory site --bind 127.0.0.1

# External evidence search (single gap)
python scripts/radar/gap_search.py --gap temporal-6d-ft-evidence --refresh

# External evidence search (all gaps)
python scripts/radar/gap_search.py --all --refresh

# With source tracking
python scripts/radar/gap_search.py --all --refresh --source local
```

## 14. Deployment Rules

- **Never force push.** Remote data updates may have occurred since last fetch.
- **Data workflows mutate repository; deploy workflow does not.**
  - `update-radar.yml` and `refresh-evidence.yml` commit + push data files.
  - `deploy.yml` only builds and deploys from committed source.
- `site/` is a build artifact. Do not commit it as source of truth.
- When merging remote changes: `remote_paper_ids ⊆ final_paper_ids` must hold.
  Verify by paper ID set comparison, not just count.
- If `git push` returns non-fast-forward: stop, fetch, merge, re-verify. Never force.

## 15. Known Limitations

- External evidence matching relies on title/abstract regex, not full-text semantic analysis
- This is NOT a systematic review or meta-analysis
- Gap judgments may be influenced by query design and coverage blind spots
- Some Research Questions have insufficient external coverage (dataset-limited)
- After claim narrowing, stale evidence may persist until next search cycle
- GitHub Pages is a static site; no server-side computation at runtime
- Topic intersection counts reflect Radar tag overlap, not academic field coverage

## 16. How Future Agents Should Start

**Do not re-read the entire repository.** Recommended workflow:

1. Read `docs/PROJECT_CONTEXT.md` (this file)
2. Read the most recent 5–10 entries in `docs/ITERATION_LOG.md`
3. Run `git status` and `git log -5 --oneline`
4. Read only the source files directly relevant to the current task
5. If PROJECT_CONTEXT conflicts with current code, **the code is authoritative**
6. After completing changes, update the relevant sections of PROJECT_CONTEXT
7. Append a concise entry to ITERATION_LOG

PROJECT_CONTEXT is a navigation aid, not a replacement for reading code.
