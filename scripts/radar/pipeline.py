from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path
from typing import Any

from .ai import generate_analysis, translate_caption
from .arxiv_fetcher import collect, fetch_method_figure, load_query_groups
from .schema import clean_paper, normalize_title, validate_collection
from .scoring import enrich_score_and_topics


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


def run(fetch: bool = False, limit_per_query: int = 10, threshold: int = 35, with_ai: bool = True) -> dict[str, Any]:
    loaded = load_json(DATA_PATH, load_json(DEMO_PATH, []))
    existing = loaded.get("papers", []) if isinstance(loaded, dict) else loaded
    if not isinstance(existing, list):
        existing = []
    candidates = existing
    if fetch:
        import urllib.error
        candidates = existing + collect(load_query_groups(), limit_per_query, os.getenv("ARXIV_USER_AGENT", "EmbodiedResearchRadar/0.1"), int(os.getenv("ARXIV_MAX_RETRIES", "3")), float(os.getenv("ARXIV_DELAY_SECONDS", "3")))
    deduped = deduplicate(candidates)
    # Phase 1: rule-based scoring and topic identification only (no LLM calls).
    scored = [clean_paper(enrich_score_and_topics(raw)) for raw in deduped]
    # Phase 2: keep papers above the relevance threshold; low-scoring papers never consume LLM budget.
    retained = select_relevant(scored, threshold)
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
    # Attach the best method figure from the arXiv HTML version when the paper has none yet.
    for paper in retained:
        if not paper.get("image") and paper.get("arxiv_id"):
            figure = fetch_method_figure(paper["arxiv_id"])
            if figure.get("url"):
                paper["image"] = figure["url"]
                paper["image_caption"] = figure.get("caption", "")
    # Keep low-scoring papers out of the public radar while preserving a small audit trail in metadata.
    payload = {
        "schema_version": "1.0.0", "generated_at": date.today().isoformat(),
        "source": "arXiv", "candidate_count": len(deduped), "retained_count": len(retained),
        "relevance_threshold": threshold, "papers": retained,
    }
    errors = validate_collection(retained)
    if errors:
        raise ValueError("Schema validation failed:\n" + "\n".join(errors[:20]))
    save_json(DATA_PATH, payload)
    return payload


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize, score, deduplicate and enrich radar papers.")
    parser.add_argument("--fetch", action="store_true", help="query arXiv before processing")
    parser.add_argument("--limit-per-query", type=int, default=int(os.getenv("ARXIV_PER_QUERY_LIMIT", "10")))
    parser.add_argument("--threshold", type=int, default=35)
    parser.add_argument("--no-ai", action="store_true", help="do not call configured LLM provider")
    args = parser.parse_args()
    payload = run(fetch=args.fetch, limit_per_query=args.limit_per_query, threshold=args.threshold, with_ai=not args.no_ai)
    print(f"candidate_count={payload['candidate_count']} retained_count={payload['retained_count']} output={DATA_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
