/** Shared stage backdrop preference: bull plate vs white studio. */

export const STAGE_BG_STORAGE_KEY = "characterStudio.stageBg.v1";
export const STAGE_BG_BULL = "bull";
export const STAGE_BG_WHITE = "white";

export function normalizeStageBg(value) {
  return value === STAGE_BG_WHITE ? STAGE_BG_WHITE : STAGE_BG_BULL;
}

export function readStageBg() {
  try {
    return normalizeStageBg(localStorage.getItem(STAGE_BG_STORAGE_KEY));
  } catch {
    return STAGE_BG_BULL;
  }
}

export function writeStageBg(value) {
  const next = normalizeStageBg(value);
  try {
    localStorage.setItem(STAGE_BG_STORAGE_KEY, next);
  } catch {
    /* hardened webviews */
  }
  return next;
}

export function toggleStageBg(current) {
  return writeStageBg(current === STAGE_BG_WHITE ? STAGE_BG_BULL : STAGE_BG_WHITE);
}
