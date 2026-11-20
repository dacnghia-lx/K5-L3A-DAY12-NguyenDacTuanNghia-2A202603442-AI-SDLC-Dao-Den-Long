// Browser front-end: renders the shared Sim with Three.js, runs the 3-night campaign,
// menus, pause, settings, HUD and sound. All gameplay rules live in ../sim/ — this file
// only draws, reads input and plays sounds.
import * as THREE from 'three';
import { Sim } from '../sim/sim.js';
import { TUNING, WORLD } from '../sim/tuning.js';
import { LEVELS } from '../sim/levels.js';
import { Sfx } from './audio.js';
import { PAL, buildWorld, makeSea, makePlayer, makeLantern, makeMote, makeShade, makeDrifter, makeCharm, makeOwl, makeLeaves } from './world.js';

const $ = (id) => document.getElementById(id);
const TICK = 1 / WORLD.tick_rate;
const sfx = new Sfx();

// ---------- settings (saved between sessions) ----------
const SETTINGS_KEY = 'ddl-settings-v1';
const settings = { volume: 0.8, sens: 1, muted: false, colorblind: false };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
} catch { /* storage unavailable: defaults */ }
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

function clearEntities() {
  for (const map of [view.lanterns, view.motes, view.shades, view.drifters, view.charms]) {
    for (const m of map.values()) scene.remove(m);
    map.clear();
  }
  for (const r of view.rings) scene.remove(r.mesh);
  view.rings = [];
}

function startNight(n, seed = baseSeed + n - 1) {
  night = n;
  sim = new Sim({ seed, night: n });
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

const CONTROLS = `<table class="keys">
  <tr><td>W A S D / ↑ ← ↓ →</td><td>Di chuyển</td></tr>
  <tr><td>Kéo chuột / J L</td><td>Xoay camera</td></tr>
  <tr><td>Space</td><td>Nhảy</td></tr>
  <tr><td>Shift</td><td>Lướt</td></tr>
  <tr><td>E</td><td>Nạp ánh sáng vào đèn</td></tr>
  <tr><td>F / Chuột phải</td><td>Tỏa Sáng (tốn 3 đom đóm)</td></tr>
  <tr><td>Esc / P</td><td>Tạm dừng</td></tr></table>`;

function showMenu() {
  mode = 'menu';
  sfx.stopMusic();
  $('hud').hidden = true;
  overlayBack = showMenu;
  showCard({
    title: 'Đảo Đèn Lồng',
    sub: 'Ba Đêm — ba hòn đảo',
    body: `<p>Sương đen đã nuốt ánh sáng của quần đảo. Hãy giúp <b>Mây</b> gom đom đóm, thắp lại các <b>Đèn Lồng Lớn</b> và xua <b style="color:#b48cff">Bóng Mực</b> trước bình minh.</p>${CONTROLS}`,
    buttons: [
      ['Chơi từ Đêm 1', () => newCampaign()],
      ['Đêm 2', () => { newCampaign(); startNight(2); }, 'ghost'],
      ['Đêm 3', () => { newCampaign(); startNight(3); }, 'ghost'],
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
    body: CONTROLS,
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

function showSettings() {
  const back = overlayBack || showMenu;
  showCard({
    title: 'Cài đặt',
    body: `<div class="settings">
      <label>Âm lượng <input id="set-vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
      <label>Độ nhạy chuột <input id="set-sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}"></label>
      <label>Tắt tiếng <input id="set-mute" type="checkbox" ${settings.muted ? 'checked' : ''}></label>
      <label>Bảng màu dễ phân biệt <input id="set-cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}></label>
    </div>`,
    buttons: [['Xong', () => back()]],
  });
  $('set-vol').addEventListener('input', (e) => { settings.volume = Number(e.target.value); sfx.setVolume(settings.volume); saveSettings(); sfx.pickup(3); });
  $('set-sens').addEventListener('input', (e) => { settings.sens = Number(e.target.value); saveSettings(); });
  $('set-mute').addEventListener('change', (e) => { settings.muted = e.target.checked; sfx.setMuted(settings.muted); saveSettings(); });
  $('set-cb').addEventListener('change', (e) => { settings.colorblind = e.target.checked; applyColorblind(); saveSettings(); });
}

// Ticket-03 §6: colour-blind friendly palette (saved): shade rim/eyes #00B3FF, UI warning white + ⚠.
function applyColorblind() {
  document.body.classList.toggle('cb', Boolean(settings.colorblind));
}
applyColorblind();

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
    : [[`Chơi lại Đêm ${night}`, () => startNight(night)], ['Về menu', () => showMenu(), 'ghost']];
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
    buttons: [['Chơi lại từ đầu', () => newCampaign()], ['Về menu', () => showMenu(), 'ghost']],
  });
}

// ---------- input ----------
const BINDINGS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], dash: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE'], pulse: ['KeyF'], pause: ['Escape', 'KeyP'],
};
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false };
let mousePulse = false;
const actionOf = (code) => Object.keys(BINDINGS).find((a) => BINDINGS[a].includes(code));
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
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

