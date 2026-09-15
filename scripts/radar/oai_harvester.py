"""arXiv OAI-PMH harvester — primary ingestion source.

Design (2026-09 hardening):
- ONE ListRecords call per allowed arXiv category set, over a rolling
  lookback window (default 7 days). Replaces the old 21 keyword queries
  against the Search API, which got the shared runner IP rate-limited.
- Topic matching, keyword scoring and ranking happen locally afterwards
  (scoring.py); the remote side only ships raw recent metadata.
- Every request updates a FetchHealth struct. If the source cannot be
  harvested at all, SourceUnhealthyError is raised — the pipeline must
  then leave papers.json untouched and exit non-zero.
- Partial harvests (some sets succeeded, some exhausted) raise
  SourceUnhealthyError as well: 3-of-8 sets is not a complete radar.

Docs: https://info.arxiv.org/help/oa/index.html
Endpoint: https://oaipmh.arxiv.org/oai (export.arxiv.org/oai2 301-redirects here)
"""

from __future__ import annotations

import http.client
import json
import random
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

try:
    from .fetch_health import FetchHealth, SourceUnhealthyError
except ImportError:  # direct-script diagnostics
    from fetch_health import FetchHealth, SourceUnhealthyError

OAI_ENDPOINT = "https://oaipmh.arxiv.org/oai"
# metadataPrefix=arXiv carries the authoritative per-paper fields:
#   <created>  = first submission date (what "published" means for the radar)
#   <updated>  = latest metadata/version change (NOT first publication)
# oai_dc's dc:date was verified to mix both semantics, so oai_dc must NOT be
# used for the publication window (2026-09 audit: 248/466 stale papers got in).
METADATA_PREFIX = "arXiv"
ARXIV_NS = {"ax": "http://arxiv.org/OAI/arXiv/"}
OAI_NS = {"o": "http://www.openarchives.org/OAI/2.0/", "dc": "http://purl.org/dc/elements/1.1/"}
DC_NS = {"dc": OAI_NS["dc"]}

USER_AGENT = "EmbodiedResearchRadar/1.0 (https://github.com/Nicholas-Steven/embodied-research-radar; static research radar, no bulk redistribution)"

# arXiv category sets the radar cares about (mirrors allowed_primary_categories).
CATEGORY_SETS = {
    "cs.RO": "cs:cs:RO",
    "cs.AI": "cs:cs:AI",
    "cs.LG": "cs:cs:LG",
    "cs.CV": "cs:cs:CV",
    "cs.CL": "cs:cs:CL",
    "cs.SY": "cs:cs:SY",
    "eess.SY": "eess:eess:SY",
}

DEFAULT_LOOKBACK_DAYS = 7
# OAI datestamp (HARVEST WINDOW) only says "metadata changed recently". The
# radar wants papers whose FIRST SUBMISSION (arXiv <created>) falls in the
# PUBLICATION WINDOW: lookback + 1 day overlap to absorb timezone/moderation
# boundary effects. Stale papers whose metadata merely got updated are
# dropped here (2026-09 audit: 248/466 backfill papers were such strays).
PUBLICATION_OVERLAP_DAYS = 1
MAX_PAGES_PER_SET = 60  # safety cap; ~100 records/page so ~6000 per set max
MAX_RETRIES = 5
BACKOFF_BASE_SECONDS = 30.0
BACKOFF_MAX_SECONDS = 300.0
FLOWCONTROL_DELAY_SECONDS = 60.0


def rolling_window(lookback_days: int = DEFAULT_LOOKBACK_DAYS, now: datetime | None = None) -> tuple[str, str]:
    """Return (from, until) UTC dates for OAI datestamp granularity (days)."""
    now = now or datetime.now(timezone.utc)
    return (now - timedelta(days=lookback_days)).date().isoformat(), now.date().isoformat()


def _sleep(seconds: float) -> None:
    time.sleep(max(0.0, seconds))


def _backoff_wait(attempt: int) -> float:
    base = float(__import__("os").getenv("ARXIV_BACKOFF_BASE_SECONDS", str(BACKOFF_BASE_SECONDS)))
    cap = float(__import__("os").getenv("ARXIV_BACKOFF_MAX_SECONDS", str(BACKOFF_MAX_SECONDS)))
    return random.uniform(0, min(cap, base * (2 ** attempt)))


def _retry_after_seconds(exc: urllib.error.HTTPError) -> float | None:
    value = exc.headers.get("Retry-After") if exc.headers else None
    if not value:
        try:
            import re
            body = exc.read().decode("utf-8", errors="ignore")
            match = re.search(r"retry\s+(?:after\s+)?(\d+(?:\.\d+)?)\s*(?:seconds?|s)?", body, re.I)
            if match:
                value = match.group(1)
        except Exception:
            return None
    try:
        return max(1.0, min(float(value), 600.0))
    except (TypeError, ValueError):
        return None


