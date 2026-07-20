import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CAST_ORDER, CHAR_LABEL, WorldSim, createInput } from "../dragon/world.js";
import { GamepadPad } from "../joe/GamepadPad.jsx";
import {
  BINDABLE_BUTTONS,
  DEFAULT_GAMEPAD_BINDINGS,
  deleteSequence,
  exportSequenceJson,
  importSequenceJson,
  loadBindings,
  loadSequences,
  resetBindings,
  saveBindings,
  sequenceDurationMs,
  stepLabel,
  uid,
  upsertSequence,
} from "./sequenceStore.js";
import { CONTROL_SURFACES, GAMEPAD_DEFAULTS_DOC, KEYBOARD_CHEATSHEET } from "./controlsDoc.js";
import "./ProductionStudio.css";

const CHAR_TAG = {
  dragon: "DR",
  kingfisher: "KF",
  wizardjoe: "WJ",
  prism: "PR",
  speech: "SP",
};

const BIND_ACTION_OPTIONS = [
  { value: "nudge:0:-1:0", label: "Pan up" },
  { value: "nudge:0:1:0", label: "Pan down" },
  { value: "nudge:-1:0:0", label: "Pan left" },
  { value: "nudge:1:0:0", label: "Pan right" },
  { value: "nudge:0:0:1", label: "Zoom in" },
  { value: "nudge:0:0:-1", label: "Zoom out" },
  { value: "action:clear", label: "Clear / idle" },
  { value: "action:stop_clip", label: "Stop clip" },
  { value: "action:next_actor", label: "Next actor" },
  { value: "action:prev_actor", label: "Prev actor" },
  { value: "action:reset", label: "Reset stage" },
  { value: "action:flip", label: "Flip X" },
  { value: "action:hop", label: "Hop" },
  { value: "action:flight", label: "Flight toggle" },
  { value: "action:play_pause", label: "Play / pause seq" },
  { value: "action:record_toggle", label: "Record toggle" },
  { value: "clip:walk_forward:wizardjoe", label: "Clip walk_forward (Joe)" },
  { value: "clip:fly_forward:wizardjoe", label: "Clip fly_forward (Joe)" },
  { value: "clip:dance_party:wizardjoe", label: "Clip dance_party" },
  { value: "clip:magic_cast:wizardjoe", label: "Clip magic_cast" },
];

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
  // Lower floor look: slightly higher eye, lower target → plate sits lower in frame
  const eye = cam.eye || [13.5, 3.8, 7.2];
  const target = cam.target || [0, 0.35, 0];
  const upIn = cam.up || [0, 1, 0];
  const fov = ((cam.fov_y_deg || 36) * Math.PI) / 180;
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
  // Extra screen Y push keeps feet lower in the frame
  const yNudge = 0.06 * H;
  return {
    x: (ndcX * 0.5 + 0.5) * W,
    y: (1 - (ndcY * 0.5 + 0.5)) * H + yNudge,
    depth: z,
  };
}

function birdScalePx(depth, plate, H) {
  const mult = plate?.bird_draw?.scale_multiplier ?? 2.15;
  return Math.max(36, Math.min(H * 0.72, H * 0.16 * (12.5 / Math.max(0.5, depth)) * mult)) / 220;
}

function shortName(p) {
  const raw = (p.name || p.id || "").replace(/_/g, " ");
  return raw.length > 28 ? `${raw.slice(0, 26)}…` : raw;
}

function bindingToSelectValue(b) {
  if (!b) return "action:clear";
  if (b.type === "nudge") return `nudge:${b.dx ?? 0}:${b.dy ?? 0}:${b.dZoom ?? 0}`;
  if (b.type === "clip") return `clip:${b.clipName || "walk_forward"}:${b.actor || "wizardjoe"}`;
  if (b.type === "action") return `action:${b.action || "clear"}`;
  return "action:clear";
}

function selectValueToBinding(value) {
  const [kind, a, b, c] = String(value).split(":");
  if (kind === "nudge") {
    return {
      type: "nudge",
      dx: Number(a) || 0,
      dy: Number(b) || 0,
      dZoom: Number(c) || 0,
      label: BIND_ACTION_OPTIONS.find((o) => o.value === value)?.label || "Nudge",
    };
  }
  if (kind === "clip") {
    return {
      type: "clip",
      clipName: a,
      actor: b || "wizardjoe",
      label: BIND_ACTION_OPTIONS.find((o) => o.value === value)?.label || a,
    };
  }
  return {
    type: "action",
    action: a || "clear",
    label: BIND_ACTION_OPTIONS.find((o) => o.value === value)?.label || a,
  };
}

