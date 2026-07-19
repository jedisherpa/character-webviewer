import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CAST_ORDER, WorldSim, createInput } from "./world.js";
import "./DragonStudio.css";

const CHAR_TAG = { dragon: "DR", kingfisher: "KF", wizardjoe: "WJ" };
const CAT_LABELS = {
  moves: "Moves & Skills",
  dragon: "Dragon",
  kingfisher: "Kingfisher",
  wizardjoe: "Wizard Joe",
};

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cameraFromPlate(plate) {
  const cam = plate?.camera || {};
  const eye = cam.eye || [14, 3.2, 6.5];
  const target = cam.target || [0, 1.2, 0];
  const upIn = cam.up || [0, 1, 0];
  const fov = ((cam.fov_y_deg || 38) * Math.PI) / 180;
  const flipX = !!cam.flip_x;
  const flipZ = !!cam.flip_z;
  const forward = norm(sub(target, eye));
  let right = norm(cross(upIn, forward));
  if (Math.hypot(...right) < 0.1) right = [0, 0, 1];
  const up = norm(cross(forward, right));
  if (flipX) right = [-right[0], -right[1], -right[2]];
  return { eye, forward, right, up, fov, flipZ, flipX };
}

function projectWorld(pos, cam, W, H) {
  let [wx, wy, wz] = pos;
  if (cam.flipZ) wz = -wz;
  const v = sub([wx, wy, wz], cam.eye);
  const x = dot(v, cam.right);
  const y = dot(v, cam.up);
  const z = dot(v, cam.forward);
  if (z < 0.15) return null;
  const aspect = W / H;
  const sy = 1 / Math.tan(cam.fov / 2);
  const sx = sy / aspect;
  const ndcX = (x / z) * sx;
  const ndcY = (y / z) * sy;
  return {
    x: (ndcX * 0.5 + 0.5) * W,
    y: (1 - (ndcY * 0.5 + 0.5)) * H,
    depth: z,
  };
}

function birdScalePx(depth, plate, H) {
  const mult = plate?.bird_draw?.scale_multiplier ?? 2.4;
  return Math.max(40, Math.min(H * 0.78, H * 0.17 * (12.5 / Math.max(0.5, depth)) * mult)) / 220;
}

function shortName(p) {
  const raw = (p.name || p.id || "").replace(/_/g, " ");
  return raw.length > 26 ? raw.slice(0, 24) + "…" : raw;
}

function Gamepad({ onSend }) {
  const bindHold = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      e.currentTarget.classList.add("is-down");
      onSend(key, true);
    },
    onPointerUp: (e) => {
      e.currentTarget.classList.remove("is-down");
      onSend(key, false);
    },
    onPointerCancel: (e) => {
      e.currentTarget.classList.remove("is-down");
      onSend(key, false);
    },
  });
  const bindPulse = (key) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.classList.add("is-down");
      onSend(key, true);
      setTimeout(() => {
        e.currentTarget.classList.remove("is-down");
        onSend(key, false);
      }, 120);
    },
  });

  return (
    <div className="gp" role="group" aria-label="Game controller">
      <div className="gp-left">
        <div className="gp-shoulders">
          <button type="button" className="gp-btn" {...bindHold("q")}>LB</button>
          <button type="button" className="gp-btn" {...bindHold("e")}>LT</button>
        </div>
        <div className="gp-dpad">
          <button type="button" className="up" {...bindHold("w")}>▲</button>
          <button type="button" className="left" {...bindHold("a")}>◀</button>
          <button type="button" className="center" tabIndex={-1} aria-hidden="true" />
          <button type="button" className="right" {...bindHold("d")}>▶</button>
          <button type="button" className="down" {...bindHold("s")}>▼</button>
        </div>
        <button type="button" className="gp-stick" {...bindPulse("g")} aria-label="snap" />
        <div className="gp-label">move</div>
      </div>
      <div className="gp-mid">
        <div className="gp-meta">
          <button type="button" className="gp-btn" {...bindPulse("m")}>SEL</button>
          <button type="button" className="gp-btn" {...bindPulse("tab")}>START</button>
        </div>
        <div className="gp-label">dragonview</div>
      </div>
      <div className="gp-right">
        <div className="gp-shoulders">
          <button type="button" className="gp-btn" {...bindHold("shift")}>RT</button>
          <button type="button" className="gp-btn" {...bindHold("x")}>RB</button>
        </div>
        <div className="gp-face">
          <button type="button" className="y" {...bindPulse("f")}>Y</button>
          <button type="button" className="x" {...bindHold("control")}>X</button>
          <button type="button" className="b" {...bindPulse("escape")}>B</button>
          <button type="button" className="a" {...bindHold("space")}>A</button>
        </div>
        <button type="button" className="gp-stick" {...bindPulse("v")} aria-label="volumes" />
        <div className="gp-label">action</div>
      </div>
    </div>
  );
}

