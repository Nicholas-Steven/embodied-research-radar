"""External literature search for Research Gap evidence.

Searches OpenAlex, Semantic Scholar, and arXiv for papers related to each
identified Research Gap.  Results are stored in data/gap_search_results.json
and never mixed into data/papers.json automatically.

All network calls are optional and degrade gracefully:
  - No API key → skip that provider
  - Network error → use cached results
  - No cache → show "search unavailable" in UI
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CACHE_PATH = ROOT / "data" / "gap_search_results.json"

# ---------------------------------------------------------------------------
# Provider health model
# ---------------------------------------------------------------------------
# A provider query that fails (HTTP error, timeout, network error, parse
# error) must NEVER be reported as a genuine zero. Genuine zero is only an
# HTTP 200 with a successfully parsed, empty result list.

PROVIDERS = ("openalex", "semantic_scholar", "arxiv")
PROVIDER_SOURCE_TAG = {
    "openalex": "openalex",
    "semantic_scholar": "semantic-scholar",
    "arxiv": "arxiv",
}

STATUS_SUCCESS_RESULTS = "success_with_results"
STATUS_SUCCESS_ZERO = "success_zero_results"
STATUS_FAILED = "failed"
STATUS_NOT_RUN = "not_run"

FRESH = "fresh"
STALE_LKG = "stale_lkg"          # this round failed; last-known-good preserved
MIXED = "mixed"                  # degraded: fresh partial ∪ provider LKG
NOT_RUN_FRESHNESS = "not_run"


class ProviderError(Exception):
    """Raised when a provider request or parse fails. `.reason` is a short,
    secret-free classification safe to embed in public JSON."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


def _provider_state(attempts: int, succeeded: int, results: int) -> tuple[str, bool]:
    """Return (status, degraded). degraded=True when only part of the
    provider's queries succeeded but some results were still obtained."""
    if attempts == 0:
        return STATUS_NOT_RUN, False
    if succeeded == 0:
        return STATUS_FAILED, False
    if results > 0:
        return STATUS_SUCCESS_RESULTS, succeeded < attempts
    return STATUS_SUCCESS_ZERO, succeeded < attempts

# ---------------------------------------------------------------------------
# Query templates per gap
# ---------------------------------------------------------------------------

GAP_QUERIES: dict[str, list[str]] = {
    "physical-state-aliasing": [
        '"robot manipulation" AND vision AND force AND "task success"',
        '"robot manipulation" AND "false success"',
        '"physical state" AND verification AND robot manipulation',
        'visuotactile AND "outcome verification"',
        'multimodal AND "task success prediction" AND manipulation',
    ],
    "failure-detection-vs-diagnosis": [
        'robot manipulation failure diagnosis',
        'robot manipulation failure classification',
        'multimodal manipulation failure identification',
        'robot anomaly detection diagnosis manipulation',
        '"failure mode" AND classification AND manipulation',
    ],
    "detection-without-recovery": [
        '"failure detection" AND robot AND NOT recovery',
        '"anomaly detection" AND manipulation AND "no recovery"',
        '"execution monitoring" AND robot AND recovery',
        '"failure detection" AND "closed-loop" AND manipulation',
    ],
    "recovery-without-reverification": [
        '"post-recovery verification" AND robot',
        '"task completion check" AND manipulation AND recovery',
        '"success detector" AND robot AND manipulation',
        '"closed-loop recovery" AND manipulation',
        '"post-action observation" AND robot',
        '"state re-observation" AND manipulation',
        '"task outcome verification" AND robot',
        '"termination condition" AND manipulation AND recovery',
        '"rollout verification" AND robot AND manipulation',
    ],
    "temporal-6d-ft-evidence": [
        '"force torque history" AND "failure detection" AND robot manipulation',
        '"temporal force torque" AND "task success" AND manipulation',
        '"6D F/T" AND "outcome verification"',
        '"force torque" AND "false success" AND robot',
        'vision force AND "success prediction" AND manipulation',
        'RGB force torque AND verification AND manipulation',
    ],
    "outcome-vs-evidence-sufficiency": [
        '"evidence sufficiency" AND robot AND manipulation',
        '"outcome prediction" AND uncertainty AND manipulation',
        '"task success prediction" AND "evidence" AND robot',
        '"decision boundary" AND manipulation AND uncertainty',
    ],
    "false-success-risk": [
        '"false success" AND robot AND manipulation',
        '"success risk" AND manipulation AND robot',
        '"premature success" AND robot',
        '"misclassified success" AND manipulation',
    ],
    "failure-to-recovery-hierarchy": [
        '"failure mode" AND "recovery strategy" AND robot',
        '"failure taxonomy" AND manipulation AND recovery',
        '"recovery policy selection" AND robot',
        '"failure classification" AND "recovery" AND manipulation',
    ],
    "selective-human-escalation": [
        'visuotactile failure recovery human intervention',
        'vision force robot failure uncertainty human intervention',
        'robot manipulation uncertainty selective human intervention',
        'robot asks for help manipulation uncertainty',
        'failure recovery human escalation robot manipulation',
        'evidence sufficiency human intervention robotics',
    ],
    "learning-from-corrections": [
        '"human correction" AND robot AND failure AND recovery',
        '"learning from intervention" AND robot AND failure AND recovery',
        '"corrective demonstration" AND failure AND recovery AND manipulation',
        '"human correction" AND visuotactile AND manipulation',
        '"human intervention" AND frozen AND VLA AND recovery',
        '"learning recovery" AND "correction" AND "without" AND policy',
        '"memory from human corrections" AND robot AND recovery',
    ],
    "benchmark-gap": [
        '"benchmark" AND "force torque" AND manipulation AND failure',
        '"evaluation benchmark" AND "vision force" AND robot',
        '"failure recovery benchmark" AND manipulation',
        '"contact-rich" AND benchmark AND manipulation',
    ],
    "cross-task-generalization": [
        '"cross-task" AND "force" AND manipulation AND generalization',
        '"cross-robot" AND "vision force" AND transfer',
        '"domain transfer" AND "force" AND manipulation',
        '"cross-task generalization" AND robot AND manipulation',
    ],
}

