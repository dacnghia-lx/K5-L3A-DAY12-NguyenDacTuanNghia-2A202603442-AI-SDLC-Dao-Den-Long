// Three.js builders for the islands and entities. Visual only — geometry mirrors src/sim/levels.js.
import * as THREE from 'three';
import { TUNING } from '../sim/tuning.js';

// Ticket-02 standard palette.
export const PAL = {
  sky: 0x0e1430, mist: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteGlow: 0xffe58a,
  shadeBody: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450,
  robe: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
  danger: 0xff5a5f, text: 0xf5f1e6,
};

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const GLOW = glowTexture();
export const glowSprite = (scale, color = 0xffffff, opacity = 1) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
};

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
const M = {
  grass: mat(PAL.grass), sand: mat(PAL.sand), wood: mat(PAL.wood), rock: mat(0x252a45), stone: mat(0x6f6a7e),
  sea: new THREE.MeshStandardMaterial({ color: PAL.sea, roughness: 1 }),
};

function islandDisk(cx, cz, r, y, group) {
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.6, 72), M.grass);
  top.position.set(cx, y - 0.3, cz);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.05, r - 1.5, 2.2, 72, 1, true), M.sand);
  rim.position.set(cx, y - 1.6, cz);
  const under = new THREE.Mesh(new THREE.ConeGeometry(r - 1.5, Math.max(10, r * 0.6), 40), M.rock);
  under.rotation.x = Math.PI;
  under.position.set(cx, y - 2.7 - Math.max(10, r * 0.6) / 2, cz);
  group.add(top, rim, under);
}

function decorate(group, level, rng) {
  // Bushes and flowers scattered on walkable ground (cosmetic; Math.random is fine here).
  const bushMat = mat(0x3d7a5f);
  const flowerMat = new THREE.MeshBasicMaterial({ color: PAL.lampCore });
  const geo = new THREE.SphereGeometry(0.35, 8, 6);
  for (let i = 0; i < 90; i++) {
    const s = level.surfaces[0];
    const cx = s.cx ?? 0;
    const cz = s.cz ?? 0;
    const pick = level.night === 2 && i % 2 ? 70 : cx;
    const a = rng() * Math.PI * 2;
    const r = 4 + rng() * ((s.r ?? 28) - 6);
    const x = pick + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    if (level.night === 3 && Math.hypot(x, z) < 26 && z > -2) continue;
    const b = new THREE.Mesh(geo, bushMat);
    b.position.set(x, 0.05, z);
    b.scale.set(1, 0.55, 1);
    group.add(b);
    if (i % 3 === 0) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), flowerMat);
      f.position.set(x + 0.25, 0.25, z);
      group.add(f);
    }
  }
}

