from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

from .ai import generate_analysis, translate_caption
from .arxiv_fetcher import collect, fetch_method_figure, harvest_recent_search, load_query_groups
from .fetch_health import FetchHealth, SourceUnhealthyError
from .oai_harvester import DEFAULT_LOOKBACK_DAYS, harvest as harvest_oai
from .schema import clean_paper, normalize_title, validate_collection
from .scoring import enrich_score_and_topics, is_radar_eligible


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data/papers.json"
DEMO_PATH = ROOT / "data/demo_papers.json"


def load_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def save_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def deduplicate(papers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    by_id: dict[str, dict[str, Any]] = {}
    by_title: dict[str, dict[str, Any]] = {}
    for raw in papers:
        paper = clean_paper(raw)
        arxiv_id = paper.get("arxiv_id")
        title = normalize_title(paper.get("title"))
        current = by_id.get(arxiv_id) if arxiv_id else by_title.get(title)
        if current is None:
            if arxiv_id:
                by_id[arxiv_id] = paper
            if title:
                by_title[title] = paper
            result.append(paper)
        else:
            # Keep the richer record, while retaining current metadata.
            merged = dict(current)
            for key, value in paper.items():
                if value not in (None, "", [], "Pending") and merged.get(key) in (None, "", [], "Pending"):
                    merged[key] = value
            current.clear()
            current.update(merged)
    return result


def select_relevant(papers: list[dict[str, Any]], threshold: int = 45) -> list[dict[str, Any]]:
    return [paper for paper in papers if paper.get("relevance_score", 0) >= threshold]


def enrich(papers: list[dict[str, Any]], with_ai: bool = True) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for raw in papers:
        paper = enrich_score_and_topics(raw)
        if with_ai and (paper.get("analysis_status") in (None, "", "pending") or paper.get("summary_one_sentence") in ("", "Pending")):
            paper.update(generate_analysis(paper))
        result.append(clean_paper(paper))
    return sorted(result, key=lambda p: (p.get("published_date", ""), p.get("relevance_score", 0)), reverse=True)


def _canonical_papers(papers: list[dict[str, Any]]) -> str:
    return json.dumps(papers, ensure_ascii=False, sort_keys=True)


def dataset_changed(loaded: Any, retained: list[dict[str, Any]], threshold: int) -> bool:
    """True only when the paper collection itself materially changed.

    generated_at must never be the reason a diff exists, so it is excluded
    from the comparison. A healthy run with zero new papers leaves the file
    untouched instead of manufacturing a date-only "update".
    """
    if not isinstance(loaded, dict) or not isinstance(loaded.get("papers"), list):
        return True
    return _canonical_papers(loaded["papers"]) != _canonical_papers(retained) or loaded.get("relevance_threshold") != threshold


def fetch_candidates(lookback_days: int = DEFAULT_LOOKBACK_DAYS, limit_per_query: int = 10) -> tuple[list[dict[str, Any]], FetchHealth]:
    """Fetch raw candidates via OAI-PMH (primary) with Search API fallback.

    Raises SourceUnhealthyError only when BOTH sources are unusable, so a
    single throttled provider degrades instead of failing the run, while a
    total outage still fails loudly. RADAR_OAI_CHECKPOINT optionally points
    at a resumable harvest checkpoint (per-set progress survives restarts).
    """
    health = FetchHealth()
    try:
        raw = harvest_oai(lookback_days, health, checkpoint_path=os.getenv("RADAR_OAI_CHECKPOINT", "") or None)
        return raw, health
    except SourceUnhealthyError as primary_error:
        health.note(f"primary source failed: {primary_error}")
        fallback = FetchHealth()
        try:
            raw = harvest_recent_search(lookback_days, fallback, limit_per_query)
            fallback.notes = [f"primary OAI-PMH failed, recovered via Search API: {primary_error}"] + fallback.notes
            return raw, fallback
        except SourceUnhealthyError as fallback_error:
            raise SourceUnhealthyError(
                f"Both sources unhealthy. OAI-PMH: {primary_error} | Search API: {fallback_error}"
            ) from fallback_error


def run(fetch: bool = False, limit_per_query: int = 10, threshold: int = 45, with_ai: bool = True,
        lookback_days: int = DEFAULT_LOOKBACK_DAYS) -> tuple[dict[str, Any], FetchHealth]:
    loaded = load_json(DATA_PATH, load_json(DEMO_PATH, []))
    existing = loaded.get("papers", []) if isinstance(loaded, dict) else loaded
    if not isinstance(existing, list):
        existing = []
    existing_ids = {p.get("paper_id") for p in existing if isinstance(p, dict)}

    health = FetchHealth()
    candidates = existing
    raw_new: list[dict[str, Any]] = []
    if not fetch:
        health.source = "local rebuild (no fetch)"
        health.note("no fetch requested; health counters reflect scoring only")
    else:
        raw, health = fetch_candidates(lookback_days, limit_per_query)
        raw_new = raw
        candidates = existing + [clean_paper(p) for p in raw]
    deduped = deduplicate(candidates)
    # Data-safety contract (2026-09-15): papers already in the dataset are
    # PRESERVED unconditionally — eligibility and threshold apply only to
    # new candidates. Re-scoring the backlog with ever-evolving rules must
    # never silently delete remote-approved papers (REMOTE_IDS ⊆ FINAL_IDS).
    existing_by_id = {p.get("paper_id"): p for p in existing if isinstance(p, dict)}
    scored = list(existing_by_id.values())
    new_seen_ids: set[str] = set()
    for raw in deduped:
        pid = raw.get("paper_id")
        if pid in existing_by_id:
            continue  # keep the stored record untouched
        if pid in new_seen_ids:
            continue
        new_seen_ids.add(pid)
        paper = clean_paper(enrich_score_and_topics(raw))
        ok, _ = is_radar_eligible(paper)
        if ok:
            scored.append(paper)
    # Phase 2: threshold applies to NEW candidates only; existing papers pass.
    retained = [p for p in scored
                if p.get("paper_id") in existing_by_id or p.get("relevance_score", 0) >= threshold]
    retained.sort(key=lambda p: (p.get("published_date", ""), p.get("relevance_score", 0)), reverse=True)
    # Phase 3: AI analysis only for retained papers, reusing existing ready results.
    if with_ai:
        for paper in retained:
            if paper.get("analysis_status") in (None, "", "pending") or paper.get("summary_one_sentence") in ("", "Pending"):
                paper.update(generate_analysis(paper))
    # Translate figure captions to Chinese for papers that have an English caption but no translation yet.
    if with_ai:
        for paper in retained:
            if paper.get("image_caption") and (not paper.get("image_caption_zh") or str(paper.get("image_caption_zh")) == "Pending"):
                paper["image_caption_zh"] = translate_caption(paper.get("image_caption", ""))
    retained.sort(key=lambda p: (p.get("published_date", ""), p.get("relevance_score", 0)), reverse=True)
    # Attach the best method figure (arXiv HTML <figure> extraction). The
    # per-run cap bounds request volume; candidates include ANY retained
    # paper still missing an image (not just brand-new ones), so papers that
    # missed enrichment in an earlier run (e.g. a backfill with figure
    # budget 0) are picked up on later runs. Image fetch failure is optional
    # enrichment: the paper stays, the image stays empty, the frontend shows
    # its fallback — never a pipeline failure.
    figure_budget = int(os.getenv("ARXIV_FIGURE_FETCH_LIMIT", "20"))
    new_ids = {p.get("paper_id") for p in retained} - existing_ids
    figure_candidates = sorted(
        (p for p in retained if not p.get("image") and p.get("arxiv_id")),
        key=lambda p: (p.get("paper_id") in new_ids, p.get("relevance_score", 0)), reverse=True,
    )
    images_found = 0
    images_failed = 0
    for paper in figure_candidates[:figure_budget]:
        try:
            figure = fetch_method_figure(paper["arxiv_id"])
        except Exception:
            figure = {}
        if figure.get("url"):
            paper["image"] = figure["url"]
            paper["image_caption"] = figure.get("caption", "")
            images_found += 1
        else:
            images_failed += 1
    health.images_found = images_found
    health.images_missing = sum(1 for p in retained if not p.get("image"))

    health.records_after_dedupe = len(deduped)
    health.merged_records_before_dedup = len(candidates)
    if fetch and raw_new:
        # Truthful counter: how many harvested candidates scored relevant,
        # independent of how many were genuinely new to the dataset.
        scored_new = [enrich_score_and_topics(clean_paper(p)) for p in raw_new]
        health.relevant_records = sum(1 for p in scored_new if p.get("relevance_score", 0) >= threshold)
    health.new_records = len(new_ids)

    # Failure discipline: an unhealthy source must never rewrite papers.json.
    # Raise BEFORE any save; the caller exits non-zero and the file stays
    # byte-identical (no generated_at bump, no empty commit).
    if fetch and not health.source_responded:
        raise SourceUnhealthyError(
            "Fetch completed without a single successful source response; "
            "refusing to treat this as an empty-day update. "
            + "; ".join(health.notes[-3:])
        )

    changed = dataset_changed(loaded, retained, threshold)
    payload = {
        "schema_version": "1.0.0",
        "generated_at": date.today().isoformat() if changed else (loaded.get("generated_at", "") if isinstance(loaded, dict) else ""),
        "source": "arXiv", "candidate_count": len(deduped), "retained_count": len(retained),
        "relevance_threshold": threshold, "papers": retained,
    }
    errors = validate_collection(retained)
    if errors:
        raise ValueError("Schema validation failed:\n" + "\n".join(errors[:20]))
    if changed:
        save_json(DATA_PATH, payload)
    else:
        # Healthy zero-new run: keep the previous file untouched so commits
        # only ever appear when the dataset actually changed.
        health.note("no dataset change; papers.json left untouched")
    return payload, health


def _write_step_summary(health: FetchHealth, dataset_total: int) -> None:
    summary_path = os.getenv("GITHUB_STEP_SUMMARY", "")
    if not summary_path:
        return
    lines = ["## Radar Update Health", ""] + health.summary_lines()
    lines.append(f"Dataset total: {dataset_total}")
    lines.append("")
    try:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    except OSError:
        pass


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize, score, deduplicate and enrich radar papers.")
    parser.add_argument("--fetch", action="store_true", help="query arXiv (OAI-PMH primary, Search API fallback) before processing")
    parser.add_argument("--lookback-days", type=int, default=int(os.getenv("RADAR_LOOKBACK_DAYS", str(DEFAULT_LOOKBACK_DAYS))),
                        help="rolling harvest window in days (default 7)")
    parser.add_argument("--limit-per-query", type=int, default=int(os.getenv("ARXIV_PER_QUERY_LIMIT", "10")),
                        help="candidate cap per request, used by the Search API fallback")
    parser.add_argument("--threshold", type=int, default=45)
    parser.add_argument("--no-ai", action="store_true", help="do not call configured LLM provider")
    args = parser.parse_args()
    try:
        payload, health = run(fetch=args.fetch, limit_per_query=args.limit_per_query, threshold=args.threshold,
                              with_ai=not args.no_ai, lookback_days=args.lookback_days)
    except SourceUnhealthyError as exc:
        failed = FetchHealth(source="arXiv OAI-PMH + Search API fallback")
        failed.requests_exhausted = 1
        failed.note(str(exc))
        _write_step_summary(failed, 0)
        print(f"SOURCE UNHEALTHY: {exc}", file=sys.stderr)
        return 2  # non-zero → workflow failure; papers.json untouched
    _write_step_summary(health, payload["retained_count"])
    for line in health.summary_lines():
        print(line)
    print(f"candidate_count={payload['candidate_count']} retained_count={payload['retained_count']} output={DATA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
