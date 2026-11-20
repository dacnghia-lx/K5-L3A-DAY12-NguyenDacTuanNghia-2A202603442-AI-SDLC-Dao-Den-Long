// Parsing/validation of Test Contract v1.0 inputs and scenario files.
// Any malformed file -> FormatError (headless exits with code 2).
import { TUNING } from './tuning.js';

export class FormatError extends Error {}

const fail = (msg) => {
  throw new FormatError(msg);
};
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);
const isCount = (v) => Number.isInteger(v) && v >= 0;

export function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return fail(`${label}: invalid JSON (${e.message})`);
  }
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash'];

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

/** Validates contract §D and returns a normalized scenario object. */
export function parseScenario(obj, tuning = TUNING) {
  if (!isObj(obj)) fail('scenario: top-level object required');
  const sc = {};
  if (obj.player !== undefined) {
    const p = obj.player;
    if (!isObj(p)) fail('scenario.player: object required');
    sc.player = {};
    if (p.pos !== undefined) {
      if (!isVec(p.pos, 3)) fail('scenario.player.pos: [x, y, z] required');
      sc.player.pos = [...p.pos];
    }
    if (p.carried !== undefined) {
      if (!isCount(p.carried)) fail('scenario.player.carried: non-negative integer required');
      sc.player.carried = p.carried;
    }
    if (p.flames !== undefined) {
      if (!isCount(p.flames)) fail('scenario.player.flames: non-negative integer required');
      sc.player.flames = p.flames;
    }
  }
  for (const k of ['random_motes', 'random_shades']) {
    if (obj[k] === undefined) continue;
    if (typeof obj[k] !== 'boolean') fail(`scenario.${k}: boolean required`);
    sc[k] = obj[k];
  }
  if (obj.motes !== undefined) {
    if (!Array.isArray(obj.motes)) fail('scenario.motes: array required');
    sc.motes = obj.motes.map((m, i) => {
      if (isVec(m, 3)) return { pos: [...m] };
      if (isObj(m) && isVec(m.pos, 3)) return m.id === undefined ? { pos: [...m.pos] } : { id: String(m.id), pos: [...m.pos] };
      return fail(`scenario.motes[${i}]: [x, y, z] or {id?, pos:[x,y,z]} required`);
    });
  }
  if (obj.shades !== undefined) {
    if (!Array.isArray(obj.shades)) fail('scenario.shades: array required');
    const ids = new Set();
    sc.shades = obj.shades.map((s, i) => {
      if (!isObj(s) || !isVec(s.pos, 3)) fail(`scenario.shades[${i}]: {id?, pos:[x,y,z]} required`);
      const out = { pos: [...s.pos] };
      if (s.id !== undefined) {
        if (typeof s.id !== 'string' && typeof s.id !== 'number') fail(`scenario.shades[${i}].id: string required`);
        if (ids.has(String(s.id))) fail(`scenario.shades[${i}].id: duplicate id ${s.id}`);
        ids.add(String(s.id));
        out.id = String(s.id);
      }
      return out;
    });
  }
  if (obj.lanterns !== undefined) {
    if (!Array.isArray(obj.lanterns)) fail('scenario.lanterns: array required');
    const valid = new Set(Array.from({ length: tuning.lantern_count_night1 }, (_, i) => `L${i + 1}`));
    sc.lanterns = obj.lanterns.map((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || !valid.has(l.id)) fail(`${where}: {id: "L1".."L${tuning.lantern_count_night1}"} required`);
      const out = { id: l.id };
      if (l.pos !== undefined) {
        if (!isVec(l.pos, 3)) fail(`${where}.pos: [x, y, z] required`);
        out.pos = [...l.pos];
      }
      if (l.lit !== undefined) {
        if (typeof l.lit !== 'boolean') fail(`${where}.lit: boolean required`);
        out.lit = l.lit;
      }
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