/** Builds the static island geometry for a level (see src/sim/levels.js). */
export function buildWorld(level) {
  const g = new THREE.Group();
  let seed = level.night * 9301;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const s of level.surfaces) {
    if (s.type === 'disk' && s.y === 0) islandDisk(s.cx, s.cz, s.r, 0, g);
    else if (s.type === 'disk' && s.y === 6) {
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 6, 48), M.stone);
      tier.position.set(0, 3, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, 0.1, 48), M.grass);
      cap.position.set(0, 6.0, 0);
      g.add(tier, cap);
    } else if (s.type === 'disk' && s.y === 14) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r * 1.1, 8, 24), mat(0x8a6f58));
      tower.position.set(0, 10, 0);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(s.r * 1.6, 2.4, 24), mat(0x7a2b22));
      roof.position.set(0, 15.2, 0);
      const bell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), new THREE.MeshStandardMaterial({ color: PAL.gold, metalness: 0.6, roughness: 0.35 }));
      bell.position.set(0, 14.4, 0);
      bell.rotation.x = Math.PI;
      g.add(tower, roof, bell);
    } else if (s.type === 'rect') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, 0.25, s.z1 - s.z0), M.wood);
      deck.position.set((s.x0 + s.x1) / 2, -0.125, 0);
      g.add(deck);
      for (let x = s.x0; x <= s.x1; x += 1) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.27, s.z1 - s.z0 + 0.2), mat(0x8a6a40));
        slat.position.set(x, -0.1, 0);
        g.add(slat);
      }
      for (const x of [s.x0 + 2, (s.x0 + s.x1) / 2, s.x1 - 2]) {
        for (const z of [s.z0, s.z1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 8), M.wood);
          post.position.set(x, -3, z);
          g.add(post);
        }
      }
    } else if (s.type === 'half_annulus') {
      const shape = new THREE.Shape();
      shape.absarc(0, 0, s.r1, 0, Math.PI, false);
      shape.lineTo(-s.r0, 0);
      shape.absarc(0, 0, s.r0, Math.PI, 0, true);
      shape.lineTo(s.r1, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: s.y, bevelEnabled: false, curveSegments: 40 });
      geo.rotateX(Math.PI / 2); // shape Y -> world +Z, extrude Z -> world -Y
      geo.translate(0, s.y, 0);
      const ring = new THREE.Mesh(geo, [M.grass, M.stone]);
      g.add(ring);
    } else if (s.type === 'ramp') {
      const shape = new THREE.Shape();
      shape.moveTo(s.rTop, 0);
      shape.lineTo(s.rFoot, 0);
      shape.lineTo(s.rTop, s.yTop);
      shape.lineTo(s.rTop, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: s.width, bevelEnabled: false });
      geo.translate(0, 0, -s.width / 2);
      const ramp = new THREE.Mesh(geo, M.wood);
      ramp.rotation.y = (-s.deg * Math.PI) / 180;
      g.add(ramp);
    }
  }
  for (const pad of level.pads) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(pad.r, pad.r, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0x3fd0c9, emissive: 0x1aa59c, emissiveIntensity: 1.2 }));
    ring.position.set(pad.pos[0], pad.pos[1] + 0.08, pad.pos[2]);
    const glow = glowSprite(3, 0x3fd0c9, 0.5);
    glow.position.set(pad.pos[0], pad.pos[1] + 0.6, pad.pos[2]);
    g.add(ring, glow);
  }
  decorate(g, level, rng);
  return g;
}

export function makeSea() {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 64), M.sea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -9;
  g.add(sea);
  const puffMat = new THREE.MeshStandardMaterial({ color: 0x2b5468, roughness: 1, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 55 + Math.random() * 130;
    const p = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 6, 12, 8), puffMat);
    p.position.set(35 + Math.cos(a) * r, -9 + Math.random() * 2, Math.sin(a) * r);
    p.scale.y = 0.45;
    g.add(p);
  }
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
    v.multiplyScalar(340);
    pts.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false })));
  return g;
}

// ---------- entities ----------
export function makePlayer(capacity = TUNING.carry_capacity) {
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 16), mat(PAL.robe, { roughness: 0.8 }));
  robe.position.y = 0.55;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16), mat(PAL.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.08;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.04), mat(PAL.scarf));
  tail.position.set(0.12, 0.9, -0.22);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), mat(0xf1c8a0, { roughness: 0.7 }));
  head.position.y = 1.3;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.36, 24), mat(0xe6cf8a, { roughness: 0.9 }));
  hat.position.y = 1.6;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: PAL.lampOn, emissive: PAL.lampOn, emissiveIntensity: 2 }));
  lamp.position.set(0, 1.18, 0.56);
  const lampGlow = glowSprite(0.7, PAL.lampOn, 0.9);
  lampGlow.position.copy(lamp.position);
  const light = new THREE.PointLight(PAL.lampOn, 4, 14, 1.2);
  light.position.set(0, 1.4, 0.4);
  g.add(robe, scarf, tail, head, hat, lamp, lampGlow, light);
  const orbit = [];
  for (let i = 0; i < capacity; i++) {
    const s = glowSprite(0.32, PAL.moteGlow);
    s.visible = false;
    g.add(s);
    orbit.push(s);
  }
  const charmAura = glowSprite(2.2, PAL.scarf, 0);
  charmAura.position.y = 0.8;
  g.add(charmAura);
  g.userData = { light, orbit, charmAura };
  return g;
}

