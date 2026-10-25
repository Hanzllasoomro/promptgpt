"""API-key handling: session-only, never stored, never logged.

Rules enforced by this module and by code review convention:
- A key arrives only in the ``X-LLM-API-Key`` request header (or, as a
  fallback, a server-side environment variable). It is never accepted as a
  query parameter, so it cannot leak into access logs or shared URLs.
- It is held in memory for the single outbound provider call and then
  dropped. There is no database, file, cache or log line that holds it.
- Error messages and logs must call :func:`redact` before mentioning a key.
- Keys are never returned in any API response.
"""

from __future__ import annotations


def redact(key: str | None) -> str:
    """Return a safe, non-reversible display form of a key."""
    if not key:
        return "<none>"
    key = key.strip()
    if len(key) <= 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


def is_plausible_key(key: str | None) -> bool:
    """Loose sanity check only: non-empty and not an obvious placeholder."""
    if not key:
        return False
    key = key.strip()
    if len(key) < 8:
        return False
    return key.lower() not in {"your-api-key", "api-key", "test", "xxx"}
