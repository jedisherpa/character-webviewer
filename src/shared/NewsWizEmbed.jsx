import React, { useEffect, useState } from "react";
import { HAS_NEWSWIZ, NEWSWIZ_URL, probeNewswiz } from "./config.js";
import "./NewsWizEmbed.css";

const EXPAND_KEY = "characterStudio.newswizEmbed.expanded.v1";

function readExpandedDefault(defaultExpanded) {
  if (typeof defaultExpanded === "boolean") return defaultExpanded;
  try {
    const raw = localStorage.getItem(EXPAND_KEY);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* ignore */
  }
  // Default collapsed so stage stays readable; operator expands for the queue.
  return false;
}

/**
 * Same-origin NewsWiz surface for Wizard Joe live rant/chat/TTS.
 *
 * Character Studio must NOT call /api/* on a foreign host (session tokens are
 * same-origin only). Instead we embed/open the NewsWiz SPA; that document is
 * same-origin to its own newswiz CLI and can mint x-prism-token safely.
 *
 * Collapsed by default: status + open actions only.
 * Expanded: iframe fills the dock — do not stack over the gamepad/stage.
 */
export function NewsWizEmbed({
  title = "NewsWiz · Wizard Joe",
  className = "",
  compact = false,
  defaultExpanded,
  docked = false,
}) {
  const [probe, setProbe] = useState({
    configured: HAS_NEWSWIZ,
    ok: false,
    error: HAS_NEWSWIZ ? "probing…" : "not configured",
    url: NEWSWIZ_URL || null,
  });
  const [expanded, setExpanded] = useState(() => readExpandedDefault(defaultExpanded));

  useEffect(() => {
    let cancelled = false;
    probeNewswiz().then((r) => {
      if (!cancelled) setProbe(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setOpen = (next) => {
    setExpanded(next);
    try {
      localStorage.setItem(EXPAND_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  if (!HAS_NEWSWIZ) {
    return (
      <aside
        className={`newswiz-embed is-offline ${docked ? "is-docked" : ""} ${className}`.trim()}
        aria-label={title}
      >
        <div className="newswiz-embed-head">
          <strong>NEWS</strong>
          <span className="newswiz-pill is-off">offline</span>
        </div>
        <p className="newswiz-hint">
          Live rant runs inside <strong>NewsWiz</strong>. Set{" "}
          <code>VITE_NEWSWIZ_URL</code> to your NewsWiz origin and rebuild.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`newswiz-embed ${compact ? "is-compact" : ""} ${
        docked ? "is-docked" : ""
      } ${expanded ? "is-expanded" : "is-collapsed"} ${className}`.trim()}
      aria-label={title}
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="newswiz-embed-head">
        <div className="newswiz-embed-title">
          <strong>NEWSWIZ</strong>
          <span className={`newswiz-pill ${probe.ok ? "is-on" : "is-off"}`}>
            {probe.ok ? "online" : probe.error || "checking"}
          </span>
        </div>
        <div className="newswiz-embed-head-actions">
          <button
            type="button"
            className="newswiz-btn is-toggle"
            aria-expanded={expanded}
            onClick={() => setOpen(!expanded)}
            data-testid="newswiz-toggle-queue"
          >
            {expanded ? "Hide queue" : "Show queue"}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <p className="newswiz-sub mono" title={NEWSWIZ_URL}>
            {NEWSWIZ_URL}
          </p>
          <p className="newswiz-hint">
            Session tokens stay on the NewsWiz origin. Rant, mic, chat, and tri-bus TTS
            run in the queue below (or open full window).
          </p>
          <div className="newswiz-embed-actions">
            <a
              className="newswiz-btn is-primary"
              href={NEWSWIZ_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open NewsWiz
            </a>
            <a className="newswiz-btn" href={NEWSWIZ_URL} rel="noreferrer">
              Same tab
            </a>
          </div>
          <div className="newswiz-frame-wrap">
            <iframe
              className="newswiz-frame"
              title={title}
              src={NEWSWIZ_URL}
              allow="microphone; autoplay"
              referrerPolicy="no-referrer"
            />
          </div>
        </>
      ) : (
        <div className="newswiz-collapsed-row">
          <p className="newswiz-hint newswiz-hint-inline">
            Live queue hidden so the stage stays clear. Expand to rant / pick stories.
          </p>
          <div className="newswiz-embed-actions">
            <a
              className="newswiz-btn is-primary"
              href={NEWSWIZ_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open NewsWiz
            </a>
            <a className="newswiz-btn" href={NEWSWIZ_URL} rel="noreferrer">
              Same tab
            </a>
          </div>
        </div>
      )}
    </aside>
  );
}
