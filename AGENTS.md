# AGENTS.md — Đảo Đèn Lồng

Node ≥18, plain ES modules, no bundler. Three.js only in the browser.

## Commands
- Install: `npm install`
- Tests (unit + headless scenarios + determinism + playthroughs): `npm test`
- Headless: `node src/headless.js --seed 1 --night <1|2|3> --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`
- Bot playthrough: `node scripts/bot.js --seed 3 --night 1 --out inputs.json`
- Regenerate evidence: `npm run proof` (writes `docs/proof/phase-N/` for the phase named in package.json)
- Play: `npm start` → http://localhost:8080

## Layout
- `src/sim/` — pure game logic, the ONLY source of gameplay rules. No DOM, no Math.random, no Date.
  - `tuning.js` contract numbers (`TUNING`) + internal constants (`WORLD`); `levels.js` the 3 standard maps
    (surfaces, lanterns, spawn points, pads, charms); `sim.js` the tick; `io.js` inputs/scenario validation.
- `src/headless.js` — Test Contract CLI. `src/web/` — rendering + input only (`world.js` meshes, `main.js` flow/HUD,
  `audio.js` sound); it drives `Sim`, never re-implements rules.
- `game.contract.json` tuning MUST equal `src/sim/tuning.js` (a test enforces this).
- Tickets: `docs/lab/tickets/ticket-0N.md`. Spec/acceptance criteria/assumptions per phase: `docs/notes/phase-N.md`.

## Rules
- Contract output format is exact: read `docs/notes/contract-v1.md` (v1.0 + v1.1 changes) before touching `src/headless.js` or `src/sim/`.
- Tick order is mandated by Ticket-02 (pause → timers → move/fall → pickup → interact → safe zones → pulse →
  enemies move → contacts → spawns → win/lose). Keep `Sim.step` in that order; comments mark each step.
- Randomness only via the seeded RNG in `src/sim/rng.js`. Same seed+scenario+inputs ⇒ byte-identical JSONL.
- Creative/cosmetic extras live in `src/web/` only — they must not change headless output.
- Never hand-edit files in `docs/proof/`; regenerate with `npm run proof`.
- A test that a new ticket invalidates: change or delete it with a reason in `docs/notes/phase-N.md`, never `skip` silently.
- New feature ⇒ at least one headless scenario in `tests/scenarios.js` with hand-computed numbers, written before the code.
- Keep commits small, one concern each. Run `npm test` before every commit (the Stop hook also runs it).
