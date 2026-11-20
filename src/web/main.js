// Browser front-end: renders the shared Sim with Three.js, runs the 3-night campaign,
// menus, pause, settings, HUD and sound. All gameplay rules live in ../sim/ — this file
// only draws, reads input and plays sounds.
import * as THREE from 'three';
import { Sim, benchScenario, DEFAULT_INPUT } from '../sim/sim.js';
import { TUNING, WORLD } from '../sim/tuning.js';
import { LEVELS } from '../sim/levels.js';
import { isValidName, normalizeName, addEntry } from '../leaderboard.js';
import { Sfx } from './audio.js';
import { PAL, buildWorld, makeSea, makePlayer, makeLantern, makeDrifter, makeCharm, makeOwl, makeLeaves, ShadeSwarm, MoteField } from './world.js';

const $ = (id) => document.getElementById(id);
const TICK = 1 / WORLD.tick_rate;
const sfx = new Sfx();
const QUERY = new URLSearchParams(location.search);
const BENCH = QUERY.get('bench') === '1';

// ---------- settings (saved between sessions) ----------
const SETTINGS_KEY = 'ddl-settings-v1';
const DEFAULT_KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE'], pulse: ['KeyF'], pause: ['Escape', 'KeyP'],
};
const ACTION_NAMES = { up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Nạp / châm dầu', pulse: 'Tỏa Sáng', pause: 'Tạm dừng' };
const settings = { volume: 0.8, sens: 1, muted: false, colorblind: false, reducedMotion: false, bigText: false, keys: structuredClone(DEFAULT_KEYS) };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
  for (const a of Object.keys(DEFAULT_KEYS)) if (!Array.isArray(settings.keys?.[a])) settings.keys = { ...structuredClone(DEFAULT_KEYS), ...settings.keys, [a]: [...DEFAULT_KEYS[a]] };
} catch { /* storage unavailable: defaults */ }
if (BENCH) Object.assign(settings, { colorblind: false, reducedMotion: false, bigText: false });
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}
sfx.setVolume(settings.volume);
sfx.setMuted(settings.muted);

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.mist, 0.03);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
const ambient = new THREE.HemisphereLight(0xb8c4ff, 0x26304f, 0.15); // Ticket-02: 0.15 + 0.55 * lit ratio
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9aa6ff, 0.9);
moon.position.set(-30, 60, 20);
scene.add(moon);
scene.add(makeSea());
const swarm = new ShadeSwarm(256);
const moteField = new MoteField(192);
scene.add(swarm.group, moteField.group);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- game state ----------
const INTRO = {
  1: 'Cháu Mây à, sương đen đã nuốt ánh sáng của Đảo Bến. Gom đom đóm, thắp lại năm Đèn Lồng Lớn trước bình minh nhé. Nhớ: Bóng Mực sợ đèn đã sáng!',
  2: 'Đảo Cau có hai hòn nối bằng cầu tre không lan can. Bục nhảy xanh sẽ đưa cháu bay sang bờ bên kia. Cẩn thận Gió Lạc — chúng chuyên cướp đom đóm của người mang nhiều!',
  3: 'Đảo Chuông có ba tầng. Leo dốc gỗ lên tầng giữa, đứng lên bục nhảy để tới chân tháp chuông. Gió mạnh thổi mỗi nửa phút — lá bay là gió sắp tới.',
};
let sim = null;
let mode = 'menu'; // menu | intro | playing | paused | result | dawn
let night = 1;
let baseSeed = 1;
let wonScores = {}; // night -> score of the won night
let worldGroup = null;
const view = { player: null, owl: null, lanterns: new Map(), motes: new Map(), shades: new Map(), drifters: new Map(), charms: new Map(), rings: [] };
const leaves = makeLeaves();
scene.add(leaves);
let camYaw = 0;
const camPos = new THREE.Vector3(0, 6, -10);
let owlTarget = null;
let lastCountdown = -1;
let windWarned = false;
let overlayBack = null; // where "Back" from settings returns

const totalScore = () => Object.values(wonScores).reduce((a, b) => a + b, 0);

const knownWeak = new Set(); // lanterns already announced as "low fuel"
const shadeArrows = []; // { id, until } — edge arrows towards freshly spawned shades
let shake = 0; // camera shake (seconds left), disabled by reduced motion

function clearEntities() {
  for (const map of [view.lanterns, view.motes, view.shades, view.drifters, view.charms]) {
    for (const m of map.values()) scene.remove(m);
    map.clear();
  }
  for (const r of view.rings) scene.remove(r.mesh);
  view.rings = [];
}

function startNight(n, seed = baseSeed + n - 1, { scenario = null, bench = false } = {}) {
  night = n;
  sim = new Sim({ seed, night: n, scenario, bench });
  knownWeak.clear();
  shadeArrows.length = 0;
  clearEntities();
  if (worldGroup) scene.remove(worldGroup);
  worldGroup = buildWorld(LEVELS[n]);
  scene.add(worldGroup);
  if (!view.player) {
    view.player = makePlayer(TUNING.carry_capacity * 2);
    view.owl = makeOwl();
    scene.add(view.player, view.owl);
  }
  view.owl.position.set(sim.player.pos[0], 3, sim.player.pos[2]);
  owlTarget = null;
  camYaw = 0;
  camPos.set(1e9, 0, 0);
  for (const l of sim.lanterns) {
    const m = makeLantern();
    m.position.set(...l.pos);
    m.lookAt(LEVELS[n].night === 2 ? (l.pos[0] < 35 ? 0 : 70) : 0, l.pos[1], 0);
    view.lanterns.set(l.id, m);
    scene.add(m);
  }
  for (const c of sim.charms) {
    const m = makeCharm();
    m.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]);
    view.charms.set(c.id, m);
    scene.add(m);
  }
  lastCountdown = -1;
  windWarned = false;
  $('toast').hidden = true;
  toastTimer = 0;
  syncEntities(0);
  mode = 'intro';
  $('hud').hidden = true;
  showCard({
    title: `Đêm ${n} — ${LEVELS[n].name}`,
    sub: `${LEVELS[n].lanterns.length} Đèn Lồng Lớn · ${Math.round(LEVELS[n].durationS / 60 * 10) / 10} phút`,
    body: `<p class="quote"><b>Ông Đăng:</b> “${INTRO[n]}”</p>`,
    buttons: [['Bắt đầu', () => begin()]],
  });
}