const EMPTY_SEQ = () => ({
  id: uid(),
  name: "Untitled sequence",
  steps: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function ProductionStudio() {
  const canvasRef = useRef(null);
  const simRef = useRef(null);
  const inputRef = useRef(createInput());
  const plateRef = useRef({});
  const posesRef = useRef([]);
  const clipsRef = useRef([]);
  const imgCache = useRef(new Map());
  const playTimer = useRef(null);
  const recordRef = useRef(false);

  const [poses, setPoses] = useState([]);
  const [clips, setClips] = useState([]);
  const [filter, setFilter] = useState("");
  const [activePoseId, setActivePoseId] = useState(null);
  const [hud, setHud] = useState("boot");
  const [toast, setToast] = useState(null);
  const [showPad, setShowPad] = useState(true);
  const [panels, setPanels] = useState({
    library: false,
    timeline: true,
    sequences: false,
    bindings: false,
    cast: false,
    docs: false,
  });

  const [sequence, setSequence] = useState(EMPTY_SEQ);
  const [library, setLibrary] = useState(() => loadSequences());
  const [bindings, setBindings] = useState(() => loadBindings());
  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playIdx, setPlayIdx] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [activeActor, setActiveActor] = useState("dragon");

  recordRef.current = recording;

  const showToast = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind });
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const togglePanel = useCallback((id) => {
    setPanels((p) => {
      const next = { ...p, [id]: !p[id] };
      // keep stage uncluttered: opening one side drawer closes the other side's
      if (id === "library" && next.library) next.sequences = false;
      if (id === "sequences" && next.sequences) next.library = false;
      if (id === "bindings" && next.bindings) next.docs = false;
      if (id === "docs" && next.docs) next.bindings = false;
      return next;
    });
  }, []);

  const appendStep = useCallback((step) => {
    if (!recordRef.current) return;
    setSequence((seq) => ({
      ...seq,
      steps: [
        ...seq.steps,
        {
          id: uid("step"),
          holdMs: step.holdMs ?? 320,
          ...step,
        },
      ],
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const playClipOnActor = useCallback(
    (name, actor = "wizardjoe") => {
      const sim = simRef.current;
      if (!sim) return;
      const def =
        clipsRef.current.find((c) => c.name === name && c.character === actor) ||
        clipsRef.current.find((c) => c.name === name);
      if (!def?.frames?.length) {
        showToast(`No clip ${name}`, "err");
        return;
      }
      const aid = sim.actors[def.character] ? def.character : actor;
      if (sim.actors[aid]) sim.active = aid;
      sim.play_clip(def.name, def.frames, {
        looped: def.looped !== false,
        hold_ticks: def.hold_ticks ?? 6,
        forward_speed: def.forward_speed ?? (name.includes("walk") ? 1.6 : 0),
        translate_toward_camera: def.translate_toward_camera ?? name.includes("walk"),
        actor_id: aid,
      });
      appendStep({
        type: "clip",
        actor: aid,
        clipName: def.name,
        holdMs: Math.max(400, (def.frames.length || 1) * ((def.hold_ticks || 6) * (1000 / 60))),
        label: `${def.label || def.name} · ${aid}`,
      });
      showToast(`${def.label || def.name}`);
    },
    [appendStep, showToast],
  );

  const holdPose = useCallback(
    (pose) => {
      const sim = simRef.current;
      if (!sim || !pose) return;
      const aid = pose.character || sim.active;
      if (sim.actors[aid]) {
        sim.active = aid;
        sim.actors[aid].clip = null;
        sim.actors[aid].pose_override = pose.id;
        sim.actors[aid].locomotion = "pose";
        sim.actors[aid].pose_hint = "pose";
      }
      setActivePoseId(pose.id);
      appendStep({
        type: "pose",
        actor: aid,
        poseId: pose.id,
        holdMs: 400,
        label: shortName(pose),
      });
    },
    [appendStep],
  );

  const runAction = useCallback(
    (action) => {
      const sim = simRef.current;
      if (!sim) return;
      const order = CAST_ORDER;
      const idx = order.indexOf(sim.active);
      switch (action) {
        case "clear":
          sim.clear_pose_override();
          sim.stop_clip(sim.active, { snap_home: false });
          setActivePoseId(null);
          appendStep({ type: "action", action: "clear", holdMs: 200, label: "Clear" });
          break;
        case "stop_clip":
          sim.stop_clip(null, { snap_home: true });
          appendStep({ type: "action", action: "stop_clip", holdMs: 200, label: "Stop clip" });
          showToast("Clip stopped");
          break;
        case "next_actor":
          sim.cycle_active();
          appendStep({ type: "action", action: "next_actor", holdMs: 150, label: `Active ${sim.active}` });
          showToast(`active ${CHAR_LABEL[sim.active] || sim.active}`);
          break;
        case "prev_actor": {
          const prev = order[(idx - 1 + order.length) % order.length];
          sim.active = prev;
          appendStep({ type: "action", action: "prev_actor", holdMs: 150, label: `Active ${prev}` });
          showToast(`active ${CHAR_LABEL[prev] || prev}`);
          break;
        }
        case "reset":
          sim.stop_clip(null, { snap_home: true });
          sim.reset_ground();
          setActivePoseId(null);
          appendStep({ type: "action", action: "reset", holdMs: 200, label: "Reset" });
          showToast("Stage reset");
          break;
        case "flip": {
          const a = sim.actors[sim.active];
          if (a) a.face_sign = -(a.face_sign || 1);
          appendStep({ type: "action", action: "flip", holdMs: 150, label: "Flip" });
          break;
        }
        case "hop":
          inputRef.current.jump = true;
          window.setTimeout(() => {
            inputRef.current.jump = false;
          }, 140);
          appendStep({ type: "action", action: "hop", holdMs: 400, label: "Hop" });
          break;
        case "flight":
          inputRef.current.toggle_flight = true;
          window.setTimeout(() => {
            inputRef.current.toggle_flight = false;
          }, 80);
          appendStep({ type: "action", action: "flight", holdMs: 300, label: "Flight" });
          break;
        case "play_pause":
          // handled externally
          break;
        case "record_toggle":
          setRecording((r) => !r);
          break;
        default:
          break;
      }
    },
    [appendStep, showToast],
  );

  const executeBinding = useCallback(
    (binding, phase) => {
      if (!binding) return;
      if (binding.type === "nudge") {
        if (phase !== "tap" && phase !== "down" && phase !== "hold") return;
        const sim = simRef.current;
        const a = sim?.actors[sim.active];
        if (!a) return;
        const step = phase === "hold" ? 0.035 : 0.08;
        a.pos[0] = Math.max(-14, Math.min(14, a.pos[0] + (binding.dx || 0) * step));
        a.pos[2] = Math.max(-14, Math.min(14, a.pos[2] + (binding.dy || 0) * step));
        // zoom via camera plate scale is not per-actor; use vertical for "up" already as z
        if (binding.dZoom) {
          // approximate zoom by moving toward/away from camera (+X toward camera on plate)
          a.pos[0] = Math.max(-14, Math.min(14, a.pos[0] - binding.dZoom * step * 1.2));
        }
        if (phase === "tap" || phase === "down") {
          appendStep({
            type: "action",
            action: "nudge",
            holdMs: 120,
            label: binding.label || "Nudge",
          });
        }
        return;
      }
      if (phase !== "tap" && phase !== "down") return;
      if (binding.type === "clip") {
        playClipOnActor(binding.clipName, binding.actor || "wizardjoe");
        return;
      }
      if (binding.type === "action") {
        if (binding.action === "play_pause") {
          setPlaying((p) => {
            if (p) {
              setPaused((x) => !x);
              return true;
            }
            // start play from outside via effect
            setPaused(false);
            setPlayIdx(0);
            return true;
          });
          return;
        }
        if (binding.action === "record_toggle") {
          setRecording((r) => {
            showToast(r ? "Record off" : "Recording…");
            return !r;
          });
          return;
        }
        runAction(binding.action);
      }
    },
    [appendStep, playClipOnActor, runAction, showToast],
  );

  const onGamepad = useCallback(
    ({ id, phase }) => {
      const b = bindings[id] || DEFAULT_GAMEPAD_BINDINGS[id];
      executeBinding(b, phase === "hold" ? "hold" : phase === "down" ? "down" : "tap");
    },
    [bindings, executeBinding],
  );

  // load assets
  useEffect(() => {
    simRef.current = new WorldSim();
    // lower default homes slightly toward camera for low floor composition
    for (const id of CAST_ORDER) {
      const home = simRef.current.home[id];
      if (home) {
        home[0] = (home[0] || 0) + 0.35;
        simRef.current.actors[id].pos = [...home];
      }
    }
    let cancelled = false;
    (async () => {
      const plate = await fetch("/library/stage/active_plate.json")
        .then((r) => r.json())
        .catch(() => ({}));
      if (cancelled) return;
      // Force low-floor production plate defaults
      plateRef.current = {
        ...plate,
        background: plate.background || "#ffffff",
        camera: {
          ...(plate.camera || {}),
          eye: plate.camera?.eye || [13.5, 3.8, 7.2],
          target: plate.camera?.target || [0, 0.35, 0],
          fov_y_deg: plate.camera?.fov_y_deg || 36,
        },
        bird_draw: {
          ...(plate.bird_draw || {}),
          scale_multiplier: plate.bird_draw?.scale_multiplier ?? 2.15,
          feet_anchor: plate.bird_draw?.feet_anchor ?? 0.96,
          screen_y_offset: plate.bird_draw?.screen_y_offset ?? 28,
        },
      };

      const all = [];
      const clipList = [];
      for (const char of CAST_ORDER) {
        const catj = await fetch(`/library/${char}/catalog.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        for (const p of catj?.cell_library?.poses || []) {
          if (!p.pixelgraph) continue;
          const dir = String(p.pixelgraph).replace(/\/?pixelgraph\.json$/i, "");
          all.push({
            id: p.pose_id,
            name: (p.pose_id || "").split("/").pop() || p.pose_id,
            character: char,
            runtime_id: p.runtime_id,
            preview: `/library/${char}/${dir}/preview.png`,
            runtime: `/library/${char}/${dir}/runtime-960x540.png`,
          });
        }
        for (const [cname, cval] of Object.entries(catj?.clips || {})) {
          const frames = Array.isArray(cval) ? cval : cval?.frames || [];
          if (!frames.length) continue;
          clipList.push({
            name: cname,
            character: char,
            frames,
            looped: cval?.looped !== false,
            hold_ticks: cval?.hold_ticks ?? (cval?.fps ? Math.round(60 / cval.fps) : 6),
            forward_speed: cval?.forward_speed ?? (cname.includes("walk") ? 1.6 : 0),
            translate_toward_camera: cval?.translate_toward_camera ?? cname.includes("walk"),
            label: cval?.label || cname.replace(/_/g, " "),
          });
        }
      }
      if (cancelled) return;
      posesRef.current = all;
      clipsRef.current = clipList;
      setPoses(all);
      setClips(clipList);
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

  // sim + paint loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const acc = { t: 0 };
    const DT = 1 / 60;

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

      // low floor ellipse
      ctx.fillStyle = "rgba(15, 23, 42, 0.07)";
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.88, W * 0.34, H * 0.055, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(W * 0.5, H * 0.88, W * 0.3, H * 0.045, 0, 0, Math.PI * 2);
      ctx.stroke();

      const cast = CAST_ORDER.map((id) => {
        const a = sim.present_actor(sim.actors[id]);
        const pose =
          posesRef.current.find((p) => p.id === a.pose_id && p.character === id) ||
          posesRef.current.find((p) => p.character === id);
        return { ...a, preview: pose?.preview, runtime: pose?.runtime, pose_id: a.pose_id || pose?.id };
      });

      const drawn = cast
        .map((b) => ({ b, pr: projectWorld(b.pos, cam, W, H) }))
        .filter((x) => x.pr)
        .sort((a, b) => b.pr.depth - a.pr.depth);

      for (const { b, pr } of drawn) {
        const active = b.id === sim.active;
        const scale = birdScalePx(pr.depth, plate, H) * (active ? 1.05 : 0.94);
        const url = b.runtime || b.preview;
        const draw = (img) => {
          if (!img) {
            ctx.fillStyle = active ? "rgba(94,234,212,0.55)" : "rgba(100,116,139,0.4)";
            ctx.beginPath();
            ctx.arc(pr.x, pr.y - 16, 12, 0, Math.PI * 2);
            ctx.fill();
            return;
          }
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const feet = plate?.bird_draw?.feet_anchor ?? 0.96;
          const yOff = Number(plate?.bird_draw?.screen_y_offset) || 28;
          let feetY = pr.y + yOff * 0.35;
          let topY = feetY - dh * feet;
          let leftX = pr.x - dw / 2;
          if (topY < 4) {
            const s = 4 - topY;
            topY += s;
            feetY += s;
          }
          ctx.imageSmoothingEnabled = false;
          ctx.globalAlpha = active ? 1 : 0.82;
          if (!b.flight) {
            ctx.fillStyle = "rgba(0,0,0,0.14)";
            ctx.beginPath();
            ctx.ellipse(pr.x, feetY + 2, dw * 0.26, dh * 0.045, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.drawImage(img, leftX, topY, dw, dh);
          ctx.globalAlpha = 1;
          if (active) {
            ctx.strokeStyle = "rgba(94,234,212,0.55)";
            ctx.lineWidth = 1.5;
            ctx.strokeRect(leftX - 2, topY - 2, dw + 4, dh + 4);
          }
        };
        const cached = imgCache.current.get(url);
        if (cached && typeof cached.then === "function") {
          cached.then(draw);
        } else if (url) loadImg(url).then(draw);
        else draw(null);
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc.t += dt;
      while (acc.t >= DT) {
        simRef.current?.step(inputRef.current);
        acc.t -= DT;
      }
      for (const id of CAST_ORDER) {
        const a = simRef.current?.actors[id];
        const pose =
          posesRef.current.find((p) => p.id === a?.pose_override && p.character === id) ||
          posesRef.current.find((p) => p.character === id);
        if (pose) loadImg(pose.runtime || pose.preview);
      }
      paint();
      const sim = simRef.current;
      if (sim) {
        const clipActor = CAST_ORDER.map((id) => sim.actors[id]).find((a) => a?.clip);
        const clipHud = clipActor?.clip
          ? ` · ${clipActor.clip.name} ${clipActor.clip.index + 1}/${clipActor.clip.frames.length}`
          : "";
        const rec = recordRef.current ? " · REC" : "";
        if (sim.active !== activeActor) setActiveActor(sim.active);
        setHud(
          `${CHAR_LABEL[sim.active] || sim.active} · tick ${sim.tick}${clipHud}${rec} · ${sequence.steps.length} steps`,
        );
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loadImg, sequence.steps.length, activeActor]);

  // keyboard
  useEffect(() => {
    const down = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA" || e.target?.tagName === "SELECT") return;
      const k = e.key === " " ? "space" : e.key.toLowerCase();
      if (k === "t") {
        e.preventDefault();
        togglePanel("timeline");
        return;
      }
      if (k === "l") {
        e.preventDefault();
        togglePanel("library");
        return;
      }
      if (k === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        togglePanel("sequences");
        return;
      }
      if (k === "g") {
        e.preventDefault();
        togglePanel("bindings");
        return;
      }
      if (k === "c") {
        e.preventDefault();
        togglePanel("cast");
        return;
      }
      if (k === "?" || (k === "/" && e.shiftKey)) {
        e.preventDefault();
        togglePanel("docs");
        return;
      }
      if (k === "r" && !e.metaKey) {
        e.preventDefault();
        setRecording((x) => {
          showToast(x ? "Record off" : "Recording…");
          return !x;
        });
        return;
      }
      if (k === "p" && !e.metaKey) {
        e.preventDefault();
        setPlaying((p) => {
          if (p) {
            setPaused((z) => !z);
            return true;
          }
          setPaused(false);
          setPlayIdx(0);
          return true;
        });
        return;
      }
      if (k === "v") {
        e.preventDefault();
        setShowPad((v) => !v);
        return;
      }

      const mapKey =
        k === "arrowup"
          ? "up"
          : k === "arrowdown"
            ? "down"
            : k === "arrowleft"
              ? "left"
              : k === "arrowright"
                ? "right"
                : k;
      const binding = bindings[mapKey] || DEFAULT_GAMEPAD_BINDINGS[mapKey];
      if (binding && ["up", "down", "left", "right", "j", "k", "u", "f", "tab", "space", "escape"].includes(mapKey)) {
        e.preventDefault();
        if (mapKey === "escape") {
          runAction("reset");
          return;
        }
        if (mapKey === "tab") {
          runAction("next_actor");
          return;
        }
        if (mapKey === "space" || mapKey === "f") {
          executeBinding(binding, "tap");
          return;
        }
        if (mapKey === "j" || mapKey === "k" || mapKey === "u") {
          executeBinding(binding, "tap");
          return;
        }
        // movement hold via input for walk feel
        const i = inputRef.current;
        if (mapKey === "up" || k === "w") i.move_y = 1;
        if (mapKey === "down" || k === "s") i.move_y = -1;
        if (mapKey === "left" || k === "a") i.move_x = -1;
        if (mapKey === "right" || k === "d") i.move_x = 1;
        if (k === "w") i.move_y = 1;
        if (k === "s") i.move_y = -1;
        if (k === "a") i.move_x = -1;
        if (k === "d") i.move_x = 1;
        if (k === "shift") i.sprint = true;
        if (k === "control") i.precision = true;
        if (k === "m") i.axes_toggle = true;
      }
    };
    const up = (e) => {
      const k = e.key === " " ? "space" : e.key.toLowerCase();
      const i = inputRef.current;
      if (k === "w" || k === "arrowup") i.move_y = i.move_y > 0 ? 0 : i.move_y;
      if (k === "s" || k === "arrowdown") i.move_y = i.move_y < 0 ? 0 : i.move_y;
      if (k === "a" || k === "arrowleft") i.move_x = i.move_x < 0 ? 0 : i.move_x;
      if (k === "d" || k === "arrowright") i.move_x = i.move_x > 0 ? 0 : i.move_x;
      if (k === "shift") i.sprint = false;
      if (k === "control") i.precision = false;
      if (k === "m") i.axes_toggle = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [bindings, executeBinding, runAction, showToast, togglePanel]);

  // sequence playback engine
  useEffect(() => {
    if (!playing || paused) return undefined;
    const steps = sequence.steps;
    if (!steps.length) {
      setPlaying(false);
      setPlayIdx(-1);
      return undefined;
    }
    let idx = playIdx < 0 ? 0 : playIdx;
    let cancelled = false;

    const runStep = () => {
      if (cancelled) return;
      if (idx >= steps.length) {
        setPlaying(false);
        setPlayIdx(-1);
        showToast("Sequence complete");
        return;
      }
      setPlayIdx(idx);
      const step = steps[idx];
      const sim = simRef.current;
      if (sim && step.actor && sim.actors[step.actor]) sim.active = step.actor;

      if (step.type === "pose" && step.poseId) {
        const pose = posesRef.current.find((p) => p.id === step.poseId);
        if (pose) {
          const aid = step.actor || pose.character;
          if (sim?.actors[aid]) {
            sim.active = aid;
            sim.actors[aid].clip = null;
            sim.actors[aid].pose_override = pose.id;
          }
          setActivePoseId(pose.id);
        }
      } else if (step.type === "clip" && step.clipName) {
        playClipOnActor(step.clipName, step.actor || "wizardjoe");
      } else if (step.type === "action" && step.action) {
        // don't re-append while playing
        const was = recordRef.current;
        recordRef.current = false;
        runAction(step.action);
        recordRef.current = was;
      }

      const hold = Math.max(80, Number(step.holdMs) || 320);
      playTimer.current = window.setTimeout(() => {
        idx += 1;
        runStep();
      }, hold);
    };

    runStep();
    return () => {
      cancelled = true;
      if (playTimer.current) window.clearTimeout(playTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, paused]);

  const filteredPoses = useMemo(() => {
    const actor = activeActor || "dragon";
    const q = filter.trim().toLowerCase();
    return poses.filter((p) => {
      if (p.character !== actor) return false;
      if (!q) return true;
      return `${p.id} ${p.name} ${p.runtime_id}`.toLowerCase().includes(q);
    });
  }, [poses, filter, activeActor]);

  const saveCurrent = () => {
    const name = sequence.name?.trim() || "Untitled sequence";
    const saved = upsertSequence({ ...sequence, name });
    setSequence(saved);
    setLibrary(loadSequences());
    showToast(`Saved “${saved.name}”`);
  };

  const dur = sequenceDurationMs(sequence);

  return (
    <div className="ps-root">
      <header className="ps-topbar">
        <div className="ps-brand">
          <strong>
            <Link to="/">Production Studio</Link>
          </strong>
          <span>Animate · sequence · save · replay</span>
        </div>

        <div className="ps-cast-pills" aria-label="Cast">
          {CAST_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={`ps-pill${activeActor === id ? " is-active" : ""}${recording ? " is-rec" : ""}`}
              onClick={() => {
                if (simRef.current) simRef.current.active = id;
                setActiveActor(id);
                showToast(CHAR_LABEL[id] || id);
              }}
            >
              {CHAR_TAG[id]}
            </button>
          ))}
        </div>

        <div className="ps-transport">
          <button
            type="button"
            className={`ps-icon${recording ? " is-rec" : ""}`}
            title="Record (R)"
            onClick={() =>
              setRecording((r) => {
                showToast(r ? "Record off" : "Recording…");
                return !r;
              })
            }
          >
            ●
          </button>
          <button
            type="button"
            className={`ps-icon${playing && !paused ? " is-play" : ""}`}
            title="Play / pause (P)"
            onClick={() => {
              if (!sequence.steps.length) {
                showToast("No steps to play", "err");
                return;
              }
              if (playing) setPaused((p) => !p);
              else {
                setPaused(false);
                setPlayIdx(0);
                setPlaying(true);
              }
            }}
          >
            {playing && !paused ? "❚❚" : "▶"}
          </button>
          <button
            type="button"
            className="ps-icon"
            title="Stop"
            onClick={() => {
              setPlaying(false);
              setPaused(false);
              setPlayIdx(-1);
              simRef.current?.stop_clip(null, { snap_home: false });
            }}
          >
            ■
          </button>
          <button type="button" className="ps-icon ps-icon-wide" title="Save sequence" onClick={saveCurrent}>
            Save
          </button>
          <button
            type="button"
            className="ps-icon ps-icon-wide"
            title="New sequence"
            onClick={() => {
              setSequence(EMPTY_SEQ());
              setPlaying(false);
              setPlayIdx(-1);
              showToast("New sequence");
            }}
          >
            New
          </button>
        </div>

        <div className="ps-rail" aria-label="Panels">
          {[
            ["library", "Lib", "L"],
            ["timeline", "Time", "T"],
            ["sequences", "Seq", "S"],
            ["bindings", "Pad", "G"],
            ["cast", "Cast", "C"],
            ["docs", "?", "?"],
          ].map(([id, label, key]) => (
            <button
              key={id}
              type="button"
              className={`ps-icon ps-icon-wide${panels[id] ? " is-on" : ""}`}
              title={`${label} (${key})`}
              onClick={() => togglePanel(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`ps-icon ps-icon-wide${showPad ? " is-on" : ""}`}
            title="Toggle gamepad (V)"
            onClick={() => setShowPad((v) => !v)}
          >
            Pad
          </button>
          <Link className="ps-icon ps-icon-wide" to="/joe/alpha-hd" title="Classic Joe studio">
            Joe
          </Link>
        </div>
      </header>

      <div className="ps-stage-wrap">
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          tabIndex={0}
          aria-label="Production stage"
        />
      </div>

      <div className="ps-status">
        <strong>{recording ? "REC" : playing ? (paused ? "PAUSE" : "PLAY") : "LIVE"}</strong>
        {" · "}
        {hud}
        {dur ? ` · ${(dur / 1000).toFixed(1)}s` : ""}
      </div>

      <div className={`ps-pad-float${showPad ? "" : " is-hidden"}`}>
        <GamepadPad
          onAction={onGamepad}
          labels={Object.fromEntries(
            BINDABLE_BUTTONS.map((k) => [k, bindings[k]?.label || DEFAULT_GAMEPAD_BINDINGS[k]?.label || k]),
          )}
        />
      </div>

      {/* Library */}
      {panels.library ? (
        <aside className="ps-drawer is-left" aria-label="Pose library">
          <div className="ps-drawer-head">
            <h2>Library · {CHAR_LABEL[activeActor] || "actor"}</h2>
            <button type="button" className="ps-icon" onClick={() => togglePanel("library")}>
              ✕
            </button>
          </div>
          <div className="ps-drawer-body">
            <input
              className="ps-filter"
              placeholder="Filter poses…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="ps-pose-grid">
              {filteredPoses.map((p) => (
                <button
                  key={`${p.character}-${p.id}`}
                  type="button"
                  className={`ps-pose-card${activePoseId === p.id ? " is-active" : ""}`}
                  onClick={() => holdPose(p)}
                  title={p.id}
                >
                  <img src={p.preview || p.runtime} alt="" loading="lazy" />
                  <span>
                    [{CHAR_TAG[p.character]}] {shortName(p)}
                  </span>
                </button>
              ))}
            </div>
            {!filteredPoses.length ? <p className="ps-empty">No poses for this actor / filter.</p> : null}
            {clips.length ? (
              <>
                <h2 style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8b95a8", marginTop: 16 }}>
                  Clips
                </h2>
                <div className="ps-seq-actions" style={{ marginTop: 8 }}>
                  {clips.map((c) => (
                    <button
                      key={`${c.character}-${c.name}`}
                      type="button"
                      className="ps-btn"
                      onClick={() => playClipOnActor(c.name, c.character)}
                    >
                      [{CHAR_TAG[c.character]}] {c.label || c.name}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </aside>
      ) : null}

      {/* Timeline */}
      {panels.timeline ? (
        <aside className="ps-drawer is-bottom" aria-label="Timeline">
          <div className="ps-drawer-head">
            <h2>Timeline · {sequence.name}</h2>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                value={sequence.name}
                onChange={(e) => setSequence((s) => ({ ...s, name: e.target.value }))}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "#e8edf6",
                  borderRadius: 8,
                  padding: "6px 10px",
                  font: "600 12px DM Sans, sans-serif",
                  width: 180,
                }}
              />
              <button type="button" className="ps-icon" onClick={() => togglePanel("timeline")}>
                ✕
              </button>
            </div>
          </div>
          <div className="ps-drawer-body">
            {!sequence.steps.length ? (
              <p className="ps-empty">
                Arm <strong>Record</strong>, then pick poses, play clips, or press gamepad buttons. Each action becomes a step.
              </p>
            ) : (
              <div className="ps-timeline-list">
                {sequence.steps.map((step, i) => (
                  <div key={step.id || i} className={`ps-step${playIdx === i ? " is-current" : ""}`}>
                    <span className="ps-step-idx">{String(i + 1).padStart(2, "0")}</span>
                    <span className="ps-step-label">{stepLabel(step)}</span>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      value={step.holdMs}
                      onChange={(e) => {
                        const holdMs = Number(e.target.value) || 0;
                        setSequence((s) => ({
                          ...s,
                          steps: s.steps.map((st, j) => (j === i ? { ...st, holdMs } : st)),
                        }));
                      }}
                      title="Hold ms"
                    />
                    <button
                      type="button"
                      title="Move up"
                      onClick={() =>
                        setSequence((s) => {
                          if (i === 0) return s;
                          const steps = [...s.steps];
                          [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                          return { ...s, steps };
                        })
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() =>
                        setSequence((s) => ({
                          ...s,
                          steps: s.steps.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : null}

      {/* Sequences library */}
      {panels.sequences ? (
        <aside className="ps-drawer is-left" aria-label="Saved sequences">
          <div className="ps-drawer-head">
            <h2>Sequences</h2>
            <button type="button" className="ps-icon" onClick={() => togglePanel("sequences")}>
              ✕
            </button>
          </div>
          <div className="ps-drawer-body">
            <div className="ps-seq-actions" style={{ marginBottom: 12 }}>
              <button type="button" className="ps-btn is-primary" onClick={saveCurrent}>
                Save current
              </button>
              <label className="ps-btn">
                Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const text = await f.text();
                      const seq = importSequenceJson(text);
                      setSequence(seq);
                      setLibrary(loadSequences());
                      showToast(`Imported ${seq.name}`);
                    } catch (err) {
                      showToast(String(err.message || err), "err");
                    }
                  }}
                />
              </label>
            </div>
            {!library.length ? (
              <p className="ps-empty">No saved sequences yet.</p>
            ) : (
              library.map((seq) => (
                <div key={seq.id} className="ps-seq-row">
                  <strong>{seq.name}</strong>
                  <span>
                    {seq.steps?.length || 0} steps · {(sequenceDurationMs(seq) / 1000).toFixed(1)}s ·{" "}
                    {new Date(seq.updatedAt).toLocaleString()}
                  </span>
                  <div className="ps-seq-actions">
                    <button
                      type="button"
                      className="ps-btn is-primary"
                      onClick={() => {
                        setSequence(seq);
                        setPlayIdx(0);
                        setPaused(false);
                        setPlaying(true);
                      }}
                    >
                      Play
                    </button>
                    <button type="button" className="ps-btn" onClick={() => setSequence(seq)}>
                      Load
                    </button>
                    <button
                      type="button"
                      className="ps-btn"
                      onClick={() => {
                        const blob = new Blob([exportSequenceJson(seq)], { type: "application/json" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `${seq.name.replace(/\s+/g, "_") || "sequence"}.json`;
                        a.click();
                      }}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className="ps-btn is-danger"
                      onClick={() => {
                        setLibrary(deleteSequence(seq.id));
                        showToast("Deleted");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}

      {/* Bindings */}
      {panels.bindings ? (
        <aside className="ps-drawer is-right" aria-label="Gamepad bindings">
          <div className="ps-drawer-head">
            <h2>Gamepad map</h2>
            <button type="button" className="ps-icon" onClick={() => togglePanel("bindings")}>
              ✕
            </button>
          </div>
          <div className="ps-drawer-body">
            <p className="ps-empty" style={{ marginTop: 0 }}>
              Every control queues a real action. While recording, presses also append timeline steps.
            </p>
            {BINDABLE_BUTTONS.map((key) => (
              <div key={key} className="ps-bind-row">
                <span className="ps-bind-key">{key}</span>
                <select
                  value={bindingToSelectValue(bindings[key])}
                  onChange={(e) => {
                    const next = { ...bindings, [key]: selectValueToBinding(e.target.value) };
                    setBindings(next);
                  }}
                >
                  {BIND_ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="ps-seq-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="ps-btn is-primary"
                onClick={() => {
                  saveBindings(bindings);
                  showToast("Bindings saved");
                }}
              >
                Save bindings
              </button>
              <button
                type="button"
                className="ps-btn"
                onClick={() => {
                  setBindings(resetBindings());
                  showToast("Bindings reset");
                }}
              >
                Reset defaults
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Cast */}
      {panels.cast ? (
        <aside className="ps-drawer is-right" aria-label="Cast">
          <div className="ps-drawer-head">
            <h2>Cast</h2>
            <button type="button" className="ps-icon" onClick={() => togglePanel("cast")}>
              ✕
            </button>
          </div>
          <div className="ps-drawer-body">
            {CAST_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`ps-btn${activeActor === id ? " is-primary" : ""}`}
                style={{ width: "100%", marginBottom: 8, textAlign: "left" }}
                onClick={() => {
                  if (simRef.current) simRef.current.active = id;
                  setActiveActor(id);
                  showToast(CHAR_LABEL[id] || id);
                }}
              >
                [{CHAR_TAG[id]}] {CHAR_LABEL[id] || id}
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {/* Docs */}
      {panels.docs ? (
        <aside className="ps-drawer is-right" aria-label="Control docs">
          <div className="ps-drawer-head">
            <h2>Controls</h2>
            <button type="button" className="ps-icon" onClick={() => togglePanel("docs")}>
              ✕
            </button>
          </div>
          <div className="ps-drawer-body">
            {CONTROL_SURFACES.map((s) => (
              <div key={s.id} className="ps-doc-block">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
            <div className="ps-doc-block">
              <h3>Keyboard</h3>
              <table className="ps-doc-table">
                <tbody>
                  {KEYBOARD_CHEATSHEET.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ps-doc-block">
              <h3>Gamepad defaults</h3>
              <table className="ps-doc-table">
                <tbody>
                  {GAMEPAD_DEFAULTS_DOC.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      ) : null}

      {toast ? <div className={`ps-toast ${toast.kind}`}>{toast.msg}</div> : null}
    </div>
  );
}
