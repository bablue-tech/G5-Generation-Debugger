from diagnostics.redact import redact


def test_hides_tokens_in_links_and_keeps_only_the_host():
    out = redact("callback https://jobs.example.internal/webhook?token=abc123SECRET failed")
    assert "SECRET" not in out and "webhook" not in out
    assert "https://jobs.example.internal/…" in out


def test_hides_bearer_tokens_keys_jwts_and_emails():
    text = (
        "Authorization: Bearer abcdefghijklmnop12345 "
        "key sk-live_ABCDEFGHIJKLMNOPQRST "
        "google AIzaSyA1234567890abcdefghijklmnopqrstu "
        "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk "
        "contact artist@galleri5.com"
    )
    out = redact(text)
    for secret in ["abcdefghijklmnop12345", "sk-live_", "AIzaSy", "eyJhbGci", "artist@galleri5.com"]:
        assert secret not in out


def test_truncates_and_collapses_whitespace():
    out = redact("word\n\n  " * 200, limit=50)
    assert len(out) == 50 and out.endswith("…")
    assert "\n" not in out


def test_empty():
    assert redact(None) == "" and redact("") == ""
