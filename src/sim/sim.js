// Pure, deterministic game simulation for Đảo Đèn Lồng (Test Contract v1.0).
// Shared by the headless CLI (src/headless.js) and the browser game (src/web/).
// No DOM, no Date, no Math.random — only the seeded RNG.
import { makeRng } from './rng.js';
import { TUNING, WORLD } from './tuning.js';

const TPS = WORLD.tick_rate;
const SAFE_EPS = 0.002; // keeps shades strictly outside safe_radius after 3-decimal rounding

export const round3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const DEFAULT_INPUT = Object.freeze({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
});

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

export function defaultLanterns(count = TUNING.lantern_count_night1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push({
      id: `L${i + 1}`,
      pos: [round3(WORLD.lantern_ring_radius * Math.sin(a)), 0, round3(WORLD.lantern_ring_radius * Math.cos(a))],
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

export class Sim {
  /**
   * @param {object} opts
   * @param {number} opts.seed
   * @param {object|null} [opts.scenario] validated scenario (see io.js)
   * @param {object} [opts.tuning]
   */
  constructor({ seed = 0, scenario = null, tuning = TUNING } = {}) {
    const sc = scenario || {};
    this.t = tuning;
    this.rng = makeRng(seed);
    this.steps = 0;
    this.state = 'playing';
    this.result = null; // { result, reason } once game over
    this.score = 0;
    this.prevButtons = { jump: false, interact: false, pulse: false, dash: false };
    this.pulseCooldown = 0; // ticks
    this.invuln = 0; // ticks
    this.lastMoveDir = [0, 1];

    const sp = sc.player || {};
    this.player = {
      pos: sp.pos ? [...sp.pos] : [0, 0, 0],
      vy: 0,
      flames: sp.flames ?? tuning.flames,
      carried: sp.carried ?? 0,
    };

    this.lanterns = defaultLanterns(tuning.lantern_count_night1);
    for (const l of sc.lanterns || []) {
      const target = this.lanterns.find((x) => x.id === l.id);
      if (l.pos) target.pos = [...l.pos];
      if (l.deposited !== undefined) target.deposited = l.deposited;
      if (l.lit !== undefined) target.lit = l.lit;
      // A lit lantern is full; a full lantern is lit (no event/score while building).
      if (target.lit) target.deposited = tuning.lantern_cost;
      if (target.deposited >= tuning.lantern_cost) target.lit = true;
    }

    this.randomMotes = sc.random_motes ?? true;
    this.randomShades = sc.random_shades ?? true;
    this.initialTimeLeft = sc.time_left_s ?? tuning.night1_duration_s;

    this.moteSeq = 0;
    this.motes = [];
    this.moteRespawnQueue = [];
    if (sc.motes) {
      for (const m of sc.motes) this.motes.push({ id: m.id ?? this.nextMoteId(), pos: [...m.pos] });
    } else if (this.randomMotes) {
      for (let i = 0; i < WORLD.mote_target; i++) this.spawnMote();
    }

    this.shadeSeq = 0;
    this.shades = [];
    this.nextShadeSpawnTick = Math.round(WORLD.shade_spawn_first_s * TPS);
    if (sc.shades) {
      const used = new Set(sc.shades.filter((s) => s.id !== undefined).map((s) => String(s.id)));
      for (const s of sc.shades) {
        let id = s.id;
        if (id === undefined) {
          do id = this.nextShadeId();
          while (used.has(id));
          used.add(id);
        }
        this.shades.push({ id: String(id), pos: [...s.pos], state: 'chase', stun: 0 });
      }
    } else if (this.randomShades) {
      for (let i = 0; i < WORLD.shade_initial; i++) this.spawnShade();
    }
  }

  nextMoteId() {
    this.moteSeq += 1;
    return `M${this.moteSeq}`;
  }

  nextShadeId() {
    this.shadeSeq += 1;
    let id = `S${this.shadeSeq}`;
    while (this.shades.some((s) => s.id === id)) {
      this.shadeSeq += 1;
      id = `S${this.shadeSeq}`;
    }
    return id;
  }

  spawnMote() {
    const r = Math.sqrt(this.rng.range(WORLD.mote_min_r ** 2, WORLD.mote_max_r ** 2));
    const a = this.rng.range(0, 2 * Math.PI);
    const m = { id: this.nextMoteId(), pos: [round3(r * Math.cos(a)), 0, round3(r * Math.sin(a))] };
    this.motes.push(m);
    return m;
  }

  spawnShade() {
    let pos = null;
    for (let tries = 0; tries < 24; tries++) {
      const r = this.rng.range(WORLD.shade_spawn_min_r, WORLD.shade_spawn_max_r);
      const a = this.rng.range(0, 2 * Math.PI);
      pos = [round3(r * Math.cos(a)), WORLD.shade_height, round3(r * Math.sin(a))];
      const farFromPlayer = distXZ(pos, this.player.pos) >= WORLD.shade_spawn_min_player_dist;
      const outsideSafe = this.lanterns.every((l) => !l.lit || distXZ(pos, l.pos) > this.t.safe_radius);
      if (farFromPlayer && outsideSafe) break;
    }
    const s = { id: this.nextShadeId(), pos, state: 'chase', stun: 0 };
    this.shades.push(s);
    return s;
  }

  timeLeft() {
    return this.initialTimeLeft - this.steps / TPS;
  }

  litCount() {
    return this.lanterns.filter((l) => l.lit).length;
  }

  /** Push a shade out of every lit lantern's safe radius and inside the world bound. */
  constrainShade(s) {
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.pos, l.pos);
      if (d < this.t.safe_radius) {
        let dx = s.pos[0] - l.pos[0];
        let dz = s.pos[2] - l.pos[2];
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
        } else {
          dx /= d;
          dz /= d;
        }
        const r = this.t.safe_radius + SAFE_EPS;
        s.pos[0] = l.pos[0] + dx * r;
        s.pos[2] = l.pos[2] + dz * r;
      }
    }
    const rr = Math.hypot(s.pos[0], s.pos[2]);
    if (rr > WORLD.shade_bound_radius) {
      s.pos[0] *= WORLD.shade_bound_radius / rr;
      s.pos[2] *= WORLD.shade_bound_radius / rr;
    }
  }

  endGame(result, reason, events, tick) {
    this.state = result;
    this.result = { result, reason };
    if (result === 'won') {
      const left = Math.max(0, Math.floor(this.timeLeft() + 1e-9));
      this.score += left * this.t.score.per_second_left + this.player.flames * this.t.score.per_flame_left;
    }
    events.push({ type: 'event', tick, name: 'game_over', data: { result, reason } });
  }

  /**
   * Advance one fixed tick. `input` holds the CURRENT held values
   * ({move, cam_yaw_deg, jump, interact, pulse, dash}); edges are detected here.
   * Returns the events produced in this step (stamped with the new tick).
   */
  step(input = DEFAULT_INPUT) {
    if (this.state !== 'playing') return [];
    const t = this.t;
    const events = [];
    this.steps += 1;
    const tick = this.steps;
    const ev = (name, data) => events.push({ type: 'event', tick, name, data });

    const edge = (k) => Boolean(input[k]) && !this.prevButtons[k];
    const jumpEdge = edge('jump');
    const interactEdge = edge('interact');
    const pulseEdge = edge('pulse');
    for (const k of Object.keys(this.prevButtons)) this.prevButtons[k] = Boolean(input[k]);

    if (this.pulseCooldown > 0) this.pulseCooldown -= 1;
    if (this.invuln > 0) this.invuln -= 1;

    // 1. Player movement (XZ) + island edge wall.
    const p = this.player;
    const [wx, wz] = moveToWorld(input.move || [0, 0], input.cam_yaw_deg || 0);
    p.pos[0] += (wx * t.player_speed) / TPS;
    p.pos[2] += (wz * t.player_speed) / TPS;
    if (wx !== 0 || wz !== 0) this.lastMoveDir = [wx, wz];
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > WORLD.island_radius) {
      p.pos[0] *= WORLD.island_radius / pr;
      p.pos[2] *= WORLD.island_radius / pr;
    }

    // 2. Jump (vertical only; distances are XZ so jumping never dodges contacts).
    const onGround = p.pos[1] <= 0 && p.vy === 0;
    if (jumpEdge && onGround) p.vy = WORLD.jump_speed;
    if (p.pos[1] > 0 || p.vy !== 0) {
      p.vy -= WORLD.gravity / TPS;
      p.pos[1] += p.vy / TPS;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
      }
    }

    // 3. Firefly pickup: nearest first, up to carry capacity.
    if (p.carried < t.carry_capacity) {
      const near = this.motes
        .map((m, i) => ({ m, i, d: distXZ(p.pos, m.pos) }))
        .filter((x) => x.d <= t.pickup_radius)
        .sort((a, b) => a.d - b.d || a.i - b.i);
      const taken = new Set();
      for (const { m } of near) {
        if (p.carried >= t.carry_capacity) break;
        p.carried += 1;
        this.score += t.score.per_mote;
        taken.add(m);
        if (this.randomMotes) this.moteRespawnQueue.push(this.steps + Math.round(WORLD.mote_respawn_s * TPS));
        ev('mote_picked', { carried: p.carried });
      }
      if (taken.size) this.motes = this.motes.filter((m) => !taken.has(m));
    }

    // 4. Interact: deposit carried light into the nearest unlit lantern in range.
    if (interactEdge && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = distXZ(p.pos, l.pos);
        if (d <= t.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, t.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= t.lantern_cost) {
            best.lit = true;
            this.score += t.score.per_lantern;
            ev('lantern_lit', { lantern_id: best.id });
            // Shades already inside the new safe zone are pushed out immediately.
            for (const s of this.shades) this.constrainShade(s);
          }
        }
      }
    }
    if (this.lanterns.every((l) => l.lit)) {
      this.endGame('won', 'all_lit', events, tick);
      return events;
    }

    // 5. Light pulse: costs carried light, stuns + pushes shades in range.
    if (pulseEdge && this.pulseCooldown === 0 && p.carried >= t.pulse_cost) {
      p.carried -= t.pulse_cost;
      this.pulseCooldown = Math.round(t.pulse_cooldown_s * TPS);
      const stunned = [];
      for (const s of this.shades) {
        const d = distXZ(p.pos, s.pos);
        if (d > t.pulse_radius) continue;
        let dx = s.pos[0] - p.pos[0];
        let dz = s.pos[2] - p.pos[2];
        if (d < 1e-9) {
          [dx, dz] = this.lastMoveDir;
        } else {
          dx /= d;
          dz /= d;
        }
        s.pos[0] += dx * t.pulse_push_m;
        s.pos[2] += dz * t.pulse_push_m;
        s.state = 'stunned';
        s.stun = Math.round(t.pulse_stun_s * TPS);
        this.constrainShade(s);
        stunned.push(s.id);
        this.score += t.score.per_stun;
      }
      ev('pulse', { stunned_ids: stunned });
    }

    // 6. Shades: stunned ones count down; others chase the player.
    const stepLen = t.shade_speed / TPS;
    for (const s of this.shades) {
      if (s.state === 'stunned') {
        if (s.stun > 0) {
          s.stun -= 1;
          continue;
        }
        s.state = 'chase';
      }
      const dx = p.pos[0] - s.pos[0];
      const dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const mv = Math.min(stepLen, d);
        s.pos[0] += (dx / d) * mv;
        s.pos[2] += (dz / d) * mv;
      }
      this.constrainShade(s);
    }

    // 7. Contact damage (one hit per step, then invulnerability).
    if (this.invuln === 0) {
      const hitter = this.shades.find((s) => s.state !== 'stunned' && distXZ(s.pos, p.pos) <= t.shade_hit_radius);
      if (hitter) {
        p.flames -= 1;
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        this.invuln = Math.round(t.invuln_s * TPS);
        ev('player_hit', { by: 'shade', flames: p.flames, dropped });
        if (p.flames <= 0) {
          this.endGame('lost', 'no_flames', events, tick);
          return events;
        }
      }
    }

    // 8. Spawning (only when the level owns the lists).
    if (this.randomShades && this.shades.length < WORLD.shade_max && this.steps >= this.nextShadeSpawnTick) {
      const s = this.spawnShade();
      this.nextShadeSpawnTick += Math.round(WORLD.shade_spawn_every_s * TPS);
      ev('shade_spawned', { id: s.id });
    }
    if (this.randomMotes) {
      while (this.moteRespawnQueue.length && this.moteRespawnQueue[0] <= this.steps) {
        this.moteRespawnQueue.shift();
        if (this.motes.length < WORLD.mote_target) this.spawnMote();
      }
    }

    // 9. Dawn.
    if (this.timeLeft() <= 1e-9) {
      this.endGame('lost', 'dawn', events, tick);
      return events;
    }
    return events;
  }

  /** Contract §E snapshot line (as a plain object). */
  snapshot() {
    const v3 = (a) => a.map(round3);
    return {
      type: 'snapshot',
      tick: this.steps,
      sim_tick: this.steps,
      state: this.state,
      time_left_s: round3(Math.max(0, this.timeLeft())),
      score: this.score,
      player: { pos: v3(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
    };
  }
}
