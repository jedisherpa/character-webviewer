import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PerformerSwitch } from "../shared/PerformerSwitch.jsx";
import { routeForPerformerHub } from "../shared/performerModes.js";
import {
  FLEET_CARDS,
  STUDIO_CARDS,
  probeFleetOrigin,
} from "../shared/fleet.js";
import "./Hub.css";

function statusClass(probe) {
  if (!probe) return "is-off";
  if (probe.ok) return "is-ok";
  if (probe.configured && probe.error) return "is-bad";
  return "is-off";
}

function statusLabel(probe) {
  if (!probe) return "checking…";
  if (probe.ok) return "online";
  if (probe.status === 502 || probe.status === 503) return `degraded · HTTP ${probe.status}`;
  if (probe.error) return probe.error;
  return "unknown";
}

export function Hub() {
  const navigate = useNavigate();
  const [probes, setProbes] = useState(() => ({}));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const entries = await Promise.all(
        FLEET_CARDS.map(async (card) => {
          if (!card.href || !card.probe) {
            return [card.id, { ok: true, configured: true, url: card.href, error: null }];
          }
          const result = await probeFleetOrigin(card.href, card.probe);
          return [card.id, result];
        }),
      );
      if (!cancelled) {
        setProbes(Object.fromEntries(entries));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hub">
      <div className="hub-card">
        <header className="hub-head">
          <div>
            <strong>Character Studio</strong>
            <span>
              Hub for studio tools + live fleet ·{" "}
              <a
                href="https://character-webviewer.vercel.app/"
                style={{ color: "inherit" }}
              >
                character-webviewer.vercel.app
              </a>
            </span>
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

        <div className="hub-section-label">Jump to performer</div>
        <div className="hub-performer-row">
          <PerformerSwitch
            value="wizard"
            onChange={(mode) => navigate(routeForPerformerHub(mode))}
          />
        </div>

        <div className="hub-section-label">Character Studio (this app)</div>
        <div className="hub-grid">
          {STUDIO_CARDS.map((c) => (
            <Link key={c.id} to={c.to} className={`hub-tile accent-${c.accent}`}>
              <div className="hub-tile-top">
                <span className="hub-badge">{c.badge}</span>
              </div>
              <h2>{c.title}</h2>
              <p>{c.blurb}</p>
              <span className="hub-open">Open →</span>
            </Link>
          ))}
        </div>

        <div className="hub-section-label">Live fleet (HTTPS)</div>
        <div className="hub-grid hub-grid-fleet">
          {FLEET_CARDS.map((c) => {
            const probe = probes[c.id];
            const cls = statusClass(probe);
            return (
              <a
                key={c.id}
                href={c.href}
                target="_blank"
                rel="noreferrer"
                className={`hub-tile accent-${c.accent} hub-tile-fleet`}
              >
                <div className="hub-tile-top">
                  <span className="hub-badge">{c.badge}</span>
                  <span className={`hub-probe ${cls}`}>
                    <span className="hub-live-dot" aria-hidden="true" />
                    {statusLabel(probe)}
                  </span>
                </div>
                <h2>{c.title}</h2>
                <p>{c.blurb}</p>
                <code className="hub-url">{c.href?.replace(/^https:\/\//, "")}</code>
                <span className="hub-open">Open in new tab ↗</span>
              </a>
            );
          })}
        </div>

        <footer className="hub-foot">
          <p>
            <strong>Studio tools</strong> run on Vercel. <strong>NewsWiz</strong> and{" "}
            <strong>41BirdLive</strong> mint session tokens same-origin on their own hosts —
            open those tabs for live rant/TTS. Newsroom and API hosts are listed for ops
            reachability.
          </p>
        </footer>
      </div>
    </div>
  );
}
