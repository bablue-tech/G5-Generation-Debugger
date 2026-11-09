"""HTTP API. Mount `router` inside the existing AI Studio backend, or run app.py on its own."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .models import (
    AnalyzeRequest,
    AnalyzeResponse,
    DiagnosisReport,
    EscalateRequest,
    EscalateResponse,
    FeedbackRequest,
)
from .resolver import ReferenceError
from .service import DiagnosticsService, NotFound, RateLimited, User
from .sources import SampleEvidenceSource

router = APIRouter(prefix="/api/v1/diagnostics", tags=["diagnostics"])
NOT_FOUND = "We couldn't find a generation you have access to."


def get_service(request: Request) -> DiagnosticsService:
    return request.app.state.diagnostics


def current_user() -> User:
    """Demo user. In AI Studio, replace this with the existing Firebase ID-token dependency."""
    return User(id=os.environ.get("DEMO_USER_ID", "demo-user"), org_id=os.environ.get("DEMO_ORG_ID", "org-galleri5-studio"))


@router.post("", response_model=AnalyzeResponse)
def analyze(
    body: AnalyzeRequest,
    response: Response,
    user: User = Depends(current_user),
    service: DiagnosticsService = Depends(get_service),
) -> AnalyzeResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        return service.analyze(user, body.reference)
    except ReferenceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NotFound as exc:
        raise HTTPException(status_code=404, detail=NOT_FOUND) from exc
    except RateLimited as exc:
        raise HTTPException(status_code=429, detail=str(exc), headers={"Retry-After": str(exc.retry_after)}) from exc


@router.get("/samples")
def samples(service: DiagnosticsService = Depends(get_service)) -> list[dict[str, str]]:
    if isinstance(service.source, SampleEvidenceSource):
        return service.source.sample_references()
    return []


@router.get("/{diagnosis_id}", response_model=DiagnosisReport)
def get_diagnosis(
    diagnosis_id: str, user: User = Depends(current_user), service: DiagnosticsService = Depends(get_service)
) -> DiagnosisReport:
    try:
        return service.get(user, diagnosis_id)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="Diagnosis not found.") from exc


@router.post("/{diagnosis_id}/escalate", response_model=EscalateResponse)
def escalate(
    diagnosis_id: str,
    body: EscalateRequest,
    user: User = Depends(current_user),
    service: DiagnosticsService = Depends(get_service),
) -> EscalateResponse:
    try:
        return EscalateResponse(ticket_id=service.escalate(user, diagnosis_id, body.comment))
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="Diagnosis not found.") from exc


@router.post("/{diagnosis_id}/feedback", status_code=204)
def feedback(
    diagnosis_id: str,
    body: FeedbackRequest,
    user: User = Depends(current_user),
    service: DiagnosticsService = Depends(get_service),
) -> Response:
    try:
        service.record_feedback(user, diagnosis_id, body.helpful, body.wrong_cause)
    except NotFound as exc:
        raise HTTPException(status_code=404, detail="Diagnosis not found.") from exc
    return Response(status_code=204)
