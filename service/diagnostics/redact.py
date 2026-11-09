"""Scrub secrets and personal data from error text before it is stored, shown or sent to an AI model."""

from __future__ import annotations

import re
from urllib.parse import urlsplit

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?i)\b(authorization|bearer)(\s*[:=]?\s*)[A-Za-z0-9._~+/=-]{8,}"), r"\1\2[redacted]"),
    (re.compile(r"(?i)([?&](?:token|key|api_key|apikey|access_token|signature|sig|x-amz-[a-z-]+)=)[^&\s\"'<>]+"), r"\1[redacted]"),
    (re.compile(r"\b(?:sk|pk|rk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{12,}\b"), "[redacted-key]"),
    (re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"), "[redacted-key]"),
    (re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b"), "[redacted-token]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[redacted-email]"),
]
_URL = re.compile(r"https?://[^\s\"'<>)]+")


def _host_only(url: str) -> str:
    try:
        parts = urlsplit(url)
        return f"{parts.scheme}://{parts.hostname}/…" if parts.hostname else "[link]"
    except ValueError:
        return "[link]"


def redact(text: str | None, limit: int = 400) -> str:
    if not text:
        return ""
    out = text
    for pattern, replacement in _PATTERNS:
        out = pattern.sub(replacement, out)
    out = _URL.sub(lambda m: _host_only(m.group(0)), out)
    out = " ".join(out.split())
    if len(out) > limit:
        out = out[: limit - 1] + "…"
    return out
