/** Client-side world-space sim (ported from dragonview/viewer/world.py). */

export const DT = 1 / 60;
export const WALK = 5.5;
export const SPRINT = 9.5;
export const PRECISION = 2.2;
export const FLIGHT = 7.0;
export const HOP_G = 16.0;
export const FLIGHT_G = 9.5;
export const FLAP_IMPULSE = 5.2;
export const FLAP_MAX = 1.15;
export const FLAP_COST = 0.22;
export const FLAP_REGEN = 0.35;
export const WORLD_XZ = 14.0;
export const WORLD_Y_MAX = 9.5;

export const CAST_ORDER = ["dragon", "kingfisher", "wizardjoe"];

export function createInput() {
  return {
    move_x: 0,
    move_y: 0,
    jump: false,
    interact: false,
    switch_bird: false,
    toggle_flight: false,
    strafe_l: false,
    strafe_r: false,
    precision: false,
    sprint: false,
    dpad_snap: false,
    reset: false,
    axes_toggle: false,
  };
}

function makeActor(id, pos, face_sign = 1) {
  return {
    id,
    pos: [...pos],
    vel: [0, 0, 0],
    flight: false,
    free_flight: false,
    legal: true,
    blocked: false,
    zone: "ground",
    locomotion: "idle",
    pose_hint: "idle",
    facing_yaw: 0,
    face_sign,
    allow_draw_mirror: true,
    land_hard: false,
    anim_phase: 0,
    flap_energy: FLAP_MAX,
    coyote: 0,
    jump_buf: 0,
    anticip: 0,
    jump_was: false,
    flight_was: false,
    pose_override: null,
  };
}

export class WorldSim {
  constructor() {
    this.tick = 0;
    this.active = "dragon";
    this.screen_relative = true;
    this.home = {
      dragon: [0, 0, 0],
      kingfisher: [0, 0, 2.8],
      wizardjoe: [0, 0, -2.8],
    };
    this.actors = {
      dragon: makeActor("dragon", this.home.dragon, 1),
      kingfisher: makeActor("kingfisher", this.home.kingfisher, -1),
      wizardjoe: makeActor("wizardjoe", this.home.wizardjoe, 1),
    };
    this._prev_switch = false;
    this._prev_axes = false;
    this._prev_reset = false;
  }

  cycle_active() {
    const order = CAST_ORDER;
    const i = order.indexOf(this.active);
    this.active = order[(i + 1) % order.length];
    return this.active;
  }

  reset_ground() {
    for (const aid of Object.keys(this.actors)) {
      const a = this.actors[aid];
      a.pos = [...this.home[aid]];
      a.vel = [0, 0, 0];
      a.flight = false;
      a.free_flight = false;
      a.land_hard = false;
      a.flap_energy = FLAP_MAX;
      a.pose_override = null;
      a.locomotion = "idle";
      a.pose_hint = "idle";
      a.zone = "ground";
      a.legal = true;
      a.blocked = false;
    }
  }

  set_active_pose(poseId) {
    const a = this.actors[this.active];
    a.pose_override = poseId;
    a.locomotion = "pose";
    a.pose_hint = "pose";
  }

  clear_pose_override() {
    this.actors[this.active].pose_override = null;
  }

  step(inp) {
    this.tick += 1;
    if (inp.switch_bird && !this._prev_switch) this.cycle_active();
    this._prev_switch = inp.switch_bird;

    if (inp.axes_toggle && !this._prev_axes) this.screen_relative = !this.screen_relative;
    this._prev_axes = inp.axes_toggle;

    if (inp.reset && !this._prev_reset) this.reset_ground();
    this._prev_reset = inp.reset;

    if (inp.dpad_snap) {
      const a = this.actors[this.active];
      a.pos = [...this.home[this.active]];
      a.vel = [0, 0, 0];
      a.flight = false;
      a.free_flight = false;
      a.pose_override = null;
    }

    for (const aid of CAST_ORDER) {
      const a = this.actors[aid];
      this._step_actor(a, aid === this.active ? inp : createInput(), aid === this.active);
    }
  }

  _step_actor(a, inp, active) {
    const jump_edge = inp.jump && !a.jump_was;
    a.jump_was = inp.jump;
    const flight_edge = inp.toggle_flight && !a.flight_was;
    a.flight_was = inp.toggle_flight;

    if (flight_edge && active) {
      a.free_flight = !a.free_flight;
      a.flight = a.free_flight || a.pos[1] > 0.05;
      if (!a.free_flight && a.pos[1] < 0.08) {
        a.pos[1] = 0;
        a.vel[1] = 0;
        a.flight = false;
      }
    }

    let grounded = a.pos[1] <= 0.02 && !a.free_flight;
    if (grounded) {
      a.coyote = 6 / 60;
      a.pos[1] = 0;
      if (a.vel[1] < 0) {
        a.land_hard = a.vel[1] < -6;
        a.vel[1] = 0;
      }
      a.flight = false;
    } else {
      a.coyote = Math.max(0, a.coyote - DT);
      a.flight = true;
    }

    if (jump_edge && active) a.jump_buf = 6 / 60;
    else a.jump_buf = Math.max(0, a.jump_buf - DT);

    let mx = inp.move_x;
    let my = inp.move_y;
    if (inp.strafe_l) mx -= 0.85;
    if (inp.strafe_r) mx += 0.85;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }

