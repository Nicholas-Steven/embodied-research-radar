# Embodied Research Radar — Task Workflow

> Detailed standard workflow for every development task.
> Auto-loaded reference: `.atomcode.md` (project root) points here.

---

## Standard Task Start

```
1. Read docs/PROJECT_CONTEXT.md
2. Read docs/ITERATION_LOG.md (top 5 entries)
3. git status && git log -5 --oneline
4. Identify which source files the task touches
5. Read ONLY those files (+ their direct dependencies)
6. If task involves workflow/schema/research-logic/deployment/data-pipeline:
   → also read the matching PROJECT_CONTEXT section
```

## Standard Task End

```
1. Run relevant tests:
   python -m unittest discover -s tests -v
2. Run syntax check:
   python -m py_compile scripts/radar/*.py scripts/*.py
3. If build was affected:
   python scripts/build_landscape.py
   python scripts/build_site.py
4. Update docs/PROJECT_CONTEXT.md if any of these changed:
   Architecture / Data Flow / Schema / Workflow / CLI /
   Research Logic / Production Behavior / Key File Location
5. Append entry to top of docs/ITERATION_LOG.md
6. git status (verify no unintended changes)
```

## When Full Repository Reading Is Required

Only expand reading scope when:

- Major architecture refactor touching many modules
- PROJECT_CONTEXT is clearly stale or wrong
- First time working on an unknown module
- Data migration affecting papers.json schema
- Resolving merge conflicts with remote

In these cases, read the relevant source files thoroughly — PROJECT_CONTEXT is a map, not a substitute for code.

## When Documentation Updates Are Required

| Change Type | Update PROJECT_CONTEXT? | Update ITERATION_LOG? |
|---|---|---|
| New feature / module | Yes (relevant section) | Yes |
| Bug fix | Only if behavior changes | Yes |
| Workflow change | Yes (Section 9/10) | Yes |
| Schema / data field change | Yes (Section 7/8) | Yes |
| CLI change | Yes (Section 13) | Yes |
| CSS/JS polish (no behavior change) | No | Optional (same-day entry) |
| Typo / comment fix | No | No |

## Minor Change Policy

Changes that are purely cosmetic (typo, 2-3px spacing, color tweak, comment wording)
with zero behavior or logic impact:

- Do NOT require a full ITERATION_LOG entry
- Can be grouped into a same-day "UI Polish / Minor Fixes" entry
- Do NOT require PROJECT_CONTEXT update

## Data Safety Checklist

Before any commit that touches `data/papers.json`:

```
□ Remote paper IDs verified as subset of final paper IDs
□ No papers were accidentally dropped
□ Paper count is ≥ remote paper count
□ No force push was used
□ Build succeeds with merged data
□ Tests pass
```

## Documentation File Map

| File | Scope | Auto-loaded? |
|---|---|---|
| `.atomcode.md` | Agent workflow rules (this project) | Yes (every session) |
| `docs/PROJECT_CONTEXT.md` | Current project state | Read at task start |
| `docs/ITERATION_LOG.md` | Development history | Read top entries at task start |
| `docs/TASK_WORKFLOW.md` | This file — detailed workflow | Referenced from .atomcode.md |
