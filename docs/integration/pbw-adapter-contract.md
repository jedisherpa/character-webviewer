# PBW Adapter Contract — Character Webviewer ↔ 41 Bird Live

**Status:** living closeout contract for PR `#4` (`feat/pbw-workstation-shell`)  
**Consumer:** `character-webviewer` (this repo)  
**Producer / live authority:** RobinSpeech / one-bird-live birdLive shell  
**Related evidence:** [character-webviewer-parity/](./character-webviewer-parity/), [pbw-parity-checklist.json](./pbw-parity-checklist.json)  
**Prove suite:** `npm run prove:parity` · `npm test`

This document freezes what Character Studio **adapts** from the Personal Broadcast Workstation (PBW) / 41 Bird Live stack, what is **implemented natively**, and what is **explicitly not parity yet**.

---

## 1. Authority & boundaries

| Concern | Authority | Browser role |
|---------|-----------|--------------|
| Live rant / STT / TTS / session tokens | NewsWiz (same-origin to its CLI) | Embed / open only — no foreign `/api/*` with tokens |
| One-bird Prism runtime UI | 41 Bird Live host | Iframe embed at `/41birdlive` |
| Character inspection, rehearsal, cast switch, stage tools | character-webviewer | Native React routes |
| Editorial News Wiz profile package | joe-newsroom | Provenance only in browser |
| Program transport (Preview ≠ Program · Take) | Contract mirror + Production Studio UI | Local state; no encoder bus |
| Stream keys / RTMP / X | Backend only | Never in bundle |

Constraints (carried from parity CONTEXT):

- No ElevenLabs or feed secrets in the browser bundle.
- No reimplementation of the 37-section News Wiz editor in the browser.
- Nate voice profile is Wizard Joe only.
- Program mutates only via explicit **Take**.
- Offline/static mode must remain useful without a live backend.

---

## 2. Routes (Character Studio adapter surface)

Defined in `src/App.jsx`. All routes are path-based (Vite SPA), not hash-based.

| Path | Component | Adapter role | Bird Live counterpart |
|------|-----------|--------------|------------------------|
| `/` | `Hub` | Fleet + studio jump + performer switch | Station Home `#/home` (external fleet card) |
| `/studio` | `ProductionStudio` | Native multi-cast production bay; Preview/Program/Take bar; scenes; sources | Preview & Program `#/live`, Scenes `#/scenes` |
| `/41birdlive` | `BirdLive` | Same-origin iframe (or offline empty state) of Hetzner one-bird UI | Full birdLive shell (all hash routes) |
| `/bird-live` | redirect → `/41birdlive` | Alias | — |
| `/joe` | redirect → `/joe/alpha-hd` | Pack default | Wizard Joe `#/wizard-joe` |
| `/joe/:pack` | `JoeStudio` | Wizard Joe pose studio (`alpha-hd` \| `base250`); NewsWiz dock bay; choreography harness | Wizard Joe page + news desk behaviors |
| `/dragon` | `DragonStudio` | Multi-cast Dragonview world pad | Characters & Scenes cast pick (partial) |
| `*` | redirect → `/` | Catch-all | — |

### Env-backed embeds

| Surface | Env | Default host (fleet) |
|---------|-----|----------------------|
| NewsWiz dock | `VITE_NEWSWIZ_URL` (or `VITE_LIVE_API_BASE`) | `https://newswiz.5.78.137.112.sslip.io` |
| 41 Bird Live iframe | `VITE_BIRD_LIVE_URL` | `https://41birdlive.5.78.137.112.sslip.io` |

Hub also links Prism Station Home at `${BIRD_LIVE}/#/home` (PBW operator workstation on the live host).

### Bird Live hash routes **not** re-hosted natively

From one-bird-live `router.js`: `#/news`, `#/bird`, `#/interactive`, `#/media`, `#/x-output`, `#/evidence`, `#/settings/*` remain on the embedded/remote host only.

---

## 3. Performer modes → Bird Live scenes

Shared vocabulary: `src/shared/performerModes.js`.

### Canonical modes

| Mode id | Label | Hub route (`routeForPerformerHub`) | Library target |
|---------|-------|--------------------------------------|----------------|
| `robin` | Robin | `/41birdlive` | `bird-live` (runtime host) |
| `wizard` | Wizard Joe | `/joe/alpha-hd` | `/wizard-joe-alpha-hd/library.json` |
| `dragon` | Dragon | `/dragon` | `/library/dragon/catalog.json` |
| `kingfisher` | Kingfisher | `/studio?cast=kingfisher` | catalog |
| `prism` | Prism | `/studio?cast=prism` | catalog |
| `speech` | Speech | `/studio?cast=speech` | catalog |
| `wizardjoe` | Joe Pack | `/studio?cast=wizardjoe` | catalog |

Aliases normalized to modes: `bird` → `robin`; `joe` / `wizard-joe` / `wizard_joe` → `wizard`.  
Default: `wizard`. Storage key: `characterStudio.performer.v1`.

