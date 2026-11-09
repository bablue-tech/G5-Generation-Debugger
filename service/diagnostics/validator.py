"""Check an AI-written explanation against the evidence before anyone sees it.

The AI may rephrase and lower confidence. It may not change the diagnosis,
cite evidence that doesn't exist, invent numbers, or leak links, keys or emails.
"""

from __future__ import annotations

import re
from typing import Any

from .models import CONFIDENCE_ORDER, DiagnosisReport

_URL = re.compile(r"https?://|www\.", re.IGNORECASE)
_KEYLIKE = re.compile(r"\b(?:sk|pk|ghp|AIza)[-_A-Za-z0-9]{10,}|\beyJ[A-Za-z0-9_-]{10,}")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")


def _normalise(number: str) -> str:
    number = number.replace(",", "")
    if "." in number:
        number = number.rstrip("0").rstrip(".")
    return number


def _numbers(text: str) -> set[str]:
    """Multi-digit numbers in the text, normalised so 1,200 and 1200.0 compare equal."""
    return {_normalise(n) for n in _NUMBER.findall(text) if len(_normalise(n)) >= 2}


def validate_ai_output(data: Any, package: dict[str, Any], draft: DiagnosisReport) -> tuple[bool, list[str]]:
    problems: list[str] = []
    if not isinstance(data, dict):
        return False, ["Output is not a JSON object."]

    summary, cause, steps = data.get("summary"), data.get("cause"), data.get("steps")
    if not isinstance(summary, str) or not 0 < len(summary) <= 400:
        problems.append("summary missing or too long")
    if not isinstance(cause, str) or not 0 < len(cause) <= 500:
        problems.append("cause missing or too long")
    if not isinstance(steps, list) or not 1 <= len(steps) <= 4 or not all(isinstance(s, str) and 0 < len(s) <= 200 for s in steps):
        problems.append("steps must be 1 to 4 short strings")

    if data.get("diagnostic_code") != draft.diagnostic_code:
        problems.append("diagnostic_code differs from the rule-based classification")

    confidence = data.get("confidence")
    if confidence not in CONFIDENCE_ORDER:
        problems.append("confidence is not a known level")
    elif CONFIDENCE_ORDER.index(confidence) > CONFIDENCE_ORDER.index(draft.confidence):
        problems.append("confidence is higher than the evidence allows")

    known_refs = {e["id"] for e in package.get("evidence", [])}
    refs = data.get("evidence_refs")
    if not isinstance(refs, list) or any(r not in known_refs for r in refs):
        problems.append("evidence_refs cite evidence that doesn't exist")
    elif not refs and draft.diagnostic_code != "UNKNOWN":
        problems.append("evidence_refs is empty")

    if not problems:
        text = " ".join([summary, cause, *steps])
        if _URL.search(text) or _KEYLIKE.search(text) or _EMAIL.search(text):
            problems.append("output contains a link, key or email")
        allowed_numbers = _numbers(str(package))
        invented = _numbers(text) - allowed_numbers
        if invented:
            problems.append(f"output contains numbers not in the evidence: {sorted(invented)}")

    return (not problems), problems
