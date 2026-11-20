---
name: verify-headless
description: Run and record verification for Đảo Đèn Lồng — headless scenarios, determinism, playthroughs, and in-game screenshots. Use after changing src/sim, src/headless.js, game.contract.json, or before tagging a phase.
---

# Verify the game and save evidence

1. `npm test` — must be green (unit + contract + 18 CLI scenarios + determinism + bot playthroughs).
2. New requirement? Add a scenario to `tests/scenarios.js` FIRST, with numbers derived by hand from
   `game.contract.json` and the `req` id from `docs/notes/phase-N.md`. Watch it fail, then implement.
3. Commit the code, then `npm run proof` (or `node scripts/proof.js phase-N`) so the report records a
   clean commit hash. Never edit files under `docs/proof/` by hand.
4. Visual requirements (HUD, lighting, win/lose screens): `npm start`, open http://localhost:8080.
   If the browser pane is hidden (rAF paused) drive it with `window.__game.tick(n)` /
   `window.__game.stepWith(input)`; press **P** or call `window.__shot(name)` to save a canvas PNG to
   `docs/proof/phase-N/screens/`.
5. Update the traceability table in `docs/proof/phase-N/README.md`: requirement → how verified → evidence → PASS / NOT MET (say why).

Ad-hoc run:
```
node src/headless.js --seed 1 --night 1 --scenario s.json --inputs i.json --ticks 600 --out out.jsonl --snapshot-every 10
```
Exit codes: 0 ok, 2 malformed inputs/scenario file, 1 other errors.
