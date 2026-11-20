import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { playBot } from '../scripts/bot.js';
import { runCli } from './harness.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl-bot-'));

// Whole nights played by the greedy bot in-process, then replayed through the real CLI:
// the CLI must reach exactly the same end (same tick, state and score).
// Night 1 seed 3 is a known win with the Ticket-02 standard numbers; Nights 2/3 the bot
// survives but loses (see docs/notes/phase-2.md, honest limits) — the replay must still match.
const CASES = [
  { night: 1, seed: 3, expect: 'won' },
  { night: 2, seed: 2, expect: null },
  { night: 3, seed: 1, expect: null },
];

for (const { night, seed, expect } of CASES) {
  test(`full Night ${night} playthrough, seed ${seed}: bot inputs replayed via CLI give the same end${expect ? ` ("${expect}")` : ''}`, () => {
    const bot = playBot(seed, night);
    if (expect) assert.equal(bot.state, expect);
    const inputs = join(tmp, `bot-${night}-${seed}.json`);
    const out = join(tmp, `bot-${night}-${seed}.jsonl`);
    writeFileSync(inputs, JSON.stringify({ frames: bot.frames }));
    const r = runCli(['--seed', String(seed), '--night', String(night), '--inputs', inputs, '--ticks', '21600', '--out', out]);
    assert.equal(r.code, 0, r.stderr);
    const lines = readFileSync(out, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.at(-1), { type: 'end', ticks: bot.ticks, state: bot.state, score: bot.score });
    if (expect === 'won') {
      assert.deepEqual(lines.filter((l) => l.name === 'game_over').map((o) => o.data), [{ result: 'won', reason: 'all_lit' }]);
      assert.equal(lines.filter((l) => l.name === 'lantern_lit').length, 5);
    }
  });
}
