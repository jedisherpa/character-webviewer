# Character Studio Webviewer

Three local visualizers, one static site:

| Local | Route | What |
|-------|-------|------|
| `:4310` | `/joe/base250` | Wizard Joe · Base 250 |
| `:4350` | `/joe/alpha-hd` | Wizard Joe · Alpha HD |
| `:4370` | `/dragon` | Dragonview · Dragon / Kingfisher / Joe |

## Architecture

- **Vercel** — static visualizers (CDN, auto-deploy from GitHub)
- **Hetzner** — optional live backend only (STT / chat / TTS / dual-view)

Visualizers do **not** need a server process. Set `VITE_LIVE_API_BASE` when you want mic/chat/speech against the existing Prism/RobinSpeech Hetzner host.

Full deploy notes: [docs/DEPLOY.md](docs/DEPLOY.md)

## Develop

```bash
npm install
npm run sync-assets   # copies slim assets from ~/RobinSpeech + ~/dragonview
npm run dev           # http://localhost:4400
```

Optional live backend (local or Hetzner):

```bash
VITE_LIVE_API_BASE=http://127.0.0.1:4311 npm run dev
# or
VITE_LIVE_API_BASE=https://your.hetzner.host npm run dev
```

## Build / Vercel

```bash
npm run build
```

Framework: **Vite** · Output: `dist` · Rewrites: SPA (`vercel.json`)

Env (optional):

| Name | Purpose |
|------|---------|
| `VITE_LIVE_API_BASE` | Hetzner HTTPS origin for live API (no trailing slash) |

## GitHub auto-deploy

1. Push this repo to GitHub (`main`).
2. Import in Vercel → connect the repo → Production branch `main`.
3. Every push deploys; PRs get preview URLs.

## Hetzner live backend

Reuse **RobinSpeech** Hetzner deploy (`docs/hetzner-web-hosting.md`, workflow `deploy-hetzner.yml`).  
Enable CORS for the Vercel origin, then set `VITE_LIVE_API_BASE` on Vercel and redeploy.

## Controls

- **Wizard Joe** — category rail, pose grid, world drawer, clickable gamepad
- **Dragonview** — browser world-space sim, pose grid, clickable gamepad
