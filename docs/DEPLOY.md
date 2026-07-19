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
   - `VITE_LIVE_API_BASE` = `https://<your-hetzner-host>`
4. Production auto-deploys on every push to `main`.

CLI alternative:

```bash
npx vercel link
npx vercel env add VITE_LIVE_API_BASE production
npx vercel --prod
```

## Hetzner (live backend only)

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
