import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHOREO_SCRIPT_120,
  CHOREO_SCRIPT_DURATION_S,
  CHOREO_SCRIPT_EVAL_WINDOW_S,
  CHOREO_SCRIPT_VERSION,
  cueAtTime,
} from "./script120.js";
import {
  actionFromInput,
  createLocomotionState,
  normalizeInput,
  stepLocomotion,
} from "./locomotionController.js";
import {
  buildManifest,
  createTelemetryBuffer,
  downloadText,
  recordRenderFrame,
  telemetryToCsv,
} from "./telemetry.js";
import "./ChoreographyHarness.css";

const STORAGE_KEY = "characterStudio.choreoHarness.v2";

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writePrefs(p) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/**
 * Reusable choreography harness controls for Character Studio.
 *
 * Drives Wizard Joe via callbacks (action / world / stage) using the
 * versioned 120s script + unified locomotion controller, and records
 * every-4th-frame telemetry CSV for later analysis rounds.
 *
 * @param {{
 *   onDrive?: (cmd: {
 *     running: boolean,
 *     action: string,
 *     forceClip: string,
 *     stage: string,
 *     world: object,
 *     paused: boolean,
 *     speed: number,
 *   }) => void,
 *   onFrame?: (frame: object) => void,
 *   className?: string,
 *   defaultOpen?: boolean,
 * }} props
 */