def _oai_get(params: dict[str, str], health: FetchHealth, retries: int = MAX_RETRIES) -> ET.Element:
    """GET one OAI response with backoff. Returns parsed root or raises SourceUnhealthyError."""
    url = OAI_ENDPOINT + "?" + urllib.parse.urlencode(params)
    last_error: Exception | None = None
    for attempt in range(retries):
        health.requests_attempted += 1
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                payload = response.read()
            root = ET.fromstring(payload)
            health.requests_succeeded += 1
            error = root.find("o:error", OAI_NS)
            if error is not None:
                code = error.attrib.get("code", "")
                if code == "flowControl":  # OAI-level throttle: wait and retry same page
                    health.requests_rate_limited += 1
                    health.note(f"flowControl throttle, waiting {FLOWCONTROL_DELAY_SECONDS:.0f}s")
                    _sleep(FLOWCONTROL_DELAY_SECONDS)
                    continue
                raise SourceUnhealthyError(f"OAI error {code}: {(error.text or '').strip()}")
            return root
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                health.requests_rate_limited += 1
                wait = _retry_after_seconds(exc)
                if wait is None:
                    wait = _backoff_wait(attempt)
                if attempt < retries - 1:
                    health.note(f"HTTP 429, waiting {wait:.0f}s (retry {attempt + 1}/{retries})")
                    _sleep(wait)
            elif exc.code in (400, 401, 403, 404):
                health.requests_failed += 1
                raise SourceUnhealthyError(f"OAI request rejected (HTTP {exc.code}): {url}")
            else:  # 408, 5xx — transient
                health.requests_failed += 1
                if attempt < retries - 1:
                    _sleep(_backoff_wait(attempt))
        except ET.ParseError as exc:
            health.requests_failed += 1
            raise SourceUnhealthyError(f"OAI response could not be parsed as XML: {exc}")
        except (urllib.error.URLError, TimeoutError, OSError, http.client.IncompleteRead) as exc:
            last_error = exc
            health.requests_failed += 1
            if attempt < retries - 1:
                _sleep(_backoff_wait(attempt))
    health.requests_exhausted += 1
    raise SourceUnhealthyError(f"OAI request exhausted {retries} retries: {url} ({last_error})")


def _identifier_to_arxiv_id(identifier: str) -> str:
    # "oai:arXiv.org:2405.09101" -> "2405.09101"
    return identifier.rsplit(":", 1)[-1].strip()


def _parse_record(record: ET.Element) -> dict[str, Any] | None:
    header = record.find("o:header", OAI_NS)
    if header is None:
        return None
    if header.attrib.get("status") == "deleted":
        return None
    arxiv_id = _identifier_to_arxiv_id((header.findtext("o:identifier", default="", namespaces=OAI_NS) or ""))
    if not arxiv_id:
        return None
    datestamp = (header.findtext("o:datestamp", default="", namespaces=OAI_NS) or "")[:10]
    set_specs = [el.text or "" for el in header.findall("o:setSpec", OAI_NS)]

    md = record.find(".//ax:arXiv", ARXIV_NS)
    if md is None:
        return None

    def ax_text(tag: str) -> str:
        el = md.find(f"ax:{tag}", ARXIV_NS)
        return " ".join((el.text or "").split()) if el is not None else ""

    title = ax_text("title")
    abstract = ax_text("abstract")
    authors = [" ".join(el.text.split()) for el in md.findall("ax:authors/ax:author", ARXIV_NS) if el.text]
    created = ax_text("created")[:10]      # FIRST submission — the radar's "published"
    updated = ax_text("updated")[:10]      # latest version/metadata change
    categories = [c.strip() for c in (md.findtext("ax:categories", default="", namespaces=ARXIV_NS) or "").split() if c.strip()]
    doi = ax_text("doi")
    return {
        "arxiv_id": arxiv_id,
        "paper_id": f"arxiv-{arxiv_id.replace('.', '-')}",
        "title": title,
        "abstract": abstract,
        "authors": authors,
        "published_date": created,
        "updated_date": updated,
        "oai_datestamp": datestamp,
        "venue": "Preprint / arXiv",
        "doi": doi,
        "keywords": categories,
        "source": "arXiv",
        "source_categories": categories,
        "oai_set_specs": set_specs,
        "year": int(created[:4] or 0),
    }


