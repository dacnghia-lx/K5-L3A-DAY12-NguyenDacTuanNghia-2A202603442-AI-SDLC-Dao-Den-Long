#!/usr/bin/env node
// Claude Code Stop hook: the agent may not finish its turn while `npm test` is red.
// Exit 2 = block the stop and feed the failure summary back to the agent.
// If the hook already blocked once in this stop cycle (stop_hook_active), let it stop
// so a genuinely stuck agent can report to the human instead of looping forever.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let payload = {};
try {
  const raw = readFileSync(0, 'utf8');
  payload = raw ? JSON.parse(raw) : {};
} catch {}
const r = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--silent'], { encoding: 'utf8', shell: process.platform === 'win32' });
if (r.status === 0) process.exit(0);
const out = `${r.stdout}\n${r.stderr}`;
const fails = out.split('\n').filter((l) => /^not ok|✖|AssertionError|# fail/.test(l.trim())).slice(0, 25).join('\n');
if (payload.stop_hook_active) {
  process.stderr.write(`Tests are STILL red after one retry — tell the human honestly:\n${fails}\n`);
  process.exit(0);
}
process.stderr.write(`npm test is failing — fix it (or record a reasoned test change in docs/notes) before finishing:\n${fails}\n`);
process.exit(2);
