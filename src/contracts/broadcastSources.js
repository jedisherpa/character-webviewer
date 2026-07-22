/**
 * Versioned offline snapshot of RobinSpeech birdLive broadcast sources.
 * Live calls remain same-origin/backend-proxied via NEWSWIZ_URL; never upstream.
 */
import { CONTRACT_SCHEMA_VERSION, PRODUCER_REF } from "./schemaVersion.js";

export const BROADCAST_SOURCE_CONTRACT = Object.freeze({
  schemaVersion: CONTRACT_SCHEMA_VERSION,
  producerRef: PRODUCER_REF,
  storageKey: "cw.broadcastSources.v1",
});

/** @typedef {"manual" | "joe-news-ai" | "joe-news-general" | "bitcoin-fed" | "ai-innovation" | "world-cup"} BroadcastSourceId */

/**
 * @typedef {Object} BroadcastSourceDefinition
 * @property {BroadcastSourceId} id
 * @property {string} label
 * @property {string} description
 * @property {"manual" | "joe-news" | "fisheye"} family
 * @property {"ready-script" | "research-input" | "manual"} role
 * @property {string | null} backendQueuePath
 * @property {string | null} backendRefreshPath
 * @property {boolean} requiresResearchToken
 * @property {boolean} defaultEnabled
 */

/** @type {ReadonlyArray<Readonly<BroadcastSourceDefinition>>} */
export const BROADCAST_SOURCES = Object.freeze([
  Object.freeze({
    id: "manual",
    label: "Manual only",
    description: "Operator prompts and local media. Always available offline.",
    family: "manual",
    role: "manual",
    backendQueuePath: null,
    backendRefreshPath: null,
    requiresResearchToken: false,
    defaultEnabled: true,
  }),
  Object.freeze({
    id: "joe-news-ai",
    label: "JoeNEWS AI",
    description: "Prepared AI news scripts (backend-proxied ready queue).",
    family: "joe-news",
    role: "ready-script",
    backendQueuePath: "/api/rant/feed/joe-news-ai",
    backendRefreshPath: "/api/rant/feed/joe-news-ai/refresh",
    requiresResearchToken: false,
    defaultEnabled: false,
  }),
  Object.freeze({
    id: "joe-news-general",
    label: "JoeNEWS General",
    description: "Prepared general-news scripts (isolated cursor/queue).",
    family: "joe-news",
    role: "ready-script",
    backendQueuePath: "/api/rant/feed/joe-news-general",
    backendRefreshPath: "/api/rant/feed/joe-news-general/refresh",
    requiresResearchToken: false,
    defaultEnabled: false,
  }),
  Object.freeze({
    id: "bitcoin-fed",
    label: "Bitcoin & Fed",
    description: "Research input only until governed script preparation.",
    family: "fisheye",
    role: "research-input",
    backendQueuePath: "/api/rant/feed/bitcoin-fed",
    backendRefreshPath: "/api/rant/feed/bitcoin-fed/refresh",
    requiresResearchToken: true,
    defaultEnabled: false,
  }),
  Object.freeze({
    id: "ai-innovation",
    label: "AI Innovation",
    description: "Research input only until governed script preparation.",
    family: "fisheye",
    role: "research-input",
    backendQueuePath: "/api/rant/feed/ai-innovation",
    backendRefreshPath: "/api/rant/feed/ai-innovation/refresh",
    requiresResearchToken: true,
    defaultEnabled: false,
  }),
  Object.freeze({
    id: "world-cup",
    label: "World Cup",
    description: "Research input only until governed script preparation.",
    family: "fisheye",
    role: "research-input",
    backendQueuePath: "/api/rant/feed/world-cup",
    backendRefreshPath: "/api/rant/feed/world-cup/refresh",
    requiresResearchToken: true,
    defaultEnabled: false,
  }),
]);

const SOURCE_IDS = new Set(BROADCAST_SOURCES.map((s) => s.id));

export function defaultSourceEnabledMap() {
  /** @type {Record<string, boolean>} */
  const map = {};
  for (const s of BROADCAST_SOURCES) map[s.id] = Boolean(s.defaultEnabled);
  map.manual = true;
  return map;
}

export function normalizeSourceEnabledMap(raw) {
  const base = defaultSourceEnabledMap();
  if (!raw || typeof raw !== "object") return base;
  for (const s of BROADCAST_SOURCES) {
    if (s.id === "manual") {
      base.manual = true;
      continue;
    }
    if (typeof raw[s.id] === "boolean") base[s.id] = raw[s.id];
  }
  return base;
}

/** Enabling a source must never touch Preview or Program. */
export function toggleSourceEnabled(enabledMap, id, enabled) {
  const next = { ...normalizeSourceEnabledMap(enabledMap) };
  if (id === "manual" || !SOURCE_IDS.has(id)) {
    next.manual = true;
    return next;
  }
  next[id] = Boolean(enabled);
  return next;
}

export function normalizeBroadcastSourceId(id) {
  return SOURCE_IDS.has(id) ? id : "manual";
}

export function sourceById(id) {
  return BROADCAST_SOURCES.find((s) => s.id === id) || BROADCAST_SOURCES[0];
}

export function isReadyScriptSource(id) {
  return sourceById(id).role === "ready-script";
}

export function isResearchInputSource(id) {
  return sourceById(id).role === "research-input";
}