### Scene registry mapping (`src/contracts/scenes.js`)

Viewer scene ids use the `bird.*` / core naming used by Production Studio. They are **semantic adapters**, not always 1:1 string equals with one-bird-live `sceneCatalog.js` ids.

| Viewer `CORE_SCENES` id | Kind | Default performer affinity | Bird Live scene / background |
|-------------------------|------|----------------------------|------------------------------|
| `white-stage` | white | `wizardjoe` | `white-wizard` (white bg) |
| `bird-bowl` | bowl | `kingfisher` | `bird-bowl` (robin + bowl) |
| `original-bowl` | bowl | `kingfisher` | `original-bowl` |
| `bird.wall-street-bull.original` | wall-street-bull | `kingfisher` | `original-wall-street-bull` (street + bull overlay) |
| `bird.location.wall-street` … `bird.location.boulder-flatirons` | voxel ×10 | `wizardjoe` | `voxel-*` pack (same 10 files under `/birdLive/backgrounds/voxel/`) |

**Important distinctions (parity locks):**

- Original Wall Street Bull ≠ voxel Wall Street (`isOriginalBullScene` vs `isVoxelWallStreet`).
- Voxel file paths are shared assets under `public/birdLive/backgrounds/`.
- Scene id strings differ across repos by design; adapters map by role + asset path, not by raw id equality.
- Bird Live also has scenes with no direct native twin yet: `robin-window`, `wizard-newsroom`, `be-right-back`.

Program modes (transport vocabulary, not cast) are mirrored separately in `src/contracts/programModes.js`:

`news_channel` · `wizard_joe_special` · `bird_rant` · `standby` · `emergency_slate`  
Schema stamp: `pbw.contracts.v1`.

---

## 4. Stage backgrounds — bull full-bleed

### Preference

`src/shared/stageBackground.js`:

- Values: `bull` (default) · `white`
- Storage: `characterStudio.stageBg.v1`
- Used by Joe / Dragon stage tools (toggle + fullscreen).

### Bull depth stack

`src/shared/BullBackdrop.jsx` + CSS:

1. **Street plate** (`streetFile`) — full-bleed `object-fit: cover`, z0  
2. **Transparent bull cutout** (`overlayFile`) — full-bleed cover at z2 (same pixel grid as street)  
3. **Performer** — rendered above the backdrop by the stage component  

Contract rules:

- **Full-bleed overlay:** the transparent PNG is full-frame. Do **not** size the overlay into `ndcBox` (that double-shrinks the bull).
- **`ndcBox` is for world/occluder math only** (path clearance, behind-bull flight), not for layout shrink.
- Composite fallback plate when stack assets are missing: `compositeFile` / `/bull-plates/...`.
- Parity with one-bird-live `StageCanvas` / bull backdrop: street + full-frame overlay, not always-on-top mask.

World path clearance for bull scenes is proven in `src/contracts/bullWorldPath.js` (`pathValidation`, lands in front, no mass intersection).

---

## 5. NewsWiz dock bay

**Canonical component:** `src/shared/NewsWizEmbed.jsx`  
**Deprecated alternate:** `src/shared/LiveDock.jsx` (cross-origin live API; retained for local experiments only).

### Why embed, not fetch

Session tokens (`x-prism-token`) are same-origin to the NewsWiz CLI. Character Studio must not call foreign `/api/*`. The SPA is iframe-embedded (or opened in a new tab); the embedded document holds the session.

### Joe stage bay layout

On `/joe/:pack` (`JoeStudio`):

- Stage remains the primary visual.
- Under-stage **bay** tabs: **NewsWiz** | **Gamepad**.
- `NewsWizEmbed` is rendered with `docked` + `defaultExpanded={false}` so the dock does not stack over the stage or gamepad.
- Collapsed default: status + open actions; expanded: iframe fills the dock bay body.

CSS: `.newswiz-embed.is-docked` (under-stage), not floating overlay (legacy non-docked styles kept for other surfaces).

Offline when `VITE_NEWSWIZ_URL` unset: dock shows configuration hint; studio remains usable.

---

## 6. Choreography — `fly_speak`

Local rehearsal harness (not the live Program encoder):

| Module | Role |
|--------|------|
| `src/choreography/ChoreographyHarness.jsx` | UI open/run/stop + export |
| `src/choreography/locomotionController.js` | Shared integrator (keyboard / gamepad / script) |
| `src/choreography/script120.js` | Timed bird cues including `fly_speak` blocks |
| `src/choreography/telemetry.js` | CSV / manifest samples |

### Locomotion contract (`cw-locomotion.v2-bird`)

- Stage space: x 0..1 left→right, y 0..1 top→bottom.
- Ground band ≈ 0.72–0.9; flight band ≈ 0.28–0.62.
- `ACTION_SPEEDS.fly_speak = 0.16` (cruise-like, calmer than `fly_forward`).
- `isFlySpeakAction`: `fly_speak` \| `fly` \| `fly_forward`.
- Grounded `speak` speed is 0 (hold); **prefer `fly_speak` for rant-in-air**.

