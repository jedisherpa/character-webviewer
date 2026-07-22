/**
 * Actor voice profile references. Secrets never appear here.
 * Wizard Joe production voice matches News Wiz package + RobinSpeech defaults.
 */
import { CONTRACT_SCHEMA_VERSION, PRODUCER_REF } from "./schemaVersion.js";

export const VOICE_CONTRACT = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  producerRef: PRODUCER_REF,
});

/** Wizard Joe only — do not apply to Robin/Kingfisher/Dragon/Prism/Speech. */
export const WIZARD_JOE_NATE_PROFILE = Object.freeze({
  actorId: "wizardjoe",
  displayName: "Nate - Natural, Warm, Podcast Voice",
  voiceId: "Ifu36BnEjjIY932etsqk",
  modelId: "eleven_multilingual_v2",
  voiceSettings: Object.freeze({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 1.0,
    use_speaker_boost: true,
    speed: 0.9,
  }),
  /** Browser never synthesizes; backend must use this profile for Joe. */
  synthesisAuthority: "backend-only",
});

const ACTOR_VOICE = Object.freeze({
  wizardjoe: WIZARD_JOE_NATE_PROFILE,
  // Other actors: explicit non-Nate placeholders (backend-owned; not Nate).
  dragon: Object.freeze({ actorId: "dragon", voiceId: null, modelId: null, inheritsNate: false }),
  kingfisher: Object.freeze({ actorId: "kingfisher", voiceId: null, modelId: null, inheritsNate: false }),
  prism: Object.freeze({ actorId: "prism", voiceId: null, modelId: null, inheritsNate: false }),
  speech: Object.freeze({ actorId: "speech", voiceId: null, modelId: null, inheritsNate: false }),
});

export function voiceProfileForActor(actorId) {
  return ACTOR_VOICE[actorId] || null;
}

export function assertJoeNateOnly(actorId, profile) {
  if (actorId !== "wizardjoe" && profile?.voiceId === WIZARD_JOE_NATE_PROFILE.voiceId) {
    throw new Error("Nate voice must not be applied to non-Joe actors");
  }
  return true;
}

export function joeProductionVoiceSummary() {
  return {
    actorId: "wizardjoe",
    voiceId: WIZARD_JOE_NATE_PROFILE.voiceId,
    modelId: WIZARD_JOE_NATE_PROFILE.modelId,
    speed: WIZARD_JOE_NATE_PROFILE.voiceSettings.speed,
    synthesisAuthority: "backend-only",
  };
}
