# Frontend: Vite build, then nginx serving the SPA with a same-origin
# /api proxy (see nginx.conf.template). Build with:
#   docker build -t promptgpt-frontend ./frontend
# For a split deployment (frontend static, backend elsewhere) pass the
# backend URL as a build arg instead; the proxy is then unused:
#   docker build --build-arg VITE_API_URL=https://your-backend.example.com -t promptgpt-frontend ./frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Optional build-time backend URL for split deployments. Leave unset
# for the default same-origin setup, where nginx proxies /api.
ARG VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Rendered by the image entrypoint into /etc/nginx/conf.d/default.conf.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Backend origin for the /api proxy. Compose sets this to the backend
# service; a single ECS task uses http://localhost:8000 instead.
ENV BACKEND_URL=http://backend:8000
EXPOSE 80
