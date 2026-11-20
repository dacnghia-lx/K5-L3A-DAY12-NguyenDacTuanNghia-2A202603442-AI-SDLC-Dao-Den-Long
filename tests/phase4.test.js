// Phase 4 (Ticket-04): leaderboard rules + export CLI, soak runner, benchmark scene, contract v1.3.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addEntry, isValidName, isoWithOffset, sortEntries } from '../src/leaderboard.js';
import { runSoak } from '../scripts/soak.js';
import { Sim, benchScenario } from '../src/sim/sim.js';
import { ROOT } from './harness.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl-p4-'));
const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

test('contract v1.3 declares bench_cmd and soak_cmd', () => {
  assert.equal(contract.contract_version, '1.3');
  assert.equal(typeof contract.bench_cmd, 'string');
  assert.equal(typeof contract.soak_cmd, 'string');
});

test('leaderboard names: 3-12 of [A-Za-z0-9_], Vietnamese accepted, others rejected', () => {
  for (const ok of ['Mây', 'abc', 'Player_12', 'NguyễnĐắc', 'a_b']) assert.ok(isValidName(ok), ok);
  for (const bad of ['ab', '', 'thirteen_char', 'has space', 'semi;colon', 'x'.repeat(13)]) assert.ok(!isValidName(bad), bad);
});

test('leaderboard: score desc, ties -> earlier first, top 10 only, ISO 8601 with offset', () => {
  let entries = [];
  const at = (m) => `2026-11-20T10:${String(m).padStart(2, '0')}:00+07:00`;
  for (let i = 0; i < 12; i++) entries = addEntry(entries, { name: `p${i}xx`, score: 100 * (i % 4), nights_won: i % 4, seed: i, achieved_at: at(i) }).entries;
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.slice(0, 3).map((e) => e.name), ['p3xx', 'p7xx', 'p11xx']); // all 300, in time order
  assert.ok(entries.every((e, i) => i === 0 || entries[i - 1].score >= e.score));
  const r = addEntry(entries, { name: 'late', score: 300, nights_won: 3, seed: 1, achieved_at: at(59) });
  assert.equal(r.rank, 4, 'same score as the top three but later -> 4th');
  assert.match(isoWithOffset(new Date()), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.deepEqual(sortEntries([{ score: 1, achieved_at: at(1) }, { score: 2, achieved_at: at(2) }]).map((e) => e.score), [2, 1]);
  assert.throws(() => addEntry([], { name: 'ok_name', score: 1, nights_won: 4, seed: 1 }));
});

test('run_cmd --export-leaderboard out.json writes {"entries": [...]} in order', () => {
  const file = join(tmp, 'lb.json');
  writeFileSync(file, JSON.stringify({ entries: [
    { name: 'bbb', score: 50, nights_won: 1, achieved_at: '2026-11-20T10:00:00+07:00', seed: 2 },
    { name: 'aaa', score: 90, nights_won: 2, achieved_at: '2026-11-20T11:00:00+07:00', seed: 1 },
  ] }));
  const out = join(tmp, 'out.json');
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'serve.js'), '--export-leaderboard', out], { encoding: 'utf8', env: { ...process.env, LEADERBOARD_FILE: file } });
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(data), ['entries']);
  assert.deepEqual(data.entries.map((e) => e.name), ['aaa', 'bbb']);
  assert.deepEqual(Object.keys(data.entries[0]).sort(), ['achieved_at', 'name', 'nights_won', 'score', 'seed']);
});

test('soak: 3 nights in one process, no crash, results per night, memory fields', () => {
  const r = runSoak({ seed: 7, nights: 3 });
  assert.equal(r.nights, 3);
  assert.equal(r.crashes, 0);
  assert.equal(r.results.length, 3);
  assert.ok(r.results.every((x) => x === 'won' || x === 'lost'));
  for (const k of ['mem_start_mb', 'mem_end_mb', 'duration_s']) assert.equal(typeof r[k], 'number', k);
});

test('bench scene: 200 wandering shades, 100 fireflies, L1-L3 lit at 100 fuel that never burns, no events, Mây stays at origin', () => {
  const sim = new Sim({ seed: 42, night: 1, scenario: benchScenario(42), bench: true });
  const events = [];
  for (let i = 0; i < 1200; i++) events.push(...sim.step({ move: [0, 0], cam_yaw_deg: 0 }));
  const s = sim.snapshot();
  assert.equal(s.shades.length, 200);
  assert.ok(s.shades.every((x) => x.state === 'wander'));
  assert.equal(s.motes_active, 100);
  assert.deepEqual(s.lanterns.map((l) => [l.lit, l.fuel]), [[true, 100], [true, 100], [true, 100], [false, 0], [false, 0]]);
  assert.equal(events.length, 0);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.state, 'playing');
  const again = new Sim({ seed: 42, night: 1, scenario: benchScenario(42), bench: true }).snapshot();
  assert.deepEqual(again.shades.slice(0, 3), new Sim({ seed: 42, night: 1, scenario: benchScenario(42), bench: true }).snapshot().shades.slice(0, 3), 'same layout for seed 42');
});
