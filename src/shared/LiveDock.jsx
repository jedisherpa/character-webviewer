import React, { useCallback, useEffect, useRef, useState } from "react";
import { HAS_LIVE_BACKEND, LIVE_API_BASE, liveFetch, probeLiveBackend } from "./config.js";
import "./LiveDock.css";

/**
 * NewsWiz live surface — mic STT, chat, rant.
 * Only active when VITE_LIVE_API_BASE points at Hetzner (or local RobinSpeech).
 * Static Vercel deploy stays fully offline without it.
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
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

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

  const playAudioBuffer = useCallback(async (buffer, mime = "audio/mpeg") => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onStage?.("speaking");
    onAction?.("speak");
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    await audio.play().catch(() => {});
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
    });
    URL.revokeObjectURL(url);
    onStage?.("idle");
    onAction?.("idle");
  }, [onAction, onStage]);

  const speakText = useCallback(
    async (text) => {
      if (!text?.trim()) return;
      setBusy(true);
      try {
        let res = await liveFetch("/api/tts/performance", {
          method: "POST",
          body: JSON.stringify({
            text,
            emotionalTone: ranting ? "amused" : "focused",
          }),
        });
        if (!res.ok) {
          res = await liveFetch("/api/tts", {
            method: "POST",
            body: JSON.stringify({ text }),
          });
        }
        if (!res.ok) throw new Error(`tts ${res.status}`);
        const buf = await res.arrayBuffer();
        const mime = res.headers.get("content-type") || "audio/mpeg";
        await playAudioBuffer(buf, mime);
        setStatus("spoke");
      } catch (e) {
        setStatus(`tts · ${String(e.message || e)}`);
        onStage?.("idle");
      } finally {
        setBusy(false);
      }
    },
    [playAudioBuffer, ranting, onStage],
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
    setRanting(true);
    setBusy(true);
    onStage?.("speaking");
    onAction?.("speak");
    setStatus("ranting…");
    try {
      const res = await liveFetch("/api/rant/prepare", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const prompt =
        "Start a short NewsWiz rant on the latest item — sharp, funny, with receipts. Keep it under 120 words.";
      if (res.ok) {
        setStatus("rant · prepared");
        await sendChat(prompt);
      } else {
        setStatus(`rant visual · prepare ${res.status}`);
        await speakText(
          "You hit rant. I opened the newsroom file labeled things everybody noticed but nobody said. Buckle up.",
        );
      }
    } catch (e) {
      setStatus(`rant · ${String(e.message || e)}`);
    } finally {
      setBusy(false);
    }
  }, [onAction, onStage, sendChat, speakText]);

  const stopRant = useCallback(() => {
    setRanting(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    onStage?.("idle");
    onAction?.("idle");
    setStatus("rant stopped");
  }, [onAction, onStage]);

  if (!HAS_LIVE_BACKEND) {
    return (
      <aside className="live-dock is-offline" aria-label="Live NewsWiz (offline)">
        <div className="live-dock-head">
          <strong>NewsWiz live</strong>
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
    <aside className="live-dock" aria-label="NewsWiz live controls">
      <div className="live-dock-head">
        <strong>NewsWiz live</strong>
        <span className={`live-pill${probe.ok ? " is-ok" : " is-bad"}`}>
          {probe.ok ? "online" : probe.error || "offline"}
        </span>
      </div>
      <p className="live-hint mono">{LIVE_API_BASE}</p>

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
          <button type="button" className="live-btn is-danger" onClick={stopRant} disabled={busy}>
            Stop rant
          </button>
        ) : (
          <button type="button" className="live-btn is-primary" onClick={startRant} disabled={busy}>
            Rant
          </button>
        )}
      </div>

      <div className="live-chat">
        {messages.length === 0 ? (
          <div className="live-blank">mic or type below · STT → chat → TTS</div>
        ) : (
          <div className="live-log">
            {messages.map((m, i) => (
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
