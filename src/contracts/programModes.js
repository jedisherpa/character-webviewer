/**
 * Mirrored PBW program modes — keep in lockstep with RobinSpeech programModes.js
 * and joe-newsroom packages/broadcast_workstation.
 */
export const PBW_SCHEMA_VERSION = "pbw.contracts.v1";

export const PROGRAM_MODES = Object.freeze([
  "news_channel",
  "wizard_joe_special",
  "bird_rant",
  "standby",
  "emergency_slate",
]);

export function isProgramMode(value) {
  return PROGRAM_MODES.includes(value);
}

export function defaultReturnMode(fromMode) {
  if (
    fromMode === "wizard_joe_special" ||
    fromMode === "bird_rant" ||
    fromMode === "emergency_slate"
  ) {
    return "news_channel";
  }
  if (fromMode === "news_channel") return "news_channel";
  return "standby";
}
