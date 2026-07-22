/**
 * Unified locomotion contract for Character Studio harness (Wizard Joe + Robin bird parity).
 * Keyboard / gamepad / scripted replay all feed the same integrator.
 *
 * Stage space: x 0..1 left→right, y 0..1 top→bottom (higher y = lower on screen / ground).
 * Bird ground band ≈ 0.78–0.86; flight band ≈ 0.32–0.55.
 */

export const LOCOMOTION_VERSION = "cw-locomotion.v2-bird";

/**
 * Target world-units / second for each gait (normalized stage 0–1).
 * Tuned so a 60s bird run produces readable travel + facing flips on a 16:9 stage.
 */
export const ACTION_SPEEDS = Object.freeze({
  idle: 0,
  walk: 0.14,
  walk_forward: 0.14,
  run: 0.24,
  sprint: 0.3,
  sidestep: 0.1,
  fly: 0.18,
  fly_forward: 0.2,
  /** Fly while talking / ranting — same band as cruise, slightly calmer. */
  fly_speak: 0.16,
  jump: 0.1,
  hop: 0.12,
  /** Grounded speak hold only (no travel). Prefer fly_speak for rant-in-air. */
  speak: 0,
  land: 0.06,
});

/** Vertical limits by movement mode (stage y, top=0). */
export const Y_BAND = Object.freeze({
  ground: { min: 0.72, max: 0.9 },
  hop: { min: 0.55, max: 0.9 },
  fly: { min: 0.28, max: 0.62 },
});

const DEADBAND = 0.08;
const ACCEL = 4.5; // snappier for readable bird direction changes
const DECEL = 5.5;

/**
 * @param {number} x
 * @param {number} y
 */
export function normalizeInput(x, y) {
  let ix = Number(x) || 0;
  let iy = Number(y) || 0;
  const mag = Math.hypot(ix, iy);
  if (mag > 1) {
    ix /= mag;
    iy /= mag;
  }
  if (mag < DEADBAND) return { x: 0, y: 0, magnitude: 0 };
  return { x: ix, y: iy, magnitude: Math.min(1, mag) };
}

/**
 * @param {string} action
 */
export function baseSpeedFor(action) {
  return ACTION_SPEEDS[action] ?? ACTION_SPEEDS.walk;
}

/**
 * @param {string} action
 * @param {number} inputMagnitude 0..1
 */
export function targetSpeedFor(action, inputMagnitude = 1) {
  const base = baseSpeedFor(action);
  return base * Math.min(1, Math.max(0, Number(inputMagnitude) || 0));
}

function yBandFor(action) {
  const a = String(action || "idle");
  if (a === "fly" || a === "fly_forward" || a === "fly_speak") return Y_BAND.fly;
  if (a === "jump" || a === "hop") return Y_BAND.hop;
  return Y_BAND.ground;
}

/** True when the body should use flight clips while talking. */
export function isFlySpeakAction(action) {
  const a = String(action || "");
  return a === "fly_speak" || a === "fly" || a === "fly_forward";
}

/**
 * Create controller state (bird-friendly ground start).
 */
export function createLocomotionState(seed = 1) {
  return {
    version: LOCOMOTION_VERSION,
    seed: Number(seed) || 1,
    x: 0.5,
    y: 0.82,
    vx: 0,
    vy: 0,
    flipX: false,
    facing: "right",
    action: "idle",
    policy: "normal",
    inputX: 0,
    inputY: 0,
    inputMagnitude: 0,
    keys: Object.create(null),
  };
}

/**
 * Apply held keys → input vector (Arrow keys / WASD).
 * @param {Record<string, boolean>} keys
 */
export function inputFromKeys(keys) {
  let x = 0;
  let y = 0;
  if (keys.ArrowLeft || keys.a || keys.A) x -= 1;
  if (keys.ArrowRight || keys.d || keys.D) x += 1;
  if (keys.ArrowUp || keys.w || keys.W) y -= 1;
  if (keys.ArrowDown || keys.s || keys.S) y += 1;
  return normalizeInput(x, y);
}

/**
 * Step the integrator.
 * Velocity uses unit direction × base speed × magnitude (single magnitude application).
 *
 * @param {ReturnType<typeof createLocomotionState>} state
 * @param {{ dtSec: number, inputX?: number, inputY?: number, action?: string, policy?: string }} cmd
 */
export function stepLocomotion(state, cmd = {}) {
  const dt = Math.min(0.05, Math.max(0, Number(cmd.dtSec) || 0));
  const action = String(cmd.action || state.action || "idle");
  const policy = String(cmd.policy || state.policy || "normal");
  const input = normalizeInput(cmd.inputX ?? 0, cmd.inputY ?? 0);
  const base = baseSpeedFor(action);

  // Desired velocity in stage space (y+ down for world draw convention).
  // tx = dirX * base * magnitude = input.x * base  (input already includes magnitude)
  let tx = 0;
  let ty = 0;
  if (input.magnitude > 0 && base > 0) {
    tx = input.x * base;
    ty = input.y * base;
  }

  // Flight (incl. fly while speaking): slight automatic lift when moving.
  if (
    (action === "fly" || action === "fly_forward" || action === "fly_speak")
    && input.magnitude > 0
    && Math.abs(input.y) < 0.15
  ) {
    ty -= base * 0.12;
  }

  // Takeoff hop: brief upward bias
  if ((action === "jump" || action === "hop") && input.magnitude >= 0) {
    ty -= base * 0.55;
  }

  // Landing / grounded speak: bias toward ground band center (not fly_speak).
  if (action === "land" || action === "idle" || action === "speak") {
    const groundY = 0.82;
    if (state.y < groundY - 0.02) {
      ty += Math.min(0.2, (groundY - state.y) * 2.5);
    }
  }

  const rate = (tx === 0 && ty === 0) || base === 0 ? DECEL : ACCEL;
  state.vx += (tx - state.vx) * Math.min(1, rate * dt);
  state.vy += (ty - state.vy) * Math.min(1, rate * dt);

  // Snap near zero
  if (Math.hypot(state.vx, state.vy) < 0.0015) {
    state.vx = 0;
    state.vy = 0;
  }

  const band = yBandFor(action);
  state.x = Math.min(0.92, Math.max(0.08, state.x + state.vx * dt));
  state.y = Math.min(band.max, Math.max(band.min, state.y + state.vy * dt));

  // Facing policy
  if (policy === "sidestep") {
    // Keep facing; do not flip for lateral move
  } else if (policy === "backward") {
    if (Math.abs(state.vx) > 0.004) {
      state.flipX = state.vx > 0; // face against travel
      state.facing = state.flipX ? "left" : "right";
    }
  } else if (Math.abs(state.vx) > 0.004) {
    // Normal: face direction of travel (positive x = right, no flip)
    state.flipX = state.vx < 0;
    state.facing = state.flipX ? "left" : "right";
  }

  state.action = action;
  state.policy = policy;
  state.inputX = input.x;
  state.inputY = input.y;
  state.inputMagnitude = input.magnitude;
  return state;
}

/**
 * Pick action from input magnitude + modifiers.
 */
export function actionFromInput(input, { shift = false, run = false, fly = false } = {}) {
  const mag = input?.magnitude || 0;
  if (mag < DEADBAND) return "idle";
  if (fly || input.y < -0.55) return "fly_forward";
  if (shift || run || mag > 0.92) return "sprint";
  if (mag > 0.7) return "run";
  return "walk_forward";
}