export function makeLantern() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 0.4, 12), mat(0x51495e));
  base.position.y = 0.2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 10), mat(PAL.wood));
  post.position.y = 1.9;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.0), post.material);
  arm.position.set(0, 3.3, 0.4);
  const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.lampOff, emissive: PAL.lampOn, emissiveIntensity: 0, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.8, 16), bodyMat);
  body.position.set(0, 2.75, 0.85);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 0.2, 16), mat(0x2a1a12));
  cap.position.set(0, 3.25, 0.85);
  const core = glowSprite(0.9, PAL.lampCore, 0);
  core.position.copy(body.position);
  const halo = glowSprite(4.5, PAL.lampOn, 0);
  halo.position.copy(body.position);
  const light = new THREE.PointLight(PAL.lampOn, 0, 30, 1.1);
  light.position.copy(body.position);
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.visible = false;
  g.add(base, post, arm, body, cap, core, halo, light, ring);
  g.userData = { bodyMat, body, core, halo, light, ring, litAt: -1 };
  return g;
}

const moteGeo = new THREE.SphereGeometry(0.09, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
export function makeMote(dropped = false) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(moteGeo, moteMat), glowSprite(dropped ? 0.7 : 0.9, PAL.moteGlow));
  g.userData.phase = Math.random() * Math.PI * 2;
  return g;
}

const shadeGeo = new THREE.SphereGeometry(0.75, 18, 14);
const tailGeo = new THREE.ConeGeometry(0.6, 1.2, 14);
const eyeGeo = new THREE.SphereGeometry(0.1, 8, 6);
export function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: PAL.shadeBody, emissive: PAL.shadeRim, emissiveIntensity: 0.35, roughness: 0.4, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(shadeGeo, bodyMat);
  body.scale.set(1, 1.15, 1);
  const tail = new THREE.Mesh(tailGeo, bodyMat);
  tail.rotation.x = Math.PI;
  tail.position.y = -0.9;
  const rim = new THREE.Mesh(shadeGeo, new THREE.MeshBasicMaterial({ color: PAL.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.55 }));
  rim.scale.set(1.08, 1.24, 1.08);
  const eyeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim });
  const e1 = new THREE.Mesh(eyeGeo, eyeMat);
  const e2 = e1.clone();
  e1.position.set(-0.25, 0.2, 0.65);
  e2.position.set(0.25, 0.2, 0.65);
  g.add(body, tail, rim, e1, e2);
  g.userData = { bodyMat, rim, eyeMat, phase: Math.random() * 10 };
  return g;
}

export function makeDrifter() {
  const g = new THREE.Group();
  const ribbonMat = new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
  const segs = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), ribbonMat);
    s.position.set(0, 0, -i * 0.38);
    g.add(s);
    segs.push(s);
  }
  const loot = glowSprite(0.8, PAL.moteGlow, 0);
  g.add(loot);
  g.userData = { segs, loot, phase: Math.random() * 10 };
  return g;
}

export function makeCharm() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.04), new THREE.MeshStandardMaterial({ color: PAL.scarf, emissive: PAL.scarf, emissiveIntensity: 0.4 }));
  const border = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.88, 0.02), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.5 }));
  border.position.z = -0.02;
  g.add(border, paper, glowSprite(1.6, PAL.scarf, 0.5));
  return g;
}

// Creative extra: "Cú Tí", a little owl that guides Mây to the nearest unlit lantern. Visual only.
export function makeOwl() {
  const g = new THREE.Group();
  const brown = mat(0x8a6440, { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), brown);
  body.scale.y = 1.15;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mat(0xd9c09a));
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

/** Leaves that blow across the island during (and just before) a Night 3 gust. */
export function makeLeaves(n = 60) {
  const geo = new THREE.PlaneGeometry(0.25, 0.12);
  const m = new THREE.MeshBasicMaterial({ color: 0x9cc77a, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, m);
    l.userData.seed = Math.random() * 100;
    g.add(l);
  }
  g.visible = false;
  return g;
}
