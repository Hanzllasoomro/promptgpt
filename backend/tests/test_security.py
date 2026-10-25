from app.security import is_plausible_key, redact


def test_redact_never_returns_full_key():
    assert redact("sk-abcdefgh12345678") == "sk-a...5678"
    assert "abcdefgh" not in redact("sk-abcdefgh12345678")
    assert redact(None) == "<none>"
    assert redact("short") == "***"


def test_placeholder_keys_rejected():
    assert not is_plausible_key("")
    assert not is_plausible_key("your-api-key")
    assert not is_plausible_key("short")
    assert is_plausible_key("sk-test-12345678")
