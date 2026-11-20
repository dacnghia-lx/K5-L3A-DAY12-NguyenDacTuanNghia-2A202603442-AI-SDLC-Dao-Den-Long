// Browser front-end: renders the shared Sim with Three.js and feeds it keyboard/mouse input.
// All gameplay rules live in ../sim/sim.js — this file only draws and plays sounds.
import * as THREE from 'three';
import { Sim } from '../sim/sim.js';
import { TUNING, WORLD } from '../sim/tuning.js';
import { Sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const TICK = 1 / WORLD.tick_rate;
const sfx = new Sfx();

// ---------- renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const NIGHT_BG = new THREE.Color(0x0b0716);
const DAWN_BG = new THREE.Color(0x3a2d5c);
scene.background = NIGHT_BG.clone();
scene.fog = new THREE.FogExp2(0x160b26, 0.035);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);

const hemi = new THREE.HemisphereLight(0x8a7ae0, 0x241830, 0.9);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9aa6ff, 0.35);
moon.position.set(-30, 50, 20);
scene.add(moon);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Soft round glow texture for fireflies / lantern halos.
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,220,1)');
  grd.addColorStop(0.25, 'rgba(255,220,120,0.8)');
  grd.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();
const glowSprite = (scale, color = 0xffffff, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
};

// ---------- static world (cosmetic) ----------
const islandMat = new THREE.MeshStandardMaterial({ color: 0x2c4a3f, roughness: 1 });
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 72), islandMat);
island.position.y = -1.5;
scene.add(island);
const rock = new THREE.Mesh(new THREE.ConeGeometry(WORLD.island_radius - 3, 22, 40), new THREE.MeshStandardMaterial({ color: 0x2a2236, roughness: 1 }));
rock.rotation.x = Math.PI;
rock.position.y = -14;
scene.add(rock);
// rim path
const rim = new THREE.Mesh(new THREE.RingGeometry(WORLD.island_radius - 0.6, WORLD.island_radius, 96), new THREE.MeshBasicMaterial({ color: 0x6b5a3a, side: THREE.DoubleSide }));
rim.rotation.x = -Math.PI / 2;
rim.position.y = 0.01;
scene.add(rim);
// pier ("Bến")
const plank = new THREE.MeshStandardMaterial({ color: 0x6e4b2a, roughness: 0.9 });
const pier = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 9), plank);
pier.position.set(0, -0.1, -WORLD.island_radius - 3.5);
scene.add(pier);
// cloud sea + puffs + stars
const sea = new THREE.Mesh(new THREE.CircleGeometry(260, 64), new THREE.MeshStandardMaterial({ color: 0x241a3a, roughness: 1 }));
sea.rotation.x = -Math.PI / 2;
sea.position.y = -7;
scene.add(sea);
const puffMat = new THREE.MeshStandardMaterial({ color: 0x5a4b80, roughness: 1, transparent: true, opacity: 0.85 });
for (let i = 0; i < 70; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 48 + Math.random() * 90;
  const p = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 6, 12, 8), puffMat);
  p.position.set(Math.cos(a) * r, -7 + Math.random() * 2, Math.sin(a) * r);
  p.scale.y = 0.45;
  scene.add(p);
}
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 900; i++) {
  const v = new THREE.Vector3().randomDirection();
  if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
  v.multiplyScalar(320);
  starPos.push(v.x, v.y, v.z);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false })));
// grass tufts / bushes
const bushMat = new THREE.MeshStandardMaterial({ color: 0x3b6a48, roughness: 1 });
const flowerMat = new THREE.MeshBasicMaterial({ color: 0xffd6a0 });
for (let i = 0; i < 70; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 5 + Math.random() * 33;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.3, 8, 6), bushMat);
  b.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  b.scale.y = 0.55;
  scene.add(b);
  if (i % 3 === 0) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), flowerMat);
    fl.position.set(b.position.x + 0.2, 0.2, b.position.z);
    scene.add(fl);
  }
}