function begin() {
  sfx.ensure();
  sfx.startMusic();
  mode = 'playing';
  hideCard();
  $('hud').hidden = false;
}

function newCampaign() {
  const q = new URLSearchParams(location.search);
  baseSeed = /^\d+$/.test(q.get('seed') || '') ? Number(q.get('seed')) : Math.floor(Math.random() * 1e6);
  wonScores = {};
  startNight(1);
}

// ---------- overlay cards ----------
function showCard({ title, sub = '', body = '', buttons = [] }) {
  $('ov-title').textContent = title;
  $('ov-sub').textContent = sub;
  $('ov-body').innerHTML = body;
  const box = $('ov-btns');
  box.innerHTML = '';
  buttons.forEach(([label, fn, cls], i) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (cls) b.className = cls;
    b.addEventListener('click', () => {
      sfx.ensure();
      fn();
    });
    box.appendChild(b);
    if (i === 0) setTimeout(() => b.focus(), 0);
  });
  $('overlay').hidden = false;
}
function hideCard() {
  $('overlay').hidden = true;
}

const keyLabel = (code) => code.replace(/^Key/, '').replace(/^Digit/, '').replace('Arrow', '').replace('Left', ' trái').replace('Right', ' phải').replace('Up', '↑').replace('Down', '↓').replace('Space', 'Space').replace('Escape', 'Esc');
const keysOf = (a) => settings.keys[a].map(keyLabel).join(' / ');
const controlsTable = () => `<table class="keys">
  <tr><td>${keysOf('up')}, ${keysOf('left')}, ${keysOf('down')}, ${keysOf('right')}</td><td>Di chuyển</td></tr>
  <tr><td>Kéo chuột / J L</td><td>Xoay camera</td></tr>
  <tr><td>${keysOf('jump')}</td><td>Nhảy</td></tr>
  <tr><td>${keysOf('dash')}</td><td>Lướt</td></tr>
  <tr><td>${keysOf('interact')}</td><td>Nạp ánh sáng / châm dầu</td></tr>
  <tr><td>${keysOf('pulse')} / Chuột phải</td><td>Tỏa Sáng (tốn 3 đom đóm)</td></tr>
  <tr><td>${keysOf('pause')}</td><td>Tạm dừng</td></tr></table>`;

// ---------- leaderboard (Ticket-04 §3): saved on local disk by the server, browser storage as fallback ----------
const LB_LOCAL = 'ddl-leaderboard-v1';
async function loadBoard() {
  try {
    const r = await fetch('/api/leaderboard');
    if (r.ok) return (await r.json()).entries;
  } catch { /* offline / static hosting */ }
  try {
    return JSON.parse(localStorage.getItem(LB_LOCAL) || '[]');
  } catch {
    return [];
  }
}
async function saveBoardEntry(entry) {
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
    if (r.ok) return await r.json();
  } catch { /* fall back below */ }
  const res = addEntry(await loadBoard(), entry);
  try {
    localStorage.setItem(LB_LOCAL, JSON.stringify(res.entries));
  } catch { /* ignore */ }
  return res;
}

