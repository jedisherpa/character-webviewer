#!/usr/bin/env node
/**
 * Live integration smoke: fleet health + Joe ready feed + optional local proxy.
 * Does not print secrets.
 */
import assert from "node:assert/strict";

const NEWSWIZ = process.env.VITE_NEWSWIZ_URL || "https://newswiz.5.78.137.112.sslip.io";
const BIRD = process.env.VITE_BIRD_LIVE_URL || "https://41birdlive.5.78.137.112.sslip.io";
const JOE = process.env.VITE_JOE_NEWSROOM_URL || "https://joe-newsroom.5.78.137.112.sslip.io";

async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { Accept: "application/json", ...(opts.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-json */
  }
  return { res, text, json };
}

function ok(name, cond, detail = "") {
  if (cond) console.log(`ok - ${name}${detail ? ` (${detail})` : ""}`);
  else {
    console.error(`not ok - ${name}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
  }
}

const r1 = await getJson(`${NEWSWIZ}/api/health`);
ok("NewsWiz health", r1.res.ok && r1.json?.ok === true, `status ${r1.res.status}`);

const r2 = await getJson(`${BIRD}/api/health`);
ok("41 Bird Live health", r2.res.ok && r2.json?.ok === true, `status ${r2.res.status}`);

const r3 = await getJson(`${JOE}/v1/news-feed/ready?limit=1`);
ok(
  "JoeNEWS ready feed v1",
  r3.res.ok && r3.json?.schema_version === "joe.ready-news-feed.v1",
  `items=${r3.json?.items?.length ?? 0}`,
);

const r4 = await getJson(`${NEWSWIZ}/api/rant/sources`, {
  headers: { Origin: "http://localhost:4400" },
});
ok("NewsWiz rant sources", r4.res.ok && r4.json?.ok === true, `selected=${r4.json?.selectedSourceId}`);

const ids = (r4.json?.sources || []).map((s) => s.id);
ok("JoeNEWS AI source registered", ids.includes("joe-news-ai"));
ok("JoeNEWS General source registered", ids.includes("joe-news-general"));

// Local CW proxy (if dev server up)
try {
  const local = await getJson("http://127.0.0.1:4400/api/health");
  ok("CW vite proxy → NewsWiz /api/health", local.res.ok && local.json?.ok === true);
} catch (e) {
  console.log(`skip - CW vite proxy (dev server not up: ${e.message})`);
}

// Contract package still loads
const { WIZARD_JOE_NATE_PROFILE } = await import("../src/contracts/voiceProfiles.js");
ok(
  "CW Nate profile still multilingual v2 @ 0.9",
  WIZARD_JOE_NATE_PROFILE.modelId === "eleven_multilingual_v2"
    && WIZARD_JOE_NATE_PROFILE.voiceSettings.speed === 0.9
    && WIZARD_JOE_NATE_PROFILE.voiceId === "Ifu36BnEjjIY932etsqk",
);

if (process.exitCode) {
  console.error("smoke-live-integration FAILED");
  process.exit(1);
}
console.log("smoke-live-integration passed");
