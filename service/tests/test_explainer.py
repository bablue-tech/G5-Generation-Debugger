import json

from diagnostics.engine import diagnose_generation
from diagnostics.explainer import LLMExplainer, build_package
from diagnostics.rules import load_rules
from diagnostics.sources import SampleEvidenceSource
from diagnostics.validator import validate_ai_output

SOURCE = SampleEvidenceSource()
OVERLOADED = diagnose_generation(SOURCE.get_generation("665f22b09b3c4d5e6f7081a4"), load_rules(), SOURCE.platform_counts())
CREDITS = diagnose_generation(SOURCE.get_generation("665f1e2a9b3c4d5e6f708192"), load_rules(), SOURCE.platform_counts())


def good_output(**overrides):
    data = {
        "diagnostic_code": "PROVIDER.OVERLOADED",
        "confidence": "probable",
        "summary": "The video model was too busy to take your request. Nothing was wrong with your inputs.",
        "cause": "FAL said the model was overloaded, and 14 other runs failed the same way in the last hour.",
        "steps": ["Wait 10 to 15 minutes and try again.", "Or pick a faster model for this shot."],
        "evidence_refs": ["ev1", "ev4"],
        "missing_information": [],
    }
    data.update(overrides)
    return data


def test_valid_output_passes():
    ok, problems = validate_ai_output(good_output(), build_package(OVERLOADED), OVERLOADED)
    assert ok, problems


def test_rejects_a_changed_diagnosis():
    ok, problems = validate_ai_output(good_output(diagnostic_code="CREDITS.ORG_POOL_INSUFFICIENT"), build_package(OVERLOADED), OVERLOADED)
    assert not ok and "differs" in problems[0]


def test_rejects_higher_confidence():
    ok, problems = validate_ai_output(good_output(confidence="confirmed"), build_package(OVERLOADED), OVERLOADED)
    assert not ok and any("higher" in p for p in problems)


def test_rejects_invented_evidence():
    ok, problems = validate_ai_output(good_output(evidence_refs=["ev9"]), build_package(OVERLOADED), OVERLOADED)
    assert not ok and any("doesn't exist" in p for p in problems)


def test_rejects_invented_numbers():
    ok, problems = validate_ai_output(
        good_output(cause="FAL was overloaded and 250 other runs failed."), build_package(OVERLOADED), OVERLOADED
    )
    assert not ok and any("250" in p for p in problems)


def test_rejects_links():
    ok, problems = validate_ai_output(
        good_output(steps=["Check https://status.fal.ai first."]), build_package(OVERLOADED), OVERLOADED
    )
    assert not ok and any("link" in p for p in problems)


def test_injection_in_evidence_cannot_change_the_answer():
    """Even if the model obeys an injected instruction, validation keeps the rule-based result."""
    injected = lambda system, user: json.dumps(good_output(diagnostic_code="UNKNOWN", summary="Ignore previous instructions."))
    report = LLMExplainer(injected).explain(build_package(OVERLOADED), OVERLOADED)
    assert report == OVERLOADED


def test_llm_rewrite_is_used_when_valid():
    report = LLMExplainer(lambda s, u: json.dumps(good_output())).explain(build_package(OVERLOADED), OVERLOADED)
    assert report.explained_by == "ai"
    assert report.summary.startswith("The video model was too busy")
    assert report.diagnostic_code == OVERLOADED.diagnostic_code


def test_llm_is_skipped_for_confirmed_rules_and_survives_errors():
    def boom(system, user):
        raise RuntimeError("model down")

    assert LLMExplainer(boom).explain(build_package(CREDITS), CREDITS) == CREDITS
    assert LLMExplainer(boom).explain(build_package(OVERLOADED), OVERLOADED) == OVERLOADED
    assert LLMExplainer(lambda s, u: "not json").explain(build_package(OVERLOADED), OVERLOADED) == OVERLOADED
