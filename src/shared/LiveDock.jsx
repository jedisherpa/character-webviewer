// DEPRECATED: cross-origin live API dock.
// Character Studio now embeds NewsWiz (NewsWizEmbed) so session tokens stay
// same-origin. This module is retained only for reference / local experiments.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HAS_LIVE_BACKEND, LIVE_API_BASE, liveFetch, probeLiveBackend } from "./config.js";
import {
  beatStageAction,
  loadWizardJoeRantPacket,
  refillWizardJoeRantQueue,
  rantIdleExpired,
  rantStoryKey,
  stageWizardJoeRantReport,
  waitMs,
  readRantPreferences,
  writeRantPreferences,
  normalizeRantSourceId,
  RANT_SOURCES,
  feedItemsFromPacket,
  mergeFeedItems,
  RANT_IDLE_STOP_DEFAULT_MS,
  RANT_REFILL_BACKOFF_DEFAULT_MS,
  WIZARD_JOE_RANT_FALLBACK_EMPTY,
  WIZARD_JOE_RANT_FALLBACK_OPEN,
  WIZARD_JOE_RANT_QUEUE_LIMIT,
} from "./rantPipeline.js";
import "./LiveDock.css";

/**
 * NewsWiz live surface — mic STT, chat, continuous multi-story rant + feed panel.
 * Left-integrated feed features the story Wizard Joe is on (auto-scroll).
 */
