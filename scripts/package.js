#!/usr/bin/env node
// Builds the runnable release folder + zip for GitHub Release v1.0.0:
//   node scripts/package.js   ->  dist/dao-den-long-v1.0.0/  and  dist/dao-den-long-v1.0.0.zip
// The release only needs Node.js >= 18: unzip, then `node scripts/serve.js` and open http://localhost:8080.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const NAME = 'dao-den-long-v1.0.0';
const out = join(ROOT, 'dist', NAME);
rmSync(join(ROOT, 'dist'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const p of ['src', 'scripts/serve.js', 'game.contract.json', 'LICENSE', 'CREDITS.md', 'README.md', 'node_modules/three/build/three.module.js', 'node_modules/three/LICENSE']) {
  cpSync(join(ROOT, p), join(out, p), { recursive: true });
}
writeFileSync(join(out, 'package.json'), JSON.stringify({ name: 'dao-den-long', version: '1.0.0', private: true, type: 'module', scripts: { start: 'node scripts/serve.js', headless: 'node src/headless.js' } }, null, 2) + '\n');
writeFileSync(join(out, 'CHAY-GAME.txt'), [
  'Đảo Đèn Lồng v1.0.0 — bản chạy được (cần Node.js >= 18, không cần cài thêm gì)',
  '',
  '1. Giải nén thư mục này.',
  '2. Mở terminal trong thư mục, chạy:  node scripts/serve.js',
  '3. Mở trình duyệt: http://localhost:8080',
  '',
  'Headless (Test Contract): node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl',
  'Xuất bảng xếp hạng:      node scripts/serve.js --export-leaderboard out.json',
  '',
].join('\n'));
const zip = spawnSync('tar', ['-a', '-c', '-f', `${NAME}.zip`, NAME], { cwd: join(ROOT, 'dist'), encoding: 'utf8' });
console.log(zip.status === 0 ? `built dist/${NAME}/ and dist/${NAME}.zip` : `built dist/${NAME}/ (zip it manually: ${zip.stderr || 'tar not available'})`);
