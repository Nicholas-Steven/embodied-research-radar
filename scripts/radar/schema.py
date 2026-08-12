from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Iterable


REQUIRED_FIELDS = (
    "paper_id", "title", "authors", "abstract", "abstract_zh", "published_date",
    "updated_date", "year", "venue", "doi", "arxiv_id", "paper_url", "pdf_url",
    "code_url", "project_url", "image", "research_topics", "literature_categories",
    "methods", "tasks", "sensors", "keywords", "summary_one_sentence",
    "research_problem", "core_contributions", "method_summary", "experimental_setup",
    "key_results", "limitations", "why_it_matters", "relevance_score",
    "relevance_reason", "related_to_my_research", "recommended_reading",
    "reproduction_value", "core_candidate", "source", "last_checked",
)


def today_iso() -> str:
    return date.today().isoformat()


def normalize_arxiv_id(value: str | None) -> str:
    if not value:
        return ""
    value = str(value).strip()
    match = re.search(r"(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:)([^?#/]+)", value, re.I)
    identifier = match.group(1) if match else value
    identifier = identifier.removesuffix(".pdf")
    return re.sub(r"v\d+$", "", identifier, flags=re.I)


def normalize_title(title: str | None) -> str:
    value = re.sub(r"[^a-z0-9]+", " ", (title or "").lower())
    return re.sub(r"\s+", " ", value).strip()


def paper_id_for(arxiv_id: str | None, title: str | None = None) -> str:
    identifier = normalize_arxiv_id(arxiv_id)
    if identifier:
        return f"arxiv-{identifier.replace('.', '-') }"
    slug = normalize_title(title).replace(" ", "-")[:80]
    return f"paper-{slug or 'unknown'}"


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def clean_paper(paper: dict[str, Any]) -> dict[str, Any]:
    """Return a stable schema with safe defaults; no semantic fields are invented."""
    result = dict(paper)
    result["arxiv_id"] = normalize_arxiv_id(result.get("arxiv_id") or result.get("paper_id"))
    result["paper_id"] = result.get("paper_id") or paper_id_for(result["arxiv_id"], result.get("title"))
    if result["arxiv_id"]:
        result["paper_url"] = result.get("paper_url") or f"https://arxiv.org/abs/{result['arxiv_id']}"
        result["pdf_url"] = result.get("pdf_url") or f"https://arxiv.org/pdf/{result['arxiv_id']}"
    result["authors"] = [str(a).strip() for a in as_list(result.get("authors")) if str(a).strip()]
    for key in ("research_topics", "literature_categories", "methods", "tasks", "sensors", "keywords", "core_contributions"):
        result[key] = [str(x) for x in as_list(result.get(key)) if str(x).strip()]
    for key in ("title", "abstract", "abstract_zh", "venue", "doi", "code_url", "project_url", "image", "summary_one_sentence", "research_problem", "method_summary", "experimental_setup", "key_results", "limitations", "why_it_matters", "relevance_reason", "related_to_my_research", "recommended_reading", "reproduction_value", "core_candidate", "source", "last_checked"):
        result[key] = str(result.get(key) or "").strip()
    result["year"] = int(result.get("year") or (str(result.get("published_date") or "")[:4] or 0))
    result["relevance_score"] = max(0, min(100, int(result.get("relevance_score") or 0)))
    result["updated_date"] = result.get("updated_date") or result.get("published_date") or ""
    result["published_date"] = str(result.get("published_date") or "")[:10]
    result["last_checked"] = result["last_checked"] or today_iso()
    result.setdefault("fact_confidence", "verified-metadata")
    result.setdefault("analysis_status", "ready" if result.get("summary_one_sentence") else "pending")
    result.setdefault("source_query_group", "")
    result.setdefault("potential_competition", False)
    result.setdefault("competition_reason", "")
    result.setdefault("borrowable_methods", [])
    result.setdefault("trend_bucket", "")
    result.setdefault("ai_provider", "manual" if result["analysis_status"] == "ready" else "")
    result.setdefault("ai_generated_at", "")
    return result


def validate_paper(paper: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = [field for field in REQUIRED_FIELDS if field not in paper]
    if missing:
        errors.append("missing fields: " + ", ".join(missing))
    if not paper.get("title"):
        errors.append("title is empty")
    if not isinstance(paper.get("authors"), list):
        errors.append("authors must be a list")
    if not paper.get("paper_url"):
        errors.append("paper_url is empty")
    score = paper.get("relevance_score")
    if not isinstance(score, int) or not 0 <= score <= 100:
        errors.append("relevance_score must be an integer from 0 to 100")
    for field in ("research_topics", "methods", "tasks", "sensors", "keywords"):
        if not isinstance(paper.get(field), list):
            errors.append(f"{field} must be a list")
    return errors


def validate_collection(papers: Iterable[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    ids: set[str] = set()
    titles: set[str] = set()
    for index, paper in enumerate(papers):
        for error in validate_paper(paper):
            errors.append(f"[{index}] {error}")
        pid = str(paper.get("paper_id") or "")
        if pid in ids:
            errors.append(f"[{index}] duplicate paper_id: {pid}")
        ids.add(pid)
        normalized = normalize_title(paper.get("title"))
        if normalized and normalized in titles:
            errors.append(f"[{index}] duplicate normalized title: {normalized}")
        titles.add(normalized)
    return errors


def stars_for_score(score: int) -> str:
    filled = max(0, min(5, int(round(score / 20))))
    return "★" * filled + "☆" * (5 - filled)


def parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
