// Parsing/validation of Test Contract v1.1 inputs and scenario files.
// Any malformed file -> FormatError (headless exits with code 2).
import { TUNING } from './tuning.js';
import { getLevel } from './levels.js';
import { SHADE_STATES, DRIFTER_STATES } from './sim.js';

export class FormatError extends Error {}

const fail = (msg) => {
  throw new FormatError(msg);
};
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const isCount = (v) => Number.isInteger(v) && v >= 0;
const isId = (v) => typeof v === 'string' || typeof v === 'number';

export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`${label}: invalid JSON (${e.message})`);
  }
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

/** Returns frames sorted as given; validates contract §C. */
export function parseInputs(obj) {
  if (!isObj(obj) || !Array.isArray(obj.frames)) fail('inputs: top-level object with "frames" array required');
  let last = -1;
  return obj.frames.map((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: must be an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) fail(`${where}.tick: non-negative integer required`);
    if (f.tick <= last) fail(`${where}.tick: ticks must strictly increase (${f.tick} after ${last})`);
    last = f.tick;
    const out = { tick: f.tick };
    if (f.move !== undefined) {
      if (!isVec(f.move, 2) || f.move.some((c) => c < -1 || c > 1)) fail(`${where}.move: [x, z] with each in [-1, 1] required`);
      out.move = [f.move[0], f.move[1]];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg: number required`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of BUTTONS) {
      if (f[b] === undefined) continue;
      if (typeof f[b] !== 'boolean') fail(`${where}.${b}: boolean required`);
      out[b] = f[b];
    }
    return out;
  });
}

function optCount(src, key, where, dst, dstKey = key) {
  if (src[key] === undefined) return;
  if (!isCount(src[key])) fail(`${where}.${key}: non-negative integer required`);
  dst[dstKey] = src[key];
}

function optBool(src, key, where, dst) {
  if (src[key] === undefined) return;
  if (typeof src[key] !== 'boolean') fail(`${where}.${key}: boolean required`);
  dst[key] = src[key];
}

function idList(arr, where, build) {
  if (!Array.isArray(arr)) fail(`${where}: array required`);
  const ids = new Set();
  return arr.map((e, i) => {
    const w = `${where}[${i}]`;
    const out = build(e, w);
    if (isObj(e) && e.id !== undefined) {
      if (!isId(e.id)) fail(`${w}.id: string required`);
      if (ids.has(String(e.id))) fail(`${w}.id: duplicate id ${e.id}`);
      ids.add(String(e.id));
      out.id = String(e.id);
    }
    return out;
  });
}

/** Validates contract §D (v1.1) and returns a normalized scenario object. */
export function parseScenario(obj, night = 1, tuning = TUNING) {
  if (!isObj(obj)) fail('scenario: top-level object required');
  const level = getLevel(night);
  const sc = {};
  if (obj.player !== undefined) {
    const p = obj.player;
    if (!isObj(p)) fail('scenario.player: object required');
    sc.player = {};
    if (p.pos !== undefined) {
      if (!isVec(p.pos, 3)) fail('scenario.player.pos: [x, y, z] required');
      sc.player.pos = [...p.pos];
    }
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      optCount(p, k, 'scenario.player', sc.player);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) optBool(obj, k, 'scenario', sc);

  if (obj.motes !== undefined) {
    sc.motes = idList(obj.motes, 'scenario.motes', (m, w) => {
      if (isVec(m, 3)) return { pos: [...m] };
      if (!isObj(m) || !isVec(m.pos, 3)) fail(`${w}: [x, y, z] or {id?, pos:[x,y,z]} required`);
      const out = { pos: [...m.pos] };
      if (m.kind !== undefined) {
        if (m.kind !== 'random' && m.kind !== 'dropped') fail(`${w}.kind: "random" or "dropped" required`);
        out.kind = m.kind;
      }
      optCount(m, 'ttl_ticks', w, out);
      if (out.kind === 'dropped' && out.ttl_ticks === undefined) out.ttl_ticks = 480;
      if (out.kind !== 'dropped') delete out.ttl_ticks;
      return out;
    });
  }
  if (obj.shades !== undefined) {
    sc.shades = idList(obj.shades, 'scenario.shades', (s, w) => {
      if (!isObj(s) || !isVec(s.pos, 3)) fail(`${w}: {id?, pos:[x,y,z]} required`);
      const out = { pos: [...s.pos] };
      if (s.state !== undefined) {
        if (!SHADE_STATES.includes(s.state)) fail(`${w}.state: one of ${SHADE_STATES.join(', ')} required`);
        out.state = s.state;
      }
      optCount(s, 'state_ticks_left', w, out);
      if (s.target_lantern_id !== undefined) {
        if (typeof s.target_lantern_id !== 'string' && s.target_lantern_id !== null) fail(`${w}.target_lantern_id: string required`);
        out.target_lantern_id = s.target_lantern_id;
      }
      return out;
    });
  }
  if (obj.drifters !== undefined) {
    sc.drifters = idList(obj.drifters, 'scenario.drifters', (d, w) => {
      if (!isObj(d) || !isVec(d.pos, 3)) fail(`${w}: {id?, pos:[x,y,z]} required`);
      const out = { pos: [...d.pos] };
      if (d.state !== undefined) {
        if (!DRIFTER_STATES.includes(d.state)) fail(`${w}.state: one of ${DRIFTER_STATES.join(', ')} required`);
        out.state = d.state;
      }
      optCount(d, 'stolen', w, out);
      optCount(d, 'state_ticks_left', w, out);
      return out;
    });
  }
  if (obj.charms !== undefined) {
    const defaults = level.charms.map((_, i) => `C${i + 1}`);
    sc.charms = idList(obj.charms, 'scenario.charms', (c, w) => {
      if (!isObj(c)) fail(`${w}: object required`);
      const out = {};
      if (c.pos !== undefined) {
        if (!isVec(c.pos, 3)) fail(`${w}.pos: [x, y, z] required`);
        out.pos = [...c.pos];
      } else if (!defaults.includes(String(c.id))) {
        fail(`${w}.pos: required for a charm that is not one of this night's (${defaults.join(', ') || 'none'})`);
      }
      optBool(c, 'available', w, out);
      optCount(c, 'respawn_ticks', w, out);
      return out;
    });
  }
  if (obj.lanterns !== undefined) {
    if (!Array.isArray(obj.lanterns)) fail('scenario.lanterns: array required');
    const n = level.lanterns.length;
    const valid = new Set(Array.from({ length: n }, (_, i) => `L${i + 1}`));
    sc.lanterns = obj.lanterns.map((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || !valid.has(l.id)) fail(`${where}: {id: "L1".."L${n}"} required`);
      const out = { id: l.id };
      if (l.pos !== undefined) {
        if (!isVec(l.pos, 3)) fail(`${where}.pos: [x, y, z] required`);
        out.pos = [...l.pos];
      }
      optBool(l, 'lit', where, out);
      if (l.deposited !== undefined) {
        if (!isCount(l.deposited)) fail(`${where}.deposited: non-negative integer required`);
        out.deposited = Math.min(l.deposited, tuning.lantern_cost);
      }
      return out;
    });
  }
  if (obj.time_left_s !== undefined) {
    if (!isNum(obj.time_left_s) || obj.time_left_s < 0) fail('scenario.time_left_s: non-negative number required');
    sc.time_left_s = obj.time_left_s;
  }
  return sc;
}
