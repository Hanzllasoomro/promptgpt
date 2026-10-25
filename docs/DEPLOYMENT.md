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
- The frontend Dockerfile accepts `VITE_API_URL` as a build argument:
  `docker build --build-arg VITE_API_URL=https://your-backend.example.com ./frontend`.

## Docker Compose (local / single VPS)

```bash
docker compose up --build
```

The compose frontend passes `http://localhost:8000` as its build-time API URL,
so it can run independently from the backend container. For a remote backend,
override the build argument in your deployment configuration.