async function showLeaderboard(highlight = null, back = showMenu) {
  const entries = await loadBoard();
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rows = entries.length
    ? entries.map((e, i) => `<tr class="${highlight === i + 1 ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('')
    : '<tr><td colspan="5">Chưa có ai — hãy là người đầu tiên!</td></tr>';
  showCard({
    title: 'Bảng xếp hạng',
    sub: 'Top 10 — tổng điểm các Đêm đã thắng',
    body: `<table class="board"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Lúc</th></tr>${rows}</table>`,
    buttons: [['Quay lại', () => back()]],
  });
}

function promptSave(after) {
  const nightsWon = Object.keys(wonScores).length;
  showCard({
    title: 'Lưu điểm',
    sub: `Tổng điểm ${totalScore()} · thắng ${nightsWon}/3 Đêm · seed ${baseSeed}`,
    body: `<div class="settings"><label for="lb-name">Tên của bạn (3–12 chữ, số hoặc _; có dấu được)</label>
      <input id="lb-name" maxlength="12" autocomplete="off" value="${esc0(settings.lastName || '')}">
      <p id="lb-err" class="err" role="alert"></p></div>`,
    buttons: [
      ['Lưu', async () => {
        const name = normalizeName($('lb-name').value);
        if (!isValidName(name)) {
          $('lb-err').textContent = '⚠ Tên phải dài 3–12 ký tự, chỉ gồm chữ, số hoặc dấu _';
          return;
        }
        settings.lastName = name;
        saveSettings();
        const r = await saveBoardEntry({ name, score: totalScore(), nights_won: nightsWon, seed: baseSeed });
        showLeaderboard(r.rank, after);
      }],
      ['Bỏ qua', () => after(), 'ghost'],
    ],
  });
  setTimeout(() => $('lb-name')?.focus(), 0);
}
const esc0 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function showMenu() {
  mode = 'menu';
  sfx.stopMusic();
  $('hud').hidden = true;
  overlayBack = showMenu;
  showCard({
    title: 'Đảo Đèn Lồng',
    sub: 'Ba Đêm — ba hòn đảo',
    body: `<p>Sương đen đã nuốt ánh sáng của quần đảo. Hãy giúp <b>Mây</b> gom đom đóm, thắp lại các <b>Đèn Lồng Lớn</b>, giữ chúng cháy tới bình minh và xua <b style="color:#b48cff">Bóng Mực</b>.</p>${controlsTable()}`,
    buttons: [
      ['Chơi từ Đêm 1', () => newCampaign()],
      ['Đêm 2', () => { newCampaign(); startNight(2); }, 'ghost'],
      ['Đêm 3', () => { newCampaign(); startNight(3); }, 'ghost'],
      ['Bảng xếp hạng', () => showLeaderboard(null, showMenu), 'ghost'],
      ['Cài đặt', () => showSettings(), 'ghost'],
    ],
  });
}

function pauseGame() {
  if (mode !== 'playing') return;
  mode = 'paused';
  overlayBack = showPause;
  showPause();
}
function showPause() {
  mode = 'paused';
  showCard({
    title: 'Tạm dừng',
    sub: `Đêm ${night} — ${LEVELS[night].name}`,
    body: controlsTable(),
    buttons: [
      ['Tiếp tục', () => resume()],
      ['Chơi lại Đêm', () => startNight(night), 'ghost'],
      ['Cài đặt', () => showSettings(), 'ghost'],
      ['Về menu', () => showMenu(), 'ghost'],
    ],
  });
}
function resume() {
  mode = 'playing';
  hideCard();
  last = performance.now();
  acc = 0;
}

let rebinding = null; // action waiting for a key press
function showSettings(msg = '') {
  const back = overlayBack || showMenu;
  const keyRows = Object.keys(DEFAULT_KEYS).map((a) => `<tr><td>${ACTION_NAMES[a]}</td><td><b>${keysOf(a)}</b></td><td><button class="ghost small-btn" data-rebind="${a}">${rebinding === a ? 'Nhấn phím…' : 'Đổi'}</button></td></tr>`).join('');
  showCard({
    title: 'Cài đặt',
    body: `<div class="settings">
      <label>Âm lượng <input id="set-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
      <label>Độ nhạy chuột <input id="set-sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}"></label>
      <label>Tắt tiếng <input id="set-mute" type="checkbox" ${settings.muted ? 'checked' : ''}></label>
      <label>Bảng màu dễ phân biệt <input id="set-cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}></label>
      <label>Giảm chuyển động (tắt rung camera, chớp màn hình) <input id="set-rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}></label>
      <label>Chữ lớn (×1.25) <input id="set-big" type="checkbox" ${settings.bigText ? 'checked' : ''}></label>
      <h3>Phím</h3>
      <p id="key-msg" class="err" role="alert">${msg}</p>
      <table class="keys rebind">${keyRows}</table>
    </div>`,
    buttons: [['Xong', () => { rebinding = null; back(); }], ['Khôi phục phím mặc định', () => { settings.keys = structuredClone(DEFAULT_KEYS); saveSettings(); rebinding = null; showSettings('Đã khôi phục phím mặc định.'); }, 'ghost']],
  });
  $('set-vol').addEventListener('input', (e) => { settings.volume = Number(e.target.value); sfx.setVolume(settings.volume); saveSettings(); sfx.pickup(3); });
  $('set-sens').addEventListener('input', (e) => { settings.sens = Number(e.target.value); saveSettings(); });
  $('set-mute').addEventListener('change', (e) => { settings.muted = e.target.checked; sfx.setMuted(settings.muted); saveSettings(); });
  $('set-cb').addEventListener('change', (e) => { settings.colorblind = e.target.checked; applyA11y(); saveSettings(); });
  $('set-rm').addEventListener('change', (e) => { settings.reducedMotion = e.target.checked; saveSettings(); });
  $('set-big').addEventListener('change', (e) => { settings.bigText = e.target.checked; applyA11y(); saveSettings(); });
  for (const b of document.querySelectorAll('[data-rebind]')) {
    b.addEventListener('click', () => {
      rebinding = b.dataset.rebind;
      showSettings(`Nhấn phím mới cho "${ACTION_NAMES[rebinding]}" (Esc để hủy).`);
    });
  }
}

/** Rebinding: the new key replaces the action's main key; a key already used elsewhere is refused. */
function captureRebind(code) {
  const action = rebinding;
  rebinding = null;
  if (code === 'Escape') return showSettings('Đã hủy đổi phím.');
  const owner = Object.keys(settings.keys).find((a) => a !== action && settings.keys[a].includes(code));
  if (owner) return showSettings(`⚠ Phím ${keyLabel(code)} đang dùng cho "${ACTION_NAMES[owner]}". Chọn phím khác.`);
  settings.keys[action] = [code, ...settings.keys[action].slice(1).filter((c) => c !== code)];
  saveSettings();
  return showSettings(`"${ACTION_NAMES[action]}" = ${keysOf(action)}`);
}

// Ticket-03 §6 colour-blind palette; Ticket-04 §4 large text (UI ≥ 18 px, ×1.25 option).
function applyA11y() {
  document.body.classList.toggle('cb', Boolean(settings.colorblind));
  document.documentElement.style.setProperty('--font-scale', settings.bigText ? '1.25' : '1');
}
applyA11y();

function showResult({ result, reason }) {
  mode = 'result';
  const won = result === 'won';
  won ? sfx.win() : sfx.lose();
  if (won) wonScores[night] = sim.score;
  const s = TUNING.score;
  const st = sim.stats;
  const plain = st.stunHits - st.drainHits;
  const rows = [
    ['Đom đóm nạp / châm dầu', `${st.deposited} × ${s.per_mote}`, st.deposited * s.per_mote],
    ['Đèn thắp lần đầu', `${st.lit} × ${s.per_lantern}`, st.lit * s.per_lantern],
    ['Đèn thắp lại', `${st.relit} × ${s.per_relight}`, st.relit * s.per_relight],
    ['Bóng Mực trúng Tỏa Sáng', `${plain} × ${s.per_stun} + ${st.drainHits} × ${s.per_stun_drain}`, plain * s.per_stun + st.drainHits * s.per_stun_drain],
  ];
  if (won) {
    rows.push(['Đèn sáng lúc bình minh (50 + dầu)', `${sim.litCount()} đèn`, st.dawnBonus]);
    rows.push(['Ngọn Lửa còn', `${sim.player.flames} × ${s.per_flame_left}`, st.flameBonus]);
  }
  const reasons = {
    dawn_survived: `Bình minh! ${sim.litCount()}/${sim.lanterns.length} đèn còn sáng — đảo đã được giữ ấm.`,
    no_flames: 'Mây đã hết Ngọn Lửa. Bóng Mực phủ kín đảo…',
    dawn: `Bình minh tới nhưng chỉ ${sim.litCount()}/${sim.lanterns.length} đèn còn sáng (cần ${sim.winThreshold()}).`,
  };
  const table = `<table class="breakdown">${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
    <tr><td><b>Điểm Đêm ${night}</b></td><td></td><td><b>${sim.score}</b></td></tr>
    <tr><td>Tổng điểm các Đêm đã thắng</td><td></td><td>${totalScore()}</td></tr></table>`;
  const buttons = won
    ? night < 3 ? [[`Đêm ${night + 1}`, () => startNight(night + 1)], ['Về menu', () => showMenu(), 'ghost']] : [['Đón bình minh', () => showDawn()]]
    : [[`Chơi lại Đêm ${night}`, () => startNight(night)], ['Lưu điểm', () => promptSave(showMenu), 'ghost'], ['Về menu', () => showMenu(), 'ghost']];
  setTimeout(() => {
    showCard({ title: won ? `Thắng Đêm ${night}!` : 'Thua rồi…', sub: reasons[reason] || reason, body: table, buttons });
  }, 900);
}

function showDawn() {
  mode = 'dawn';
  sfx.stopMusic();
  sfx.win();
  showCard({
    title: 'Bình Minh',
    sub: 'Ba hòn đảo đã sáng đèn trở lại.',
    body: `<p>Mặt trời ló dạng trên biển mây. Ông Đăng mỉm cười: “Giỏi lắm, Mây!”</p>
      <table class="breakdown">${[1, 2, 3].map((n) => `<tr><td>Đêm ${n} — ${LEVELS[n].name}</td><td>${wonScores[n] ?? '—'}</td></tr>`).join('')}
      <tr><td><b>Tổng điểm</b></td><td><b>${totalScore()}</b></td></tr></table>`,
    buttons: [['Lưu điểm', () => promptSave(showMenu)], ['Chơi lại từ đầu', () => newCampaign(), 'ghost'], ['Về menu', () => showMenu(), 'ghost']],
  });
}

// ---------- input ----------
// Key bindings come from settings.keys (rebindable, saved; Ticket-04 §4).
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false };
let mousePulse = false;
const actionOf = (code) => Object.keys(settings.keys).find((a) => settings.keys[a].includes(code));
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (rebinding) {
    e.preventDefault();
    captureRebind(e.code);
    return;
  }
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') {
    if (e.code === 'Enter') document.querySelector('#ov-btns button')?.click();
    return;
  }
  keys.add(e.code);
  const a = actionOf(e.code);
  if (a in latch) latch[a] = true;
  if (a === 'pause') {
    if (mode === 'playing') pauseGame();
    else if (mode === 'paused' && !$('set-vol')) resume();
  }
  if (e.code === 'KeyM') { settings.muted = !settings.muted; sfx.setMuted(settings.muted); saveSettings(); }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && mode === 'playing') e.preventDefault();
  sfx.ensure();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  pauseGame();
});
let dragging = false;
let lastX = 0;
canvas.addEventListener('mousedown', (e) => {
  sfx.ensure();
  if (e.button === 2) {
    mousePulse = true;
    latch.pulse = true;
  } else {
    dragging = true;
    lastX = e.clientX;
  }
});
window.addEventListener('mouseup', (e) => {
  if (e.button === 2) mousePulse = false;
  else dragging = false;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.3 * settings.sens;
  lastX = e.clientX;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const held = (action) => settings.keys[action].some((c) => keys.has(c));
function readInput() {
  const fwd = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
  // camera looks along +forward; screen-right is world (-cos, +sin) => "right" maps to move x = -1
  const side = (held('left') ? 1 : 0) - (held('right') ? 1 : 0);
  const input = {
    move: [side, fwd],
    cam_yaw_deg: camYaw,
    jump: held('jump') || latch.jump,
    interact: held('interact') || latch.interact,
    pulse: held('pulse') || mousePulse || latch.pulse,
    dash: held('dash') || latch.dash,
    pause: false,
  };
  latch.jump = latch.interact = latch.pulse = latch.dash = false;
  return input;
}

// ---------- events -> effects ----------
let toastTimer = 0;
function toast(msg, secs = 2) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  toastTimer = secs;
}
// Subtitles / visual cues (Ticket-04 §4): stacked lines that fade out.
function subtitle(msg, secs = 3) {
  const box = $('subs');
  const el = document.createElement('div');
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.remove(), secs * 1000);
}
function flash() {
  if (settings.reducedMotion) return; // no screen flash with reduced motion
  shake = 0.3;
  const f = $('hitflash');
  f.style.transition = 'none';
  f.style.opacity = 1;
  requestAnimationFrame(() => { f.style.transition = 'opacity 0.6s'; f.style.opacity = 0; });
}
function handleEvent(e) {
  switch (e.name) {
    case 'mote_picked': sfx.pickup(e.data.carried); break;
    case 'deposit': sfx.deposit(); break;
    case 'lantern_lit': {
      sfx.lit();
      const m = view.lanterns.get(e.data.lantern_id);
      if (m) m.userData.litAt = performance.now();
      toast(`Đèn ${e.data.lantern_id} đã sáng! (${sim.litCount()}/${sim.lanterns.length})`);
      break;
    }
    case 'pulse': {
      sfx.pulse();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sim.player.pos[0], sim.player.pos[1] + 0.3, sim.player.pos[2]);
      scene.add(ring);
      view.rings.push({ mesh: ring, t: 0 });
      break;
    }
    case 'player_hit':
      sfx.hit();
      flash();
      if (e.data.by === 'fall') toast(`Mây rơi xuống biển mây! Mất ${e.data.lost} đom đóm`, 2);
      else if (e.data.dropped) toast(`Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`, 1.5);
      break;
    case 'shade_spawned':
      sfx.spawn();
      subtitle(`👁 Bóng Mực ${e.data.id} xuất hiện — xem mũi tên tím ở mép màn hình`, 3);
      shadeArrows.push({ id: e.data.id, until: clock + 3 });
      break;
    case 'dash': sfx.dash(); break;
    case 'charm_picked': sfx.charm(); toast('Bùa Gió! Chạy nhanh, lướt không hồi chiêu', 2); break;
    case 'drifter_steal': sfx.steal(); toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`, 1.8); break;
    case 'drifter_drop': sfx.pickup(1); toast('Gió Lạc đánh rơi đom đóm!', 1.5); break;
    case 'refuel': sfx.deposit(); break;
    case 'lantern_out': sfx.lose(); toast(`⚠ Đèn ${e.data.lantern_id} đã cạn dầu và tắt!`, 2.2); break;
    case 'fuel_drain': if (e.tick % 180 === 1) toast(`⚠ Bóng Mực đang hút dầu đèn ${e.data.lantern_id}!`, 1.6); break;
    case 'game_over': showResult(e.data); break;
    default: break;
  }
}

