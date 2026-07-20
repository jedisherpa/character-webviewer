# Deploy architecture

```
┌─────────────────────────────┐     optional      ┌──────────────────────────┐
│  Vercel (static CDN)        │ ───────────────►  │  Hetzner (live backend)  │
│  character-webviewer        │   /api/* CORS     │  RobinSpeech / Prism GT  │
│                             │                   │                          │
│  /                 hub      │                   │  STT · TTS · chat        │
│  /joe/alpha-hd     Joe HD   │                   │  live dual-view session  │
│  /joe/base250      Joe 250  │                   │  Caddy HTTPS             │
│  /dragon           3-cast   │                   │                          │
└─────────────────────────────┘                   └──────────────────────────┘
         ▲                                                   ▲
         │ git push main                                     │ deploy-hetzner.yml
         │                                                   │ (RobinSpeech repo)
    GitHub: character-webviewer                    GitHub: RobinSpeech
```

## Why split?

| Layer | Host | Why |
|-------|------|-----|
| Visualizers (poses, stage, gamepad, dragon sim) | **Vercel** | Static assets, global CDN, free previews on every PR |
| Live speech / chat / session | **Hetzner** | Long-lived process, secrets, GPU/whisper, not a good fit for serverless |

The three local ports map cleanly:

| Local | Web route |
|-------|-----------|
| `4310` Base 250 | `/joe/base250` |
| `4350` Alpha HD | `/joe/alpha-hd` |
| `4370` Dragonview | `/dragon` |

No Python process is required on Vercel — Dragonview sim runs in the browser.

## Vercel (this repo)

1. Push `main` to GitHub.
2. Import project at https://vercel.com/new — Framework **Vite**, output `dist`.
3. (Optional) Project env:
   - `VITE_LIVE_API_BASE` = `https://41birdlive.5.78.137.112.sslip.io` (live API + Joe studio)
   - `VITE_BIRD_LIVE_URL` = `https://41birdlive.5.78.137.112.sslip.io` (41 Bird Live iframe / hub card)
4. Production auto-deploys on every push to `main`.

CLI alternative:

```bash
npx vercel link
npx vercel env add VITE_LIVE_API_BASE production
npx vercel env add VITE_BIRD_LIVE_URL production
npx vercel --prod
```

## 41BirdLive (Hetzner one-bird runtime)

Production install of the local `:4341` one-bird stack on the same Hetzner host:

| Item | Value |
|------|--------|
| Public URL | `https://41birdlive.5.78.137.112.sslip.io` |
| Local bind | `127.0.0.1:4341` |
| App root | `/opt/41birdlive` |
| systemd | `41birdlive.service` |
| Source tree | `/opt/41birdlive/src` (release under `current/`) |

Install path (on host): build `robbin-prism-runtime`, then
`/opt/41birdlive/src/deploy/install-41birdlive.sh /opt/41birdlive/src` after placing the binary
under `bin/` or `target/release/`. Nginx site: `deploy/41birdlive.nginx.conf` (CORS for Vercel).

Webviewer surfaces:
- Hub card + route `/41birdlive` embeds the full runtime UI when `VITE_BIRD_LIVE_URL` is set
- LiveDock / Joe studio rant APIs use `VITE_LIVE_API_BASE` (same origin)

## Hetzner (other live backends)

Use the existing **RobinSpeech / Prism GT** Hetzner path — do not re-host the visualizers there unless you want a single-origin setup.

Docs: `RobinSpeech/docs/hetzner-web-hosting.md`  
Workflow: `RobinSpeech/.github/workflows/deploy-hetzner.yml`

Required for the webviewer to call live APIs:

1. Public HTTPS URL (Caddy), e.g. `https://prism-gt.<ip>.sslip.io`
2. **CORS** allowing the Vercel origin:

```caddy
# In the Hetzner Caddy site block, before reverse_proxy:
@cors origin https://character-webviewer.vercel.app https://*.vercel.app
header @cors Access-Control-Allow-Origin "{http.request.header.Origin}"
header @cors Access-Control-Allow-Methods "GET, POST, OPTIONS"
header @cors Access-Control-Allow-Headers "Content-Type, Authorization"
header @cors Vary Origin
@options method OPTIONS
respond @options 204
```

3. Set `VITE_LIVE_API_BASE` on Vercel to that HTTPS origin (no trailing slash).
4. Redeploy Vercel so the env is baked into the client bundle.

### GitHub environment `hetzner` (RobinSpeech)

| Secret | Purpose |
|--------|---------|
| `HETZNER_HOST` | Server IP / DNS |
| `HETZNER_USER` | SSH user |
| `HETZNER_SSH_KEY` | Private key |
| `HETZNER_PUBLIC_URL` | Public HTTPS URL |

## Local

```bash
npm install
npm run sync-assets   # from ~/RobinSpeech + ~/dragonview
npm run dev           # http://localhost:4400

# Optional live backend locally (RobinSpeech cargo serve on 4311):
# VITE_LIVE_API_BASE=http://127.0.0.1:4311 npm run dev
```

## Asset policy

`public/` is committed (~50MB slim packs) so Vercel CI does not need sibling repos.
Re-run `npm run sync-assets` after updating pose libraries, then commit.
