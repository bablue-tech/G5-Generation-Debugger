import pytest

from diagnostics.resolver import Reference, ReferenceError, parse_reference

ID = "665f1e2a9b3c4d5e6f708192"
SESSION = "665f1e1f9b3c4d5e6f708100"


@pytest.mark.parametrize(
    "raw, expected",
    [
        (f"https://aistudio.galleri5.com/model-garden?inference-id={ID}&unit-session-id={SESSION}", Reference("inference", ID)),
        (f"https://aistudio.galleri5.com/model-garden/fal-ai/seedance?inference_id={ID}", Reference("inference", ID)),
        (f"https://aistudio.galleri5.com/generations/{ID}", Reference("inference", ID)),
        (f"https://aistudio.galleri5.com/generations/{ID.upper()}/", Reference("inference", ID)),
        (f"https://aistudio.galleri5.com/model-garden/x?unit-session-id={SESSION}&tab=sessions", Reference("session", SESSION)),
        (f"https://aistudio.galleri5.com/model-garden/x?unit_session_id={SESSION}", Reference("session", SESSION)),
        (f"  {ID}  ", Reference("inference", ID)),
        ("jr-7c41a9e2", Reference("job", "jr-7c41a9e2")),
    ],
)
def test_accepts_known_link_shapes(raw, expected):
    assert parse_reference(raw) == expected


@pytest.mark.parametrize(
    "raw, message",
    [
        ("", "Paste a generation link"),
        ("http://aistudio.galleri5.com/generations/" + ID, "Only https"),
        ("https://evil.example.com/generations/" + ID, "doesn't look like an AI Studio"),
        ("https://aistudio.galleri5.com.evil.com/generations/" + ID, "doesn't look like an AI Studio"),
        ("https://user:pw@aistudio.galleri5.com/generations/" + ID, "doesn't look like an AI Studio"),
        ("https://aistudio.galleri5.com:8443/generations/" + ID, "doesn't look like an AI Studio"),
        ("javascript:alert(1)", "Only https"),
        ("https://aistudio.galleri5.com/generations/not-an-id", "doesn't look valid"),
        ("https://aistudio.galleri5.com/model-garden?tab=templates", "couldn't find a generation"),
        ("https://aistudio.galleri5.com/" + "a" * 3000, "too long"),
        ("hello world", "Only https"),
    ],
)
def test_rejects_bad_input_with_a_clear_message(raw, message):
    with pytest.raises(ReferenceError, match=message):
        parse_reference(raw)
