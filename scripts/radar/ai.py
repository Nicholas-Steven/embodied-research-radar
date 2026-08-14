from __future__ import annotations

import json
import os
import random
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any


ANALYSIS_FIELDS = (
    "abstract_zh", "summary_one_sentence", "research_problem", "core_contributions",
    "method_summary", "experimental_setup", "key_results", "limitations",
    "why_it_matters", "recommended_reading", "reproduction_value", "relevance_reason",
    "related_to_my_research",
)


def pending_analysis() -> dict[str, Any]:
    return {field: "Pending" if field != "core_contributions" else [] for field in ANALYSIS_FIELDS}


def prompt_for(paper: dict[str, Any]) -> str:
    return f"""你是机器人操作与具身智能论文审稿助理。只根据下面的论文元数据和摘要填写JSON，不得猜测DOI、Venue、作者、实验数字、代码地址或论文发表状态。无法从摘要确认的内容写\"无法从摘要确认\"。输出必须是JSON对象，字段为：abstract_zh(string), summary_one_sentence(string), research_problem(string), core_contributions(array of strings), method_summary(string), experimental_setup(string), key_results(string), limitations(string), why_it_matters(string), recommended_reading(string), reproduction_value(string: High/Medium/Low + reason), relevance_reason(string), related_to_my_research(string: 基于论文内容说明它与视觉-力觉融合/接触状态估计/机器人操作/具身智能研究的关系，如\"方法参考/基线对比/背景文献/潜在竞争\"等，不要虚构用户个人论文信息), image_caption_zh(string: 将下面Caption翻译成简洁中文并去掉\"Figure N.\"编号前缀；无Caption时写空字符串)。\n\nTitle: {paper.get('title')}\nAuthors: {', '.join(paper.get('authors', []))}\nVenue: {paper.get('venue')}\nAbstract: {paper.get('abstract')}\nCaption: {paper.get('image_caption')}"""


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


def translate_caption(caption: str) -> str:
    """Translate an English figure caption to concise Chinese, dropping the figure number."""
    if not (caption or "").strip():
        return ""
    api_key = os.getenv("LLM_API_KEY", "").strip()
    if not api_key:
        return ""
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
    prompt = f"把下面的英文图注翻译成简洁中文，去掉\"Figure N.\"等编号前缀，只输出翻译结果：\n\n{caption.strip()[:800]}"
    payload = json.dumps({"model": model, "temperature": 0.1, "messages": [{"role": "user", "content": prompt}]}).encode()
    request = urllib.request.Request(f"{base_url}/chat/completions", data=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "EmbodiedResearchRadar/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"].strip()
        content = re.sub(r"^(figure|fig\.?)\s*\d+[.:]?\s*", "", content, flags=re.I).strip()
        return content
    except Exception:
        return ""


def generate_analysis(paper: dict[str, Any]) -> dict[str, Any]:
    """Call an OpenAI-compatible endpoint only when all LLM settings are present."""
    api_key = os.getenv("LLM_API_KEY", "").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    if not api_key:
        return pending_analysis()
    timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "90"))
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json", "User-Agent": "EmbodiedResearchRadar/0.1"}
    messages = [{"role": "user", "content": prompt_for(paper)}]

    def _post(payload: dict[str, Any]) -> dict[str, Any]:
        request = urllib.request.Request(f"{base_url}/chat/completions", data=json.dumps(payload).encode(), headers=headers)
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    last_error: Exception | None = None
    for attempt in range(3):
        try:
            try:
                body = _post({"model": model, "temperature": 0.1, "response_format": {"type": "json_object"}, "messages": messages})
            except urllib.error.HTTPError as exc:
                # Some OpenAI-compatible providers (e.g. SiliconFlow DeepSeek models) reject json_object mode.
                if exc.code in (400, 422):
                    body = _post({"model": model, "temperature": 0.1, "messages": messages})
                else:
                    raise
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
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code in (408, 429, 500, 502, 503, 504) and attempt < 2:
                wait = 5 * (2 ** attempt) + random.uniform(0, 2)
                print(f"AI analysis retry {attempt + 1}/3 after HTTP {exc.code}, waiting {wait:.1f}s")
                time.sleep(wait)
            else:  # 400/401/402/403/404/422 etc. are not retried.
                break
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_error = exc
            if attempt < 2:
                wait = 5 * (2 ** attempt) + random.uniform(0, 2)
                print(f"AI analysis retry {attempt + 1}/3 after {exc.__class__.__name__}, waiting {wait:.1f}s")
                time.sleep(wait)
            else:
                break
    print(f"AI analysis skipped for {paper.get('paper_id')}: {last_error}")
    return pending_analysis()
