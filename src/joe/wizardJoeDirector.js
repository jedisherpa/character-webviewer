/** Map presentation / lifecycle state → Wizard Joe clip name. */

const SPEAKING_STAGES = new Set([
  "speaking",
  "drafting",
  "ready",
  "reviewing",
]);

const THINKING_STAGES = new Set([
  "understanding",
  "reading_you",
  "recalling",
  "referencing",
  "deciding",
  "checking_safety",
  "auditing",
]);

const LISTENING_STAGES = new Set([
  "listening",
  "queued",
  "waiting_approval",
  "needs_clarification",
]);

const ACTION_CLIPS = new Set([
  "idle",
  "listen",
  "think",
  "speak",
  "gesture",
  "walk",
  "walk_forward",
  "run",
  "fly",
  "fly_forward",
  "jump",
  "celebrate",
  "magic",
  "dance",
  "breakdance",
  "emotion",
  "comedy",
  "hero",
  "news",
  "all",
  "v2_full",
  "library_full",
  "base250_full",
  "listen_explain",
  "present_right",
  "walk_recover",
  "run_recover",
  "glide_dance",
  "magic_release",
  "turnaround",
  "emotion_tour",
  "news_desk",
  "conversation",
  "v2_showcase",
  "flight_tour",
  "idle_set",
  "listen_set",
  "think_set",
  "speak_set",
  "emotion_set",
  "walk_set",
  "run_set",
  "jump_set",
  "flight_set",
  "magic_set",
  "dance_set",
  "comedy_set",
  "hero_set",
  "news_set",
  "dance_party",
  "magic_cast",
]);

/**
 * @param {{ stage?: string, status?: string, ranting?: boolean, action?: string, dancing?: boolean, forceClip?: string }} input
 */
export function directWizardJoeClip(input = {}) {
  if (input.forceClip) return String(input.forceClip).toLowerCase();
  if (input.dancing || input.action === "dance" || input.action === "breakdance") {
    return input.action === "dance" ? "dance" : "breakdance";
  }
  // Explicit action wins during rant so setup (news) / payoff (speak) beat
  // cues from the speechwriter actually change the stage clip.
  if (input.action && ACTION_CLIPS.has(String(input.action).toLowerCase())) {
    return String(input.action).toLowerCase();
  }
  if (input.ranting) return "speak";
  const stage = String(input.stage || "").toLowerCase();
  if (SPEAKING_STAGES.has(stage)) return "speak";
  if (THINKING_STAGES.has(stage)) return "think";
  if (LISTENING_STAGES.has(stage)) return "listen";
  if (stage === "degraded" || stage === "cancelled" || stage === "failed") return "idle";
  return "idle";
}

/**
 * Resolve a clip for the stage player.
 * Supports pack clips (uniform frameMs) and choreography clips (per-step ms).
 * @returns {{ frames: string[], durationsMs: number[], frameMs: number, loop: boolean, kind: string, totalMs: number, description?: string }}
 */
export function resolveClipFrames(library, clipName, speed = 1) {
  const spd = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const empty = {
    frames: [],
    durationsMs: [],
    frameMs: 320,
    loop: true,
    kind: "pack",
    totalMs: 0,
  };
  if (!library?.clips) return empty;
  const clip = library.clips[clipName] || library.clips.idle;
  if (!clip) return empty;

  const frames = Array.isArray(clip.frames) ? clip.frames.slice() : [];
  let durationsMs = [];
  if (Array.isArray(clip.steps) && clip.steps.length) {
    // Prefer authored holds; steps may be longer/shorter than frames
    for (const step of clip.steps) {
      const pid = step.poseId || step.pose_id;
      const ms = Math.max(50, Math.round((Number(step.ms) || 200) / spd));
      if (pid) {
        durationsMs.push(ms);
        // keep frames in sync if steps are authoritative
      }
    }
    if (clip.steps.length === frames.length) {
      // ok
    } else if (clip.steps.length && !frames.length) {
      for (const step of clip.steps) {
        frames.push(step.poseId || step.pose_id);
      }
    } else if (clip.steps.length !== frames.length) {
      // rebuild frames from steps
      frames.length = 0;
      durationsMs = [];
      for (const step of clip.steps) {
        const pid = step.poseId || step.pose_id;
        if (!pid) continue;
        frames.push(pid);
        durationsMs.push(Math.max(50, Math.round((Number(step.ms) || 200) / spd)));
      }
    }
  }
  if (!durationsMs.length) {
    const base = Math.max(50, Math.round((Number(clip.frameMs) || 320) / spd));
    durationsMs = frames.map(() => base);
  }

  const totalMs =
    Number(clip.totalMs) > 0
      ? Math.round(Number(clip.totalMs) / spd)
      : durationsMs.reduce((a, b) => a + b, 0);

  return {
    frames,
    durationsMs,
    frameMs: durationsMs[0] || Math.max(50, Math.round((Number(clip.frameMs) || 320) / spd)),
    loop: clip.loop !== false,
    kind: clip.kind || "pack",
    totalMs,
    description: clip.description,
  };
}

export function poseById(library, poseId) {
  if (!library?.poses) return null;
  return library.poses.find((p) => p.id === poseId) || null;
}

export function poseByRuntimeId(library, runtimeId) {
  if (!library?.poses) return null;
  const rid = Number(runtimeId);
  return library.poses.find((p) => p.runtimeId === rid) || null;
}

export function listDancePoses(library) {
  if (!library?.poses) return [];
  return library.poses
    .filter((p) => {
      const blob = `${p.id} ${(p.tags || []).join(" ")} ${p.category || ""}`.toLowerCase();
      return (
        blob.includes("dance") ||
        blob.includes("break") ||
        blob.includes("wizardjoe") ||
        blob.includes("v2_sample") ||
        blob.includes("animation")
      );
    })
    .sort((a, b) => (a.runtimeId || 0) - (b.runtimeId || 0));
}

export function listAllPoses(library) {
  if (!library?.poses) return [];
  return library.poses.slice().sort((a, b) => (a.runtimeId || 0) - (b.runtimeId || 0));
}

export function listChoreography(library) {
  if (Array.isArray(library?.choreography) && library.choreography.length) {
    return library.choreography;
  }
  // Fallback: clips marked kind=choreography
  if (!library?.clips) return [];
  return Object.entries(library.clips)
    .filter(([, c]) => c?.kind === "choreography")
    .map(([name, c]) => ({ name, ...c }));
}

export function listPackClips(library) {
  if (!library?.clips) return [];
  return Object.entries(library.clips)
    .filter(([, c]) => (c?.kind || "pack") === "pack")
    .map(([name, c]) => ({
      name,
      frames: c.frames || [],
      frameMs: c.frameMs || 320,
      loop: c.loop !== false,
      count: (c.frames || []).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export { ACTION_CLIPS };
