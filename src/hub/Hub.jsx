import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BIRD_LIVE_URL,
  HAS_BIRD_LIVE,
  HAS_LIVE_BACKEND,
  LIVE_API_BASE,
  probeBirdLive,
  probeLiveBackend,
} from "../shared/config.js";
import "./Hub.css";

const CARDS = [
  {
    to: "/41birdlive",
    title: "41 Bird Live",
    badge: "Hetzner",
    blurb:
      "One-bird Prism runtime · NewsWiz + FishEye rant · same stack as local :4341 · full UI on Hetzner",
    accent: "teal",
    external: false,
  },
  {
    to: "/studio",
    title: "Production Studio",
    badge: "primary",
    blurb:
      "Full-stage production bay · record poses & clips into sequences · save/replay · programmable gamepad · toggle drawers",
    accent: "amber",
  },
  {
    to: "/joe/alpha-hd",
    title: "Wizard Joe · Alpha HD",
    badge: "960×540",
    blurb: "NewsWiz character studio · 270 poses · walk/fly loops · live dock when linked",
    accent: "violet",
  },
  {
    to: "/dragon",
    title: "Dragonview classic",
    badge: "5-cast",
    blurb: "Original multi-cast world-space pad · walk/fly loops · pose grid",
    accent: "slate",
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
  const [bird, setBird] = useState({
    ok: false,
    configured: HAS_BIRD_LIVE,
    error: HAS_BIRD_LIVE ? "probing…" : "not set",
    url: BIRD_LIVE_URL || null,
  });

  useEffect(() => {
    let cancelled = false;
    probeLiveBackend().then((r) => {
      if (!cancelled) setLive(r);
    });
    probeBirdLive().then((r) => {
      if (!cancelled) setBird(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const liveLabel = !live.configured
    ? "Static only · set VITE_LIVE_API_BASE for live API"
    : live.ok
      ? `Live API · ${live.base}`
      : `Live API unreachable · ${live.error || "error"}`;

  const birdLabel = !bird.configured
    ? "41 Bird Live URL not set (VITE_BIRD_LIVE_URL)"
    : bird.ok
      ? `41 Bird Live · ${bird.url}`
      : `41 Bird Live unreachable · ${bird.error || "error"}`;

  return (
    <div className="hub">
      <div className="hub-card">
        <header className="hub-head">
          <div>
            <strong>Character Studio</strong>
            <span>Production bay · Vercel static · 41BirdLive on Hetzner</span>
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
        <div className={`hub-live ${bird.configured ? (bird.ok ? "is-ok" : "is-bad") : "is-off"}`}>
          <span className="hub-live-dot" aria-hidden="true" />
          {birdLabel}
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
            <strong>41 Bird Live</strong> is the one-bird Prism runtime on Hetzner (local port{" "}
            <code>4341</code>). Joe studio uses the same live API when{" "}
            <code>VITE_LIVE_API_BASE</code> points at that origin.
          </p>
        </footer>
      </div>
    </div>
  );
}
