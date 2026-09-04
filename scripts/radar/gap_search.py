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

def _fetch_json(url: str, headers: dict | None = None, timeout: int = 30) -> dict | None:
    hdrs = {"User-Agent": "EmbodiedResearchRadar/0.1 (gap-search)"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def search_openalex(query: str, limit: int = 20) -> list[dict]:
    """Search OpenAlex works API."""
    encoded = urllib.parse.quote(query)
    url = f"https://api.openalex.org/works?search={encoded}&per_page={limit}&sort=relevance_score:desc"
    data = _fetch_json(url)
    if not data:
        return []
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
    """Search Semantic Scholar paper search API."""
    encoded = urllib.parse.quote(query)
    fields = "title,authors,abstract,year,externalIds,url,publicationDate"
    url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={encoded}&limit={limit}&fields={fields}"
    data = _fetch_json(url)
    if not data:
        return []
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
    """Search arXiv Atom API."""
    encoded = urllib.parse.quote(query, safe="")
    url = f"https://export.arxiv.org/api/query?search_query=all:{encoded}&start=0&max_results={limit}&sortBy=submittedDate&sortOrder=descending"
    req = urllib.request.Request(url, headers={"User-Agent": "EmbodiedResearchRadar/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            xml = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(xml)
    except ET.ParseError:
        return []

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

def search_gap(gap_id: str, force_refresh: bool = False) -> dict[str, Any]:
    """Search all providers for evidence related to a specific gap."""
    queries = GAP_QUERIES.get(gap_id, [])
    if not queries:
        return {"error": f"Unknown gap: {gap_id}"}

    all_results: list[dict] = []

    for query in queries:
        # OpenAlex
        oa = search_openalex(query)
        for p in oa:
            p["query"] = query
        all_results.extend(oa)
        time.sleep(0.3)

        # Semantic Scholar
        ss = search_semantic_scholar(query)
        for p in ss:
            p["query"] = query
        all_results.extend(ss)
        time.sleep(0.3)

        # arXiv
        ax = search_arxiv(query)
        for p in ax:
            p["query"] = query
        all_results.extend(ax)
        time.sleep(0.3)

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

    return {
        "gap_id": gap_id,
        "claim_version": GAP_CLAIM_VERSIONS.get(gap_id, 1),
        "queries": queries,
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
        "searched_at": date.today().isoformat(),
    }


def search_all_gaps(force_refresh: bool = False) -> dict[str, Any]:
    """Search all gaps and return combined results."""
    # Load cache
    cache: dict[str, Any] = {}
    if CACHE_PATH.exists() and not force_refresh:
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
