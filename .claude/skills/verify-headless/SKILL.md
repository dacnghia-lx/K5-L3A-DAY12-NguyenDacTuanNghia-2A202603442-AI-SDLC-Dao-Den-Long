---
name: verify-headless
description: Run and record verification for Đảo Đèn Lồng — headless scenarios (all 3 nights), determinism, bot playthroughs, and in-game screenshots. Use after changing src/sim, src/headless.js, game.contract.json, or before tagging a phase.
---

# Verify the game and save evidence

1. `npm test` — must be green (contract + CLI/exit codes + every scenario in `tests/scenarios.js` + determinism + bot replays).
2. New requirement? Add a scenario to `tests/scenarios.js` FIRST, with numbers derived by hand from
   the ticket (`docs/lab/tickets/`) and the `req` id from `docs/notes/phase-N.md`. Set `night: 2|3` for the
   other maps. Watch it fail, then implement. If a scenario fails, decide whether the CODE or the
   EXPECTATION is wrong and write down why (do not just copy the new output into the test).
3. Commit the code, then `npm run proof` so the report records a clean commit hash. Never edit `docs/proof/` by hand.
4. Visual requirements (HUD, menus, lighting, maps): `npm start`, open http://localhost:8080 at 1280×720.
   If the browser pane is hidden (rAF paused) drive it with `window.__game.startNight(n, seed)`,
   `window.__game.tick(n)`, `window.__game.stepWith(input)`, `window.__game.pause()`.
   `window.__shot(name)` saves the CANVAS only (no HUD/menus) — for HUD/menus take a browser screenshot instead.
5. Update the traceability table in `docs/proof/phase-N/README.md`: requirement → how verified → evidence → PASS / NOT MET (say why).

Ad-hoc run:
```
node src/headless.js --seed 1 --night 2 --scenario s.json --inputs i.json --ticks 600 --out out.jsonl --snapshot-every 10
```
Exit codes: 0 ok, 2 malformed inputs/scenario file, 1 other errors (bad CLI usage, e.g. `--night 4`).
