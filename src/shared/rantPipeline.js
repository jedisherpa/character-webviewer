/**
 * Wizard Joe news-rant — continuous multi-story path matching Robin Speech:
 *   prepare → story (2 jokes) → speechwriter beats → TTS
 *   refill unplayed stories until Stop or idle timeout.
 *
 * Thin local port so the static Vercel app can call Hetzner without bundling
 * the full RobinSpeech frontend tree.
 *
 * Source catalog is the versioned contract under src/contracts/broadcastSources.js
 * (snapshot of RobinSpeech birdLive) — do not re-declare divergent IDs here.
 */

import {
  BROADCAST_SOURCES,
  isReadyScriptSource,
  isResearchInputSource,
  normalizeBroadcastSourceId,
  sourceById,
} from "../contracts/broadcastSources.js";

export const WIZARD_JOE_RANT_FALLBACK_OPEN =
  "You hit rant. I opened the newsroom file labeled things everybody noticed but nobody said. Buckle up.";

export const WIZARD_JOE_RANT_FALLBACK_EMPTY =
  "The newsroom is quiet right now — no fresh cited stories in the selected feed. Try again in a bit, or switch sources.";

export const WIZARD_JOE_RANT_QUEUE_LIMIT = 5;
export const RANT_IDLE_STOP_DEFAULT_MS = 30 * 60 * 1000;
export const RANT_REFILL_BACKOFF_DEFAULT_MS = 60 * 1000;

export const DEFAULT_RANT_SOURCE_ID = "joe-news-ai";
export const RANT_PREFERENCES_STORAGE_KEY = "robbinPrism.rantPreferences.v2";

/** Same catalog as Prism / RobinSpeech (JoeNEWS ready + FishEye research). */
export const RANT_SOURCES = Object.freeze(
  BROADCAST_SOURCES.filter((s) => s.id !== "manual").map((s) =>
    Object.freeze({
      id: s.id,
      label: s.label,
      description: s.description,
      family: s.family,
      role: s.role,
      requiresResearchToken: s.requiresResearchToken,
      backendQueuePath: s.backendQueuePath,
    }),
  ),
);

export const JOE_NEWS_RANT_SOURCES = Object.freeze(
  RANT_SOURCES.filter((s) => s.family === "joe-news"),
);

const RANT_SOURCE_IDS = new Set(RANT_SOURCES.map((s) => s.id));

export { isReadyScriptSource, isResearchInputSource, normalizeBroadcastSourceId, sourceById };

const RANT_BEAT_TAXONOMY = Object.freeze([
  Object.freeze({ role: "setup", action: "news" }),
  Object.freeze({ role: "payoff", action: "speak" }),
]);

const AVATAR_ACTIONS = new Set([
  "idle", "walk", "run", "sprint", "sneak", "sidestep", "jump", "hop",
  "forward-flip", "backflip", "side-flip", "roll", "tumble", "dance",
  "gesture", "approach", "retreat", "listen", "think", "speak", "reassure",
  "warning", "story", "news", "pose", "reset",
]);

const DIRECTOR_FIELDS = Object.freeze([
  "intention", "action", "hands", "body-weight", "eye-line", "camera",
  "beak/facial-energy", "rhythm", "pause/recovery",
]);

export function normalizeRantSourceId(value) {
  return RANT_SOURCE_IDS.has(value) ? value : DEFAULT_RANT_SOURCE_ID;
}

export function normalizeJoeNewsRantSourceId(value) {
  return normalizeRantSourceId(value);
}

export function normalizeRantPreferences(value) {
  const input = value && typeof value === "object" ? value : {};
  const n = (v, fb, min, max) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fb;
  };
  return {
    topic: typeof input.topic === "string" ? input.topic : "",
    recencyDays: n(input.recencyDays, 7, 1, 30),
    sourceCount: n(input.sourceCount, 5, 2, 8),
    energy: n(input.energy, 4, 1, 5),
    autoResume: typeof input.autoResume === "boolean" ? input.autoResume : true,
    xDraft: typeof input.xDraft === "boolean" ? input.xDraft : false,
    rantSourceId: normalizeRantSourceId(input.rantSourceId),
  };
}

