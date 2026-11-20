#!/usr/bin/env node
// Tiny static server for the browser game (no dependencies) + local leaderboard API.
//   node scripts/serve.js                      -> http://localhost:8080   (npm start does the same)
//   PORT=9000 node scripts/serve.js
//   node scripts/serve.js --export-leaderboard out.json   -> writes {"entries":[...]} and exits
// The leaderboard lives on local disk: data/leaderboard.json (override with LEADERBOARD_FILE).
// Dev-only: POST /__shot?name=x (PNG data URL body) saves docs/proof/<phase>/screens/x.png.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addEntry, sortEntries } from '../src/leaderboard.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PHASE = process.env.PHASE || 'phase-4';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
const ALLOWED = ['src', join('node_modules', 'three', 'build')];
export const LEADERBOARD_FILE = resolve(process.env.LEADERBOARD_FILE || join(ROOT, 'data', 'leaderboard.json'));

export function loadLeaderboard(file = LEADERBOARD_FILE) {
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(data.entries) ? sortEntries(data.entries) : [];
  } catch {
    return [];
  }
}
function saveLeaderboard(entries, file = LEADERBOARD_FILE) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ entries }, null, 2) + '\n');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString();
}

export function startServer(port = Number(process.env.PORT || 8080)) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/leaderboard') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ entries: loadLeaderboard() }));
        return;
      }
      if (req.method === 'POST') {
        try {
          const body = JSON.parse(await readBody(req));
          const r = addEntry(loadLeaderboard(), body);
          saveLeaderboard(r.entries);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(r));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
        }
        return;
      }
    }
    if (req.method === 'POST' && url.pathname === '/__shot') {
      const name = (url.searchParams.get('name') || 'shot').replace(/[^a-z0-9_-]/gi, '_');
      const data = (await readBody(req)).replace(/^data:image\/png;base64,/, '');
      const dir = join(ROOT, 'docs', 'proof', PHASE, 'screens');
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${name}.png`), Buffer.from(data, 'base64'));
      res.writeHead(200).end(`saved docs/proof/${PHASE}/screens/${name}.png`);
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(302, { Location: '/src/web/index.html' + url.search }).end();
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[\\/]+/, '');
    if (!ALLOWED.some((a) => rel === a || rel.startsWith(a + sep) || rel.startsWith(a + '/'))) {
      res.writeHead(404).end('not found');
      return;
    }
    try {
      const body = await readFile(join(ROOT, rel));
      res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--export-leaderboard');
  if (i >= 0) {
    const out = args[i + 1];
    if (!out) {
      process.stderr.write('error: --export-leaderboard needs an output file\n');
      process.exit(1);
    }
    const target = resolve(out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify({ entries: loadLeaderboard() }, null, 2) + '\n');
    console.log(`wrote ${loadLeaderboard().length} entries to ${out}${existsSync(LEADERBOARD_FILE) ? '' : ' (no leaderboard saved yet)'}`);
  } else {
    startServer().then((s) => console.log(`Đảo Đèn Lồng: open http://localhost:${s.address().port}  (Ctrl+C to stop)`));
  }
}
