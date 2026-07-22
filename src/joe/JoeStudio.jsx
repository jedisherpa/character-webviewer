import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WizardJoeStage } from "./WizardJoeStage.jsx";
import { WorldSpacePanel } from "./WorldSpacePanel.jsx";
import { GamepadPad } from "./GamepadPad.jsx";
import { NewsWizEmbed } from "../shared/NewsWizEmbed.jsx";
import { PerformerSwitch } from "../shared/PerformerSwitch.jsx";
import {
  normalizePerformer,
  writeStoredPerformer,
} from "../shared/performerModes.js";
import { BullBackdrop } from "../shared/BullBackdrop.jsx";
import { StageFullscreenButton } from "../shared/StageFullscreenButton.jsx";
import { useStageFullscreen } from "../shared/useStageFullscreen.js";
import {
  readStageBg,
  STAGE_BG_BULL,
  STAGE_BG_WHITE,
  writeStageBg,
} from "../shared/stageBackground.js";
import {
  listAllPoses,
  listChoreography,
  listDancePoses,
  listPackClips,
} from "./wizardJoeDirector.js";
import {
  DEFAULT_WORLD,
  clampWorld,
  clearWorld,
  readWorld,
  writeWorld,
} from "./wizardJoeWorldSpace.js";
import {
  ChoreographyHarness,
  useChoreographyFrameBridge,
} from "../choreography/ChoreographyHarness.jsx";
import "./JoeStudio.css";

const STUDIO_CATEGORIES = [
  { id: "moves", label: "Moves & Skills", icon: "◎", mode: "poses", tags: null },
  { id: "test", label: "Test", icon: "◌", mode: "poses", tags: ["idle", "listen", "think", "speak", "core"] },
  { id: "animated", label: "Animated", icon: "✦", mode: "choreo", tags: null },
  {
    id: "parade",
    label: "Parade",
    icon: "⇢",
    mode: "poses",
    tags: [
      "locomotion",
      "walk",
      "walk_forward",
      "walk_cycle",
      "run",
      "jump",
      "flight",
      "fly",
      "fly_forward",
      "flight_cycle",
    ],
  },
  { id: "held", label: "Held", icon: "✋", mode: "poses", tags: ["idle", "staff", "hand"] },
  { id: "accessories", label: "Accessories", icon: "✧", mode: "poses", tags: ["magic", "staff", "hero", "gesture"] },
  { id: "dance", label: "Dance", icon: "♪", mode: "poses", tags: ["dance", "dance_move", "celebrate"] },
];

/** NewsWiz choreography / pack highlights shown as one-tap strip */
const FEATURED_CLIPS = [
  { id: "walk_forward", label: "Walk loop" },
  { id: "fly_forward", label: "Fly loop" },
  { id: "dance_party", label: "Dance party" },
  { id: "magic_cast", label: "Magic cast" },
  { id: "conversation", label: "Conversation" },
  { id: "flight_tour", label: "Flight tour" },
  { id: "base250_full", label: "Full library" },
];

function normalizePack(raw) {
  const p = String(raw || "alpha-hd").toLowerCase();
  if (p === "base250" || p === "base-250" || p === "legacy") return "base250";
  if (p === "mixed") return "mixed";
  return "alpha-hd";
}

function routeForPerformer(mode) {
  switch (normalizePerformer(mode)) {
    case "robin":
      return "/41birdlive";
    case "dragon":
      return "/dragon";
    case "wizard":
      return "/joe/alpha-hd";
    case "kingfisher":
    case "prism":
    case "speech":
    case "wizardjoe":
      return `/studio?cast=${normalizePerformer(mode)}`;
    default:
      return "/joe/alpha-hd";
  }
}

function libraryUrlFor(pack) {
  if (pack === "base250") return "/wizard-joe-base250/library.json";
  if (pack === "mixed") return "/wizard-joe/library.json";
  return "/wizard-joe-alpha-hd/library.json";
}

function poseMatchesTags(pose, tags) {
  if (!tags?.length) return true;
  const blob = `${pose.id} ${pose.name || ""} ${pose.intent || ""} ${(pose.tags || []).join(" ")}`.toLowerCase();
  return tags.some((t) => blob.includes(String(t).toLowerCase()));
}

function shortPoseLabel(pose) {
  const raw = pose.intent || pose.name || pose.id || "";
  const cleaned = String(raw).replace(/^b250[_\s-]*/i, "").replace(/_/g, " ").trim();
  if (cleaned.length <= 28) return `#${pose.runtimeId} ${cleaned}`;
  return `#${pose.runtimeId} ${cleaned.slice(0, 26)}…`;
}

