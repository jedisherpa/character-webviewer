/**
 * Preview ≠ Program contract. Program mutates only via Take.
 */
import { CONTRACT_SCHEMA_VERSION } from "./schemaVersion.js";

export const PROGRAM_CONTRACT = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  storageKey: "cw.programState.v1",
});

export function createEmptyRuntimeState(defaults = {}) {
  return {
    workingSelection: {
      sourceId: defaults.sourceId || "manual",
      sceneId: defaults.sceneId || "white-stage",
      actorId: defaults.actorId || "wizardjoe",
      storyId: null,
      programMode: defaults.programMode || "standby",
      canonVariantId: null,
    },
    preview: {
      sourceId: defaults.sourceId || "manual",
      sceneId: defaults.sceneId || "white-stage",
      actorId: defaults.actorId || "wizardjoe",
      storyId: null,
      programMode: defaults.programMode || "standby",
      canonVariantId: null,
      updatedAt: null,
    },
    program: {
      sourceId: "manual",
      sceneId: "white-stage",
      actorId: "wizardjoe",
      storyId: null,
      programMode: "standby",
      canonVariantId: null,
      updatedAt: null,
      takeCount: 0,
    },
    sourcesEnabled: defaults.sourcesEnabled || { manual: true },
  };
}

/** Working selection only — never Program. */
export function selectWorking(state, patch) {
  return {
    ...state,
    workingSelection: { ...state.workingSelection, ...patch },
  };
}

/** Load working into Preview without touching Program. */
export function loadPreview(state) {
  return {
    ...state,
    preview: {
      ...state.workingSelection,
      updatedAt: Date.now(),
    },
  };
}

/** Explicit Take: Preview → Program. */
export function takeToProgram(state) {
  return {
    ...state,
    program: {
      ...state.preview,
      updatedAt: Date.now(),
      takeCount: (state.program?.takeCount || 0) + 1,
    },
  };
}

export function assertProgramUntouchedBySourceToggle(before, after) {
  return JSON.stringify(before.program) === JSON.stringify(after.program);
}
