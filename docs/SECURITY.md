# Security model

## Keys

- **Storage:** browser localStorage only, under `promptgpt:key:<provider>`.
  The backend has no key store of any kind.
- **Transit:** `X-LLM-API-Key` header on `POST /api/chat/run` (and
  `/api/chat/run-langchain`). Never a query parameter, so keys do not
  appear in URLs, referrers or access logs.
- **Use:** forwarded once to the chosen provider over HTTPS, then dropped.
- **Logs/responses:** the backend never logs a key and never returns one.
  `redact()` in `backend/app/security.py` is the only safe display form.
- **Clearing:** "Clear all keys" in the Keys tab removes them from the
  browser. There is nothing server-side to delete, because nothing was
  stored there.
- **Local servers:** for Ollama/LM Studio the "key" can be any non-empty
  string; it is still only sent to the base URL you configured.

## What this does not do

- It does not validate a key against a provider without the user asking
  to chat. `/api/keys/check` is format-only.
- It does not protect a key from someone with access to the user's own
  browser — that is the same trust model as any BYO-key tool.
- Prefilled chatbot links put the *prompt* (not a key) in a URL. Do not
  put secrets in a prompt you send to a chatbot.

## Prompt injection note

Prompts engineered here are user-authored text. They are sent to the
provider or chatbot exactly as shown. Review the engineered prompt before
sending it anywhere, especially if it came from pasted third-party text.
