from __future__ import annotations

import argparse
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from .schema import clean_paper, normalize_arxiv_id, paper_id_for
except ImportError:  # Allows `python scripts/radar/arxiv_fetcher.py` for quick diagnostics.
    from schema import clean_paper, normalize_arxiv_id, paper_id_for


ROOT = Path(__file__).resolve().parents[2]
ATOM = {"a": "http://www.w3.org/2005/Atom", "opensearch": "http://a9.com/-/spec/opensearch/1.1/"}


def _request(url: str, user_agent: str, timeout: int = 45) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept": "application/atom+xml"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def fetch_method_image(arxiv_id: str, user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", timeout: int = 30) -> str:
    """Return the first real figure URL from the arXiv HTML version of a paper, or empty string."""
    try:
        base = f"https://arxiv.org/html/{arxiv_id}"
        request = urllib.request.Request(base, headers={"User-Agent": user_agent})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            html = response.read().decode("utf-8", errors="ignore")
        for match in re.finditer(r"<img[^>]+src=[\"']([^\"']+)[\"']", html, re.I):
            src = match.group(1).strip()
            if not src or "/static/" in src or src.startswith("data:"):
                continue
            # arXiv HTML pages use version-qualified relative paths like "2505.13982v2/main.png",
            # which resolve against https://arxiv.org/html/ directly.
            return urllib.parse.urljoin("https://arxiv.org/html/", src)
        return ""
    except Exception:
        return ""


def query_arxiv(query: str, limit: int, user_agent: str, retries: int = 3, delay: float = 3.0) -> list[dict[str, Any]]:
    params = urllib.parse.urlencode({"search_query": query, "start": 0, "max_results": limit, "sortBy": "submittedDate", "sortOrder": "descending"})
    url = "https://export.arxiv.org/api/query?" + params
    error: Exception | None = None
    for attempt in range(retries):
        try:
            payload = _request(url, user_agent)
            root = ET.fromstring(payload)
            papers: list[dict[str, Any]] = []
            for entry in root.findall("a:entry", ATOM):
                entry_id = (entry.findtext("a:id", default="", namespaces=ATOM)).strip()
                arxiv_id = normalize_arxiv_id(entry_id)
                title = " ".join((entry.findtext("a:title", default="", namespaces=ATOM) or "").split())
                abstract = " ".join((entry.findtext("a:summary", default="", namespaces=ATOM) or "").split())
                published = (entry.findtext("a:published", default="", namespaces=ATOM) or "")[:10]
                updated = (entry.findtext("a:updated", default="", namespaces=ATOM) or "")[:10]
                authors = [(a.findtext("a:name", default="", namespaces=ATOM) or "").strip() for a in entry.findall("a:author", ATOM)]
                categories = [x.attrib.get("term", "") for x in entry.findall("a:category", ATOM)]
                primary = categories[0] if categories else ""
                paper = clean_paper({
                    "paper_id": paper_id_for(arxiv_id, title), "title": title, "authors": authors,
                    "abstract": abstract, "published_date": published, "updated_date": updated,
                    "year": int(published[:4] or 0), "venue": "Preprint / arXiv", "arxiv_id": arxiv_id,
                    "paper_url": f"https://arxiv.org/abs/{arxiv_id}", "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}",
                    "source": "arXiv", "last_checked": datetime.now(timezone.utc).date().isoformat(),
                    "keywords": categories + [primary], "source_categories": categories,
                })
                papers.append(paper)
            return papers
        except Exception as exc:  # network and malformed responses should not erase existing data
            error = exc
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    print(f"arXiv query failed after {retries} attempts: {error}")
    return []


def load_query_groups(path: Path | None = None) -> list[dict[str, Any]]:
    path = path or ROOT / "config/queries.json"
    return json.loads(path.read_text(encoding="utf-8"))["query_groups"]


def collect(query_groups: list[dict[str, Any]], limit_per_query: int, user_agent: str, retries: int, delay: float) -> list[dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    allowed_categories = set(json.loads((ROOT / "config/queries.json").read_text(encoding="utf-8")).get("allowed_primary_categories", []))
    for group in query_groups:
        for query in group["queries"]:
            for paper in query_arxiv(query, limit_per_query, user_agent, retries, delay):
                categories = set(paper.get("source_categories", []))
                if allowed_categories and not (categories & allowed_categories):
                    continue
                paper["source_query_group"] = group["id"]
                paper["research_topics"] = [group["topic"]]
                key = paper.get("arxiv_id") or paper.get("paper_id")
                if key and key not in collected:
                    collected[key] = paper
            if delay:
                time.sleep(delay)
    return list(collected.values())


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch candidate papers from the arXiv Atom API.")
    parser.add_argument("--limit-per-query", type=int, default=50)
    parser.add_argument("--output", default=str(ROOT / "data/candidates.json"))
    args = parser.parse_args()
    import os
    papers = collect(load_query_groups(), args.limit_per_query, os.getenv("ARXIV_USER_AGENT", "EmbodiedResearchRadar/0.1"), int(os.getenv("ARXIV_MAX_RETRIES", "3")), float(os.getenv("ARXIV_DELAY_SECONDS", "3")))
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(papers, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"fetched {len(papers)} unique candidates")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
