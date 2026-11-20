import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TUNING } from '../src/sim/tuning.js';
import { moveToWorld } from '../src/sim/sim.js';
import { ROOT } from './harness.js';

const contract = JSON.parse(readFileSync(join(ROOT, 'game.contract.json'), 'utf8'));

test('game.contract.json has all v1.0 fields', () => {
  assert.equal(contract.contract_version, '1.1');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.equal(typeof contract[k], 'string', k);
  const keys = ['player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
    'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s', 'pulse_push_m',
    'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius', 'fall_enabled', 'score',
    'dash_speed', 'dash_duration_s', 'dash_cooldown_s', 'night2_duration_s', 'night3_duration_s'];
  for (const k of keys) assert.ok(k in contract.tuning, k);
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) assert.ok(k in contract.tuning.score, k);
  assert.equal(contract.tuning.lantern_count_night1, 5);
  // Ticket-02 Part 1 standard values
  const std = { player_speed: 6, carry_capacity: 10, lantern_cost: 10, pickup_radius: 1, interact_radius: 2, pulse_cost: 3, pulse_radius: 5,
    pulse_cooldown_s: 3, safe_radius: 6, shade_speed: 4, shade_hit_radius: 1, flames: 3, invuln_s: 1.5, pulse_stun_s: 2, pulse_push_m: 4,
    dash_speed: 14, dash_duration_s: 0.2, dash_cooldown_s: 1.5, night1_duration_s: 300, night2_duration_s: 330, night3_duration_s: 360, fall_enabled: true };
  for (const [k, v] of Object.entries(std)) assert.equal(contract.tuning[k], v, k);
  assert.deepEqual(contract.tuning.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
});

test('declared tuning == tuning the game actually uses (src/sim/tuning.js)', () => {
  assert.deepEqual(contract.tuning, JSON.parse(JSON.stringify(TUNING)));
});

test('moveToWorld follows contract §C rotation and normalization', () => {
  const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(close(moveToWorld([0, 1], 0), [0, 1]));
  assert.ok(close(moveToWorld([1, 0], 0), [1, 0]));
  assert.ok(close(moveToWorld([0, 1], 90), [1, 0]));
  assert.ok(close(moveToWorld([1, 0], 90), [0, -1]));
  assert.ok(close(moveToWorld([1, 1], 0), [Math.SQRT1_2, Math.SQRT1_2]));
  assert.ok(close(moveToWorld([0.5, 0], 0), [0.5, 0]), 'short vectors are not scaled up');
});

test('sim purity: src/sim uses no Math.random / Date / DOM and never imports src/web (creative extras cannot affect headless)', async () => {
  const { readdirSync } = await import('node:fs');
  const dir = join(ROOT, 'src', 'sim');
  for (const f of readdirSync(dir)) {
    const code = readFileSync(join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /Math\.random|Date\.|new Date|performance\.now|window\.|document\./, f);
    assert.doesNotMatch(code, /from ['"].*web/, f);
  }
});
