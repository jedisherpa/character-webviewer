/**
 * Runtime config for the static webviewer.
 *
 * Visualizers (Joe packs + Dragonview) are fully client-side on Vercel.
 * Live speech/news is NOT called cross-origin. Character Studio embeds or
 * opens NewsWiz (Wizard Joe CLI SPA) so session tokens stay same-origin.
 *
 * Set at build time:
 *   VITE_NEWSWIZ_URL=https://your-newswiz-host   (preferred)
 *   VITE_BIRD_LIVE_URL=https://41birdlive…       (Robin full SPA only)
 *
 * Legacy VITE_LIVE_API_BASE is ignored for API calls — kept only as a
 * fallback candidate for NEWSWIZ_URL if NEWSWIZ_URL is unset.
 */

export const NEWSWIZ_URL = String(
  import.meta.env.VITE_NEWSWIZ_URL
    || import.meta.env.VITE_LIVE_API_BASE
    || "",
)
  .trim()
  .replace(/\/+$/, "");

/** Full 41BirdLive SPA (Robin one-bird) — hub card / open-in-tab only. */
export const BIRD_LIVE_URL = String(
  import.meta.env.VITE_BIRD_LIVE_URL || "",
)
  .trim()
  .replace(/\/+$/, "");

/** @deprecated Use NEWSWIZ_URL — no cross-origin live API from this app. */
export const LIVE_API_BASE = NEWSWIZ_URL;

export const HAS_NEWSWIZ = Boolean(NEWSWIZ_URL);
export const HAS_LIVE_BACKEND = HAS_NEWSWIZ;
export const HAS_BIRD_LIVE = Boolean(BIRD_LIVE_URL);

export function newswizUrl(path = "/") {
  if (!NEWSWIZ_URL) return null;
  if (!path || path === "/") return NEWSWIZ_URL;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${NEWSWIZ_URL}${p}`;
}

/** @deprecated Cross-origin API is disabled. Prefer NewsWiz embed. */
export function liveApiUrl(path = "/") {
  return newswizUrl(path);
}

/**
 * @deprecated Do not call NewsWiz/41BirdLive APIs from Character Studio.
 * Session tokens are same-origin only. Use NewsWizEmbed instead.
 */
export async function liveFetch() {
  const err = new Error(
    "Cross-origin live API disabled. Open NewsWiz same-origin (News panel embed).",
  );
  err.code = "CROSS_ORIGIN_API_DISABLED";
  throw err;
}

export async function probeNewswiz(timeoutMs = 2500) {
  if (!HAS_NEWSWIZ) {
    return { ok: false, configured: false, error: "not configured", url: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res = await fetch(`${NEWSWIZ_URL}/api/health`, {
      signal: ctrl.signal,
      mode: "cors",
    });
    if (res.status === 404) {
      res = await fetch(`${NEWSWIZ_URL}/api/readiness`, {
        signal: ctrl.signal,
        mode: "cors",
      });
    }
    clearTimeout(t);
    // Any HTTP response means the host is reachable (CORS may block body).
    return {
      ok: res.ok || res.status === 200 || res.status === 401 || res.status === 403,
      configured: true,
      status: res.status,
      url: NEWSWIZ_URL,
      error: res.ok || res.status === 403 || res.status === 401 ? null : `HTTP ${res.status}`,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: null,
      url: NEWSWIZ_URL,
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