export function readRantPreferences(storage = globalThis.window?.localStorage) {
  if (!storage) return normalizeRantPreferences({});
  try {
    const raw = storage.getItem(RANT_PREFERENCES_STORAGE_KEY);
    if (raw) return normalizeRantPreferences(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return normalizeRantPreferences({});
}

export function writeRantPreferences(value, storage = globalThis.window?.localStorage) {
  const normalized = normalizeRantPreferences(value);
  try {
    storage?.setItem(RANT_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  return normalized;
}

export function rantStoryKey(report) {
  return `${report?.sourceId ?? ""}::${report?.title ?? report?.prompt ?? ""}`;
}

export function filterFreshRantReports(reports, seenKeys) {
  const list = Array.isArray(reports) ? reports : [];
  return list.filter((report) => !seenKeys.has(rantStoryKey(report)));
}

export function rantIdleExpired(lastActivityMs, nowMs, limitMs = RANT_IDLE_STOP_DEFAULT_MS) {
  if (!Number.isFinite(lastActivityMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - lastActivityMs > limitMs;
}

export function waitMs(ms, signal) {
  const delay = Math.max(0, Number(ms) || 0);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Wait cancelled", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener?.("abort", onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Wait cancelled", "AbortError"));
    };
    signal?.addEventListener?.("abort", onAbort, { once: true });
  });
}

export function sanitizeRantSpokenText(value) {
  let text = String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/\[([^\]]+)]\(\s*https?:\/\/[^)\s]+\s*\)/gi, "$1")
    .replace(/\[\s*\^?(?:(?:s|source)\s*)?\d+(?:\s*[,;–—-]\s*(?:(?:s|source)\s*)?\d+)*\s*]/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*|__|~~|`+/g, "")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .trim();

  for (let pass = 0; pass < 4; pass += 1) {
    const next = text.replace(
      /^\s*(?:#{1,6}\s+|[-+*•]\s+|\d{1,2}[.)]\s+|(?:joke|beat|line|source)\s*\d*\s*[:.)-]\s*)/i,
      "",
    );
    if (next === text) break;
    text = next;
  }

  return text
    .replace(/(^|\s)[|#^~*_=`\\<>]+(?=\s|$)/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseRantPerformance(text) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 4) {
    throw new Error("Governed rant must return exactly two paired JOKE/DIRECTOR beats.");
  }
  const jokes = [];
  const directorNotes = [];
  for (let index = 0; index < 2; index += 1) {
    const number = index + 1;
    const joke = new RegExp(`^JOKE\\s*${number}\\s*:\\s*(.+)$`, "i").exec(lines[index * 2]);
    const director = new RegExp(`^DIRECTOR\\s*${number}\\s*:\\s*(.+)$`, "i").exec(lines[index * 2 + 1]);
    if (!joke?.[1] || !director?.[1]) {
      throw new Error("Governed rant returned an out-of-order or malformed JOKE/DIRECTOR pair.");
    }
    const fields = Object.fromEntries(director[1].split(";").map((part) => {
      const separator = part.indexOf("=");
      return separator > 0
        ? [part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim()]
        : ["", ""];
    }));
    if (DIRECTOR_FIELDS.some((field) => !fields[field])) {
      throw new Error("Governed rant returned an incomplete director note.");
    }
    jokes.push(joke[1].trim());
    directorNotes.push(fields);
  }
  return { jokes, directorNotes };
}

function sanitizeDirectorNote(note, fallbackAction) {
  const requested = String(note?.action || "").trim().toLowerCase();
  return {
    action: AVATAR_ACTIONS.has(requested) ? requested : fallbackAction,
  };
}

export function planRantSequence(lines, directorNotes = []) {
  if (!Array.isArray(lines) || lines.length !== 2) {
    throw new Error("rant speechwriter requires exactly two cited lines");
  }
  return lines.map((line, index) => {
    const beat = RANT_BEAT_TAXONOMY[index];
    const spokenText = String(line || "").trim();
    const ttsText = sanitizeRantSpokenText(spokenText);
    if (!ttsText) throw new Error("rant speechwriter line has no speakable text after sanitization");
    return {
      ...beat,
      spokenText,
      ttsText,
      directorNote: sanitizeDirectorNote(directorNotes[index], beat.action),
    };
  });
}

export function beatStageAction(beat) {
  const fromDirector = String(beat?.directorNote?.action || "").trim().toLowerCase();
  if (fromDirector) return fromDirector;
  const fromBeat = String(beat?.action || "").trim().toLowerCase();
  return fromBeat || "speak";
}

export function rantPacketHasRecords(packet) {
  if (packet?.empty === true || packet?.noRecentArticles === true) return false;
  if (Array.isArray(packet?.reports)) return packet.reports.length > 0;
  if (Array.isArray(packet?.items)) return packet.items.length > 0;
  return Number(packet?.sourceCount) > 0 || (Array.isArray(packet?.sources) && packet.sources.length > 0);
}

export function feedItemsFromPacket(packet) {
  const reports = Array.isArray(packet?.reports) ? packet.reports : [];
  if (reports.length) {
    return reports.map((report, index) => {
      const source = Array.isArray(packet?.sources)
        ? packet.sources.find((s) => s.number === report.sourceNumber || s.sourceId === report.sourceId)
          || packet.sources[index]
        : null;
      return {
        key: rantStoryKey(report) || `report-${index}`,
        number: report.number || index + 1,
        title: report.title || source?.title || `Story ${index + 1}`,
        domain: source?.domain || "",
        url: source?.url || "",
        excerpt: String(source?.excerpt || report.prompt || "")
          .replace(/^ROBBINPRISM[\s\S]*?CITED NEWS INPUT[^\n]*\n?/i, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 280),
      };
    });
  }
  const sources = Array.isArray(packet?.sources) ? packet.sources : [];
  return sources.map((source, index) => ({
    key: `${source.sourceId || source.url || index}::${source.title || ""}`,
    number: source.number || index + 1,
    title: source.title || `Item ${index + 1}`,
    domain: source.domain || "",
    url: source.url || "",
    excerpt: String(source.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 280),
  }));
}