# Claim versions: track which version of the Research Question each gap is on.
# When a gap's claim is substantially narrowed, bump its version here.
# build_landscape.py compares this with the gap's claim_version to detect stale evidence.
GAP_CLAIM_VERSIONS: dict[str, int] = {
    "physical-state-aliasing": 1,
    "failure-detection-vs-diagnosis": 1,
    "detection-without-recovery": 1,
    "recovery-without-reverification": 1,
    "temporal-6d-ft-evidence": 2,
    "outcome-vs-evidence-sufficiency": 1,
    "false-success-risk": 1,
    "failure-to-recovery-hierarchy": 1,
    "selective-human-escalation": 2,
    "learning-from-corrections": 2,
    "benchmark-gap": 1,
    "cross-task-generalization": 1,
}

# Evidence classification patterns (same logic as build_landscape.py)
_VF_RE = re.compile(
    r"vision[-– ]?(?:force|torque)|force[-– ]?aware|force/torque|visuotactile|"
    r"tactile.*visual|visual.*tactile|contact.rich|contact.state|force.sensing", re.I
)
_FORCE_SENSOR_RE = re.compile(
    r"force.torque|6.axis|six.axis|wrench|f.t sensor|force.sensing|"
    r"tactile|visuotactile|contact.rich|contact-aware", re.I
)
_FAILURE_RE = re.compile(
    r"failure|recover|replan|anomaly.detect|success.predict|error.recover|"
    r"execution.monitor|task.success", re.I
)


# ---------------------------------------------------------------------------
# Normalization & dedup
# ---------------------------------------------------------------------------

def _normalize_doi(doi: str) -> str:
    doi = doi.strip().lower()
    doi = doi.removeprefix("https://doi.org/").removeprefix("http://dx.doi.org/")
    return doi


def _normalize_arxiv_id(raw: str) -> str:
    raw = raw.strip()
    m = re.search(r"(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:)([^?#/]+)", raw, re.I)
    identifier = m.group(1) if m else raw
    identifier = identifier.removesuffix(".pdf")
    return re.sub(r"v\d+$", "", identifier, flags=re.I)


def _normalize_title(title: str) -> str:
    value = re.sub(r"[^a-z0-9]+", " ", title.lower())
    return re.sub(r"\s+", " ", value).strip()


