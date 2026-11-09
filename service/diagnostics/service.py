"""Orchestrates one diagnosis: resolve, authorise, collect, classify, explain, store."""

from __future__ import annotations

import threading
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional, Protocol

from .engine import diagnose_generation
from .explainer import Explainer, TemplateExplainer, build_package
from .models import (
    AnalyzeResponse,
    DiagnosisReport,
    DiagnosisResponse,
    SessionCandidate,
    SessionInfo,
    SessionResponse,
)
from .resolver import parse_reference
from .rules import load_rules
from .sources import EvidenceSource

FAILED_FIRST = {"failed": 0, "error": 0, "canceled": 1, "cancelled": 1}


class NotFound(Exception):
    """Same answer for 'doesn't exist' and 'no access', so IDs can't be probed."""


class RateLimited(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__("Too many diagnoses. Try again shortly.")
        self.retry_after = retry_after


@dataclass(frozen=True)
class User:
    id: str
    org_id: str
    roles: frozenset[str] = frozenset()


class AccessPolicy(Protocol):
    def can_read(self, user: User, generation: dict[str, Any]) -> bool: ...


class OrgAccessPolicy:
    """Sample rule: same workspace, or support staff. In production, call AI Studio's existing project access check."""

    def can_read(self, user: User, generation: dict[str, Any]) -> bool:
        return "support" in user.roles or generation.get("org_id") == user.org_id


class TicketClient(Protocol):
    def create(self, user: User, report: DiagnosisReport, comment: Optional[str]) -> str: ...


class SampleTicketClient:
    """Stands in for POST /api/v1/support/tickets (category "generation", with job_id, inference_id, session_id)."""

    def __init__(self) -> None:
        self.created: list[dict[str, Any]] = []

    def create(self, user: User, report: DiagnosisReport, comment: Optional[str]) -> str:
        ticket_id = f"TCK-{uuid.uuid4().hex[:6].upper()}"
        self.created.append(
            {
                "ticket_id": ticket_id,
                "category": "generation",
                "inference_id": report.subject.inference_id,
                "job_id": report.subject.jobrouter_job_id,
                "session_id": report.subject.unit_session_id,
                "comment": "\n\n".join(
                    p
                    for p in [
                        comment,
                        f"Diagnosis {report.id}: {report.status_label} ({report.diagnostic_code}, {report.confidence}).",
                        report.summary,
                    ]
                    if p
                ),
                "user": user.id,
            }
        )
        return ticket_id


class RateLimiter:
    def __init__(self, limit: int = 30, window_s: int = 3600) -> None:
        self.limit, self.window = limit, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] > self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                raise RateLimited(retry_after=int(self.window - (now - hits[0])) + 1)
            hits.append(now)


@dataclass
class DiagnosticsService:
    source: EvidenceSource
    explainer: Explainer = field(default_factory=TemplateExplainer)
    access: AccessPolicy = field(default_factory=OrgAccessPolicy)
    tickets: TicketClient = field(default_factory=SampleTicketClient)
    limiter: RateLimiter = field(default_factory=RateLimiter)
    rules_path: Optional[str] = None
    _reports: dict[str, tuple[str, DiagnosisReport]] = field(default_factory=dict)
    audit_log: list[dict[str, Any]] = field(default_factory=list)
    feedback: list[dict[str, Any]] = field(default_factory=list)

    def _audit(self, user: User, action: str, **details: Any) -> None:
        self.audit_log.append({"at": datetime.now(timezone.utc).isoformat(), "user": user.id, "action": action, **details})

    def _readable(self, user: User, generation: Optional[dict[str, Any]]) -> dict[str, Any]:
        if not generation or not self.access.can_read(user, generation):
            raise NotFound()
        return generation

    def analyze(self, user: User, raw_reference: str) -> AnalyzeResponse:
        self.limiter.check(user.id)
        ref = parse_reference(raw_reference)  # raises ReferenceError with a user-facing message

        if ref.kind == "session":
            found = self.source.get_session(ref.id)
            if not found:
                raise NotFound()
            session, generations = found
            visible = [g for g in generations if self.access.can_read(user, g)]
            if not visible:
                raise NotFound()
            if len(visible) == 1:
                return self._diagnose(user, visible[0])
            visible.sort(key=lambda g: g.get("created_at") or "", reverse=True)  # newest first
            visible.sort(key=lambda g: FAILED_FIRST.get(g["status"], 2))  # then failures on top (stable)
            self._audit(user, "session_listed", unit_session_id=ref.id, count=len(visible))
            return SessionResponse(
                session=SessionInfo(unit_session_id=ref.id, title=session.get("title") or "Session"),
                candidates=[
                    SessionCandidate(
                        inference_id=g["inference_id"],
                        model_label=g.get("model_label") or g.get("model_path", ""),
                        status=g["status"],
                        created_at=g.get("created_at") or "",
                    )
                    for g in visible
                ],
            )

        generation = self.source.find_by_job(ref.id) if ref.kind == "job" else self.source.get_generation(ref.id)
        return self._diagnose(user, self._readable(user, generation))

    def _diagnose(self, user: User, generation: dict[str, Any]) -> DiagnosisResponse:
        draft = diagnose_generation(generation, load_rules(self.rules_path), self.source.platform_counts())
        report = self.explainer.explain(build_package(draft), draft)
        self._reports[report.id] = (user.id, report)
        self._audit(
            user,
            "diagnosed",
            diagnosis_id=report.id,
            inference_id=report.subject.inference_id,
            code=report.diagnostic_code,
            explained_by=report.explained_by,
        )
        return DiagnosisResponse(report=report)

    def get(self, user: User, diagnosis_id: str) -> DiagnosisReport:
        owner, report = self._reports.get(diagnosis_id, (None, None))
        if report is None or owner != user.id:
            raise NotFound()
        return report

    def escalate(self, user: User, diagnosis_id: str, comment: Optional[str]) -> str:
        report = self.get(user, diagnosis_id)
        ticket_id = self.tickets.create(user, report, comment)
        self._audit(user, "escalated", diagnosis_id=diagnosis_id, ticket_id=ticket_id)
        return ticket_id

    def record_feedback(self, user: User, diagnosis_id: str, helpful: bool, wrong_cause: bool) -> None:
        report = self.get(user, diagnosis_id)
        self.feedback.append(
            {"diagnosis_id": diagnosis_id, "code": report.diagnostic_code, "helpful": helpful, "wrong_cause": wrong_cause}
        )
        self._audit(user, "feedback", diagnosis_id=diagnosis_id, helpful=helpful, wrong_cause=wrong_cause)