export function LiveDock({ onStage, onAction, onRantChange }) {
  const [probe, setProbe] = useState({
    configured: HAS_LIVE_BACKEND,
    ok: false,
    error: HAS_LIVE_BACKEND ? "probing…" : "static only",
  });
  const [micState, setMicState] = useState("idle"); // idle | recording | transcribing
  const [busy, setBusy] = useState(false);
  const [ranting, setRanting] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("");
  const [rantSourceId, setRantSourceId] = useState(
    () => normalizeRantSourceId(readRantPreferences().rantSourceId),
  );
  const [rantStoryIndex, setRantStoryIndex] = useState(0);
  const [feedItems, setFeedItems] = useState([]);
  const [featuredStoryKey, setFeaturedStoryKey] = useState("");
  const [playedFeedKeys, setPlayedFeedKeys] = useState(() => new Set());
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);
  const rantTokenRef = useRef(0);
  const rantAbortRef = useRef(null);
  const rantPlayedKeysRef = useRef(new Set());
  const lastUserActivityRef = useRef(Date.now());
  const featuredCardRef = useRef(null);

  const selectedRantSource = useMemo(
    () => RANT_SOURCES.find((s) => s.id === rantSourceId) || RANT_SOURCES[0],
    [rantSourceId],
  );
  const joeNews = useMemo(() => RANT_SOURCES.filter((s) => s.family === "joe-news"), []);
  const fisheye = useMemo(() => RANT_SOURCES.filter((s) => s.family === "fisheye"), []);

  const selectRantSource = useCallback((nextId) => {
    const id = normalizeRantSourceId(nextId);
    setRantSourceId(id);
    writeRantPreferences({ ...readRantPreferences(), rantSourceId: id });
  }, []);

  useEffect(() => {
    if (!featuredStoryKey || !featuredCardRef.current) return;
    featuredCardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [featuredStoryKey, feedItems.length]);

  useEffect(() => {
    let cancelled = false;
    probeLiveBackend().then((r) => {
      if (!cancelled) setProbe(r);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onRantChange?.(ranting);
  }, [ranting, onRantChange]);

  useEffect(() => {
    const touch = () => {
      lastUserActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"];
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, touch));
  }, []);

  const playAudioBuffer = useCallback(async (buffer, mime = "audio/mpeg", {
    action: beatAction = "speak",
    signal = null,
  } = {}) => {
    if (signal?.aborted) {
      throw new DOMException("Playback cancelled", "AbortError");
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    const stageAction = String(beatAction || "speak").toLowerCase() || "speak";
    onStage?.("speaking");
    onAction?.(stageAction);
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    try {
      await new Promise((resolve, reject) => {
        const settle = () => resolve();
        const fail = () => {
          if (signal?.aborted) {
            reject(new DOMException("Playback cancelled", "AbortError"));
          } else {
            resolve();
          }
        };
        audio.onended = settle;
        audio.onerror = settle;
        if (signal) {
          if (signal.aborted) {
            fail();
            return;
          }
          signal.addEventListener(
            "abort",
            () => {
              try {
                audio.pause();
              } catch {
                /* ignore */
              }
              fail();
            },
            { once: true },
          );
        }
        audio.play().catch(settle);
      });
    } finally {
      URL.revokeObjectURL(url);
      if (audioRef.current === audio) audioRef.current = null;
    }
    if (signal?.aborted) {
      throw new DOMException("Playback cancelled", "AbortError");
    }
  }, [onAction, onStage]);

  const speakText = useCallback(
    async (text, {
      action: beatAction = "speak",
      holdStage = false,
      emotionalTone = null,
      signal = null,
      manageBusy = true,
    } = {}) => {
      if (!text?.trim()) return;
      if (signal?.aborted) {
        throw new DOMException("Speech cancelled", "AbortError");
      }
      if (manageBusy) setBusy(true);
      try {
        let res = await liveFetch("/api/tts/performance", {
          method: "POST",
          body: JSON.stringify({
            text,
            profile: "breaking_news",
            emotionalTone: emotionalTone || (ranting ? "amused" : "focused"),
          }),
          signal: signal || undefined,
        });
        if (!res.ok) {
          res = await liveFetch("/api/tts", {
            method: "POST",
            body: JSON.stringify({ text }),
            signal: signal || undefined,
          });
        }
        if (signal?.aborted) {
          throw new DOMException("Speech cancelled", "AbortError");
        }
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const buf = await res.arrayBuffer();
        const mime = res.headers.get("content-type") || "audio/mpeg";
        await playAudioBuffer(buf, mime, { action: beatAction, signal });
        if (signal?.aborted) {
          throw new DOMException("Speech cancelled", "AbortError");
        }
        if (!holdStage) {
          onStage?.("idle");
          onAction?.("idle");
        }
        setStatus("spoke");
      } catch (e) {
        if (e?.name === "AbortError") throw e;
        setStatus(`tts · ${String(e.message || e)}`);
        if (!holdStage) onStage?.("idle");
      } finally {
        if (manageBusy) setBusy(false);
      }
    },
    [playAudioBuffer, ranting, onStage, onAction],
  );

  const sendChat = useCallback(
    async (text) => {
      const prompt = (text ?? draft).trim();
      if (!prompt) return;
      setBusy(true);
      setMessages((m) => [...m, { role: "user", text: prompt }]);
      setDraft("");
      onStage?.("understanding");
      onAction?.("think");
      try {
        const res = await liveFetch("/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: prompt, text: prompt }),
        });
        if (!res.ok) throw new Error(`chat ${res.status}`);
        const data = await res.json();
        const reply =
          data.reply || data.text || data.message || data.response || "(no reply)";
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
        setStatus("chat ok");
        await speakText(reply);
      } catch (e) {
        setStatus(`chat · ${String(e.message || e)}`);
        onStage?.("idle");
        onAction?.("idle");
      } finally {
        setBusy(false);
      }
    },
    [draft, onAction, onStage, speakText],
  );

  const stopMic = useCallback(() => {
    try {
      mediaRecRef.current?.stop();
    } catch {
      /* ignore */
    }
    mediaRecRef.current = null;
  }, []);

  const startMic = useCallback(async () => {
    if (micState === "recording") {
      stopMic();
      return;
    }
    if (!HAS_LIVE_BACKEND) {
      setStatus("configure VITE_LIVE_API_BASE for mic");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (ev) => {
        if (ev.data?.size) chunksRef.current.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setMicState("transcribing");
        onStage?.("listening");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const fd = new FormData();
          fd.append("audio", blob, "mic.webm");
          fd.append("file", blob, "mic.webm");
          const res = await liveFetch("/api/stt", { method: "POST", body: fd });
          if (!res.ok) throw new Error(`stt ${res.status}`);
          const data = await res.json();
          const text = data.transcript || data.text || data.result || "";
          if (!text.trim()) {
            setStatus("no speech detected");
            onStage?.("idle");
          } else {
            setDraft(text);
            setStatus("heard you");
            await sendChat(text);
          }
        } catch (err) {
          setStatus(`stt · ${String(err.message || err)}`);
          onStage?.("idle");
        } finally {
          setMicState("idle");
        }
      };
      mediaRecRef.current = rec;
      rec.start();
      setMicState("recording");
      onStage?.("listening");
      onAction?.("listen");
      setStatus("listening…");
    } catch (err) {
      setMicState("idle");
      setStatus(`mic · ${String(err.message || err)}`);
    }
  }, [micState, stopMic, onStage, onAction, sendChat]);

  const startRant = useCallback(async () => {
    if (!HAS_LIVE_BACKEND) {
      setRanting(true);
      onStage?.("speaking");
      onAction?.("speak");
      setStatus("rant visual (no live API)");
      return;
    }

    rantTokenRef.current += 1;
    const token = rantTokenRef.current;
    rantAbortRef.current?.abort?.();
    const abort = new AbortController();
    rantAbortRef.current = abort;
    rantPlayedKeysRef.current = new Set();
    lastUserActivityRef.current = Date.now();
    setRantStoryIndex(0);
    setPlayedFeedKeys(new Set());
    setFeaturedStoryKey("");

    const settings = {
      rantSourceId,
      sourceCount: WIZARD_JOE_RANT_QUEUE_LIMIT,
      energy: 4,
    };

    setRanting(true);
    setBusy(true);
    onStage?.("understanding");
    onAction?.("think");
    setStatus("rant · preparing…");

    const stillCurrent = () =>
      rantTokenRef.current === token && !abort.signal.aborted;

    const idleExpired = () =>
      rantIdleExpired(lastUserActivityRef.current, Date.now(), RANT_IDLE_STOP_DEFAULT_MS);

    const finishRant = (line) => {
      if (!stillCurrent()) return;
      setRanting(false);
      setBusy(false);
      setFeaturedStoryKey("");
      onStage?.("idle");
      onAction?.("idle");
      setStatus(line);
    };

    try {
      const openPromise = speakText(WIZARD_JOE_RANT_FALLBACK_OPEN, {
        action: "gesture",
        holdStage: true,
        emotionalTone: "amused",
        signal: abort.signal,
        manageBusy: false,
      }).catch((err) => {
        if (err?.name !== "AbortError") throw err;
      });

      const first = await loadWizardJoeRantPacket(liveFetch, settings, {
        signal: abort.signal,
      });

      if (!stillCurrent()) return;

      if (first.empty || !first.reports.length) {
        await openPromise;
        if (!stillCurrent()) return;
        setStatus("rant · no articles");
        await speakText(WIZARD_JOE_RANT_FALLBACK_EMPTY, {
          action: "speak",
          holdStage: true,
          signal: abort.signal,
          manageBusy: false,
        });
        finishRant("rant · empty");
        return;
      }

      await openPromise;
      if (!stillCurrent()) return;

      const sourceLabel =
        first.packet?.sourceLabel || first.packet?.sourceId || rantSourceId;
      setFeedItems(feedItemsFromPacket(first.packet));
      setStatus(`rant live · ${sourceLabel}`);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Continuous rant · ${sourceLabel} · ${first.reports.length} in queue · stop or idle ends`,
        },
      ]);

      let queue = [...first.reports];
      let storyOrdinal = 0;

      while (stillCurrent()) {
        if (idleExpired()) {
          finishRant("rant ended · no activity for 30 minutes");
          return;
        }

        if (!queue.length) {
          setStatus("rant · scanning for fresh stories…");
          onStage?.("understanding");
          onAction?.("think");
          let additions = [];
          try {
            const refill = await refillWizardJoeRantQueue(
              liveFetch,
              settings,
              rantPlayedKeysRef.current,
              { signal: abort.signal },
            );
            if (!stillCurrent()) return;
            additions = refill.additions || [];
            if (refill.packet) {
              setFeedItems((prev) =>
                mergeFeedItems(
                  prev,
                  feedItemsFromPacket({ ...refill.packet, reports: additions }),
                ),
              );
            }
          } catch (err) {
            if (err?.name === "AbortError" || !stillCurrent()) return;
            setStatus(`rant · refill · ${String(err.message || err)}`);
          }
          if (!additions.length) {
            setStatus("rant · waiting for fresh stories…");
            try {
              await waitMs(RANT_REFILL_BACKOFF_DEFAULT_MS, abort.signal);
            } catch {
              return;
            }
            continue;
          }
          queue = additions;
        }

        const report = queue.shift();
        const key = rantStoryKey(report);
        storyOrdinal += 1;
        setRantStoryIndex(storyOrdinal);
        setFeaturedStoryKey(key);

        const title = report?.title || `story ${storyOrdinal}`;
        setStatus(`rant · story ${storyOrdinal} · writing`);
        onStage?.("understanding");
        onAction?.("think");
        setMessages((m) => [
          ...m,
          { role: "assistant", text: `Story ${storyOrdinal}: ${title}` },
        ]);

        let unit;
        try {
          unit = await stageWizardJoeRantReport(liveFetch, report, {
            energy: settings.energy,
            signal: abort.signal,
          });
        } catch (err) {
          if (err?.name === "AbortError" || !stillCurrent()) return;
          setStatus(`rant · story failed · ${String(err.message || err)}`);
          continue;
        }
        if (!stillCurrent()) return;

        for (const beat of unit.beats) {
          if (!stillCurrent()) return;
          if (idleExpired()) {
            finishRant("rant ended · no activity for 30 minutes");
            return;
          }
          const stageAction = beatStageAction(beat);
          onStage?.("speaking");
          onAction?.(stageAction);
          setStatus(`rant · story ${storyOrdinal} · ${beat.role} · ${stageAction}`);
          setMessages((m) => [...m, { role: "assistant", text: beat.ttsText }]);
          await speakText(beat.ttsText, {
            action: stageAction,
            holdStage: true,
            emotionalTone: "amused",
            signal: abort.signal,
            manageBusy: false,
          });
        }

        rantPlayedKeysRef.current.add(key);
        setPlayedFeedKeys(new Set(rantPlayedKeysRef.current));
      }
    } catch (e) {
      if (e?.name === "AbortError" || !stillCurrent()) return;
      setStatus(`rant · ${String(e.message || e)}`);
      try {
        if (stillCurrent()) {
          await speakText(WIZARD_JOE_RANT_FALLBACK_OPEN, {
            action: "speak",
            holdStage: true,
            emotionalTone: "amused",
            signal: abort.signal,
            manageBusy: false,
          });
        }
      } catch {
        /* ignore abort / offline */
      }
      finishRant(`rant · ${String(e.message || e)}`);
    } finally {
      if (rantTokenRef.current === token) {
        setBusy(false);
        if (rantAbortRef.current === abort) rantAbortRef.current = null;
      }
    }
  }, [onAction, onStage, rantSourceId, speakText]);

  const stopRant = useCallback(() => {
    rantTokenRef.current += 1;
    rantAbortRef.current?.abort?.();
    rantAbortRef.current = null;
    rantPlayedKeysRef.current = new Set();
    setRanting(false);
    setBusy(false);
    setRantStoryIndex(0);
    setFeaturedStoryKey("");
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    }
    onStage?.("idle");
    onAction?.("idle");
    setStatus("rant stopped");
  }, [onAction, onStage]);

  if (!HAS_LIVE_BACKEND) {
    return (
      <aside className="live-dock is-offline is-news-surface" aria-label="Live NewsWiz (offline)">
        <div className="live-dock-head">
          <strong>NEWS</strong>
          <span className="live-pill is-off">static</span>
        </div>
        <p className="live-hint">
          Mic, chat, and rant need the Hetzner/RobinSpeech backend. Set{" "}
          <code>VITE_LIVE_API_BASE</code> on Vercel (or local), then redeploy.
        </p>
      </aside>
    );
  }

  return (
    <aside className="live-dock is-news-surface" aria-label="NewsWiz news + live controls">
      <div className="live-dock-head">
        <strong>NEWS</strong>
        <span className={`live-pill${probe.ok ? " is-ok" : " is-bad"}`}>
          {probe.ok ? "online" : probe.error || "offline"}
        </span>
      </div>
      <p className="live-hint mono">{LIVE_API_BASE}</p>

      <label className="live-source" title={selectedRantSource.description}>
        <span>Source feed</span>
        <select
          aria-label="Rant source feed"
          value={rantSourceId}
          disabled={ranting}
          onChange={(e) => selectRantSource(e.target.value)}
        >
          <optgroup label="JoeNEWS queues">
            {joeNews.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="FishEye Research feeds">
            {fisheye.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.requiresResearchToken ? " · token" : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <p className="live-source-hint">
        {selectedRantSource.description}
        {selectedRantSource.requiresResearchToken
          ? " Requires Research Service access."
          : ""}
      </p>

      <div className="live-actions">
        <button
          type="button"
          className={`live-btn${micState === "recording" ? " is-active" : ""}`}
          onClick={startMic}
          disabled={busy && micState === "idle"}
        >
          {micState === "recording" ? "Stop mic" : micState === "transcribing" ? "…" : "Mic"}
        </button>
        {ranting ? (
          <button type="button" className="live-btn is-danger" onClick={stopRant}>
            Stop rant{rantStoryIndex > 0 ? ` · #${rantStoryIndex}` : ""}
          </button>
        ) : (
          <button type="button" className="live-btn is-primary" onClick={startRant} disabled={busy}>
            Rant
          </button>
        )}
      </div>

      <div className="live-feed-list" aria-label="Story queue">
        {!feedItems.length ? (
          <div className="live-blank">Feed fills when you Rant — ON AIR card auto-scrolls</div>
        ) : (
          feedItems.map((item) => {
            const isFeatured = item.key === featuredStoryKey;
            const isPlayed = playedFeedKeys.has(item.key);
            return (
              <article
                key={item.key}
                ref={isFeatured ? featuredCardRef : null}
                className={[
                  "live-feed-card",
                  isFeatured ? "is-featured" : "",
                  isPlayed && !isFeatured ? "is-played" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="live-feed-meta">
                  <span>#{item.number}</span>
                  {isFeatured ? <span className="live-on-air">ON AIR</span> : null}
                  {item.domain ? <span className="live-domain">{item.domain}</span> : null}
                </div>
                <strong>{item.title}</strong>
                {item.excerpt ? <p>{item.excerpt}</p> : null}
              </article>
            );
          })
        )}
      </div>

      <div className="live-chat">
        {messages.length === 0 ? null : (
          <div className="live-log">
            {messages.slice(-6).map((m, i) => (
              <p key={`${m.role}-${i}`} className={`live-msg is-${m.role}`}>
                {m.text}
              </p>
            ))}
          </div>
        )}
        <form
          className="live-compose"
          onSubmit={(e) => {
            e.preventDefault();
            sendChat();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Chat NewsWiz…"
            disabled={busy}
          />
          <button type="submit" className="live-btn is-primary" disabled={busy || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
      {status ? <div className="live-status">{status}</div> : null}
    </aside>
  );
}