// ---------- sync sim -> meshes ----------
function syncMap(map, list, make, update) {
  const seen = new Set();
  for (const x of list) {
    seen.add(x.id);
    let m = map.get(x.id);
    if (!m) {
      m = make(x);
      map.set(x.id, m);
      scene.add(m);
    }
    update(m, x);
  }
  for (const [id, m] of map) {
    if (!seen.has(id)) {
      scene.remove(m);
      map.delete(id);
    }
  }
}

function syncEntities(time) {
  const p = sim.player;
  const pm = view.player;
  pm.position.set(p.pos[0], p.pos[1], p.pos[2]);
  pm.visible = p.fallWait === 0 || p.pos[1] > -9;
  const [dx, dz] = p.facing;
  let dr = Math.atan2(dx, dz) - pm.rotation.y;
  dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  pm.rotation.y += dr * 0.25;
  pm.userData.light.intensity = 3 + p.carried * 0.8;
  if (p.invuln > 0 && Math.floor(time * 12) % 2 === 0) pm.visible = false;
  const cap = sim.capacity();
  pm.userData.orbit.forEach((s, i) => {
    s.visible = i < p.carried;
    const a = time * 2.2 + (i * Math.PI * 2) / cap;
    s.position.set(Math.cos(a) * 0.85, 1.75 + Math.sin(time * 3 + i) * 0.12, Math.sin(a) * 0.85);
  });
  pm.userData.charmAura.material.opacity = p.charm > 0 ? 0.35 + Math.sin(time * 8) * 0.1 : 0;

  let lit = 0;
  for (const l of sim.lanterns) {
    const m = view.lanterns.get(l.id);
    const u = m.userData;
    if (l.lit) lit++;
    const fuel = l.fuel / 60; // sim keeps 1/60 units
    const low = l.lit && fuel < TUNING.low_fuel_threshold;
    // Ticket-03 §1: fuel < 30 -> lantern and its fuel bar blink slowly (1 Hz).
    const dim = low && Math.floor(time * 2) % 2 === 1 ? 0.35 : 1;
    const fill = l.lit ? 1 : (l.deposited / sim.costOf(l)) * 0.35;
    const pop = u.litAt > 0 ? Math.max(0, 1 - (performance.now() - u.litAt) / 800) : 0;
    u.bodyMat.color.setHex(l.lit ? PAL.lampOn : PAL.lampOff);
    u.bodyMat.emissiveIntensity = (l.lit ? 2 + Math.sin(time * 3 + l.pos[0]) * 0.15 + pop * 3 : fill * 2) * dim;
    u.core.material.opacity = (l.lit ? 0.9 : fill) * dim;
    u.halo.material.opacity = (l.lit ? 0.7 + pop : fill * 0.6) * dim;
    u.light.intensity = (l.lit ? 10 + 20 * Math.min(1, fuel / 50) + pop * 60 : fill * 8) * dim;
    u.ring.visible = l.lit && !low;
    // Shape cue (no colour needed): a dark lantern is squashed 20% and shows a torn paper strip.
    u.body.scale.set(1, l.lit ? 1 : 0.8, 1);
    u.tear.visible = !l.lit;
    u.fuelBar.visible = l.lit;
    u.fuelFill.scale.x = Math.max(0.001, 2.8 * fuel / TUNING.fuel_max);
    u.fuelFill.position.x = -1.4 * (1 - fuel / TUNING.fuel_max);
    u.fuelFill.material.color.setHex(low ? (settings.colorblind ? 0xffffff : PAL.danger) : PAL.lampOn);
    u.fuelBar.children.forEach((c) => { c.material.opacity = dim; });
  }

  // Fireflies (instanced). Dropped ones blink in their last 2 s.
  const pts = [];
  for (let i = 0; i < sim.motes.length; i++) {
    const mo = sim.motes[i];
    if (mo.ttl !== null && mo.ttl < 120 && Math.floor(time * 8) % 2 === 0) continue;
    const ph = (i * 2.399) % (Math.PI * 2);
    pts.push([mo.pos[0] + Math.sin(time * 1.3 + ph) * 0.15, mo.pos[1] + 0.8 + Math.sin(time * 2 + ph) * 0.25, mo.pos[2]]);
  }
  moteField.update(pts);

  // Ink Shades (instanced): face Mây (or the lantern they drain), rise out of the mist when spawning.
  const rimColor = settings.colorblind ? 0x00b3ff : PAL.shadeRim;
  const list = sim.shades.map((s, i) => {
    const rise = s.state === 'spawning' ? 1 - s.ticks / WORLD.shade_spawning_ticks : 1;
    const drainLantern = s.state === 'drain' ? sim.lanterns.find((l) => l.id === s.target) : null;
    const look = drainLantern ? drainLantern.pos : p.pos;
    const stunned = s.state === 'stunned';
    return {
      pos: [s.pos[0], s.pos[1] + Math.sin(time * 2 + i) * 0.15, s.pos[2]],
      yaw: Math.atan2(look[0] - s.pos[0], look[2] - s.pos[2]),
      roll: stunned ? Math.sin(time * 20) * 0.2 : 0,
      sink: (1 - rise) * 2,
      scale: drainLantern ? 1 + Math.sin(time * 10) * 0.06 : 1,
      stunned,
    };
  });
  swarm.update(list, rimColor);

  syncMap(view.drifters, sim.drifters, () => makeDrifter(), (m, d) => {
    const u = m.userData;
    m.position.set(d.pos[0], d.pos[1] + Math.sin(time * 3 + u.phase) * 0.2, d.pos[2]);
    const tx = d.state === 'flee' ? 2 * d.pos[0] - p.pos[0] : d.state === 'chase' ? p.pos[0] : d.pos[0] + Math.cos(time + u.phase);
    const tz = d.state === 'flee' ? 2 * d.pos[2] - p.pos[2] : d.state === 'chase' ? p.pos[2] : d.pos[2] + Math.sin(time + u.phase);
    m.lookAt(tx, m.position.y, tz);
    u.segs.forEach((s, i) => {
      s.position.y = Math.sin(time * 6 - i * 0.8) * 0.18;
      s.rotation.z = Math.sin(time * 5 - i) * 0.4;
    });
    u.loot.material.opacity = d.stolen > 0 ? 0.9 : 0;
  });

  for (const c of sim.charms) {
    const m = view.charms.get(c.id);
    m.visible = c.available;
    m.position.y = c.pos[1] + 1 + Math.sin(time * 2) * 0.15;
    m.rotation.y = time * 1.5;
  }

  // Island brightens as lanterns light up (Ticket-02: ambient = 0.15 + 0.55 * ratio).
  const f = lit / sim.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * f;
  scene.fog.density = 0.03 - 0.018 * f;
}