// ---------- entity factories ----------
function makePlayer() {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 16), new THREE.MeshStandardMaterial({ color: 0x3f73c9, roughness: 0.8 }));
  robe.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf1c8a0, roughness: 0.7 }));
  head.position.y = 1.3;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.36, 24), new THREE.MeshStandardMaterial({ color: 0xe6cf8a, roughness: 0.9 }));
  hat.position.y = 1.6;
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25), new THREE.MeshBasicMaterial({ color: 0x3b2a1a }));
  string.position.set(0, 1.33, 0.56);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffa640, emissive: 0xff8a20, emissiveIntensity: 2 }));
  lamp.position.set(0, 1.18, 0.56);
  const lampGlow = glowSprite(0.7, 0xffb060, 0.9);
  lampGlow.position.copy(lamp.position);
  const light = new THREE.PointLight(0xffa850, 4, 14, 1.2);
  light.position.set(0, 1.4, 0.4);
  g.add(robe, head, hat, string, lamp, lampGlow, light);
  // carried fireflies orbit the hat (one sprite per carried firefly)
  const orbit = [];
  for (let i = 0; i < TUNING.carry_capacity; i++) {
    const s = glowSprite(0.35, 0xfff3a0);
    s.visible = false;
    g.add(s);
    orbit.push(s);
  }
  g.userData = { light, orbit, robe };
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x51495e, roughness: 1 }));
  base.position.y = 0.2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 10), new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 }));
  post.position.y = 1.9;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.0), post.material);
  arm.position.set(0, 3.3, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x7a3326, emissive: 0xff7a1a, emissiveIntensity: 0, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), bodyMat);
  body.scale.set(1, 1, 1);
  body.position.set(0, 2.75, 0.85);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0x2a1a12 }));
  cap.position.set(0, 3.25, 0.85);
  const halo = glowSprite(4, 0xffa040, 0);
  halo.position.copy(body.position);
  const light = new THREE.PointLight(0xff9a40, 0, 30, 1.1);
  light.position.copy(body.position);
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.1, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.visible = false;
  g.add(base, post, arm, body, cap, halo, light, ring);
  g.userData = { bodyMat, halo, light, ring, litAt: -1 };
  return g;
}

function makeMote() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6b0 }));
  g.add(core, glowSprite(0.9, 0xffe070));
  g.userData.phase = Math.random() * Math.PI * 2;
  return g;
}

function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x150a22, emissive: 0x3a0f66, emissiveIntensity: 0.5, roughness: 0.4, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), mat);
  body.scale.set(1, 1.15, 1);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 14), mat);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.9;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe4c6ff });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.25, 0.2, 0.65);
  e2.position.set(0.25, 0.2, 0.65);
  g.add(body, tail, e1, e2);
  g.userData = { mat, eyeMat, phase: Math.random() * 10 };
  return g;
}

// Creative extra: "Cú Tí", a little owl that guides Mây to the nearest unlit lantern. Visual only.
function makeOwl() {
  const g = new THREE.Group();
  const brown = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), brown);
  body.scale.y = 1.15;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xd9c09a }));
  belly.position.set(0, -0.05, 0.12);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xffd34d });
  const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeM);
  const e2 = e1.clone();
  e1.position.set(-0.1, 0.1, 0.24);
  e2.position.set(0.1, 0.1, 0.24);
  const w1 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6), brown);
  w1.scale.set(0.3, 0.8, 1);
  const w2 = w1.clone();
  w1.position.set(-0.3, 0, 0);
  w2.position.set(0.3, 0, 0);
  g.add(body, belly, e1, e2, w1, w2, glowSprite(0.6, 0xffd34d, 0.35));
  g.userData = { w1, w2 };
  return g;
}

// ---------- game state ----------
let sim = null;
let seed = 1;
let mode = 'menu'; // menu | playing | over
let stats = null;
const view = { player: null, lanterns: new Map(), motes: new Map(), shades: new Map(), owl: null, rings: [] };
let camYaw = 0; // degrees, contract cam_yaw_deg
let camPos = new THREE.Vector3(0, 6, -10);
let owlTarget = null;

function clearEntities() {
  for (const m of [...view.lanterns.values(), ...view.motes.values(), ...view.shades.values()]) scene.remove(m);
  view.lanterns.clear();
  view.motes.clear();
  view.shades.clear();
  for (const r of view.rings) scene.remove(r.mesh);
  view.rings = [];
}

function newGame() {
  const q = new URLSearchParams(location.search).get('seed');
  seed = q !== null && /^\d+$/.test(q) ? Number(q) : Math.floor(Math.random() * 1e6);
  sim = new Sim({ seed });
  stats = { motes: 0, lanterns: 0, stuns: 0 };
  clearEntities();
  if (!view.player) {
    view.player = makePlayer();
    scene.add(view.player);
    view.owl = makeOwl();
    scene.add(view.owl);
  }
  view.owl.position.set(0, 3, 0);
  owlTarget = null;
  camYaw = 0;
  for (const l of sim.lanterns) {
    const m = makeLantern();
    m.position.set(l.pos[0], l.pos[1], l.pos[2]);
    m.lookAt(0, l.pos[1], 0); // lantern arm faces the island centre
    view.lanterns.set(l.id, m);
    scene.add(m);
  }
  syncEntities(0);
  $('seed').textContent = `seed ${seed}`;
  $('toast').hidden = true;
  toastTimer = 0;
  mode = 'playing';
  $('overlay').hidden = true;
  $('hud').hidden = false;
}

