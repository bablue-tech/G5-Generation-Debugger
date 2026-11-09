"""API and report schemas. Field names match the web app's TypeScript types exactly."""

from __future__ import annotations

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

Confidence = Literal["confirmed", "probable", "possible", "insufficient"]
Tone = Literal["good", "neutral", "warning", "critical"]
RecoveryTone = Literal["good", "warning", "serious"]
StageState = Literal["ok", "fail", "skip", "unknown", "active"]

CONFIDENCE_ORDER: list[str] = ["insufficient", "possible", "probable", "confirmed"]


class Subject(BaseModel):
    inference_id: str
    jobrouter_job_id: Optional[str] = None
    unit_session_id: Optional[str] = None
    model_label: str
    provider: str


class Stage(BaseModel):
    name: str
    state: StageState


class EvidenceItem(BaseModel):
    id: str
    time: Optional[str] = None
    source: str
    text: str


class Recovery(BaseModel):
    label: str
    tone: RecoveryTone


class DiagnosisReport(BaseModel):
    id: str
    created_at: str
    subject: Subject
    status_label: str
    tone: Tone
    diagnostic_code: str
    category: str
    confidence: Confidence
    failure_stage: str
    summary: str
    cause: str
    stages: list[Stage]
    evidence: list[EvidenceItem]
    steps: list[str]
    recovery: Recovery
    actions: list[str]
    credits_note: str
    platform_notice: Optional[str] = None
    other_candidates: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    explained_by: Literal["rules", "ai"] = "rules"


class SessionCandidate(BaseModel):
    inference_id: str
    model_label: str
    status: str
    created_at: str


class SessionInfo(BaseModel):
    unit_session_id: str
    title: str


class DiagnosisResponse(BaseModel):
    kind: Literal["diagnosis"] = "diagnosis"
    report: DiagnosisReport


class SessionResponse(BaseModel):
    kind: Literal["session"] = "session"
    session: SessionInfo
    candidates: list[SessionCandidate]


AnalyzeResponse = Union[DiagnosisResponse, SessionResponse]


class AnalyzeRequest(BaseModel):
    reference: str = Field(min_length=1, max_length=2048)


class EscalateRequest(BaseModel):
    comment: Optional[str] = Field(default=None, max_length=2000)


class EscalateResponse(BaseModel):
    ticket_id: str
    status: str = "open"


class FeedbackRequest(BaseModel):
    helpful: bool
    wrong_cause: bool = False
