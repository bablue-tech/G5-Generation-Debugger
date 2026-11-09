"""Turn a pasted AI Studio link (or bare ID) into a typed reference.

The link is only parsed, never fetched. Only allowlisted hosts are accepted,
and IDs must match the expected format before anything is looked up.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

ALLOWED_HOSTS = frozenset({"aistudio.galleri5.com"})
MAX_LENGTH = 2048
OBJECT_ID = re.compile(r"^[a-f0-9]{24}$", re.IGNORECASE)
JOB_ID = re.compile(r"^jr-[A-Za-z0-9-]{4,64}$")
GENERATION_PATH = re.compile(r"^/generations/([^/]+)/?$")


class ReferenceError(ValueError):
    """Raised when the input can't be turned into a valid reference. The message is user-facing."""


@dataclass(frozen=True)
class Reference:
    kind: str  # "inference" | "session" | "job"
    id: str


def parse_reference(raw: str | None, allowed_hosts: frozenset[str] = ALLOWED_HOSTS) -> Reference:
    value = (raw or "").strip()
    if not value:
        raise ReferenceError("Paste a generation link or ID.")
    if len(value) > MAX_LENGTH:
        raise ReferenceError("That's too long to be an AI Studio link.")

    if JOB_ID.match(value):
        return Reference("job", value)
    if OBJECT_ID.match(value):
        return Reference("inference", value.lower())

    try:
        parts = urlsplit(value)
        port = parts.port
    except ValueError as exc:
        raise ReferenceError("This doesn't look like a link or a generation ID.") from exc

    if parts.scheme != "https":
        raise ReferenceError("Only https links from AI Studio are accepted.")
    host = (parts.hostname or "").lower()
    if host not in allowed_hosts:
        raise ReferenceError("This doesn't look like an AI Studio generation link.")
    if parts.username or parts.password or port not in (None, 443):
        raise ReferenceError("This doesn't look like an AI Studio generation link.")

    query = parse_qs(parts.query)

    def first(*names: str) -> str | None:
        for name in names:
            values = query.get(name)
            if values and values[0].strip():
                return values[0].strip()
        return None

    inference_id = first("inference-id", "inference_id")
    if inference_id:
        return _checked("inference", inference_id)

    match = GENERATION_PATH.match(parts.path)
    if match:
        return _checked("inference", match.group(1))

    session_id = first("unit-session-id", "unit_session_id")
    if session_id:
        return _checked("session", session_id)

    raise ReferenceError("We couldn't find a generation or session ID in this link.")


def _checked(kind: str, ident: str) -> Reference:
    if not OBJECT_ID.match(ident):
        raise ReferenceError("The ID in this link doesn't look valid.")
    return Reference(kind, ident.lower())
