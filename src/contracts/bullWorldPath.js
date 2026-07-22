/**
 * Deterministic bird path around Original Wall Street Bull.
 * Bull at middle depth; bird may go rear of bull then land in front (viewer-near).
 */
import { ORIGINAL_WALL_STREET_BULL } from "./scenes.js";

const W = ORIGINAL_WALL_STREET_BULL.world;

/**
 * @param {number} t 0..1 path parameter
 * @returns {{ x:number, y:number, z:number, behindBull:boolean, onGround:boolean }}
 */
export function bullOrbitPath(t) {
  const u = Math.max(0, Math.min(1, t));
  // Phase 1 (0–0.55): fly around rear of bull (z > occluderDepth)
  // Phase 2 (0.55–0.85): arc past side toward camera
  // Phase 3 (0.85–1): land in front of bull (z < occluderDepth)
  if (u < 0.55) {
    const p = u / 0.55;
    // Wide radius around bull mass — stay outside X clearance while z is rear.
    const angle = Math.PI * 0.05 + p * Math.PI * 0.9;
    const radius = 6.4;
    const x = Math.cos(angle) * radius;
    const z = W.rearFlightZ - p * 0.8;
    const y = 1.8 + Math.sin(p * Math.PI) * 2.8;
    return {
      x,
      y,
      z,
      behindBull: z > W.occluderDepth && Math.abs(x) < W.occluderXMax + 1.5,
      onGround: false,
    };
  }
  if (u < 0.85) {
    const p = (u - 0.55) / 0.3;
    // Pass on the +X side then toward camera, stay elevated while near occluder depth.
    const x = 6.0 - p * 5.2;
    const z = W.rearFlightZ - 0.8 - p * (W.rearFlightZ - 0.8 - W.frontLandingZ);
    const y = 2.6 - p * 1.6;
    return {
      x,
      y: Math.max(1.2, y),
      z,
      behindBull: z > W.occluderDepth && Math.abs(x) < W.occluderXMax,
      onGround: false,
    };
  }
  const p = (u - 0.85) / 0.15;
  // Land viewer-side of bull (z < occluderDepth), slightly off-center.
  const x = 1.2 - p * 0.4;
  const z = W.frontLandingZ + (1 - p) * 0.6;
  const y = Math.max(0, 1.0 * (1 - p));
  return {
    x,
    y,
    z,
    behindBull: false,
    onGround: p > 0.85,
  };
}

/**
 * Clearance: bird must not intersect the bull clearance volume
 * (tight slab around occluder depth × torso X band, low altitude only).
 * @returns {boolean} true if legal
 */
export function pathClearsBull(pos) {
  const dx = Math.abs(pos.x);
  const dz = Math.abs(pos.z - W.occluderDepth);
  // Clearance volume: |x| < 2.6 and |z - occluder| < 0.55 and y < 1.1
  if (dx < 2.6 && dz < 0.55 && pos.y < 1.1) return false;
  return true;
}

export function samplePath(steps = 48) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const pos = bullOrbitPath(i / steps);
    out.push({ t: i / steps, ...pos, clear: pathClearsBull(pos) });
  }
  return out;
}

export function pathValidation() {
  const samples = samplePath(64);
  const allClear = samples.every((s) => s.clear);
  const hasBehind = samples.some((s) => s.behindBull);
  const end = samples[samples.length - 1];
  const landsInFront = end.z < W.occluderDepth && !end.behindBull;
  return {
    allClear,
    hasBehind,
    landsInFront,
    endZ: end.z,
    occluderDepth: W.occluderDepth,
    ok: allClear && hasBehind && landsInFront,
  };
}
