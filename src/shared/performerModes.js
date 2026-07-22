/**
 * Shared performer mode contract — mirrors RobinSpeech embodiment modes
 * so Character Studio and 41BirdLive use the same cast vocabulary.
 */

export const PERFORMER_MODES = Object.freeze([
  "robin",
  "wizard",
  "dragon",
  "kingfisher",
  "prism",
  "speech",
  "wizardjoe",
]);

export const PERFORMER_LABELS = Object.freeze({
  robin: "Robin",
  wizard: "Wizard Joe",
  dragon: "Dragon",
  kingfisher: "Kingfisher",
  prism: "Prism",
  speech: "Speech",
  wizardjoe: "Joe Pack",
});

export const DEFAULT_PERFORMER = "wizard";

export const PERFORMER_STORAGE_KEY = "characterStudio.performer.v1";

export function normalizePerformer(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return DEFAULT_PERFORMER;
  if (raw === "bird") return "robin";
  if (raw === "joe" || raw === "wizard-joe" || raw === "wizard_joe") return "wizard";
  return PERFORMER_MODES.includes(raw) ? raw : DEFAULT_PERFORMER;
}

export function readStoredPerformer() {
  try {
    return normalizePerformer(localStorage.getItem(PERFORMER_STORAGE_KEY));
  } catch {
    return DEFAULT_PERFORMER;
  }
}

export function writeStoredPerformer(mode) {
  const next = normalizePerformer(mode);
  try {
    localStorage.setItem(PERFORMER_STORAGE_KEY, next);
  } catch {
    /* hardened webviews */
  }
  return next;
}

export function routeForPerformerHub(mode) {
  switch (normalizePerformer(mode)) {
    case "robin":
      return "/41birdlive";
    case "wizard":
      return "/joe/alpha-hd";
    case "dragon":
      return "/dragon";
    case "kingfisher":
    case "prism":
    case "speech":
    case "wizardjoe":
      return `/studio?cast=${normalizePerformer(mode)}`;
    default:
      return "/";
  }
}

/** Wizard Alpha HD pack vs multi-cast catalog path. */
export function libraryTargetForPerformer(mode) {
  switch (normalizePerformer(mode)) {
    case "wizard":
      return { kind: "wizard-library", url: "/wizard-joe-alpha-hd/library.json" };
    case "robin":
      // Robin bird lives inside 41BirdLive; studio deep-links to it.
      return { kind: "bird-live", url: null };
    case "dragon":
    case "kingfisher":
    case "prism":
    case "speech":
    case "wizardjoe":
      return {
        kind: "catalog",
        character: normalizePerformer(mode),
        url: `/library/${normalizePerformer(mode)}/catalog.json`,
      };
    default:
      return { kind: "wizard-library", url: "/wizard-joe-alpha-hd/library.json" };
  }
}
