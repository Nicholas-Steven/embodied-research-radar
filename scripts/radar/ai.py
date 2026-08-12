from __future__ import annotations

import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from typing import Any


ANALYSIS_FIELDS = (
    "abstract_zh", "summary_one_sentence", "research_problem", "core_contributions",
    "method_summary", "experimental_setup", "key_results", "limitations",
    "why_it_matters", "recommended_reading", "reproduction_value", "relevance_reason",
)


def pending_analysis() -> dict[str, Any]:
    return {field: "Pending" if field != "core_contributions" else [] for field in ANALYSIS_FIELDS}


def prompt_for(paper: dict[str, Any]) -> str:
    return f"""你是机器人操作与具身智能论文审稿助理。只根据下面的论文元数据和摘要填写JSON，不得猜测DOI、Venue、作者、实验数字、代码地址或论文发表状态。无法从摘要确认的内容写\"无法从摘要确认\"。输出必须是JSON对象，字段为：abstract_zh(string), summary_one_sentence(string), research_problem(string), core_contributions(array of strings), method_summary(string), experimental_setup(string), key_results(string), limitations(string), why_it_matters(string), recommended_reading(string), reproduction_value(string: High/Medium/Low + reason), relevance_reason(string)。\n\nTitle: {paper.get('title')}\nAuthors: {', '.join(paper.get('authors', []))}\nVenue: {paper.get('venue')}\nAbstract: {paper.get('abstract')}"""


def _extract_json(text: str) -> dict[str, Any] | None:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.I | re.S).strip()
    match = re.search(r"\{.*\}", text, flags=re.S)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def generate_analysis(paper: dict[str, Any]) -> dict[str, Any]:
    """Call an OpenAI-compatible endpoint only when all LLM settings are present."""
    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    if not api_key:
        return pending_analysis()
    payload = json.dumps({"model": model, "temperature": 0.1, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": prompt_for(paper)}]}).encode()
    request = urllib.request.Request(f"{base_url}/chat/completions", data=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "EmbodiedResearchRadar/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        data = _extract_json(content)
        if not data:
            return pending_analysis()
        result = pending_analysis()
        for field in ANALYSIS_FIELDS:
            if field in data and data[field] not in (None, ""):
                result[field] = data[field]
        result["analysis_status"] = "ready"
        result["ai_provider"] = os.getenv("LLM_PROVIDER", "openai-compatible")
        result["ai_generated_at"] = datetime.now(timezone.utc).isoformat()
        return result
    except Exception as exc:
        print(f"AI analysis skipped for {paper.get('paper_id')}: {exc}")
        return pending_analysis()
