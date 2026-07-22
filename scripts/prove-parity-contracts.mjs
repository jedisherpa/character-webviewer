#!/usr/bin/env node
/**
 * Contract parity proofs for character-webviewer ↔ RobinSpeech birdLive.
 * Exit 0 only when all assertions pass.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROGRAM_MODES,
  isProgramMode,
  defaultReturnMode,
} from "../src/contracts/programModes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function load(rel) {
  return import(pathToFileURL(path.join(root, rel)).href);
}

const { BROADCAST_SOURCES, defaultSourceEnabledMap, toggleSourceEnabled } =
  await load("src/contracts/broadcastSources.js");
const {
  CORE_SCENES,
  ORIGINAL_WALL_STREET_BULL,
  isOriginalBullScene,
  isVoxelWallStreet,
  VOXEL_BACKGROUNDS,
} = await load("src/contracts/scenes.js");
const { WIZARD_JOE_NATE_PROFILE, assertJoeNateOnly, joeProductionVoiceSummary } =
  await load("src/contracts/voiceProfiles.js");
const {
  createEmptyRuntimeState,
  loadPreview,
  selectWorking,
  takeToProgram,
  assertProgramUntouchedBySourceToggle,
} = await load("src/contracts/programState.js");
const { pathValidation, samplePath } = await load("src/contracts/bullWorldPath.js");
const { RANT_SOURCES } = await load("src/shared/rantPipeline.js");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`not ok - ${name}`);
    console.error(e);
    process.exitCode = 1;
  }
}

test("broadcast sources include manual + joe AI/general", () => {
  const ids = BROADCAST_SOURCES.map((s) => s.id);
  assert.ok(ids.includes("manual"));
  assert.ok(ids.includes("joe-news-ai"));
  assert.ok(ids.includes("joe-news-general"));
  assert.equal(BROADCAST_SOURCES.find((s) => s.id === "joe-news-ai").role, "ready-script");
  assert.equal(BROADCAST_SOURCES.find((s) => s.id === "bitcoin-fed").role, "research-input");
  assert.notEqual(
    BROADCAST_SOURCES.find((s) => s.id === "joe-news-ai").backendQueuePath,
    BROADCAST_SOURCES.find((s) => s.id === "joe-news-general").backendQueuePath,
  );
});

test("rantPipeline reuses contract catalog IDs", () => {
  const contractJoe = BROADCAST_SOURCES.filter((s) => s.family === "joe-news").map((s) => s.id).sort();
  const rantJoe = RANT_SOURCES.filter((s) => s.family === "joe-news").map((s) => s.id).sort();
  assert.deepEqual(rantJoe, contractJoe);
});

test("source toggle does not mutate Program", () => {
  let state = createEmptyRuntimeState({ sceneId: "white-stage" });
  state = takeToProgram(loadPreview(selectWorking(state, { sceneId: "white-stage" })));
  const before = structuredClone(state);
  const sourcesEnabled = toggleSourceEnabled(state.sourcesEnabled, "joe-news-ai", true);
  state = { ...state, sourcesEnabled };
  assert.equal(assertProgramUntouchedBySourceToggle(before, state), true);
  assert.equal(state.sourcesEnabled["joe-news-ai"], true);
  assert.equal(state.program.sceneId, "white-stage");
});

test("Preview load and Take are distinct", () => {
  let state = createEmptyRuntimeState({ sceneId: "white-stage" });
  state = selectWorking(state, { sceneId: ORIGINAL_WALL_STREET_BULL.id });
  assert.notEqual(state.workingSelection.sceneId, state.program.sceneId);
  state = loadPreview(state);
  assert.equal(state.preview.sceneId, ORIGINAL_WALL_STREET_BULL.id);
  assert.notEqual(state.program.sceneId, ORIGINAL_WALL_STREET_BULL.id);
  state = takeToProgram(state);
  assert.equal(state.program.sceneId, ORIGINAL_WALL_STREET_BULL.id);
  assert.ok(state.program.takeCount >= 1);
});

test("scenes: 10 voxels + original bull + bowl distinct", () => {
  assert.equal(VOXEL_BACKGROUNDS.length, 10);
  assert.ok(isOriginalBullScene(ORIGINAL_WALL_STREET_BULL.id));
  assert.ok(isVoxelWallStreet("bird.location.wall-street"));
  assert.notEqual(ORIGINAL_WALL_STREET_BULL.id, "bird.location.wall-street");
  assert.ok(CORE_SCENES.some((s) => s.id === "original-bowl"));
  assert.ok(CORE_SCENES.some((s) => s.id === "bird-bowl"));
  assert.ok(CORE_SCENES.some((s) => s.id === ORIGINAL_WALL_STREET_BULL.id));
});

test("Wizard Joe Nate profile exact", () => {
  assert.equal(WIZARD_JOE_NATE_PROFILE.voiceId, "Ifu36BnEjjIY932etsqk");
  assert.equal(WIZARD_JOE_NATE_PROFILE.modelId, "eleven_multilingual_v2");
  assert.equal(WIZARD_JOE_NATE_PROFILE.voiceSettings.speed, 0.9);
  assert.equal(WIZARD_JOE_NATE_PROFILE.voiceSettings.stability, 0.5);
  assert.equal(WIZARD_JOE_NATE_PROFILE.synthesisAuthority, "backend-only");
  assert.throws(() =>
    assertJoeNateOnly("dragon", { voiceId: WIZARD_JOE_NATE_PROFILE.voiceId }),
  );
  assert.equal(joeProductionVoiceSummary().speed, 0.9);
});

test("bull path clears mass and lands in front", () => {
  const v = pathValidation();
  assert.equal(v.ok, true, JSON.stringify(v));
  assert.equal(v.hasBehind, true);
  assert.equal(v.landsInFront, true);
  assert.ok(v.endZ < v.occluderDepth);
  const samples = samplePath(32);
  assert.ok(samples.every((s) => s.clear));
});

if (process.exitCode) {
  console.error("parity contract proofs FAILED");
  process.exit(1);
}

assert.equal(PROGRAM_MODES.length, 5, "five program modes");
assert.ok(isProgramMode("news_channel"));
assert.equal(defaultReturnMode("wizard_joe_special"), "news_channel");
assert.equal(defaultReturnMode("bird_rant"), "news_channel");
console.log("ok - PBW program modes");

/* ── PBW adapter surface (routes / performers / fly_speak) ─────────────── */
const {
  PERFORMER_MODES,
  DEFAULT_PERFORMER,
  normalizePerformer,
  routeForPerformerHub,
  libraryTargetForPerformer,
} = await load("src/shared/performerModes.js");
const {
  ACTION_SPEEDS,
  Y_BAND,
  isFlySpeakAction,
  baseSpeedFor,
  createLocomotionState,
} = await load("src/choreography/locomotionController.js");
const { STAGE_BG_BULL, STAGE_BG_WHITE, normalizeStageBg } = await load(
  "src/shared/stageBackground.js",
);

