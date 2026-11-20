// Standard maps for Nights 1-3 (Ticket-02 Part 2). Pure data + geometry helpers.
// Angles are measured from +X towards +Z: point(r, a) = (r cos a, y, r sin a).
import { TUNING, WORLD } from './tuning.js';

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const ring = (r, startDeg, stepDeg, n, y = 0, cx = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + i * stepDeg) * Math.PI) / 180;
    return [r3(cx + r * Math.cos(a)), y, r3(r * Math.sin(a))];
  });

// Surface primitives. height(x, z) returns the walkable top at (x, z) or null if not covered.
const disk = (cx, cz, r, y) => ({ type: 'disk', cx, cz, r, y, height: (x, z) => (Math.hypot(x - cx, z - cz) <= r ? y : null) });
const rect = (x0, x1, z0, z1, y) => ({ type: 'rect', x0, x1, z0, z1, y, height: (x, z) => (x >= x0 && x <= x1 && z >= z0 && z <= z1 ? y : null) });
const halfAnnulus = (r0, r1, y) => ({
  type: 'half_annulus', r0, r1, y,
  height: (x, z) => {
    const r = Math.hypot(x, z);
    return z > 0 && r >= r0 && r <= r1 ? y : null;
  },
});
// Straight radial ramp at angle a: foot at radius rFoot (Y = 0), top at radius rTop (Y = yTop).
const ramp = (deg, rFoot, rTop, yTop, width) => {
  const a = (deg * Math.PI) / 180;
  const ux = Math.cos(a);
  const uz = Math.sin(a);
  return {
    type: 'ramp', deg, rFoot, rTop, yTop, width,
    height: (x, z) => {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      if (Math.abs(v) > width / 2 || u < rTop || u > rFoot) return null;
      return (yTop * (rFoot - u)) / (rFoot - rTop);
    },
  };
};

export const LEVELS = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    durationS: TUNING.night1_duration_s,
    start: [0, 0, 0],
    facing: [0, 1],
    surfaces: [disk(0, 0, 40, 0)],
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadeSpawns: ring(37, 15, 30, 12, WORLD.shade_height),
    shadeEveryTicks: 480,
    shadeMax: 6,
    shadeSpeed: TUNING.shade_speed,
    drifters: false,
    wind: false,
    pads: [],
    charms: [],
    bounds: [disk(0, 0, 40, 0)],
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    durationS: TUNING.night2_duration_s,
    start: [0, 0, 0],
    facing: [0, 1],
    surfaces: [disk(0, 0, 28, 0), disk(70, 0, 28, 0), rect(26, 44, -2, 2, 0)],
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    moteSpawns: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70), ...ring(22, 0, 45, 8, 0, 70)],
    shadeSpawns: [...ring(26, 22.5, 45, 8, WORLD.shade_height), ...ring(26, 22.5, 45, 8, WORLD.shade_height, 70)],
    shadeEveryTicks: 420,
    shadeMax: 8,
    shadeSpeed: TUNING.shade_speed,
    drifters: true,
    wind: false,
    pads: [
      { pos: [20, 0, 18], r: 1, vy: 14, speed: 24, toward: [70, 0] },
      { pos: [50, 0, -18], r: 1, vy: 14, speed: 24, toward: [0, 0] },
    ],
    charms: [[35, 0, 0]],
    bounds: [disk(0, 0, 28, 0), disk(70, 0, 28, 0), rect(26, 44, -2, 2, 0)],
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    durationS: TUNING.night3_duration_s,
    start: [0, 0, -20], // assumption A-P2-1: (0,0,0) is inside the bell tower
    facing: [0, 1],
    surfaces: [
      disk(0, 0, 45, 0),
      halfAnnulus(12, 24, 3),
      disk(0, 0, 8, 6),
      ramp(30, 30, 24, 3, 3),
      ramp(150, 30, 24, 3, 3),
      disk(0, 0, 2, 14), // bell tower: 8 m above tier 2, acts as a wall
    ],
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    moteSpawns: [...ring(34, 0, 20, 18), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadeSpawns: ring(43, 0, 22.5, 16, WORLD.shade_height),
    shadeEveryTicks: 360,
    shadeMax: 10,
    shadeSpeed: WORLD.shade_speed_night3,
    drifters: true,
    wind: true,
    pads: [{ pos: [0, 3, 13], r: 1, vy: 12, speed: 8, dir: [0, -1] }],
    charms: [[30, 0, 25], [-30, 0, 25]],
    bounds: [disk(0, 0, 45, 0)],
  },
};

export function getLevel(night) {
  const L = LEVELS[night];
  if (!L) throw new Error(`night ${night} does not exist (1-3)`);
  return L;
}

/** All surface heights covering (x, z). */
export function heightsAt(level, x, z) {
  const out = [];
  for (const s of level.surfaces) {
    const h = s.height(x, z);
    if (h !== null) out.push(h);
  }
  return out;
}

/** Highest surface at (x, z) that is not above yRef + step; -Infinity if none (open air / sea). */
export function floorAt(level, x, z, yRef) {
  let best = -Infinity;
  for (const s of level.surfaces) {
    const h = s.height(x, z);
    if (h !== null && h <= yRef + WORLD.step_height && h > best) best = h;
  }
  return best;
}

/** True if a surface at (x, z) rises above yRef + step (a wall the player cannot walk into). */
export function blockedAt(level, x, z, yRef) {
  for (const s of level.surfaces) {
    const h = s.height(x, z);
    if (h !== null && h > yRef + WORLD.step_height) return true;
  }
  return false;
}

/** Ground top under a floating enemy (ignores the tower); 0 over the sea. */
export function groundTop(level, x, z) {
  let best = null;
  for (const s of level.surfaces) {
    const h = s.height(x, z);
    if (h !== null && h <= 6 && (best === null || h > best)) best = h;
  }
  return best ?? 0;
}

/** Clamp an enemy XZ position into the level's flying area (union of island regions). */
export function clampToBounds(level, pos) {
  const [x, z] = [pos[0], pos[2]];
  let bestP = null;
  let bestD = Infinity;
  for (const b of level.bounds) {
    let px;
    let pz;
    if (b.type === 'disk') {
      const d = Math.hypot(x - b.cx, z - b.cz);
      if (d <= b.r) return;
      px = b.cx + ((x - b.cx) * b.r) / d;
      pz = b.cz + ((z - b.cz) * b.r) / d;
    } else {
      if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) return;
      px = Math.min(b.x1, Math.max(b.x0, x));
      pz = Math.min(b.z1, Math.max(b.z0, z));
    }
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) {
      bestD = d;
      bestP = [px, pz];
    }
  }
  pos[0] = bestP[0];
  pos[2] = bestP[1];
}
