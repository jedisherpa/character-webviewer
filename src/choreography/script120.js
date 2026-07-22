/**
 * Versioned choreography control script for Character Studio harness.
 * Bird-first program: dense 0–60s evaluation window covers ground + facing + flight,
 * 60–120s is extended acceptance. Times are seconds from run start.
 *
 * Clip names map to Wizard Joe Alpha HD pack (walk_forward, run, jump, fly_forward, speak)
 * and are the locomotion contract for Robin bird parity.
 */
export const CHOREO_SCRIPT_VERSION = "cw-choreo-script.v2-bird";
export const CHOREO_SCRIPT_DURATION_S = 120;
/** Primary evaluation window used by 60s capture / bird rounds 1–3. */
export const CHOREO_SCRIPT_EVAL_WINDOW_S = 60;

/**
 * @typedef {{
 *   t: number,
 *   action?: string,
 *   forceClip?: string,
 *   stage?: string,
 *   inputX?: number,
 *   inputY?: number,
 *   speed?: number,
 *   note?: string,
 *   policy?: 'normal'|'sidestep'|'backward',
 *   round?: string,
 * }} ChoreoCue
 */

/**
 * Bird choreography program.
 *
 * 0–18s  R1 ground gait + readable travel
 * 18–36s R2 facing parity (left/right/sidestep/backward)
 * 36–60s R3 takeoff + flight bank + land
 * 60–120 R4 extended acceptance / speak
 *
 * @type {ChoreoCue[]}
 */
export const CHOREO_SCRIPT_120 = Object.freeze([
  // ── Round 1: ground locomotion ─────────────────────────────────
  { t: 0, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "idle calibration", round: "r1" },
  {
    t: 2,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 0.85,
    inputY: 0,
    note: "walk right",
    round: "r1",
  },
  { t: 8, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "stop", round: "r1" },
  {
    t: 9,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: -0.85,
    inputY: 0,
    note: "walk left",
    round: "r1",
  },
  { t: 15, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "stop", round: "r1" },
  {
    t: 16,
    action: "run",
    forceClip: "run",
    stage: "ready",
    inputX: 1,
    inputY: 0,
    note: "run right",
    round: "r1",
  },
  { t: 20, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "stop after run", round: "r1" },

  // ── Round 2: facing + control parity ───────────────────────────
  {
    t: 21,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: -1,
    inputY: 0,
    note: "face left walk",
    round: "r2",
  },
  {
    t: 25,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 1,
    inputY: 0,
    note: "face right walk",
    round: "r2",
  },
  {
    t: 29,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 0.75,
    inputY: 0,
    policy: "sidestep",
    note: "sidestep right hold face",
    round: "r2",
  },
  {
    t: 32,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: -0.75,
    inputY: 0,
    policy: "backward",
    note: "backward policy left travel",
    round: "r2",
  },
  {
    t: 35,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 0.707,
    inputY: 0.35,
    note: "diagonal down-right",
    round: "r2",
  },
  { t: 37, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "settle before takeoff", round: "r2" },

  // ── Round 3: flight takeoff / bank / land (inside 60s window) ──
  {
    t: 38,
    action: "jump",
    forceClip: "jump",
    stage: "ready",
    inputX: 0.25,
    inputY: -0.4,
    note: "takeoff hop",
    round: "r3",
  },
  {
    t: 40,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: 0.75,
    inputY: -0.35,
    note: "fly climb right",
    round: "r3",
  },
  {
    t: 46,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: 0.9,
    inputY: 0,
    note: "fly level right",
    round: "r3",
  },
  {
    t: 50,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: -0.85,
    inputY: -0.1,
    note: "fly reverse bank left",
    round: "r3",
  },
  {
    t: 55,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: 0.2,
    inputY: 0.55,
    note: "descend approach",
    round: "r3",
  },
  {
    t: 57,
    action: "land",
    forceClip: "jump",
    stage: "ready",
    inputX: 0.15,
    inputY: 0.4,
    note: "land",
    round: "r3",
  },
  {
    t: 59,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 0.5,
    inputY: 0,
    note: "post-land walk",
    round: "r3",
  },

  // ── Round 4: extended acceptance (60–120) ──────────────────────
  { t: 61, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "midpoint idle", round: "r4" },
  {
    t: 63,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: -0.7,
    inputY: 0,
    note: "r4 walk left",
    round: "r4",
  },
  {
    t: 70,
    action: "run",
    forceClip: "run",
    stage: "ready",
    inputX: 1,
    inputY: 0,
    note: "r4 run",
    round: "r4",
  },
  {
    t: 76,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: 0.6,
    inputY: -0.3,
    note: "r4 second flight",
    round: "r4",
  },
  {
    t: 88,
    action: "fly_forward",
    forceClip: "fly_forward",
    stage: "ready",
    inputX: -0.6,
    inputY: 0.15,
    note: "r4 flight reverse",
    round: "r4",
  },
  {
    t: 98,
    action: "land",
    forceClip: "jump",
    stage: "ready",
    inputX: 0,
    inputY: 0.5,
    note: "r4 land",
    round: "r4",
  },
  {
    t: 102,
    action: "walk_forward",
    forceClip: "walk_forward",
    stage: "ready",
    inputX: 0.45,
    inputY: 0,
    note: "r4 recovery walk",
    round: "r4",
  },
  {
    t: 108,
    action: "speak",
    forceClip: "speak",
    stage: "speaking",
    inputX: 0,
    inputY: 0,
    note: "speak hold",
    round: "r4",
  },
  { t: 114, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "final idle", round: "r4" },
  { t: 120, action: "idle", forceClip: "idle", stage: "idle", inputX: 0, inputY: 0, note: "end", round: "r4" },
]);

/**
 * Active cue at time t (seconds).
 * @param {number} tSec
 * @param {ChoreoCue[]} [script]
 */
export function cueAtTime(tSec, script = CHOREO_SCRIPT_120) {
  const t = Math.max(0, Number(tSec) || 0);
  let active = script[0];
  for (const cue of script) {
    if (cue.t <= t) active = cue;
    else break;
  }
  return active;
}
