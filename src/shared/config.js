/**
 * Runtime config for Character Studio ↔ NewsWiz / 41 Bird Live.
 *
 * Live API strategy:
 * - Dev: Vite proxies `/api/*` → NewsWiz (same-origin to the studio).
 * - Prod: prefer same-origin `/api/*` when Vercel rewrites proxy NewsWiz;
 *   otherwise call NEWSWIZ_URL cross-origin (CORS already allowlists this app).
 * - Secrets never live in the bundle; session tokens are fetched at runtime.
 */

import { FLEET_BIRD_LIVE, FLEET_NEWSWIZ } from "./fleet.js";

export const NEWSWIZ_URL = String(
  import.meta.env.VITE_NEWSWIZ_URL
    || import.meta.env.VITE_LIVE_API_BASE
    || FLEET_NEWSWIZ
    || "",
)
  .trim()
  .replace(/\/+$/, "");

/** Full 41BirdLive SPA — hub / iframe. */
export const BIRD_LIVE_URL = String(
  import.meta.env.VITE_BIRD_LIVE_URL || FLEET_BIRD_LIVE || "",
)
  .trim()
  .replace(/\/+$/, "");

/**
 * When true, browser uses relative `/api/...` (Vite/Vercel proxy).
 * Default true in dev; set VITE_LIVE_API_PROXY=1 in prod with vercel.json rewrites.
 */
export const USE_LIVE_PROXY = (() => {
  const v = String(import.meta.env.VITE_LIVE_API_PROXY ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return Boolean(import.meta.env.DEV);
})();

export const LIVE_API_BASE = USE_LIVE_PROXY ? "" : NEWSWIZ_URL;

export const HAS_NEWSWIZ = Boolean(NEWSWIZ_URL) || USE_LIVE_PROXY;
export const HAS_LIVE_BACKEND = HAS_NEWSWIZ;
export const HAS_BIRD_LIVE = Boolean(BIRD_LIVE_URL);

export function newswizUrl(path = "/") {
  if (USE_LIVE_PROXY) {
    if (!path || path === "/") return "/";
    return path.startsWith("/") ? path : `/${path}`;
  }
  if (!NEWSWIZ_URL) return null;
  if (!path || path === "/") return NEWSWIZ_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${NEWSWIZ_URL}${p}`;
}

export function liveApiUrl(path = "/") {
  return newswizUrl(path);
}

let _sessionToken = null;
let _sessionPromise = null;

/** Cached runtime session token (never baked into the build). */
export function getSessionToken() {
  return _sessionToken;
}

export async function ensureSessionToken() {
  if (_sessionToken) return _sessionToken;
  if (_sessionPromise) return _sessionPromise;
  _sessionPromise = (async () => {
    const url = liveApiUrl("/api/session/token");
    if (!url) return null;
    try {
      const res = await fetch(url, {
        method: "GET",
        mode: USE_LIVE_PROXY ? "same-origin" : "cors",
        credentials: "omit",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const token =
        data.token || data.apiToken || data.api_token || data.sessionToken || null;
      if (typeof token === "string" && token.length > 8) {
        _sessionToken = token;
        return token;
      }
      // Some hosts return the raw token as text
      const text = typeof data === "string" ? data : "";
      if (text && text.length > 8 && !text.startsWith("{")) {
        _sessionToken = text.trim();
        return _sessionToken;
      }
    } catch {
      /* public endpoints may still work without a token */
    }
    return null;
  })();
  try {
    return await _sessionPromise;
  } finally {
    _sessionPromise = null;
  }
}

/**
 * Live API fetch to NewsWiz / 41 Bird Live backend.
 * Uses proxy in dev; CORS to NEWSWIZ_URL in production when proxy off.
 */
export async function liveFetch(path, init = {}) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = liveApiUrl(p);
  if (!url && url !== "") {
    const err = new Error("Live backend not configured (set VITE_NEWSWIZ_URL).");
    err.code = "LIVE_NOT_CONFIGURED";
    throw err;
  }
  const token = await ensureSessionToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (token && !headers.has("x-prism-token")) {
    headers.set("x-prism-token", token);
  }
  // Don't force JSON content-type on FormData
  const body = init.body;
  if (body && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    ...init,
    headers,
    mode: USE_LIVE_PROXY ? "same-origin" : "cors",
    credentials: "omit",
  });
  return res;
}

export async function probeNewswiz(timeoutMs = 2500) {
  if (!HAS_NEWSWIZ) {
    return { ok: false, configured: false, error: "not configured", url: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const healthUrl = liveApiUrl("/api/health");
  try {
    let res = await fetch(healthUrl, {
      signal: ctrl.signal,
      mode: USE_LIVE_PROXY ? "same-origin" : "cors",
    });
    if (res.status === 404) {
      res = await fetch(liveApiUrl("/api/readiness"), {
        signal: ctrl.signal,
        mode: USE_LIVE_PROXY ? "same-origin" : "cors",
      });
    }
    clearTimeout(t);
    return {
      ok: res.ok || res.status === 200 || res.status === 401 || res.status === 403,
      configured: true,
      status: res.status,
      url: NEWSWIZ_URL || healthUrl,
      proxy: USE_LIVE_PROXY,
      error: res.ok || res.status === 403 || res.status === 401 ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: null,
      url: NEWSWIZ_URL || healthUrl,
      proxy: USE_LIVE_PROXY,
      error: String(e?.message || e),
    };
  }
}

export async function probeLiveBackend(timeoutMs = 2500) {
  return probeNewswiz(timeoutMs);
}

export async function probeBirdLive(timeoutMs = 2500) {
  if (!HAS_BIRD_LIVE) {
    return { ok: false, configured: false, error: "not configured", url: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(`${BIRD_LIVE_URL}/api/health`, {
      signal: ctrl.signal,
      mode: "cors",
    });
    if (res.status === 404) {
      res = await fetch(`${BIRD_LIVE_URL}/api/readiness`, {
        signal: ctrl.signal,
        mode: "cors",
      });
    }
    clearTimeout(t);
    return {
      ok: res.ok || res.status === 200 || res.status === 401 || res.status === 403,
      configured: true,
      status: res.status,
      url: BIRD_LIVE_URL,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: null,
      url: BIRD_LIVE_URL,
      error: String(e?.message || e),
    };
  }
}
