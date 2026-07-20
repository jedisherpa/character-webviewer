#!/usr/bin/env node
/**
 * U2 — Prove dialogue desk → dragonview clip binding.
 * Pure Node (no test runner): exit 0 on pass, 1 on fail.
 */

import assert from "node:assert/strict";
import {
  DialogueDesk,
  normalizeBeat,
  normalizeBeatList,
  normalizeClipRef,
  resolveClipAgainstCatalog,
  applyDeskBeat,
  recipeBeatsForDesk,
  DEFAULT_DIALOGUE_RECIPES,
} from "../src/desk/index.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("U0 normalize");

test("normalizeClipRef ACT code", () => {
  const r = normalizeClipRef("act11");
  assert.equal(r.kind, "code");
  assert.equal(r.code, "ACT011");
});

test("normalizeClipRef pose id", () => {
  const r = normalizeClipRef("production_011_act011_neutral_speaking_gesture_alpha", {
    knownPoseIds: ["production_011_act011_neutral_speaking_gesture_alpha"],
  });
  assert.equal(r.kind, "pose");
  assert.equal(r.poseId, "production_011_act011_neutral_speaking_gesture_alpha");
});

test("normalizeClipRef named clip", () => {
  const r = normalizeClipRef("walk_forward", { knownClipNames: ["walk_forward"] });
  assert.equal(r.kind, "clip");
  assert.equal(r.clipName, "walk_forward");
});

test("normalizeBeat requires speakerClipId", () => {
  assert.equal(normalizeBeat({ listenerClipId: "ACT019" }), null);
  const b = normalizeBeat({
    speakerClipId: "ACT011",
    listenerClipId: "ACT019",
    speakerActor: "dragon",
    listenerActor: "wizardjoe",
    holdMs: 1500,
  });
  assert.ok(b);
  assert.equal(b.speaker.id, "ACT011");
  assert.equal(b.listener.id, "ACT019");
  assert.equal(b.holdMs, 1500);
});

test("normalizeBeatList desk-owns order and drops peer fields", () => {
  const { beats, rejected } = normalizeBeatList([
    { speakerClipId: "ACT011", peerId: "evil-peer", peerOrder: 99, remoteSeq: 7 },
    { speakerClipId: "ACT019", listenerClipId: "ACT009" },
    { listenerClipId: "ACT001" }, // reject
  ]);
  assert.equal(beats.length, 2);
  assert.equal(beats[0].index, 0);
  assert.equal(beats[1].index, 1);
  assert.equal(rejected.length, 1);
  assert.ok(!("peerId" in beats[0]));
});

console.log("Desk authority");

test("DialogueDesk append/move/remove reindexes", () => {
  const desk = new DialogueDesk();
  desk.append({ speakerClipId: "ACT011", beatId: "a" });
  desk.append({ speakerClipId: "ACT019", beatId: "b" });
  desk.append({ speakerClipId: "ACT026", beatId: "c" });
  assert.equal(desk.length, 3);
  desk.move(2, 0);
  assert.equal(desk.beats[0].beatId, "c");
  assert.equal(desk.beats[0].index, 0);
  assert.equal(desk.beats[2].index, 2);
  desk.remove(1);
  assert.equal(desk.length, 2);
  assert.equal(desk.beats[1].index, 1);
});

test("DialogueDesk load recipe + toJSON has no peer", () => {
  const desk = new DialogueDesk();
  const raw = recipeBeatsForDesk("recipe.neutral_explanation");
  const { rejected } = desk.load(raw);
  assert.equal(rejected.length, 0);
  assert.equal(desk.length, 2);
  const json = desk.toJSON();
  assert.equal(json.authority, "desk");
  assert.equal(json.peer, null);
  assert.equal(json.beats[0].speakerClipId, "ACT011");
  assert.equal(json.beats[0].listenerClipId, "ACT019");
});

console.log("U1 runtime hooks");

function fakeSim() {
  const actors = {
    dragon: { id: "dragon", pose_override: null, clip: null, locomotion: "idle", pose_hint: "idle" },
    wizardjoe: { id: "wizardjoe", pose_override: null, clip: null, locomotion: "idle", pose_hint: "idle" },
  };
  return {
    active: "dragon",
    actors,
    stop_clip(id) {
      if (id && actors[id]) actors[id].clip = null;
    },
    play_clip(name, frames, opts = {}) {
      const aid = opts.actor_id || this.active;
      actors[aid].clip = { name, frames, index: 0 };
      actors[aid].pose_override = frames[0];
      actors[aid].locomotion = "clip";
    },
  };
}

test("resolveClipAgainstCatalog code → pose", () => {
  const catalog = {
    poses: [
      { pose_id: "production_011_act011_neutral_speaking_gesture_alpha" },
      { pose_id: "production_019_act019_neutral_listening_alpha" },
    ],
    clips: [{ name: "walk_forward", frames: ["p1", "p2"], character: "wizardjoe" }],
  };
  const r = resolveClipAgainstCatalog(normalizeClipRef("ACT011"), catalog);
  assert.equal(r.mode, "pose");
  assert.match(r.poseId, /act011/);
  const c = resolveClipAgainstCatalog(normalizeClipRef("walk_forward", { knownClipNames: ["walk_forward"] }), catalog);
  assert.equal(c.mode, "clip");
});

test("applyDeskBeat sets speaker + optional listener", () => {
  const sim = fakeSim();
  const catalog = {
    poses: [
      { pose_id: "production_011_act011_neutral_speaking_gesture_alpha" },
      { pose_id: "production_019_act019_neutral_listening_alpha" },
    ],
    clips: [],
  };
  const beat = normalizeBeat({
    beatId: "t1",
    speakerClipId: "ACT011",
    listenerClipId: "ACT019",
    speakerActor: "dragon",
    listenerActor: "wizardjoe",
  });
  const result = applyDeskBeat(sim, beat, catalog);
  assert.equal(result.ok, true);
  assert.equal(result.speaker.ok, true);
  assert.equal(result.listener.ok, true);
  assert.match(sim.actors.dragon.pose_override, /act011/);
  assert.match(sim.actors.wizardjoe.pose_override, /act019/);
  assert.equal(sim.active, "dragon");
});

test("applyDeskBeat speaker-only works", () => {
  const sim = fakeSim();
  const beat = normalizeBeat({ speakerClipId: "ACT028", speakerActor: "dragon" });
  // empty catalog still applies pose id as override
  const result = applyDeskBeat(sim, beat, { poses: [], clips: [] });
  assert.equal(result.ok, true);
  assert.equal(sim.actors.dragon.pose_override, "ACT028");
  assert.equal(result.listener, null);
});

console.log("U2 defaults");

test("default recipes all normalize cleanly", () => {
  for (const recipe of DEFAULT_DIALOGUE_RECIPES) {
    const { beats, rejected } = normalizeBeatList(recipe.beats);
    assert.equal(rejected.length, 0, recipe.id);
    assert.ok(beats.length >= 1, recipe.id);
    assert.ok(beats.every((b) => b.speaker), recipe.id);
  }
});

if (process.exitCode) {
  console.error("\nProve FAILED");
  process.exit(1);
}
console.log(`\nProve OK — ${passed} checks`);
