/**
 * Documented control surfaces for the Production Studio.
 * Shown in the Docs drawer — keep in sync with keyboard + gamepad handlers.
 */

export const CONTROL_SURFACES = [
  {
    id: "stage",
    title: "Stage (always visible)",
    body: "Full-bleed actor stage. Drag empty stage to pan the active actor (when world nudges are enabled). Scroll wheel zooms. Floor sits low for a production plate look.",
  },
  {
    id: "transport",
    title: "Transport bar",
    body: "Play / Pause / Stop sequence · Record arm · Save · New. Recording captures pose picks, clip plays, and bound gamepad actions into the timeline.",
  },
  {
    id: "timeline",
    title: "Timeline drawer (T)",
    body: "Ordered steps with hold duration. Reorder, delete, edit hold. Double-click a step to jump playhead. Sequences persist in localStorage and can export/import JSON.",
  },
  {
    id: "library",
    title: "Library drawer (L)",
    body: "Pose grid filtered by cast member. Click a pose to hold it on the active actor and (if recording) append a pose step.",
  },
  {
    id: "sequences",
    title: "Sequences drawer (S)",
    body: "Saved choreographies. Load to edit, Play to replay, Delete to remove. Export JSON for handoff.",
  },
  {
    id: "bindings",
    title: "Gamepad map drawer (G)",
    body: "Every face / d-pad / shoulder / stick-click is bound to an action. Change bindings, then Save. Bindings survive reloads. Program mode: while recording, presses also enqueue steps.",
  },
  {
    id: "cast",
    title: "Cast drawer (C)",
    body: "Select active actor (Dragon, Kingfisher, Wizard Joe, Prism, Speech). Tab / LB / RB cycle cast.",
  },
  {
    id: "docs",
    title: "Docs drawer (?)",
    body: "This reference. Toggle any surface from the top-right rail or hotkeys.",
  },
];

export const KEYBOARD_CHEATSHEET = [
  ["Space", "Hop (active)"],
  ["F", "Flight toggle"],
  ["Tab", "Next actor"],
  ["WASD / arrows", "Move"],
  ["Shift", "Sprint"],
  ["Ctrl", "Precision"],
  ["J / K", "Walk / fly loop (Joe)"],
  ["U", "Stop clip"],
  ["Esc", "Reset stage + stop"],
  ["T L S G C ?", "Toggle drawers"],
  ["R", "Arm / disarm record"],
  ["P", "Play / pause sequence"],
  ["M", "Screen / world axes"],
];

export const GAMEPAD_DEFAULTS_DOC = [
  ["D-pad", "Nudge active actor on stage"],
  ["A", "Clear / idle"],
  ["B", "Stop clip"],
  ["X", "Walk loop (Joe)"],
  ["Y", "Fly loop (Joe)"],
  ["LB / RB", "Prev / next actor"],
  ["LT / RT", "Zoom out / in"],
  ["L3", "Reset stage"],
  ["R3", "Flip X"],
  ["Start", "Play / pause sequence"],
  ["Select", "Record toggle"],
];
