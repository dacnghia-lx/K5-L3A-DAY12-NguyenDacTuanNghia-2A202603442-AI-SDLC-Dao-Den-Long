// Greedy autoplayer: plays a default Night (1-3) for a seed using the in-process Sim
// and records an inputs file (contract §C). Used as end-to-end evidence that each
// level is playable start -> win; the recorded inputs are replayed through the CLI.
//   node scripts/bot.js --seed 1 --night 2 --out inputs.json
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Sim } from '../src/sim/sim.js';

const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const P = (r, deg, y = 0) => [r * Math.cos((deg * Math.PI) / 180), y, r * Math.sin((deg * Math.PI) / 180)];
const ang = (p) => (Math.atan2(p[2], p[0]) * 180) / Math.PI;
const tierOf = (y) => (y > 4.5 ? 2 : y > 1.5 ? 1 : 0);

// ---------- per-night routing: next waypoint from `from` towards `to` ----------
function route2(from, to) {
  const side = (p) => (p[0] < 35 ? 'A' : 'B');
  if (side(from) === side(to)) return to;
  const onBridge = from[0] > 26 && from[0] < 44 && Math.abs(from[2]) <= 2;
  if (side(from) === 'A') return onBridge || dXZ(from, [27, 0, 0]) < 0.6 ? [45, 0, 0] : [27, 0, 0];
  return onBridge || dXZ(from, [43, 0, 0]) < 0.6 ? [25, 0, 0] : [43, 0, 0];
}

const blocked3 = (p) => {
  const r = Math.hypot(p[0], p[2]);
  return r < 9.5 || (p[2] > -1 && r < 25.5 && r > 10.5) || (p[2] > -1 && r <= 31 && r >= 23);
};
function route3(from, to) {
  const tf = tierOf(from[1]);
  const tt = tierOf(to[1]);
  const rf = Math.hypot(from[0], from[2]);
  if (tf === 2) {
    if (tt === 2) return to;
    return dXZ(from, [0, 6, -7.5]) < 0.6 ? [0, 0, -10] : [0, 6, -7.5]; // walk off the south edge
  }
  if (tf === 1) {
    if (tt === 2) return dXZ(from, [0, 3, 15]) < 0.5 ? [0, 3, 13] : [0, 3, 15]; // to the pad
    if (tt === 0) {
      const a = ang(from);
      return P(27, a); // step off the outer edge (r 24)
    }
    // stay on the half annulus: arc at r = 18
    const af = ang(from);
    const at = ang(to);
    if (Math.abs(af - at) < 25 && Math.abs(Math.hypot(to[0], to[2]) - 18) < 7) return to;
    const step = Math.max(-25, Math.min(25, at - af));
    return P(18, Math.min(165, Math.max(15, af + step)), 3);
  }
  // tier 0
  if (tt >= 1) {
    const ramp = from[0] >= 0 ? 30 : 150;
    const foot = P(31.5, ramp);
    if (dXZ(from, foot) < 0.6 || (Math.abs(ang(from) - ramp) < 2.5 && rf < 31.6)) return P(21, ramp, 3);
    return route3(from, foot);
  }
  // tier 0 -> tier 0 around the central obstacles
  let clear = true;
  for (let i = 1; i <= 20; i++) {
    const k = i / 20;
    if (blocked3([from[0] + (to[0] - from[0]) * k, 0, from[2] + (to[2] - from[2]) * k])) clear = false;
  }
  if (clear) return to;
  const af = ang(from);
  let d = ang(to) - af;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  // go around the south (free) side when both are reachable that way
  const step = Math.sign(d || 1) * Math.min(40, Math.abs(d));
  return P(Math.max(33, Math.min(36, rf)), af + step);
}

function nextWaypoint(night, from, to) {
  if (night === 2) return route2(from, to);
  if (night === 3) return route3(from, to);
  return to;
}

function pathCost(night, from, to) {
  let c = dXZ(from, to);
  if (night === 3) c += 25 * Math.abs(tierOf(from[1]) - tierOf(to[1]));
  if (night === 2 && (from[0] < 35) !== (to[0] < 35)) c += 30;
  return c;
}

