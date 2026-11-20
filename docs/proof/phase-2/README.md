# Bằng chứng Phase 2 (tag `phase-2`, Contract v1.1)

Tái lập: `npm install && npm test` (73 test) · `npm run proof` (sinh lại [headless-report.md](headless-report.md), `scenarios/`, `playthrough/`).
Các file trong `scenarios/`, `playthrough/` và `headless-report.md` do script sinh ra, không sửa tay. Tiêu chí nghiệm thu: [docs/notes/phase-2.md](../../notes/phase-2.md).

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P2-1 | Số liệu chuẩn Phần 1 | 26 scenario tính tay + test so `game.contract.json` với từng số của ticket | report §1 | Đạt |
| P2-2 | Bản đồ chuẩn 3 Đêm (cầu tre, bục nhảy, 3 tầng, dốc, vách, gió, lịch sinh) | `default-level-*`, `shade-spawn-schedule-*`, `jump-pad-night2`, `night2-bridge`, `night3-*` | report §1, ảnh [p2-02](screens/p2-02-night2-bridge-drifter-charm.jpg), [p2-03](screens/p2-03-night3-ramp-tiers.jpg) | Đạt |
| P2-3 | Lướt, rơi khỏi đảo | `dash`, `dash-in-air-keeps-height`, `fall-off-island`, `fall-last-flame` | report §1 | Đạt |
| P2-4 | Gió Lạc | `drifter-steal-flee`, `drifter-idle-below-5`, `drifter-pulse`, `drifter-spawn-schedule` | report §1, ảnh p2-02 | Đạt |
| P2-5 | Bùa Gió | `charm-wind` | report §1, ảnh p2-02 | Đạt |
| P2-6 | Chuỗi 3 Đêm, màn Bình Minh | Trình duyệt: thắng Đêm 1 → bảng điểm (858 = điểm sim) → nút "Đêm 2" → giới thiệu Đêm 2 có lời Ông Đăng | ảnh [p2-05](screens/p2-05-result-night1.jpg) | Đạt |
| P2-7 | Tạm dừng | Scenario `pause`; trình duyệt: phím Esc → `mode=paused`, số bước sim không đổi sau 0.5 s, menu 4 nút | ảnh [p2-04](screens/p2-04-pause-menu.jpg) | Đạt |
| P2-8 | Cài đặt được lưu | Trình duyệt: kéo âm lượng 0.35, độ nhạy 1.7 → `localStorage['ddl-settings-v1'] = {"volume":0.35,"sens":1.7,"muted":false}` | — | Đạt |
| P2-9 | Âm thanh (nhạc nền + 10 hiệu ứng) | Đọc mã `src/web/audio.js`, `handleEvent()` | — | Đạt (chỉ kiểm bằng mã) |
| P2-10 | HUD đầy đủ | Kiểm bằng mắt ở 1280×720 | ảnh [p2-01](screens/p2-01-night1-hud.jpg), p2-02, p2-03 | Đạt |
| P2-11 | Bảng màu + ánh sáng 0.15 + 0.55 × tỉ lệ | Đọc mã `PAL`, `:root`, `syncEntities()` | ảnh p2-01 (1/5 đèn) | Đạt |
| P2-12 | Contract v1.1 (CLI, snapshot, scenario, input, event, tên trạng thái) | `tests/cli.test.js` (14 file hỏng → exit 2; `--night 4` → ≠0), `snapshot-v1.1-fields`, `tick-model`, `scenario-build-silent` | `npm test` | Đạt |
| P2-13 | Headless 1 Đêm ≤ 30 s | Đêm 3, 21.600 tick, đo 3 lần | report §4: ~1.0–1.1 s (gồm khởi động Node) | Đạt |
| P2-13 | Web ≥ 30 FPS ở 1280×720 | Đêm 3, 240 khung `tick(1)` + `readPixels` để ép GPU đồng bộ | 2.51 ms/khung (Intel i5-12400F) | Đạt (đo chi phí khung, không phải FPS hiển thị — pane bị ẩn) |
| — | Tất định | Chạy 2 lần cùng seed + inputs | report §2: giống từng byte | Đạt |
| — | Chơi trọn | Bot tham lam, phát lại qua CLI | report §3: thắng Đêm 1 seed 3; các ván khác thua | Một phần (xem giới hạn) |

## Ảnh chụp (trình duyệt trong app, 1280×720)

| Ảnh | Cho thấy |
|---|---|
| [p2-01-night1-hud.jpg](screens/p2-01-night1-hud.jpg) | Đêm 1: L1 vừa sáng, vòng an toàn 6 m, HUD (lửa, đồng hồ, đèn 1/5 + điểm 200, thanh 10 ô, hồi chiêu Lướt/Tỏa Sáng), mũi tên chỉ đèn, phụ đề Bóng Mực xuất hiện |
| [p2-02-night2-bridge-drifter-charm.jpg](screens/p2-02-night2-bridge-drifter-charm.jpg) | Đêm 2: cầu tre, đảo B, bục nhảy (xanh), Bùa Gió (đỏ viền vàng), Gió Lạc (dải lụa) đuổi Mây đang mang 7 |
| [p2-03-night3-ramp-tiers.jpg](screens/p2-03-night3-ramp-tiers.jpg) | Đêm 3: dốc 30°, tầng 1 với L2 đang sáng, tầng 2 và tháp chuông |
| [p2-04-pause-menu.jpg](screens/p2-04-pause-menu.jpg) | Menu tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| [p2-05-result-night1.jpg](screens/p2-05-result-night1.jpg) | Kết quả Đêm 1: bảng điểm 10 + 100 + 598 + 150 = 858, nút sang Đêm 2 |

## Giới hạn

- Bot chỉ thắng 1/5 ván Đêm 1 và 0/6 ván Đêm 2–3: game khó với số chuẩn, hoặc bot quá đơn giản; chưa có người chơi thật thử.
- Âm thanh chỉ kiểm bằng đọc mã. FPS thật chưa đo trên màn hình đang hiển thị.
