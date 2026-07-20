/**
 * U2 — Default dialogue desk recipes (speakerClipId + optional listenerClipId).
 * Clip ids prefer short ACT/CAN codes (resolved against dragonview catalogs)
 * and named choreography clips where useful.
 */

/** @type {object[]} */
export const DEFAULT_DIALOGUE_RECIPES = Object.freeze([
  {
    id: "recipe.neutral_explanation",
    title: "Neutral explanation",
    notes: "Speaker explains; listener attends. Desk-owned two-beat micro chain.",
    beats: [
      {
        beatId: "nx.speak",
        speakerClipId: "ACT011",
        listenerClipId: "ACT019",
        speakerActor: "dragon",
        listenerActor: "wizardjoe",
        holdMs: 2000,
        title: "Explain one point",
      },
      {
        beatId: "nx.ack",
        speakerClipId: "ACT022",
        listenerClipId: "ACT019",
        speakerActor: "dragon",
        listenerActor: "wizardjoe",
        holdMs: 1200,
        title: "Small acknowledgment",
      },
    ],
  },
  {
    id: "recipe.welcome_pair",
    title: "Welcome + listen",
    notes: "Warm welcome then lean-in listen. No peer handoff.",
    beats: [
      {
        beatId: "wp.welcome",
        speakerClipId: "ACT026",
        listenerClipId: "ACT009",
        speakerActor: "dragon",
        listenerActor: "kingfisher",
        holdMs: 1800,
        title: "Warm welcome",
      },
      {
        beatId: "wp.listen",
        speakerClipId: "ACT020",
        listenerClipId: "ACT019",
        speakerActor: "dragon",
        listenerActor: "kingfisher",
        holdMs: 1600,
        title: "Lean-in listen",
      },
    ],
  },
  {
    id: "recipe.joe_walk_present",
    title: "Joe walk → present",
    notes: "Named dragonview clip + pose hold. Listener optional on beat 2 only.",
    beats: [
      {
        beatId: "jw.walk",
        speakerClipId: "walk_forward",
        speakerActor: "wizardjoe",
        holdMs: 2400,
        title: "Walk forward loop",
      },
      {
        beatId: "jw.present",
        speakerClipId: "ACT014",
        listenerClipId: "ACT019",
        speakerActor: "wizardjoe",
        listenerActor: "dragon",
        holdMs: 1800,
        title: "Present screen left",
      },
    ],
  },
  {
    id: "recipe.solo_strong",
    title: "Solo strong declaration",
    notes: "Speaker only — proves optional listener.",
    beats: [
      {
        beatId: "ss.declare",
        speakerClipId: "ACT028",
        speakerActor: "dragon",
        holdMs: 1600,
        title: "Strong declaration",
      },
    ],
  },
]);

/**
 * @param {string} recipeId
 * @returns {object|null}
 */
export function getDefaultRecipe(recipeId) {
  return DEFAULT_DIALOGUE_RECIPES.find((r) => r.id === recipeId) || null;
}

/**
 * Flatten recipe beats with source tag for desk.load.
 * @param {string} recipeId
 */
export function recipeBeatsForDesk(recipeId) {
  const recipe = getDefaultRecipe(recipeId);
  if (!recipe) return [];
  return recipe.beats.map((b) => ({
    ...b,
    source: recipe.id,
  }));
}