export function ChoreographyHarness({
  onDrive,
  onFrame,
  className = "",
  defaultOpen = false,
}) {
  const prefs = useMemo(() => readPrefs(), []);
  const [open, setOpen] = useState(defaultOpen || Boolean(prefs.open));
  const [roundId, setRoundId] = useState(prefs.roundId || "round-01");
  const [seed, setSeed] = useState(Number(prefs.seed) || 41);
  const [sampleEvery, setSampleEvery] = useState(Number(prefs.sampleEvery) || 4);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [status, setStatus] = useState("idle");
  const [sampleCount, setSampleCount] = useState(0);
  const [liveFacing, setLiveFacing] = useState("right");
  const [liveAction, setLiveAction] = useState("idle");

  const locoRef = useRef(createLocomotionState(seed));
  const bufferRef = useRef(null);
  const runIdRef = useRef("");
  const startPerfRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastUiPulseRef = useRef(0);
  const elapsedRef = useRef(0);
  const keysRef = useRef(Object.create(null));
  const manualOverrideRef = useRef(false);
  const frameHandlerRef = useRef(null);
  const onDriveRef = useRef(onDrive);
  const onFramePropRef = useRef(onFrame);
  const runningRef = useRef(running);

  useEffect(() => {
    onDriveRef.current = onDrive;
  }, [onDrive]);
  useEffect(() => {
    onFramePropRef.current = onFrame;
  }, [onFrame]);
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    writePrefs({ open, roundId, seed, sampleEvery });
  }, [open, roundId, seed, sampleEvery]);

  const stop = useCallback(() => {
    setRunning(false);
    setStatus("stopped");
    manualOverrideRef.current = false;
    onDriveRef.current?.({
      running: false,
      action: "idle",
      forceClip: "",
      stage: "idle",
      world: {
        x: locoRef.current.x,
        y: locoRef.current.y,
        flipX: locoRef.current.flipX,
        zoom: 1,
      },
      paused: false,
      speed: 1,
    });
  }, []);

  const start = useCallback(() => {
    const runId = `cw-${roundId}-${seed}-${Date.now()}`;
    runIdRef.current = runId;
    locoRef.current = createLocomotionState(seed);
    bufferRef.current = createTelemetryBuffer({
      runId,
      roundId,
      seed,
      sampleEvery,
    });
    startPerfRef.current = performance.now();
    lastTickRef.current = startPerfRef.current;
    lastUiPulseRef.current = 0;
    elapsedRef.current = 0;
    setSampleCount(0);
    setElapsedSec(0);
    setLiveFacing("right");
    setLiveAction("idle");
    setRunning(true);
    setStatus("running");
    manualOverrideRef.current = false;
  }, [roundId, seed, sampleEvery]);

  // Script + locomotion tick — deps only [running] so parent re-renders cannot starve RAF
  useEffect(() => {
    if (!running) return undefined;
    let raf = 0;
    let alive = true;
    const tick = (now) => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const elapsed = (now - startPerfRef.current) / 1000;
      elapsedRef.current = elapsed;

      if (elapsed >= CHOREO_SCRIPT_DURATION_S) {
        setRunning(false);
        setStatus("complete");
        return;
      }

      const dt = Math.min(0.05, Math.max(0, (now - lastTickRef.current) / 1000));
      lastTickRef.current = now;
      if (dt <= 0) return;

      const cue = cueAtTime(elapsed, CHOREO_SCRIPT_120);
      let inputX = cue.inputX ?? 0;
      let inputY = cue.inputY ?? 0;
      let action = cue.action || "idle";
      let policy = cue.policy || "normal";
      let forceClip = cue.forceClip != null ? cue.forceClip : action;

      // Live keyboard overrides while harness is running (held keys)
      const keys = keysRef.current;
      if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown) {
        manualOverrideRef.current = true;
        let kx = 0;
        let ky = 0;
        if (keys.ArrowLeft) kx -= 1;
        if (keys.ArrowRight) kx += 1;
        if (keys.ArrowUp) ky -= 1;
        if (keys.ArrowDown) ky += 1;
        const norm = normalizeInput(kx, ky);
        inputX = norm.x;
        inputY = norm.y;
        action = actionFromInput(norm, {
          shift: Boolean(keys.Shift),
          fly: Boolean(keys.f || keys.F),
        });
        // Map synthetic gaits onto clips the Alpha HD pack actually serves
        forceClip =
          action === "sprint" ? "run" : action === "hop" || action === "land" ? "jump" : action;
        policy = "normal";
      }

      stepLocomotion(locoRef.current, {
        dtSec: dt,
        inputX,
        inputY,
        action,
        policy,
      });

      const loco = locoRef.current;
      const driveCmd = {
        running: true,
        action,
        forceClip: forceClip === "idle" ? "" : forceClip,
        stage: cue.stage || (action === "speak" ? "speaking" : "ready"),
        world: {
          x: loco.x,
          y: loco.y,
          flipX: loco.flipX,
          zoom: action === "fly_forward" || action === "fly" ? 0.95 : 1.05,
          bob: action === "fly_forward" || action === "fly" ? 0.08 : 0.18,
          sway: 0.1,
        },
        paused: false,
        speed: cue.speed || 1,
        cue,
        input: { x: loco.inputX, y: loco.inputY, magnitude: loco.inputMagnitude },
        controlSource: manualOverrideRef.current ? "keyboard+script" : "script",
        notes: cue.note || "",
      };
      // Drive every frame so world pan stays smooth
      onDriveRef.current?.(driveCmd);

      // Throttle React status UI to ~8 Hz (avoids starving the integrator)
      if (now - lastUiPulseRef.current > 120) {
        lastUiPulseRef.current = now;
        setElapsedSec(elapsed);
        setLiveFacing(loco.facing);
        setLiveAction(loco.action);
        if (typeof window !== "undefined") {
          window.__cwChoreoDebug = {
            elapsed,
            x: loco.x,
            y: loco.y,
            facing: loco.facing,
            flipX: loco.flipX,
            action: loco.action,
            inputX: loco.inputX,
            inputY: loco.inputY,
            vx: loco.vx,
            vy: loco.vy,
            note: cue.note,
            round: cue.round,
            script: CHOREO_SCRIPT_VERSION,
          };
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [running]);

  // Keyboard held-state (not one-shot nudges)
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)) return;
      keysRef.current[e.key] = true;
      if (e.key === " " && running) {
        e.preventDefault();
        stop();
      }
    };
    const up = (e) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [open, running, stop]);

  // Frame telemetry from WizardJoeStage
  const handleStageFrame = useCallback((frame) => {
    onFramePropRef.current?.(frame);
    if (!runningRef.current || !bufferRef.current) return;
    const loco = locoRef.current;
    const cue = cueAtTime(elapsedRef.current, CHOREO_SCRIPT_120);
    const sampled = recordRenderFrame(bufferRef.current, {
      ...frame,
      world_x: loco.x,
      world_y: loco.y,
      world: {
        x: loco.x,
        y: loco.y,
        flipX: loco.flipX,
        zoom: 1.05,
      },
      flipX: loco.flipX,
      action: loco.action,
      clip_id: frame.clipName,
      pose_id: frame.poseId || frame.pose?.id,
      animation_frame_index: frame.frameIndex,
      animation_frame_count: frame.total,
      control_source: manualOverrideRef.current ? "keyboard+script" : "script",
      input_x: loco.inputX,
      input_y: loco.inputY,
      input_magnitude: loco.inputMagnitude,
      notes: cue.note || "",
      movement_phase: cue.round || "",
      viewport_width_px: frame.canvasWidth,
      viewport_height_px: frame.canvasHeight,
    });
    if (sampled) setSampleCount(bufferRef.current.samples.length);
  }, []);

  // Expose frame handler to parent via ref callback pattern
  useEffect(() => {
    frameHandlerRef.current = handleStageFrame;
  }, [handleStageFrame]);

  // Parent passes this as onFrame to WizardJoeStage
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__cwChoreoOnFrame = handleStageFrame;
    return () => {
      if (window.__cwChoreoOnFrame === handleStageFrame) {
        delete window.__cwChoreoOnFrame;
      }
    };
  }, [handleStageFrame]);

  const exportCsv = () => {
    const buf = bufferRef.current;
    if (!buf?.samples?.length) {
      setStatus("no samples yet — run the script first");
      return;
    }
    const csv = telemetryToCsv(buf);
    downloadText(`${buf.runId}-samples.csv`, csv, "text/csv");
    const manifest = buildManifest(buf, {
      scriptVersion: CHOREO_SCRIPT_VERSION,
      scriptDurationS: CHOREO_SCRIPT_DURATION_S,
      location: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    });
    downloadText(`${buf.runId}-manifest.json`, JSON.stringify(manifest, null, 2), "application/json");
    setStatus(`exported ${buf.samples.length} samples`);
  };

  const progress = Math.min(100, (elapsedSec / CHOREO_SCRIPT_DURATION_S) * 100);

  return (
    <div className={`cw-choreo ${open ? "is-open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="cw-choreo-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-testid="choreo-harness-toggle"
      >
        Choreography harness
      </button>

      {open ? (
        <div className="cw-choreo-panel" data-testid="choreo-harness-panel">
          <header className="cw-choreo-head">
            <strong>Bird choreography + telemetry</strong>
            <span className="cw-choreo-meta">
              {CHOREO_SCRIPT_VERSION} · eval {CHOREO_SCRIPT_EVAL_WINDOW_S}s · sample 1/{sampleEvery}
            </span>
          </header>

          <div className="cw-choreo-grid">
            <label>
              Round
              <select value={roundId} onChange={(e) => setRoundId(e.target.value)} disabled={running}>
                <option value="round-01">round-01 baseline</option>
                <option value="round-02">round-02 facing</option>
                <option value="round-03">round-03 flight</option>
                <option value="round-04">round-04 acceptance</option>
                <option value="round-04b">round-04b re-run</option>
                <option value="round-local">round-local</option>
              </select>
            </label>
            <label>
              Seed
              <input
                type="number"
                value={seed}
                disabled={running}
                onChange={(e) => setSeed(Number(e.target.value) || 1)}
              />
            </label>
            <label>
              Sample every N frames
              <input
                type="number"
                min={1}
                max={30}
                value={sampleEvery}
                disabled={running}
                onChange={(e) => setSampleEvery(Math.max(1, Number(e.target.value) || 4))}
              />
            </label>
          </div>

          <div className="cw-choreo-progress" aria-hidden="true">
            <div className="cw-choreo-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <p className="cw-choreo-status">
            {status}
            {" · "}
            {elapsedSec.toFixed(1)}s / {CHOREO_SCRIPT_DURATION_S}s
            {" · "}
            samples {sampleCount}
            {" · "}
            {liveAction} · face {liveFacing}
          </p>

          <div className="cw-choreo-actions">
            {!running ? (
              <button type="button" className="cw-choreo-btn primary" onClick={start} data-testid="choreo-start">
                Run 120s script
              </button>
            ) : (
              <button type="button" className="cw-choreo-btn danger" onClick={stop} data-testid="choreo-stop">
                Stop
              </button>
            )}
            <button
              type="button"
              className="cw-choreo-btn"
              onClick={exportCsv}
              disabled={!sampleCount}
              data-testid="choreo-export"
            >
              Export CSV + manifest
            </button>
          </div>

          <p className="cw-choreo-help">
            Bird program: 0–18s ground, 18–36s facing, 36–60s flight, 60–120s acceptance. Hold
            arrows to override (F = fly). Space stops. Export CSV + manifest under{" "}
            <code>artifacts/choreography/</code>. Closed panel does not drive the stage.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Stable onFrame bridge for WizardJoeStage when harness is mounted. */
export function useChoreographyFrameBridge() {
  return useCallback((frame) => {
    if (typeof window !== "undefined" && typeof window.__cwChoreoOnFrame === "function") {
      window.__cwChoreoOnFrame(frame);
    }
  }, []);
}
