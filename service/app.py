"""Standalone diagnostics service for local demos.

    uvicorn app:app --reload --port 8000
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from diagnostics.api import router
from diagnostics.explainer import explainer_from_env
from diagnostics.service import DiagnosticsService
from diagnostics.sources import SampleEvidenceSource


def create_app(service: DiagnosticsService | None = None) -> FastAPI:
    app = FastAPI(title="G5 Generation Debugger", version="0.1.0")
    app.state.diagnostics = service or DiagnosticsService(source=SampleEvidenceSource(), explainer=explainer_from_env())
    origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
