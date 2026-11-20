// Tiny static server for the browser game (no dependencies).
//   npm start            -> http://localhost:8080
//   PORT=9000 npm start
// Dev-only: POST /__shot?name=x (PNG data URL body) saves docs/proof/<phase>/screens/x.png
// so in-game screenshots (key P) become evidence files.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const PHASE = process.env.PHASE || 'phase-1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const ALLOWED = ['src', join('node_modules', 'three', 'build')];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/__shot') {
    const name = (url.searchParams.get('name') || 'shot').replace(/[^a-z0-9_-]/gi, '_');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const data = Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, '');
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

server.listen(PORT, () => console.log(`Đảo Đèn Lồng: open http://localhost:${PORT}  (Ctrl+C to stop)`));
