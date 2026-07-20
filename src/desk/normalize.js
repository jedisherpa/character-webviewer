/**
 * U0 — Normalize dialogue desk beats for dragonview pose clips.
 *
 * Contract:
 *   - Each beat: speakerClipId (required) + listenerClipId (optional)
 *   - Desk owns order (index is authoritative; no peer negotiation fields)
 *   - Clip ids are dragonview pose_ids, catalog clip names, or short ACT/CAN codes
 */

/** @typedef {'pose'|'clip'|'code'} ClipKind */

/**
 * @typedef {object} DeskClipRef
 * @property {string} id           Original clip id string
 * @property {ClipKind} kind
 * @property {string} [code]       ACT011 / CAN001 when kind=code
 * @property {string} [poseId]     Resolved pose_id when known at normalize time
 * @property {string} [clipName]   Named choreography clip (walk_forward, …)
 */

/**
 * @typedef {object} DialogueDeskBeat
 * @property {string} beatId
 * @property {number} index            Desk-owned order (0-based, contiguous after normalize)
 * @property {DeskClipRef} speaker
 * @property {DeskClipRef|null} listener
 * @property {string} [speakerActor]   Cast id (dragon|kingfisher|wizardjoe|prism|speech)
 * @property {string} [listenerActor]
 * @property {number} holdMs
 * @property {string} [title]
 * @property {string} [notes]
 * @property {string} [source]         Provenance tag (recipe id, import, …)
 */

/**
 * @typedef {object} NormalizeOptions
 * @property {Iterable<string>|string[]|Set<string>} [knownPoseIds]
 * @property {Iterable<string>|string[]|Set<string>} [knownClipNames]
 * @property {string} [defaultSpeakerActor]
 * @property {string} [defaultListenerActor]
 * @property {number} [defaultHoldMs]
 */

const CAST = new Set(["dragon", "kingfisher", "wizardjoe", "prism", "speech"]);
const CODE_RE = /^(ACT|CAN|FLY|INT)(\d{1,3})$/i;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function cleanId(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * @param {unknown} value
 * @param {string} fallback
 */
export function cleanActor(value, fallback = "dragon") {
  const id = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "");
  if (id === "joe" || id === "wizard" || id === "wj") return "wizardjoe";
  if (id === "kf") return "kingfisher";
  if (id === "dr" || id === "drg") return "dragon";
  if (CAST.has(id)) return id;
  return fallback;
}

/**
 * @param {unknown} value
 * @param {number} fallback
 */
export function cleanHoldMs(value, fallback = 1600) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(120, Math.min(60_000, Math.round(n)));
}

/**
 * Classify a raw clip id without requiring a catalog.
 * @param {unknown} raw
 * @param {NormalizeOptions} [opts]
 * @returns {DeskClipRef|null}
 */
export function normalizeClipRef(raw, opts = {}) {
  const id = cleanId(raw);
  if (!id) return null;

  const poseSet = toSet(opts.knownPoseIds);
  const clipSet = toSet(opts.knownClipNames);

  if (poseSet.has(id)) {
    return { id, kind: "pose", poseId: id };
  }
  if (clipSet.has(id)) {
    return { id, kind: "clip", clipName: id };
  }

  const codeMatch = id.match(CODE_RE);
  if (codeMatch) {
    const family = codeMatch[1].toUpperCase();
    const num = codeMatch[2].padStart(3, "0");
    const code = `${family}${num}`;
    // Try soft resolve against known pose ids (substring ACT011 / act011)
    const needle = `${family.toLowerCase()}${num}`;
    let poseId;
    for (const pid of poseSet) {
      if (pid.toLowerCase().includes(needle)) {
        poseId = pid;
        break;
      }
    }
    return { id: code, kind: "code", code, poseId };
  }

  // Prefer clip name when it looks like a loop id; else treat as pose id candidate.
  if (/^(walk|fly|dance|magic|clip)_/i.test(id) || id.includes("_forward") || id.includes("_loop")) {
    return { id, kind: "clip", clipName: id };
  }
  return { id, kind: "pose", poseId: id };
}

