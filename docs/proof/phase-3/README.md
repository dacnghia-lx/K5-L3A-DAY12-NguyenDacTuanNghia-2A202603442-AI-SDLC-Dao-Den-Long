# Bằng chứng Phase 3 (tag `phase-3`, Contract v1.2)

Tái lập: `npm install && npm test` (90 test) · `npm run proof` (sinh lại [headless-report.md](headless-report.md), `scenarios/`, `playthrough/`).
Tiêu chí nghiệm thu: [docs/notes/phase-3.md](../../notes/phase-3.md) · Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md) · Thay đổi phá vỡ tương thích: [CHANGELOG](../../../CHANGELOG.md#phase-3--ticket-03-đèn-cạn-dầu-change-request--test-contract-v12).

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P3-1 | Nhiên liệu đèn (hao, châm, tắt, thắp lại 5) | `fuel-decay` (100 → 99 → 90), `lantern-out` (tắt ở tick 60), `refuel` (dùng 6, về 100, +30), `refuel-picks-nearest-accepting`, `relight` (65 điểm) | report §1 | Đạt |
| P3-2 | Bóng Mực hút dầu, vùng an toàn cần ≥ 30 | `drain-until-out` (fuel_drain 61/121/181/241, tắt ở 251 — tính tay 1499/6), `drain-two-shades-add-up` (14.0), `safe-zone-needs-30`, `drain-to-chase` (tick 50), `drain-pulse-15`, `refuel-evicts-drainers` | report §1, ảnh [p3-01](screens/p3-01-drain-lowfuel-capacity.jpg) | Đạt |
| P3-3 | Luật thắng lúc bình minh | `dawn-survived` (597 = 3 × 149 + 150), `dawn-below-threshold` (Đêm 2 cần 4), `no-flames-beats-dawn`, `no-early-win`, `dawn-lose` | report §1, ảnh [p3-03](screens/p3-03-dawn-survived-result.jpg) | Đạt |
| P3-4 | Sức chứa 10 + 2/lần thắp, tối đa 20 | `capacity-growth` (16), `capacity-max-20`, `deposit-light` (12) | report §1, ảnh p3-01 (HUD 8/14) | Đạt |
| P3-5 | Điểm mới | các scenario trên + màn kết quả: 150 + 300 + 447 + 150 = 1047 khớp `sim.score` | ảnh p3-03 | Đạt |
| P3-6 | Chế độ mù màu (lưu được) | Bật cài đặt → Bóng Mực #00B3FF, đồng hồ cảnh báo trắng + ⚠, thanh dầu yếu màu trắng; đèn tắt xẹp + giấy rách | ảnh [p3-02](screens/p3-02-colorblind-drain-lowfuel.jpg) so với p3-01 | Đạt (kiểm bằng mắt) |
| P3-7 | Contract v1.2 | `tests/contract.test.js`, `tests/cli.test.js` (16 file hỏng → exit 2, đủ trường snapshot mới), `default-level-night1` | `npm test` | Đạt |
| — | Test Phase 1–2 không bị thay vẫn đạt | 49 scenario cũ còn lại | report §1 | Đạt |
| — | Tất định / hiệu năng | 2 lần chạy giống từng byte; Đêm 3 21.600 tick ~0.9 s | report §2, §4 | Đạt |
| — | Chơi trọn bằng bot | Bot tham lam phát lại qua CLI | report §3: 0/11 ván thắng | Không đạt (xem giới hạn) |

## Ảnh chụp (1280×720)

| Ảnh | Cho thấy |
|---|---|
| [p3-01-drain-lowfuel-capacity.jpg](screens/p3-01-drain-lowfuel-capacity.jpg) | L2 còn 22 dầu: thanh dầu đỏ, đèn nhấp nháy, mất vòng an toàn; Bóng Mực đứng hút dầu; HUD "Đèn 2/5 (cần 3)", sức chứa 8/14, đồng hồ ⚠ đỏ ≤ 30 s |
| [p3-02-colorblind-drain-lowfuel.jpg](screens/p3-02-colorblind-drain-lowfuel.jpg) | Cùng cảnh khi bật "Bảng màu dễ phân biệt": Bóng Mực xanh #00B3FF, cảnh báo trắng + ⚠ |
| [p3-03-dawn-survived-result.jpg](screens/p3-03-dawn-survived-result.jpg) | Thắng `dawn_survived`: bảng điểm mới (không còn thưởng thời gian; 3 đèn × (50 + 99)) |

## Giới hạn

- Bot tham lam không giữ được 3 đèn tới bình minh ở seed nào (Phase 2 thắng được Đêm 1 seed 3). Luật thắng được kiểm bằng scenario chứ không bằng một ván chơi trọn; chưa có người chơi thật.
- Ảnh p3-01..03 dựng trạng thái bằng `window.__game` (đặt đèn/bóng sẵn) để chụp đúng tình huống, không phải chơi tay.
