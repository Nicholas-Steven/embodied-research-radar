"""Stability tests for arXiv 429 handling, LLM retry policy and pipeline ordering.

All network calls are mocked; no real arXiv or LLM request is made.
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import urllib.error

from scripts.radar import arxiv_fetcher, pipeline
from scripts.radar.ai import generate_analysis
from scripts.radar.pipeline import run
from scripts.radar.schema import clean_paper

BASE = json.loads(Path("data/demo_papers.json").read_text(encoding="utf-8"))[0]


def _paper(**overrides):
    return clean_paper({**BASE, **overrides})


def _http_error(code: int):
    exc = urllib.error.HTTPError("https://example.test/", code, "err", None, None)
    exc.headers = {}  # no Retry-After by default
    return exc


def _fake_response(payload_dict: dict):
    body = json.dumps(payload_dict).encode()
    response = mock.MagicMock()
    response.read.return_value = body
    response.__enter__.return_value = response
    return response


def _ai_success_payload():
    content = json.dumps({
        "abstract_zh": "摘要", "summary_one_sentence": "一句话", "research_problem": "问题",
        "core_contributions": ["贡献"], "method_summary": "方法", "experimental_setup": "实验",
        "key_results": "结果", "limitations": "局限", "why_it_matters": "重要",
        "recommended_reading": "阅读", "reproduction_value": "High", "relevance_reason": "相关",
        "related_to_my_research": "方法参考",
    })
    return {"choices": [{"message": {"content": content}}]}


class PipelineOrderTests(unittest.TestCase):
    """Test 1-3: low score never calls LLM; ready results are reused; high score calls LLM."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dump = Path(self.tmp.name) / "papers.json"
        mock.patch.object(pipeline, "DATA_PATH", self.dump).start()
        mock.patch.object(pipeline, "fetch_method_image", return_value="").start()
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(self.tmp.cleanup)

    def _write(self, papers):
        payload = {
            "papers": papers, "generated_at": "2026-08-13", "source": "arXiv",
            "candidate_count": len(papers), "retained_count": 0, "relevance_threshold": 45,
        }
        self.dump.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    def test_low_score_never_calls_llm(self):
        self._write([_paper(paper_id="low", arxiv_id="2411.15753", relevance_score=20)])
        with mock.patch.object(pipeline, "generate_analysis", return_value={"analysis_status": "ready"}) as ai:
            run(fetch=False, threshold=45, with_ai=True)
        ai.assert_not_called()

    def test_ready_result_is_reused(self):
        self._write([_paper(paper_id="ready", arxiv_id="2411.15753", relevance_score=80, analysis_status="ready", summary_one_sentence="already done")])
        with mock.patch.object(pipeline, "generate_analysis", return_value={"analysis_status": "ready"}) as ai:
            run(fetch=False, threshold=45, with_ai=True)
        ai.assert_not_called()

    def test_high_score_pending_calls_llm(self):
        self._write([_paper(paper_id="new", arxiv_id="2411.15753", relevance_score=80, analysis_status="pending", summary_one_sentence="")])
        with mock.patch.object(pipeline, "generate_analysis", return_value={"analysis_status": "ready", "summary_one_sentence": "x"}) as ai:
            run(fetch=False, threshold=45, with_ai=True)
        ai.assert_called_once()


