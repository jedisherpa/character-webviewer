import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HAS_LIVE_BACKEND, LIVE_API_BASE, probeLiveBackend } from "../shared/config.js";
import "./Hub.css";

const CARDS = [
  {
    to: "/joe/alpha-hd",
    title: "Wizard Joe · Alpha HD",
    badge: "960×540",
    blurb: "Production alpha set · 250 poses · character studio + gamepad",
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
    badge: "3-cast",
    blurb: "Dragon · Kingfisher · Wizard Joe on white stage · world-space pad",
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
            Local ports: <code>4310</code> Base 250 · <code>4350</code> Alpha HD ·{" "}
            <code>4370</code> Dragonview. Visualizers are client-side; set{" "}
            <code>VITE_LIVE_API_BASE</code> to your Hetzner HTTPS origin for mic/chat/TTS.
          </p>
        </footer>
      </div>
    </div>
  );
}
