#!/usr/bin/env node
// Ticket-04 §1 benchmark: opens the real game in a 1280x720 browser window (not fullscreen, vsync
// and the frame-rate cap disabled), loads the standard bench scene (Night 1, 200 wandering shades,
// 100 fireflies, L1-L3 lit), flies the camera around for 3 s warm-up + --duration s, then writes
// bench.json and exits 0.
//   node scripts/bench.js --seed 42 --duration 30 --out bench.json
// Browser: Playwright's bundled Chromium (build_cmd installs it); falls back to installed Chrome/Edge.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { platform, release, cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { startServer } from './serve.js';

function parseArgs(argv) {
  const o = { seed: 42, duration: 30, out: 'bench.json', screenshot: null };
  for (let i = 0; i < argv.length; i += 2) {
    const [a, v] = [argv[i], argv[i + 1]];
    if (a === '--seed') o.seed = Number(v);
    else if (a === '--duration') o.duration = Number(v);
    else if (a === '--out') o.out = v;
    else if (a === '--screenshot') o.screenshot = v; // optional: save a frame of the bench scene
    else throw new Error(`unknown argument "${a}"`);
  }
  if (!Number.isInteger(o.seed) || !(o.duration > 0)) throw new Error('--seed must be an integer and --duration > 0');
  return o;
}

const ARGS = [
  '--disable-gpu-vsync', // vsync off
  '--disable-frame-rate-limit', // uncapped requestAnimationFrame
  '--ignore-gpu-blocklist',
  '--window-position=40,40',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];

async function launch(chromium) {
  const tries = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  let lastErr;
  for (const t of tries) {
    try {
      const browser = await chromium.launch({ headless: false, args: ARGS, ...t });
      return { browser, channel: t.channel || 'playwright-chromium' };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`no browser available (run "npx playwright install chromium"): ${lastErr && lastErr.message.split('\n')[0]}`);
}

async function main() {
  const processStart = performance.timeOrigin; // epoch ms when this process started
  const o = parseArgs(process.argv.slice(2));
  const { chromium } = await import('playwright');
  const server = await startServer(0);
  const port = server.address().port;
  const { browser, channel } = await launch(chromium);
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/src/web/index.html?bench=1&seed=${o.seed}&duration=${o.duration}`);
    await page.bringToFront();
    const r = await page.waitForFunction(() => window.__benchResult, null, { timeout: (o.duration + 3 + 120) * 1000, polling: 500 }).then((h) => h.jsonValue());
    if (o.screenshot) await page.screenshot({ path: o.screenshot });
    const version = browser.version();
    const out = {
      contract_version: '1.3',
      avg_fps: Math.round(r.avg_fps * 10) / 10,
      p1_low_fps: Math.round(r.p1_low_fps * 10) / 10,
      frame_ms_p95: Math.round(r.frame_ms_p95 * 10) / 10,
      frames: r.frames,
      load_ms: Math.round(r.first_frame_epoch_ms - processStart),
      peak_mem_mb: null,
      vsync_off: true,
      renderer: `three.js r160 (WebGLRenderer, ${r.webgl}) in ${channel} ${version}; GPU: ${r.gpu}; canvas ${r.canvas.join('x')}; ~${r.draw_calls} draw calls/frame`,
      os: `${platform()} ${release()}, ${cpus()[0]?.model?.trim()} x${cpus().length}, ${(totalmem() / 2 ** 30).toFixed(0)} GB RAM`,
      peak_mem_note: `web build: the browser's process RSS is not exposed to the page, so peak_mem_mb is null; peak JS heap during the run was ${r.js_heap_peak_mb ?? 'n/a'} MB`,
      seed: o.seed,
      duration_s: o.duration,
    };
    const file = resolve(o.out);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    console.log(JSON.stringify(out));
  } finally {
    await browser.close();
    server.close();
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(1);
  },
);
