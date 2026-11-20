# AGENTS.md — Đảo Đèn Lồng

Node ≥18, plain ES modules, no bundler. Three.js only in the browser.

## Commands
- Install: `npm install`
- Tests (unit + headless scenarios + determinism): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json]`
- Regenerate evidence: `npm run proof` (writes `docs/proof/phase-N/`)
- Play: `npm start` → http://localhost:8080

## Layout
- `src/sim/` — pure game logic, the ONLY source of gameplay rules. No DOM, no Math.random, no Date.
- `src/headless.js` — Test Contract CLI. `src/web/` — rendering + input only; it drives `Sim`, never re-implements rules.
- `game.contract.json` tuning MUST equal `src/sim/tuning.js` (a test enforces this).
- Requirements/spec for each phase: `docs/notes/phase-N.md`. Lab rules: `docs/lab/`.

## Rules
- Contract output format is exact: read `docs/notes/contract-v1.md` before touching `src/headless.js` or `src/sim/`.
- Randomness only via the seeded RNG in `src/sim/rng.js`. Same seed+scenario+inputs ⇒ byte-identical JSONL.
- Creative/cosmetic extras live in `src/web/` only — they must not change headless output.
- Never hand-edit files in `docs/proof/`; regenerate with `npm run proof`.
- A test that a new ticket invalidates: change or delete it with a reason in `docs/notes/phase-N.md`, never `skip` silently.
- Keep commits small, one concern each. Run `npm test` before every commit (the Stop hook also runs it).
