import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { WizardJoeStage } from "./WizardJoeStage.jsx";
import { WorldSpacePanel } from "./WorldSpacePanel.jsx";
import { GamepadPad } from "./GamepadPad.jsx";
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
import "./JoeStudio.css";

const STUDIO_CATEGORIES = [
  { id: "moves", label: "Moves & Skills", icon: "◎", mode: "poses", tags: null },
  { id: "test", label: "Test", icon: "◌", mode: "poses", tags: ["idle", "listen", "think", "speak", "core"] },
  { id: "animated", label: "Animated", icon: "✦", mode: "choreo", tags: null },
  { id: "parade", label: "Parade", icon: "⇢", mode: "poses", tags: ["locomotion", "walk", "run", "jump", "flight", "fly"] },
  { id: "held", label: "Held", icon: "✋", mode: "poses", tags: ["idle", "staff", "hand"] },
  { id: "accessories", label: "Accessories", icon: "✧", mode: "poses", tags: ["magic", "staff", "hero", "gesture"] },
  { id: "dance", label: "Dance", icon: "♪", mode: "poses", tags: ["dance", "dance_move", "celebrate"] },
];

function normalizePack(raw) {
  const p = String(raw || "alpha-hd").toLowerCase();
  if (p === "base250" || p === "base-250" || p === "legacy") return "base250";
  if (p === "mixed") return "mixed";
  return "alpha-hd";
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
  const { pack: packParam } = useParams();
  const pack = normalizePack(packParam);
  const libraryUrl = libraryUrlFor(pack);

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
          if (phase === "tap") playClip("magic");
          break;
        case "y":
          if (phase === "tap") (dancing ? stopDance() : startDance());
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
    [nudgeWorld, cycleCategory, stopDance, clearForce, playClip, dancing, startDance, resetWorld, pack],
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

          <section className="wj-preview">
            <WizardJoeStage
              stage={stage}
              status="active"
              dancing={dancing && !forceClip && !forcePoseId}
              action={dancing && !forceClip ? "breakdance" : action}
              forceClip={forceClip}
              forcePoseId={forcePoseId}
              speed={playSpeed}
              paused={paused}
              libraryUrl={libraryUrl}
              world={world}
              onWorldChange={onWorldChange}
              onFrame={setFrameInfo}
            />
            {worldOpen ? (
              <aside className="wj-world-drawer">
                <WorldSpacePanel world={world} onChange={onWorldChange} onReset={resetWorld} />
              </aside>
            ) : null}
            <div className="wj-gamepad-float">
              <GamepadPad onAction={onGamepadAction} />
            </div>
            <div className="wj-preview-foot">
              <span>
                now <code>{forcePoseId || forceClip || frameInfo?.clipName || action || stage}</code>
              </span>
              <span style={{ marginLeft: "auto" }}>
                zoom {(world?.zoom ?? 1).toFixed(2)}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
