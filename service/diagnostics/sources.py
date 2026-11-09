"""Where evidence comes from.

`EvidenceSource` is the seam to the real AI Studio backend. In production it
would read the inference record (MongoDB), the live job document (Firestore
`aistudio-jobs`) and a read-only Job Router timeline. Here it reads sample data.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional, Protocol

from .rules import SHARED_DIR


class EvidenceSource(Protocol):
    def get_generation(self, inference_id: str) -> Optional[dict[str, Any]]: ...

    def find_by_job(self, jobrouter_job_id: str) -> Optional[dict[str, Any]]: ...

    def get_session(self, unit_session_id: str) -> Optional[tuple[dict[str, Any], list[dict[str, Any]]]]: ...

    def platform_counts(self) -> dict[str, dict[str, int]]:
        """Failures per diagnostic code across the platform in the last 60 minutes."""
        ...


class SampleEvidenceSource:
    def __init__(self, path: str | Path | None = None) -> None:
        target = Path(path) if path else SHARED_DIR / "sample-generations.json"
        data = json.loads(Path(target).read_text(encoding="utf-8"))
        self._generations = {g["inference_id"]: g for g in data["generations"]}
        self._sessions = {s["unit_session_id"]: s for s in data["sessions"]}
        self._counts = data.get("platform_counts_last_60m", {})

    def get_generation(self, inference_id: str) -> Optional[dict[str, Any]]:
        return self._generations.get(inference_id)

    def find_by_job(self, jobrouter_job_id: str) -> Optional[dict[str, Any]]:
        return next((g for g in self._generations.values() if g.get("jobrouter_job_id") == jobrouter_job_id), None)

    def get_session(self, unit_session_id: str) -> Optional[tuple[dict[str, Any], list[dict[str, Any]]]]:
        session = self._sessions.get(unit_session_id)
        if not session:
            return None
        gens = [self._generations[i] for i in session["inference_ids"] if i in self._generations]
        return session, gens

    def platform_counts(self) -> dict[str, dict[str, int]]:
        return self._counts

    def sample_references(self) -> list[dict[str, str]]:
        return [
            {"inference_id": g["inference_id"], "model_label": g.get("model_label", g["model_path"]), "status": g["status"]}
            for g in self._generations.values()
        ]