// ---------- input ----------
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false };
const KEYMAP = { Space: 'jump', KeyE: 'interact', KeyF: 'pulse' };
let mousePulse = false;
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (KEYMAP[e.code]) latch[KEYMAP[e.code]] = true;
  if (e.code === 'KeyR' || (mode === 'over' && e.code === 'Enter')) newGame();
  if (e.code === 'KeyM') sfx.muted = !sfx.muted;
  if (e.code === 'KeyP') window.__shot?.(`shot-${Date.now()}`);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  sfx.ensure();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
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
  camYaw -= (e.clientX - lastX) * 0.3; // drag right -> view turns right
  lastX = e.clientX;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const down = (...codes) => codes.some((c) => keys.has(c));
function readInput() {
  const fwd = (down('KeyW', 'ArrowUp') ? 1 : 0) - (down('KeyS', 'ArrowDown') ? 1 : 0);
  // camera looks along +forward; screen-right is world (-cos, +sin) => D maps to move x = -1
  const side = (down('KeyA', 'ArrowLeft') ? 1 : 0) - (down('KeyD', 'ArrowRight') ? 1 : 0);
  const input = {
    move: [side, fwd],
    cam_yaw_deg: camYaw,
    jump: down('Space') || latch.jump,
    interact: down('KeyE') || latch.interact,
    pulse: down('KeyF') || mousePulse || latch.pulse,
    dash: false,
  };
  latch.jump = latch.interact = latch.pulse = false;
  return input;
}

// ---------- events -> effects ----------
let toastTimer = 0;
function toast(msg, secs = 2) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  toastTimer = secs;
}
function handleEvent(e) {
  switch (e.name) {
    case 'mote_picked': stats.motes++; sfx.pickup(e.data.carried); break;
    case 'deposit': sfx.deposit(); break;
    case 'lantern_lit': {
      stats.lanterns++;
      sfx.lit();
      const m = view.lanterns.get(e.data.lantern_id);
      if (m) m.userData.litAt = performance.now();
      toast(`Đèn ${e.data.lantern_id} đã sáng! (${sim.litCount()}/${sim.lanterns.length})`);
      break;
    }
    case 'pulse': {
      stats.stuns += e.data.stunned_ids.length;
      sfx.pulse();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffc060, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(sim.player.pos[0], 0.3, sim.player.pos[2]);
      scene.add(ring);
      view.rings.push({ mesh: ring, t: 0 });
      break;
    }
    case 'player_hit': {
      sfx.hit();
      const f = $('hitflash');
      f.style.transition = 'none';
      f.style.opacity = 1;
      requestAnimationFrame(() => { f.style.transition = 'opacity 0.6s'; f.style.opacity = 0; });
      if (e.data.dropped) toast(`Bị Bóng Mực chạm! Rơi ${e.data.dropped} đom đóm`, 1.5);
      break;
    }
    case 'shade_spawned': sfx.spawn(); toast('Một Bóng Mực mới trồi lên từ sương…', 1.8); break;
    case 'game_over': showGameOver(e.data); break;
    default: break;
  }
}

function showGameOver({ result, reason }) {
  mode = 'over';
  const won = result === 'won';
  won ? sfx.win() : sfx.lose();
  const s = TUNING.score;
  const left = Math.max(0, Math.floor(sim.timeLeft() + 1e-9));
  const rows = [
    ['Đom đóm nhặt', `${stats.motes} × ${s.per_mote}`, stats.motes * s.per_mote],
    ['Đèn thắp', `${stats.lanterns} × ${s.per_lantern}`, stats.lanterns * s.per_lantern],
    ['Xua Bóng Mực', `${stats.stuns} × ${s.per_stun}`, stats.stuns * s.per_stun],
  ];
  if (won) {
    rows.push(['Thời gian còn', `${left}s × ${s.per_second_left}`, left * s.per_second_left]);
    rows.push(['Lửa còn', `${sim.player.flames} × ${s.per_flame_left}`, sim.player.flames * s.per_flame_left]);
  }
  const reasons = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến ấm áp trở lại!', no_flames: 'Mây đã hết lửa. Bóng Mực phủ kín đảo…', dawn: 'Bình minh tới mà đảo vẫn còn tối…' };
  $('ov-title').textContent = won ? 'Chiến thắng!' : 'Thua rồi…';
  $('ov-sub').textContent = reasons[reason] || reason;
  $('ov-body').innerHTML = `<table class="breakdown">${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
    <tr><td><b>Tổng điểm</b></td><td></td><td><b>${sim.score}</b></td></tr></table><p class="small">seed ${seed}</p>`;
  $('ov-btn').textContent = 'Chơi lại (R)';
  setTimeout(() => { $('overlay').hidden = false; }, 900);
}

