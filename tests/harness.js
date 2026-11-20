// Runs a scenario through the real headless CLI and evaluates its checks.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from './scenarios.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const HEADLESS = join(ROOT, 'src', 'headless.js');

export function runCli(args) {
  const r = spawnSync(process.execPath, [HEADLESS, ...args], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr, stdout: r.stdout };
}

/** Writes scenario/inputs into `dir`, runs the CLI, returns { cmd, code, results, lines }. */
export function runScenario(sc, dir) {
  mkdirSync(dir, { recursive: true });
  const args = ['--seed', String(sc.seed), '--night', '1'];
  if (sc.scenario) {
    writeFileSync(join(dir, 'scenario.json'), JSON.stringify(sc.scenario, null, 2) + '\n');
    args.push('--scenario', join(dir, 'scenario.json'));
  }
  if (sc.inputs) {
    writeFileSync(join(dir, 'inputs.json'), JSON.stringify(sc.inputs, null, 2) + '\n');
    args.push('--inputs', join(dir, 'inputs.json'));
  }
  const out = join(dir, 'out.jsonl');
  args.push('--ticks', String(sc.ticks), '--out', out, '--snapshot-every', String(sc.every ?? 10));
  const { code, stderr } = runCli(args);
  const results = [];
  let lines = [];
  if (code === 0) {
    lines = readFileSync(out, 'utf8').split('\n');
    const ok = (cond, msg) => results.push({ pass: Boolean(cond), msg });
    try {
      sc.check(parse(lines), ok);
    } catch (e) {
      results.push({ pass: false, msg: `check crashed: ${e.message}` });
    }
  } else {
    results.push({ pass: false, msg: `exit ${code}: ${stderr}` });
  }
  const rel = (p) => p.replace(ROOT, '.').replaceAll('\\', '/');
  const cmd = ['node src/headless.js', ...args.slice(0).map((a) => (a.includes(ROOT) ? rel(a) : a))].join(' ');
  return { cmd, code, results, lines };
}
