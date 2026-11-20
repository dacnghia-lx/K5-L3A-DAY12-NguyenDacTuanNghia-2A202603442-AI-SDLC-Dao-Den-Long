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

## phase-3 — Ticket-03 "Đèn cạn dầu" (Change Request) + Test Contract v1.2

### Breaking changes
- **Win rule:** the night no longer ends when every lantern is lit. It is won only at dawn, alive, with at least `ceil(0.6 × lanterns)` lit (3/5, 4/6, 5/7). `game_over.reason`: `dawn_survived` (win), `dawn`, `no_flames`; **`all_lit` is gone**.
- **Lanterns burn fuel** (100, −1/s) and go out at 0 (`deposited` back to 0); relighting costs 5. Lit lanterns with fuel < 30 lose their 6 m safe zone.
- **Night durations** 300/330/360 s → **240/270/300 s**.
- **Score:** +5 per firefly put in a lantern (was +10), +40 per relight, pulse on a draining shade +15; at dawn +50 + floor(fuel) per lit lantern and +50 per flame; **time bonus removed** (`per_second_left` = 0).
- **Carry capacity** is no longer fixed: 10 + 2 per successful lighting this night, max 20.
- **Contract v1.2:** new tuning keys (`fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`); snapshot lantern `fuel`, `ever_lit`, `relit_count`; player `capacity`; shade state `drain`; scenario lantern `fuel`/`ever_lit`, player `successful_lights`, shade `target_lantern_id`; events `refuel`, `lantern_out`, `fuel_drain`; `lantern_lit` gains `relight`.

### Added
- Ink Shades in `wander` go to the nearest weak lantern and drain it (new state `drain`); refuelling a weak lantern to ≥ 30 pushes them out.
- Web: fuel bar over each lit lantern, 1 Hz blink under 30, drain visuals, "Bảng màu dễ phân biệt" colour-blind setting (saved), HUD carried/capacity and "lit (needed)", new result breakdown.
- Design record: `docs/adr/0001-lantern-fuel-and-dawn-win.md`.

## phase-4 / v1.0.0 — Ticket-04 "Bình minh" + Test Contract v1.3
- **Benchmark** `node scripts/bench.js --seed 42 --duration 30 --out bench.json`: real 1280×720 Chromium window (vsync off), standard scene, circling camera, `bench.json` (avg/1%-low FPS, p95, load).
- **Soak** `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json`: 10 nights in one process with seeded random input.
- **Local leaderboard**: save after Dawn or a loss, top 10 on disk (`data/leaderboard.json`), menu screen, `node scripts/serve.js --export-leaderboard out.json`.
- **Accessibility**: rebind every action (duplicates refused, restore defaults, saved), subtitles + edge arrows (new shade, wind, last 10 s, low fuel), reduced motion, UI text ≥ 18 px and ×1.25 option.
- **Performance**: shades and fireflies are instanced (≈ 180 draw calls with 200 shades).
- **Contract v1.3**: `bench_cmd`, `soak_cmd`; **`run_cmd` is now `node scripts/serve.js`** (so CLI flags reach the script); `build_cmd` also installs Playwright's Chromium.
- Release build: `node scripts/package.js` → `dist/dao-den-long-v1.0.0.zip` (needs only Node ≥ 18).
