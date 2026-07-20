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

Visualizers do **not** need a server process. Live rant/chat/TTS runs inside **NewsWiz**
(`newswiz` CLI) same-origin — set `VITE_NEWSWIZ_URL` so Joe studio can embed/open that SPA.
Cross-origin API calls (and session-token mint from Vercel) are disabled on purpose.

Full deploy notes: [docs/DEPLOY.md](docs/DEPLOY.md)

## Develop

```bash
npm install
npm run sync-assets   # copies slim assets from ~/RobinSpeech + ~/dragonview
npm run dev           # http://localhost:4400
```

Optional NewsWiz embed (local or hosted):

```bash
VITE_NEWSWIZ_URL=http://127.0.0.1:4311 npm run dev
# or your deployed NewsWiz origin
VITE_NEWSWIZ_URL=https://your-newswiz-host.example npm run dev
```

## Build / Vercel

```bash
npm run build
```

Framework: **Vite** · Output: `dist` · Rewrites: SPA (`vercel.json`)

Env (optional):

| Name | Purpose |
|------|---------|
| `VITE_NEWSWIZ_URL` | NewsWiz SPA origin (embed + open) — same-origin to `newswiz` CLI |
| `VITE_BIRD_LIVE_URL` | Optional Robin 41BirdLive SPA for hub open/iframe only |

## GitHub auto-deploy

1. Push this repo to GitHub (`main`).
2. Import in Vercel → connect the repo → Production branch `main`.
3. Every push deploys; PRs get preview URLs.

## NewsWiz live backend

Run **NewsWiz** (`newswiz` from `~/RobinSpeech`) locally or on Hetzner. Session tokens
are minted only same-origin inside that SPA. Point `VITE_NEWSWIZ_URL` at it — do not
point Character Studio at 41BirdLive for Joe rant APIs.

## Controls

- **Wizard Joe** — category rail, pose grid, world drawer, clickable gamepad
- **Dragonview** — browser world-space sim, pose grid, clickable gamepad
