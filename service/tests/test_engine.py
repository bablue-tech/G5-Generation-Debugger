import json

import pytest

from diagnostics.engine import diagnose_generation, fmt_duration, fmt_number
from diagnostics.rules import SHARED_DIR, load_rules
from diagnostics.sources import SampleEvidenceSource

SOURCE = SampleEvidenceSource()
RULES = load_rules()
EXPECTED = json.loads((SHARED_DIR / "expected-diagnoses.json").read_text())["expected"]


def diagnose(inference_id):
    return diagnose_generation(SOURCE.get_generation(inference_id), RULES, SOURCE.platform_counts())


@pytest.mark.parametrize("inference_id, expected", EXPECTED.items())
def test_parity_with_shared_expectations(inference_id, expected):
    report = diagnose(inference_id)
    assert report.diagnostic_code == expected["code"]
    assert report.confidence == expected["confidence"]


def test_credit_failure_quotes_the_real_numbers():
    report = diagnose("665f1e2a9b3c4d5e6f708192")
    assert report.status_label == "Failed: Not enough workspace credits"
    assert report.cause == "This run needed 1,200 credits. The workspace credit pool had 9."
    assert [s.state for s in report.stages] == ["ok", "fail", "skip", "skip", "skip"]
    assert report.recovery.label == "Needs an org admin"


def test_overloaded_provider_shows_a_platform_notice():
    report = diagnose("665f22b09b3c4d5e6f7081a4")
    assert report.platform_notice and "14 similar failures" in report.platform_notice
    assert "FAL" in report.cause
    assert any(e.source == "Platform" for e in report.evidence)


def test_lost_job_never_leaks_the_callback_token():
    report = diagnose("665f41de9b3c4d5e6f708233")
    blob = report.model_dump_json()
    assert "SECRET" not in blob and "token=" not in blob
    assert [s.state for s in report.stages] == ["ok", "ok", "ok", "unknown", "fail"]
    assert "Provider-side status (did the provider finish?)" in report.missing_information


def test_completed_job_is_not_a_failure():
    report = diagnose("665f30c49b3c4d5e6f7081f0")
    assert report.status_label == "Completed"
    assert "5 min 10 s" in report.summary
    assert all(s.state == "ok" for s in report.stages)


def test_unknown_failure_is_honest():
    report = diagnose("665f52aa9b3c4d5e6f708301")
    assert report.confidence == "insufficient"
    assert "A recorded error message" in report.missing_information
    assert report.actions == ["escalate"]


@pytest.mark.parametrize("seconds, text", [(None, "an unknown time"), (9, "9 s"), (60, "1 min"), (310, "5 min 10 s")])
def test_fmt_duration(seconds, text):
    assert fmt_duration(seconds) == text


@pytest.mark.parametrize("raw, text", [("1200.0", "1,200"), ("9.0", "9"), ("1200.5", "1,200.5"), ("abc", "abc")])
def test_fmt_number(raw, text):
    assert fmt_number(raw) == text
