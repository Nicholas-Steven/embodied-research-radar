"""Structured fetch health tracking for the radar ingestion pipeline.

The pipeline must never confuse "source failed" with "no relevant papers".
FetchHealth is the structured result object returned by every fetch provider;
callers make decisions from its fields, never from stdout parsing.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict


class SourceUnhealthyError(RuntimeError):
    """Raised when the data source could not be harvested reliably.

    Hard failure cases: every request failed, every required request was
    rate-limited until retries were exhausted, HTTP was unusable, or the
    XML/Atom responses could not be parsed at all. Callers must treat this
    as fatal: papers.json must stay byte-identical and the workflow must
    fail. An empty candidate list is NEVER a valid substitute for this error.
    """


class SourceUnhealthyError(RuntimeError):
    """Raised when the data source could not be harvested reliably.

    Hard failure cases: every request failed, every required request was
    rate-limited until retries were exhausted, HTTP was unusable, or the
    XML/Atom responses could not be parsed at all. The pipeline must treat
    this as fatal: papers.json stays byte-identical and the process exits
    non-zero so the workflow fails. An empty candidate list is NEVER a
    valid substitute for raising this error.
    """


HEALTHY = "HEALTHY"
DEGRADED = "DEGRADED"
FAILED = "FAILED"


@dataclass
class FetchHealth:
    """Counters describing one fetch attempt. All decisions read these."""

    source: str = ""
    window_start: str = ""
    window_end: str = ""
    publication_window_start: str = ""
    publication_window_end: str = ""
    requests_attempted: int = 0
    requests_succeeded: int = 0
    requests_rate_limited: int = 0
    requests_failed: int = 0
    requests_exhausted: int = 0
    raw_records_received: int = 0
    records_from_checkpoint: int = 0
    oai_raw_records: int = 0            # OAI harvest pool after ID dedupe
    fallback_raw_records: int = 0       # Search API fallback records
    merged_records_before_dedup: int = 0
    records_stale_metadata: int = 0     # datestamp-changed but <created> outside pub window
    records_after_dedupe: int = 0
    relevant_records: int = 0
    new_records: int = 0
    images_found: int = 0          # optional enrichment; failure never fails ingestion
    images_missing: int = 0
    notes: list[str] = field(default_factory=list)

    def note(self, message: str) -> None:
        self.notes.append(message)

    @property
    def source_responded(self) -> bool:
        """True if the source was proven reachable and usable this run.

        Either at least one request got a valid, parsed response, or the
        records were restored from a checkpoint saved by an earlier attempt
        of the same harvest window (the source was already proven then).
        Independent of how many relevant papers were found, so a quiet
        weekend (0 relevant papers) stays a healthy success.
        """
        return self.requests_succeeded > 0 or self.records_from_checkpoint > 0

    @property
    def all_requests_failed(self) -> bool:
        return self.requests_attempted > 0 and self.requests_succeeded == 0

    def status(self) -> str:
        if self.all_requests_failed or self.requests_exhausted >= self.requests_attempted and self.requests_attempted > 0 and not self.source_responded:
            return FAILED
        if not self.source_responded:
            return FAILED
        if self.requests_rate_limited or self.requests_failed or self.requests_exhausted:
            return DEGRADED
        return HEALTHY

    def summary_lines(self) -> list[str]:
        # Naming contract (2026-09-15): each stage is labeled explicitly so
        # an "after_dedup > before_dedup" style impossibility can't hide.
        return [
            f"Source: {self.source}",
            f"Harvest window (OAI datestamp): {self.window_start} → {self.window_end}",
            f"Publication window (first submitted): {self.publication_window_start} → {self.publication_window_end}",
            f"Requests attempted: {self.requests_attempted}",
            f"Requests succeeded: {self.requests_succeeded}",
            f"429 rate-limited responses: {self.requests_rate_limited}",
            f"Other failed responses: {self.requests_failed}",
            f"Retry-exhausted requests: {self.requests_exhausted}",
            f"oai_raw_records (after OAI ID dedupe): {self.oai_raw_records}",
            f"fallback_raw_records (Search API): {self.fallback_raw_records}",
            f"merged_records_before_dedup (candidates incl. existing): {self.merged_records_before_dedup}",
            f"records_after_dedup (pipeline pool): {self.records_after_dedupe}",
            f"records_stale_metadata (dropped by publication window): {self.records_stale_metadata}",
            f"Relevant records (eligible + score ≥ threshold): {self.relevant_records}",
            f"New papers added: {self.new_records}",
            f"Images found: {self.images_found}",
            f"Images missing (dataset-wide): {self.images_missing}",
            f"Status: {self.status()}",
        ] + [f"Note: {n}" for n in self.notes]

    def to_dict(self) -> dict:
        data = asdict(self)
        data["status"] = self.status()
        return data
