/**
 * U1 — Runtime hooks: apply desk beats to dragonview WorldSim.
 *
 * Desk owns order; hooks only apply the current (or named) beat.
 * Speaker always applies; listener is optional.
 */

/**
 * @typedef {import('./normalize.js').DialogueDeskBeat} DialogueDeskBeat
 * @typedef {import('./normalize.js').DeskClipRef} DeskClipRef
 */

/**
 * @typedef {object} ClipCatalog
 * @property {{ name: string, character?: string, frames: string[], looped?: boolean, hold_ticks?: number, forward_speed?: number, translate_toward_camera?: boolean, label?: string }[]} [clips]
 * @property {{ id?: string, pose_id?: string }[]} [poses]
 */

/**
 * Resolve a DeskClipRef against live catalogs (poses + named clips).
 * @param {DeskClipRef} ref
 * @param {ClipCatalog} catalog
 * @returns {{ mode: 'pose', poseId: string } | { mode: 'clip', clipName: string, frames: string[], def: object } | { mode: 'missing', id: string }}
 */
export function resolveClipAgainstCatalog(ref, catalog = {}) {
  if (!ref) return { mode: "missing", id: "" };
  const poses = catalog.poses || [];
  const clips = catalog.clips || [];
  const poseIds = new Set(poses.map((p) => p.pose_id || p.id).filter(Boolean));

  if (ref.kind === "clip" || ref.clipName) {
    const name = ref.clipName || ref.id;
    const def = clips.find((c) => c.name === name);
    if (def?.frames?.length) {
      return { mode: "clip", clipName: name, frames: def.frames, def };
    }
  }

  if (ref.kind === "pose" || ref.poseId) {
    const poseId = ref.poseId || ref.id;
    if (poseIds.has(poseId) || !poseIds.size) {
      // Allow applying even if catalog empty (caller may have external frames).
      return { mode: "pose", poseId };
    }
  }

  if (ref.kind === "code" && ref.code) {
    const needle = ref.code.toLowerCase();
    // act011 / can001
    const family = needle.slice(0, 3);
    const num = needle.slice(3);
    for (const p of poses) {
      const pid = String(p.pose_id || p.id || "").toLowerCase();
      if (pid.includes(`${family}${num}`) || pid.includes(`${family}_${num}`)) {
        return { mode: "pose", poseId: p.pose_id || p.id };
      }
    }
    // Soft apply: keep short code as pose_override until catalog maps it.
    return { mode: "pose", poseId: ref.poseId || ref.code };
  }

  // Last chance: exact pose id / clip name
  if (poseIds.has(ref.id)) return { mode: "pose", poseId: ref.id };
  const clipDef = clips.find((c) => c.name === ref.id);
  if (clipDef?.frames?.length) {
    return { mode: "clip", clipName: ref.id, frames: clipDef.frames, def: clipDef };
  }

  // Soft apply pose-shaped ids so desk beats still stage without catalog.
  if (ref.kind === "pose" || ref.poseId) {
    return { mode: "pose", poseId: ref.poseId || ref.id };
  }

  return { mode: "missing", id: ref.id };
}

/**
 * Apply a single resolved role to WorldSim.
 * @param {object} sim WorldSim instance
 * @param {string} actorId
 * @param {ReturnType<typeof resolveClipAgainstCatalog>} resolved
 * @param {{ holdTicks?: number }} [opts]
 */
export function applyResolvedToActor(sim, actorId, resolved, opts = {}) {
  if (!sim?.actors?.[actorId]) {
    return { ok: false, reason: "unknown_actor", actorId };
  }
  const prevActive = sim.active;
  sim.active = actorId;
  const actor = sim.actors[actorId];

  if (resolved.mode === "missing") {
    return { ok: false, reason: "missing_clip", actorId, id: resolved.id };
  }

  if (resolved.mode === "pose") {
    // Stop any running clip on this actor, hold static pose.
    if (typeof sim.stop_clip === "function") {
      try {
        sim.stop_clip(actorId, { snap_home: false });
      } catch {
        actor.clip = null;
      }
    } else {
      actor.clip = null;
    }
    actor.pose_override = resolved.poseId;
    actor.locomotion = "pose";
    actor.pose_hint = "pose";
    return { ok: true, mode: "pose", actorId, poseId: resolved.poseId };
  }

  // clip mode
  const def = resolved.def || {};
  try {
    sim.play_clip(resolved.clipName, resolved.frames, {
      looped: def.looped !== false,
      hold_ticks: opts.holdTicks ?? def.hold_ticks ?? 6,
      forward_speed: def.forward_speed ?? 0,
      translate_toward_camera: def.translate_toward_camera ?? false,
      actor_id: actorId,
    });
  } catch (e) {
    return { ok: false, reason: "play_clip_failed", actorId, error: String(e?.message || e) };
  }
  return { ok: true, mode: "clip", actorId, clipName: resolved.clipName };
}

/**
 * Apply one desk beat: speaker required, listener optional.
 * @param {object} sim
 * @param {DialogueDeskBeat} beat
 * @param {ClipCatalog} catalog
 * @returns {{ ok: boolean, beatId: string, speaker: object, listener: object|null, warnings: string[] }}
 */
export function applyDeskBeat(sim, beat, catalog = {}) {
  const warnings = [];
  if (!beat?.speaker) {
    return { ok: false, beatId: beat?.beatId || "", speaker: null, listener: null, warnings: ["no_speaker"] };
  }

  const speakerActor = beat.speakerActor || "dragon";
  const speakerRes = resolveClipAgainstCatalog(beat.speaker, catalog);
  const speaker = applyResolvedToActor(sim, speakerActor, speakerRes);
  if (!speaker.ok) warnings.push(`speaker:${speaker.reason}:${speaker.id || speaker.actorId}`);

  let listener = null;
  if (beat.listener) {
    const listenerActor = beat.listenerActor || "wizardjoe";
    if (listenerActor === speakerActor) {
      warnings.push("listener_same_actor_skipped");
    } else {
      const listenerRes = resolveClipAgainstCatalog(beat.listener, catalog);
      listener = applyResolvedToActor(sim, listenerActor, listenerRes);
      if (!listener.ok) warnings.push(`listener:${listener.reason}:${listener.id || listener.actorId}`);
    }
  }

  // Prefer speaker as active cast after apply
  if (sim.actors?.[speakerActor]) sim.active = speakerActor;

  return {
    ok: Boolean(speaker.ok),
    beatId: beat.beatId,
    index: beat.index,
    speaker,
    listener,
    warnings,
  };
}

/**
 * Play desk sequence in order (desk authority). Async hold between beats.
 * @param {object} sim
 * @param {import('./dialogueDesk.js').DialogueDesk} desk
 * @param {ClipCatalog} catalog
 * @param {{ signal?: AbortSignal, onBeat?: (result: object, beat: DialogueDeskBeat) => void }} [opts]
 */
export async function playDeskSequence(sim, desk, catalog = {}, opts = {}) {
  const signal = opts.signal;
  desk.resetCursor();
  const results = [];
  for (let i = 0; i < desk.length; i += 1) {
    if (signal?.aborted) break;
    const beat = desk.seek(i);
    if (!beat) break;
    const result = applyDeskBeat(sim, beat, catalog);
    results.push(result);
    opts.onBeat?.(result, beat);
    const hold = Math.max(120, Number(beat.holdMs) || 1600);
    await wait(hold, signal);
  }
  return results;
}

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function wait(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
