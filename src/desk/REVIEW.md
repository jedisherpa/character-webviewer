# U3 — Review: Dialogue desk → dragonview pose clips

**Authority:** Dialogue desk owns beat order. No peer negotiation fields (`peerId`, `peerOrder`, `remoteSeq`) are accepted or emitted.

## Contract

| Field | Required | Notes |
|-------|----------|--------|
| `speakerClipId` | yes | Dragonview pose_id, catalog clip name, or ACT/CAN/FLY/INT short code |
| `listenerClipId` | no | Same id space; skipped if same actor as speaker |
| `speakerActor` / `listenerActor` | no | Cast: dragon · kingfisher · wizardjoe · prism · speech |
| `holdMs` | no | Default 1600; clamped 120–60000 |
| `index` | desk | Rebuilt as 0..n-1 on every desk mutation |

## Ralphinho units

| Unit | Scope | Evidence |
|------|--------|----------|
| **U0** normalize | `normalize.js` — clip refs + beat list; peer fields stripped | `scripts/prove-dialogue-desk.mjs` |
| **U1** runtime hooks | `runtimeHooks.js` — resolve catalog → WorldSim pose/clip | prove: apply speaker+listener / speaker-only |
| **U2** defaults/prove | `defaults.js` recipes + prove script | `npm run prove:desk` |
| **U3** review | this file | human acceptance checklist below |

## Acceptance checklist

- [x] Every beat carries `speakerClipId`
- [x] `listenerClipId` optional
- [x] Desk `load` / `append` / `move` / `remove` reindex; JSON `authority: "desk"`, `peer: null`
- [x] Runtime applies speaker pose/clip; listener only when present and different actor
- [x] Default recipes normalize with zero rejects
- [ ] Manual: Dragon Studio “Desk” panel plays `recipe.neutral_explanation` with two cast poses
- [ ] Manual: Production bay can load a recipe and step beats without peer UI

## Risks

| Risk | Mitigation |
|------|------------|
| Short ACT codes miss catalog pose | Soft substring match; still applies raw id as pose_override |
| Named clips missing frames | `resolve` → missing; beat warns, speaker fail is terminal for `ok` |
| Dual cast same actor | Listener skipped with warning |

## Rollback

Remove `src/desk/` and desk panel imports from DragonStudio / ProductionStudio; no storage schema outside optional desk export JSON.