/**
 * Normalize one raw beat. Desk order is applied later by normalizeBeatList.
 * Accepts several wire shapes used by recipes / imports.
 *
 * @param {unknown} raw
 * @param {NormalizeOptions} [opts]
 * @returns {DialogueDeskBeat|null}
 */
export function normalizeBeat(raw, opts = {}) {
  if (!raw || typeof raw !== "object") return null;
  const o = /** @type {Record<string, unknown>} */ (raw);

  const speakerRaw =
    o.speakerClipId ??
    o.speaker_clip_id ??
    o.speakerClip ??
    o.speaker ??
    o.phraseKey ??
    o.poseId ??
    null;
  const listenerRaw =
    o.listenerClipId ??
    o.listener_clip_id ??
    o.listenerClip ??
    o.listener ??
    null;

  const speaker = normalizeClipRef(speakerRaw, opts);
  if (!speaker) return null;

  const listener = listenerRaw == null || listenerRaw === ""
    ? null
    : normalizeClipRef(listenerRaw, opts);

  const defaultSpeaker = opts.defaultSpeakerActor || "dragon";
  const defaultListener = opts.defaultListenerActor || "wizardjoe";

  const beatId = cleanId(o.beatId ?? o.id ?? o.beat_id) || `beat_${Math.random().toString(36).slice(2, 8)}`;
  const holdMs = cleanHoldMs(o.holdMs ?? o.hold_ms ?? o.durationMs, opts.defaultHoldMs ?? 1600);

  return {
    beatId,
    index: Number.isFinite(Number(o.index)) ? Math.max(0, Math.floor(Number(o.index))) : -1,
    speaker,
    listener,
    speakerActor: cleanActor(o.speakerActor ?? o.speaker_actor ?? o.floorOwner, defaultSpeaker),
    listenerActor: listener
      ? cleanActor(o.listenerActor ?? o.listener_actor, defaultListener)
      : undefined,
    holdMs,
    title: o.title != null ? String(o.title).trim() : undefined,
    notes: o.notes != null ? String(o.notes).trim() : undefined,
    source: o.source != null ? String(o.source).trim() : undefined,
  };
}

/**
 * Desk owns order: output indices are 0..n-1 in list order.
 * Peer fields (peerId, peerOrder, remoteSeq) are dropped.
 *
 * @param {unknown} rawList
 * @param {NormalizeOptions} [opts]
 * @returns {{ beats: DialogueDeskBeat[], rejected: { raw: unknown, reason: string }[] }}
 */
export function normalizeBeatList(rawList, opts = {}) {
  const rejected = [];
  const beats = [];
  if (!Array.isArray(rawList)) {
    return { beats: [], rejected: [{ raw: rawList, reason: "not_an_array" }] };
  }
  for (const raw of rawList) {
    // Explicitly strip peer negotiation fields before normalize.
    if (raw && typeof raw === "object") {
      const {
        peerId: _p,
        peerOrder: _po,
        remoteSeq: _rs,
        peer: _peer,
        ...rest
      } = /** @type {Record<string, unknown>} */ (raw);
      const beat = normalizeBeat(rest, opts);
      if (!beat) {
        rejected.push({ raw, reason: "missing_speakerClipId" });
        continue;
      }
      beats.push(beat);
    } else {
      rejected.push({ raw, reason: "invalid_beat" });
    }
  }
  // Desk order = array order (not raw index field).
  const ordered = beats.map((b, index) => ({ ...b, index }));
  return { beats: ordered, rejected };
}

/**
 * @param {Iterable<string>|string[]|Set<string>|undefined} value
 * @returns {Set<string>}
 */
function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  return new Set([...value].map(String));
}