class Arxiv429Tests(unittest.TestCase):
    """Test 4: 429 backs off, retries, has an upper bound and never loops forever."""

    def test_429_backs_off_and_retries_with_cap(self):
        calls = {"n": 0, "sleeps": 0}
        real_sleep = arxiv_fetcher.time.sleep

        def fake_urlopen(request, timeout=45):
            calls["n"] += 1
            raise _http_error(429)

        def fake_sleep(seconds):
            calls["sleeps"] += 1
            real_sleep(0)

        with mock.patch.object(arxiv_fetcher.urllib.request, "urlopen", side_effect=fake_urlopen), \
             mock.patch.object(arxiv_fetcher.time, "sleep", side_effect=fake_sleep):
            result = arxiv_fetcher.query_arxiv("all:robot", 2, "ua", retries=3, delay=0.0)
        self.assertIsNone(result, "429 exhaustion should return None")
        self.assertEqual(calls["n"], 3, "should stop after 3 attempts, not loop forever")
        self.assertEqual(calls["sleeps"], 2, "should back off between attempts")

    def test_collect_stops_after_consecutive_429_cap(self):
        with mock.patch.object(arxiv_fetcher, "query_arxiv", return_value=None):
            groups = [{"id": "g1", "topic": "t1", "queries": ["a", "b"]}, {"id": "g2", "topic": "t2", "queries": ["c", "d"]}]
            result = arxiv_fetcher.collect(groups, 2, "ua", 3, 0.0, max_consecutive_429=2)
        self.assertEqual(result, [])


class LlmRetryTests(unittest.TestCase):
    """Test 5-6: 402 is not retried; a timeout followed by success yields ready."""

    def setUp(self):
        env = mock.patch.dict("os.environ", {"LLM_API_KEY": "test-key-for-mock", "LLM_BASE_URL": "https://example.test/v1"})
        env.start()
        self.addCleanup(env.stop)

    def test_402_is_not_retried(self):
        calls = {"n": 0, "sleeps": 0}

        def fake_urlopen(request, timeout=90):
            calls["n"] += 1
            raise _http_error(402)

        with mock.patch.object(urllib.request, "urlopen", side_effect=fake_urlopen), \
             mock.patch.object(__import__("scripts.radar.ai", fromlist=["time"]).time, "sleep", side_effect=lambda s: calls.__setitem__("sleeps", calls["sleeps"] + 1)):
            result = generate_analysis(_paper(paper_id="p402"))
        self.assertEqual(result["summary_one_sentence"], "Pending")
        self.assertNotEqual(result.get("analysis_status"), "ready")
        self.assertEqual(calls["n"], 1, "402 must not be retried 3 times")
        self.assertEqual(calls["sleeps"], 0)

    def test_timeout_then_success_is_ready(self):
        calls = {"n": 0, "sleeps": 0}
        real_sleep = __import__("scripts.radar.ai", fromlist=["time"]).time.sleep

        def fake_urlopen(request, timeout=90):
            calls["n"] += 1
            if calls["n"] == 1:
                raise TimeoutError("read operation timed out")
            return _fake_response(_ai_success_payload())

        def fake_sleep(seconds):
            calls["sleeps"] += 1
            real_sleep(0)

        with mock.patch.object(urllib.request, "urlopen", side_effect=fake_urlopen), \
             mock.patch.object(__import__("scripts.radar.ai", fromlist=["time"]).time, "sleep", side_effect=fake_sleep):
            result = generate_analysis(_paper(paper_id="ptimeout"))
        self.assertEqual(result["analysis_status"], "ready")
        self.assertEqual(calls["n"], 2)
        self.assertEqual(calls["sleeps"], 1)


class MultiQueryMergeTests(unittest.TestCase):
    """Test 7: the same arXiv ID hit by two query groups results in one paper with merged topics."""

    def test_same_paper_merges_topics(self):
        def fake_query(query, limit, ua, retries, delay):
            return [_paper(paper_id="arxiv-2411-15753", arxiv_id="2411.15753", source_categories=["cs.RO"])]

        groups = [
            {"id": "vf", "topic": "vision-force", "queries": ["q1"]},
            {"id": "rec", "topic": "failure-recovery", "queries": ["q2"]},
        ]
        with mock.patch.object(arxiv_fetcher, "query_arxiv", side_effect=fake_query):
            papers = arxiv_fetcher.collect(groups, 2, "ua", 3, 0.0)
        self.assertEqual(len(papers), 1)
        self.assertEqual(sorted(papers[0]["research_topics"]), ["failure-recovery", "vision-force"])


if __name__ == "__main__":
    unittest.main()
