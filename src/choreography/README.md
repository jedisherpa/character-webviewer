# Character Studio — Choreography harness

Reusable controls for the four-round **bird** choreography loop (Wizard Joe stage is the local stand-in for Robin gait/flight clips).

## Where

- UI: `ChoreographyHarness` on the **Wizard Joe** stage (`/joe/alpha-hd`, `/joe/base250`)
- Script: `script120.js` (`cw-choreo-script.v2-bird`, 120s; **eval window 0–60s**)
- Locomotion: `locomotionController.js` (`cw-locomotion.v2-bird`)
- Telemetry: `telemetry.js` (every-Nth-frame CSV + manifest download)

## Bird program (v2)

| Window | Round | Focus |
|--------|-------|--------|
| 0–18s | R1 | Ground walk / run travel |
| 18–36s | R2 | Facing left/right, sidestep, backward policy |
| 36–60s | R3 | Takeoff hop → fly bank → land |
| 60–120s | R4 | Extended flight + speak acceptance |

## Use later

1. Open Character Studio → Wizard Joe.
2. Click **Choreography harness** (top-left of stage).
3. Pick round + seed → **Run 120s script** (or stop at 60s for R1–R3).
4. Optionally hold **arrow keys** to override ( **F** = fly). Space stops.
5. **Export CSV + manifest** → save under `artifacts/choreography/<round>/` on disk.

## Production safety

When the panel is closed, the harness does not drive the stage. No network calls; exports are browser downloads only.

## Schema

CSV columns match the 41 Bird Live choreography brief (`CSV_FIELDS` in `telemetry.js`).
