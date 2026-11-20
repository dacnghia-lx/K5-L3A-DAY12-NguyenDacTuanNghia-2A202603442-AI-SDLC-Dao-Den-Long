# Changelog

## phase-1 — PRD-0 + Test Contract v1.0
- Night 1 "Đảo Bến" playable in the browser (Three.js): move/jump/3D camera, fireflies, 5 lanterns, Ink Shades, light pulse, win/lose, score, HUD, replay.
- Deterministic shared simulation `src/sim/` and headless CLI `src/headless.js` per contract v1.0; `game.contract.json`.
- Tests: contract, CLI/exit codes/format, 18 headless scenarios, determinism, bot playthroughs; CI on Ubuntu + macOS.
- Harness: AGENTS.md, Stop hook (no finishing on red tests), verify-headless skill, contract-reviewer agent.
- Creative extras (render-only): Cú Tí guide owl, orbiting fireflies, island brightening, synthesized audio, pier.

## phase-2 — Ticket-02 "Ba hòn đảo" + Test Contract v1.1
- **Breaking (gameplay numbers):** every tuning value replaced by the Ticket-02 standard values (capacity 10, lantern cost 10, pulse 3 fireflies / 5 m / 3 s, safe radius 6 m, shades 4 m/s, …). Fireflies score when **deposited**, not when picked.
- **Breaking (contract):** `contract_version` 1.1; `--night 1|2|3`; new snapshot fields (`night`, `wind`, player `vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes`, `drifters`, `charms`); shade states `spawning/wander/chase/recoil/stunned`; new inputs `dash`, `pause`; new events.
- Nights 2 (Đảo Cau: two islands, bamboo bridge, jump pads) and 3 (Đảo Chuông: three tiers, ramps, bell tower, wind gusts).
- Dash, falling off the island, dropped fireflies with TTL, safe-zone eviction, Gió Lạc drifters, Bùa Gió charms, pause.
- Web: 3-night campaign (menu → night intro with Ông Đăng → play → result → next night → Dawn), pause and settings menus (saved), full HUD, standard palette, night music and new sounds.
