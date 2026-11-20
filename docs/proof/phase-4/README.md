# Bằng chứng Phase 4 (tag `phase-4`, Release `v1.0.0`, Contract v1.3)

Tái lập: `npm install && npx playwright install chromium` · `npm test` (96 test) · `npm run bench` · `npm run soak` · `npm run proof`.
Tiêu chí nghiệm thu: [docs/notes/phase-4.md](../../notes/phase-4.md).

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| P4-1 | Benchmark | `node scripts/bench.js --seed 42 --duration 30 --out bench.json` (cửa sổ Chrome 1280×720, vsync tắt) | [bench.json](bench.json): avg **782 FPS**, p1-low **309**, p95 1.7 ms, 23 461 khung, load **637 ms**; ảnh [p4-01](screens/p4-01-bench-scene.png) | Đạt (máy tôi) |
| P4-1 | Cảnh bench đúng chuẩn | `tests/phase4.test.js`: 200 Bóng Mực luôn `wander`, 100 đom đóm, L1–L3 dầu 100 không hao, không event, Mây ở gốc, cùng bố cục với seed 42 | `npm test` | Đạt |
| P4-2 | Soak | `node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json` | [soak.json](soak.json): 0 crash, 53.3 → 53.5 MB (×1.004 ≤ 1.2); RSS trước khởi động máy JS 41.8 MB | Đạt |
| P4-3 | Bảng xếp hạng | Test luật (tên, sắp xếp, hòa điểm, top 10, ISO có múi giờ) + lệnh xuất; trình duyệt: thua → "Lưu điểm" → tên `ab` bị từ chối → `Mây_Đêm1` được lưu vào `data/leaderboard.json` → `node scripts/serve.js --export-leaderboard out.json` cho `{"entries":[…]}` | ảnh [p4-02](screens/p4-02-leaderboard.jpg) | Đạt |
| P4-4 | Đổi phím | Đổi "Nhảy" sang E → báo "Phím E đang dùng cho Nạp / châm dầu"; sang K → lưu `localStorage`, nhấn K làm Mây nhảy (y = 0.86) | ảnh [p4-03](screens/p4-03-settings-rebind.jpg) | Đạt |
| P4-4 | Phụ đề / chỉ báo, giảm chuyển động, cỡ chữ | Kiểm trình duyệt: phụ đề + mũi tên tím khi Bóng Mực xuất hiện; gió; đếm ngược 10 s; "đèn sắp cạn dầu"; `flash()` và rung camera tắt khi bật giảm chuyển động; CSS gốc 18 px, tùy chọn ×1.25 | ảnh p4-01 (HUD) | Đạt (kiểm bằng mắt và mã) |
| P4-5 | Bản chạy được | `node scripts/package.js` → `dist/dao-den-long-v1.0.0.zip` (1.4 MB); chạy `node scripts/serve.js` trong thư mục giải nén → trang và three.js trả 200 | — | Đạt |
| P4-6 | Contract v1.3 | `bench_cmd`, `soak_cmd`; 62 scenario v1.0–v1.2 vẫn xanh | `npm test`, [headless-report.md](headless-report.md) | Đạt |
| P4-7 | Retro / video | [retro.md](../../notes/retro.md) | — | Retro đạt; **video chưa có** |

Giới hạn: số đo bench chỉ là của máy tôi (giảng viên đo trên máy chấm); `peak_mem_mb` là `null` vì bản web không đọc được RSS của trình duyệt (ghi chú trong `bench.json`).
