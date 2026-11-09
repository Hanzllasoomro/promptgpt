# PromptGPT backend

FastAPI service. Stateless: no database, no stored keys.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Docs at http://localhost:8000/docs

## LangChain (optional)

The default chat path uses lightweight httpx adapters and needs no
LangChain. To enable the LangChain path (`POST /api/chat/run-langchain`,
and the "Run via LangChain" checkbox in the Chat tab), install the
optional packages into the same venv and restart the server:

```bash
pip install -r requirements-langchain.txt
```

Verify with `GET /api/health` — it reports `"langchain_available": true`.
Without the packages the endpoint returns 501 with these instructions
instead of failing. Conversation history works on both paths.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | Health + LangChain availability |
| GET | /api/providers | LLM provider catalogue (no keys) |
| POST | /api/prompts/generate | Deterministic prompt engineering |
| GET | /api/chatbots?prompt=… | Send-to-chatbot links |
| POST | /api/chat/run | Chat via your key (`X-LLM-API-Key` header) |
| POST | /api/chat/run-stream | Same, streamed as SSE delta events (Chat tab default) |
| POST | /api/chat/run-langchain | Same, via LangChain (optional deps) |
| POST | /api/keys/check | Format-only key check, nothing stored |

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```
