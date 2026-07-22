/**
 * Versioned scene registry snapshot (RobinSpeech birdLive sceneCatalog).
 * Editorial source and visual scene are independent state.
 */
import { CONTRACT_SCHEMA_VERSION, PRODUCER_REF } from "./schemaVersion.js";

export const SCENE_CONTRACT = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  producerRef: PRODUCER_REF,
});

export const VOXEL_BACKGROUNDS = Object.freeze([
  { id: "bird.location.wall-street", name: "Wall Street — Voxel Location", file: "/birdLive/backgrounds/voxel/01_wall_street_voxel_background.png" },
  { id: "bird.location.brooklyn-bridge", name: "Brooklyn Bridge — Voxel", file: "/birdLive/backgrounds/voxel/02_brooklyn_bridge_voxel_background.png" },
  { id: "bird.location.golden-gate", name: "Golden Gate — Voxel", file: "/birdLive/backgrounds/voxel/03_golden_gate_voxel_background.png" },
  { id: "bird.location.paris-eiffel", name: "Paris Eiffel — Voxel", file: "/birdLive/backgrounds/voxel/04_paris_eiffel_voxel_background.png" },
  { id: "bird.location.london-westminster", name: "London Westminster — Voxel", file: "/birdLive/backgrounds/voxel/05_london_westminster_voxel_background.png" },
  { id: "bird.location.venice-rialto", name: "Venice Rialto — Voxel", file: "/birdLive/backgrounds/voxel/06_venice_rialto_voxel_background.png" },
  { id: "bird.location.tokyo-shibuya", name: "Tokyo Shibuya — Voxel", file: "/birdLive/backgrounds/voxel/07_tokyo_shibuya_voxel_background.png" },
  { id: "bird.location.giza-pyramids", name: "Giza Pyramids — Voxel", file: "/birdLive/backgrounds/voxel/08_giza_pyramids_voxel_background.png" },
  { id: "bird.location.santorini", name: "Santorini — Voxel", file: "/birdLive/backgrounds/voxel/09_santorini_voxel_background.png" },
  { id: "bird.location.boulder-flatirons", name: "Boulder Flatirons — Voxel", file: "/birdLive/backgrounds/voxel/10_boulder_flatirons_voxel_background.png" },
]);

/** Distinct from voxel Wall Street — historical plate + transparent Charging Bull. */
export const ORIGINAL_WALL_STREET_BULL = Object.freeze({
  id: "bird.wall-street-bull.original",
  name: "Original Wall Street Bull",
  streetFile: "/birdLive/backgrounds/wall-street-bull/frame_001_street_only.jpg",
  overlayFile: "/birdLive/backgrounds/wall-street-bull/bull_overlay_frame_001.png",
  compositeFile: "/birdLive/backgrounds/wall-street-bull/frame_001_Wide_Establishing_Orbit_0deg.jpg",
  ndcBox: { x0: 0.19893, y0: 0.14796, x1: 0.70655, y1: 0.85332 },
  /** World-space middle depth (eye-space z); bird may fly behind when depth > this. */
  world: {
    occluderDepth: 14.2,
    occluderXMax: 3.2,
    groundY: 0,
    frontLandingZ: 10.5,
    rearFlightZ: 16.5,
  },
});

export const CORE_SCENES = Object.freeze([
  { id: "white-stage", name: "White Stage", kind: "white", performer: "wizardjoe" },
  { id: "bird-bowl", name: "Bird + Bowl", kind: "bowl", performer: "kingfisher" },
  { id: "original-bowl", name: "Original Bowl", kind: "bowl", performer: "kingfisher" },
  {
    id: ORIGINAL_WALL_STREET_BULL.id,
    name: ORIGINAL_WALL_STREET_BULL.name,
    kind: "wall-street-bull",
    performer: "kingfisher",
    streetFile: ORIGINAL_WALL_STREET_BULL.streetFile,
    overlayFile: ORIGINAL_WALL_STREET_BULL.overlayFile,
    ndcBox: ORIGINAL_WALL_STREET_BULL.ndcBox,
    world: ORIGINAL_WALL_STREET_BULL.world,
  },
  ...VOXEL_BACKGROUNDS.map((bg) => ({
    id: bg.id,
    name: bg.name,
    kind: "voxel",
    performer: "wizardjoe",
    backgroundImage: bg.file,
  })),
]);

export function sceneById(id) {
  return CORE_SCENES.find((s) => s.id === id) || CORE_SCENES[0];
}

export function isOriginalBullScene(id) {
  return id === ORIGINAL_WALL_STREET_BULL.id;
}

export function isVoxelWallStreet(id) {
  return id === "bird.location.wall-street";
}
