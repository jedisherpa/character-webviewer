/**
 * World-space controls for Wizard Joe — same control surface as Robin/Prism stage:
 * pan (x/y), zoom, tilt/spin, speed, flip. Persisted per pack.
 */

export const WJ_WORLD_STORAGE_PREFIX = "wj.worldSpace.v2.";

export const DEFAULT_WORLD = {
  // Normalized stage placement (0–1); lower y = higher on stage
  x: 0.5,
  y: 0.72,
  // Silhouette scale relative to stage height
  zoom: 1,
  // Degrees
  spinZ: 0,
  tilt: 0,
  // Horizontal flip
  flipX: false,
  // Playback / micro-motion
  speed: 1,
  bob: 0.35,
  sway: 0.2,
};

export const WORLD_CONTROL_DEFS = [
  { id: "x", label: "Pan X", min: 0.05, max: 0.95, step: 0.005 },
  { id: "y", label: "Pan Y", min: 0.15, max: 0.98, step: 0.005 },
  { id: "zoom", label: "Zoom", min: 0.35, max: 2.8, step: 0.01 },
  { id: "spinZ", label: "Spin Z", min: -45, max: 45, step: 0.5 },
  { id: "tilt", label: "Tilt", min: -18, max: 18, step: 0.5 },
  { id: "speed", label: "Speed", min: 0.25, max: 3, step: 0.05 },
  { id: "bob", label: "Bob", min: 0, max: 1.2, step: 0.01 },
  { id: "sway", label: "Sway", min: 0, max: 1.2, step: 0.01 },
];

export const WORLD_PRESETS = [
  {
    id: "stage_center",
    label: "Stage center",
    world: { x: 0.5, y: 0.72, zoom: 1, spinZ: 0, tilt: 0, flipX: false },
  },
  {
    id: "close_up",
    label: "Close-up",
    world: { x: 0.5, y: 0.62, zoom: 1.65, spinZ: 0, tilt: 0, flipX: false },
  },
  {
    id: "wide",
    label: "Wide",
    world: { x: 0.5, y: 0.78, zoom: 0.62, spinZ: 0, tilt: 0, flipX: false },
  },
  {
    id: "left_third",
    label: "Left third",
    world: { x: 0.32, y: 0.72, zoom: 1, spinZ: -4, tilt: 0, flipX: false },
  },
  {
    id: "right_third",
    label: "Right third",
    world: { x: 0.68, y: 0.72, zoom: 1, spinZ: 4, tilt: 0, flipX: false },
  },
  {
    id: "hero",
    label: "Hero low",
    world: { x: 0.5, y: 0.8, zoom: 1.35, spinZ: 0, tilt: -3, flipX: false },
  },
];

export function clampWorld(world) {
  const next = { ...DEFAULT_WORLD, ...world };
  for (const def of WORLD_CONTROL_DEFS) {
    const v = Number(next[def.id]);
    next[def.id] = Number.isFinite(v)
      ? Math.min(def.max, Math.max(def.min, v))
      : DEFAULT_WORLD[def.id];
  }
  next.flipX = Boolean(next.flipX);
  return next;
}

export function readWorld(packKey = "default") {
  if (typeof window === "undefined") return { ...DEFAULT_WORLD };
  try {
    const raw = window.localStorage.getItem(WJ_WORLD_STORAGE_PREFIX + packKey);
    if (!raw) return { ...DEFAULT_WORLD };
    return clampWorld(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORLD };
  }
}

export function writeWorld(world, packKey = "default") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      WJ_WORLD_STORAGE_PREFIX + packKey,
      JSON.stringify(clampWorld(world)),
    );
  } catch {
    /* ignore */
  }
}

export function clearWorld(packKey = "default") {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(WJ_WORLD_STORAGE_PREFIX + packKey);
  } catch {
    /* ignore */
  }
}

/**
 * Apply world transform when drawing character into a canvas.
 * Returns draw rect { dx, dy, dw, dh } and CSS-like transform extras.
 */
export function worldDrawRect(canvasW, canvasH, imgW, imgH, world, timeSec = 0) {
  const w = clampWorld(world);
  const baseScale = Math.min(canvasW / imgW, canvasH / imgH);
  const scale = Math.max(0.05, baseScale * w.zoom);

  const bobPx =
    Math.sin(timeSec * Math.PI * 2 * 0.55 * w.speed) * (canvasH * 0.012) * w.bob;
  const swayDeg =
    Math.sin(timeSec * Math.PI * 2 * 0.35 * w.speed) * 2.2 * w.sway;

  const dw = imgW * scale;
  const dh = imgH * scale;
  // Anchor near bottom so y≈0.82 feels grounded
  const cx = w.x * canvasW;
  const cy = w.y * canvasH + bobPx;
  const dx = cx - dw / 2;
  const dy = cy - dh;

  return {
    dx,
    dy,
    dw,
    dh,
    rotationDeg: w.spinZ + swayDeg,
    tiltDeg: w.tilt,
    flipX: w.flipX,
    scale,
  };
}