export function playBot(seed, night = 1, maxTicks = 21600) {
  const sim = new Sim({ seed, night });
  const t = sim.t;
  const frames = [];
  let last = { move: null, interact: false, pulse: false };
  let pressedInteract = false;
  let pressedPulse = false;

  for (let k = 0; k < maxTicks && (sim.state === 'playing'); k++) {
    const p = sim.player;
    // Ticket-03: win = enough lanterns lit AT DAWN. Keep the lit ones fuelled first, then light more
    // until one above the threshold.
    const nearestOf = (ls) => ls.reduce((b, l) => (!b || pathCost(night, p.pos, l.pos) < pathCost(night, p.pos, b.pos) ? l : b), null);
    const low = sim.lanterns.filter((l) => l.lit && l.fuel < 45 * 60);
    const unlit = sim.lanterns.filter((l) => !l.lit);
    const want = Math.min(sim.lanterns.length, sim.winThreshold() + 1);
    let goal = nearestOf(low);
    if (!goal && sim.litCount() < want) goal = nearestOf(unlit);
    if (!goal) goal = sim.lanterns.filter((l) => l.lit).reduce((b, l) => (!b || l.fuel < b.fuel ? l : b), null);
    const need = !goal ? 0 : goal.lit ? sim.refuelNeed(goal) : sim.costOf(goal) - goal.deposited;
    const threats = sim.shades.filter((s) => (s.state === 'chase' || s.state === 'wander' || s.state === 'drain') && dXZ(s.pos, p.pos) < 4.6);
    const threat = threats.reduce((b, s) => (!b || dXZ(s.pos, p.pos) < dXZ(b.pos, p.pos) ? s : b), null);
    const thief = sim.drifters.find((d) => d.state === 'chase' && dXZ(d.pos, p.pos) < 4);

    const motes = sim.motes.filter((m) => !(night === 3 && tierOf(m.pos[1]) === 2 && tierOf(p.pos[1]) !== 2 && p.carried > 0));
    let target;
    const enough = p.carried >= Math.min(need, sim.capacity()) || (p.carried > 0 && motes.length === 0);
    if (enough && goal) target = goal.pos;
    else if (motes.length) {
      const danger = (m) => (sim.shades.some((s) => s.state !== 'stunned' && dXZ(s.pos, m.pos) < 6) ? 20 : 0);
      const cost = (m) => pathCost(night, p.pos, m.pos) + danger(m);
      target = motes.reduce((b, m) => (!b || cost(m) < cost(b) ? m : b), null).pos;
    }
    else target = goal.pos;

    const wp = p.fallWait > 0 ? p.pos : nextWaypoint(night, p.pos, target);
    const frame = { tick: k };
    let move = [0, 0];
    const d = dXZ(p.pos, wp);
    if (d > 0.05) move = [(wp[0] - p.pos[0]) / d, (wp[2] - p.pos[2]) / d].map((v) => Math.round(v * 1e4) / 1e4);
    move = move.map((v) => Math.max(-1, Math.min(1, v)));

    let interact = false;
    if (!pressedInteract && goal && p.carried > 0 && dXZ(p.pos, goal.pos) <= t.interact_radius - 0.3) interact = true;
    pressedInteract = interact;
    let pulse = false;
    const close = threats.filter((s) => s.state === 'chase' && dXZ(s.pos, p.pos) < 2.2);
    const cornered = close.length >= 2 || (close.length === 1 && p.dashCd > 0);
    if (!pressedPulse && p.invuln === 0 && (cornered || thief) && p.carried >= t.pulse_cost && p.pulseCd === 0) pulse = true;
    pressedPulse = pulse;

    let dash = false;
    if (threat && !pulse && p.dashCd === 0 && p.dashTicks === 0 && dXZ(threat.pos, p.pos) < 2.5 && p.invuln === 0) {
      const dd = dXZ(threat.pos, p.pos) || 1;
      move = [(p.pos[0] - threat.pos[0]) / dd, (p.pos[2] - threat.pos[2]) / dd].map((v) => Math.max(-1, Math.min(1, Math.round(v * 1e4) / 1e4)));
      dash = !last.dash;
    }
    if (!last.move || move[0] !== last.move[0] || move[1] !== last.move[1]) frame.move = move;
    if (interact !== last.interact) frame.interact = interact;
    if (pulse !== last.pulse) frame.pulse = pulse;
    if (dash !== Boolean(last.dash)) frame.dash = dash;
    if (Object.keys(frame).length > 1) frames.push(frame);
    last = { move, interact, pulse, dash };

    sim.step({ move, cam_yaw_deg: 0, interact, pulse, jump: false, dash, pause: false });
  }
  return { frames, state: sim.state, score: sim.score, ticks: sim.steps, result: sim.result, flames: sim.player.flames, lit: sim.litCount() };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2);
  const arg = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const seed = Number(arg('--seed', 1));
  const night = Number(arg('--night', 1));
  const out = arg('--out', null);
  const r = playBot(seed, night);
  if (out) writeFileSync(out, JSON.stringify({ frames: r.frames }) + '\n');
  console.log(JSON.stringify({ seed, night, state: r.state, score: r.score, ticks: r.ticks, result: r.result, lit: r.lit, flames: r.flames, frames: r.frames.length }));
}
