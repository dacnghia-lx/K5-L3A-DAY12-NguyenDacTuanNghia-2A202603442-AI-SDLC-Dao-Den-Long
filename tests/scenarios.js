// Headless scenarios (Phase 2 / Contract v1.1). Each one is run through the REAL CLI
// (src/headless.js) by tests/scenarios.test.js and by scripts/proof.js.
// `req` links the scenario to a requirement id in docs/notes/phase-N.md.
// Expected numbers are derived by hand from the Ticket-02 standard values.

const R1 = (v) => Math.round(v * 1000) / 1000;
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;
const dXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function parse(lines) {
  const objs = lines.filter(Boolean).map((l) => JSON.parse(l));
  return {
    all: objs,
    snaps: objs.filter((o) => o.type === 'snapshot'),
    events: (name) => objs.filter((o) => o.type === 'event' && (!name || o.name === name)),
    snap: (tick) => objs.find((o) => o.type === 'snapshot' && o.tick === tick),
    end: objs[objs.length - 1],
  };
}

const NO_RANDOM = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], drifters: [] };
const shade = (r, t, id) => r.snap(t).shades.find((s) => s.id === id);
const press = (k, btn) => [{ tick: k, [btn]: true }, { tick: k + 1, [btn]: false }];

export const SCENARIOS = [
  // ---------------- Phase 1 rules re-checked with the standard numbers ----------------
  {
    name: 'pickup-walk',
    req: 'P2-1',
    what: 'Walking +Z at 6 m/s picks a firefly when XZ distance <= 1.0: (5-1)/0.1 = tick 40; no score on pickup',
    seed: 1, ticks: 60, every: 1,
    scenario: { ...NO_RANDOM, motes: [[0, 0, 5]] },
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }] },
    check: (r, ok) => {
      const e = r.events('mote_picked');
      ok(e.length === 1 && e[0].tick === 40 && e[0].data.carried === 1, `mote_picked once at tick 40 (got ${JSON.stringify(e)})`);
      ok(r.snap(39).motes_active === 1 && r.snap(40).motes_active === 0, 'motes_active 1 -> 0 at tick 40');
      ok(r.snap(40).score === 0, `score 0 after pickup (got ${r.snap(40).score})`);
      ok(R1(r.snap(60).player.pos[2]) === 6, `player at z=6 after 60 ticks (got ${r.snap(60).player.pos})`);
      ok(R1(r.snap(1).player.vel[2]) === 6, `full speed from the first tick (vel ${r.snap(1).player.vel})`);
    },
  },
  {
    name: 'pickup-height',
    req: 'P2-1',
    what: 'Pickup also needs |feet Y - mote Y| <= 1.5: mote at Y=1.4 is picked, mote at Y=1.6 is not',
    seed: 1, ticks: 3, every: 1,
    scenario: { ...NO_RANDOM, motes: [[0.5, 1.4, 0], [-0.5, 1.6, 0]] },
    check: (r, ok) => {
      ok(r.events('mote_picked').length === 1 && r.snap(3).motes_active === 1, `one pickup (got ${r.events('mote_picked').length})`);
      ok(r.snap(3).motes[0].pos[1] === 1.6, 'the high one stays');
    },
  },
  {
    name: 'carry-capacity',
    req: 'P2-1',
    what: '12 fireflies under the player: only carry_capacity (10) are picked, 2 stay',
    seed: 1, ticks: 5, every: 1,
    scenario: { ...NO_RANDOM, motes: Array.from({ length: 12 }, (_, i) => [0.05 * i, 0, 0]) },
    check: (r, ok) => {
      const e = r.events('mote_picked');
      ok(e.length === 10 && e.every((x) => x.tick === 1), `10 pickups at tick 1 (got ${e.length})`);
      ok(r.snap(5).player.carried === 10 && r.snap(5).motes_active === 2, 'carried 10, 2 motes left');
    },
  },
  {
    name: 'deposit-light',
    req: 'P2-1',
    what: 'Interact within 2.0 m deposits; lantern_cost 10 lights it: 10 x 10 + 100 = 200',
    seed: 1, ticks: 3, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const d = r.events('deposit');
      ok(d.length === 1 && d[0].tick === 1 && d[0].data.lantern_id === 'L1' && d[0].data.amount === 10 && d[0].data.deposited === 10, `deposit L1 10/10 at tick 1 (got ${JSON.stringify(d)})`);
      ok(r.events('lantern_lit').length === 1 && r.events('lantern_lit')[0].data.lantern_id === 'L1', 'lantern_lit L1');
      const l1 = r.snap(1).lanterns.find((l) => l.id === 'L1');
      ok(l1.lit === true && l1.deposited === 10 && r.snap(1).player.carried === 0, 'L1 lit, player carried 0');
      ok(r.snap(1).score === 200, `score 200 (got ${r.snap(1).score})`);
    },
  },
  {
    name: 'deposit-partial-and-hold',
    req: 'P2-1',
    what: 'Partial deposit (3 of 10) keeps the lantern unlit (+30); holding interact does not repeat',
    seed: 1, ticks: 30, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const d = r.events('deposit');
      ok(d.length === 1 && d[0].data.amount === 3 && d[0].data.deposited === 3, `one deposit of 3 (got ${JSON.stringify(d)})`);
      ok(r.events('lantern_lit').length === 0, 'not lit');
      ok(r.snap(30).lanterns.find((l) => l.id === 'L1').deposited === 3 && r.snap(30).score === 30, 'L1 deposited 3, score 30');
    },
  },
  {
    name: 'interact-out-of-range',
    req: 'P2-1',
    what: 'Lantern at 2.1 m (> interact_radius 2.0): interact does nothing',
    seed: 1, ticks: 5, every: 5,
    scenario: { ...NO_RANDOM, player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.1] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      ok(r.events('deposit').length === 0, 'no deposit');
      ok(r.snap(5).player.carried === 5, 'still carrying 5');
    },
  },
  {
    name: 'interact-tie-lower-id',
    req: 'P2-1',
    what: 'Two unlit lanterns at the same distance: the one with the smaller id (L2 before L4) is fed',
    seed: 1, ticks: 2, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 2 }, lanterns: [{ id: 'L4', pos: [1.5, 0, 0] }, { id: 'L2', pos: [-1.5, 0, 0] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const d = r.events('deposit');
      ok(d.length === 1 && d[0].data.lantern_id === 'L2', `deposit into L2 (got ${JSON.stringify(d)})`);
    },
  },
  {
    name: 'win-all-lit',
    req: 'P2-1',
    what: 'Lighting the last lantern wins: 10 + 100 + floor(299.983) x 2 + 3 x 50 = 858; pre-lit lanterns give no points',
    seed: 1, ticks: 100, every: 1,
    scenario: {
      ...NO_RANDOM,
      player: { carried: 1, flames: 3 },
      lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true }, { id: 'L5', pos: [0, 0, 2], deposited: 9 }],
      time_left_s: 300,
    },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 1 && g[0].data.result === 'won' && g[0].data.reason === 'all_lit', `game_over won/all_lit at tick 1 (got ${JSON.stringify(g)})`);
      ok(r.end.type === 'end' && r.end.state === 'won' && r.end.ticks === 1, `end won after 1 tick (got ${JSON.stringify(r.end)})`);
      ok(r.end.score === 858, `score 858 (got ${r.end.score})`);
      ok(r.snap(0).score === 0, 'score 0 at build (pre-lit lanterns not scored)');
    },
  },
  {
    name: 'win-on-dawn-tick',
    req: 'P2-1',
    what: 'All lanterns lit on the very last tick still wins (win is checked before dawn): bonus floor(0) x 2 + 150',
    seed: 1, ticks: 100, every: 1,
    scenario: {
      ...NO_RANDOM,
      player: { carried: 10 },
      lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true }, { id: 'L5', pos: [0, 0, 2] }],
      time_left_s: 0.5,
    },
    inputs: { frames: [{ tick: 29, interact: true }] },
    check: (r, ok) => {
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 30 && g[0].data.result === 'won', `won at tick 30 = dawn tick (got ${JSON.stringify(g)})`);
      ok(r.end.score === 100 + 100 + 150, `score 350 (got ${r.end.score})`);
    },
  },
  {
    name: 'pulse-stun-push',
    req: 'P2-1',
    what: 'Pulse costs 3, 3D radius 5 from feet+0.8; stun 120 ticks, pushed 4 m over 15 ticks; +5 per shade',
    seed: 1, ticks: 125, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [5, 1, 0] }] },
    inputs: { frames: press(0, 'pulse') },
    check: (r, ok) => {
      const p = r.events('pulse');
      ok(p.length === 1 && p[0].tick === 1 && JSON.stringify(p[0].data.stunned_ids) === '["S1"]', `pulse stunned [S1] only (S2 is 5.004 m away in 3D) (got ${JSON.stringify(p)})`);
      ok(shade(r, 1, 'S1').state === 'stunned' && near(shade(r, 1, 'S1').pos[0], 3 + 4 / 15), `S1 pushed 4/15 m on tick 1 (got ${JSON.stringify(shade(r, 1, 'S1'))})`);
      ok(near(shade(r, 15, 'S1').pos[0], 7) && near(shade(r, 60, 'S1').pos[0], 7), `S1 at x=7 after 15 ticks and stays (got ${shade(r, 15, 'S1').pos[0]})`);
      ok(shade(r, 120, 'S1').state === 'stunned', 'S1 still stunned at tick 120');
      ok(shade(r, 121, 'S1').state === 'chase' && near(shade(r, 121, 'S1').pos[0], 7 - 4 / 60), `S1 chases again at tick 121 (got ${JSON.stringify(shade(r, 121, 'S1'))})`);
      ok(r.snap(1).player.carried === 0 && r.snap(1).score === 5, `carried 3 -> 0, score 5 (got ${r.snap(1).score})`);
      ok(r.snap(1).player.pulse_cd_s === 3, `pulse_cd_s 3 (got ${r.snap(1).player.pulse_cd_s})`);
    },
  },
  {
    name: 'pulse-coincident-push-x',
    req: 'P2-1',
    what: 'A shade exactly on the player is pushed along +X; a second pulse refreshes stun and push',
    seed: 1, ticks: 400, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 6, invuln_ticks: 1000 }, shades: [{ id: 'S1', pos: [0, 1, 0], state: 'stunned', state_ticks_left: 500 }] },
    inputs: { frames: [...press(0, 'pulse'), ...press(200, 'pulse')] },
    check: (r, ok) => {
      ok(near(shade(r, 15, 'S1').pos[0], 4) && near(shade(r, 15, 'S1').pos[2], 0), `pushed to (4,0) (got ${shade(r, 15, 'S1').pos})`);
      ok(r.events('pulse').map((e) => e.tick).join() === '1,201', 'pulses at 1 and 201');
      ok(shade(r, 320, 'S1').state === 'stunned' && shade(r, 321, 'S1').state !== 'stunned', 'second pulse restarts the 120-tick stun (ends at 321)');
      ok(r.snap(201).score === 10, `5 + 5 (hits on an already-stunned shade count) (got ${r.snap(201).score})`);
    },
  },
  {
    name: 'pulse-cooldown-cost',
    req: 'P2-1',
    what: 'Pulse cooldown 3 s (180 ticks): accepted at ticks 1, 181, 401; press at 60 ignored; < 3 fireflies ignored',
    seed: 1, ticks: 700, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 9 } },
    inputs: { frames: [...press(0, 'pulse'), ...press(60, 'pulse'), ...press(180, 'pulse'), ...press(400, 'pulse'), ...press(600, 'pulse')] },
    check: (r, ok) => {
      const ticks = r.events('pulse').map((e) => e.tick);
      ok(JSON.stringify(ticks) === '[1,181,401]', `pulses at [1,181,401] (got ${JSON.stringify(ticks)})`);
      ok(r.snap(700).player.carried === 0, 'carried 9 -> 0; fourth press with 0 ignored');
    },
  },
  {
    name: 'shade-chase-speed',
    req: 'P2-1',
    what: 'A shade 10 m away (<= 12 detect) chases at 4.0 m/s: x = 10 - 4 = 6 after 60 ticks',
    seed: 1, ticks: 60, every: 60,
    scenario: { ...NO_RANDOM, shades: [{ id: 'S1', pos: [10, 1, 0] }] },
    check: (r, ok) => {
      ok(shade(r, 60, 'S1').state === 'chase' && near(shade(r, 60, 'S1').pos[0], 6), `chase, x=6 (got ${JSON.stringify(shade(r, 60, 'S1'))})`);
    },
  },
  {
    name: 'shade-detect-and-lose',
    req: 'P2-1',
    what: 'Shade at 13 m stays wander; shade at 11 m chases, loses the running player beyond 18 m and wanders',
    seed: 1, ticks: 300, every: 10,
    scenario: { ...NO_RANDOM, shades: [{ id: 'S1', pos: [0, 1, 13] }, { id: 'S2', pos: [11, 1, 0] }] },
    inputs: { frames: [{ tick: 0, move: [-1, 0] }] },
    check: (r, ok) => {
      ok(shade(r, 10, 'S1').state === 'wander', `S1 wander (got ${shade(r, 10, 'S1').state})`);
      ok(shade(r, 10, 'S2').state === 'chase', `S2 chase (got ${shade(r, 10, 'S2').state})`);
      ok(shade(r, 300, 'S2').state === 'wander', `S2 wander after the gap passes 18 m (got ${shade(r, 300, 'S2').state})`);
    },
  },
  {
    name: 'shade-hit-invuln-lose',
    req: 'P2-1',
    what: 'Contact: -1 flame, drop floor(carried/2), 90 ticks invulnerable, hitter recoils; 0 flames = lost/no_flames',
    seed: 1, ticks: 400, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 4, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] },
    check: (r, ok) => {
      const h = r.events('player_hit').map((e) => [e.tick, e.data.by, e.data.flames, e.data.dropped]);
      ok(JSON.stringify(h) === JSON.stringify([[1, 'shade', 2, 2], [91, 'shade', 1, 1], [181, 'shade', 0, 0]]), `hits at 1/91/181 (got ${JSON.stringify(h)})`);
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 181 && g[0].data.result === 'lost' && g[0].data.reason === 'no_flames', `lost/no_flames at 181 (got ${JSON.stringify(g)})`);
      ok(r.end.state === 'lost' && r.end.ticks === 181, `end lost at 181 (got ${JSON.stringify(r.end)})`);
      ok(shade(r, 10, 'S1').state === 'recoil', `S1 recoils after the hit (got ${shade(r, 10, 'S1').state})`);
    },
  },
  {
    name: 'hit-one-per-tick-lowest-id',
    req: 'P2-1',
    what: 'Two shades touching on the same tick: only one hit, by the lower id (S2 before S10)',
    seed: 1, ticks: 2, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 0 }, shades: [{ id: 'S10', pos: [0.3, 1, 0] }, { id: 'S2', pos: [-0.3, 1, 0] }] },
    check: (r, ok) => {
      ok(r.events('player_hit').length === 1 && r.snap(1).player.flames === 2, 'one hit only');
      ok(shade(r, 1, 'S2').state === 'recoil' && shade(r, 1, 'S10').state === 'chase', `S2 hit (recoil), S10 did nothing (got ${shade(r, 1, 'S2').state}/${shade(r, 1, 'S10').state})`);
    },
  },
  {
    name: 'hit-drop-ring',
    req: 'P2-1',
    what: 'Dropped fireflies land on a 1.5-2.5 m ring around Mây as kind "dropped" with ttl 8 s',
    seed: 1, ticks: 1, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 7 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] },
    check: (r, ok) => {
      const m = r.snap(1).motes;
      ok(m.length === 3 && r.snap(1).player.carried === 4, `3 dropped, 4 kept (got ${m.length}, ${r.snap(1).player.carried})`);
      ok(m.every((x) => x.kind === 'dropped' && x.ttl_s === 8), `kind dropped, ttl 8 (got ${JSON.stringify(m)})`);
      ok(m.every((x) => dXZ(x.pos, [0, 0, 0]) >= 1.5 - 1e-3 && dXZ(x.pos, [0, 0, 0]) <= 2.5 + 1e-3), 'on the 1.5-2.5 m ring');
    },
  },
  {
    name: 'dropped-ttl-and-repick',
    req: 'P2-1',
    what: 'A dropped firefly disappears after its TTL (30 ticks); another one under the player is picked',
    seed: 1, ticks: 40, every: 1,
    scenario: { ...NO_RANDOM, motes: [{ id: 'X1', pos: [5, 0, 0], kind: 'dropped', ttl_ticks: 30 }, { id: 'X2', pos: [0.5, 0, 0], kind: 'dropped', ttl_ticks: 30 }] },
    check: (r, ok) => {
      ok(r.events('mote_picked').length === 1 && r.events('mote_picked')[0].tick === 1, 'X2 picked at tick 1');
      ok(r.snap(29).motes_active === 1 && r.snap(30).motes_active === 0, `X1 gone at tick 30 (got ${r.snap(29).motes_active}, ${r.snap(30).motes_active})`);
    },
  },
  {
    name: 'dawn-lose',
    req: 'P2-1',
    what: 'time_left_s=1: night ends at tick 60 with lost/dawn; time_left_s counts down 1/60 per tick',
    seed: 1, ticks: 500, every: 30,
    scenario: { ...NO_RANDOM, time_left_s: 1 },
    check: (r, ok) => {
      ok(r.snap(30).time_left_s === 0.5, `time_left 0.5 at tick 30 (got ${r.snap(30).time_left_s})`);
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 60 && g[0].data.reason === 'dawn' && g[0].data.result === 'lost', `lost/dawn at tick 60 (got ${JSON.stringify(g)})`);
      ok(r.end.ticks === 60 && r.end.state === 'lost', 'end after 60 ticks');
    },
  },
  {
    name: 'safe-radius',
    req: 'P2-1',
    what: 'Shades are stopped at the 6 m edge of a lit lantern; the player standing at the lantern is never hit',
    seed: 1, ticks: 900, every: 1,
    scenario: { ...NO_RANDOM, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [12, 1, 0] }, { id: 'S2', pos: [8, 1, 1] }] },
    check: (r, ok) => {
      let min = Infinity;
      for (const s of r.snaps) for (const sh of s.shades) if (s.tick > 0) min = Math.min(min, dXZ(sh.pos, [0, 0, 0]));
      ok(min >= 6 - 1e-3 && min < 6.01, `min shade distance to lit L1 is the 6 m edge (got ${min.toFixed(4)})`);
      ok(r.events('player_hit').length === 0, 'no hits inside the safe zone');
    },
  },
  {
    name: 'safe-evict-on-light',
    req: 'P2-1',
    what: 'A shade inside a lantern when it is lit is pushed to the 6 m edge within 30 ticks and deals no damage meanwhile',
    seed: 1, ticks: 300, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }], shades: [{ id: 'S1', pos: [0.6, 1, 0.5] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const L = [0, 0, 2];
      ok(r.events('lantern_lit').length === 1, 'L1 lit at tick 1');
      ok(dXZ(shade(r, 15, 'S1').pos, L) < 6 && dXZ(shade(r, 15, 'S1').pos, L) > dXZ(shade(r, 1, 'S1').pos, L), 'moving out during the 30 ticks');
      ok(dXZ(shade(r, 30, 'S1').pos, L) >= 6 - 1e-3, `at the edge by tick 30 (got ${dXZ(shade(r, 30, 'S1').pos, L)})`);
      ok(r.events('player_hit').length === 0, 'no damage while being pushed out, none after (player inside the zone)');
    },
  },
  {
    name: 'scenario-build-silent',
    req: 'C-D',
    what: 'Building a scenario emits no events and no score (pre-lit L1, carried 3); only night_start at tick 0',
    seed: 1, ticks: 10, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 3 }, lanterns: [{ id: 'L1', lit: true }] },
    check: (r, ok) => {
      const evs = r.events();
      ok(evs.length === 1 && evs[0].name === 'night_start' && evs[0].tick === 0 && evs[0].data.night === 1, `only night_start (got ${JSON.stringify(evs)})`);
      ok(r.end.score === 0 && r.snap(0).lanterns[0].lit === true && r.snap(0).lanterns[0].deposited === 10, 'score 0, L1 lit');
    },
  },
  {
    name: 'tick-model',
    req: 'C-B',
    what: '--ticks 7 --snapshot-every 3: snapshots at 0,3,6; end.ticks = 7; sim_tick = tick when not paused',
    seed: 1, ticks: 7, every: 3,
    scenario: NO_RANDOM,
    check: (r, ok) => {
      ok(JSON.stringify(r.snaps.map((s) => s.tick)) === '[0,3,6]', `snapshot ticks (got ${r.snaps.map((s) => s.tick)})`);
      ok(r.snaps.every((s) => s.sim_tick === s.tick && s.night === 1), 'sim_tick == tick, night 1');
      ok(r.end.ticks === 7 && r.end.state === 'playing', `end ticks 7 (got ${JSON.stringify(r.end)})`);
      ok(r.snap(6).time_left_s === 299.9, `time_left 299.9 at tick 6 (got ${r.snap(6).time_left_s})`);
    },
  },
  {
    name: 'snapshot-v1.1-fields',
    req: 'C-v1.1',
    what: 'Snapshot carries night, wind{active,dir_deg}, player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s, motes/drifters/charms arrays',
    seed: 3, night: 2, ticks: 1, every: 1,
    check: (r, ok) => {
      const s = r.snap(0);
      ok(s.night === 2 && typeof s.wind.active === 'boolean' && typeof s.wind.dir_deg === 'number', 'night, wind');
      ok(['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s'].every((k) => k in s.player), `player fields (got ${Object.keys(s.player)})`);
      ok(Array.isArray(s.motes) && s.motes.every((m) => 'id' in m && 'pos' in m && m.kind === 'random' && m.ttl_s === null), 'motes id/pos/kind/ttl_s');
      ok(Array.isArray(s.drifters) && JSON.stringify(s.charms) === '[{"id":"C1","available":true,"respawn_s":0}]', `drifters [], charms C1 (got ${JSON.stringify(s.charms)})`);
    },
  },
  {
    name: 'camera-yaw-and-normalize',
    req: 'C-C',
    what: 'cam_yaw 90 + move [0,1] walks +X; move [1,1] at yaw 0 is normalized (6 m/s total)',
    seed: 1, ticks: 120, every: 60,
    scenario: NO_RANDOM,
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }, { tick: 60, move: [1, 1], cam_yaw_deg: 0 }] },
    check: (r, ok) => {
      const a = r.snap(60).player.pos;
      ok(R1(a[0]) === 6 && R1(a[2]) === 0, `at tick 60 pos ~[6,0,0] (got ${a})`);
      const b = r.snap(120).player.pos;
      ok(R1(b[0]) === 10.243 && R1(b[2]) === 4.243, `at tick 120 pos ~[10.243,0,4.243] (got ${b})`);
    },
  },
  {
    name: 'jump',
    req: 'P2-1',
    what: 'Jump 7 m/s, gravity 20: airborne ~42 ticks, peak ~1.2 m; a second press in the air does nothing',
    seed: 1, ticks: 60, every: 1,
    scenario: NO_RANDOM,
    inputs: { frames: [...press(0, 'jump'), ...press(10, 'jump')] },
    check: (r, ok) => {
      const peak = Math.max(...r.snaps.map((s) => s.player.pos[1]));
      ok(peak > 1.1 && peak <= 1.23, `peak ~1.2 (got ${peak})`);
      ok(r.snap(20).player.grounded === false && r.snap(60).player.grounded === true && r.snap(60).player.pos[1] === 0, 'airborne at 20, landed by 60');
      ok(r.snap(60).player.pos[0] === 0 && r.snap(60).player.pos[2] === 0, 'XZ unchanged');
    },
  },
  {
    name: 'default-level-night1',
    req: 'P2-2',
    what: 'Default Night 1: standard lantern positions, 20 fireflies on 20 distinct standard points, no shades yet, 300 s',
    seed: 7, ticks: 10, every: 10,
    check: (r, ok) => {
      const s0 = r.snap(0);
      ok(JSON.stringify(s0.lanterns.map((l) => l.pos)) === '[[0,0,25],[23.8,0,7.7],[14.7,0,-20.2],[-14.7,0,-20.2],[-23.8,0,7.7]]', 'L1..L5 at standard positions');
      const pts = new Set(s0.motes.map((m) => m.pos.join()));
      const onRing = s0.motes.every((m) => near(Math.hypot(m.pos[0], m.pos[2]), 12) || near(Math.hypot(m.pos[0], m.pos[2]), 33));
      ok(s0.motes_active === 20 && pts.size === 20 && onRing, 'twenty distinct points on r=12 / r=33');
      ok(s0.shades.length === 0 && s0.time_left_s === 300 && s0.player.flames === 3 && s0.state === 'playing', 'no shades, 300 s, 3 flames');
    },
  },
  {
    name: 'default-level-night3',
    req: 'P2-2',
    what: 'Default Night 3: 7 lanterns (L1 on the tier-2 disk at Y=6), 2 charms, 360 s, wind enabled',
    seed: 7, night: 3, ticks: 1, every: 1,
    check: (r, ok) => {
      const s0 = r.snap(0);
      ok(s0.lanterns.length === 7 && JSON.stringify(s0.lanterns[0].pos) === '[0,6,6]', 'seven lanterns, L1 (0,6,6)');
      ok(s0.charms.length === 2 && s0.time_left_s === 360 && s0.night === 3, 'two charms, 360 s');
      ok(s0.motes.every((m) => [0, 3, 6].includes(m.pos[1])), 'fireflies sit on tiers 0/3/6');
    },
  },
  {
    name: 'shade-spawn-schedule-n1',
    req: 'P2-2',
    what: 'Night 1: 2 shades at tick 300 (state spawning), then 1 every 480 ticks, max 6; spawn points >= 15 m from the player',
    seed: 7, ticks: 3000, every: 10,
    scenario: { lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] },
    check: (r, ok) => {
      const sp = r.events('shade_spawned').map((e) => `${e.tick}:${e.data.id}`);
      ok(sp.join() === '300:S1,300:S2,780:S3,1260:S4,1740:S5,2220:S6', `spawns (got ${sp.join()})`);
      ok(r.snap(300).shades.every((s) => s.state === 'spawning' && near(Math.hypot(s.pos[0], s.pos[2]), 37)), 'spawning on the r=37 ring');
      ok(r.snap(360).shades.every((s) => s.state === 'wander'), 'wander after 60 ticks of spawning');
    },
  },
  {
    name: 'shade-spawn-schedule-n3',
    req: 'P2-2',
    what: 'Night 3: every 360 ticks after the first two at 300, max 10',
    seed: 7, night: 3, ticks: 3500, every: 100,
    scenario: { player: { pos: [-20, 0, -35] }, lanterns: [{ id: 'L7', lit: true }] },
    check: (r, ok) => {
      const sp = r.events('shade_spawned').map((e) => e.tick);
      ok(sp.join() === '300,300,660,1020,1380,1740,2100,2460,2820,3180', `spawn ticks (got ${sp.join()})`);
    },
  },
  {
    name: 'mote-spawn-schedule',
    req: 'P2-1',
    what: 'One more firefly every 240 ticks on a free point; Night 1 has only 24 points so it stops at 24',
    seed: 7, ticks: 1300, every: 10,
    scenario: { random_shades: false },
    check: (r, ok) => {
      const c = (t) => r.snaps.find((s) => s.tick >= t).motes_active;
      ok(c(0) === 20 && c(230) === 20 && c(240) === 21 && c(480) === 22 && c(960) === 24 && c(1200) === 24, `20,21,22,..24 (got ${[0, 240, 480, 960, 1200].map(c)})`);
      ok(new Set(r.snap(1200).motes.map((m) => m.pos.join())).size === 24, 'all on distinct points');
    },
  },
  {
    name: 'fall-off-island',
    req: 'P2-3',
    what: 'Walking off the 40 m island: fall, at Y < -10 lose 1 flame and all fireflies once; respawn at start after 60 ticks, invulnerable',
    seed: 1, ticks: 160, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [38.05, 0, 0], carried: 4 } },
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (r, ok) => {
      const h = r.events('player_hit');
      ok(h.length === 1 && h[0].tick === 80 && h[0].data.by === 'fall' && h[0].data.flames === 2 && h[0].data.lost === 4, `one fall hit at tick 80 (got ${JSON.stringify(h)})`);
      ok(r.snap(80).player.carried === 0 && r.snap(80).player.pos[1] < -10, 'carried 0 below -10');
      ok(JSON.stringify(r.snap(139).player.pos) === JSON.stringify(r.snap(81).player.pos), 'frozen while waiting');
      ok(JSON.stringify(r.snap(140).player.pos) === '[0,0,0]' && r.snap(140).player.invuln === true, `respawn at (0,0,0), invulnerable (got ${JSON.stringify(r.snap(140).player)})`);
    },
  },
  {
    name: 'fall-last-flame',
    req: 'P2-3',
    what: 'Falling with the last flame: lost/no_flames immediately, no respawn',
    seed: 1, ticks: 300, every: 10,
    scenario: { ...NO_RANDOM, player: { pos: [38.05, 0, 0], flames: 1 } },
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (r, ok) => {
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 80 && g[0].data.reason === 'no_flames', `lost at the fall tick (got ${JSON.stringify(g)})`);
    },
  },
  {
    name: 'dash',
    req: 'P2-3',
    what: 'Dash 14 m/s for 12 ticks (2.8 m) along facing when idle; cooldown 90 ticks from the start (press at 30 ignored, 90 accepted)',
    seed: 1, ticks: 110, every: 1,
    scenario: NO_RANDOM,
    inputs: { frames: [...press(0, 'dash'), ...press(30, 'dash'), { tick: 90, dash: true, move: [1, 0] }, { tick: 91, dash: false, move: [0, 0] }] },
    check: (r, ok) => {
      ok(r.events('dash').map((e) => e.tick).join() === '1,91', `dash at 1 and 91 (got ${r.events('dash').map((e) => e.tick)})`);
      ok(near(r.snap(12).player.pos[2], 2.8) && near(r.snap(20).player.pos[2], 2.8), `idle dash along +Z: 2.8 m (got ${r.snap(12).player.pos})`);
      ok(r.snap(1).player.dash_cd_s === 1.5 && R1(r.snap(1).player.vel[2]) === 14, `cd 1.5 s, vel 14 (got ${JSON.stringify(r.snap(1).player)})`);
      ok(near(r.snap(102).player.pos[0], 2.8), `second dash along the move direction +X (got ${r.snap(102).player.pos})`);
    },
  },
  {
    name: 'dash-in-air-keeps-height',
    req: 'P2-3',
    what: 'Dashing in the air holds altitude for the 12 dash ticks, then gravity resumes',
    seed: 1, ticks: 60, every: 1,
    scenario: NO_RANDOM,
    inputs: { frames: [...press(0, 'jump'), ...press(10, 'dash')] },
    check: (r, ok) => {
      const y = (t) => r.snap(t).player.pos[1];
      ok(y(10) > 0.5 && y(11) === y(10) && y(22) === y(10), `y held at ${y(10)} (got ${y(11)}, ${y(22)})`);
      ok(y(23) < y(22), 'falls again after the dash');
    },
  },
  {
    name: 'charm-wind',
    req: 'P2-3',
    what: 'Night 2 Wind Charm C1 at (35,0,0): speed 7.2 m/s for 600 ticks, dash without cooldown, respawns after 2700 ticks',
    seed: 1, night: 2, ticks: 40, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [34, 0, 0] } },
    inputs: { frames: [{ tick: 0, move: [1, 0] }, ...press(10, 'dash'), ...press(30, 'dash')] },
    check: (r, ok) => {
      const c = r.events('charm_picked');
      ok(c.length === 1 && c[0].tick === 1 && c[0].data.charm_id === 'C1' && c[0].data.charm_ticks === 600, `picked at tick 1 (got ${JSON.stringify(c)})`);
      ok(near(r.snap(9).player.pos[0], 34.1 + 8 * 0.12), `7.2 m/s after pickup (got ${r.snap(9).player.pos[0]})`);
      ok(r.snap(1).player.charm_s === 10 && JSON.stringify(r.snap(1).charms) === '[{"id":"C1","available":false,"respawn_s":45}]', `charm_s 10, respawn 45 s (got ${JSON.stringify(r.snap(1).charms)})`);
      ok(r.events('dash').map((e) => e.tick).join() === '11,31' && r.snap(31).player.dash_cd_s === 0, 'two dashes 20 ticks apart, no cooldown');
    },
  },
  {
    name: 'drifter-steal-flee',
    req: 'P2-4',
    what: 'Gió Lạc chases a player carrying >= 5 within 15 m at 7 m/s, steals min(3, carried) at <= 1.2 m, flees 240 ticks and vanishes',
    seed: 1, night: 2, ticks: 300, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 5 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0] }] },
    check: (r, ok) => {
      const s = r.events('drifter_steal');
      ok(s.length === 1 && s[0].tick === 16 && s[0].data.drifter_id === 'D1' && s[0].data.amount === 3 && s[0].data.carried === 2, `steal 3 at tick 16 (got ${JSON.stringify(s)})`);
      const d = (t) => r.snap(t).drifters.find((x) => x.id === 'D1');
      ok(d(5).state === 'chase' && d(16).state === 'flee' && d(16).stolen === 3, 'chase -> flee, stolen 3');
      ok(d(255) && !d(256), 'removed 240 ticks after the steal');
      ok(r.events('player_hit').length === 0 && r.snap(300).player.flames === 3, 'no flame lost');
    },
  },
  {
    name: 'drifter-idle-below-5',
    req: 'P2-4',
    what: 'Carrying 4 (< 5): the drifter stays idle and never steals',
    seed: 1, night: 2, ticks: 120, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 4 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0] }] },
    check: (r, ok) => {
      ok(r.events('drifter_steal').length === 0 && r.snaps.every((s) => s.drifters[0].state === 'idle'), 'idle, no steal');
    },
  },
  {
    name: 'drifter-pulse',
    req: 'P2-4',
    what: 'Pulse on a chasing drifter: flee without stealing. Pulse on a fleeing drifter with loot: drops it all (drifter_drop), vanishes 120 ticks later',
    seed: 1, night: 2, ticks: 300, every: 1,
    scenario: {
      ...NO_RANDOM,
      player: { carried: 8 },
      drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'chase' }, { id: 'D2', pos: [-2, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }],
    },
    inputs: { frames: press(0, 'pulse') },
    check: (r, ok) => {
      const dr = r.events('drifter_drop');
      ok(dr.length === 1 && dr[0].tick === 1 && dr[0].data.drifter_id === 'D2' && dr[0].data.amount === 3, `D2 drops 3 (got ${JSON.stringify(dr)})`);
      ok(r.snap(1).motes.filter((m) => m.kind === 'dropped').length === 3, 'three dropped fireflies');
      const d = (t, id) => r.snap(t).drifters.find((x) => x.id === id);
      ok(d(1, 'D1').state === 'flee' && d(1, 'D1').stolen === 0 && r.events('drifter_steal').length === 0, 'D1 flees without stealing');
      ok(d(120, 'D2') && !d(121, 'D2'), 'D2 vanishes 120 ticks after dropping');
      ok(d(240, 'D1') && !d(241, 'D1'), 'D1 vanishes after its 240-tick flee');
    },
  },
  {
    name: 'drifter-spawn-schedule',
    req: 'P2-4',
    what: 'Night 2: drifters D1 at tick 1200 and D2 at 2400; max 2 alive so none at 3600',
    seed: 3, night: 2, ticks: 3700, every: 100,
    scenario: { random_shades: false },
    check: (r, ok) => {
      const n = (t) => r.snap(t).drifters.length;
      ok(n(1100) === 0 && n(1200) === 1 && n(2300) === 1 && n(2400) === 2 && n(3600) === 2, `0,1,1,2,2 (got ${[1100, 1200, 2300, 2400, 3600].map(n)})`);
      ok(r.snap(2400).drifters.map((d) => d.id).join() === 'D1,D2', 'ids D1, D2');
    },
  },
  {
    name: 'pause',
    req: 'P2-5',
    what: 'pause edge: tick keeps counting but sim_tick, time and movement freeze; snapshot state "paused"; resume continues',
    seed: 1, ticks: 40, every: 1,
    scenario: NO_RANDOM,
    inputs: { frames: [{ tick: 0, move: [0, 1] }, ...press(10, 'pause'), ...press(30, 'pause')] },
    check: (r, ok) => {
      ok(r.events('paused').map((e) => e.tick).join() === '11' && r.events('resumed').map((e) => e.tick).join() === '31', 'paused at 11, resumed at 31');
      ok(r.snap(20).state === 'paused' && r.snap(20).sim_tick === 10 && r.snap(30).sim_tick === 10, 'sim_tick frozen at 10');
      ok(near(r.snap(30).player.pos[2], 1) && r.snap(30).time_left_s === r.snap(10).time_left_s, 'no movement, time frozen');
      ok(r.snap(40).state === 'playing' && r.snap(40).sim_tick === 20 && near(r.snap(40).player.pos[2], 2), `resumed (got ${r.snap(40).sim_tick})`);
    },
  },
  {
    name: 'jump-pad-night2',
    req: 'P2-2',
    what: 'Night 2 pad at (20,0,18): launched with vy 14 and 24 m/s towards island B, ~1.4 s flight, lands on B',
    seed: 1, night: 2, ticks: 120, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [20, 0, 17.5] } },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (r, ok) => {
      const peak = Math.max(...r.snaps.map((s) => s.player.pos[1]));
      ok(peak > 4.5 && peak < 5, `peak ~4.9 m (got ${peak})`);
      const land = r.snaps.find((s) => s.tick > 5 && s.player.grounded);
      ok(land && land.tick >= 80 && land.tick <= 90, `lands after ~84 ticks (got ${land && land.tick})`);
      ok(land && dXZ(land.player.pos, [70, 0, 0]) <= 28, `on island B (got ${land && land.player.pos})`);
      ok(r.events('player_hit').length === 0, 'no fall');
    },
  },
  {
    name: 'night2-bridge',
    req: 'P2-2',
    what: 'Night 2 bamboo bridge x in [26,44], |z| <= 2: walking along z=0 crosses; walking at z=3 falls into the sea',
    seed: 1, night: 2, ticks: 400, every: 10,
    scenario: { ...NO_RANDOM, charms: [], player: { pos: [20, 0, 0] } },
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (r, ok) => {
      ok(r.events('player_hit').length === 0 && near(r.snap(400).player.pos[0], 60) && r.snap(400).player.pos[1] === 0, `crossed to x=60 (got ${r.snap(400).player.pos})`);
    },
  },
  {
    name: 'night3-tiers-ramp',
    req: 'P2-2',
    what: 'Night 3: walk up the 30 deg ramp (Y 0 -> 3), across tier 1, off its inner edge (fall to Y 0), then blocked by the tier-2 wall',
    seed: 1, night: 3, ticks: 400, every: 10,
    scenario: { ...NO_RANDOM, player: { pos: [25.981, 0, 15] } },
    inputs: { frames: [{ tick: 0, move: [-0.866025, -0.5] }] },
    check: (r, ok) => {
      const P = (t) => r.snap(t).player;
      const rad = (t) => Math.hypot(P(t).pos[0], P(t).pos[2]);
      ok(near(P(30).pos[1], 1.5, 0.01) && near(rad(30), 27, 0.01), `mid-ramp Y 1.5 at r 27 (got ${P(30).pos})`);
      ok(P(120).pos[1] === 3 && P(120).grounded, `on tier 1 (got ${P(120).pos})`);
      ok(P(300).pos[1] === 0 && P(300).grounded && rad(300) >= 8 - 1e-3 && rad(300) < 8.2, `dropped to tier 0, stopped at the r=8 wall (got ${P(300).pos}, r ${rad(300)})`);
      ok(r.events('player_hit').length === 0, 'a 3 m drop is not a fall');
    },
  },
  {
    name: 'night3-wall-blocks',
    req: 'P2-2',
    what: 'Night 3: from tier 0 at r=10 walking +Z into the tier-1 wall (r=12) is blocked',
    seed: 1, night: 3, ticks: 120, every: 10,
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 10] } },
    inputs: { frames: [{ tick: 0, move: [0, 1] }] },
    check: (r, ok) => {
      const p = r.snap(120).player.pos;
      ok(p[2] <= 12 && p[2] > 11.8 && p[1] === 0, `stopped at z<=12 (wall) (got ${p})`);
    },
  },
  {
    name: 'night3-pad-to-tier2',
    req: 'P2-2',
    what: 'Night 3 pad at (0,3,13): vy 12 + 8 m/s towards -Z lands Mây on the tier-2 disk (Y 6)',
    seed: 1, night: 3, ticks: 100, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [0, 3, 13.5] } },
    check: (r, ok) => {
      const p = r.snap(100).player;
      ok(p.pos[1] === 6 && p.grounded && p.pos[2] > 2 && p.pos[2] < 8, `on tier 2 (got ${JSON.stringify(p)})`);
    },
  },
  {
    name: 'night3-wind',
    req: 'P2-2',
    what: 'Night 3 wind: a 5 s gust every 30 s (sim ticks 1800..2099) pushes Mây 2 m/s: 10 m in total',
    seed: 5, night: 3, ticks: 2110, every: 1,
    scenario: { ...NO_RANDOM, wind_enabled: true },
    check: (r, ok) => {
      ok(r.snap(1799).wind.active === false && r.snap(1800).wind.active === true && r.snap(2099).wind.active === true && r.snap(2100).wind.active === false, 'active on 1800..2099');
      const moved = dXZ(r.snap(2099).player.pos, r.snap(1799).player.pos);
      ok(near(moved, 10, 0.01), `pushed 10 m (got ${moved})`);
      const a = (r.snap(1800).wind.dir_deg * Math.PI) / 180;
      const dx = r.snap(2099).player.pos[0] - r.snap(1799).player.pos[0];
      ok(near(dx, 10 * Math.cos(a), 0.01), 'along dir_deg (angle from +X towards +Z)');
    },
  },
];