export function mergeFeedItems(existing, nextItems) {
  const map = new Map();
  for (const item of existing || []) map.set(item.key, item);
  for (const item of nextItems || []) {
    if (!map.has(item.key)) map.set(item.key, item);
  }
  return [...map.values()];
}

export async function refreshRantSourceFeed(fetchImpl, sourceId, signal, since = "") {
  const normalized = normalizeRantSourceId(sourceId);
  const suffix = since ? `?since=${encodeURIComponent(since)}` : "";
  const response = await fetchImpl(
    `/api/rant/feed/${encodeURIComponent(normalized)}/refresh${suffix}`,
    { method: "POST", signal },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Rant source refresh returned ${response.status}`);
  }
  return payload;
}

export async function loadWizardJoeRantPacket(fetchImpl, settings = {}, opts = {}) {
  const normalized = normalizeRantPreferences({
    ...settings,
    rantSourceId: settings.rantSourceId || DEFAULT_RANT_SOURCE_ID,
    sourceCount: settings.sourceCount || WIZARD_JOE_RANT_QUEUE_LIMIT,
  });

  const source = RANT_SOURCES.find((entry) => entry.id === normalized.rantSourceId);
  // FishEye: hit /api/rant/feed/{id}/refresh so the host pulls api.fisheye.news
  // topic feeds with the server bearer token before prepare builds the packet.
  if (source?.family === "fisheye") {
    await refreshRantSourceFeed(fetchImpl, normalized.rantSourceId, opts.signal);
  }

  const prepareRes = await fetchImpl("/api/rant/prepare", {
    method: "POST",
    body: JSON.stringify({
      topic: normalized.topic.trim() || "the most consequential current story",
      limit: normalized.sourceCount,
      recencyDays: normalized.recencyDays,
      xDraft: normalized.xDraft,
      rantSourceId: normalized.rantSourceId,
    }),
    signal: opts.signal,
  });
  const packet = await prepareRes.json().catch(() => ({}));
  if (!prepareRes.ok || packet.ok === false) {
    throw new Error(packet.error || `Rant research returned ${prepareRes.status}`);
  }

  if (!rantPacketHasRecords(packet)) {
    return {
      empty: true,
      packet,
      reports: [],
      fallbackReason: "empty",
      settings: normalized,
    };
  }

  const reports = Array.isArray(packet.reports) ? packet.reports : [];
  if (!reports.length) {
    return {
      empty: true,
      packet,
      reports: [],
      fallbackReason: "no-reports",
      settings: normalized,
    };
  }

  return { empty: false, packet, reports, settings: normalized };
}

export async function refillWizardJoeRantQueue(fetchImpl, settings, seenKeys, opts = {}) {
  const loaded = await loadWizardJoeRantPacket(fetchImpl, settings, opts);
  if (loaded.empty) return { ...loaded, additions: [] };
  const additions = filterFreshRantReports(loaded.reports, seenKeys);
  return {
    ...loaded,
    empty: additions.length === 0,
    additions,
    fallbackReason: additions.length === 0 ? "no-fresh" : undefined,
  };
}

export async function stageWizardJoeRantReport(fetchImpl, report, opts = {}) {
  const energy = Number.isFinite(opts.energy) ? opts.energy : 4;
  const prompt = String(report?.prompt || "").trim();
  if (!prompt) throw new Error("Rant report is missing a governed prompt");

  const storyRes = await fetchImpl("/api/rant/story", {
    method: "POST",
    body: JSON.stringify({
      prompt: `${prompt}\n\nDelivery energy: ${energy}/5.`,
    }),
    signal: opts.signal,
  });
  const payload = await storyRes.json().catch(() => ({}));
  if (!storyRes.ok || !payload.reply) {
    throw new Error(payload.error || `Governed rant report returned ${storyRes.status}`);
  }
  const performance = parseRantPerformance(payload.reply);
  const beats = planRantSequence(performance.jokes, performance.directorNotes);
  return {
    report: {
      ...report,
      reply: payload.reply,
      jokes: performance.jokes,
      directorNotes: performance.directorNotes,
    },
    beats,
  };
}

export async function prepareWizardJoeRant(fetchImpl, settings = {}, opts = {}) {
  const loaded = await loadWizardJoeRantPacket(fetchImpl, settings, opts);
  if (loaded.empty) {
    return {
      empty: true,
      packet: loaded.packet,
      staged: [],
      fallbackReason: loaded.fallbackReason,
    };
  }
  const maxStories = Math.max(1, Math.min(8, Number(opts.maxStories) || 1));
  const staged = [];
  for (const report of loaded.reports.slice(0, maxStories)) {
    if (opts.signal?.aborted) {
      throw new DOMException("Rant prepare cancelled", "AbortError");
    }
    staged.push(await stageWizardJoeRantReport(fetchImpl, report, {
      energy: loaded.settings.energy,
      signal: opts.signal,
    }));
  }
  return { empty: false, packet: loaded.packet, staged };
}
