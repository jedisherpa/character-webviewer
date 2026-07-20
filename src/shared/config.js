/**
 * Runtime config for the static webviewer.
 *
 * Visualizers (Joe packs + Dragonview) are fully client-side on Vercel.
 * Optional live backend (mic STT, chat, TTS, dual-view) runs on Hetzner.
 *
 * Set at build time:
 *   VITE_LIVE_API_BASE=https://41birdlive.5.78.137.112.sslip.io
 *   VITE_BIRD_LIVE_URL=https://41birdlive.5.78.137.112.sslip.io
 *
 * Leave empty for offline/static-only mode (default).
 */

export const LIVE_API_BASE = String(import.meta.env.VITE_LIVE_API_BASE || "")
  .trim()
  .replace(/\/+$/, "");

/** Full 41BirdLive SPA (one-bird Prism runtime UI) — open in hub / iframe. */
export const BIRD_LIVE_URL = String(
  import.meta.env.VITE_BIRD_LIVE_URL || import.meta.env.VITE_LIVE_API_BASE || "",
)
  .trim()
  .replace(/\/+$/, "");

export const HAS_LIVE_BACKEND = Boolean(LIVE_API_BASE);
export const HAS_BIRD_LIVE = Boolean(BIRD_LIVE_URL);

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

export async function probeBirdLive(timeoutMs = 2500) {
  if (!HAS_BIRD_LIVE) {
    return { ok: false, configured: false, error: "not configured", url: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(`${BIRD_LIVE_URL}/api/readiness`, {
      signal: ctrl.signal,
      mode: "cors",
    });
    if (res.status === 404) {
      res = await fetch(`${BIRD_LIVE_URL}/api/health`, {
        signal: ctrl.signal,
        mode: "cors",
      });
    }
    // SPA origin may not expose readiness over CORS; treat any network response as up.
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
