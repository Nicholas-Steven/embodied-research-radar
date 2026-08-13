from __future__ import annotations

import argparse
import json
import os
import random
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


def _retry_after_seconds(exc: urllib.error.HTTPError) -> float | None:
    value = exc.headers.get("Retry-After") if exc.headers else None
    if not value:
        return None
    try:
        return max(1.0, min(float(value), 300.0))
    except ValueError:
        return None


METHOD_HINT_KEYWORDS = ("overview", "framework", "method", "architecture", "pipeline", "system", "approach", "model", "training", "inference")
METHOD_PENALTY_KEYWORDS = ("results", "result", "accuracy", "bar chart", "line chart", "qualitative", "example")


def fetch_method_figure(arxiv_id: str, user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", timeout: int = 30) -> dict[str, str]:
    """Pick the best method/framework figure from the arXiv HTML version.

    Returns {"url": ..., "caption": ...}. Scores figures by keywords in the
    caption (method hints win, pure result/quantitative figures lose), so the
    teaser/cover image is no longer picked blindly.
    """
    try:
        base = f"https://arxiv.org/html/{arxiv_id}"
        request = urllib.request.Request(base, headers={"User-Agent": user_agent})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return {"url": "", "caption": ""}

    candidates: list[tuple[str, str]] = []
    for block in re.findall(r"<figure[^>]*>(.*?)</figure>", html, re.I | re.S):
        img = re.search(r"<img[^>]+src=[\"']([^\"']+)[\"']", block, re.I)
        if not img:
            continue
        src = img.group(1).strip()
        if not src or "/static/" in src or src.startswith("data:"):
            continue
        caption_match = re.search(r"<figcaption[^>]*>(.*?)</figcaption>", block, re.I | re.S)
        caption = re.sub(r"<[^>]+>", " ", caption_match.group(1)) if caption_match else ""
        caption = re.sub(r"\s+", " ", caption).strip()
        candidates.append((src, caption))

    if not candidates:  # fallback: any non-static image without a figure wrapper
        for img in re.finditer(r"<img[^>]+src=[\"']([^\"']+)[\"']", html, re.I):
            src = img.group(1).strip()
            if src and "/static/" not in src and not src.startswith("data:"):
                candidates.append((src, ""))

    if not candidates:
        return {"url": "", "caption": ""}

    def score(item: tuple[str, str]) -> int:
        text = f"{item[1]} {item[0]}".lower()
        value = sum(2 for kw in METHOD_HINT_KEYWORDS if kw in text)
        value -= sum(1 for kw in METHOD_PENALTY_KEYWORDS if kw in text)
        return value

    best = max(candidates, key=lambda item: (score(item), -candidates.index(item)))
    src, caption = best
    return {"url": urllib.parse.urljoin("https://arxiv.org/html/", src), "caption": caption}


def fetch_method_image(arxiv_id: str, user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", timeout: int = 30) -> str:
    """Backward-compatible helper returning just the figure URL."""
    return fetch_method_figure(arxiv_id, user_agent, timeout)["url"]


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
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                error = exc
                if attempt < retries - 1:
                    retry_after = _retry_after_seconds(exc)
                    if retry_after is not None:
                        wait = retry_after
                    else:
                        base = float(os.getenv("ARXIV_BACKOFF_BASE_SECONDS", "15"))
                        cap = float(os.getenv("ARXIV_BACKOFF_MAX_SECONDS", "120"))
                        wait = min(base * (2 ** attempt) + random.uniform(0, 5), cap)
                    print(f"arXiv rate limited (429), waiting {wait:.0f}s before retry {attempt + 1}/{retries}")
                    time.sleep(wait)
            elif exc.code in (400, 401, 403, 404):
                print(f"arXiv query rejected (HTTP {exc.code}), not retrying: {query}")
                return []
            else:  # 408 and 5xx are transient
                error = exc
                if attempt < retries - 1:
                    time.sleep(delay * (attempt + 1))
        except Exception as exc:  # network and malformed responses should not erase existing data
            error = exc
            if attempt < retries - 1:
                time.sleep(delay * (attempt + 1))
    print(f"arXiv query failed after {retries} attempts: {error}")
    return None  # exhausted by 429s; collect() decides whether to keep fetching


def load_query_groups(path: Path | None = None) -> list[dict[str, Any]]:
    path = path or ROOT / "config/queries.json"
    return json.loads(path.read_text(encoding="utf-8"))["query_groups"]


def collect(query_groups: list[dict[str, Any]], limit_per_query: int, user_agent: str, retries: int, delay: float, max_consecutive_429: int = 5) -> list[dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    consecutive_429 = 0
    allowed_categories = set(json.loads((ROOT / "config/queries.json").read_text(encoding="utf-8")).get("allowed_primary_categories", []))
    for group in query_groups:
        for query in group["queries"]:
            result = query_arxiv(query, limit_per_query, user_agent, retries, delay)
            if result is None:
                consecutive_429 += 1
                if consecutive_429 >= max_consecutive_429:
                    print("arXiv returned 429 repeatedly; skipping remaining queries to keep the radar update bounded.")
                    return list(collected.values())
            else:
                consecutive_429 = 0
            for paper in (result or []):
                categories = set(paper.get("source_categories", []))
                if allowed_categories and not (categories & allowed_categories):
                    continue
                key = paper.get("arxiv_id") or paper.get("paper_id")
                if not key:
                    continue
                if key not in collected:
                    paper["research_topics"] = [group["topic"]]
                    paper["source_query_groups"] = [group["id"]]
                    collected[key] = paper
                else:
                    # Same paper hit by another query group: merge topics and keep the richer record.
                    existing = collected[key]
                    topics = list(existing.get("research_topics") or [])
                    if group["topic"] and group["topic"] not in topics:
                        topics.append(group["topic"])
                    existing["research_topics"] = topics
                    groups = list(existing.get("source_query_groups") or ([existing.get("source_query_group")] if existing.get("source_query_group") else []))
                    if group["id"] not in groups:
                        groups.append(group["id"])
                    existing["source_query_groups"] = groups
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
