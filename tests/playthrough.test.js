import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playBot } from '../scripts/bot.js';
import { runCli } from './harness.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl-bot-'));

for (const seed of [1, 2, 3]) {
  test(`full Night 1 playthrough, seed ${seed}: bot inputs replayed via CLI reach "won/all_lit" with the same score`, () => {
    const bot = playBot(seed);
    assert.equal(bot.state, 'won');
    const inputs = join(tmp, `bot-${seed}.json`);
    const out = join(tmp, `bot-${seed}.jsonl`);
    writeFileSync(inputs, JSON.stringify({ frames: bot.frames }));
    const r = runCli(['--seed', String(seed), '--night', '1', '--inputs', inputs, '--ticks', '18000', '--out', out]);
    assert.equal(r.code, 0, r.stderr);
    const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const end = lines.at(-1);
    assert.deepEqual(end, { type: 'end', ticks: bot.ticks, state: 'won', score: bot.score });
    const over = lines.filter((l) => l.name === 'game_over');
    assert.deepEqual(over.map((o) => o.data), [{ result: 'won', reason: 'all_lit' }]);
    assert.equal(lines.filter((l) => l.name === 'lantern_lit').length, 5);
  });
}
