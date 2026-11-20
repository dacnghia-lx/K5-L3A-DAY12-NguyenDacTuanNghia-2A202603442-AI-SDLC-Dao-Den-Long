# Bằng chứng Phase 1 (tag `phase-1`)

Tái lập: `npm install && npm test` (toàn bộ) · `npm run proof` (sinh lại [headless-report.md](headless-report.md) và thư mục `scenarios/`, `playthrough/`).
Các file trong `scenarios/`, `playthrough/` và `headless-report.md` do script sinh ra, không sửa tay.

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R1 | Đêm 1, đảo tròn, 5 đèn | scenario `default-level` | [headless-report §1](headless-report.md) | Đạt |
| R2 | Đi, nhảy, camera 3D | scenario `jump`, `camera-yaw-and-normalize`, `island-edge-no-fall`; trình duyệt: W→+Z, D→phải màn hình, yaw 90°+W→+X | report §1, ảnh [p1-02](screens/p1-02-pulse-stun.jpg) | Đạt |
| R3 | Đom đóm, nhặt được | `pickup-walk` (tick 35 đúng tính toán), `carry-capacity` | report §1 | Đạt |
| R4 | Nạp ánh sáng thắp đèn | `deposit-light`, `deposit-partial-and-hold`, `interact-out-of-range` | report §1 | Đạt |
| R5 | Bóng Mực đuổi, chạm mất máu, sợ đèn | `shade-hit-invuln-lose`, `safe-radius`, `shade-spawning`, `pulse-stun-push` (tốc độ 3.5 m/s) | report §1 | Đạt |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | `pulse-stun-push`, `pulse-cooldown-cost` | report §1, ảnh [p1-02](screens/p1-02-pulse-stun.jpg) | Đạt |
| R7 | Thắng / thua / điểm | `win-all-lit` (848 điểm tính tay), `shade-hit-invuln-lose`, `dawn-lose`; 5 ván chơi trọn thắng | report §1, §3 | Đạt |
| R8 | HUD | Kiểm bằng mắt khi chơi | [p1-03](screens/p1-03-three-lanterns-lit-hud.jpg) | Đạt |
| R9 | Chơi lại | Bấm R sau khi thắng: `mode=playing, steps=0, score=0`; màn thắng/thua có bảng điểm (tổng khớp `sim.score`) | [p1-04](screens/p1-04-win-screen.jpg), [p1-05](screens/p1-05-lose-screen.jpg) | Đạt |
| R10 | Phong cách: ánh cam tốt, tím đen nguy hiểm, đảo sáng dần, nón lá có đèn | Kiểm bằng mắt | [p1-01](screens/p1-01-start-menu.jpg), [p1-03](screens/p1-03-three-lanterns-lit-hud.jpg) | Đạt (đánh giá chủ quan) |
| C-A | `game.contract.json` đủ trường, tuning = số game dùng | `tests/contract.test.js` | `npm test` | Đạt |
| C-B | CLI, tick model, exit code | `tick-model`, `tests/cli.test.js` (9 file hỏng → exit 2; tham số sai → ≠0) | `npm test` | Đạt |
| C-C | Inputs: giữ giá trị, cạnh nút, xoay yaw, chuẩn hóa | `camera-yaw-and-normalize`, `deposit-partial-and-hold`, `pulse-cooldown-cost` | report §1 | Đạt |
| C-D | Scenario: thay/ cập nhật, không event khi dựng | `scenario-build-silent`, `win-all-lit` | report §1 | Đạt |
| C-E | Output JSONL, làm tròn, tất định | `tests/cli.test.js` (định dạng), double-run so byte | report §2 | Đạt |
| — | Hiệu năng headless | 18000 tick (cả đêm), đo 3 lần | report §4 | ~50 ms mỗi lần (i5-12400F, gồm khởi động Node) |

## Ảnh chụp (trình duyệt trong app, seed 1)

| Ảnh | Cho thấy |
|---|---|
| [p1-01-start-menu.jpg](screens/p1-01-start-menu.jpg) | Màn mở đầu, hướng dẫn điều khiển |
| [p1-02-pulse-stun.jpg](screens/p1-02-pulse-stun.jpg) | Vòng tỏa sáng, Bóng Mực bị choáng (nhạt, mắt vàng), đom đóm bay quanh nón lá, Cú Tí |
| [p1-03-three-lanterns-lit-hud.jpg](screens/p1-03-three-lanterns-lit-hud.jpg) | 3/5 đèn sáng, vòng an toàn, đảo sáng hơn, HUD đầy đủ |
| [p1-04-win-screen.jpg](screens/p1-04-win-screen.jpg) | Thắng: bảng điểm 280+500+80+506+150 = 1516 |
| [p1-05-lose-screen.jpg](screens/p1-05-lose-screen.jpg) | Thua `no_flames` khi đứng yên |

p1-01 chụp trước khi chỉnh bụi cây/ánh sáng nền; p1-03, p1-04 chụp trước khi sửa lỗi toast còn sót khi chơi lại. Cả hai là sửa thuần hiển thị, luật chơi không đổi.
