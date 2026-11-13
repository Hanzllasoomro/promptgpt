# API reference

Base URL: the backend, e.g. `http://localhost:8000`. Interactive docs at `/docs`.

## POST /api/prompts/generate

Body: `{ idea, task_type?, audience?, tone?, output_format?, length?, constraints?, context?, examples? }`
Returns: `{ original_idea, engineered_prompt, concise_prompt, tips, task_type }`
No key needed. Deterministic, offline.

## Accuracy rules (behind every model call)

Both surfaces that send text to a model carry the same rules, from
`backend/app/prompt_rules.py`:

- **Generate** appends an "Accuracy rules" section to every engineered
  prompt: no bracketed placeholders (`[Name]`, `[Client]`…), no
  invented names/dates/prices/facts, and missing details become
  *stated assumptions* — never silently baked in. Generate is
  single-shot, so it never tells the model to "ask a clarifying
  question": there is no follow-up to ask in.
- **Chat** (`/api/chat/run`, `/api/chat/run-stream`,
  `/api/chat/run-langchain`) sends a default system prompt with the
  same rules when the caller supplies no `system`. Chat is
  multi-turn, so the default may ask exactly one focused question
  when the answer cannot be written without a missing detail, instead
  of producing a template full of blanks. A caller-supplied `system`
  always wins over the default.

## GET /api/providers

Returns the provider catalogue: ids, display names, default/suggested
models, key help. Never contains a key.

## GET /api/chatbots?prompt=…

Returns prefilled links (ChatGPT, Claude, Gemini, Perplexity, Copilot)
and copy-first links (Mistral, DeepSeek, Grok, Meta AI, Poe), each with
`prefilled: true|false` and a note.

## POST /api/chat/run

Header: `X-LLM-API-Key: <your key>` (or a server env fallback).
Body: `{ provider, model?, prompt, messages?, system?, temperature?, max_tokens?, base_url? }`
`messages` is the conversation history (`[{role: "user"|"assistant", content}]`),
ending with the latest user turn; it is re-sent to the provider on
every call so follow-ups have context. Only the most recent 20
messages (10 turns) are sent; older turns are dropped. Without
`messages` the call is a single prompt, as before.
Returns: `{ provider, model, reply, via: "httpx", latency_ms, usage? }`
— `model` is the one that actually answered, which can differ from the
requested model when a fallback was used (see below).
Errors: 400 = missing/invalid key or unknown provider/model error from
the provider; a provider's own status is passed through (e.g. a Google
503 overload is a 503, not a 400); 502 = provider/network failure.

Retry and fallback: a 503 (transient overload, e.g. Gemini "high
demand") is retried on the same model with backoff (2s, 4s), then the
next model in the provider's list is tried — for Google the Flash
models, in list order (gemini-3.8-flash, then gemini-3.5-flash;
gemini-2.0-flash and gemini-1.5-pro are retired and no longer listed).
A 404 also moves to the next model (retired or never-enabled for this
key/project), as does a 429 (that model's quota/rate limit is
exhausted — the next model has its own quota, so it is tried instead
of retrying the same one). A 400/401/403 is raised at once: retrying a
bad key cannot help. If every model fails, the error names the models
that were tried.

## POST /api/chat/run-stream

Same request shape and key header as `/api/chat/run`, but the reply
streams as server-sent events: `data: {"type": "delta", "text": "..."}`
per chunk, then `data: {"type": "done", "latency_ms": N, "model": "..."}`.
A provider error mid-stream arrives as `data: {"type": "error", "detail": "..."}`
(the HTTP status stays 200 once streaming has started). Missing key
or unknown provider still return a plain 400 before streaming starts.
The Chat tab uses this by default; the LangChain path has no stream
equivalent and stays on `/api/chat/run-langchain`. The browser can
cancel a stream (Stop button); the partial reply stays on screen.

## POST /api/chat/run-langchain

Same shape, `via: "langchain"`. Requires `requirements-langchain.txt`
(`pip install -r requirements-langchain.txt` in the backend venv, then
restart); otherwise 501 with installation instructions. `GET
/api/health` reports `"langchain_available": true` when it is ready.
Conversation history (`messages`) works here too, sent as LangChain
message objects.

## POST /api/keys/check?provider=…

Header: `X-LLM-API-Key`. Format-only check. Returns
`{ provider, format_ok, stored: false }`. Nothing is stored or called.