    let wx;
    let wz;
    if (this.screen_relative) {
      wx = -my;
      wz = mx;
    } else {
      wx = my;
      wz = mx;
    }

    let speed = WALK;
    if (inp.sprint) speed = SPRINT;
    if (inp.precision) speed = PRECISION;
    if (a.flight || a.free_flight) speed = FLIGHT;

    if (!(a.pose_override && mag < 0.05 && !a.flight)) {
      if (mag > 0.05 && a.pose_override) a.pose_override = null;
      a.vel[0] = wx * speed;
      a.vel[2] = wz * speed;
    }

    if (mag > 0.08) {
      a.facing_yaw = Math.atan2(wz, wx) || a.facing_yaw;
      a.face_sign = wz >= 0 ? 1 : -1;
      a.anim_phase = (a.anim_phase + DT * (inp.sprint ? 2.2 : 1.4)) % 1;
    } else {
      a.anim_phase = 0;
    }

    if (a.jump_buf > 0 && (grounded || a.coyote > 0) && !a.free_flight) {
      a.vel[1] = 5.8;
      a.pos[1] = 0.05;
      a.jump_buf = 0;
      a.coyote = 0;
      a.flight = true;
    } else if (jump_edge && (a.flight || a.free_flight) && a.flap_energy >= FLAP_COST) {
      a.vel[1] = Math.max(a.vel[1], 0) + FLAP_IMPULSE;
      a.flap_energy = Math.max(0, a.flap_energy - FLAP_COST);
    }

    const g = a.flight || a.free_flight ? FLIGHT_G : HOP_G;
    grounded = a.pos[1] <= 0.02 && !a.free_flight;
    if (!grounded) a.vel[1] -= g * DT;
    a.flap_energy = Math.min(FLAP_MAX, a.flap_energy + FLAP_REGEN * DT);

    a.pos[0] += a.vel[0] * DT;
    a.pos[1] += a.vel[1] * DT;
    a.pos[2] += a.vel[2] * DT;

    a.pos[0] = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, a.pos[0]));
    a.pos[2] = Math.max(-WORLD_XZ, Math.min(WORLD_XZ, a.pos[2]));
    a.pos[1] = Math.max(0, Math.min(WORLD_Y_MAX, a.pos[1]));

    if (a.pos[1] <= 0 && !a.free_flight) {
      a.pos[1] = 0;
      a.vel[1] = 0;
      a.flight = false;
    }

    const spd = Math.hypot(a.vel[0], a.vel[2]);
    if (a.pose_override) {
      a.locomotion = "pose";
      a.pose_hint = "pose";
    } else if (a.free_flight || (a.flight && a.pos[1] > 0.4)) {
      a.locomotion = "fly";
      a.pose_hint = "fly";
    } else if (a.flight && a.vel[1] > 0.5) {
      a.locomotion = "hop";
      a.pose_hint = "hop";
    } else if (a.flight) {
      a.locomotion = "air";
      a.pose_hint = "air";
    } else if (spd > 0.4 && inp.sprint) {
      a.locomotion = "sprint";
      a.pose_hint = "sprint";
    } else if (spd > 0.4) {
      a.locomotion = "walk";
      a.pose_hint = "walk";
    } else {
      a.locomotion = "idle";
      a.pose_hint = "idle";
      a.land_hard = false;
    }
    a.zone = a.pos[1] > 0.15 ? "air" : "ground";
    a.legal = true;
    a.blocked = false;
  }

  present_actor(a) {
    return {
      id: a.id,
      character: a.id,
      display_id: a.id === "wizardjoe" ? "wizard joe" : a.id,
      pos: [...a.pos],
      flight: a.flight,
      free_flight: a.free_flight,
      legal: a.legal,
      blocked: a.blocked,
      zone: a.zone,
      locomotion: a.locomotion,
      pose_hint: a.pose_hint,
      pose_id: a.pose_override || null,
      facing_yaw: a.facing_yaw,
      face_sign: a.face_sign,
      allow_draw_mirror: a.allow_draw_mirror,
      land_hard: a.land_hard,
      anim_phase: a.anim_phase,
      flap_energy: a.flap_energy,
    };
  }
}