### Script / harness behavior

- Cues with `action: "fly_speak"` set `stage: "speaking"` and keep body clip on `fly_forward` (wings while talking).
- Harness maps drive command: locomotion action stays airborne; `speaking: true`; reduced zoom/bob vs ground.
- Round-4 script blocks (~76s–100s) exercise climb-right, level cruise, and bank reverse while ranting.
- Exports are **browser downloads only** (`artifacts/` gitignored). No external broadcast start.

---

## 7. Contracts already mirrored (native)

| Contract | Path | Prove |
|----------|------|-------|
| Broadcast sources (manual + joe AI/general) | `src/contracts/broadcastSources.js` | `prove:parity` |
| Rant source catalog reuse | `src/shared/rantPipeline.js` | same IDs as contracts |
| Scenes (10 voxels + bull + bowls) | `src/contracts/scenes.js` | distinct bull vs voxel |
| Voice: Wizard Joe Nate only | `src/contracts/voiceProfiles.js` | voiceId + speed 0.9 |
| Preview ≠ Program · Take only | `src/contracts/programState.js` | Take + source-toggle isolation |
| Bull world path | `src/contracts/bullWorldPath.js` | clearance |
| Program modes | `src/contracts/programModes.js` | 5 modes + return rules |
| Performer modes + hub routing | `src/shared/performerModes.js` | adapter prove block |
| Locomotion `fly_speak` | `src/choreography/locomotionController.js` | adapter prove block |

Schema stamp for bird-live wire shapes: `bird-live.contracts.v1` (`schemaVersion.js`).  
PBW program modes stamp: `pbw.contracts.v1`.

---

## 8. What is **NOT** yet parity

Honest non-goals / remaining gaps for this PR:

| Gap | Bird Live / PBW source | Character Studio today | Severity |
|-----|------------------------|------------------------|----------|
| **Program bus** | Live transport, multi-operator program state, station contracts | Local `programState` only (in-memory + storage key); no shared bus / websocket program feed | HIGH for multi-seat ops |
| **X Output** | `#/x-output` page, post/stream outboard | No native route or UI | HIGH for publish |
| **Capture / encoder** | `captureBoundary.js` (`pbw.capture.v1`) — local_file / OBS / backend RTMP; chrome-free Program URL | No capture plan module; choreography CSV ≠ program capture; no RTMP path | HIGH for air |
| Full birdLive shell pages | news desk, interactive, media/voice, evidence, settings sections | Embed-only via `/41birdlive` | MEDIUM |
| Scene id string equality | `original-wall-street-bull`, `voxel-wall-street`, … | `bird.wall-street-bull.original`, `bird.location.*` | LOW (adapter maps by role) |
| Continuous rant orchestration in-app | NewsWiz + bird rant host | NewsWiz iframe; `LiveDock` deprecated; no in-process continuous rant driver | MEDIUM |
| Multi-route browser screenshot matrix | Operator evidence set | Partial / manual; not automated E2E | LOW for contracts, MEDIUM for UX sign-off |
| Actor bridge / runtime status | birdLive `actorBridge` | Not rehosted | MEDIUM |
| Sovereign operator chrome | birdLive shell AppShell | Hub + studio chrome only | LOW |

**Explicit non-parity policy this closeout:**

- Does not start external broadcasts.
- Does not put stream keys in the browser.
- Does not force-merge or deploy from this contract work.

---

## 9. How to verify

```bash
npm run prove:parity   # unit/contract assertions (includes adapter block)
npm run smoke:live     # optional fleet HTTP probes (needs network)
npm test               # prove:parity + smoke:live
npm run build          # production bundle
```

Manual smoke (test plan alignment with PR #4):

1. Hub loads; fleet cards probe status.
2. `/joe/alpha-hd` — choreography harness open/run/stop; export CSV; `fly_speak` airborne + speaking.
3. Stage fullscreen (F) + bull/white toggle.
4. Wall Street Bull: transparent bull full size (not NDC-shrunk).
5. NewsWiz dock under stage (collapsed by default; expand stays in bay).
6. Production Studio: Working ≠ Preview ≠ Program; Take only advances Program.
7. Performer switch routes robin → `/41birdlive`, wizard → `/joe/alpha-hd`, dragon → `/dragon`.

Checklist machine form: [pbw-parity-checklist.json](./pbw-parity-checklist.json).

---

## 10. Change control

- Bump `CONTRACT_SCHEMA_VERSION` / `PBW_SCHEMA_VERSION` when wire shapes change.
- Keep `performerModes.js` and `programModes.js` in lockstep with RobinSpeech / joe-newsroom PBW packages when those move.
- Prefer extending `scripts/prove-parity-contracts.mjs` over silent contract drift.
- Adapter doc + checklist should be updated in the same PR that changes routes, performer maps, bull stack, dock bay, or locomotion actions.
