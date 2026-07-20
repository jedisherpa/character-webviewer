import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HAS_LIVE_BACKEND, LIVE_API_BASE, probeLiveBackend } from "../shared/config.js";
import "./Hub.css";

const CARDS = [
  {
    to: "/joe/alpha-hd",
    title: "Wizard Joe · Alpha HD",
    badge: "960×540",
    blurb:
      "NewsWiz production alphas · 270 poses · walk/fly loops · studio + gamepad · live mic/chat/rant when Hetzner is linked",
    accent: "teal",
  },
  {
    to: "/joe/base250",
    title: "Wizard Joe · Base 250",
    badge: "legacy",
    blurb: "Base 250 pack · same studio controls for side-by-side compare",
    accent: "amber",
  },
  {
    to: "/dragon",
    title: "Dragonview",
    badge: "5-cast",
    blurb: "Dragon · Kingfisher · Wizard Joe · Prism · Speech · world-space pad",
    accent: "violet",
  },
];

export function Hub() {
  const [live, setLive] = useState({
    ok: false,
    configured: HAS_LIVE_BACKEND,
    error: HAS_LIVE_BACKEND ? "probing…" : "static only",
    base: LIVE_API_BASE || null,
  });

  useEffect(() => {
    let cancelled = false;
    probeLiveBackend().then((r) => {
      if (!cancelled) setLive(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveLabel = !live.configured
    ? "Static only · live API on Hetzner optional"
    : live.ok
      ? `Live backend · ${live.base}`
      : `Live backend unreachable · ${live.error || "error"}`;

  return (
    <div className="hub">
      <div className="hub-card">
        <header className="hub-head">
          <div>
            <strong>Character Studio</strong>
            <span>Webviewer · Vercel static · Hetzner live API</span>
          </div>
          <a
            className="hub-gh"
            href="https://github.com/jedisherpa/character-webviewer"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </header>

        <div className={`hub-live ${live.configured ? (live.ok ? "is-ok" : "is-bad") : "is-off"}`}>
          <span className="hub-live-dot" aria-hidden="true" />
          {liveLabel}
        </div>

        <div className="hub-grid">
          {CARDS.map((c) => (
            <Link key={c.to} to={c.to} className={`hub-tile accent-${c.accent}`}>
              <div className="hub-tile-top">
                <span className="hub-badge">{c.badge}</span>
              </div>
              <h2>{c.title}</h2>
              <p>{c.blurb}</p>
              <span className="hub-open">Open →</span>
            </Link>
          ))}
        </div>

        <footer className="hub-foot">
          <p>
            Visualizers ship on <strong>Vercel</strong> (this repo). NewsWiz live
            (mic / chat / rant / TTS) is a separate process on{" "}
            <strong>Hetzner</strong> — set <code>VITE_LIVE_API_BASE</code> and enable
            CORS. Local: <code>4310</code> Base 250 · <code>4350</code> Alpha HD ·{" "}
            <code>4370</code> Dragonview · <code>4400</code> this hub.
          </p>
        </footer>
      </div>
    </div>
  );
}
