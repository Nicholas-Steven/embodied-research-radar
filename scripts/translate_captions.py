"""One-off: translate existing English figure captions to Chinese (image_caption_zh).

Requires LLM_API_KEY / LLM_BASE_URL / LLM_MODEL in the environment.
Only fills image_caption_zh; existing AI analysis fields are preserved.
"""

from __future__ import annotations

import json
from pathlib import Path

from radar.ai import translate_caption

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data/papers.json"


def main() -> int:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    papers = payload.get("papers", [])
    updated = 0
    for paper in papers:
        caption = paper.get("image_caption") or ""
        if caption and not paper.get("image_caption_zh"):
            translated = translate_caption(caption)
            if translated:
                paper["image_caption_zh"] = translated
                updated += 1
    DATA_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"translated {updated} captions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