export function DragonStudio() {
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const inputRef = useRef(createInput());
  const imgCache = useRef(new Map());
  const plateRef = useRef(null);
  const posesRef = useRef([]);
  const [poses, setPoses] = useState([]);
  const [cat, setCat] = useState("moves");
  const [filter, setFilter] = useState("");
  const [activePoseId, setActivePoseId] = useState(null);
  const [hud, setHud] = useState({ active: "dragon", tick: 0, note: "boot" });
  const [showVolumes, setShowVolumes] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const applyKey = useCallback((key, down) => {
    const k = key === " " ? "space" : String(key).toLowerCase();
    const i = inputRef.current;
    const sim = simRef.current;
    if (!sim) return;

    if (k === "v" && down) {
      setShowVolumes((v) => !v);
      return;
    }
    if (k === "escape" && down) {
      sim.reset_ground();
      showToast("Reset free play");
      return;
    }
    if (k === "tab" && down) {
      const who = sim.cycle_active();
      showToast(`active ${who}`);
      return;
    }

    if (k === "w" || k === "arrowup") i.move_y = down ? 1 : i.move_y > 0 ? 0 : i.move_y;
    else if (k === "s" || k === "arrowdown") i.move_y = down ? -1 : i.move_y < 0 ? 0 : i.move_y;
    else if (k === "a" || k === "arrowleft") i.move_x = down ? -1 : i.move_x < 0 ? 0 : i.move_x;
    else if (k === "d" || k === "arrowright") i.move_x = down ? 1 : i.move_x > 0 ? 0 : i.move_x;
    else if (k === "q") i.strafe_l = down;
    else if (k === "x") i.strafe_r = down;
    else if (k === "e") i.interact = down;
    else if (k === "space") i.jump = down;
    else if (k === "f") i.toggle_flight = down;
    else if (k === "shift") i.sprint = down;
    else if (k === "control" || k === "ctrl") i.precision = down;
    else if (k === "m") i.axes_toggle = down;
    else if (k === "g") i.dpad_snap = down;

    const mag = Math.hypot(i.move_x, i.move_y);
    if (mag > 1) {
      i.move_x /= mag;
      i.move_y /= mag;
    }
  }, [showToast]);

  // load plate + catalogs
  useEffect(() => {
    simRef.current = new WorldSim();
    let cancelled = false;
    (async () => {
      const plate = await fetch("/library/stage/active_plate.json").then((r) => r.json()).catch(() => ({}));
      if (cancelled) return;
      plateRef.current = plate;

      const all = [];
      for (const char of CAST_ORDER) {
        const catj = await fetch(`/library/${char}/catalog.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const list = catj?.cell_library?.poses || [];
        for (const p of list) {
          if (!p.pixelgraph) continue;
          const dir = String(p.pixelgraph).replace(/\/?pixelgraph\.json$/i, "");
          const preview = `/library/${char}/${dir}/preview.png`;
          const runtime = `/library/${char}/${dir}/runtime-960x540.png`;
          all.push({
            id: p.pose_id,
            name: (p.pose_id || "").split("/").pop() || p.pose_id,
            character: char,
            pack: p.source_pack || "",
            runtime_id: p.runtime_id,
            preview,
            runtime,
            cols: p.cols,
            rows: p.rows,
          });
        }
      }
      if (cancelled) return;
      posesRef.current = all;
      setPoses(all);
      // default pose per cast
      for (const char of CAST_ORDER) {
        const first = all.find((p) => p.character === char);
        if (first && simRef.current?.actors[char]) {
          simRef.current.actors[char].pose_override = first.id;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadImg = useCallback((url) => {
    if (!url) return Promise.resolve(null);
    if (imgCache.current.has(url)) return imgCache.current.get(url);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imgCache.current.set(url, p);
    return p;
  }, []);

  // sim loop + paint
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const acc = { t: 0 };
    const DT_FIXED = 1 / 60;

    const paint = () => {
      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (!canvas || !sim) return;
      const ctx = canvas.getContext("2d");
      const W = canvas.width;
      const H = canvas.height;
      const plate = plateRef.current || {};
      const cam = cameraFromPlate(plate);

      ctx.fillStyle = plate.background || "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // soft ground ellipse
      ctx.fillStyle = "rgba(0,0,0,0.06)";
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.82, W * 0.28, H * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();

      if (showVolumes) {
        ctx.strokeStyle = "rgba(148,163,184,0.35)";
        for (const aid of CAST_ORDER) {
          const h = sim.home[aid];
          const pr = projectWorld(h, cam, W, H);
          if (!pr) continue;
          ctx.strokeRect(pr.x - 20, pr.y - 40, 40, 40);
        }
      }

      const cast = CAST_ORDER.map((id) => {
        const a = sim.present_actor(sim.actors[id]);
        const pose = posesRef.current.find((p) => p.id === a.pose_id && p.character === id)
          || posesRef.current.find((p) => p.character === id);
        return { ...a, preview: pose?.preview, runtime: pose?.runtime, pose_id: a.pose_id || pose?.id };
      });

      const drawn = cast
        .map((b) => ({ b, pr: projectWorld(b.pos, cam, W, H) }))
        .filter((x) => x.pr)
        .sort((a, b) => b.pr.depth - a.pr.depth);

      for (const { b, pr } of drawn) {
        const active = b.id === sim.active;
        const scale = birdScalePx(pr.depth, plate, H) * (active ? 1.04 : 0.96);
        const url = b.runtime || b.preview;
        const cached = imgCache.current.get(url);
        const draw = (img) => {
          if (!img) {
            ctx.fillStyle =
              b.id === "kingfisher"
                ? "rgba(37,99,235,0.55)"
                : b.id === "wizardjoe"
                  ? "rgba(168,85,247,0.55)"
                  : "rgba(217,119,6,0.65)";
            ctx.beginPath();
            ctx.arc(pr.x, pr.y - 18, 14, 0, Math.PI * 2);
            ctx.fill();
            return;
          }
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const feet = plate?.bird_draw?.feet_anchor ?? 0.94;
          const topY = pr.y - dh * feet;
          const leftX = pr.x - dw / 2;
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = active ? 1 : 0.88;
          if (!b.flight) {
            ctx.fillStyle = "rgba(0,0,0,0.12)";
            ctx.beginPath();
            ctx.ellipse(pr.x, pr.y + 2, dw * 0.28, dh * 0.05, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.drawImage(img, leftX, topY, dw, dh);
          ctx.globalAlpha = 1;
          if (active) {
            ctx.strokeStyle =
              b.id === "wizardjoe"
                ? "rgba(168,85,247,0.85)"
                : b.id === "kingfisher"
                  ? "rgba(37,99,235,0.8)"
                  : "rgba(217,119,6,0.7)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(leftX - 2, topY - 2, dw + 4, dh + 4);
          }
          ctx.fillStyle = "rgba(15,23,42,0.55)";
          ctx.fillRect(pr.x - 60, topY - 16, 120, 14);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "10px ui-monospace,monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${b.display_id} · ${b.locomotion}`, pr.x, topY - 5);
          ctx.textAlign = "left";
        };

        if (cached && typeof cached.then === "function") {
          cached.then(draw);
        } else if (url) {
          loadImg(url).then(draw);
        } else draw(null);
      }

      // chips
      const act = sim.actors[sim.active];
      const chips = [
        act.free_flight ? "FLIGHT" : act.flight ? "AIR" : "GROUND",
        act.zone,
        act.locomotion,
        sim.screen_relative ? "SCR" : "WLD",
        sim.active.toUpperCase(),
      ];
      let x = 12;
      ctx.font = "10px ui-monospace,monospace";
      for (const c of chips) {
        const w = ctx.measureText(c).width + 12;
        ctx.fillStyle = c === "FLIGHT" ? "rgba(56,189,248,0.9)" : "rgba(15,23,42,0.72)";
        ctx.fillRect(x, H - 34, w, 16);
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(c, x + 6, H - 22);
        x += w + 6;
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc.t += dt;
      while (acc.t >= DT_FIXED) {
        simRef.current?.step(inputRef.current);
        // clear edge toggles
        inputRef.current.toggle_flight = false;
        inputRef.current.axes_toggle = false;
        inputRef.current.dpad_snap = false;
        acc.t -= DT_FIXED;
      }
      // preload active pose images
      for (const id of CAST_ORDER) {
        const a = simRef.current?.actors[id];
        const pose = posesRef.current.find((p) => p.id === a?.pose_override && p.character === id)
          || posesRef.current.find((p) => p.character === id);
        if (pose) loadImg(pose.runtime || pose.preview);
      }
      paint();
      const sim = simRef.current;
      if (sim) {
        setHud({
          active: sim.active,
          tick: sim.tick,
          note: `tick ${sim.tick} · ${sim.screen_relative ? "screen" : "world"} axes · poses ${posesRef.current.length}`,
        });
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loadImg, showVolumes]);

  // keyboard
  useEffect(() => {
    const down = (e) => {
      if (e.repeat) return;
      const t = e.target?.tagName;
      if (t === "INPUT" || t === "TEXTAREA") return;
      const k = e.key === " " ? "space" : e.key.toLowerCase();
      if (["space", "tab", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      applyKey(k, true);
    };
    const up = (e) => {
      const t = e.target?.tagName;
      if (t === "INPUT" || t === "TEXTAREA") return;
      const k = e.key === " " ? "space" : e.key.toLowerCase();
      applyKey(k, false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [applyKey]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return poses.filter((p) => {
      if (cat !== "moves" && p.character !== cat) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.character || "").toLowerCase().includes(q)
      );
    });
  }, [poses, cat, filter]);

  const selectPose = (p) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.set_active_pose(p.id);
    // if pose is for another character, switch active
    if (p.character && p.character !== sim.active) {
      sim.active = p.character;
    }
    setActivePoseId(p.id);
    showToast(`${p.character}: ${p.name || p.id}`);
  };

  return (
    <div className="dv-shell">
      <div className="dv-card">
        <header className="dv-topbar">
          <div className="dv-brand">
            <strong>
              <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
                Character Studio
              </Link>{" "}
              · Dragonview
            </strong>
            <span id="plate-label">Dragon · Kingfisher · Wizard Joe · white stage · world-space</span>
          </div>
          <div className="dv-actions">
            <span className="pill">{hud.active}</span>
            <span className="pill mute">web pad</span>
            <Link className="icon-btn" to="/joe/alpha-hd">Joe HD</Link>
            <Link className="icon-btn" to="/joe/base250">Joe 250</Link>
            <button type="button" className="icon-btn primary" onClick={() => applyKey("escape", true)}>
              Reset
            </button>
          </div>
        </header>

        <div className="dv-body">
          <nav className="dv-rail">
            {Object.entries(CAT_LABELS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`cat-btn${cat === id ? " is-active" : ""}`}
                onClick={() => setCat(id)}
              >
                {label}
              </button>
            ))}
            <div className="dv-rail-foot">
              <div className="status-chip">
                <strong>LIVE</strong>
                {hud.note}
                <span className="keys">WASD · Space hop · F flight · Tab cycle</span>
              </div>
              <div className="btn-grid">
                <button type="button" className="icon-btn" onClick={() => applyKey("tab", true)}>Cycle</button>
                <button type="button" className="icon-btn" onClick={() => applyKey("f", true)}>Flight</button>
                <button type="button" className="icon-btn" onClick={() => { applyKey("space", true); setTimeout(() => applyKey("space", false), 160); }}>Hop</button>
                <button type="button" className="icon-btn" onClick={() => applyKey("m", true)}>Axes</button>
              </div>
            </div>
          </nav>

          <section className="dv-poses">
            <div className="pose-head">
              <span className="pose-pill">{CAT_LABELS[cat]}</span>
              <span className="pose-meta">{filtered.length} poses</span>
            </div>
            <input
              className="pose-filter"
              placeholder="Filter poses…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="pose-scroll">
              <div className="pose-grid">
                {filtered.map((p) => (
                  <button
                    key={`${p.character}-${p.id}`}
                    type="button"
                    className={`pose-card char-${p.character}${activePoseId === p.id ? " is-active" : ""}`}
                    onClick={() => selectPose(p)}
                  >
                    <div className="pose-card-thumb">
                      <img src={p.preview || p.runtime} alt="" loading="lazy" />
                    </div>
                    <span className="pose-card-label">
                      [{CHAR_TAG[p.character]}] {shortName(p)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="dv-preview">
            <canvas ref={canvasRef} width={960} height={540} tabIndex={0} />
            <div className="dv-gamepad">
              <Gamepad onSend={applyKey} />
            </div>
            <div className="preview-foot">{hud.note}</div>
          </section>
        </div>
      </div>
      {toast ? <div className={`toast ${toast.kind}`}>{toast.msg}</div> : null}
    </div>
  );
}