export function JoeStudio() {
  const navigate = useNavigate();
  const { pack: packParam } = useParams();
  const pack = normalizePack(packParam);
  const libraryUrl = libraryUrlFor(pack);
  const stageHostRef = useRef(null);
  const {
    active: stageFullscreen,
    toggle: toggleStageFullscreen,
    exit: exitStageFullscreen,
  } = useStageFullscreen(stageHostRef);
  const [stageBg, setStageBg] = useState(readStageBg);
  const stageBgWhite = stageBg === STAGE_BG_WHITE;
  const toggleStageBg = useCallback(() => {
    setStageBg((cur) => writeStageBg(cur === STAGE_BG_WHITE ? STAGE_BG_BULL : STAGE_BG_WHITE));
  }, []);
  const onPerformerChange = useCallback(
    (mode) => {
      writeStoredPerformer(mode);
      navigate(routeForPerformer(mode));
    },
    [navigate],
  );

  const [library, setLibrary] = useState(null);
  const [categoryId, setCategoryId] = useState("moves");
  const [filter, setFilter] = useState("");
  const [stage, setStage] = useState("idle");
  const [action, setAction] = useState("");
  const [forceClip, setForceClip] = useState("");
  const [forcePoseId, setForcePoseId] = useState("");
  const [playSpeed, setPlaySpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [dancing, setDancing] = useState(false);
  const [frameInfo, setFrameInfo] = useState(null);
  const [worldOpen, setWorldOpen] = useState(false);
  const [world, setWorld] = useState(() => readWorld(pack));
  const [statusLine, setStatusLine] = useState("ready");
  const [choreoDriving, setChoreoDriving] = useState(false);
  const choreoFrameBridge = useChoreographyFrameBridge();

  useEffect(() => {
    setForceClip("");
    setForcePoseId("");
    setPaused(false);
    setAction("");
    setDancing(false);
    setStage("idle");
    setWorld(readWorld(pack));
    setStatusLine(pack === "alpha-hd" ? "Alpha HD" : pack === "base250" ? "Base 250" : "Mixed");
  }, [pack]);

  useEffect(() => {
    let cancelled = false;
    setLibrary(null);
    fetch(libraryUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((lib) => {
        if (!cancelled) setLibrary(lib);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [libraryUrl]);

  const onWorldChange = useCallback(
    (next) => {
      setWorld(next);
      writeWorld(next, pack);
    },
    [pack],
  );

  const resetWorld = useCallback(() => {
    clearWorld(pack);
    setWorld({ ...DEFAULT_WORLD });
  }, [pack]);

  const playClip = useCallback((name) => {
    setForcePoseId("");
    setForceClip(name);
    setAction(name);
    setDancing(name === "dance" || name === "breakdance");
    setPaused(false);
    setStage("ready");
    setStatusLine(`clip · ${name}`);
  }, []);

  const holdPose = useCallback((pose) => {
    if (!pose) return;
    setForceClip("");
    setForcePoseId(pose.id);
    setDancing(false);
    setPaused(true);
    setAction("");
    setStage("ready");
    setStatusLine(`pose #${pose.runtimeId}`);
  }, []);

  const clearForce = useCallback(() => {
    setForceClip("");
    setForcePoseId("");
    setPaused(false);
    setAction("idle");
    setStage("idle");
    setStatusLine("ready");
  }, []);

  const startDance = useCallback(() => {
    setForceClip("");
    setForcePoseId("");
    setDancing(true);
    setAction("breakdance");
    setStage("ready");
    setPaused(false);
    setStatusLine("breakdance");
  }, []);

  const stopDance = useCallback(() => {
    setDancing(false);
    setAction("idle");
    setStage("idle");
    setStatusLine("ready");
  }, []);

  const danceCount = useMemo(() => {
    if (library) return listDancePoses(library).length;
    return 0;
  }, [library]);

  const clipNames = useMemo(() => {
    const set = new Set();
    if (library?.clips) {
      Object.keys(library.clips).forEach((k) => set.add(k));
    }
    (library?.choreography || []).forEach((c) => c?.name && set.add(c.name));
    return set;
  }, [library]);

  const featuredAvailable = useMemo(
    () => FEATURED_CLIPS.filter((f) => clipNames.has(f.id)),
    [clipNames],
  );

  const category = STUDIO_CATEGORIES.find((c) => c.id === categoryId) || STUDIO_CATEGORIES[0];
  const allPoses = useMemo(() => listAllPoses(library), [library]);
  const choreo = useMemo(() => listChoreography(library), [library]);
  const packs = useMemo(() => listPackClips(library), [library]);
  const q = filter.trim().toLowerCase();

  const filteredPoses = useMemo(() => {
    let list = allPoses;
    if (category.mode === "poses" && category.tags) {
      list = list.filter((p) => poseMatchesTags(p, category.tags));
    }
    if (q) {
      list = list.filter((p) => {
        const blob = `${p.id} ${p.name} ${p.intent || ""} ${(p.tags || []).join(" ")} ${p.runtimeId}`.toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [allPoses, category, q]);

  const nudgeWorld = useCallback(
    (dx, dy, dZoom = 0) => {
      setWorld((prev) => {
        const clamped = clampWorld({
          ...prev,
          x: (prev.x ?? 0.5) + dx * 0.02,
          y: (prev.y ?? 0.72) + dy * 0.02,
          zoom: (prev.zoom ?? 1) + dZoom * 0.08,
        });
        writeWorld(clamped, pack);
        return clamped;
      });
    },
    [pack],
  );

  /** Harness drives action / world while running; inert when panel closed. */
  const onChoreoDrive = useCallback((cmd) => {
    if (!cmd?.running) {
      setChoreoDriving(false);
      setForceClip("");
      setForcePoseId("");
      setDancing(false);
      setPaused(false);
      setAction("idle");
      setStage("idle");
      setStatusLine("ready");
      return;
    }
    setChoreoDriving(true);
    setForcePoseId("");
    setDancing(false);
    setForceClip(cmd.forceClip || "");
    setAction(cmd.action || "");
    setStage(cmd.stage || "ready");
    setPaused(Boolean(cmd.paused));
    if (cmd.speed != null && Number.isFinite(Number(cmd.speed))) {
      setPlaySpeed(Number(cmd.speed));
    }
    if (cmd.world) {
      // RAF-rate updates — keep in memory only; do not thrash localStorage.
      setWorld((prev) =>
        clampWorld({
          ...prev,
          x: cmd.world.x ?? prev.x,
          y: cmd.world.y ?? prev.y,
          flipX: cmd.world.flipX ?? prev.flipX,
          zoom: cmd.world.zoom ?? prev.zoom,
          bob: cmd.world.bob ?? prev.bob,
          sway: cmd.world.sway ?? prev.sway,
        }),
      );
    }
    setStatusLine(`choreo · ${cmd.action || cmd.forceClip || "run"}`);
  }, []);

  const onStageFrame = useCallback(
    (frame) => {
      setFrameInfo(frame);
      choreoFrameBridge(frame);
    },
    [choreoFrameBridge],
  );

  const cycleCategory = useCallback((dir) => {
    setCategoryId((cur) => {
      const idx = STUDIO_CATEGORIES.findIndex((c) => c.id === cur);
      return STUDIO_CATEGORIES[(idx + dir + STUDIO_CATEGORIES.length) % STUDIO_CATEGORIES.length].id;
    });
  }, []);

  const onGamepadAction = useCallback(
    ({ id, phase }) => {
      const isMove = phase === "down" || phase === "hold";
      switch (id) {
        case "up":
          if (isMove) nudgeWorld(0, -1);
          break;
        case "down":
          if (isMove) nudgeWorld(0, 1);
          break;
        case "left":
          if (isMove) nudgeWorld(-1, 0);
          break;
        case "right":
          if (isMove) nudgeWorld(1, 0);
          break;
        case "lt":
          if (isMove) nudgeWorld(0, 0, -1);
          break;
        case "rt":
          if (isMove) nudgeWorld(0, 0, 1);
          break;
        case "lb":
          if (phase === "tap") cycleCategory(-1);
          break;
        case "rb":
          if (phase === "tap") cycleCategory(1);
          break;
        case "a":
          if (phase === "tap") {
            stopDance();
            clearForce();
          }
          break;
        case "b":
          if (phase === "tap") {
            stopDance();
            clearForce();
          }
          break;
        case "x":
          if (phase === "tap") {
            if (clipNames.has("walk_forward")) playClip("walk_forward");
            else playClip("walk");
          }
          break;
        case "y":
          if (phase === "tap") {
            if (clipNames.has("fly_forward")) playClip("fly_forward");
            else if (dancing) stopDance();
            else startDance();
          }
          break;
        case "start":
          if (phase === "tap") setPaused((p) => !p);
          break;
        case "select":
          if (phase === "tap") setWorldOpen((v) => !v);
          break;
        case "ls":
          if (phase === "tap") resetWorld();
          break;
        case "rs":
          if (phase === "tap") {
            setWorld((prev) => {
              const clamped = clampWorld({ ...prev, flipX: !prev.flipX });
              writeWorld(clamped, pack);
              return clamped;
            });
          }
          break;
        default:
          break;
      }
    },
    [
      nudgeWorld,
      cycleCategory,
      stopDance,
      clearForce,
      playClip,
      dancing,
      startDance,
      resetWorld,
      pack,
      clipNames,
    ],
  );

  return (
    <div className="wj-shell">
      <div className="wj-studio-card">
        <header className="wj-topbar">
          <div className="wj-topbar-brand">
            <strong>
              <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
                Character Studio
              </Link>{" "}
              · Wizard Joe
            </strong>
            <span>
              {pack === "alpha-hd" ? "Production Alpha HD · 960×540" : "Base 250 · legacy"}
              {" · "}
              {library?.poseCount ?? "…"} poses
            </span>
          </div>
          <div className="wj-topbar-actions">
            <PerformerSwitch value="wizard" onChange={onPerformerChange} />
            <Link className={`wj-icon-btn${pack === "alpha-hd" ? " is-active" : ""}`} to="/joe/alpha-hd">
              Alpha HD
            </Link>
            <Link className={`wj-icon-btn${pack === "base250" ? " is-active" : ""}`} to="/joe/base250">
              Base 250
            </Link>
            <Link className="wj-icon-btn" to="/dragon">
              Dragonview
            </Link>
            <button
              type="button"
              className={`wj-icon-btn${worldOpen ? " is-active" : ""}`}
              onClick={() => setWorldOpen((v) => !v)}
            >
              World
            </button>
            <button type="button" className={`wj-icon-btn${paused ? " is-active" : ""}`} onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className={`wj-icon-btn${stageBgWhite ? " is-active" : ""}`}
              onClick={toggleStageBg}
              title={stageBgWhite ? "Switch to bull / dark stage" : "Switch to white stage"}
              aria-pressed={stageBgWhite}
            >
              {stageBgWhite ? "White" : "Bull"}
            </button>
            <StageFullscreenButton active={stageFullscreen} onToggle={toggleStageFullscreen} />
          </div>
        </header>

        <div className="wj-studio-body">
          <nav className="wj-cat-rail" aria-label="Skill categories">
            {STUDIO_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`wj-cat-btn${categoryId === cat.id ? " is-active" : ""}`}
                onClick={() => setCategoryId(cat.id)}
              >
                <span className="wj-cat-ico">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
            <div className="wj-cat-rail-foot">
              <div className="wj-status-chip">
                <strong>{statusLine.toUpperCase()}</strong>
                poses {library?.poseCount ?? "…"} · dance {danceCount}
                <br />
                {forceClip || forcePoseId || action || stage}
              </div>
              {clipNames.has("walk_forward") ? (
                <button
                  type="button"
                  className={`wj-icon-btn${forceClip === "walk_forward" ? " is-active is-primary" : ""}`}
                  style={{ width: "100%" }}
                  onClick={() => playClip("walk_forward")}
                >
                  Walk loop
                </button>
              ) : null}
              {clipNames.has("fly_forward") ? (
                <button
                  type="button"
                  className={`wj-icon-btn${forceClip === "fly_forward" ? " is-active is-primary" : ""}`}
                  style={{ width: "100%" }}
                  onClick={() => playClip("fly_forward")}
                >
                  Fly loop
                </button>
              ) : null}
              <button type="button" className="wj-icon-btn" style={{ width: "100%" }} onClick={() => (dancing ? stopDance() : startDance())}>
                {dancing ? "Stop dance" : `Breakdance (${danceCount})`}
              </button>
            </div>
          </nav>

          <section className="wj-pose-panel">
            <div className="wj-pose-panel-head">
              <span className="wj-pose-pill">{category.label}</span>
              <span className="wj-pose-meta">
                {category.mode === "choreo" ? `${choreo.length} clips` : `${filteredPoses.length} poses`}
              </span>
              <div className="wj-pose-transport">
                <button type="button" className="wj-icon-btn" onClick={clearForce}>
                  Clear
                </button>
                <label className="wj-icon-btn" style={{ cursor: "default" }}>
                  ×{playSpeed}
                  <input
                    type="range"
                    min="0.25"
                    max="3"
                    step="0.25"
                    value={playSpeed}
                    onChange={(e) => setPlaySpeed(Number(e.target.value))}
                    style={{ width: 72, accentColor: "#7ec8bc" }}
                  />
                </label>
              </div>
            </div>
            {featuredAvailable.length ? (
              <div className="wj-featured" aria-label="NewsWiz featured clips">
                {featuredAvailable.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`wj-featured-chip${forceClip === f.id ? " is-active" : ""}`}
                    onClick={() => playClip(f.id)}
                    title={f.id}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              className="wj-pose-filter"
              placeholder={category.mode === "choreo" ? "Filter clips…" : "Filter poses…"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="wj-pose-scroll">
              {category.mode === "choreo" ? (
                <div className="wj-clip-list">
                  {choreo.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`wj-clip-row${forceClip === c.name ? " is-active" : ""}`}
                      onClick={() => playClip(c.name)}
                    >
                      <strong>{c.name}</strong>
                      <span>{(c.frames || c.steps || []).length} keys</span>
                    </button>
                  ))}
                  {packs.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`wj-clip-row${forceClip === c.name ? " is-active" : ""}`}
                      onClick={() => playClip(c.name)}
                    >
                      <strong>{c.name}</strong>
                      <span>
                        pack · {c.count} frames
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="wj-pose-grid">
                  {filteredPoses.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`wj-pose-card${forcePoseId === p.id ? " is-active" : ""}`}
                      onClick={() => holdPose(p)}
                      title={p.id}
                    >
                      <div className="wj-pose-card-thumb">
                        <img src={p.frame} alt="" loading="lazy" />
                      </div>
                      <span className="wj-pose-card-label">{shortPoseLabel(p)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className={`wj-preview${stageBgWhite ? " is-bg-white" : " is-bg-bull"}`}>
            <div
              ref={stageHostRef}
              className={`wj-preview-stage-host${stageFullscreen ? " is-stage-fullscreen" : ""}${stageBgWhite ? " is-bg-white" : " is-bg-bull"}`}
              data-stage-bg={stageBg}
            >
              {!stageBgWhite ? <BullBackdrop /> : null}
              <WizardJoeStage
                stage={stage}
                status="active"
                dancing={dancing && !forceClip && !forcePoseId && !choreoDriving}
                action={dancing && !forceClip && !choreoDriving ? "breakdance" : action}
                forceClip={forceClip}
                forcePoseId={forcePoseId}
                speed={playSpeed}
                paused={paused}
                libraryUrl={libraryUrl}
                world={world}
                onWorldChange={choreoDriving ? undefined : onWorldChange}
                onFrame={onStageFrame}
              />
              <ChoreographyHarness onDrive={onChoreoDrive} />
              {stageFullscreen ? (
                <div className="stage-fs-exit-float">
                  <StageFullscreenButton
                    active
                    onToggle={exitStageFullscreen}
                  />
                </div>
              ) : null}
              {!stageFullscreen && worldOpen ? (
                <aside className="wj-world-drawer">
                  <WorldSpacePanel world={world} onChange={onWorldChange} onReset={resetWorld} />
                </aside>
              ) : null}
              {!stageFullscreen ? <NewsWizEmbed /> : null}
              {!stageFullscreen && !choreoDriving ? (
                <div className="wj-gamepad-float">
                  <GamepadPad
                    onAction={onGamepadAction}
                    labels={{
                      x: "Walk loop",
                      y: clipNames.has("fly_forward") ? "Fly loop" : "Dance",
                    }}
                  />
                </div>
              ) : null}
            </div>
            {!stageFullscreen ? (
              <div className="wj-preview-foot">
                <span>
                  now <code>{forcePoseId || forceClip || frameInfo?.clipName || action || stage}</code>
                </span>
                {frameInfo?.pose ? (
                  <span>
                    #{frameInfo.pose.runtimeId} {frameInfo.pose.name?.slice(0, 36)}
                  </span>
                ) : null}
                <span style={{ marginLeft: "auto" }}>
                  zoom {(world?.zoom ?? 1).toFixed(2)}
                </span>
                <StageFullscreenButton
                  active={stageFullscreen}
                  onToggle={toggleStageFullscreen}
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
