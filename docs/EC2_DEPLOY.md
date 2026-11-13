# Deploy on a single EC2 host

One Ubuntu instance runs the whole app with `docker compose`. Every
push to `main` redeploys it automatically via
`.github/workflows/deploy-ec2.yml`: it pulls the published images
from Docker Hub (`.github/workflows/docker-hub.yml`) and starts the
stack, building on the host only if the pull fails. No load balancer,
no managed services — just the instance.

## 1. Launch the instance

AWS Console → EC2 → Launch instance:

- **Image:** Ubuntu Server 24.04 LTS.
- **Type:** `t3.small` (2 vCPU, 2 GiB). `t3.micro` (1 GiB) is too
  small: the frontend build runs out of memory on it.
- **Disk:** 20 GiB gp3 (the two images plus build cache need room).
- **Key pair:** create one and download the `.pem` file. Keep it
  private — it is the only SSH credential.
- **Security group** (inbound):
  - `22` — SSH, from your IP only.
  - `80`, `443` — HTTP/HTTPS, from anywhere (used once a domain is
    set; harmless before that).
  - `5173` — only until a domain is set, so the app is reachable by
    public IP. Remove it once HTTPS is on.
  - Do **not** open `8000`: the backend is only reached through the
    frontend proxy, never directly from the internet.
- **Elastic IP:** allocate one and associate it, so the public IP
  never changes when the instance restarts. Note it down as
  `EC2_HOST`.

## 2. Install Docker on the instance

SSH in (`ssh -i key.pem ubuntu@<EC2_HOST>`) and run:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version && docker compose version
```

`newgrp docker` (or logging out and back in) is needed so the
`ubuntu` user can run Docker without `sudo` — the deploy workflow
runs as that user.

## 3. First deploy (manual, proves the host works)

```bash
git clone https://github.com/Hanzllasoomro/promptgpt.git ~/promptgpt
cd ~/promptgpt
docker compose up -d --build
curl -fsS http://localhost:8000/api/health
curl -fsS http://localhost:5173/api/health
```

Open `http://<EC2_HOST>:5173` in a browser. The app works; chat uses
each visitor's own key from the Keys tab, so no server secret is
needed. (Optional server-side fallbacks go in `backend/.env` on the
host — see `backend/.env.example`. Never commit that file.)

## 4. Turn on automatic deploys

The three workflow files cannot be pushed by the assistant's GitHub
App (it lacks workflow permission), so add them from your PC once:

```bash
git clone https://github.com/Hanzllasoomro/promptgpt.git   # if needed
cd promptgpt
# copy .github/workflows/ci.yml, .github/workflows/deploy-ec2.yml and
# .github/workflows/docker-hub.yml into this repo (attached to the
# assistant's messages, or already in the workspace copy)
git add .github/workflows/ci.yml .github/workflows/deploy-ec2.yml .github/workflows/docker-hub.yml
git commit -m "CI + EC2 deploy + Docker Hub workflows"
git push origin main
```

Then add the repository secrets (repo → Settings → Secrets and
variables → Actions → Secrets):

| Secret | Value |
|---|---|
| `EC2_HOST` | Elastic IP from step 1 |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | the **private** key — the full contents of the `.pem` file, including the `BEGIN`/`END` lines |
| `DOCKERHUB_USERNAME` | your Docker Hub username (lowercase) |
| `DOCKERHUB_TOKEN` | a Docker Hub access token (Account Settings → Security → New Access Token) — use a token, not your password |

The Docker Hub secrets feed the publish workflow; the deploy itself
needs no Docker Hub login on the host because the repositories are
public. The `DOCKERHUB_USERNAME` default in `docker-compose.yml` is
`hanzllasoomroofficial` — change it if your Docker Hub username ever
differs, otherwise the EC2 pull falls back to building on the host.

Trigger the first deploy manually: Actions tab → "Deploy to EC2" →
"Run workflow". After that, every push to `main` that touches the
app or the compose files deploys automatically. Watch the run in the
Actions tab; it ends with the two health checks and `docker compose
ps` output.

## 5. Domain + HTTPS (optional, recommended)

1. In your DNS, add an `A` record for the domain (e.g.
   `promptgpt.example.com`) pointing at the Elastic IP.
2. Add a repository **variable** (same Secrets page → Variables tab):
   `DOMAIN` = your domain.
3. Push any change (or run the workflow manually). The deploy now
   uses `docker-compose.prod.yml`, which adds Caddy: it serves the
   app on 80/443 and issues/renews the Let's Encrypt certificate
   automatically. Remove `5173` from the security group afterwards.

## Security notes

- SSH only from your IP; never open `8000` publicly.
- The `.pem` / `EC2_SSH_KEY` is a root-level credential for the host:
  if it ever leaks, replace the key pair (or the instance) and update
  the secret.
- The app itself keeps no user data server-side: keys and history
  live in each visitor's browser.

## Troubleshooting

- **Deploy fails at `docker compose up`:** SSH in and run
  `cd ~/promptgpt && docker compose logs --tail 50` to see the
  backend/frontend logs. A build failure usually means the host ran
  out of memory (use `t3.small` or bigger) or disk
  (`docker system df`, then `docker system prune -f`).
- **Health check fails but containers are up:** the backend can take
  ~10s to start; the workflow already waits on the compose
  healthcheck. Check `docker compose ps` — the backend must show
  `healthy`.
- **Site loads but chat errors:** the app is fine; it is the
  provider key/quota. A free-tier Gemini key is limited to 20
  requests/day per model, and the app falls back from 3.8-flash to
  3.5-flash when the quota is exhausted.
- **Caddy shows a certificate error:** DNS must resolve the domain
  to the Elastic IP *before* the deploy runs, and ports 80/443 must
  be open — Let's Encrypt validates over HTTP on port 80.
