/**
 * Local sequence library — save/load choreographed motion timelines.
 * Storage key is versioned so we can migrate formats later.
 */

const STORAGE_KEY = "cws.sequences.v1";
const BINDINGS_KEY = "cws.gamepadBindings.v1";

/** @typedef {{ id: string, type: 'pose'|'clip'|'action'|'wait', actor?: string, poseId?: string, clipName?: string, action?: string, holdMs: number, label?: string }} SeqStep */
/** @typedef {{ id: string, name: string, createdAt: string, updatedAt: string, steps: SeqStep[], notes?: string }} Sequence */

export function uid(prefix = "seq") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function loadSequences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSequences(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

export function upsertSequence(seq) {
  const list = loadSequences();
  const now = new Date().toISOString();
  const next = {
    ...seq,
    id: seq.id || uid(),
    createdAt: seq.createdAt || now,
    updatedAt: now,
    steps: Array.isArray(seq.steps) ? seq.steps : [],
  };
  const i = list.findIndex((s) => s.id === next.id);
  if (i >= 0) list[i] = next;
  else list.unshift(next);
  saveSequences(list);
  return next;
}

export function deleteSequence(id) {
  const list = loadSequences().filter((s) => s.id !== id);
  saveSequences(list);
  return list;
}

export function exportSequenceJson(seq) {
  return JSON.stringify(seq, null, 2);
}

export function importSequenceJson(text) {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.steps)) throw new Error("Invalid sequence JSON");
  return upsertSequence({
    ...data,
    id: uid(),
    name: data.name || "Imported sequence",
    createdAt: undefined,
  });
}

/** Default programmable gamepad map — every control has a real action. */
export const DEFAULT_GAMEPAD_BINDINGS = {
  up: { type: "nudge", dx: 0, dy: -1, label: "Pan up" },
  down: { type: "nudge", dx: 0, dy: 1, label: "Pan down" },
  left: { type: "nudge", dx: -1, dy: 0, label: "Pan left" },
  right: { type: "nudge", dx: 1, dy: 0, label: "Pan right" },
  a: { type: "action", action: "clear", label: "Clear / idle" },
  b: { type: "action", action: "stop_clip", label: "Stop clip" },
  x: { type: "clip", clipName: "walk_forward", actor: "wizardjoe", label: "Walk loop" },
  y: { type: "clip", clipName: "fly_forward", actor: "wizardjoe", label: "Fly loop" },
  lb: { type: "action", action: "prev_actor", label: "Prev actor" },
  rb: { type: "action", action: "next_actor", label: "Next actor" },
  lt: { type: "nudge", dx: 0, dy: 0, dZoom: -1, label: "Zoom out" },
  rt: { type: "nudge", dx: 0, dy: 0, dZoom: 1, label: "Zoom in" },
  ls: { type: "action", action: "reset", label: "Reset stage" },
  rs: { type: "action", action: "flip", label: "Flip X" },
  start: { type: "action", action: "play_pause", label: "Play / pause seq" },
  select: { type: "action", action: "record_toggle", label: "Record toggle" },
  // Keyboard / pulse extras used by dragon pad
  space: { type: "action", action: "hop", label: "Hop" },
  f: { type: "action", action: "flight", label: "Flight toggle" },
  tab: { type: "action", action: "next_actor", label: "Next actor" },
  j: { type: "clip", clipName: "walk_forward", actor: "wizardjoe", label: "Walk loop" },
  k: { type: "clip", clipName: "fly_forward", actor: "wizardjoe", label: "Fly loop" },
  u: { type: "action", action: "stop_clip", label: "Stop clip" },
  escape: { type: "action", action: "reset", label: "Reset" },
};

export const BINDABLE_BUTTONS = [
  "up",
  "down",
  "left",
  "right",
  "a",
  "b",
  "x",
  "y",
  "lb",
  "rb",
  "lt",
  "rt",
  "ls",
  "rs",
  "start",
  "select",
];

export function loadBindings() {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return { ...DEFAULT_GAMEPAD_BINDINGS };
    return { ...DEFAULT_GAMEPAD_BINDINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GAMEPAD_BINDINGS };
  }
}

export function saveBindings(map) {
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(map));
  return map;
}

export function resetBindings() {
  localStorage.removeItem(BINDINGS_KEY);
  return { ...DEFAULT_GAMEPAD_BINDINGS };
}

export function stepLabel(step) {
  if (!step) return "—";
  if (step.label) return step.label;
  if (step.type === "pose") return `pose ${step.poseId || ""}`.trim();
  if (step.type === "clip") return `clip ${step.clipName || ""}`.trim();
  if (step.type === "action") return `action ${step.action || ""}`.trim();
  if (step.type === "wait") return `wait ${step.holdMs || 0}ms`;
  return step.type || "step";
}

export function sequenceDurationMs(seq) {
  if (!seq?.steps?.length) return 0;
  return seq.steps.reduce((sum, s) => sum + Math.max(0, Number(s.holdMs) || 0), 0);
}
