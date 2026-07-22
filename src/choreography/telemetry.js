/**
 * Choreography telemetry buffer + CSV export (every-Nth rendered frame samples).
 */

export const TELEMETRY_SCHEMA_VERSION = "cw-choreo-telemetry.v1";
export const CSV_FIELDS = Object.freeze([
  "run_id",
  "round_id",
  "seed",
  "video_path",
  "screenshot_path",
  "sample_index",
  "render_frame_index",
  "simulation_frame_index",
  "time_ms",
  "video_time_ms",
  "nominal_fps",
  "frame_delta_ms",
  "dropped_frames",
  "duplicate_frame",
  "viewport_width_px",
  "viewport_height_px",
  "device_pixel_ratio",
  "control_source",
  "input_x",
  "input_y",
  "input_magnitude",
  "command",
  "action",
  "clip_id",
  "pose_id",
  "animation_frame_index",
  "animation_frame_count",
  "animation_frame_ms",
  "movement_phase",
  "path_id",
  "path_segment_id",
  "path_progress",
  "world_x",
  "world_y",
  "world_scale",
  "previous_world_x",
  "previous_world_y",
  "root_screen_x_px",
  "root_screen_y_px",
  "body_centroid_x_px",
  "body_centroid_y_px",
  "visible_left_px",
  "visible_top_px",
  "visible_width_px",
  "visible_height_px",
  "feet_x_px",
  "feet_y_px",
  "anchor_y",
  "visible_height_ratio",
  "facing_direction",
  "flip_x",
  "authored_heading_deg",
  "path_tangent_deg",
  "travel_dx_px",
  "travel_dy_px",
  "travel_speed_px_s",
  "travel_heading_deg",
  "facing_travel_error_deg",
  "path_heading_error_deg",
  "cross_track_error_px",
  "leg_cycle_phase",
  "planted_foot",
  "planted_foot_x_px",
  "foot_slip_px",
  "wing_phase",
  "bank",
  "velocity_x_px_s",
  "velocity_y_px_s",
  "acceleration_px_s2",
  "jerk_px_s3",
  "expected_speed_px_s",
  "speed_error_percent",
  "bounds_clipped",
  "teleport_flag",
  "frame_hold_flag",
  "visual_jitter_score",
  "pass_gait_speed",
  "pass_facing",
  "pass_flight_direction",
  "pass_smoothness",
  "notes",
]);

export function createTelemetryBuffer({
  runId,
  roundId = "round-local",
  seed = 1,
  sampleEvery = 4,
  nominalFps = 60,
} = {}) {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    runId: String(runId || `run-${Date.now()}`),
    roundId: String(roundId),
    seed: Number(seed) || 1,
    sampleEvery: Math.max(1, Number(sampleEvery) || 4),
    nominalFps: Number(nominalFps) || 60,
    renderFrameIndex: 0,
    samples: [],
    lastSample: null,
    startedAtMs: null,
  };
}