def _paper_fingerprint(paper: dict) -> str:
    """Return a stable fingerprint for dedup."""
    doi = _normalize_doi(paper.get("doi", ""))
    if doi:
        return f"doi:{doi}"
    arxiv = _normalize_arxiv_id(paper.get("arxiv_id", ""))
    if arxiv:
        return f"arxiv:{arxiv}"
    s2 = paper.get("semantic_scholar_id", "")
    if s2:
        return f"s2:{s2}"
    oalex = paper.get("openalex_id", "")
    if oalex:
        return f"openalex:{oalex}"
    title = _normalize_title(paper.get("title", ""))
    if title:
        return f"title:{title}"
    return f"hash:{hashlib.md5(json.dumps(paper, sort_keys=True).encode()).hexdigest()[:16]}"


def deduplicate(papers: list[dict]) -> list[dict]:
    """Deduplicate papers by DOI > arXiv ID > S2/OA ID > normalized title."""
    seen: dict[str, dict] = {}
    result: list[dict] = []
    for p in papers:
        fp = _paper_fingerprint(p)
        if fp in seen:
            # Merge sources
            existing = seen[fp]
            existing_sources = set(existing.get("sources", []))
            existing_sources.update(p.get("sources", []))
            existing["sources"] = sorted(existing_sources)
            # Keep richer abstract/title
            if len(p.get("abstract", "")) > len(existing.get("abstract", "")):
                existing["abstract"] = p["abstract"]
        else:
            seen[fp] = p
            result.append(p)
    return result


# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

