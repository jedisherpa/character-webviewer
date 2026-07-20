/**
 * Dialogue Desk — sole authority for beat order.
 * No peer negotiation: append / move / remove only through desk methods.
 */

import { normalizeBeat, normalizeBeatList, cleanHoldMs } from "./normalize.js";

/**
 * @typedef {import('./normalize.js').DialogueDeskBeat} DialogueDeskBeat
 * @typedef {import('./normalize.js').NormalizeOptions} NormalizeOptions
 */

export class DialogueDesk {
  /**
   * @param {object} [opts]
   * @param {NormalizeOptions} [opts.normalize]
   * @param {string} [opts.id]
   */
  constructor(opts = {}) {
    this.id = opts.id || `desk_${Date.now().toString(36)}`;
    /** @type {NormalizeOptions} */
    this.normalizeOpts = opts.normalize || {};
    /** @type {DialogueDeskBeat[]} */
    this._beats = [];
    /** @type {number} */
    this.cursor = 0;
    /** @type {((ev: { type: string, desk: DialogueDesk, beat?: DialogueDeskBeat|null, index?: number }) => void)[]} */
    this._listeners = [];
  }

  /** Snapshot copy — external mutation never reorders desk. */
  get beats() {
    return this._beats.map((b) => ({ ...b, speaker: { ...b.speaker }, listener: b.listener ? { ...b.listener } : null }));
  }

  get length() {
    return this._beats.length;
  }

  get current() {
    if (this.cursor < 0 || this.cursor >= this._beats.length) return null;
    return this._beats[this.cursor];
  }

  /**
   * Replace entire ordered list (import / load). Desk reindexes.
   * @param {unknown} rawList
   */
  load(rawList) {
    const { beats, rejected } = normalizeBeatList(rawList, this.normalizeOpts);
    this._beats = beats;
    this.cursor = 0;
    this._emit("load");
    return { beats: this.beats, rejected };
  }

  /**
   * Append one beat at end (desk order).
   * @param {unknown} raw
   */
  append(raw) {
    const beat = normalizeBeat(raw, this.normalizeOpts);
    if (!beat) return null;
    beat.index = this._beats.length;
    this._beats.push(beat);
    this._emit("append", beat, beat.index);
    return beat;
  }

  /**
   * Insert at desk index (clamped).
   * @param {number} index
   * @param {unknown} raw
   */
  insert(index, raw) {
    const beat = normalizeBeat(raw, this.normalizeOpts);
    if (!beat) return null;
    const i = Math.max(0, Math.min(this._beats.length, Math.floor(Number(index) || 0)));
    this._beats.splice(i, 0, beat);
    this._reindex();
    this._emit("insert", beat, i);
    return this._beats[i];
  }

  /**
   * Move beat from → to (desk owns order).
   * @param {number} from
   * @param {number} to
   */
  move(from, to) {
    const a = Math.floor(Number(from));
    const b = Math.floor(Number(to));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    if (a < 0 || a >= this._beats.length) return false;
    const [item] = this._beats.splice(a, 1);
    const dest = Math.max(0, Math.min(this._beats.length, b));
    this._beats.splice(dest, 0, item);
    this._reindex();
    if (this.cursor === a) this.cursor = dest;
    else if (a < this.cursor && dest >= this.cursor) this.cursor -= 1;
    else if (a > this.cursor && dest <= this.cursor) this.cursor += 1;
    this._emit("move", item, dest);
    return true;
  }

  /**
   * @param {number} index
   */
  remove(index) {
    const i = Math.floor(Number(index));
    if (i < 0 || i >= this._beats.length) return null;
    const [removed] = this._beats.splice(i, 1);
    this._reindex();
    if (this.cursor >= this._beats.length) this.cursor = Math.max(0, this._beats.length - 1);
    this._emit("remove", removed, i);
    return removed;
  }

  clear() {
    this._beats = [];
    this.cursor = 0;
    this._emit("clear");
  }

  /**
   * @param {number} index
   * @param {Partial<{ holdMs: number, title: string, notes: string, speakerClipId: string, listenerClipId: string|null, speakerActor: string, listenerActor: string }>} patch
   */
  update(index, patch = {}) {
    const i = Math.floor(Number(index));
    if (i < 0 || i >= this._beats.length) return null;
    const prev = this._beats[i];
    const raw = {
      beatId: prev.beatId,
      speakerClipId: patch.speakerClipId ?? prev.speaker.id,
      listenerClipId:
        patch.listenerClipId === null
          ? null
          : patch.listenerClipId !== undefined
            ? patch.listenerClipId
            : prev.listener?.id ?? null,
      speakerActor: patch.speakerActor ?? prev.speakerActor,
      listenerActor: patch.listenerActor ?? prev.listenerActor,
      holdMs: patch.holdMs ?? prev.holdMs,
      title: patch.title ?? prev.title,
      notes: patch.notes ?? prev.notes,
      source: prev.source,
    };
    const next = normalizeBeat(raw, this.normalizeOpts);
    if (!next) return null;
    next.index = i;
    this._beats[i] = next;
    this._emit("update", next, i);
    return next;
  }

  seek(index) {
    const i = Math.floor(Number(index));
    if (!this._beats.length) {
      this.cursor = 0;
      return null;
    }
    this.cursor = Math.max(0, Math.min(this._beats.length - 1, i));
    this._emit("seek", this.current, this.cursor);
    return this.current;
  }

  /** Advance cursor; returns next beat or null at end. */
  next() {
    if (this.cursor + 1 >= this._beats.length) return null;
    this.cursor += 1;
    this._emit("seek", this.current, this.cursor);
    return this.current;
  }

  resetCursor() {
    this.cursor = 0;
    this._emit("seek", this.current, this.cursor);
    return this.current;
  }

  /**
   * Export desk-owned ordered payload (no peer fields).
   * @returns {object}
   */
  toJSON() {
    return {
      schemaVersion: 1,
      deskId: this.id,
      authority: "desk",
      peer: null,
      cursor: this.cursor,
      beats: this._beats.map((b) => ({
        beatId: b.beatId,
        index: b.index,
        speakerClipId: b.speaker.id,
        listenerClipId: b.listener?.id ?? null,
        speakerActor: b.speakerActor,
        listenerActor: b.listenerActor ?? null,
        holdMs: b.holdMs,
        title: b.title ?? null,
        notes: b.notes ?? null,
        source: b.source ?? null,
      })),
    };
  }

  /**
   * @param {(ev: { type: string, desk: DialogueDesk, beat?: DialogueDeskBeat|null, index?: number }) => void} fn
   */
  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((x) => x !== fn);
    };
  }

  _reindex() {
    this._beats = this._beats.map((b, index) => ({ ...b, index }));
  }

  /**
   * @param {string} type
   * @param {DialogueDeskBeat|null} [beat]
   * @param {number} [index]
   */
  _emit(type, beat = null, index = undefined) {
    const ev = { type, desk: this, beat, index };
    for (const fn of this._listeners) {
      try {
        fn(ev);
      } catch {
        // desk must not throw on listener errors
      }
    }
  }
}

/**
 * @param {DialogueDesk} desk
 * @param {number} index
 * @param {number} holdMs
 */
export function setBeatHold(desk, index, holdMs) {
  return desk.update(index, { holdMs: cleanHoldMs(holdMs) });
}
