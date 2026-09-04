#!/usr/bin/env python3
"""Build the static GitHub Pages site from structured radar data."""

from __future__ import annotations

import json
import shutil
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SITE = ROOT / "site"
DATA = ROOT / "data/papers.json"
LANDSCAPE = ROOT / "data/research_landscape.json"
TOPICS = ROOT / "config/topics.json"
SITE_CONFIG = ROOT / "config/site.json"


def read_json(path: Path, fallback: object) -> object:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def build() -> Path:
    payload = read_json(DATA, {"schema_version": "1.0.0", "generated_at": date.today().isoformat(), "candidate_count": 0, "retained_count": 0, "relevance_threshold": 0, "papers": []})
    topics = read_json(TOPICS, {"topics": [], "research_map": [], "literature_categories": []})
    site_config = read_json(SITE_CONFIG, {})
    if not WEB.exists():
        raise FileNotFoundError("web/ source directory is missing")
    if SITE.exists():
        shutil.rmtree(SITE)
    shutil.copytree(WEB, SITE)
    data = dict(payload)
    data["topics"] = topics.get("topics", [])
    data["research_map"] = topics.get("research_map", [])
    data["literature_categories"] = topics.get("literature_categories", [])
    data["site"] = site_config
    data["built_at"] = date.today().isoformat()
    landscape = read_json(LANDSCAPE, None)
    data["landscape"] = landscape
    assets = SITE / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    (assets / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    manifest = {
        "site": site_config.get("site_name", "Embodied Research Radar"),
        "built_at": data["built_at"],
        "paper_count": len(data.get("papers", [])),
        "data_source": data.get("source", "arXiv"),
        "relative_data_path": "assets/data.json",
    }
    (SITE / "build-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return SITE


if __name__ == "__main__":
    output = build()
    print(f"built static site: {output}")
