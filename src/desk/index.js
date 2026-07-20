/**
 * Dialogue desk → dragonview pose clips (Ralphinho U0–U3 surface).
 *
 * U0 normalize · U1 runtime hooks · U2 defaults/prove · U3 review
 * Desk owns order; no peer.
 */

export {
  cleanActor,
  cleanHoldMs,
  cleanId,
  normalizeBeat,
  normalizeBeatList,
  normalizeClipRef,
} from "./normalize.js";

export { DialogueDesk, setBeatHold } from "./dialogueDesk.js";

export {
  applyDeskBeat,
  applyResolvedToActor,
  playDeskSequence,
  resolveClipAgainstCatalog,
} from "./runtimeHooks.js";

export {
  DEFAULT_DIALOGUE_RECIPES,
  getDefaultRecipe,
  recipeBeatsForDesk,
} from "./defaults.js";
