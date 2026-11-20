# Test Contract v1.0 — ghi chú triển khai (tóm tắt của tôi)

Nguồn gốc: tab Phase 1 trên lab board. Đây là bản tóm tắt để agent đọc nhanh; khi nghi ngờ, đọc lại lab board.

| Mục | Quy định | Ở đâu trong code |
|---|---|---|
| A. `game.contract.json` | `contract_version`, `team`, `build_cmd`, `run_cmd`, `headless_cmd`, `tuning{…, score{…}}`; số khai phải là số game dùng thật | `game.contract.json` = `src/sim/tuning.js` (test `tests/contract.test.js`) |
| B. CLI | `--seed --night 1 [--scenario] [--inputs] --ticks --out [--snapshot-every=10]`; 60 tick/s; dừng khi đủ tick hoặc hết game; exit 0; file hỏng → exit 2; lỗi khác → ≠0 + stderr | `src/headless.js` |
| Tick model | snapshot 0 = sau dựng scenario, trước input; bước k đọc input k → trạng thái k+1, event ghi tick k+1; `--ticks N` = đúng N bước; `time_left_s = thời lượng − bước/60` | `runHeadless()`, `Sim.step()` |
| Vị trí | player = chân, shade = tâm, lantern = chân cột, đom đóm = điểm trên đất; khoảng cách theo XZ, "trong r" là `≤ r` | `distXZ()` trong `sim.js` |
| C. Inputs | `frames[]`, `tick` tăng nghiêm ngặt; trường vắng giữ giá trị cũ; mặc định move [0,0], yaw 0, nút false; nút kích hoạt cạnh false→true; xoay `x'=x·cosθ+z·sinθ, z'=−x·sinθ+z·cosθ`; vector >1 chuẩn hóa | `io.js parseInputs`, `moveToWorld()` |
| D. Scenario | `player{pos,carried,flames}`, `random_motes`, `random_shades`, `motes`/`shades` thay thế danh sách, `lanterns` cập nhật theo id, `time_left_s`; dựng không phát event, không cộng điểm | `io.js parseScenario`, `Sim` constructor |
| E. Output | snapshot mỗi `--snapshot-every` từ tick 0; event `mote_picked, deposit, lantern_lit, pulse, player_hit, shade_spawned, game_over`; dòng `end` cuối bắt buộc; tọa độ 3 chữ số; tất định kể cả id | `Sim.snapshot()`, `runHeadless()` |
