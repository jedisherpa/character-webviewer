import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BIRD_LIVE_URL, HAS_BIRD_LIVE, probeBirdLive } from "../shared/config.js";
import "./BirdLive.css";

/**
 * 41BirdLive surface — embeds / links the one-bird Hetzner runtime UI
 * (same stack as local :4341).
 */
export function BirdLive() {
  const [probe, setProbe] = useState({
    configured: HAS_BIRD_LIVE,
    ok: false,
    error: HAS_BIRD_LIVE ? "probing…" : "not configured",
    url: BIRD_LIVE_URL || null,
  });

  useEffect(() => {
    let cancelled = false;
    probeBirdLive().then((r) => {
      if (!cancelled) setProbe(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!HAS_BIRD_LIVE) {
    return (
      <div className="bird-live is-offline">
        <header className="bird-live-bar">
          <Link to="/" className="bird-live-back">
            ← Hub
          </Link>
          <strong>41 Bird Live</strong>
        </header>
        <div className="bird-live-empty">
          <h1>41 Bird Live</h1>
          <p>
            One-bird Prism runtime (NewsWiz + FishEye rant). Set{" "}
            <code>VITE_BIRD_LIVE_URL</code> to the Hetzner
            origin, e.g. <code>https://41birdlive.5.78.137.112.sslip.io</code>, then redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bird-live">
      <header className="bird-live-bar">
        <Link to="/" className="bird-live-back">
          ← Hub
        </Link>
        <div className="bird-live-title">
          <strong>41 Bird Live</strong>
          <span className={probe.ok ? "is-ok" : "is-bad"}>
            {probe.ok ? "online" : probe.error || "offline"}
          </span>
        </div>
        <a className="bird-live-open" href={BIRD_LIVE_URL} target="_blank" rel="noreferrer">
          Open full UI ↗
        </a>
      </header>
      <iframe
        className="bird-live-frame"
        title="41 Bird Live"
        src={BIRD_LIVE_URL}
        allow="microphone; autoplay; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
