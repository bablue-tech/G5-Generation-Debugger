import pytest
from fastapi.testclient import TestClient

from app import create_app
from diagnostics.api import current_user
from diagnostics.service import DiagnosticsService, RateLimiter, SampleTicketClient, User
from diagnostics.sources import SampleEvidenceSource

STUDIO = User(id="artist-1", org_id="org-galleri5-studio")
OUTSIDER = User(id="someone-else", org_id="org-elsewhere")


@pytest.fixture()
def setup():
    tickets = SampleTicketClient()
    service = DiagnosticsService(source=SampleEvidenceSource(), tickets=tickets, limiter=RateLimiter(limit=3, window_s=60))
    app = create_app(service)
    state = {"user": STUDIO}
    app.dependency_overrides[current_user] = lambda: state["user"]
    return TestClient(app), service, tickets, state


def test_diagnoses_a_share_link(setup):
    client, service, _, _ = setup
    link = "https://aistudio.galleri5.com/model-garden?inference-id=665f1e2a9b3c4d5e6f708192"
    res = client.post("/api/v1/diagnostics", json={"reference": link})
    assert res.status_code == 200 and res.headers["cache-control"] == "no-store"
    body = res.json()
    assert body["kind"] == "diagnosis"
    assert body["report"]["diagnostic_code"] == "CREDITS.ORG_POOL_INSUFFICIENT"
    assert service.audit_log[-1]["action"] == "diagnosed"


def test_session_link_lists_failed_generations_first(setup):
    client, *_ = setup
    res = client.post("/api/v1/diagnostics", json={"reference": "https://aistudio.galleri5.com/model-garden/x?unit-session-id=665f1e1f9b3c4d5e6f708100"})
    body = res.json()
    assert body["kind"] == "session"
    statuses = [c["status"] for c in body["candidates"]]
    assert statuses == ["failed", "failed", "completed"]


def test_other_workspace_gets_the_same_404_as_missing(setup):
    client, _, _, state = setup
    state["user"] = OUTSIDER
    other = client.post("/api/v1/diagnostics", json={"reference": "665f1e2a9b3c4d5e6f708192"})
    missing = client.post("/api/v1/diagnostics", json={"reference": "aaaaaaaaaaaaaaaaaaaaaaaa"})
    assert other.status_code == missing.status_code == 404
    assert other.json() == missing.json()


def test_bad_links_get_a_helpful_422(setup):
    client, *_ = setup
    res = client.post("/api/v1/diagnostics", json={"reference": "https://example.com/x"})
    assert res.status_code == 422
    assert "AI Studio" in res.json()["detail"]


def test_escalation_creates_a_ticket_with_the_diagnosis(setup):
    client, _, tickets, _ = setup
    report = client.post("/api/v1/diagnostics", json={"reference": "jr-0b7d55c1"}).json()["report"]
    res = client.post(f"/api/v1/diagnostics/{report['id']}/escalate", json={"comment": "Needed for tonight's review"})
    assert res.status_code == 200 and res.json()["ticket_id"].startswith("TCK-")
    ticket = tickets.created[-1]
    assert ticket["category"] == "generation" and ticket["job_id"] == "jr-0b7d55c1"
    assert "JR.LOST_TRACK" in ticket["comment"]


def test_reports_are_private_to_their_owner(setup):
    client, _, _, state = setup
    report = client.post("/api/v1/diagnostics", json={"reference": "665f30c49b3c4d5e6f7081f0"}).json()["report"]
    assert client.get(f"/api/v1/diagnostics/{report['id']}").status_code == 200
    state["user"] = User(id="artist-2", org_id="org-galleri5-studio")
    assert client.get(f"/api/v1/diagnostics/{report['id']}").status_code == 404


def test_feedback_is_recorded(setup):
    client, service, _, _ = setup
    report = client.post("/api/v1/diagnostics", json={"reference": "665f22b09b3c4d5e6f7081a4"}).json()["report"]
    assert client.post(f"/api/v1/diagnostics/{report['id']}/feedback", json={"helpful": False, "wrong_cause": True}).status_code == 204
    assert service.feedback[-1] == {"diagnosis_id": report["id"], "code": "PROVIDER.OVERLOADED", "helpful": False, "wrong_cause": True}


def test_rate_limit(setup):
    client, *_ = setup
    codes = [client.post("/api/v1/diagnostics", json={"reference": "665f30c49b3c4d5e6f7081f0"}).status_code for _ in range(4)]
    assert codes == [200, 200, 200, 429]
