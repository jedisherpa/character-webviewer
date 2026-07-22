import { useCallback, useEffect, useState } from "react";

/**
 * Stage full-screen for character viewing.
 * - CSS class `is-stage-fullscreen` on the host fills the browser viewport
 * - Optional native Fullscreen API for true OS full-screen
 * - Escape (and native exit) leave full-screen
 */
/**
 * @param {React.RefObject<HTMLElement|null>} hostRef
 * @param {{ enableHotkey?: boolean }} [options] enableHotkey defaults true (F key).
 *   Disable on surfaces that already bind F (e.g. Dragonview gamepad Y).
 */
export function useStageFullscreen(hostRef, options = {}) {
  const enableHotkey = options.enableHotkey !== false;
  const [active, setActive] = useState(false);

  const exit = useCallback(async () => {
    setActive(false);
    const el = hostRef?.current;
    if (el) el.classList.remove("is-stage-fullscreen");
    document.documentElement.classList.remove("stage-fs-active");
    document.body.classList.remove("stage-fs-active");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, [hostRef]);

  const enter = useCallback(async () => {
    const el = hostRef?.current;
    if (!el) return;
    setActive(true);
    el.classList.add("is-stage-fullscreen");
    document.documentElement.classList.add("stage-fs-active");
    document.body.classList.add("stage-fs-active");
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      }
    } catch {
      // CSS full-screen still works if browser blocks native FS
    }
  }, [hostRef]);

  const toggle = useCallback(() => {
    if (active) void exit();
    else void enter();
  }, [active, enter, exit]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && active) {
        e.preventDefault();
        void exit();
      }
      // F key toggles when not typing (opt-in; off for Dragonview gamepad F=Y)
      if (
        enableHotkey &&
        (e.key === "f" || e.key === "F") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !e.target?.isContentEditable
      ) {
        e.preventDefault();
        toggle();
      }
    };
    const onFsChange = () => {
      if (!document.fullscreenElement && active) {
        // Native FS exited (Esc/browser UI) — drop CSS mode too
        const el = hostRef?.current;
        if (el) el.classList.remove("is-stage-fullscreen");
        document.documentElement.classList.remove("stage-fs-active");
        document.body.classList.remove("stage-fs-active");
        setActive(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFsChange);
    };
  }, [active, exit, toggle, hostRef, enableHotkey]);

  // Cleanup on unmount
  useEffect(
    () => () => {
      document.documentElement.classList.remove("stage-fs-active");
      document.body.classList.remove("stage-fs-active");
      try {
        if (document.fullscreenElement) void document.exitFullscreen();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { active, enter, exit, toggle };
}
