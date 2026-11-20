import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENARIOS } from './scenarios.js';
import { runScenario } from './harness.js';

const tmp = mkdtempSync(join(tmpdir(), 'ddl-scn-'));

for (const sc of SCENARIOS) {
  test(`scenario ${sc.name} [${sc.req}]: ${sc.what}`, () => {
    const { results } = runScenario(sc, join(tmp, sc.name));
    assert.ok(results.length > 0, 'scenario produced no checks');
    const failed = results.filter((r) => !r.pass).map((r) => r.msg);
    assert.deepEqual(failed, [], failed.join('\n'));
  });
}
