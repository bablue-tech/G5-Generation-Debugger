"""Turn one generation record into a diagnosis report, using rules only.

The same logic exists in web/src/lib/engine.ts. Both are checked against
shared/expected-diagnoses.json so they can't drift apart.
"""

from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from .models import DiagnosisReport, EvidenceItem, Recovery, Stage, Subject
from .redact import redact
from .rules import match_rules

STAGE_NAMES = ["Submitted", "Checks", "Queued", "Provider", "Delivered"]
WAITING_STATUSES = {"queued", "dispatching", "dispatched", "pending", "starting"}
PROVIDERS = {
    "fal-ai": "FAL",
    "replicate": "Replicate",
    "minimax": "MiniMax",
    "runway": "Runway",
    "google": "Google",
    "gemini": "Google Gemini",
    "openai": "OpenAI",
    "worldlabs": "World Labs",
    "bytedance": "ByteDance",
    "comfyui": "ComfyUI",
}
_PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")


# ---------- small helpers (mirrored in web/src/lib/format.ts) ----------

def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def clock(value: str | None) -> str | None:
    t = parse_time(value)
    return t.astimezone(timezone.utc).strftime("%H:%M:%S") if t else None


def fmt_duration(seconds: int | None) -> str:
    if seconds is None:
        return "an unknown time"
    if seconds < 60:
        return f"{seconds} s"
    minutes, rest = divmod(seconds, 60)
    return f"{minutes} min {rest} s" if rest else f"{minutes} min"


def fmt_number(value: str) -> str:
    try:
        number = float(value)
    except ValueError:
        return value
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,}"


def provider_for(model_path: str) -> str:
    head = (model_path or "").split("/", 1)[0].lower()
    return PROVIDERS.get(head, head.capitalize() or "Unknown")


def error_text(gen: dict[str, Any]) -> str:
    raw = (gen.get("error_detail") or {}).get("raw_error")
    return " · ".join(p for p in [gen.get("error"), gen.get("error_message"), raw] if p)


def build_facts(gen: dict[str, Any]) -> dict[str, Any]:
    created, completed = parse_time(gen.get("created_at")), parse_time(gen.get("completed_at"))
    duration = int((completed - created).total_seconds()) if created and completed else None
    notice = gen.get("notice_code")
    return {
        "status": (gen.get("status") or "").lower(),
        "error_text": error_text(gen),
        "notice_code": notice.lower() if notice else None,
        "http_status": gen.get("http_status"),
        "model": gen.get("model_label") or gen.get("model_path") or "this model",
        "provider": provider_for(gen.get("model_path", "")),
        "duration": fmt_duration(duration),
    }


def fill(template: str, values: dict[str, Any]) -> tuple[str, bool]:
    missing = False

    def sub(m: re.Match[str]) -> str:
        nonlocal missing
        key = m.group(1)
        if values.get(key) in (None, ""):
            missing = True
            return "unknown"
        return str(values[key])

    return _PLACEHOLDER.sub(sub, template), missing


def stages_for(code: str, stage: str, status: str, gen: dict[str, Any]) -> list[Stage]:
    if code == "STATUS.IN_PROGRESS":
        states = ["ok", "ok", "active", "skip", "skip"] if status in WAITING_STATUSES else ["ok", "ok", "ok", "active", "skip"]
    elif code == "STOPPED.CANCELLED":
        states = ["ok", "ok", "ok", "skip", "skip"]
    elif stage == "none":
        states = ["ok"] * 5
    elif stage in ("credit_check", "submission"):
        states = ["ok", "fail", "skip", "skip", "skip"]
    elif stage == "queue":
        states = ["ok", "ok", "fail", "skip", "skip"]
    elif stage == "provider":
        states = ["ok", "ok", "ok", "fail", "skip"]
    elif stage == "delivery":
        provider_state = "ok" if gen.get("provider_status") == "succeeded" else "unknown"
        states = ["ok", "ok", "ok", provider_state, "fail"]
    else:
        states = ["ok", "ok", "ok" if gen.get("started_at") else "unknown", "unknown", "skip"]
    return [Stage(name=n, state=s) for n, s in zip(STAGE_NAMES, states)]