function updateOwl(dt, time) {
  const p = sim.player;
  const unlit = sim.lanterns.filter((l) => !l.lit);
  let target = null;
  if (p.carried > 0 && unlit.length) target = nearestUnlit();
  if (target && target !== owlTarget && mode === 'playing') sfx.hoot();
  owlTarget = target;
  const goal = target
    ? new THREE.Vector3(target.pos[0] + Math.cos(time) * 1.2, target.pos[1] + 5 + Math.sin(time * 2) * 0.3, target.pos[2] + Math.sin(time) * 1.2)
    : new THREE.Vector3(p.pos[0] + Math.cos(time * 0.8) * 1.6, p.pos[1] + 2.8 + Math.sin(time * 2) * 0.2, p.pos[2] + Math.sin(time * 0.8) * 1.6);
  const o = view.owl;
  o.position.lerp(goal, Math.min(1, dt * 1.8));
  o.lookAt(goal.x + Math.cos(time), o.position.y, goal.z + Math.sin(time));
  const flap = Math.sin(time * 14) * 0.6;
  o.userData.w1.rotation.z = flap;
  o.userData.w2.rotation.z = -flap;
}

function nearestUnlit() {
  const p = sim.player;
  let best = null;
  let bd = Infinity;
  for (const l of sim.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

function updateCamera(dt) {
  const p = sim.player;
  const t = (camYaw * Math.PI) / 180;
  const fwd = new THREE.Vector3(Math.sin(t), 0, Math.cos(t));
  const py = Math.max(-2, p.pos[1]);
  const goal = new THREE.Vector3(p.pos[0], py, p.pos[2]).addScaledVector(fwd, -9).add(new THREE.Vector3(0, 5.2, 0));
  if (camPos.x > 1e8) camPos.copy(goal);
  camPos.lerp(goal, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  if (shake > 0 && !settings.reducedMotion) {
    shake = Math.max(0, shake - dt);
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.lookAt(p.pos[0], py + 1.3, p.pos[2]);
}

// Ticket-04 §1 benchmark camera: circle r=30 at Y=15 around (0,0,0), start at angle 0 = (30,15,0),
// counter-clockwise seen from above (same angle convention as the maps: +X towards +Z), 15 s per lap.
function benchCamera(t) {
  const a = (2 * Math.PI * t) / 15;
  camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
  camera.lookAt(0, 0, 0);
}

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const tmpV = new THREE.Vector3();
function updateHud() {
  const p = sim.player;
  $('flames').innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<span class="flame ${i < p.flames ? '' : 'off'}"></span>`).join('');
  $('nightname').textContent = `Đêm ${night} — ${LEVELS[night].name}`;
  const cap = sim.capacity();
  $('carried').innerHTML = Array.from({ length: cap }, (_, i) => `<span class="slot ${i < p.carried ? 'on' : ''}"></span>`).join('') + `<span class="count">${p.carried}/${cap}</span>`;
  $('lit').textContent = `${sim.litCount()}/${sim.lanterns.length} (cần ${sim.winThreshold()})`;
  const tl = Math.max(0, sim.timeLeft());
  $('time').textContent = `${tl <= 30 ? '⚠ ' : ''}${fmt(Math.ceil(tl - 1e-9))}`;
  $('time').classList.toggle('low', tl <= 30);
  $('score').textContent = sim.score;
  const cd = (id, left, total, usable) => {
    const el = $(id);
    el.querySelector('i').style.height = `${usable ? (1 - left / total) * 100 : 0}%`;
    el.classList.toggle('wait', left > 0 || !usable);
  };
  $('cd-dash').querySelector('.key').textContent = keyLabel(settings.keys.dash[0]);
  $('cd-pulse').querySelector('.key').textContent = keyLabel(settings.keys.pulse[0]);
  cd('cd-dash', p.charm > 0 ? 0 : p.dashCd, Math.round(TUNING.dash_cooldown_s * 60), true);
  cd('cd-pulse', p.pulseCd, Math.round(TUNING.pulse_cooldown_s * 60), p.carried >= TUNING.pulse_cost);
  $('charm').hidden = p.charm <= 0;
  $('charm-s').textContent = `${Math.ceil(p.charm / 60)}s`;

  let prompt = '';
  for (const l of sim.lanterns) {
    if (!sim.acceptsFuel(l)) continue;
    if (Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius) {
      prompt = l.lit
        ? `E — Châm dầu (${Math.floor(l.fuel / 60)}/${TUNING.fuel_max}, cần ${sim.refuelNeed(l)})`
        : `E — ${l.everLit ? 'Thắp lại' : 'Nạp ánh sáng'} (${l.deposited}/${sim.costOf(l)})`;
      break;
    }
  }
  $('prompt').hidden = !prompt || mode !== 'playing';
  $('prompt').textContent = prompt;

  // Off-screen arrow towards the nearest unlit lantern.
  const target = nearestUnlit();
  const arrow = $('arrow');
  if (target && mode === 'playing') {
    tmpV.set(target.pos[0], target.pos[1] + 2.5, target.pos[2]).project(camera);
    const behind = tmpV.z > 1;
    const off = behind || Math.abs(tmpV.x) > 0.95 || Math.abs(tmpV.y) > 0.95;
    arrow.hidden = !off;
    if (off) {
      let x = tmpV.x;
      let y = tmpV.y;
      if (behind) { x = -x; y = -y; }
      const a = Math.atan2(y, x);
      const k = 0.88 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
      const sx = (Math.cos(a) * k * 0.5 + 0.5) * window.innerWidth;
      const sy = (-Math.sin(a) * k * 0.5 + 0.5) * window.innerHeight;
      arrow.style.left = `${sx - 17}px`;
      arrow.style.top = `${sy - 17}px`;
      arrow.style.transform = `rotate(${-a}rad)`;
    }
  } else {
    arrow.hidden = true;
  }

  // Last 10 s: beep + visual countdown; wind warning (sound + text + leaves).
  const sec = Math.ceil(tl);
  if (mode === 'playing' && sec <= 10 && sec > 0 && sec !== lastCountdown) {
    lastCountdown = sec;
    sfx.tick();
    if (sec === 10) subtitle('⚠ 10 giây cuối trước bình minh!', 3);
  }
  $('countdown').hidden = !(mode === 'playing' && sec <= 10 && sec > 0);
  $('countdown').textContent = sec;
  const warn = sim.windWarning();
  const warning = mode === 'playing' && !sim.wind.active && warn <= WORLD.wind_warn_ticks;
  $('windwarn').hidden = !warning;
  if (warning && !windWarned) {
    windWarned = true;
    sfx.wind();
    subtitle('🍃 Gió mạnh sắp thổi (2 giây)!', 2.5);
  }
  if (!warning) windWarned = false;

  // Lantern below 30 fuel: announce once each time it becomes weak.
  if (mode === 'playing') {
    for (const l of sim.lanterns) {
      const weak = l.lit && l.fuel < TUNING.low_fuel_threshold * 60;
      if (weak && !knownWeak.has(l.id)) {
        knownWeak.add(l.id);
        subtitle(`⚠ Đèn ${l.id} sắp cạn dầu — châm thêm đom đóm!`, 3);
      } else if (!weak) knownWeak.delete(l.id);
    }
  }

  // Edge arrows towards freshly spawned shades.
  const sa = $('shadearrow');
  const live = shadeArrows.filter((x) => x.until > clock && sim.shades.some((s) => s.id === x.id));
  shadeArrows.splice(0, shadeArrows.length, ...live);
  const s0 = live.length ? sim.shades.find((s) => s.id === live[live.length - 1].id) : null;
  sa.hidden = !s0 || mode !== 'playing';
  if (s0) placeEdgeArrow(sa, s0.pos, true);
}

/** Puts an arrow at the screen edge pointing at a world position (always shown when `always`). */
function placeEdgeArrow(el, pos, always = false) {
  tmpV.set(pos[0], pos[1] + 1, pos[2]).project(camera);
  const behind = tmpV.z > 1;
  const off = behind || Math.abs(tmpV.x) > 0.95 || Math.abs(tmpV.y) > 0.95;
  if (!off && !always) {
    el.hidden = true;
    return;
  }
  let x = tmpV.x;
  let y = tmpV.y;
  if (behind) { x = -x; y = -y; }
  const a = Math.atan2(y, x);
  const k = (off ? 0.88 : 0.5) / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
  el.style.left = `${(Math.cos(a) * k * 0.5 + 0.5) * window.innerWidth - 17}px`;
  el.style.top = `${(-Math.sin(a) * k * 0.5 + 0.5) * window.innerHeight - 17}px`;
  el.style.transform = `rotate(${-a}rad)`;
}

function updateLeaves(time) {
  const warn = sim.windWarning() <= WORLD.wind_warn_ticks;
  leaves.visible = sim.windEnabled && (sim.wind.active || warn);
  if (!leaves.visible) return;
  const p = sim.player;
  const dir = sim.wind.active ? sim.wind.dir : [1, 0];
  const speed = sim.wind.active ? 6 : 2;
  for (const l of leaves.children) {
    const s = l.userData.seed;
    const along = ((time * speed + s * 7) % 30) - 15;
    const across = ((s * 13) % 24) - 12;
    l.position.set(p.pos[0] + dir[0] * along - dir[1] * across, p.pos[1] + 0.5 + ((s * 3) % 3) + Math.sin(time * 3 + s) * 0.4, p.pos[2] + dir[1] * along + dir[0] * across);
    l.rotation.set(time * 4 + s, time * 3 + s, 0);
  }
}

// ---------- main loop (fixed 60 Hz sim, render every frame) ----------
let acc = 0;
let last = performance.now();
let clock = 0;
let wasGrounded = true;
function stepOnce(input) {
  for (const e of sim.step(input)) handleEvent(e);
  if (wasGrounded && !sim.player.grounded && sim.player.vel[1] > 0 && input.jump) sfx.jump();
  wasGrounded = sim.player.grounded;
}
// Benchmark state (?bench=1&seed=42&duration=30): 3 s warm-up, then `duration` s of frame times.
const bench = BENCH ? { seed: Number(QUERY.get('seed') || 42), duration: Number(QUERY.get('duration') || 30), warmup: 3, t0: null, dts: [], firstFrameEpoch: null, done: false } : null;
function benchFrame(now, dtMs) {
  if (bench.t0 === null) {
    bench.t0 = now;
    bench.firstFrameEpoch = performance.timeOrigin + now;
  }
  const t = (now - bench.t0) / 1000;
  if (t >= bench.warmup && !bench.done) {
    bench.dts.push(dtMs);
    const heap = performance.memory?.usedJSHeapSize; // Chromium only; informational (not RSS)
    if (heap) bench.heapPeak = Math.max(bench.heapPeak || 0, heap);
  }
  if (t >= bench.warmup + bench.duration && !bench.done) {
    bench.done = true;
    const d = bench.dts;
    const N = d.length;
    const sum = d.reduce((a, b) => a + b, 0);
    const sorted = [...d].sort((a, b) => a - b);
    const k = Math.max(1, Math.ceil(0.01 * N));
    const worst = sorted.slice(-k);
    const p95 = sorted[Math.min(N - 1, Math.ceil(0.95 * N) - 1)];
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    window.__benchResult = {
      frames: N,
      avg_fps: (1000 * N) / sum,
      p1_low_fps: 1000 / (worst.reduce((a, b) => a + b, 0) / k),
      frame_ms_p95: p95,
      first_frame_epoch_ms: bench.firstFrameEpoch,
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      webgl: gl.getParameter(gl.VERSION),
      canvas: [renderer.domElement.width, renderer.domElement.height],
      draw_calls: renderer.info.render.calls,
      js_heap_peak_mb: bench.heapPeak ? Math.round(bench.heapPeak / 2 ** 20) : null,
    };
  }
  return t;
}

function frame(now) {
  const dtMs = now - last;
  const dt = Math.min(0.1, dtMs / 1000);
  last = now;
  clock += dt;
  if (keys.has('KeyJ')) camYaw += 120 * dt * settings.sens;
  if (keys.has('KeyL')) camYaw -= 120 * dt * settings.sens;
  if (bench) {
    const t = benchFrame(now, dtMs);
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 6) {
      sim.step(DEFAULT_INPUT); // no player input in the bench scene
      acc -= TICK;
      n++;
    }
    syncEntities(clock);
    updateHud();
    benchCamera(t);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
    return;
  }
  if (sim && mode === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 6) {
      stepOnce(readInput());
      acc -= TICK;
      n++;
      if (sim.state !== 'playing') break;
    }
  }
  if (sim) {
    syncEntities(clock);
    updateOwl(dt, clock);
    updateCamera(dt);
    updateHud();
    updateLeaves(clock);
    for (const r of view.rings) {
      r.t += dt;
      const k = r.t / 0.4;
      const s = 0.8 + k * TUNING.pulse_radius;
      r.mesh.scale.set(s, s, 1);
      r.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
    }
    view.rings = view.rings.filter((r) => (r.t < 0.4 ? true : (scene.remove(r.mesh), false)));
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').hidden = true;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Boot: Night 1 island behind the main menu — or the standard benchmark scene.
if (bench) {
  startNight(1, bench.seed, { scenario: benchScenario(bench.seed), bench: true });
  hideCard();
  mode = 'bench';
  $('hud').hidden = false;
  view.owl.visible = false; // creative extras are off in the benchmark scene (Ticket-04 §1)
  window.__benchReady = true;
} else {
  startNight(1, 1);
  showMenu();
}
last = performance.now();
requestAnimationFrame(frame);

// Dev helpers (inspection + evidence screenshots; see scripts/serve.js).
// tick(n): advance n fixed steps through the real input path (works even when rAF is paused).
window.__game = {
  get sim() { return sim; },
  get mode() { return mode; },
  startNight: (n, seed) => { startNight(n, seed); begin(); },
  pause: () => pauseGame(),
  setYaw: (d) => { camYaw = d; },
  stepWith(input) {
    if (mode === 'playing') stepOnce({ ...input });
  },
  tick(n = 1) {
    for (let i = 0; i < n && mode === 'playing'; i++) stepOnce(readInput());
    const dt = 1 / 60;
    clock += n * dt;
    syncEntities(clock);
    updateOwl(Math.min(1, n * dt), clock);
    camPos.set(1e9, 0, 0);
    updateCamera(1);
    updateHud();
    updateLeaves(clock);
    renderer.render(scene, camera);
    return sim.steps;
  },
};
window.__shot = async (name) => {
  renderer.render(scene, camera);
  const url = canvas.toDataURL('image/png');
  const r = await fetch(`/__shot?name=${encodeURIComponent(name)}`, { method: 'POST', body: url }).catch(() => null);
  return r ? r.text() : 'no dev server';
};
