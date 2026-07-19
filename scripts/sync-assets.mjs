#!/usr/bin/env node
/**
 * Sync slim web assets into public/ for Vercel static deploy.
 *
 * Sources (local machines):
 *   RobinSpeech/public/wizard-joe-{alpha-hd,base250}
 *   dragonview/assets/{pose,kingfisher,wizardjoe}-library
 *
 * On CI: if sources are missing and public/ already has assets (committed),
 * the script succeeds so builds still work.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const ROBIN = process.env.ROBINSPEECH_ROOT || path.join(HOME, "RobinSpeech");
const DRAGON = process.env.DRAGONVIEW_ROOT || path.join(HOME, "dragonview");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDirFiltered(src, dest, { include } = {}) {
  if (!exists(src)) return 0;
  let n = 0;
  mkdirp(dest);
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      n += copyDirFiltered(s, d, { include });
    } else if (!include || include(ent.name, s)) {
      copyFile(s, d);
      n += 1;
    }
  }
  return n;
}

function log(...a) {
  console.log("[sync-assets]", ...a);
}

function syncWizardPack(name) {
  const src = path.join(ROBIN, "public", name);
  const dest = path.join(PUBLIC, name);
  if (!exists(src)) {
    if (exists(dest)) {
      log(`skip ${name} (source missing, public copy present)`);
      return true;
    }
    log(`WARN missing ${src}`);
    return false;
  }
  rmrf(dest);
  mkdirp(dest);
  // library.json + frames only (no pixelgraphs needed for PNG stage)
  const lib = path.join(src, "library.json");
  if (exists(lib)) copyFile(lib, path.join(dest, "library.json"));
  const frames = path.join(src, "frames");
  if (exists(frames)) {
    const n = copyDirFiltered(frames, path.join(dest, "frames"));
    log(`${name}: library + ${n} frames`);
  } else {
    log(`${name}: library only`);
  }
  return true;
}

function syncDragonLib(char, folder) {
  const srcRoot = path.join(DRAGON, "assets", folder);
  const destRoot = path.join(PUBLIC, "library", char);
  if (!exists(srcRoot)) {
    if (exists(destRoot)) {
      log(`skip library/${char} (source missing, public copy present)`);
      return true;
    }
    log(`WARN missing ${srcRoot}`);
    return false;
  }
  rmrf(destRoot);
  mkdirp(destRoot);

  const catalog = path.join(srcRoot, "catalog.json");
  if (exists(catalog)) copyFile(catalog, path.join(destRoot, "catalog.json"));

  // Slim: preview.png (+ runtime as fallback) under pixelgraphs/**
  const pg = path.join(srcRoot, "pixelgraphs");
  let n = 0;
  if (exists(pg)) {
    n = copyDirFiltered(pg, path.join(destRoot, "pixelgraphs"), {
      include: (name) =>
        name === "preview.png" ||
        name === "runtime-960x540.png" ||
        name === "meta.json",
    });
  }
  log(`library/${char}: catalog + ${n} slim files`);
  return true;
}

function writeManifest() {
  const plateSrc = path.join(DRAGON, "assets", "stage", "active_plate.json");
  const plateDest = path.join(PUBLIC, "library", "stage", "active_plate.json");
  if (exists(plateSrc)) {
    copyFile(plateSrc, plateDest);
  } else if (!exists(plateDest)) {
    mkdirp(path.dirname(plateDest));
    fs.writeFileSync(
      plateDest,
      JSON.stringify(
        {
          id: "white_stage",
          camera: {
            eye: [14, 3.2, 6.5],
            target: [0, 1.2, 0],
            up: [0, 1, 0],
            fov_y_deg: 38,
            flip_x: false,
            flip_z: false,
          },
          bird_draw: {
            scale_multiplier: 2.4,
            feet_anchor: 0.94,
          },
          background: "#ffffff",
        },
        null,
        2,
      ),
    );
  }

  const manifest = {
    builtAt: new Date().toISOString(),
    visualizers: [
      { id: "joe-base250", path: "/joe/base250", pack: "base250" },
      { id: "joe-alpha-hd", path: "/joe/alpha-hd", pack: "alpha-hd" },
      { id: "dragonview", path: "/dragon", cast: ["dragon", "kingfisher", "wizardjoe"] },
    ],
  };
  fs.writeFileSync(path.join(PUBLIC, "manifest.json"), JSON.stringify(manifest, null, 2));
  log("wrote public/manifest.json");
}

mkdirp(PUBLIC);
const okJoeA = syncWizardPack("wizard-joe-alpha-hd");
const okJoeB = syncWizardPack("wizard-joe-base250");
const okDragon =
  syncDragonLib("dragon", "pose-library") &&
  syncDragonLib("kingfisher", "kingfisher-library") &&
  syncDragonLib("wizardjoe", "wizardjoe-library");
writeManifest();

if (!okJoeA && !okJoeB && !exists(path.join(PUBLIC, "wizard-joe-alpha-hd"))) {
  console.error("[sync-assets] No Wizard Joe assets available");
  process.exit(1);
}
if (!okDragon && !exists(path.join(PUBLIC, "library", "dragon"))) {
  console.error("[sync-assets] No Dragonview library assets available");
  process.exit(1);
}
log("done");
