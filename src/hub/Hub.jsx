import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BIRD_LIVE_URL,
  HAS_BIRD_LIVE,
  HAS_NEWSWIZ,
  NEWSWIZ_URL,
  probeBirdLive,
  probeNewswiz,
} from "../shared/config.js";
import "./Hub.css";

const CARDS = [
  {
    to: "/41birdlive",
    title: "41 Bird Live",
    badge: "Robin",
    blurb:
      "One-bird Prism runtime on Hetzner · open full SPA (same-origin tokens there)",
    accent: "teal",
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
    blurb: "Pose studio · embed/open NewsWiz for live rant (same-origin to newswiz CLI)",
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
  const [newswiz, setNewswiz] = useState({
    ok: false,
    configured: HAS_NEWSWIZ,
    error: HAS_NEWSWIZ ? "probing…" : "not set",
    url: NEWSWIZ_URL || null,
  });
  const [bird, setBird] = useState({
    ok: false,
    configured: HAS_BIRD_LIVE,
    error: HAS_BIRD_LIVE ? "probing…" : "not set",
    url: BIRD_LIVE_URL || null,
  });

  useEffect(() => {
    let cancelled = false;
    probeNewswiz().then((r) => {
      if (!cancelled) setNewswiz(r);
    });
    probeBirdLive().then((r) => {
      if (!cancelled) setBird(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const newswizLabel = !newswiz.configured
    ? "NewsWiz URL not set (VITE_NEWSWIZ_URL) · pose studio is static-only"
    : newswiz.ok
      ? `NewsWiz · ${newswiz.url}`
      : `NewsWiz unreachable · ${newswiz.error || "error"}`;

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
            <span>Pose packs on Vercel · live speech via NewsWiz same-origin</span>
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

        <div className={`hub-live ${newswiz.configured ? (newswiz.ok ? "is-ok" : "is-bad") : "is-off"}`}>
          <span className="hub-live-dot" aria-hidden="true" />
          {newswizLabel}
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
            <strong>NewsWiz</strong> (<code>newswiz</code> CLI) owns session tokens, rant, and
            tri-bus TTS. Character Studio embeds/opens that SPA — it does not call Hetzner APIs
            cross-origin. Set <code>VITE_NEWSWIZ_URL</code> to the NewsWiz origin.
          </p>
        </footer>
      </div>
    </div>
  );
}
