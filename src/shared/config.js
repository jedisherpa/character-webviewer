/**
 * Runtime config for the static webviewer.
 *
 * Visualizers (Joe packs + Dragonview) are fully client-side on Vercel.
 * Optional live backend (mic STT, chat, TTS, dual-view) runs on Hetzner.
 *
 * Set at build time:
 *   VITE_LIVE_API_BASE=https://your.hetzner.host
 *
 * Leave empty for offline/static-only mode (default).
 */

export const LIVE_API_BASE = String(import.meta.env.VITE_LIVE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

export const HAS_LIVE_BACKEND = Boolean(LIVE_API_BASE);

/** Absolute URL for a live API path, or null when no backend is configured. */
export function liveApiUrl(path = "/") {
  if (!LIVE_API_BASE) return null;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${LIVE_API_BASE}${p}`;
}

/**
 * fetch wrapper for live API. Throws if backend is not configured.
 * Uses credentials: 'omit' by default (CORS + token headers from Hetzner).
 */
export async function liveFetch(path, opts = {}) {
  const url = liveApiUrl(path);
  if (!url) {
    const err = new Error("Live backend not configured (set VITE_LIVE_API_BASE to Hetzner URL)");
    err.code = "NO_LIVE_BACKEND";
    throw err;
  }
  const headers = {
    ...(opts.body && !(opts.body instanceof FormData)
      ? { "content-type": "application/json" }
      : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(url, {
    ...opts,
    headers,
    mode: "cors",
    credentials: opts.credentials ?? "omit",
  });
  return res;
}

export async function probeLiveBackend(timeoutMs = 2500) {
  if (!HAS_LIVE_BACKEND) {
    return { ok: false, configured: false, status: null, error: "not configured" };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Prefer readiness, fall back to health
    let res = await fetch(liveApiUrl("/api/readiness"), { signal: ctrl.signal, mode: "cors" });
    if (res.status === 404) {
      res = await fetch(liveApiUrl("/api/health"), { signal: ctrl.signal, mode: "cors" });
    }
    clearTimeout(t);
    return {
      ok: res.ok,
      configured: true,
      status: res.status,
      base: LIVE_API_BASE,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: null,
      base: LIVE_API_BASE,
      error: String(e?.message || e),
    };
  }
}
