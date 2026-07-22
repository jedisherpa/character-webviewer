import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  directWizardJoeClip,
  poseById,
  resolveClipFrames,
} from "./wizardJoeDirector.js";
import { clampWorld, worldDrawRect } from "./wizardJoeWorldSpace.js";
import "./WizardJoeStage.css";

const DEFAULT_LIBRARY_URL = "/wizard-joe/library.json";

/**
 * Wizard Joe stage with Robin-style world-space placement:
 * pan, zoom, spin, tilt, flip, bob/sway — drag to pan, wheel to zoom.
 */
export function WizardJoeStage({
  stage = "idle",
  status = "active",
  ranting = false,
  dancing = false,
  action = "",
  forceClip = "",
  forcePoseId = "",
  speed = 1,
  paused = false,
  libraryUrl = DEFAULT_LIBRARY_URL,
  world = null,
  onWorldChange = null,
  className = "",
  onFrame = null,
}) {
  const [library, setLibrary] = useState(null);
  const [error, setError] = useState("");
  const [frameIndex, setFrameIndex] = useState(0);
  const canvasRef = useRef(null);
  const imageCache = useRef(new Map());
  const timerRef = useRef(0);
  const rafRef = useRef(0);
  const worldRef = useRef(clampWorld(world || {}));
  const poseRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    worldRef.current = clampWorld(world || {});
  }, [world]);

  useEffect(() => {
    let cancelled = false;
    setLibrary(null);
    setError("");
    setFrameIndex(0);
    imageCache.current = new Map();
    fetch(libraryUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`library ${r.status}`);
        return r.json();
      })
      .then((lib) => {
        if (!cancelled) setLibrary(lib);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err.message || err));
      });
    return () => {
      cancelled = true;
    };
  }, [libraryUrl]);

  const clipName = useMemo(
    () =>
      directWizardJoeClip({
        stage,
        status,
        ranting,
        dancing,
        action,
        forceClip: forceClip || undefined,
      }),
    [stage, status, ranting, dancing, action, forceClip],
  );

  const effectiveSpeed = Math.max(
    0.25,
    Math.min(4, (Number(speed) || 1) * (Number(world?.speed) || 1)),
  );

  const { frames, durationsMs, loop, totalMs, kind } = useMemo(
    () => resolveClipFrames(library, clipName, effectiveSpeed),
    [library, clipName, effectiveSpeed],
  );

  useEffect(() => {
    setFrameIndex(0);
  }, [clipName, frames.join("|"), forcePoseId]);

  useEffect(() => {
    if (forcePoseId) return undefined;
    if (paused) return undefined;
    if (frames.length <= 1) return undefined;
    if (!loop && frameIndex >= frames.length - 1) return undefined;

    const ms = Math.max(50, durationsMs[frameIndex] || durationsMs[0] || 200);
    timerRef.current = window.setTimeout(() => {
      setFrameIndex((i) => {
        const next = i + 1;
        if (next >= frames.length) return loop ? 0 : i;
        return next;
      });
    }, ms);

    return () => window.clearTimeout(timerRef.current);
  }, [frames, durationsMs, loop, paused, forcePoseId, frameIndex]);

  const poseId =
    forcePoseId || frames[frameIndex] || frames[0] || library?.defaults?.idle;
  const pose = poseById(library, poseId);
  poseRef.current = pose;

  useEffect(() => {
    if (typeof onFrame !== "function") return;
    const canvas = canvasRef.current;
    const w = worldRef.current;
    let rect = null;
    try {
      if (canvas && pose?.frame) {
        const img = imageCache.current.get(pose.frame);
        if (img?.complete) {
          rect = worldDrawRect(
            canvas.width,
            canvas.height,
            img.width,
            img.height,
            w,
            0,
          );
        }
      }
    } catch {
      rect = null;
    }
    onFrame({
      clipName,
      frameIndex,
      pose,
      poseId: pose?.id || forcePoseId || "",
      total: frames.length,
      totalMs,
      kind,
      world: { ...w },
      flipX: Boolean(w?.flipX),
      canvasWidth: canvas?.width || 0,
      canvasHeight: canvas?.height || 0,
      drawRect: rect
        ? {
            left: rect.dx,
            top: rect.dy,
            width: rect.dw,
            height: rect.dh,
            feetX: rect.dx + rect.dw / 2,
            feetY: rect.dy + rect.dh * 0.92,
            centroidX: rect.dx + rect.dw / 2,
            centroidY: rect.dy + rect.dh * 0.5,
          }
        : null,
      timeMs: performance.now(),
    });
  }, [onFrame, clipName, frameIndex, pose, frames.length, totalMs, kind, forcePoseId, world]);

  const paint = useCallback((img, timeSec = 0) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const w = worldRef.current;
    const rect = worldDrawRect(cw, ch, img.width, img.height, w, timeSec);

    const cx = rect.dx + rect.dw / 2;
    const cy = rect.dy + rect.dh * 0.92;

    // Barely-visible walk floor under feet (tracks world position)
    const floorRx = Math.max(rect.dw * 0.48, cw * 0.12);
    const floorRy = Math.max(rect.dw * 0.1, ch * 0.018);
    ctx.save();
    ctx.translate(cx, cy + rect.dh * 0.02);
    ctx.scale(1, floorRy / floorRx);
    const floor = ctx.createRadialGradient(0, 0, floorRx * 0.08, 0, 0, floorRx);
    floor.addColorStop(0, "rgba(15, 23, 42, 0.07)");
    floor.addColorStop(0.45, "rgba(15, 23, 42, 0.035)");
    floor.addColorStop(0.78, "rgba(15, 23, 42, 0.012)");
    floor.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = floor;
    ctx.beginPath();
    ctx.arc(0, 0, floorRx, 0, Math.PI * 2);
    ctx.fill();
    // hairline rim so the plane reads as a floor, not only a shadow
    ctx.strokeStyle = "rgba(15, 23, 42, 0.06)";
    ctx.lineWidth = Math.max(1, cw * 0.0012) * (floorRx / floorRy);
    ctx.beginPath();
    ctx.arc(0, 0, floorRx * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(cx, cy);
    ctx.rotate(((rect.rotationDeg || 0) * Math.PI) / 180);
    // mild perspective tilt as vertical scale
    const tiltScale = 1 - Math.abs(rect.tiltDeg || 0) * 0.004;
    ctx.scale(rect.flipX ? -1 : 1, tiltScale);
    ctx.translate(-rect.dw / 2, -rect.dh * 0.92);
    ctx.drawImage(img, 0, 0, rect.dw, rect.dh);
    ctx.restore();
  }, []);

  // Continuous bob/sway + paint loop
  useEffect(() => {
    let cancelled = false;
    const start = performance.now();
    const tick = (now) => {
      if (cancelled) return;
      const url = poseRef.current?.frame;
      if (url) {
        const img = imageCache.current.get(url);
        if (img?.complete) {
          paint(img, (now - start) / 1000);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [paint, pose?.frame, world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pose?.frame) return undefined;
    let cancelled = false;
    const url = pose.frame;
    const cached = imageCache.current.get(url);
    if (cached?.complete) {
      paint(cached, 0);
      return undefined;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      imageCache.current.set(url, img);
      if (!cancelled) paint(img, 0);
    };
    img.onerror = () => {
      if (!cancelled) setError(`frame missing: ${url}`);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [pose?.frame, pose?.id, paint]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const parent = canvas.parentElement;
    if (!parent) return undefined;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(280, Math.floor(rect.height));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      const url = poseRef.current?.frame;
      const img = url && imageCache.current.get(url);
      if (img?.complete) paint(img, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [paint]);

  // Drag to pan
  const onPointerDown = (e) => {
    if (!onWorldChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...worldRef.current },
      w: rect.width,
      h: rect.height,
    };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current || !onWorldChange) return;
    const d = dragRef.current;
    const dx = (e.clientX - d.startX) / d.w;
    const dy = (e.clientY - d.startY) / d.h;
    onWorldChange(
      clampWorld({
        ...d.origin,
        x: d.origin.x + dx,
        y: d.origin.y + dy,
      }),
    );
  };

  const onPointerUp = (e) => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    dragRef.current = null;
  };

  // Non-passive wheel so we can prevent page scroll while zooming
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onWorldChange) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      onWorldChange(
        clampWorld({
          ...worldRef.current,
          zoom: worldRef.current.zoom + delta,
        }),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWorldChange]);

  const progress =
    frames.length > 1
      ? `${frameIndex + 1}/${frames.length}`
      : forcePoseId
        ? "hold"
        : "1/1";

  return (
    <div className={`wizard-joe-stage ${className}`.trim()}>
      <div className="wizard-joe-stage-floor" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="wizard-joe-stage-canvas"
        aria-label="Wizard Joe stage — drag to pan, scroll to zoom"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {error ? (
        <p className="wizard-joe-stage-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="wizard-joe-stage-meta" aria-hidden="true">
        <span>{forcePoseId ? "pose" : clipName}</span>
        <span>{progress}</span>
        {pose ? (
          <span>
            #{pose.runtimeId ?? "?"} {pose.name?.slice(0, 28)}
          </span>
        ) : null}
        {world?.zoom != null ? <span>×{Number(world.zoom).toFixed(2)}</span> : null}
        {paused ? <span>paused</span> : null}
      </div>
      <div className="wizard-joe-stage-hint" aria-hidden="true">
        drag pan · scroll zoom
      </div>
    </div>
  );
}
