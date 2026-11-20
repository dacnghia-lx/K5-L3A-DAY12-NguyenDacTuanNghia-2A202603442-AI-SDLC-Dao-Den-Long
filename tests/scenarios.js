// Headless scenarios for Phase 1. Each one is run through the REAL CLI
// (src/headless.js) by tests/scenarios.test.js and by scripts/proof.js.
// `req` links the scenario to a requirement id in docs/notes/phase-1.md.
// Expected numbers are derived by hand from game.contract.json tuning.

const R1 = (v) => Math.round(v * 1000) / 1000;
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

const NO_RANDOM = { random_motes: false, random_shades: false, motes: [], shades: [] };

export const SCENARIOS = [
  {
    name: 'pickup-walk',
    req: 'R3',
    what: 'Walking +Z picks a firefly exactly when XZ distance <= pickup_radius (1.5): (5-1.5)/0.1 = tick 35; +10 score',
    seed: 1, ticks: 60, every: 1,
    scenario: { ...NO_RANDOM, motes: [[0, 0, 5]] },
    inputs: { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }] },
    check: (r, ok) => {
      const e = r.events('mote_picked');
      ok(e.length === 1 && e[0].tick === 35 && e[0].data.carried === 1, `mote_picked once at tick 35 (got ${JSON.stringify(e)})`);
      ok(r.snap(34).motes_active === 1 && r.snap(35).motes_active === 0, 'motes_active 1 -> 0 at tick 35');
      ok(r.snap(35).score === 10, `score 10 after pickup (got ${r.snap(35).score})`);
      ok(R1(r.snap(60).player.pos[2]) === 6, `player at z=6 after 60 ticks at 6 m/s (got ${r.snap(60).player.pos})`);
    },
  },
  {
    name: 'carry-capacity',
    req: 'R3',
    what: '7 fireflies under the player: only carry_capacity (5) are picked, 2 stay',
    seed: 1, ticks: 5, every: 1,
    scenario: { ...NO_RANDOM, motes: Array.from({ length: 7 }, (_, i) => [0.1 * i, 0, 0]) },
    check: (r, ok) => {
      const e = r.events('mote_picked');
      ok(e.length === 5 && e.every((x) => x.tick === 1), `5 pickups at tick 1 (got ${e.length})`);
      ok(r.snap(5).player.carried === 5 && r.snap(5).motes_active === 2, 'carried 5, 2 motes left');
    },
  },
  {
    name: 'deposit-light',
    req: 'R4',
    what: 'Interact within interact_radius deposits carried light; lantern_cost (5) lights it: +100',
    seed: 1, ticks: 3, every: 1,
    scenario: { ...NO_RANDOM, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.5] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const d = r.events('deposit');
      ok(d.length === 1 && d[0].tick === 1 && d[0].data.lantern_id === 'L1' && d[0].data.amount === 5 && d[0].data.deposited === 5, `deposit L1 5/5 at tick 1 (got ${JSON.stringify(d)})`);
      ok(r.events('lantern_lit').length === 1 && r.events('lantern_lit')[0].data.lantern_id === 'L1', 'lantern_lit L1');
      const l1 = r.snap(1).lanterns.find((l) => l.id === 'L1');
      ok(l1.lit === true && l1.deposited === 5 && r.snap(1).player.carried === 0, 'L1 lit, player carried 0');
      ok(r.snap(1).score === 100, `score 100 (got ${r.snap(1).score})`);
    },
  },
  {
    name: 'deposit-partial-and-hold',
    req: 'R4',
    what: 'Partial deposit (3 of 5) keeps lantern unlit; holding interact does not repeat (edge-triggered)',
    seed: 1, ticks: 30, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [1, 0, 0] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const d = r.events('deposit');
      ok(d.length === 1 && d[0].data.amount === 3 && d[0].data.deposited === 3, `one deposit of 3 (got ${JSON.stringify(d)})`);
      ok(r.events('lantern_lit').length === 0, 'not lit');
      ok(r.snap(30).lanterns.find((l) => l.id === 'L1').deposited === 3, 'L1 deposited 3');
    },
  },
  {
    name: 'interact-out-of-range',
    req: 'R4',
    what: 'Lantern at 2.6 m (> interact_radius 2.5): interact does nothing',
    seed: 1, ticks: 5, every: 5,
    scenario: { ...NO_RANDOM, player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.6] }] },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      ok(r.events('deposit').length === 0, 'no deposit');
      ok(r.snap(5).player.carried === 5, 'still carrying 5');
    },
  },
  {
    name: 'win-all-lit',
    req: 'R7',
    what: 'Lighting the last lantern wins: score = 100 + floor(299.983)*2 + 3 flames*50 = 848; pre-lit lanterns give no points',
    seed: 1, ticks: 100, every: 1,
    scenario: {
      ...NO_RANDOM,
      player: { carried: 1, flames: 3 },
      lanterns: [
        { id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true },
        { id: 'L5', pos: [0, 0, 2], deposited: 4 },
      ],
      time_left_s: 300,
    },
    inputs: { frames: [{ tick: 0, interact: true }] },
    check: (r, ok) => {
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 1 && g[0].data.result === 'won' && g[0].data.reason === 'all_lit', `game_over won/all_lit at tick 1 (got ${JSON.stringify(g)})`);
      ok(r.end.type === 'end' && r.end.state === 'won' && r.end.ticks === 1, `end won after 1 tick (got ${JSON.stringify(r.end)})`);
      ok(r.end.score === 848, `score 848 (got ${r.end.score})`);
      ok(r.snap(0).score === 0, 'score 0 at build (pre-lit lanterns not scored)');
    },
  },
  {
    name: 'pulse-stun-push',
    req: 'R6',
    what: 'Pulse costs 1 light, stuns shades within 6 m for 2 s (120 ticks) and pushes them 4 m away; +20 per stun',
    seed: 1, ticks: 125, every: 1,
    scenario: { ...NO_RANDOM, player: { carried: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [20, 1, 0] }] },
    inputs: { frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }] },
    check: (r, ok) => {
      const p = r.events('pulse');
      ok(p.length === 1 && p[0].tick === 1 && JSON.stringify(p[0].data.stunned_ids) === '["S1"]', `pulse stunned [S1] at tick 1 (got ${JSON.stringify(p)})`);
      const s1 = (t) => r.snap(t).shades.find((s) => s.id === 'S1');
      ok(s1(1).state === 'stunned' && s1(1).pos[0] === 7, `S1 pushed to x=7 and stunned (got ${JSON.stringify(s1(1))})`);
      ok(s1(120).state === 'stunned' && s1(120).pos[0] === 7, 'S1 still stunned and still at tick 120');
      ok(s1(121).state !== 'stunned' && s1(121).pos[0] < 7, `S1 chasing again at tick 121 (got ${JSON.stringify(s1(121))})`);
      ok(r.snap(1).player.carried === 1 && r.snap(1).score === 20, 'carried 2 -> 1, score 20');
      const s2 = r.snap(60).shades.find((s) => s.id === 'S2');
      ok(R1(s2.pos[0]) === 16.5, `S2 chases at 3.5 m/s: x=16.5 at tick 60 (got ${s2.pos[0]})`);
    },
  },
  {
    name: 'pulse-cooldown-cost',
    req: 'R6',
    what: 'Pulse cooldown 1 s: press at tick 30 ignored, tick 60 accepted; pulse with 0 light does nothing',
    seed: 1, ticks: 200, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 2 } },
    inputs: {
      frames: [
        { tick: 0, pulse: true }, { tick: 1, pulse: false },
        { tick: 30, pulse: true }, { tick: 31, pulse: false },
        { tick: 60, pulse: true }, { tick: 61, pulse: false },
        { tick: 150, pulse: true }, { tick: 151, pulse: false },
      ],
    },
    check: (r, ok) => {
      const ticks = r.events('pulse').map((e) => e.tick);
      ok(JSON.stringify(ticks) === '[1,61]', `pulses at ticks [1,61] only (got ${JSON.stringify(ticks)})`);
      ok(r.snap(200).player.carried === 0, 'carried 2 -> 0; third press with 0 light ignored');
    },
  },
  {
    name: 'shade-hit-invuln-lose',
    req: 'R5,R7',
    what: 'Shade contact: -1 flame, drop floor(carried*0.5), 1.5 s (90 ticks) invulnerability; 0 flames = lost/no_flames',
    seed: 1, ticks: 400, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 4, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] },
    check: (r, ok) => {
      const h = r.events('player_hit').map((e) => [e.tick, e.data.by, e.data.flames, e.data.dropped]);
      ok(JSON.stringify(h) === JSON.stringify([[1, 'shade', 2, 2], [91, 'shade', 1, 1], [181, 'shade', 0, 0]]), `hits at 1/91/181 (got ${JSON.stringify(h)})`);
      const g = r.events('game_over');
      ok(g.length === 1 && g[0].tick === 181 && g[0].data.result === 'lost' && g[0].data.reason === 'no_flames', `lost/no_flames at 181 (got ${JSON.stringify(g)})`);
      ok(r.end.state === 'lost' && r.end.ticks === 181, `end lost at 181 (got ${JSON.stringify(r.end)})`);
    },
  },
  {
    name: 'dawn-lose',
    req: 'R7',
    what: 'time_left_s=1: game ends at tick 60 with lost/dawn; time_left_s counts down by 1/60 per tick',
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
    req: 'R5',
    what: 'Shades never enter safe_radius (4 m) of a lit lantern; player standing at the lantern is never hit',
    seed: 1, ticks: 900, every: 1,
    scenario: { ...NO_RANDOM, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [12, 1, 0] }, { id: 'S2', pos: [2, 1, 1] }] },
    check: (r, ok) => {
      let min = Infinity;
      for (const s of r.snaps) for (const sh of s.shades) if (s.tick > 0) min = Math.min(min, dXZ(sh.pos, [0, 0, 0]));
      ok(min >= 4 - 1e-3, `min shade distance to lit L1 >= 4 (got ${min.toFixed(4)})`);
      ok(r.events('player_hit').length === 0, 'no hits inside the safe zone');
    },
  },
  {
    name: 'scenario-build-silent',
    req: 'C-D',
    what: 'Building a scenario emits no events and no score (pre-lit L1, carried 3)',
    seed: 1, ticks: 10, every: 10,
    scenario: { ...NO_RANDOM, player: { carried: 3 }, lanterns: [{ id: 'L1', lit: true }] },
    check: (r, ok) => {
      ok(r.events().length === 0, `no events (got ${r.events().length})`);
      ok(r.end.score === 0 && r.snap(0).lanterns[0].lit === true && r.snap(0).lanterns[0].deposited === 5, 'score 0, L1 lit');
    },
  },
  {
    name: 'tick-model',
    req: 'C-B',
    what: '--ticks 7 --snapshot-every 3: snapshots at 0,3,6; end.ticks = 7; sim_tick = tick',
    seed: 1, ticks: 7, every: 3,
    scenario: NO_RANDOM,
    check: (r, ok) => {
      ok(JSON.stringify(r.snaps.map((s) => s.tick)) === '[0,3,6]', `snapshot ticks (got ${r.snaps.map((s) => s.tick)})`);
      ok(r.snaps.every((s) => s.sim_tick === s.tick), 'sim_tick == tick');
      ok(r.end.ticks === 7 && r.end.state === 'playing', `end ticks 7 (got ${JSON.stringify(r.end)})`);
      ok(r.snap(6).time_left_s === 299.9, `time_left 299.9 at tick 6 (got ${r.snap(6).time_left_s})`);
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
    req: 'R2',
    what: 'Jump: Y rises above 0 then lands back on Y=0; XZ unchanged',
    seed: 1, ticks: 60, every: 10,
    scenario: NO_RANDOM,
    inputs: { frames: [{ tick: 0, jump: true }, { tick: 1, jump: false }] },
    check: (r, ok) => {
      ok(r.snap(20).player.pos[1] > 0.5, `airborne at tick 20 (y=${r.snap(20).player.pos[1]})`);
      ok(r.snap(60).player.pos[1] === 0, 'landed by tick 60');
      ok(r.snap(60).player.pos[0] === 0 && r.snap(60).player.pos[2] === 0, 'XZ unchanged');
    },
  },
  {
    name: 'island-edge-no-fall',
    req: 'R2',
    what: 'fall_enabled=false: walking off the 40 m island is blocked by the edge, no fall hit',
    seed: 1, ticks: 120, every: 60,
    scenario: { ...NO_RANDOM, player: { pos: [38, 0, 0] } },
    inputs: { frames: [{ tick: 0, move: [1, 0] }] },
    check: (r, ok) => {
      ok(r.snap(120).player.pos[0] === 40, `clamped at x=40 (got ${r.snap(120).player.pos[0]})`);
      ok(r.events('player_hit').length === 0, 'no fall event');
    },
  },
  {
    name: 'default-level',
    req: 'R1,R3,R5',
    what: 'Default Night 1 (seed 7, no scenario): 5 unlit lanterns, 20 fireflies, 2 shades >= 15 m away, 300 s night',
    seed: 7, ticks: 10, every: 10,
    check: (r, ok) => {
      const s0 = r.snap(0);
      ok(s0.lanterns.length === 5 && s0.lanterns.every((l) => !l.lit), '5 unlit lanterns L1..L5');
      ok(s0.motes_active === 20 && s0.shades.length === 2, `20 motes, 2 shades (got ${s0.motes_active}, ${s0.shades.length})`);
      ok(s0.shades.every((s) => dXZ(s.pos, [0, 0, 0]) >= 15), 'shades spawn >= 15 m from player');
      ok(s0.time_left_s === 300 && s0.player.flames === 3 && s0.state === 'playing', 'time 300, flames 3, playing');
    },
  },
  {
    name: 'shade-spawning',
    req: 'R5',
    what: 'Random shades: a new shade spawns at 20 s (tick 1200) and every 30 s after, max 5 (player hides in a lit lantern zone)',
    seed: 7, ticks: 5000, every: 600,
    scenario: { lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] },
    check: (r, ok) => {
      const sp = r.events('shade_spawned').map((e) => [e.tick, e.data.id]);
      ok(JSON.stringify(sp) === JSON.stringify([[1200, 'S3'], [3000, 'S4'], [4800, 'S5']]), `spawns S3@1200 S4@3000 S5@4800 (got ${JSON.stringify(sp)})`);
      ok(r.events('player_hit').length === 0, 'player safe inside lit lantern zone');
    },
  },
];