def harvest(
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    health: FetchHealth | None = None,
    category_sets: dict[str, str] | None = None,
    now: datetime | None = None,
    checkpoint_path: str | None = None,
) -> list[dict[str, Any]]:
    """Harvest raw recent records from all category sets over the lookback window.

    Raises SourceUnhealthyError when the source is unusable (all requests
    failed/exhausted) or when the harvest is only partial (some sets failed).
    Returns raw parsed candidate dicts (deduped by arXiv ID across sets).

    When checkpoint_path is set, completed sets and their records survive
    process restarts, so a long harvest can resume instead of starting over.
    """
    health = health or FetchHealth()
    health.source = "arXiv OAI-PMH"
    window_start, window_end = rolling_window(lookback_days, now)
    health.window_start = window_start
    health.window_end = window_end
    sets = category_sets or CATEGORY_SETS

    by_identifier: dict[str, dict[str, Any]] = {}
    completed_sets: list[str] = []
    if checkpoint_path:
        try:
            saved = json.loads(Path(checkpoint_path).read_text(encoding="utf-8"))
            if saved.get("window") == f"{window_start}..{window_end}":
                for record in saved.get("records", []):
                    by_identifier[record["arxiv_id"]] = record
                completed_sets = list(saved.get("completed_sets", []))
                if completed_sets:
                    health.records_from_checkpoint = len(by_identifier)
                    health.note(f"resumed: {len(completed_sets)} set(s) already harvested in a previous attempt")
        except (OSError, ValueError, KeyError):
            pass

    def _save_checkpoint() -> None:
        if not checkpoint_path:
            return
        payload = {
            "window": f"{window_start}..{window_end}",
            "completed_sets": sorted(set(completed_sets)),
            "records": list(by_identifier.values()),
        }
        tmp = Path(checkpoint_path).with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(checkpoint_path)

    failed_sets: list[str] = []

    for category, set_spec in sets.items():
        if category in completed_sets:
            continue
        params = {
            "verb": "ListRecords",
            "metadataPrefix": METADATA_PREFIX,
            "set": set_spec,
            "from": window_start,
            "until": window_end,
        }
        pages = 0
        set_records = 0
        try:
            while pages < MAX_PAGES_PER_SET:
                root = _oai_get(params, health)
                pages += 1
                records = root.findall(".//o:record", OAI_NS)
                health.raw_records_received += len(records)
                for record in records:
                    parsed = _parse_record(record)
                    if parsed is None:
                        continue
                    set_records += 1
                    existing = by_identifier.get(parsed["arxiv_id"])
                    if existing is None:
                        parsed["source_categories"] = [category]
                        by_identifier[parsed["arxiv_id"]] = parsed
                    elif category not in existing["source_categories"]:
                        existing["source_categories"].append(category)
                        for spec in parsed.get("oai_set_specs", []):
                            if spec not in existing["oai_set_specs"]:
                                existing["oai_set_specs"].append(spec)
                token_el = root.find(".//o:resumptionToken", OAI_NS)
                token = (token_el.text or "").strip() if token_el is not None else ""
                if not token:
                    break
                params = {"verb": "ListRecords", "resumptionToken": token}
                if token_el.attrib.get("completeListSize"):
                    health.note(f"{category}: completeListSize={token_el.attrib['completeListSize']}")
        except SourceUnhealthyError as exc:
            failed_sets.append(category)
            health.note(f"set {category} ({set_spec}) failed: {exc}")
        else:
            completed_sets.append(category)
            _save_checkpoint()
            health.note(f"set {category}: {set_records} usable records in {pages} page(s)")
        _sleep(3)  # conservative inter-set interval

    health.oai_raw_records = len(by_identifier)
    if len(failed_sets) == len(sets):
        raise SourceUnhealthyError(
            f"Every category set failed ({len(failed_sets)}/{len(sets)}); source is unhealthy. "
            "papers.json must not be modified."
        )
    if failed_sets:
        # Partial harvest: 3-of-8 sets is NOT a complete radar. Fail loudly
        # instead of publishing an incomplete dataset as if it were whole.
        raise SourceUnhealthyError(
            f"Partial harvest: {len(failed_sets)}/{len(sets)} category sets failed "
            f"({', '.join(failed_sets)}). Refusing to publish incomplete data."
        )

    # PUBLICATION WINDOW filter: keep only papers whose FIRST submission
    # (arXiv <created>) falls within lookback + overlap days. Papers whose
    # metadata was merely updated inside the harvest window are dropped.
    now = now or datetime.now(timezone.utc)
    pub_start = (now - timedelta(days=lookback_days + PUBLICATION_OVERLAP_DAYS)).date().isoformat()
    pub_end = now.date().isoformat()
    recent: dict[str, dict[str, Any]] = {}
    for arxiv_id, record in by_identifier.items():
        created = (record.get("published_date") or "")[:10]
        if pub_start <= created <= pub_end:
            recent[arxiv_id] = record
        else:
            health.records_stale_metadata += 1
    health.publication_window_start = pub_start
    health.publication_window_end = pub_end
    health.note(
        f"publication window {pub_start}..{pub_end}: {len(recent)} first-submission papers kept, "
        f"{health.records_stale_metadata} metadata-update strays dropped"
    )
    health.records_after_dedupe = len(recent)
    return list(recent.values())