test("performer modes map to Bird Live hub routes", () => {
  assert.deepEqual(
    [...PERFORMER_MODES].sort(),
    ["dragon", "kingfisher", "prism", "robin", "speech", "wizard", "wizardjoe"].sort(),
  );
  assert.equal(DEFAULT_PERFORMER, "wizard");
  assert.equal(normalizePerformer("bird"), "robin");
  assert.equal(normalizePerformer("joe"), "wizard");
  assert.equal(normalizePerformer("wizard-joe"), "wizard");
  assert.equal(routeForPerformerHub("robin"), "/41birdlive");
  assert.equal(routeForPerformerHub("wizard"), "/joe/alpha-hd");
  assert.equal(routeForPerformerHub("dragon"), "/dragon");
  assert.equal(routeForPerformerHub("kingfisher"), "/studio?cast=kingfisher");
  assert.equal(routeForPerformerHub("prism"), "/studio?cast=prism");
  assert.equal(libraryTargetForPerformer("robin").kind, "bird-live");
  assert.equal(libraryTargetForPerformer("wizard").kind, "wizard-library");
  assert.equal(libraryTargetForPerformer("dragon").kind, "catalog");
});

test("fly_speak is airborne speak (not grounded hold)", () => {
  assert.equal(ACTION_SPEEDS.fly_speak, 0.16);
  assert.equal(ACTION_SPEEDS.speak, 0);
  assert.equal(baseSpeedFor("fly_speak"), 0.16);
  assert.equal(isFlySpeakAction("fly_speak"), true);
  assert.equal(isFlySpeakAction("speak"), false);
  assert.equal(isFlySpeakAction("fly_forward"), true);
  // flight band for fly_speak (same as fly)
  const band = Y_BAND.fly;
  assert.ok(band.min < band.max);
  assert.ok(band.max < Y_BAND.ground.min, "flight band above ground band");
  const loco = createLocomotionState(1);
  assert.equal(loco.version.startsWith("cw-locomotion"), true);
});

test("stage background preference defaults bull", () => {
  assert.equal(normalizeStageBg(null), STAGE_BG_BULL);
  assert.equal(normalizeStageBg("white"), STAGE_BG_WHITE);
  assert.equal(normalizeStageBg("bull"), STAGE_BG_BULL);
});

test("App routes cover joe/studio/41birdlive/dragon", () => {
  const appSrc = readFileSync(path.join(root, "src/App.jsx"), "utf8");
  for (const needle of [
    'path="/studio"',
    'path="/41birdlive"',
    'path="/joe/:pack"',
    'path="/dragon"',
    'path="/bird-live"',
  ]) {
    assert.ok(appSrc.includes(needle), `App.jsx missing ${needle}`);
  }
});

test("adapter contract + parity checklist present", () => {
  const contract = path.join(root, "docs/integration/pbw-adapter-contract.md");
  const checklist = path.join(root, "docs/integration/pbw-parity-checklist.json");
  assert.ok(existsSync(contract), "pbw-adapter-contract.md");
  assert.ok(existsSync(checklist), "pbw-parity-checklist.json");
  const json = JSON.parse(readFileSync(checklist, "utf8"));
  assert.equal(json.schemaVersion, "pbw.parity-checklist.v1");
  assert.ok(Array.isArray(json.items) && json.items.length >= 10);
  const statuses = new Set(json.items.map((i) => i.status));
  assert.ok(statuses.has("pass"));
  assert.ok(statuses.has("fail"), "honest fail entries for non-parity");
  const programBus = json.items.find((i) => i.id === "program-bus");
  const xOut = json.items.find((i) => i.id === "x-output");
  const capture = json.items.find((i) => i.id === "capture-encoder");
  assert.equal(programBus?.status, "fail");
  assert.equal(xOut?.status, "fail");
  assert.equal(capture?.status, "fail");
});

if (process.exitCode) {
  console.error("parity contract proofs FAILED");
  process.exit(1);
}

console.log("parity contract proofs passed");