$('ov-btn').addEventListener('click', () => {
  sfx.ensure();
  newGame();
});

// ---------- sync sim -> meshes ----------
function syncEntities(time) {
  const p = sim.player;
  const pm = view.player;
  pm.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const [dx, dz] = sim.lastMoveDir;
  const targetRot = Math.atan2(dx, dz);
  let dr = targetRot - pm.rotation.y;
  dr = Math.atan2(Math.sin(dr), Math.cos(dr));
  pm.rotation.y += dr * 0.25;
  pm.userData.light.intensity = 3 + p.carried * 1.2;
  pm.visible = !(sim.invuln > 0 && Math.floor(time * 12) % 2 === 0);
  pm.userData.orbit.forEach((s, i) => {
    s.visible = i < p.carried;
    const a = time * 2.2 + (i * Math.PI * 2) / TUNING.carry_capacity;
    s.position.set(Math.cos(a) * 0.85, 1.75 + Math.sin(time * 3 + i) * 0.12, Math.sin(a) * 0.85);
  });

  // lanterns
  let lit = 0;
  for (const l of sim.lanterns) {
    const m = view.lanterns.get(l.id);
    const u = m.userData;
    if (l.lit) lit++;
    const fill = l.lit ? 1 : (l.deposited / TUNING.lantern_cost) * 0.35;
    const pop = u.litAt > 0 ? Math.max(0, 1 - (performance.now() - u.litAt) / 800) : 0;
    u.bodyMat.emissiveIntensity = l.lit ? 2.2 + Math.sin(time * 3 + l.pos[0]) * 0.15 + pop * 3 : fill * 2;
    u.halo.material.opacity = l.lit ? 0.75 + pop : fill;
    u.light.intensity = l.lit ? 35 + pop * 60 : fill * 10;
    u.ring.visible = l.lit;
  }

  // motes
  const seen = new Set();
  for (const mo of sim.motes) {
    seen.add(mo.id);
    let m = view.motes.get(mo.id);
    if (!m) {
      m = makeMote();
      view.motes.set(mo.id, m);
      scene.add(m);
    }
    m.position.set(mo.pos[0] + Math.sin(time * 1.3 + m.userData.phase) * 0.15, 0.8 + Math.sin(time * 2 + m.userData.phase) * 0.25, mo.pos[2]);
  }
  for (const [id, m] of view.motes) if (!seen.has(id)) { scene.remove(m); view.motes.delete(id); }

  // shades
  for (const s of sim.shades) {
    let m = view.shades.get(s.id);
    if (!m) {
      m = makeShade();
      view.shades.set(s.id, m);
      scene.add(m);
    }
    const u = m.userData;
    m.position.set(s.pos[0], Math.max(1, s.pos[1]) + Math.sin(time * 2 + u.phase) * 0.15, s.pos[2]);
    m.lookAt(p.pos[0], m.position.y, p.pos[2]);
    const stunned = s.state === 'stunned';
    u.mat.opacity = stunned ? 0.45 : 0.95;
    u.mat.emissiveIntensity = stunned ? 1.6 : 0.5;
    u.eyeMat.color.setHex(stunned ? 0xffd27a : 0xe4c6ff);
    if (stunned) m.rotation.z = Math.sin(time * 20) * 0.2;
  }

  // world brightens as lanterns light up
  const f = lit / sim.lanterns.length;
  hemi.intensity = 0.9 + 1.2 * f;
  scene.fog.density = 0.035 - 0.022 * f;
  scene.background.copy(NIGHT_BG).lerp(DAWN_BG, f * 0.8);
  scene.fog.color.copy(new THREE.Color(0x160b26)).lerp(new THREE.Color(0x3a2d5c), f * 0.8);
  islandMat.color.setHex(0x2c4a3f).lerp(new THREE.Color(0x4f7a55), f);
}