const held = (action) => BINDINGS[action].some((c) => keys.has(c));
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
function flash() {
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
    case 'shade_spawned': sfx.spawn(); toast('Bóng Mực trồi lên từ sương…', 1.6); break;
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

  syncMap(view.motes, sim.motes, (mo) => makeMote(mo.kind === 'dropped'), (m, mo) => {
    const blink = mo.ttl !== null && mo.ttl < 120 && Math.floor(time * 8) % 2 === 0;
    m.visible = !blink;
    m.position.set(mo.pos[0] + Math.sin(time * 1.3 + m.userData.phase) * 0.15, mo.pos[1] + 0.8 + Math.sin(time * 2 + m.userData.phase) * 0.25, mo.pos[2]);
  });

  syncMap(view.shades, sim.shades, () => makeShade(), (m, s) => {
    const u = m.userData;
    const rise = s.state === 'spawning' ? 1 - s.ticks / WORLD.shade_spawning_ticks : 1;
    m.position.set(s.pos[0], s.pos[1] - (1 - rise) * 2 + Math.sin(time * 2 + u.phase) * 0.15, s.pos[2]);
    const drainLantern = s.state === 'drain' ? sim.lanterns.find((l) => l.id === s.target) : null;
    if (drainLantern) m.lookAt(drainLantern.pos[0], m.position.y, drainLantern.pos[2]);
    else m.lookAt(p.pos[0], m.position.y, p.pos[2]);
    const stunned = s.state === 'stunned';
    const rimColor = settings.colorblind ? 0x00b3ff : PAL.shadeRim;
    u.bodyMat.color.setHex(stunned ? PAL.shadeStun : PAL.shadeBody);
    u.bodyMat.emissive.setHex(rimColor);
    u.bodyMat.opacity = stunned ? 0.6 : 0.95 * rise;
    u.rim.material.color.setHex(rimColor);
    u.rim.material.opacity = stunned ? 0.2 : (drainLantern ? 0.55 + Math.sin(time * 10) * 0.3 : 0.55) * rise;
    u.eyeMat.color.setHex(stunned ? PAL.gold : rimColor);
    m.rotation.z = stunned ? Math.sin(time * 20) * 0.2 : 0;
  });

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
  camera.lookAt(p.pos[0], py + 1.3, p.pos[2]);
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

  // Last 10 s countdown beeps; wind warning.
  const sec = Math.ceil(tl);
  if (mode === 'playing' && sec <= 10 && sec > 0 && sec !== lastCountdown) {
    lastCountdown = sec;
    sfx.tick();
  }
  const warn = sim.windWarning();
  const warning = mode === 'playing' && !sim.wind.active && warn <= WORLD.wind_warn_ticks;
  $('windwarn').hidden = !warning;
  if (warning && !windWarned) {
    windWarned = true;
    sfx.wind();
  }
  if (!warning) windWarned = false;
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
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  if (keys.has('KeyJ')) camYaw += 120 * dt * settings.sens;
  if (keys.has('KeyL')) camYaw -= 120 * dt * settings.sens;
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

// Boot: Night 1 island behind the main menu.
startNight(1, 1);
showMenu();
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