def diagnose_generation(
    gen: dict[str, Any],
    rules_doc: dict[str, Any],
    platform_counts: dict[str, dict[str, int]] | None = None,
    now: datetime | None = None,
) -> DiagnosisReport:
    facts = build_facts(gen)
    matches = match_rules(rules_doc, facts)
    if matches:
        chosen = matches[0]
        rule, confidence, captures = chosen.rule, chosen.confidence, chosen.captures
    else:
        rule, confidence, captures = rules_doc["fallback"], rules_doc["fallback"]["confidence"], {}
    code = rule["code"]

    counts = (platform_counts or {}).get(code) if not code.startswith(("STATUS.", "STOPPED.")) else None
    values: dict[str, Any] = {**facts, **{k: fmt_number(v) if k in ("required", "available") else v for k, v in captures.items()}}
    if counts:
        values.update(same_count=counts["count"], same_orgs=counts["orgs"])

    summary, _ = fill(rule["summary"], values)
    cause, missing = fill(rule["cause"], values)
    if missing and rule.get("cause_fallback"):
        cause = rule["cause_fallback"]

    # Evidence, numbered in a fixed order.
    evidence: list[EvidenceItem] = []

    def add(time: str | None, source: str, text: str) -> None:
        evidence.append(EvidenceItem(id=f"ev{len(evidence) + 1}", time=time, source=source, text=text))

    shown_error = redact(error_text(gen))
    if shown_error:
        add(clock(gen.get("completed_at")), "Generation record", f"Error: {shown_error}")
    if facts["notice_code"]:
        add(clock(gen.get("completed_at")), "Failure code", f"Recorded code: {facts['notice_code']}")
    if facts["http_status"]:
        add(clock(gen.get("completed_at")), "Provider response", f"HTTP status {facts['http_status']}")
    timeline = gen.get("timeline") or []
    if timeline:
        add(clock(timeline[0][0]), "Job status history", " → ".join(f"{s} {clock(t)}" for t, s in timeline))
    else:
        add(None, "Job status history", "No job history is available for this generation.")
    if facts["status"] in ("completed", "succeeded"):
        add(clock(gen.get("completed_at")), "Generation record", f"Completed with output after {facts['duration']}.")
    if counts:
        add("last 60 min", "Platform", f"{counts['count']} similar failures in the last hour across {counts['orgs']} workspaces.")

    missing_info: list[str] = []
    if not timeline:
        missing_info.append("Job Router history for this job")
    if gen.get("provider_status") == "unknown" and facts["status"] not in ("completed", "succeeded"):
        missing_info.append("Provider-side status (did the provider finish?)")
    if code == "UNKNOWN":
        missing_info.append("A recorded error message")

    threshold = rules_doc.get("platform_notice_threshold", 5)
    platform_notice = (
        f"Platform issue in progress: {counts['count']} similar failures in the last hour across {counts['orgs']} workspaces. The team has been notified."
        if counts and counts["count"] >= threshold
        else None
    )

    tone = rule["tone"]
    failed = tone in ("critical", "warning") and not code.startswith(("STATUS.", "STOPPED."))
    status_label = f"Failed: {rule['title']}" if failed else rule["title"]
    created = (now or datetime.now(timezone.utc)).isoformat().replace("+00:00", "Z")

    return DiagnosisReport(
        id=uuid.uuid4().hex[:12],
        created_at=created,
        subject=Subject(
            inference_id=gen["inference_id"],
            jobrouter_job_id=gen.get("jobrouter_job_id"),
            unit_session_id=gen.get("unit_session_id"),
            model_label=facts["model"],
            provider=facts["provider"],
        ),
        status_label=status_label,
        tone=tone,
        diagnostic_code=code,
        category=rule["category"],
        confidence=confidence,
        failure_stage=rule["stage"],
        summary=summary,
        cause=cause,
        stages=stages_for(code, rule["stage"], facts["status"], gen),
        evidence=evidence,
        steps=list(rule["steps"]),
        recovery=Recovery(**rule["recovery"]),
        actions=list(rule["actions"]),
        credits_note=rule["credits"],
        platform_notice=platform_notice,
        other_candidates=[m.code for m in matches[1:]],
        missing_information=missing_info,
        explained_by="rules",
    )