function updateOwl(dt, time) {
  const p = sim.player;
  const unlit = sim.lanterns.filter((l) => !l.lit);
  let target = null;
  if (p.carried > 0 && unlit.length) {
    target = unlit.reduce((b, l) => (!b || Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) < Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]) ? l : b), null);
  }
  if (target && target !== owlTarget && mode === 'playing') sfx.hoot();
  owlTarget = target;
  const goal = target
    ? new THREE.Vector3(target.pos[0] + Math.cos(time) * 1.2, 5 + Math.sin(time * 2) * 0.3, target.pos[2] + Math.sin(time) * 1.2)
    : new THREE.Vector3(p.pos[0] + Math.cos(time * 0.8) * 1.6, 2.8 + Math.sin(time * 2) * 0.2, p.pos[2] + Math.sin(time * 0.8) * 1.6);
  const o = view.owl;
  o.position.lerp(goal, Math.min(1, dt * 1.8));
  o.lookAt(goal.x + Math.cos(time), o.position.y, goal.z + Math.sin(time));
  const flap = Math.sin(time * 14) * 0.6;
  o.userData.w1.rotation.z = flap;
  o.userData.w2.rotation.z = -flap;
}

function updateCamera(dt) {
  const p = sim.player;
  const t = (camYaw * Math.PI) / 180;
  const fwd = new THREE.Vector3(Math.sin(t), 0, Math.cos(t));
  const goal = new THREE.Vector3(p.pos[0], p.pos[1] * 0.5, p.pos[2]).addScaledVector(fwd, -9).add(new THREE.Vector3(0, 5.2, 0));
  camPos.lerp(goal, Math.min(1, dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(p.pos[0], 1.3 + p.pos[1] * 0.5, p.pos[2]);
}

function updateHud() {
  const p = sim.player;
  $('flames').innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<span class="flame ${i < p.flames ? '' : 'off'}"></span>`).join('');
  $('carried').innerHTML = Array.from({ length: TUNING.carry_capacity }, (_, i) => `<span class="dot ${i < p.carried ? 'on' : ''}"></span>`).join('');
  $('lit').innerHTML = sim.lanterns.map((l) => `<span class="lan ${l.lit ? 'on' : ''}"></span>`).join('');
  const tl = Math.max(0, sim.timeLeft());
  $('time').textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  $('score').textContent = sim.score;
  const cdTicks = Math.round(TUNING.pulse_cooldown_s * WORLD.tick_rate);
  const ready = 1 - sim.pulseCooldown / cdTicks;
  const can = p.carried >= TUNING.pulse_cost;
  $('pulse').innerHTML = `<span class="bar"><i style="width:${(can ? ready : 0) * 100}%"></i></span>`;
  // context prompt near lanterns
  let prompt = '';
  for (const l of sim.lanterns) {
    if (l.lit) continue;
    if (Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius) {
      prompt = p.carried > 0 ? `E: nạp ánh sáng vào ${l.id} (${l.deposited}/${TUNING.lantern_cost})` : `${l.id} cần ${TUNING.lantern_cost - l.deposited} đom đóm nữa`;
      break;
    }
  }
  $('prompt').hidden = !prompt || mode !== 'playing';
  $('prompt').textContent = prompt;
}

// ---------- main loop (fixed 60 Hz sim, render every frame) ----------
let acc = 0;
let last = performance.now();
let clock = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  if (camYaw !== camYaw) camYaw = 0;
  if (keys.has('KeyJ')) camYaw += 120 * dt;
  if (keys.has('KeyL')) camYaw -= 120 * dt;
  if (sim && mode === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= TICK && n < 6) {
      for (const e of sim.step(readInput())) handleEvent(e);
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

// Menu background: show the island before the first game starts.
sim = new Sim({ seed: 1 });
stats = { motes: 0, lanterns: 0, stuns: 0 };
view.player = makePlayer();
view.owl = makeOwl();
scene.add(view.player, view.owl);
for (const l of sim.lanterns) {
  const m = makeLantern();
  m.position.set(l.pos[0], l.pos[1], l.pos[2]);
  m.lookAt(0, 0, 0);
  view.lanterns.set(l.id, m);
  scene.add(m);
}
requestAnimationFrame(frame);

// Dev helpers (inspection + evidence screenshots; see scripts/serve.js).
// tick(n): advance n fixed steps through the real input path (works even when rAF is paused).
window.__game = {
  get sim() { return sim; },
  get mode() { return mode; },
  newGame,
  setYaw: (d) => { camYaw = d; },
  stepWith(input) {
    if (mode === 'playing') for (const e of sim.step(input)) handleEvent(e);
  },
  tick(n = 1) {
    for (let i = 0; i < n && mode === 'playing'; i++) for (const e of sim.step(readInput())) handleEvent(e);
    const dt = 1 / 60;
    clock += n * dt;
    syncEntities(clock);
    updateOwl(Math.min(1, n * dt), clock);
    camPos.set(1e9, 0, 0);
    updateCamera(1);
    updateHud();
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