def _fetch_json(url: str, headers: dict | None = None, timeout: int = 30) -> dict:
    """Fetch JSON. Any network/HTTP/parse failure raises ProviderError with a
    short secret-free reason — never a silent None."""
    hdrs = {"User-Agent": "EmbodiedResearchRadar/0.1 (gap-search)"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        raise ProviderError(f"http_{e.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ProviderError(f"network_{type(e).__name__}") from None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        raise ProviderError("json_parse_error") from None


def search_openalex(query: str, limit: int = 20) -> list[dict]:
    """Search OpenAlex works API. Raises ProviderError on failure."""
    encoded = urllib.parse.quote(query)
    url = f"https://api.openalex.org/works?search={encoded}&per_page={limit}&sort=relevance_score:desc"
    data = _fetch_json(url)
    results = []
    for w in data.get("results", []):
        doi = (w.get("doi") or "").removeprefix("https://doi.org/")
        title = w.get("title", "")
        abstract_inv = w.get("abstract_inverted_index")
        abstract = ""
        if abstract_inv:
            # Reconstruct abstract from inverted index
            positions: list[tuple[int, str]] = []
            for word, idxs in abstract_inv.items():
                for idx in idxs:
                    positions.append((idx, word))
            abstract = " ".join(w for _, w in sorted(positions))
        results.append({
            "paper_id": f"openalex-{w.get('id','').split('/')[-1]}",
            "title": title,
            "authors": [a.get("author", {}).get("display_name", "") for a in w.get("authorships", [])[:10]],
            "abstract": abstract[:2000],
            "published_date": (w.get("publication_date") or "")[:10],
            "year": w.get("publication_year"),
            "doi": doi,
            "arxiv_id": "",
            "openalex_id": w.get("id", "").split("/")[-1],
            "source": "openalex",
            "sources": ["openalex"],
            "url": w.get("doi") or "",
        })
    return results


def search_semantic_scholar(query: str, limit: int = 20) -> list[dict]:
    """Search Semantic Scholar paper search API. Raises ProviderError on failure."""
    encoded = urllib.parse.quote(query)
    fields = "title,authors,abstract,year,externalIds,url,publicationDate"
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded}&limit={limit}&fields={fields}"
    data = _fetch_json(url)
    results = []
    for p in data.get("data", []):
        ext = p.get("externalIds", {})
        doi = ext.get("DOI", "")
        arxiv_id = ext.get("ArXiv", "")
        results.append({
            "paper_id": f"s2-{p.get('paperId','')}",
            "title": p.get("title", ""),
            "authors": [a.get("name", "") for a in p.get("authors", [])[:10]],
            "abstract": (p.get("abstract") or "")[:2000],
            "published_date": (p.get("publicationDate") or "")[:10],
            "year": p.get("year"),
            "doi": doi,
            "arxiv_id": arxiv_id,
            "semantic_scholar_id": p.get("paperId", ""),
            "source": "semantic-scholar",
            "sources": ["semantic-scholar"],
            "url": p.get("url", ""),
        })
    return results


def search_arxiv(query: str, limit: int = 20) -> list[dict]:
    """Search arXiv Atom API. Raises ProviderError on failure."""
    encoded = urllib.parse.quote(query, safe="")
    url = f"https://export.arxiv.org/api/query?search_query=all:{encoded}&start=0&max_results={limit}&sortBy=submittedDate&sortOrder=descending"
    req = urllib.request.Request(url, headers={"User-Agent": "EmbodiedResearchRadar/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            xml = resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        raise ProviderError(f"http_{e.code}") from None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        raise ProviderError(f"network_{type(e).__name__}") from None

    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        raise ProviderError("xml_parse_error") from None

    ns = {"a": "http://www.w3.org/2005/Atom"}
    results = []
    for entry in root.findall("a:entry", ns):
        entry_id = (entry.findtext("a:id", default="", namespaces=ns)).strip()
        arxiv_id = _normalize_arxiv_id(entry_id)
        title = " ".join((entry.findtext("a:title", default="", namespaces=ns) or "").split())
        abstract = " ".join((entry.findtext("a:summary", default="", namespaces=ns) or "").split())
        published = (entry.findtext("a:published", default="", namespaces=ns) or "")[:10]
        authors = [(a.findtext("a:name", default="", namespaces=ns) or "").strip()
                    for a in entry.findall("a:author", ns)]
        results.append({
            "paper_id": f"arxiv-{arxiv_id.replace('.', '-')}",
            "title": title,
            "authors": authors[:10],
            "abstract": abstract[:2000],
            "published_date": published,
            "year": int(published[:4]) if published[:4].isdigit() else None,
            "doi": "",
            "arxiv_id": arxiv_id,
            "source": "arxiv",
            "sources": ["arxiv"],
            "url": f"https://arxiv.org/abs/{arxiv_id}",
        })
    return results


# ---------------------------------------------------------------------------
# Evidence classification
# ---------------------------------------------------------------------------

def classify_external_evidence(paper: dict, gap_id: str) -> str:
    """Classify an external paper as SUPPORT / COUNTER / NEUTRAL for a gap."""
    text = f"{paper.get('title','')} {paper.get('abstract','')}".lower()
    has_vf = bool(_VF_RE.search(text))
    has_force = bool(_FORCE_SENSOR_RE.search(text))
    has_failure = bool(_FAILURE_RE.search(text))

    # Gap-specific classification
    if gap_id == "recovery-without-reverification":
        if re.search(r"re.verif|post.recover|success.detect|closed.loop|termination|completion.check", text):
            return "counter"
        if re.search(r"recover|replan|retry|correct", text) and not re.search(r"re.verif|closed.loop", text):
            return "support"

    elif gap_id == "temporal-6d-ft-evidence":
        if re.search(r"temporal.*force|force.*temporal|force.*history|force.*sequence", text) and has_vf:
            return "counter"
        if has_force and re.search(r"temporal|history|sequence|time.series", text):
            return "counter"

    elif gap_id == "selective-human-escalation":
        if re.search(r"human.in.the.loop|human.intervention|selective.intervention", text):
            if re.search(r"uncertainty|confidence|calibrat", text):
                return "counter"
            return "support"

    elif gap_id == "learning-from-corrections":
        if re.search(r"human.correct|corrective.demonstration|learning.from.correction", text):
            return "support"
        if re.search(r"force.feedback|tactile.feedback|feedback.control", text):
            return "neutral"

    elif gap_id == "physical-state-aliasing":
        if re.search(r"false.success|physical.state.*verif|visual.*physical.*mismatch", text):
            return "support"
        if re.search(r"contact.*verif|force.*validation|state.*ground", text):
            return "counter"

    # Generic fallback
    if has_failure and (has_vf or has_force):
        return "support"
    return "neutral"


# ---------------------------------------------------------------------------
# Main search orchestrator
# ---------------------------------------------------------------------------

_SEARCHERS = {
    "openalex": search_openalex,
    "semantic_scholar": search_semantic_scholar,
    "arxiv": search_arxiv,
}


def _search_provider(provider: str, queries: list[str]) -> tuple[list[dict], dict]:
    """Run one provider across all queries for a gap.

    Returns (papers, health) where health captures the four-state model:
    SUCCESS_WITH_RESULTS / SUCCESS_ZERO_RESULTS / FAILED / NOT_RUN. A FAILED
    provider NEVER returns a fake empty paper list — the caller must fall
    back to last-known-good evidence instead.
    """
    papers: list[dict] = []
    succeeded = 0
    first_error = ""
    for query in queries:
        try:
            found = _SEARCHERS[provider](query)
        except ProviderError as e:
            if not first_error:
                first_error = e.reason
            time.sleep(0.3)  # keep spacing even after failures (rate limits)
            continue
        succeeded += 1
        for p in found:
            p["query"] = query
        papers.extend(found)
        time.sleep(0.3)  # per-query request spacing, as before the refactor
    status, degraded = _provider_state(len(queries), succeeded, len(papers))
    return papers, {
        "status": status,
        "degraded": degraded,
        "queries_attempted": len(queries),
        "queries_succeeded": succeeded,
        "result_count": len(papers),
        "error": first_error if status == STATUS_FAILED or degraded else "",
    }


def _merge_lkg(
    fresh_by_provider: dict[str, list[dict]],
    health: dict[str, dict],
    previous: dict[str, Any] | None,
    today: str,
) -> tuple[list[dict], dict, dict]:
    """Merge this round's fresh provider results with last-known-good (LKG)
    provider results preserved from the previous run.

    Data-safety rule: a provider that FAILED this round keeps its previous
    successful evidence (marked stale_lkg); only a FULLY successful search
    (all queries OK, including a true zero) may overwrite it. A DEGRADED
    provider (some queries failed) has only a partial view this round, so its
    fresh partial results are UNIONed with the previous provider evidence —
    an incomplete round must never delete last-known-good records.
    """
    merged: list[dict] = []
    lkg_info: dict[str, int] = {}
    for provider in PROVIDERS:
        h = health[provider]
        tag = PROVIDER_SOURCE_TAG[provider]
        prev_lkg = _previous_provider_papers(previous, tag) if previous is not None else []
        prev_full = (previous or {}).get("provider_last_full_success", {}).get(provider, "")
        if h["status"] in (STATUS_SUCCESS_RESULTS, STATUS_SUCCESS_ZERO) and not h.get("degraded"):
            # FULL SUCCESS: this round's view is complete → normal replace,
            # including a genuine zero. This is also how stale evidence
            # eventually gets cleaned up.
            h["freshness"] = FRESH
            h["last_success_at"] = today
            h["last_full_success_at"] = today
            h["preserved_from"] = ""
            merged.extend(fresh_by_provider[provider])
        elif h["status"] in (STATUS_SUCCESS_RESULTS, STATUS_SUCCESS_ZERO) and h.get("degraded"):
            # DEGRADED: partial fresh results UNION previous provider LKG.
            h["freshness"] = MIXED
            h["last_success_at"] = today
            h["last_full_success_at"] = prev_full
            h["preserved_from"] = previous.get("searched_at", "") if prev_lkg else ""
            fresh_ids = {_paper_fingerprint(p) for p in fresh_by_provider[provider]}
            kept = [p for p in prev_lkg if _paper_fingerprint(p) not in fresh_ids]
            merged.extend(fresh_by_provider[provider])
            if kept:
                lkg_info[provider] = len(kept)
                merged.extend(kept)
        elif previous is not None:
            # FAILED this round → preserve last-known-good provider evidence.
            if prev_lkg:
                h["freshness"] = STALE_LKG
                h["preserved_from"] = previous.get("searched_at", "")
                h["last_success_at"] = previous.get("provider_last_success", {}).get(provider, "")
                h["last_full_success_at"] = prev_full
                lkg_info[provider] = len(prev_lkg)
                merged.extend(prev_lkg)
            else:
                h["freshness"] = STALE_LKG
                h["preserved_from"] = ""
                h["last_success_at"] = h.get("last_success_at", "")
                h["last_full_success_at"] = prev_full
        else:
            # No previous evidence at all.
            h["freshness"] = NOT_RUN_FRESHNESS
            h["preserved_from"] = ""
            h["last_success_at"] = ""
            h["last_full_success_at"] = ""
    return merged, lkg_info, {}


def _previous_provider_papers(previous_gap: dict[str, Any], source_tag: str) -> list[dict]:
    """Extract a previous run's papers contributed by one provider."""
    papers: list[dict] = []
    for bucket in ("supporting", "counter", "neutral"):
        for p in previous_gap.get(bucket, []):
            if source_tag in (p.get("sources") or []):
                papers.append(dict(p))
    return papers


def search_gap(gap_id: str, force_refresh: bool = False) -> dict[str, Any]:
    """Search all providers for evidence related to a specific gap."""
    queries = GAP_QUERIES.get(gap_id, [])
    if not queries:
        return {"error": f"Unknown gap: {gap_id}"}

    previous: dict[str, Any] | None = None
    if CACHE_PATH.exists():
        try:
            cache_all = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            prev_gap = cache_all.get("gaps", {}).get(gap_id)
            if isinstance(prev_gap, dict) and "error" not in prev_gap:
                previous = prev_gap
        except (json.JSONDecodeError, OSError):
            previous = None

    fresh_by_provider: dict[str, list[dict]] = {}
    health: dict[str, dict] = {}
    all_ok_providers = 0
    for provider in PROVIDERS:
        papers, h = _search_provider(provider, queries)
        fresh_by_provider[provider] = papers
        health[provider] = h
        if h["status"] in (STATUS_SUCCESS_RESULTS, STATUS_SUCCESS_ZERO):
            all_ok_providers += 1

    if all_ok_providers == 0:
        # Every provider failed — never fabricate a zero round.
        raise ProviderError("all_providers_failed")

    today = date.today().isoformat()
    all_results, lkg_counts, _ = _merge_lkg(fresh_by_provider, health, previous, today)

    # Deduplicate
    deduped = deduplicate(all_results)

    # Classify
    supporting = []
    counter = []
    neutral = []
    for p in deduped:
        evidence_type = classify_external_evidence(p, gap_id)
        p["evidence_type"] = evidence_type
        if evidence_type == "support":
            supporting.append(p)
        elif evidence_type == "counter":
            counter.append(p)
        else:
            neutral.append(p)

    fresh_providers = sum(
        1 for h in health.values() if h.get("freshness") == FRESH
    )
    coverage_status = "fresh" if fresh_providers == len(PROVIDERS) else "degraded"
    preserved_lkg = sum(lkg_counts.values())

    provider_last_success = {}
    if previous:
        provider_last_success = dict(previous.get("provider_last_success", {}))
    provider_last_full_success = {}
    if previous:
        provider_last_full_success = dict(previous.get("provider_last_full_success", {}))
    for provider, h in health.items():
        if h.get("last_success_at"):
            provider_last_success[provider] = h["last_success_at"]
        if h.get("last_full_success_at"):
            provider_last_full_success[provider] = h["last_full_success_at"]

    return {
        "gap_id": gap_id,
        "claim_version": GAP_CLAIM_VERSIONS.get(gap_id, 1),
        "queries": queries,
        "provider_status": {p: health[p]["status"] for p in PROVIDERS},
        "provider_result_count": {p: health[p]["result_count"] for p in PROVIDERS},
        "provider_health": health,
        "provider_last_success": provider_last_success,
        "provider_last_full_success": provider_last_full_success,
        "coverage_status": coverage_status,
        "fresh_providers": fresh_providers,
        "preserved_lkg_count": preserved_lkg,
        "sources": {
            "openalex": len([p for p in all_results if "openalex" in p.get("sources", [])]),
            "semantic_scholar": len([p for p in all_results if "semantic-scholar" in p.get("sources", [])]),
            "arxiv": len([p for p in all_results if "arxiv" in p.get("sources", [])]),
        },
        "total_retrieved": len(all_results),
        "unique_after_dedup": len(deduped),
        "supporting_count": len(supporting),
        "counter_count": len(counter),
        "neutral_count": len(neutral),
        "supporting": supporting[:20],
        "counter": counter[:20],
        "neutral": neutral[:20],
        "searched_at": today,
    }


def provider_health_summary(results: dict[str, Any]) -> str:
    """Human-readable provider health report for stdout / GITHUB_STEP_SUMMARY."""
    gaps = results.get("gaps", {})
    totals = {p: {"success": 0, "failed": 0, "not_run": 0, "queries": 0, "ok_queries": 0} for p in PROVIDERS}
    degraded_gaps = 0
    preserved_total = 0
    fresh_gaps = 0
    lines = ["### Provider Health", ""]
    for gap_id, gap in sorted(gaps.items()):
        ph = gap.get("provider_health") or {}
        if not ph:
            continue
        if gap.get("coverage_status") == "degraded":
            degraded_gaps += 1
        if gap.get("coverage_status") == "fresh":
            fresh_gaps += 1
        preserved_total += gap.get("preserved_lkg_count", 0) or 0
        for p in PROVIDERS:
            h = ph.get(p) or {}
            t = totals[p]
            t["queries"] += h.get("queries_attempted", 0) or 0
            t["ok_queries"] += h.get("queries_succeeded", 0) or 0
            status = h.get("status", STATUS_NOT_RUN)
            if status in (STATUS_SUCCESS_RESULTS, STATUS_SUCCESS_ZERO):
                t["success"] += 1
            elif status == STATUS_FAILED:
                t["failed"] += 1
            else:
                t["not_run"] += 1
    total_gaps = len([g for g in gaps.values() if g.get("provider_health")])
    lines.append(f"Gaps searched: {total_gaps}  (fresh: {fresh_gaps}, degraded: {degraded_gaps})")
    lines.append(f"Preserved last-known-good provider results: {preserved_total}")
    lines.append("")
    for p in PROVIDERS:
        t = totals[p]
        healthy = t["failed"] == 0 and t["not_run"] == 0
        state = "healthy" if healthy else ("failed" if t["success"] == 0 and t["failed"] > 0 else "degraded")
        lines.append(f"- {p}: {state} (gap success {t['success']}, failed {t['failed']}, "
                     f"not_run {t['not_run']}; queries {t['ok_queries']}/{t['queries']})")
    return "\n".join(lines)


def _emit_step_summary(results: dict[str, Any]) -> None:
    """Append the provider health report to GITHUB_STEP_SUMMARY when present."""
    import os
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(provider_health_summary(results) + "\n")
    except OSError:
        pass


def search_all_gaps(force_refresh: bool = False) -> dict[str, Any]:
    """Search all gaps and return combined results."""
    # Load cache. Even with --refresh we seed the results with previous gaps:
    # intermediate saves below must never erase last-known-good evidence for
    # gaps that have not been searched yet (a mid-run provider failure would
    # otherwise destroy their old evidence).
    cache: dict[str, Any] = {}
    if CACHE_PATH.exists():
        try:
            cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            cache = {}

    results: dict[str, Any] = {
        "generated_at": date.today().isoformat(),
        "gaps": cache.get("gaps", {}),
    }

    for gap_id in GAP_QUERIES:
        # Use cache if available and not forcing refresh
        if gap_id in results["gaps"] and not force_refresh:
            continue
        print(f"  searching {gap_id}...")
        gap_result = search_gap(gap_id, force_refresh)
        results["gaps"][gap_id] = gap_result
        # Save intermediate results
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        CACHE_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        time.sleep(1)

    _emit_step_summary(results)
    return results


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description="Search external literature for Research Gap evidence.")
    parser.add_argument("--gap", type=str, help="Search a specific gap ID")
    parser.add_argument("--all", action="store_true", help="Search all gaps")
    parser.add_argument("--refresh", action="store_true", help="Force refresh, ignore cache")
    parser.add_argument("--output", type=str, help="Output path (default: data/gap_search_results.json)")
    parser.add_argument("--source", type=str, default="local", help="Update source: local | scheduled | manual-workflow")
    args = parser.parse_args()

    global CACHE_PATH
    if args.output:
        CACHE_PATH = Path(args.output)

    if args.gap:
        print(f"Searching gap: {args.gap}")
        result = search_gap(args.gap, force_refresh=args.refresh)
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Merge with existing cache
        existing = {}
        if CACHE_PATH.exists():
            try:
                existing = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                pass
        existing.setdefault("generated_at", date.today().isoformat())
        existing.setdefault("gaps", {})
        existing["gaps"][args.gap] = result
        existing["generated_at"] = date.today().isoformat()
        existing["update_source"] = args.source
        CACHE_PATH.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"  retrieved: {result.get('total_retrieved',0)}")
        print(f"  unique: {result.get('unique_after_dedup',0)}")
        print(f"  supporting: {result.get('supporting_count',0)}")
        print(f"  counter: {result.get('counter_count',0)}")
    elif args.all:
        print("Searching all gaps...")
        results = search_all_gaps(force_refresh=args.refresh)
        print(f"Done. Results at {CACHE_PATH}")
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
