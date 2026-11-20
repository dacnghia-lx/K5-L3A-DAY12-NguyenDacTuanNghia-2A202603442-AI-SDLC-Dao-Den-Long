import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from './harness.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl-cli-'));
const file = (name, content) => {
  const p = join(tmp, name);
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content));
  return p;
};
const out = (name) => join(tmp, name);

const inputs = file('inputs.json', {
  frames: [
    { tick: 0, move: [0.3, 1], cam_yaw_deg: 15 },
    { tick: 200, move: [-1, 0.2], pulse: true },
    { tick: 201, pulse: false, jump: true },
    { tick: 202, jump: false },
    { tick: 900, move: [0.5, -1], cam_yaw_deg: -40, interact: true },
    { tick: 901, interact: false },
  ],
});

test('determinism: same seed + inputs => byte-identical output (default random level, 3600 ticks)', () => {
  for (const o of ['d1.jsonl', 'd2.jsonl']) {
    const r = runCli(['--seed', '42', '--night', '1', '--inputs', inputs, '--ticks', '3600', '--out', out(o)]);
    assert.equal(r.code, 0, r.stderr);
  }
  const a = readFileSync(out('d1.jsonl'), 'utf8');
  const b = readFileSync(out('d2.jsonl'), 'utf8');
  assert.ok(a.length > 1000);
  assert.equal(a, b);
});

test('different seed => different level', () => {
  runCli(['--seed', '43', '--night', '1', '--ticks', '1', '--out', out('s43.jsonl')]);
  runCli(['--seed', '44', '--night', '1', '--ticks', '1', '--out', out('s44.jsonl')]);
  assert.notEqual(readFileSync(out('s43.jsonl'), 'utf8'), readFileSync(out('s44.jsonl'), 'utf8'));
});

test('output format: snapshot first, end line last, every line valid JSON, coords rounded to 3 decimals', () => {
  const r = runCli(['--seed', '5', '--night', '1', '--inputs', inputs, '--ticks', '600', '--out', out('fmt.jsonl')]);
  assert.equal(r.code, 0, r.stderr);
  const lines = readFileSync(out('fmt.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.deepEqual(Object.keys(lines.at(-1)), ['type', 'ticks', 'state', 'score']);
  assert.equal(lines.at(-1).type, 'end');
  const snaps = lines.filter((l) => l.type === 'snapshot');
  assert.equal(snaps.length, 61);
  for (const s of snaps) {
    for (const k of ['tick', 'sim_tick', 'state', 'night', 'time_left_s', 'score', 'wind', 'player', 'lanterns', 'shades', 'motes_active', 'motes', 'drifters', 'charms']) assert.ok(k in s, k);
    for (const st of s.shades.map((x) => x.state)) assert.ok(['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(st), st);
    for (const l of s.lanterns) for (const k of ['fuel', 'ever_lit', 'relit_count']) assert.ok(k in l, k);
    assert.ok('capacity' in s.player);
    const nums = [...s.player.pos, ...s.shades.flatMap((x) => x.pos), ...s.lanterns.flatMap((x) => x.pos)];
    for (const n of nums) assert.equal(Math.round(n * 1000) / 1000, n);
  }
  for (const e of lines.filter((l) => l.type === 'event')) assert.deepEqual(Object.keys(e), ['type', 'tick', 'name', 'data']);
});

const bad = [
  ['inputs not JSON', ['--inputs', file('b1.json', '{oops')]],
  ['frames missing', ['--inputs', file('b2.json', { foo: [] })]],
  ['ticks not increasing', ['--inputs', file('b3.json', { frames: [{ tick: 5 }, { tick: 5 }] })]],
  ['move out of range', ['--inputs', file('b4.json', { frames: [{ tick: 0, move: [2, 0] }] })]],
  ['button not boolean', ['--inputs', file('b5.json', { frames: [{ tick: 0, pulse: 1 }] })]],
  ['scenario not JSON', ['--scenario', file('b6.json', 'nope')]],
  ['unknown lantern id', ['--scenario', file('b7.json', { lanterns: [{ id: 'L9' }] })]],
  ['bad shade pos', ['--scenario', file('b8.json', { shades: [{ pos: [1, 2] }] })]],
  ['missing scenario file', ['--scenario', join(tmp, 'does-not-exist.json')]],
  ['bad shade state', ['--scenario', file('b9.json', { shades: [{ pos: [1, 0, 1], state: 'angry' }] })]],
  ['bad drifter state', ['--scenario', file('b10.json', { drifters: [{ pos: [1, 0, 1], state: 'zoom' }] })]],
  ['charm without pos on night 1', ['--scenario', file('b11.json', { charms: [{ id: 'C1' }] })]],
  ['dash not boolean', ['--inputs', file('b12.json', { frames: [{ tick: 0, dash: 'yes' }] })]],
  ['pause not boolean', ['--inputs', file('b13.json', { frames: [{ tick: 0, pause: 1 }] })]],
  ['lantern fuel out of range', ['--scenario', file('b14.json', { lanterns: [{ id: 'L1', lit: true, fuel: 150 }] })]],
  ['ever_lit not boolean', ['--scenario', file('b15.json', { lanterns: [{ id: 'L1', ever_lit: 'yes' }] })]],
];
for (const [name, extra] of bad) {
  test(`malformed file => exit 2 + stderr: ${name}`, () => {
    const r = runCli(['--seed', '1', '--night', '1', ...extra, '--ticks', '10', '--out', out('bad.jsonl')]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /error/);
  });
}

test('bad CLI usage => non-zero exit + stderr', () => {
  for (const args of [[], ['--seed', 'x', '--ticks', '1', '--out', out('u.jsonl')], ['--seed', '1', '--night', '4', '--ticks', '1', '--out', out('u.jsonl')]]) {
    const r = runCli(args);
    assert.notEqual(r.code, 0);
    assert.ok(r.stderr.length > 0);
  }
});

test('performance: a full Night 3 (21600 ticks max) runs in well under the 30 s limit (< 5 s)', () => {
  const t0 = process.hrtime.bigint();
  const r = runCli(['--seed', '9', '--night', '3', '--ticks', '21600', '--out', out('perf.jsonl')]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.equal(r.code, 0, r.stderr);
  assert.ok(ms < 5000, `took ${ms} ms`);
});
