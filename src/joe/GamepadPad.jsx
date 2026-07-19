import React, { useCallback, useRef, useState } from "react";
import "./GamepadPad.css";

/**
 * On-screen dualsense-style pad — every face / d-pad / shoulder is mouse/touch clickable.
 * Hold-capable buttons fire onPress while held; pulse buttons fire onTap.
 */
export function GamepadPad({
  className = "",
  compact = false,
  onAction,
  labels = {},
}) {
  const [down, setDown] = useState(() => new Set());
  const holdTimers = useRef(new Map());

  const setKeyDown = useCallback((id, isDown) => {
    setDown((prev) => {
      const next = new Set(prev);
      if (isDown) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const fire = useCallback(
    (id, phase, extra = {}) => {
      onAction?.({ id, phase, ...extra });
    },
    [onAction],
  );

  const clearHold = useCallback((id) => {
    const t = holdTimers.current.get(id);
    if (t) {
      clearInterval(t);
      holdTimers.current.delete(id);
    }
  }, []);

  const startHold = useCallback(
    (id, holdMs = 50) => {
      clearHold(id);
      fire(id, "down");
      setKeyDown(id, true);
      const t = setInterval(() => fire(id, "hold"), holdMs);
      holdTimers.current.set(id, t);
    },
    [clearHold, fire, setKeyDown],
  );

  const endHold = useCallback(
    (id) => {
      clearHold(id);
      if (down.has(id)) fire(id, "up");
      setKeyDown(id, false);
    },
    [clearHold, down, fire, setKeyDown],
  );

  const pulse = useCallback(
    (id) => {
      setKeyDown(id, true);
      fire(id, "tap");
      setTimeout(() => setKeyDown(id, false), 120);
    },
    [fire, setKeyDown],
  );

  const bindHold = (id) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      startHold(id);
    },
    onPointerUp: () => endHold(id),
    onPointerCancel: () => endHold(id),
    onPointerLeave: (e) => {
      if (e.buttons === 0) endHold(id);
    },
  });

  const bindPulse = (id) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      pulse(id);
    },
  });

  const is = (id) => (down.has(id) ? " is-down" : "");

  return (
    <div
      className={`gp ${compact ? "is-compact" : ""} ${className}`.trim()}
      role="group"
      aria-label="On-screen game controller"
    >
      <div className="gp-left">
        <div className="gp-shoulders">
          <button type="button" className={`gp-btn${is("lb")}`} title={labels.lb || "Prev category"} {...bindPulse("lb")}>
            LB
          </button>
          <button type="button" className={`gp-btn${is("lt")}`} title={labels.lt || "Zoom out"} {...bindHold("lt")}>
            LT
          </button>
        </div>
        <div className="gp-dpad" aria-label="D-pad">
          <button type="button" className={`up${is("up")}`} title={labels.up || "Pan up"} {...bindHold("up")}>
            ▲
          </button>
          <button type="button" className={`left${is("left")}`} title={labels.left || "Pan left"} {...bindHold("left")}>
            ◀
          </button>
          <button type="button" className="center" tabIndex={-1} aria-hidden="true" />
          <button type="button" className={`right${is("right")}`} title={labels.right || "Pan right"} {...bindHold("right")}>
            ▶
          </button>
          <button type="button" className={`down${is("down")}`} title={labels.down || "Pan down"} {...bindHold("down")}>
            ▼
          </button>
        </div>
        <button
          type="button"
          className={`gp-stick${is("ls")}`}
          title={labels.ls || "Reset world"}
          aria-label="Left stick"
          {...bindPulse("ls")}
        />
        <div className="gp-label">move</div>
      </div>

      <div className="gp-mid">
        <div className="gp-meta">
          <button type="button" className={`gp-btn${is("select")}`} title={labels.select || "World panel"} {...bindPulse("select")}>
            SEL
          </button>
          <button type="button" className={`gp-btn${is("start")}`} title={labels.start || "Pause"} {...bindPulse("start")}>
            START
          </button>
        </div>
        <div className="gp-label">wizard joe</div>
      </div>

      <div className="gp-right">
        <div className="gp-shoulders">
          <button type="button" className={`gp-btn${is("rt")}`} title={labels.rt || "Zoom in"} {...bindHold("rt")}>
            RT
          </button>
          <button type="button" className={`gp-btn${is("rb")}`} title={labels.rb || "Next category"} {...bindPulse("rb")}>
            RB
          </button>
        </div>
        <div className="gp-face" aria-label="Face buttons">
          <button type="button" className={`y${is("y")}`} title={labels.y || "Dance"} {...bindPulse("y")}>
            Y
          </button>
          <button type="button" className={`x${is("x")}`} title={labels.x || "Magic"} {...bindPulse("x")}>
            X
          </button>
          <button type="button" className={`b${is("b")}`} title={labels.b || "Clear / stop"} {...bindPulse("b")}>
            B
          </button>
          <button type="button" className={`a${is("a")}`} title={labels.a || "Idle"} {...bindPulse("a")}>
            A
          </button>
        </div>
        <button
          type="button"
          className={`gp-stick${is("rs")}`}
          title={labels.rs || "Flip X"}
          aria-label="Right stick"
          {...bindPulse("rs")}
        />
        <div className="gp-label">action</div>
      </div>
    </div>
  );
}

export default GamepadPad;
