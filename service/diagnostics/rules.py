"""Load the shared rule registry and match it against generation facts."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from .models import CONFIDENCE_ORDER

SHARED_DIR = Path(os.environ.get("DIAGNOSTICS_SHARED_DIR", Path(__file__).resolve().parents[2] / "shared"))


@lru_cache(maxsize=4)
def load_rules(path: str | None = None) -> dict[str, Any]:
    target = Path(path) if path else SHARED_DIR / "diagnostic-rules.json"
    doc = json.loads(target.read_text(encoding="utf-8"))
    for rule in doc["rules"]:
        for matcher in rule["match"]:
            if "regex" in matcher:
                matcher["_compiled"] = re.compile(matcher["regex"], re.IGNORECASE)
    return doc


@dataclass
class RuleMatch:
    rule: dict[str, Any]
    confidence: str
    captures: dict[str, str] = field(default_factory=dict)

    @property
    def code(self) -> str:
        return self.rule["code"]


def _match_one(matcher: dict[str, Any], facts: dict[str, Any]) -> dict[str, str] | None:
    value = facts.get(matcher["field"])
    if "in" in matcher:
        if value is None:
            return None
        return {} if value in matcher["in"] else None
    if "regex" in matcher:
        found = matcher["_compiled"].search(str(value or ""))
        if not found:
            return None
        names = matcher.get("captures", [])
        return {name: found.group(i + 1) for i, name in enumerate(names) if i < len(found.groups()) and found.group(i + 1)}
    return None


def match_rules(doc: dict[str, Any], facts: dict[str, Any]) -> list[RuleMatch]:
    """Return every rule that matches, in registry order. A rule matches if any of its matchers does."""
    matches: list[RuleMatch] = []
    for rule in doc["rules"]:
        for matcher in rule["match"]:
            captures = _match_one(matcher, facts)
            if captures is not None:
                confidence = matcher.get("confidence", rule["confidence"])
                matches.append(RuleMatch(rule=rule, confidence=confidence, captures=captures))
                break
    return matches


def lower_confidence(a: str, b: str) -> str:
    return a if CONFIDENCE_ORDER.index(a) <= CONFIDENCE_ORDER.index(b) else b
