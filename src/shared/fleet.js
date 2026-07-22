/**
 * Public fleet hosts shown on the Character Studio hub.
 * Build-time env overrides win; these are the known production defaults.
 */

function stripSlash(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

/** NewsWiz / Wizard Joe speech runtime */
export const FLEET_NEWSWIZ =
  stripSlash(import.meta.env.VITE_NEWSWIZ_URL) ||
  stripSlash(import.meta.env.VITE_LIVE_API_BASE) ||
  "https://newswiz.5.78.137.112.sslip.io";

/** 41BirdLive / Robin one-bird */
export const FLEET_BIRD_LIVE =
  stripSlash(import.meta.env.VITE_BIRD_LIVE_URL) ||
  "https://41birdlive.5.78.137.112.sslip.io";

export const FLEET_WIZARDJOE =
  stripSlash(import.meta.env.VITE_WIZARDJOE_URL) ||
  "https://wizardjoe.5.78.137.112.sslip.io";

export const FLEET_JOE_NEWSROOM =
  stripSlash(import.meta.env.VITE_JOE_NEWSROOM_URL) ||
  "https://joe-newsroom.5.78.137.112.sslip.io";

export const FLEET_JOE_NEWSROOM_GENERAL =
  stripSlash(import.meta.env.VITE_JOE_NEWSROOM_GENERAL_URL) ||
  "https://joe-newsroom-general.5.78.137.112.sslip.io";

export const FLEET_API_SOVEREIGN =
  stripSlash(import.meta.env.VITE_API_SOVEREIGN_URL) ||
  "https://api.sovereignai.design";

/** This Character Studio deployment (for absolute links in the fleet list). */
export const FLEET_STUDIO =
  stripSlash(import.meta.env.VITE_STUDIO_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "https://character-webviewer.vercel.app");

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   badge: string,
 *   blurb: string,
 *   accent: string,
 *   href?: string,
 *   to?: string,
 *   probe?: 'health' | 'origin' | null,
 * }} FleetEntry
 */

/** In-app Character Studio routes */
export const STUDIO_CARDS = Object.freeze([
  {
    id: "studio",
    to: "/studio",
    title: "Production Studio",
    badge: "primary",
    blurb: "Full-stage bay · sequences · gamepad · cast switch",
    accent: "amber",
  },
  {
    id: "joe-hd",
    to: "/joe/alpha-hd",
    title: "Wizard Joe · Alpha HD",
    badge: "960×540",
    blurb: "Pose studio · NewsWiz embed for live rant",
    accent: "violet",
  },
  {
    id: "dragon",
    to: "/dragon",
    title: "Dragonview",
    badge: "5-cast",
    blurb: "Multi-cast world pad · walk/fly · bull stage",
    accent: "slate",
  },
  {
    id: "joe-250",
    to: "/joe/base250",
    title: "Wizard Joe · Base 250",
    badge: "legacy",
    blurb: "Side-by-side compare pack",
    accent: "slate",
  },
  {
    id: "bird-embed",
    to: "/41birdlive",
    title: "41 Bird Live (embed)",
    badge: "Robin",
    blurb: "Iframe of the Hetzner Robin SPA from this hub",
    accent: "teal",
  },
]);

/** External HTTPS fleet — open in a new tab */
export const FLEET_CARDS = Object.freeze([
  {
    id: "newswiz",
    title: "NewsWiz",
    badge: "live",
    blurb: "Wizard Joe speech/news CLI · session tokens · rant / TTS",
    accent: "violet",
    href: FLEET_NEWSWIZ,
    probe: "health",
  },
  {
    id: "41birdlive",
    title: "41 Bird Live",
    badge: "Robin",
    blurb: "One-bird Prism runtime · Charging Bull stage",
    accent: "teal",
    href: FLEET_BIRD_LIVE,
    probe: "health",
  },
  {
    id: "wizardjoe",
    title: "Wizard Joe host",
    badge: "SPA",
    blurb: "wizardjoe.sslip.io public host",
    accent: "violet",
    href: FLEET_WIZARDJOE,
    probe: "origin",
  },
  {
    id: "joe-newsroom",
    title: "Joe Newsroom",
    badge: "news",
    blurb: "joe-newsroom.sslip.io newsroom surface",
    accent: "amber",
    href: FLEET_JOE_NEWSROOM,
    probe: "origin",
  },
  {
    id: "joe-newsroom-general",
    title: "Joe Newsroom General",
    badge: "news",
    blurb: "General newsroom feed host",
    accent: "amber",
    href: FLEET_JOE_NEWSROOM_GENERAL,
    probe: "origin",
  },
  {
    id: "api-sovereign",
    title: "Sovereign API",
    badge: "api",
    blurb: "api.sovereignai.design",
    accent: "slate",
    href: FLEET_API_SOVEREIGN,
    probe: "origin",
  },
  {
    id: "studio-home",
    title: "Character Studio hub",
    badge: "this app",
    blurb: "This Vercel app home",
    accent: "teal",
    href: "https://character-webviewer.vercel.app/",
    probe: "origin",
  },
  {
    id: "studio-dragon",
    title: "Dragonview (Vercel)",
    badge: "5-cast",
    blurb: "Full-screen multi-cast viewer on Vercel",
    accent: "slate",
    href: "https://character-webviewer.vercel.app/dragon",
    probe: "origin",
  },
]);

/**
 * Lightweight reachability probe (CORS-tolerant: any HTTP response = up).
 * @param {string} origin
 * @param {'health'|'origin'|null} mode
 * @param {number} [timeoutMs]
 */
export async function probeFleetOrigin(origin, mode = "origin", timeoutMs = 2500) {
  const base = stripSlash(origin);
  if (!base) {
    return { ok: false, configured: false, error: "not set", url: null, status: null };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const urls =
    mode === "health"
      ? [`${base}/api/health`, `${base}/api/readiness`, `${base}/`]
      : [`${base}/`, `${base}/api/health`];
  try {
    let lastStatus = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          signal: ctrl.signal,
          mode: "cors",
          method: "GET",
        });
        lastStatus = res.status;
        // Any response means the host answered (CORS may hide body).
        if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) {
          clearTimeout(t);
          return {
            ok: res.ok || res.status === 401 || res.status === 403,
            configured: true,
            status: res.status,
            url: base,
            error: res.ok || res.status === 401 || res.status === 403 ? null : `HTTP ${res.status}`,
          };
        }
        // 502/503 = host up, upstream bad
        if (res.status >= 500) {
          clearTimeout(t);
          return {
            ok: false,
            configured: true,
            status: res.status,
            url: base,
            error: `HTTP ${res.status}`,
          };
        }
      } catch {
        /* try next path */
      }
    }
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: lastStatus,
      url: base,
      error: lastStatus ? `HTTP ${lastStatus}` : "unreachable",
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      configured: true,
      status: null,
      url: base,
      error: String(e?.message || e),
    };
  }
}
