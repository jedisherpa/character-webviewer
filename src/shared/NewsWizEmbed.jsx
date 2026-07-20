import React, { useEffect, useState } from "react";
import { HAS_NEWSWIZ, NEWSWIZ_URL, probeNewswiz } from "./config.js";
import "./NewsWizEmbed.css";

/**
 * Same-origin NewsWiz surface for Wizard Joe live rant/chat/TTS.
 *
 * Character Studio must NOT call /api/* on a foreign host (session tokens are
 * same-origin only). Instead we embed/open the NewsWiz SPA; that document is
 * same-origin to its own newswiz CLI and can mint x-prism-token safely.
 */
export function NewsWizEmbed({
  title = "NewsWiz · Wizard Joe",
  className = "",
  compact = false,
}) {
  const [probe, setProbe] = useState({
    configured: HAS_NEWSWIZ,
    ok: false,
    error: HAS_NEWSWIZ ? "probing…" : "not configured",
    url: NEWSWIZ_URL || null,
  });

  useEffect(() => {
    let cancelled = false;
    probeNewswiz().then((r) => {
      if (!cancelled) setProbe(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!HAS_NEWSWIZ) {
    return (
      <aside className={`newswiz-embed is-offline ${className}`.trim()} aria-label={title}>
        <div className="newswiz-embed-head">
          <strong>NEWS</strong>
          <span className="newswiz-pill is-off">offline</span>
        </div>
        <p className="newswiz-hint">
          Live rant runs inside <strong>NewsWiz</strong> (same-origin to the{" "}
          <code>newswiz</code> CLI). Set <code>VITE_NEWSWIZ_URL</code> to your
          NewsWiz origin (e.g. <code>http://127.0.0.1:4311</code> or your Hetzner
          NewsWiz host), rebuild, and open/embed that SPA — do not call 41BirdLive APIs from this studio.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`newswiz-embed ${compact ? "is-compact" : ""} ${className}`.trim()}
      aria-label={title}
    >
      <div className="newswiz-embed-head">
        <div>
          <strong>NEWSWIZ</strong>
          <p className="newswiz-sub mono">{NEWSWIZ_URL}</p>
        </div>
        <span className={`newswiz-pill ${probe.ok ? "is-on" : "is-off"}`}>
          {probe.ok ? "online" : probe.error || "checking"}
        </span>
      </div>
      <p className="newswiz-hint">
        Session tokens stay on the NewsWiz origin. Rant, mic, chat, and tri-bus TTS
        run in the embedded shell (or open full window).
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
    </aside>
  );
}
