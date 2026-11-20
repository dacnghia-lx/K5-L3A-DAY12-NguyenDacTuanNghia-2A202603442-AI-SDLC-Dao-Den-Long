#!/usr/bin/env node
// Test Contract v1.1 headless runner.
// node src/headless.js --seed <int> --night <1|2|3> [--scenario f.json] [--inputs f.json]
//                      --ticks <int> --out <file.jsonl> [--snapshot-every <int, default 10>]
// Exit 0 on success, 2 on malformed inputs/scenario files, 1 on any other error.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Sim, DEFAULT_INPUT } from './sim/sim.js';
import { FormatError, parseInputs, parseJson, parseScenario } from './sim/io.js';

class UsageError extends Error {}

export function parseArgs(argv) {
  const opts = { snapshotEvery: 10, night: 1 };
  const need = (i, flag) => {
    if (i + 1 >= argv.length) throw new UsageError(`${flag} needs a value`);
    return argv[i + 1];
  };
  const int = (v, flag, min) => {
    if (!/^-?\d+$/.test(v) || Number(v) < min) throw new UsageError(`${flag} must be an integer >= ${min}, got "${v}"`);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--seed': opts.seed = int(need(i, a), a, -(2 ** 53)); i++; break;
      case '--night': opts.night = int(need(i, a), a, 1); i++; break;
      case '--scenario': opts.scenario = need(i, a); i++; break;
      case '--inputs': opts.inputs = need(i, a); i++; break;
      case '--ticks': opts.ticks = int(need(i, a), a, 0); i++; break;
      case '--out': opts.out = need(i, a); i++; break;
      case '--snapshot-every': opts.snapshotEvery = int(need(i, a), a, 1); i++; break;
      default: throw new UsageError(`unknown argument "${a}"`);
    }
  }
  if (opts.seed === undefined) throw new UsageError('--seed is required');
  if (opts.ticks === undefined) throw new UsageError('--ticks is required');
  if (!opts.out) throw new UsageError('--out is required');
  if (![1, 2, 3].includes(opts.night)) throw new UsageError(`--night must be 1, 2 or 3, got ${opts.night}`);
  return opts;
}

function readJsonFile(path, label) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new FormatError(`${label}: cannot read ${path} (${e.code || e.message})`);
  }
  return parseJson(text.replace(/^﻿/, ''), label);
}

/** Runs the simulation and returns the JSONL lines (without trailing newline). */
export function runHeadless({ seed, night = 1, scenario = null, frames = [], ticks, snapshotEvery = 10 }) {
  const sim = new Sim({ seed, night, scenario });
  const lines = [JSON.stringify(sim.snapshot())];
  lines.push(JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night } }));
  const held = { ...DEFAULT_INPUT, move: [...DEFAULT_INPUT.move] };
  let fi = 0;
  for (let k = 0; k < ticks; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      Object.assign(held, frames[fi]);
      fi++;
    }
    for (const e of sim.step(held)) lines.push(JSON.stringify(e));
    if (sim.steps % snapshotEvery === 0) lines.push(JSON.stringify(sim.snapshot()));
    if (sim.state === 'won' || sim.state === 'lost') break;
  }
  lines.push(JSON.stringify({ type: 'end', ticks: sim.steps, state: sim.state, score: sim.score }));
  return lines;
}

export function main(argv) {
  try {
    const opts = parseArgs(argv);
    const scenario = opts.scenario ? parseScenario(readJsonFile(opts.scenario, 'scenario'), opts.night) : null;
    const frames = opts.inputs ? parseInputs(readJsonFile(opts.inputs, 'inputs')) : [];
    const lines = runHeadless({ seed: opts.seed, night: opts.night, scenario, frames, ticks: opts.ticks, snapshotEvery: opts.snapshotEvery });
    const out = resolve(opts.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, lines.join('\n') + '\n');
    return 0;
  } catch (e) {
    if (e instanceof FormatError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 2;
    }
    process.stderr.write(`error: ${e instanceof UsageError ? e.message : e.stack || e}\n`);
    return 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv.slice(2));
}
