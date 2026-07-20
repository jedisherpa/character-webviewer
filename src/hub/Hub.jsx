import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { HAS_LIVE_BACKEND, LIVE_API_BASE, probeLiveBackend } from "../shared/config.js";
import "./Hub.css";

const CARDS = [
  {
    to: "/studio",
    title: "Production Studio",
    badge: "primary",
    blurb:
      "Full-stage production bay · record poses & clips into sequences · save/replay · programmable gamepad · toggle drawers",
    accent: "teal",
  },
  {
    to: "/joe/alpha-hd",
    title: "Wizard Joe · Alpha HD",
    badge: "960×540",
    blurb: "NewsWiz character studio · 270 poses · walk/fly loops · live dock when linked",
    accent: "amber",
  },
  {
    to: "/dragon",
    title: "Dragonview classic",
    badge: "5-cast",
    blurb: "Original multi-cast world-space pad · walk/fly loops · pose grid",
    accent: "violet",
  },
  {
    to: "/joe/base250",
    title: "Wizard Joe · Base 250",
    badge: "legacy",
    blurb: "Side-by-side compare pack",
    accent: "slate",
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
            <span>Production bay · Vercel static · optional Hetzner live</span>
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
            <strong>Production Studio</strong> keeps the stage huge — drawers for library, timeline,
            sequences, gamepad map, and docs toggle in with <code>L T S G C ?</code>. Record gamepad
            presses into reusable choreography.
          </p>
        </footer>
      </div>
    </div>
  );
}
