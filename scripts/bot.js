// Greedy autoplayer: plays the default Night 1 for a seed using the in-process Sim
// and records an inputs file (contract §C). Used as end-to-end evidence that the
// level is playable start -> win; the recorded inputs are replayed through the CLI.
//   node scripts/bot.js --seed 1 --out inputs.json
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Sim } from '../src/sim/sim.js';

const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function playBot(seed, maxTicks = 18000) {
  const sim = new Sim({ seed });
  const t = sim.t;
  const frames = [];
  let last = { move: null, interact: false, pulse: false };
  let pressedInteract = false;
  let pressedPulse = false;

  for (let k = 0; k < maxTicks && sim.state === 'playing'; k++) {
    const p = sim.player;
    const unlit = sim.lanterns.filter((l) => !l.lit);
    const nearestLantern = unlit.reduce((b, l) => (!b || dXZ(p.pos, l.pos) < dXZ(p.pos, b.pos) ? l : b), null);
    const need = nearestLantern ? t.lantern_cost - nearestLantern.deposited : 0;
    const threat = sim.shades.find((s) => s.state !== 'stunned' && dXZ(s.pos, p.pos) < 3);

    let target;
    if (p.carried >= Math.min(need + 1, t.carry_capacity) || (p.carried >= need && sim.motes.length === 0)) target = nearestLantern.pos;
    else if (sim.motes.length) target = sim.motes.reduce((b, m) => (!b || dXZ(p.pos, m.pos) < dXZ(p.pos, b.pos) ? m : b), null).pos;
    else target = nearestLantern.pos;

    const frame = { tick: k };
    let move = [0, 0];
    const d = dXZ(p.pos, target);
    if (d > 0.05) move = [(target[0] - p.pos[0]) / d, (target[2] - p.pos[2]) / d].map((v) => Math.round(v * 1e4) / 1e4);
    // Contract inputs: move components must stay within [-1, 1].
    move = move.map((v) => Math.max(-1, Math.min(1, v)));

    let interact = false;
    if (!pressedInteract && nearestLantern && p.carried > 0 && dXZ(p.pos, nearestLantern.pos) <= t.interact_radius - 0.3) interact = true;
    pressedInteract = interact;
    let pulse = false;
    if (!pressedPulse && threat && p.carried >= t.pulse_cost && sim.pulseCooldown === 0) pulse = true;
    pressedPulse = pulse;

    if (!last.move || move[0] !== last.move[0] || move[1] !== last.move[1]) frame.move = move;
    if (interact !== last.interact) frame.interact = interact;
    if (pulse !== last.pulse) frame.pulse = pulse;
    if (Object.keys(frame).length > 1) frames.push(frame);
    last = { move, interact, pulse };

    sim.step({ move, cam_yaw_deg: 0, interact, pulse, jump: false, dash: false });
  }
  return { frames, state: sim.state, score: sim.score, ticks: sim.steps, result: sim.result };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2);
  const seed = Number(a[a.indexOf('--seed') + 1] ?? 1);
  const out = a.includes('--out') ? a[a.indexOf('--out') + 1] : null;
  const r = playBot(seed);
  if (out) writeFileSync(out, JSON.stringify({ frames: r.frames }) + '\n');
  console.log(JSON.stringify({ seed, state: r.state, score: r.score, ticks: r.ticks, result: r.result, frames: r.frames.length }));
}
