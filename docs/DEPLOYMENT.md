# Deployment

Backend and frontend are independent. Deploy them separately; the only
link is the frontend's `VITE_API_URL`.

## Backend (FastAPI)

Any container host works: Render, Railway, Fly.io, or a VPS.

- Build: `backend/Dockerfile` (Python 3.12-slim, uvicorn, `$PORT`).
- Env: `CORS_ORIGINS` must include the deployed frontend origin, e.g.
  `https://your-frontend.vercel.app`. Optional: `OPENAI_API_KEY`,
  `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `HF_API_KEY` as server fallbacks.
- Health check: `GET /api/health`.

## Frontend (React + Vite)

Vercel, Netlify, Render static, or the included nginx Dockerfile.

- Build: `npm install && npm run build` → `dist/`.
- Env (build time): `VITE_API_URL=https://your-backend.onrender.com`.
  Leave it empty only when the frontend is served behind the same origin
  that proxies `/api` to the backend (local Vite dev does this).
- No server-side secret is needed for the frontend.

## Docker Compose (local / single VPS)

```bash
docker compose up --build
```

Note: the compose frontend is a static nginx build, so for production
set `VITE_API_URL` at build time (edit `frontend/Dockerfile` to pass it
as a build arg) instead of relying on the dev proxy.
