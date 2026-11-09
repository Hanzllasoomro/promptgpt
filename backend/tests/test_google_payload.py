"""Regression tests for the Gemini systemInstruction fix.

Every Google call with no system instruction used to send
``"systemInstruction": null`` in the request body. The field must be
omitted entirely when empty, and present when a system instruction
was given.
"""
from app.llm.providers import _google_payload


def test_empty_system_omits_system_instruction():
    payload = _google_payload("Say hi", "", 0.7, 1024)
    assert "systemInstruction" not in payload
    assert payload["contents"] == [{"parts": [{"text": "Say hi"}]}]
    assert payload["generationConfig"]["maxOutputTokens"] == 1024


def test_whitespace_system_omits_system_instruction():
    payload = _google_payload("Say hi", "   ", 0.7, 1024)
    assert "systemInstruction" not in payload


def test_given_system_keeps_system_instruction():
    payload = _google_payload("Say hi", "Be concise.", 0.7, 1024)
    assert payload["systemInstruction"] == {"parts": [{"text": "Be concise."}]}