function csvEscape(value) {
  if (value == null || value === "") return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Record one rendered frame; samples every Nth frame.
 * @returns {object|null} sample row if sampled
 */
export function recordRenderFrame(buffer, frame) {
  if (!buffer.startedAtMs) buffer.startedAtMs = performance.now();
  const idx = buffer.renderFrameIndex;
  buffer.renderFrameIndex += 1;

  const prev = buffer.lastSample;
  const timeMs = Math.round(performance.now() - buffer.startedAtMs);
  const frameDeltaMs = prev ? timeMs - Number(prev.time_ms || 0) : 0;
  const dropped =
    prev && frameDeltaMs > (1000 / buffer.nominalFps) * 1.8
      ? Math.max(0, Math.round(frameDeltaMs / (1000 / buffer.nominalFps)) - 1)
      : 0;

  const worldX = Number(frame.world_x ?? frame.world?.x ?? 0);
  const worldY = Number(frame.world_y ?? frame.world?.y ?? 0);
  const prevX = prev ? Number(prev.world_x) : worldX;
  const prevY = prev ? Number(prev.world_y) : worldY;
  const dt = Math.max(1e-3, frameDeltaMs / 1000);
  const travelDx = (worldX - prevX) * (Number(frame.viewport_width_px) || 960);
  const travelDy = (worldY - prevY) * (Number(frame.viewport_height_px) || 540);
  const travelSpeed = Math.hypot(travelDx, travelDy) / dt;
  const travelHeading =
    Math.abs(travelDx) + Math.abs(travelDy) > 0.5
      ? (Math.atan2(travelDy, travelDx) * 180) / Math.PI
      : "";

  const flipX = frame.flip_x === true || frame.flip_x === "true" || frame.flipX === true;
  const facing = flipX ? "left" : "right";
  let facingTravelError = "";
  if (travelHeading !== "" && travelSpeed > 8) {
    const travelFace = Math.abs(travelDx) >= Math.abs(travelDy)
      ? travelDx < 0
        ? "left"
        : "right"
      : facing;
    facingTravelError = facing === travelFace || Math.abs(travelDx) < 2 ? 0 : 180;
  }

  const row = {
    run_id: buffer.runId,
    round_id: buffer.roundId,
    seed: buffer.seed,
    video_path: frame.video_path || "",
    screenshot_path: "",
    sample_index: "",
    render_frame_index: idx,
    simulation_frame_index: frame.simulation_frame_index ?? idx,
    time_ms: timeMs,
    video_time_ms: timeMs,
    nominal_fps: buffer.nominalFps,
    frame_delta_ms: frameDeltaMs,
    dropped_frames: dropped,
    duplicate_frame: prev && prev.pose_id === frame.pose_id && travelSpeed < 0.5 ? 1 : 0,
    viewport_width_px: frame.viewport_width_px || frame.canvasWidth || "",
    viewport_height_px: frame.viewport_height_px || frame.canvasHeight || "",
    device_pixel_ratio: frame.device_pixel_ratio || (typeof window !== "undefined" ? window.devicePixelRatio : 1),
    control_source: frame.control_source || "script",
    input_x: frame.input_x ?? "",
    input_y: frame.input_y ?? "",
    input_magnitude: frame.input_magnitude ?? "",
    command: frame.command || "",
    action: frame.action || "",
    clip_id: frame.clip_id || frame.clipName || "",
    pose_id: frame.pose_id || frame.poseId || frame.pose?.id || "",
    animation_frame_index: frame.animation_frame_index ?? frame.frameIndex ?? "",
    animation_frame_count: frame.animation_frame_count ?? frame.total ?? "",
    animation_frame_ms: frame.animation_frame_ms ?? "",
    movement_phase: frame.movement_phase || "",
    path_id: frame.path_id || "",
    path_segment_id: frame.path_segment_id || "",
    path_progress: frame.path_progress || "",
    world_x: worldX,
    world_y: worldY,
    world_scale: frame.world_scale ?? frame.world?.zoom ?? 1,
    previous_world_x: prevX,
    previous_world_y: prevY,
    root_screen_x_px: frame.drawRect?.left ?? "",
    root_screen_y_px: frame.drawRect?.top ?? "",
    body_centroid_x_px: frame.drawRect?.centroidX ?? "",
    body_centroid_y_px: frame.drawRect?.centroidY ?? "",
    visible_left_px: frame.drawRect?.left ?? "",
    visible_top_px: frame.drawRect?.top ?? "",
    visible_width_px: frame.drawRect?.width ?? "",
    visible_height_px: frame.drawRect?.height ?? "",
    feet_x_px: frame.drawRect?.feetX ?? "",
    feet_y_px: frame.drawRect?.feetY ?? "",
    anchor_y: frame.anchor_y || "bottom",
    visible_height_ratio: frame.visible_height_ratio || "",
    facing_direction: facing,
    flip_x: flipX ? 1 : 0,
    authored_heading_deg: frame.authored_heading_deg || "",
    path_tangent_deg: frame.path_tangent_deg || "",
    travel_dx_px: travelDx,
    travel_dy_px: travelDy,
    travel_speed_px_s: travelSpeed,
    travel_heading_deg: travelHeading,
    facing_travel_error_deg: facingTravelError,
    path_heading_error_deg: "",
    cross_track_error_px: "",
    leg_cycle_phase: frame.leg_cycle_phase ?? frame.frameIndex ?? "",
    planted_foot: "",
    planted_foot_x_px: "",
    foot_slip_px: "",
    wing_phase: "",
    bank: "",
    velocity_x_px_s: travelDx / dt,
    velocity_y_px_s: travelDy / dt,
    acceleration_px_s2: "",
    jerk_px_s3: "",
    expected_speed_px_s: frame.expected_speed_px_s || "",
    speed_error_percent: "",
    bounds_clipped: "",
    teleport_flag: travelSpeed > 2000 ? 1 : 0,
    frame_hold_flag: "",
    visual_jitter_score: "",
    pass_gait_speed: "",
    pass_facing: facingTravelError === 0 || facingTravelError === "" ? 1 : 0,
    pass_flight_direction: "",
    pass_smoothness: dropped === 0 ? 1 : 0,
    notes: frame.notes || "",
  };

  // Always keep last for derivatives; only push samples on stride.
  if (idx % buffer.sampleEvery === 0) {
    row.sample_index = buffer.samples.length;
    row.screenshot_path = `frames/frame-${String(idx).padStart(6, "0")}.png`;
    buffer.samples.push(row);
    buffer.lastSample = row;
    return row;
  }
  buffer.lastSample = row;
  return null;
}

export function telemetryToCsv(buffer) {
  const lines = [CSV_FIELDS.join(",")];
  for (const sample of buffer.samples) {
    lines.push(CSV_FIELDS.map((k) => csvEscape(sample[k])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function buildManifest(buffer, extra = {}) {
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    runId: buffer.runId,
    roundId: buffer.roundId,
    seed: buffer.seed,
    sampleEvery: buffer.sampleEvery,
    renderFrameCount: buffer.renderFrameIndex,
    sampleCount: buffer.samples.length,
    expectedSamples:
      buffer.renderFrameIndex > 0
        ? Math.ceil(buffer.renderFrameIndex / buffer.sampleEvery)
        : 0,
    startedAtMs: buffer.startedAtMs,
    endedAtMs: performance.now(),
    ...extra,
  };
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
