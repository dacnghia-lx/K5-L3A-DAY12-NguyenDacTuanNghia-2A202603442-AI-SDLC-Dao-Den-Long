// Pure, deterministic game simulation for Đảo Đèn Lồng (Test Contract v1.1, Ticket-02).
// Shared by the headless CLI (src/headless.js) and the browser game (src/web/).
// No DOM, no Date, no Math.random — only the seeded RNG.
import { makeRng } from './rng.js';
import { TUNING, WORLD } from './tuning.js';
import { getLevel, floorAt, blockedAt, groundTop, clampToBounds } from './levels.js';

const TPS = WORLD.tick_rate;
const SAFE_EPS = 0.002; // keeps shades strictly outside safe_radius after 3-decimal rounding
const EPS = 1e-9;

export const round3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Natural id order: S2 < S10, L1 < L2. */
export const idCmp = (a, b) => String(a).localeCompare(String(b), 'en', { numeric: true });
const ticks = (s) => Math.round(s * TPS);
const secs = (t) => round3(t / TPS);

export const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
export const DRIFTER_STATES = ['idle', 'chase', 'flee'];

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
});
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

/** Contract §C: camera-relative move -> world XZ direction (normalized if longer than 1). */
export function moveToWorld(move, camYawDeg) {
  let [x, z] = move;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const t = (camYawDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [x * c + z * s, -x * s + z * c];
}

export function defaultLanterns(night = 1) {
  return getLevel(night).lanterns.map((p, i) => ({ id: `L${i + 1}`, pos: [...p], lit: false, deposited: 0 }));
}

export class Sim {
  /**
   * @param {object} opts
   * @param {number} opts.seed
   * @param {number} [opts.night] 1..3
   * @param {object|null} [opts.scenario] validated scenario (see io.js)
   * @param {object} [opts.tuning]
   */
  constructor({ seed = 0, night = 1, scenario = null, tuning = TUNING } = {}) {
    const sc = scenario || {};
    const L = getLevel(night);
    this.t = tuning;
    this.level = L;
    this.night = night;
    this.rng = makeRng(seed);
    this.steps = 0; // contract "tick": every step, including paused ones
    this.simTick = 0; // contract "sim_tick": gameplay steps only
    this.paused = false;
    this.state = 'playing';
    this.result = null; // { result, reason } once the night is over
    this.score = 0;
    this.prevButtons = Object.fromEntries(BUTTONS.map((b) => [b, false]));
    this.stats = { deposited: 0, lit: 0, stunHits: 0 }; // for the result screen only

    const sp = sc.player || {};
    this.player = {
      pos: sp.pos ? [...sp.pos] : [...L.start],
      vel: [0, 0, 0],
      vy: 0,
      grounded: false,
      facing: [...L.facing],
      launch: null, // [vx, vz] while flying from a jump pad
      dashTicks: 0,
      dashDir: [0, 1],
      flames: sp.flames ?? tuning.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      fallWait: 0,
    };
    this.lastMoveDir = this.player.facing; // kept for the renderer
    const fl = floorAt(L, this.player.pos[0], this.player.pos[2], this.player.pos[1]);
    this.player.grounded = Number.isFinite(fl) && Math.abs(this.player.pos[1] - fl) < 1e-6;

    this.lanterns = defaultLanterns(night);
    for (const l of sc.lanterns || []) {
      const target = this.lanterns.find((x) => x.id === l.id);
      if (l.pos) target.pos = [...l.pos];
      if (l.deposited !== undefined) target.deposited = l.deposited;
      if (l.lit !== undefined) target.lit = l.lit;
      if (target.lit) target.deposited = tuning.lantern_cost;
      if (target.deposited >= tuning.lantern_cost) target.lit = true;
    }

    this.randomMotes = sc.random_motes ?? true;
    this.randomShades = sc.random_shades ?? true;
    this.randomDrifters = sc.random_drifters ?? L.drifters;
    this.windEnabled = sc.wind_enabled ?? L.wind;
    this.durationS = sc.time_left_s ?? L.durationS;
    this.wind = { active: false, dirDeg: 0, dir: [1, 0] };

    // Fireflies: kind "random" sit on a spawn point (pointIdx), "dropped" have a TTL.
    this.moteSeq = 0;
    this.motes = [];
    if (sc.motes) {
      for (const m of sc.motes) {
        this.motes.push({ id: m.id ?? this.nextMoteId(), pos: [...m.pos], kind: m.kind ?? 'random', ttl: m.ttl_ticks ?? null, pointIdx: -1 });
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < WORLD.mote_initial; i++) this.spawnRandomMote();
    }

    this.shadeSeq = 0;
    this.shades = [];
    for (const s of sc.shades || []) {
      this.shades.push(this.makeShade(s.id ?? null, s.pos, s.state ?? 'wander', s.state_ticks_left));
    }
    for (const s of this.shades) if (s.id === null) s.id = this.nextShadeId();

    this.drifterSeq = 0;
    this.drifters = [];
    for (const d of sc.drifters || []) {
      this.drifters.push({
        id: d.id ?? null, pos: [...d.pos], state: d.state ?? 'idle', stolen: d.stolen ?? 0, hasStolen: (d.stolen ?? 0) > 0,
        ticks: d.state_ticks_left ?? (d.state === 'flee' ? WORLD.drifter_flee_ticks : 0), heading: [1, 0], headingTicks: 0,
      });
    }
    for (const d of this.drifters) if (d.id === null) d.id = this.nextDrifterId();

    const defaultCharms = L.charms.map((p, i) => ({ id: `C${i + 1}`, pos: [...p], available: true, respawn: 0 }));
    if (sc.charms) {
      this.charms = sc.charms.map((c, i) => {
        const id = c.id ?? `C${i + 1}`;
        const def = defaultCharms.find((x) => x.id === id);
        return { id, pos: c.pos ? [...c.pos] : [...def.pos], available: c.available ?? true, respawn: c.respawn_ticks ?? 0 };
      });
    } else {
      this.charms = defaultCharms;
    }
  }

  // ---------- ids / factories ----------
  nextMoteId() {
    this.moteSeq += 1;
    return `M${this.moteSeq}`;
  }

  nextShadeId() {
    let id;
    do {
      this.shadeSeq += 1;
      id = `S${this.shadeSeq}`;
    } while (this.shades.some((s) => s.id === id));
    return id;
  }

  nextDrifterId() {
    let id;
    do {
      this.drifterSeq += 1;
      id = `D${this.drifterSeq}`;
    } while (this.drifters.some((d) => d.id === id));
    return id;
  }

  makeShade(id, pos, state, ticksLeft) {
    let t = ticksLeft;
    if (t === undefined) {
      t = { stunned: ticks(this.t.pulse_stun_s), spawning: WORLD.shade_spawning_ticks, recoil: WORLD.shade_recoil_ticks }[state] ?? 0;
    }
    return { id, pos: [...pos], state, ticks: t, pushTicks: 0, pushDir: [1, 0], recoilDir: [1, 0], evict: null };
  }

  spawnRandomMote() {
    const used = new Set(this.motes.filter((m) => m.kind === 'random').map((m) => m.pointIdx));
    const free = [];
    this.level.moteSpawns.forEach((_, i) => {
      if (!used.has(i)) free.push(i);
    });
    if (!free.length) return null;
    const idx = free[Math.floor(this.rng.next() * free.length)];
    const m = { id: this.nextMoteId(), pos: [...this.level.moteSpawns[idx]], kind: 'random', ttl: null, pointIdx: idx };
    this.motes.push(m);
    return m;
  }

  // ---------- queries ----------
  timeLeft() {
    return this.durationS - this.simTick / TPS;
  }

  litCount() {
    return this.lanterns.filter((l) => l.lit).length;
  }

  capacity() {
    return this.t.carry_capacity;
  }

  shadeSpeed() {
    return this.level.shadeSpeed;
  }

  // ---------- helpers ----------
  /** Keep a shade outside every lit lantern's safe radius (except the one evicting it). Returns true if moved. */
  constrainShade(s) {
    let moved = false;
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      if (s.evict && s.evict.id === l.id) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < this.t.safe_radius) {
        let dx = s.pos[0] - l.pos[0];
        let dz = s.pos[2] - l.pos[2];
        if (d < EPS) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        const r = this.t.safe_radius + SAFE_EPS;
        s.pos[0] = l.pos[0] + dx * r;
        s.pos[2] = l.pos[2] + dz * r;
        moved = true;
      }
    }
    clampToBounds(this.level, s.pos);
    return moved;
  }

  floatY(e, h) {
    e.pos[1] = groundTop(this.level, e.pos[0], e.pos[2]) + h;
  }

  moveToward(e, target, speed) {
    const dx = target[0] - e.pos[0];
    const dz = target[2] - e.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < EPS) return;
    const mv = Math.min(speed / TPS, d);
    e.pos[0] += (dx / d) * mv;
    e.pos[2] += (dz / d) * mv;
  }

  playerTargetable() {
    return this.player.fallWait === 0;
  }

  dropMotesAround(center, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, 2 * Math.PI);
      const r = this.rng.range(WORLD.mote_drop_r_min, WORLD.mote_drop_r_max);
      const x = round3(center[0] + r * Math.cos(a));
      const z = round3(center[2] + r * Math.sin(a));
      const f = floorAt(this.level, x, z, center[1]);
      this.motes.push({ id: this.nextMoteId(), pos: [x, Number.isFinite(f) ? f : center[1], z], kind: 'dropped', ttl: WORLD.mote_drop_ttl_ticks, pointIdx: -1 });
    }
  }

  endGame(result, reason, ev) {
    this.state = result;
    this.result = { result, reason };
    if (result === 'won') {
      const left = Math.max(0, Math.floor(this.timeLeft() + EPS));
      this.score += left * this.t.score.per_second_left + this.player.flames * this.t.score.per_flame_left;
    }
    ev('game_over', { result, reason });
  }

  // ---------- the tick ----------
  /**
   * Advance one fixed tick. `input` holds the CURRENT held values
   * ({move, cam_yaw_deg, jump, interact, pulse, dash, pause}); edges are detected here.
   * Returns the events produced in this step (stamped with the new tick).
   */
  step(input = DEFAULT_INPUT) {
    if (this.state === 'won' || this.state === 'lost') return [];
    const events = [];
    this.steps += 1;
    const tick = this.steps;
    const ev = (name, data) => events.push({ type: 'event', tick, name, data });

    // 1. Input: edges; pause first.
    const edge = {};
    for (const b of BUTTONS) {
      edge[b] = Boolean(input[b]) && !this.prevButtons[b];
      this.prevButtons[b] = Boolean(input[b]);
    }
    if (edge.pause) {
      if (!this.paused) {
        this.paused = true;
        this.state = 'paused';
        ev('paused', {});
        return events;
      }
      this.paused = false;
      this.state = 'playing';
      ev('resumed', {});
    } else if (this.paused) {
      return events;
    }

    this.simTick += 1;
    const t = this.t;
    const p = this.player;
    const L = this.level;

    // 2. Timers.
    if (p.pulseCd > 0) p.pulseCd -= 1;
    if (p.dashCd > 0) p.dashCd -= 1;
    if (p.invuln > 0) p.invuln -= 1;
    if (p.charm > 0) p.charm -= 1;
    for (const s of this.shades) {
      if (s.state === 'stunned' || s.state === 'spawning' || s.state === 'recoil') {
        if (s.ticks > 0) s.ticks -= 1;
        if (s.ticks === 0) {
          if (s.state === 'recoil') {
            s.state = this.playerTargetable() && distXZ(s.pos, p.pos) <= WORLD.shade_lose_m ? 'chase' : 'wander';
          } else {
            s.state = 'wander';
          }
          s.pushTicks = 0;
        }
      }
    }
    for (const d of this.drifters) if (d.state === 'flee' && d.ticks > 0) d.ticks -= 1;
    this.drifters = this.drifters.filter((d) => !(d.state === 'flee' && d.ticks === 0));
    for (const m of this.motes) if (m.ttl !== null && m.ttl > 0) m.ttl -= 1;
    this.motes = this.motes.filter((m) => m.ttl === null || m.ttl > 0);
    for (const c of this.charms) {
      if (!c.available && c.respawn > 0) {
        c.respawn -= 1;
        if (c.respawn === 0) c.available = true;
      }
    }

    // 3. Move Mây (jump, dash, pads, wind), then the fall check.
    this.updateWind();
    this.movePlayer(input, edge, ev);

    // 4. Pick up fireflies and charms.
    if (p.fallWait === 0) this.pickup(ev);

    // 5. Lanterns.
    if (p.fallWait === 0 && edge.interact) this.interact(ev);

    // 6. Safe zones: shades caught inside a newly lit lantern are pushed out within 30 ticks.
    this.updateEvictions();

    // 7. Light pulse.
    if (edge.pulse && p.fallWait === 0 && p.pulseCd === 0 && p.carried >= t.pulse_cost) this.pulse(ev);

    // 8. Shades and drifters move.
    this.moveShades();
    this.moveDrifters();

    // 9. Contacts: drifters steal first, then one shade hit (ascending id).
    if (p.fallWait === 0) this.contacts(ev);

    // 10. Scheduled spawns (new entities interact from the next tick).
    this.spawns(ev);

    // 11. Win / lose.
    if (p.flames <= 0) this.endGame('lost', 'no_flames', ev);
    else if (this.lanterns.every((l) => l.lit)) this.endGame('won', 'all_lit', ev);
    else if (this.timeLeft() <= EPS) this.endGame('lost', 'dawn', ev);
    return events;
  }

  updateWind() {
    const w = this.wind;
    if (!this.windEnabled) {
      w.active = false;
      return;
    }
    const k = this.simTick;
    if (k >= WORLD.wind_every_ticks && k % WORLD.wind_every_ticks === 0) {
      w.dirDeg = Math.floor(this.rng.next() * 360);
      const a = (w.dirDeg * Math.PI) / 180;
      w.dir = [Math.cos(a), Math.sin(a)];
    }
    w.active = k >= WORLD.wind_every_ticks && k % WORLD.wind_every_ticks < WORLD.wind_duration_ticks;
  }

  /** Ticks until the next gust starts (renderer warning), or Infinity. */
  windWarning() {
    if (!this.windEnabled) return Infinity;
    const k = this.simTick;
    const next = (Math.floor(k / WORLD.wind_every_ticks) + 1) * WORLD.wind_every_ticks;
    return next - k;
  }

  movePlayer(input, edge, ev) {
    const p = this.player;
    const L = this.level;
    const t = this.t;
    if (p.fallWait > 0) {
      p.fallWait -= 1;
      p.vel = [0, 0, 0];
      if (p.fallWait === 0) {
        p.pos = [...L.start];
        p.vy = 0;
        p.launch = null;
        p.dashTicks = 0;
        p.grounded = true;
        p.facing = [...L.facing];
        p.invuln = ticks(t.invuln_s);
      }
      return;
    }
    const wasGrounded = p.grounded;
    const yPrev = p.pos[1];
    const [wx, wz] = moveToWorld(input.move || [0, 0], input.cam_yaw_deg || 0);
    const wlen = Math.hypot(wx, wz);
    if (wlen > EPS) p.facing = [wx / wlen, wz / wlen];
    this.lastMoveDir = p.facing;

    // Jump pads trigger when the feet stand on them.
    if (wasGrounded && !p.launch) {
      for (const pad of L.pads) {
        if (distXZ(p.pos, pad.pos) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
          let dir = pad.dir;
          if (!dir) {
            const dx = pad.toward[0] - pad.pos[0];
            const dz = pad.toward[1] - pad.pos[2];
            const d = Math.hypot(dx, dz);
            dir = [dx / d, dz / d];
          }
          p.launch = [dir[0] * pad.speed, dir[1] * pad.speed];
          p.vy = pad.vy;
          p.grounded = false;
          break;
        }
      }
    }

    // Dash: starts on the edge, from cooldown 0 (or any time with the Wind Charm), never while dashing.
    if (edge.dash && p.dashTicks === 0 && (p.charm > 0 || p.dashCd === 0)) {
      p.dashTicks = ticks(t.dash_duration_s);
      p.dashDir = wlen > EPS ? [wx / wlen, wz / wlen] : [...p.facing];
      p.dashCd = p.charm > 0 ? 0 : ticks(t.dash_cooldown_s);
      ev('dash', {});
    }

    let hx;
    let hz;
    let dashing = false;
    if (p.dashTicks > 0) {
      dashing = true;
      hx = p.dashDir[0] * t.dash_speed;
      hz = p.dashDir[1] * t.dash_speed;
      p.dashTicks -= 1;
      p.vy = 0;
    } else if (p.launch) {
      [hx, hz] = p.launch;
    } else {
      const speed = p.charm > 0 ? WORLD.charm_speed : t.player_speed;
      hx = wx * speed;
      hz = wz * speed;
    }
    if (this.wind.active) {
      hx += this.wind.dir[0] * WORLD.wind_speed;
      hz += this.wind.dir[1] * WORLD.wind_speed;
    }

    let jumped = false;
    if (!dashing) {
      if (edge.jump && p.grounded && !p.launch) {
        p.vy = WORLD.jump_speed;
        p.grounded = false;
        jumped = true;
      }
      if (!p.grounded) p.vy -= WORLD.gravity / TPS;
    }

    // Horizontal move with walls (slide along one axis if the full move is blocked).
    const nx = p.pos[0] + hx / TPS;
    const nz = p.pos[2] + hz / TPS;
    if (!blockedAt(L, nx, nz, yPrev)) {
      p.pos[0] = nx;
      p.pos[2] = nz;
    } else if (!blockedAt(L, nx, p.pos[2], yPrev)) {
      p.pos[0] = nx;
      hz = 0;
    } else if (!blockedAt(L, p.pos[0], nz, yPrev)) {
      p.pos[2] = nz;
      hx = 0;
    } else {
      hx = 0;
      hz = 0;
    }
    if (!p.grounded) p.pos[1] += p.vy / TPS;

    const floor = floorAt(L, p.pos[0], p.pos[2], yPrev);
    if (p.vy <= 0 && p.pos[1] <= floor + EPS) {
      p.pos[1] = floor;
      p.vy = 0;
      p.grounded = true;
      p.launch = null;
    } else if (wasGrounded && !jumped && p.vy <= 0 && !p.launch && Number.isFinite(floor) && p.pos[1] - floor <= WORLD.step_height) {
      p.pos[1] = floor; // walk down ramps without hopping
      p.vy = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }
    p.vel = [hx, p.grounded ? 0 : p.vy, hz];

    // Fall off the island: once, ignores invulnerability.
    if (p.pos[1] < WORLD.fall_y) {
      p.flames -= 1;
      const lost = p.carried;
      p.carried = 0;
      p.fallWait = WORLD.fall_wait_ticks;
      p.vel = [0, 0, 0];
      p.vy = 0;
      p.launch = null;
      p.dashTicks = 0;
      ev('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  pickup(ev) {
    const p = this.player;
    const t = this.t;
    const cap = this.capacity();
    if (p.carried < cap) {
      const near = this.motes
        .map((m, i) => ({ m, i, d: distXZ(p.pos, m.pos) }))
        .filter((x) => x.d <= t.pickup_radius + EPS && Math.abs(p.pos[1] - x.m.pos[1]) <= WORLD.pickup_height + EPS)
        .sort((a, b) => a.d - b.d || a.i - b.i);
      const taken = new Set();
      for (const { m } of near) {
        if (p.carried >= cap) break;
        p.carried += 1;
        taken.add(m);
        ev('mote_picked', { carried: p.carried });
      }
      if (taken.size) this.motes = this.motes.filter((m) => !taken.has(m));
    }
    for (const c of this.charms) {
      if (!c.available) continue;
      if (distXZ(p.pos, c.pos) <= t.pickup_radius + EPS && Math.abs(p.pos[1] - c.pos[1]) <= WORLD.pickup_height + EPS) {
        c.available = false;
        c.respawn = WORLD.charm_respawn_ticks;
        p.charm = WORLD.charm_ticks;
        ev('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  /** Lanterns the player may feed right now (Phase 2: unlit only). */
  acceptsFuel(l) {
    return !l.lit;
  }

  interact(ev) {
    const p = this.player;
    const t = this.t;
    if (p.carried <= 0) return;
    let best = null;
    let bestD = Infinity;
    for (const l of this.lanterns) {
      if (!this.acceptsFuel(l)) continue;
      const d = distXZ(p.pos, l.pos);
      if (d > t.interact_radius + EPS) continue;
      if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && idCmp(l.id, best.id) < 0)) {
        best = l;
        bestD = d;
      }
    }
    if (!best) return;
    const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    best.deposited += amount;
    this.score += amount * t.score.per_mote;
    this.stats.deposited += amount;
    ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
    if (best.deposited >= t.lantern_cost) {
      best.lit = true;
      this.score += t.score.per_lantern;
      this.stats.lit += 1;
      ev('lantern_lit', { lantern_id: best.id });
      this.startEviction(best);
    }
  }

  startEviction(l) {
    for (const s of this.shades) {
      if (distXZ(s.pos, l.pos) < this.t.safe_radius) s.evict = { id: l.id, left: WORLD.safe_evict_ticks };
    }
  }

  updateEvictions() {
    for (const s of this.shades) {
      if (!s.evict) continue;
      const l = this.lanterns.find((x) => x.id === s.evict.id);
      const target = this.t.safe_radius + SAFE_EPS;
      const d = distXZ(s.pos, l.pos);
      if (!l.lit || d >= target - EPS) {
        s.evict = null;
        continue;
      }
      let dx = s.pos[0] - l.pos[0];
      let dz = s.pos[2] - l.pos[2];
      if (d < EPS) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      const nd = d + (target - d) / s.evict.left;
      s.pos[0] = l.pos[0] + dx * nd;
      s.pos[2] = l.pos[2] + dz * nd;
      s.evict.left -= 1;
      if (s.evict.left <= 0) s.evict = null;
    }
  }

  pulse(ev) {
    const p = this.player;
    const t = this.t;
    p.carried -= t.pulse_cost;
    p.pulseCd = ticks(t.pulse_cooldown_s);
    const center = [p.pos[0], p.pos[1] + WORLD.pulse_center_dy, p.pos[2]];
    const stunned = [];
    for (const s of [...this.shades].sort((a, b) => idCmp(a.id, b.id))) {
      if (dist3(center, s.pos) > t.pulse_radius + EPS) continue;
      const d = distXZ(p.pos, s.pos);
      s.pushDir = d < EPS ? [1, 0] : [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d];
      this.onShadePulsed(s);
      s.state = 'stunned';
      s.ticks = ticks(t.pulse_stun_s);
      s.pushTicks = WORLD.pulse_push_ticks;
      stunned.push(s.id);
      this.score += this.stunScore(s);
      this.stats.stunHits += 1;
    }
    for (const d of [...this.drifters].sort((a, b) => idCmp(a.id, b.id))) {
      if (dist3(center, d.pos) > t.pulse_radius + EPS) continue;
      if (d.state === 'chase' || d.state === 'idle') {
        if (d.state === 'chase') {
          d.state = 'flee';
          d.ticks = WORLD.drifter_flee_ticks;
          d.hasStolen = true; // a scared drifter never steals
        }
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        const f = floorAt(this.level, d.pos[0], d.pos[2], d.pos[1]);
        for (let i = 0; i < amount; i++) {
          this.motes.push({ id: this.nextMoteId(), pos: [round3(d.pos[0]), Number.isFinite(f) ? f : 0, round3(d.pos[2])], kind: 'dropped', ttl: WORLD.mote_drop_ttl_ticks, pointIdx: -1 });
        }
        d.stolen = 0;
        d.ticks = WORLD.drifter_drop_vanish_ticks;
        ev('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    ev('pulse', { stunned_ids: stunned });
  }

  /** Hook for later rules (Phase 3 drain). */
  onShadePulsed() {}

  stunScore() {
    return this.t.score.per_stun;
  }

  moveShades() {
    const p = this.player;
    const speed = this.shadeSpeed();
    const pushStep = this.t.pulse_push_m / WORLD.pulse_push_ticks;
    for (const s of this.shades) {
      if (s.evict) continue;
      switch (s.state) {
        case 'spawning':
          break;
        case 'stunned':
          if (s.pushTicks > 0) {
            s.pos[0] += s.pushDir[0] * pushStep;
            s.pos[2] += s.pushDir[1] * pushStep;
            s.pushTicks -= 1;
            const before = [s.pos[0], s.pos[2]];
            this.constrainShade(s);
            if (before[0] !== s.pos[0] || before[1] !== s.pos[2]) s.pushTicks = 0; // stopped by an obstacle
            this.floatY(s, WORLD.shade_height);
          }
          break;
        case 'recoil':
          s.pos[0] += (s.recoilDir[0] * WORLD.shade_recoil_m) / WORLD.shade_recoil_ticks;
          s.pos[2] += (s.recoilDir[1] * WORLD.shade_recoil_m) / WORLD.shade_recoil_ticks;
          this.constrainShade(s);
          this.floatY(s, WORLD.shade_height);
          break;
        default: {
          const d = distXZ(s.pos, p.pos);
          if (s.state === 'wander' && this.playerTargetable() && d <= WORLD.shade_detect_m + EPS) s.state = 'chase';
          else if (s.state === 'chase' && (!this.playerTargetable() || d > WORLD.shade_lose_m + EPS)) s.state = 'wander';
          if (s.state === 'chase') this.moveToward(s, p.pos, speed);
          else this.wander(s);
          this.constrainShade(s);
          this.floatY(s, WORLD.shade_height);
        }
      }
    }
  }

  /** Wander: roam at 2 m/s between random points within 10 m of the nearest dark lantern. */
  wander(s) {
    const target = this.wanderTarget(s);
    if (!target) return;
    const anchorChanged = s.wanderAnchor !== target.id;
    if (anchorChanged || !s.wanderPoint || distXZ(s.pos, s.wanderPoint) < 0.5 || s.wanderTicks <= 0) {
      const a = this.rng.range(0, 2 * Math.PI);
      const r = WORLD.shade_wander_radius * Math.sqrt(this.rng.next());
      s.wanderPoint = [target.pos[0] + r * Math.cos(a), 0, target.pos[2] + r * Math.sin(a)];
      s.wanderAnchor = target.id;
      s.wanderTicks = WORLD.shade_wander_repick_ticks;
    }
    s.wanderTicks -= 1;
    this.moveToward(s, s.wanderPoint, WORLD.shade_wander_speed);
  }

  wanderTarget(s) {
    let best = null;
    let bestD = Infinity;
    for (const l of this.lanterns) {
      if (l.lit) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < bestD - EPS || (Math.abs(d - bestD) <= EPS && idCmp(l.id, best.id) < 0)) {
        best = l;
        bestD = d;
      }
    }
    return best;
  }

  moveDrifters() {
    const p = this.player;
    for (const d of this.drifters) {
      if (d.state === 'flee') {
        const dx = d.pos[0] - p.pos[0];
        const dz = d.pos[2] - p.pos[2];
        const len = Math.hypot(dx, dz) || 1;
        d.pos[0] += (dx / len) * (WORLD.drifter_speed / TPS);
        d.pos[2] += (dz / len) * (WORLD.drifter_speed / TPS);
      } else {
        const want = !d.hasStolen && this.playerTargetable() && p.carried >= WORLD.drifter_chase_carried && distXZ(d.pos, p.pos) <= WORLD.drifter_chase_m + EPS;
        d.state = want ? 'chase' : 'idle';
        if (d.state === 'chase') {
          this.moveToward(d, p.pos, WORLD.drifter_speed);
        } else {
          if (d.headingTicks <= 0) {
            const a = this.rng.range(0, 2 * Math.PI);
            d.heading = [Math.cos(a), Math.sin(a)];
            d.headingTicks = 120;
          }
          d.headingTicks -= 1;
          d.pos[0] += d.heading[0] * (WORLD.drifter_idle_speed / TPS);
          d.pos[2] += d.heading[1] * (WORLD.drifter_idle_speed / TPS);
        }
      }
      const before = [d.pos[0], d.pos[2]];
      clampToBounds(this.level, d.pos);
      if (d.state === 'idle' && (before[0] !== d.pos[0] || before[1] !== d.pos[2])) d.headingTicks = 0;
      this.floatY(d, WORLD.drifter_height);
    }
  }

  contacts(ev) {
    const p = this.player;
    for (const d of [...this.drifters].sort((a, b) => idCmp(a.id, b.id))) {
      if (d.state !== 'chase' || d.hasStolen) continue;
      if (distXZ(d.pos, p.pos) > WORLD.drifter_steal_r + EPS) continue;
      const amount = Math.min(WORLD.drifter_steal_max, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.hasStolen = true;
      d.state = 'flee';
      d.ticks = WORLD.drifter_flee_ticks;
      ev('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    if (p.invuln > 0) return;
    const hitter = [...this.shades]
      .sort((a, b) => idCmp(a.id, b.id))
      .find((s) => this.canHit(s) && distXZ(s.pos, p.pos) <= this.t.shade_hit_radius + EPS && Math.abs(s.pos[1] - p.pos[1]) <= WORLD.shade_hit_dy + EPS);
    if (!hitter) return;
    p.flames -= 1;
    const dropped = Math.floor(p.carried * this.t.hit_drop_ratio);
    p.carried -= dropped;
    this.dropMotesAround(p.pos, dropped);
    p.invuln = ticks(this.t.invuln_s);
    const d = distXZ(hitter.pos, p.pos);
    hitter.recoilDir = d < EPS ? [1, 0] : [(hitter.pos[0] - p.pos[0]) / d, (hitter.pos[2] - p.pos[2]) / d];
    hitter.state = 'recoil';
    hitter.ticks = WORLD.shade_recoil_ticks;
    ev('player_hit', { by: 'shade', flames: p.flames, dropped });
  }

  canHit(s) {
    return !s.evict && (s.state === 'wander' || s.state === 'chase');
  }

  spawns(ev) {
    const k = this.simTick;
    const L = this.level;
    if (this.randomMotes && k % WORLD.mote_spawn_every_ticks === 0 && this.motes.length < WORLD.mote_cap) this.spawnRandomMote();
    if (this.randomShades) {
      let n = 0;
      if (k === WORLD.shade_first_spawn_tick) n = WORLD.shade_first_spawn_count;
      else if (k > WORLD.shade_first_spawn_tick && (k - WORLD.shade_first_spawn_tick) % L.shadeEveryTicks === 0) n = 1;
      for (let i = 0; i < n && this.shades.length < L.shadeMax; i++) {
        const valid = L.shadeSpawns.filter(
          (pt) => distXZ(pt, this.player.pos) >= WORLD.shade_spawn_min_player_m && this.lanterns.every((l) => !l.lit || distXZ(pt, l.pos) > this.t.safe_radius),
        );
        if (!valid.length) break;
        const pt = valid[Math.floor(this.rng.next() * valid.length)];
        const s = this.makeShade(this.nextShadeId(), pt, 'spawning');
        this.shades.push(s);
        ev('shade_spawned', { id: s.id });
      }
    }
    if (this.randomDrifters && k % WORLD.drifter_spawn_every_ticks === 0 && this.drifters.length < WORLD.drifter_max) {
      const pt = L.shadeSpawns[Math.floor(this.rng.next() * L.shadeSpawns.length)];
      this.drifters.push({ id: this.nextDrifterId(), pos: [pt[0], groundTop(L, pt[0], pt[2]) + WORLD.drifter_height, pt[2]], state: 'idle', stolen: 0, hasStolen: false, ticks: 0, heading: [1, 0], headingTicks: 0 });
    }
  }

  // ---------- output ----------
  lanternView(l) {
    return { id: l.id, pos: l.pos.map(round3), lit: l.lit, deposited: l.deposited };
  }

  playerView() {
    const p = this.player;
    return {
      pos: p.pos.map(round3),
      flames: p.flames,
      carried: p.carried,
      vel: p.vel.map(round3),
      grounded: p.grounded,
      invuln: p.invuln > 0,
      dash_cd_s: secs(p.dashCd),
      pulse_cd_s: secs(p.pulseCd),
      charm_s: secs(p.charm),
    };
  }

  /** Contract §E snapshot line (v1.1 fields). */
  snapshot() {
    const v3 = (a) => a.map(round3);
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.simTick,
      state: this.state,
      night: this.night,
      time_left_s: round3(Math.max(0, this.timeLeft())),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dirDeg },
      player: this.playerView(),
      lanterns: this.lanterns.map((l) => this.lanternView(l)),
      shades: this.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : secs(m.ttl) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: secs(c.available ? 0 : c.respawn) })),
    };
  }
}
