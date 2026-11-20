#!/usr/bin/env node
// Ticket-04 §2 soak test: 10 nights in ONE process (Night 1 -> 2 -> 3 -> 1 ...), night i (1-based)
// uses seed + i, each night runs until it ends or its standard duration is over. Seeded random input:
// a new move direction every 30 ticks; each tick 5% jump, 3% dash, 2% pulse, 10% interact.
//   node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sim } from '../src/sim/sim.js';
import { makeRng } from '../src/sim/rng.js';
import { getLevel } from '../src/sim/levels.js';

const rssMb = () => Math.round((process.memoryUsage().rss / 2 ** 20) * 10) / 10;
const gc = () => {
  if (global.gc) {
    global.gc();
    global.gc();
  }
};

/** Plays one night with seeded random input; returns 'won' | 'lost'. */
export function playRandomNight(sim, seed) {
  const rng = makeRng(seed ^ 0x5eed);
  const maxTicks = Math.round(getLevel(sim.night).durationS * 60) + 10;
  let move = [0, 0];
  for (let k = 0; k < maxTicks && sim.state !== 'won' && sim.state !== 'lost'; k++) {
    if (k % 30 === 0) {
      const a = rng.range(0, 2 * Math.PI);
      move = [Math.cos(a), Math.sin(a)];
    }
    sim.step({
      move,
      cam_yaw_deg: 0,
      jump: rng.next() < 0.05,
      dash: rng.next() < 0.03,
      pulse: rng.next() < 0.02,
      interact: rng.next() < 0.1,
      pause: false,
    });
  }
  return sim.state === 'won' ? 'won' : 'lost';
}

export function runSoak({ seed = 7, nights = 10 } = {}) {
  const t0 = process.hrtime.bigint();
  const results = [];
  let crashes = 0;
  let memStart = null;
  let sim = null;
  // "Loading" includes warming the JS engine: one throwaway run of each map (not counted below).
  // Without it, ~8 MB of one-off native JIT memory lands between mem_start and mem_end and hides
  // the real question (does memory grow night after night?). Both numbers are reported.
  const memCold = rssMb();
  for (let n = 1; n <= 3; n++) playRandomNight(new Sim({ seed: 100000 + n, night: n }), 100000 + n);
  gc();
  for (let i = 1; i <= nights; i++) {
    const night = ((i - 1) % 3) + 1;
    try {
      sim = new Sim({ seed: seed + i, night });
      if (memStart === null) {
        gc();
        memStart = rssMb(); // after the first night is loaded
      }
      results.push(playRandomNight(sim, seed + i));
    } catch (e) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`night ${i} crashed: ${e.stack || e}\n`);
    }
    sim = null; // reset between nights
  }
  gc();
  const memEnd = rssMb(); // after the last night has been reset
  const duration = Number(process.hrtime.bigint() - t0) / 1e9;
  return {
    nights, crashes, results, mem_start_mb: memStart, mem_end_mb: memEnd, duration_s: Math.round(duration * 10) / 10,
    seed, mem_before_warmup_mb: memCold, gc_exposed: Boolean(global.gc),
  };
}

function parseArgs(argv) {
  const o = { seed: 7, nights: 10, out: 'soak.json' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    if (a === '--seed') o.seed = Number(v);
    else if (a === '--nights') o.nights = Number(v);
    else if (a === '--out') o.out = v;
    else throw new Error(`unknown argument "${a}"`);
    i++;
  }
  if (!Number.isInteger(o.seed) || !Number.isInteger(o.nights) || o.nights < 1) throw new Error('--seed and --nights must be integers (nights >= 1)');
  return o;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const o = parseArgs(process.argv.slice(2));
    const r = runSoak(o);
    const out = resolve(o.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(r) + '\n');
    console.log(JSON.stringify(r));
    process.exitCode = r.crashes === 0 ? 0 : 1;
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exitCode = 1;
  }
}
