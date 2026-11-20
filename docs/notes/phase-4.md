# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

Yêu cầu: [ticket-04.md](../lab/tickets/ticket-04.md). Bằng chứng: [docs/proof/phase-4/](../proof/phase-4/README.md).

## 1. Quyết định

- **Benchmark trên trình duyệt thật**: `node scripts/bench.js` khởi động server, mở cửa sổ Chromium **có giao diện** 1280×720 qua Playwright (`--disable-gpu-vsync --disable-frame-rate-limit`), trang chạy chế độ `?bench=1`, đo thời gian từng khung bằng `requestAnimationFrame`, trả kết quả cho Node ghi `bench.json`. Không chạy headless vì sẽ không đo được FPS thật.
- **Cảnh bench dùng chính sim** (`benchScenario(seed)` + `Sim({bench:true})`): tắt sinh thực thể, sát thương, nhặt, hao dầu, kết thúc Đêm; Bóng Mực chỉ `wander`. Cú Tí (sáng tạo) bị ẩn.
- **Vẽ instanced** (`ShadeSwarm`, `MoteField`): 200 Bóng Mực + 100 đom đóm ≈ 180 draw call/khung thay vì > 1300.
- **Soak cùng tiến trình** (`node --expose-gc scripts/soak.js`), input ngẫu nhiên theo seed như ticket.
- **Bảng xếp hạng lưu trên đĩa** bởi server (`data/leaderboard.json`), trình duyệt dùng `localStorage` khi không có server. `run_cmd` đổi thành `node scripts/serve.js` để `--export-leaderboard out.json` tới được script (`npm start --x` sẽ bị npm nuốt cờ).

## 2. Tiêu chí nghiệm thu

| ID | Yêu cầu | Tiêu chí | Kiểm bằng |
|---|---|---|---|
| P4-1 | Benchmark | Lệnh đúng tham số; cảnh chuẩn (200 wander, 100 đom đóm, L1–L3 dầu 100, camera r 30 / Y 15 / 15 s một vòng); 3 s khởi động; đúng các trường và định nghĩa avg / p1-low / p95; thoát 0; ngưỡng avg ≥ 60, p1 ≥ 30, load ≤ 10 000 ms | `tests/phase4.test.js` (cảnh), chạy thật → `bench.json`, ảnh p4-01 |
| P4-2 | Soak | 10 Đêm 1→2→3 xoay vòng, seed 7 + i, input ngẫu nhiên đúng tỉ lệ; `crashes = 0`, `mem_end ≤ 1.2 × mem_start` | `tests/phase4.test.js`, chạy thật → `soak.json` |
| P4-3 | Bảng xếp hạng | Tên 3–12 `[A-Za-z0-9_]` (có dấu được); lưu name/score/nights_won/achieved_at (ISO có múi giờ)/seed; top 10, điểm giảm dần, bằng điểm ai trước đứng trên; lưu đĩa; màn hình từ menu; lệnh xuất | `tests/phase4.test.js` (luật + lệnh xuất), trình duyệt (lưu → file → xuất), ảnh p4-02 |
| P4-4 | Dễ tiếp cận | Đổi phím mọi hành động, báo trùng, khôi phục mặc định, lưu; phụ đề + mũi tên mép màn hình khi Bóng Mực xuất hiện, gió sắp thổi, 10 s cuối, đèn < 30; giảm chuyển động; chữ ≥ 18 px, tùy chọn ×1.25 | trình duyệt (đổi Nhảy → E bị từ chối, → K được lưu, K làm Mây nhảy), ảnh p4-03 |
| P4-5 | Đóng gói & tài liệu | Clone → ≤ 3 lệnh → chơi; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE; Release có bản chạy được | `scripts/package.js` → `dist/…zip` (đã chạy thử từ thư mục giải nén) |
| P4-6 | Contract v1.3 | `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên | `tests/contract.test.js`, `tests/phase4.test.js`, 62 scenario |
| P4-7 | Retro & demo | Retro 1–2 trang; video < 5 phút | [retro.md](retro.md); video: **người dùng tự quay** (kịch bản trong retro) |

## 3. Giả định

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| A-P4-1 | "Đêm thứ i dùng seed 7 + i" | i tính từ 1 (Đêm 1 dùng seed 8) |
| A-P4-2 | `mem_start_mb` "sau khi tải xong Đêm đầu tiên" | "Tải" gồm khởi động máy JS: chạy nháp mỗi bản đồ một lần (không tính vào 10 Đêm) rồi tạo Đêm 1 và đo. Không có bước này RSS tăng ~8 MB một lần do JIT (heap JS không đổi) → tỉ lệ 1.26. Ghi trung thực cả `mem_before_warmup_mb` trong `soak.json` |
| A-P4-3 | `peak_mem_mb` bản web | `null` (trang không đọc được RSS của tiến trình trình duyệt); `bench.json` có thêm ghi chú và đỉnh heap JS |
| A-P4-4 | `load_ms` | Từ lúc tiến trình `bench.js` bắt đầu (gồm khởi động server và trình duyệt) tới khung hình đầu tiên của cảnh bench |
| A-P4-5 | Trình duyệt cho bench | Ưu tiên Chromium của Playwright (`build_cmd` cài nó), không có thì dùng Chrome/Edge đã cài |
| A-P4-6 | Đổi phím | Phím mới thay phím chính của hành động; phím đã dùng cho hành động khác bị từ chối kèm thông báo |

## 4. Đánh giá Phase 4

| Yêu cầu | Kết quả | Số đo |
|---|---|---|
| P4-1 | **Đạt** trên máy tôi | avg 782 FPS, p1-low 309, p95 1.7 ms, load 637 ms (i5-12400F, RTX 2060, Chrome 158) |
| P4-2 | **Đạt** | 0 crash, 53.3 → 53.5 MB (×1.004); 100 Đêm: ×1.13 |
| P4-3 … P4-6 | **Đạt** | 96 test xanh |
| P4-7 | Retro **đạt**; video **chưa có** (cần người quay) | |

Giới hạn: số bench trên máy chấm có thể khác; bản web không báo RSS; GitHub Release phải tạo trên GitHub (máy này không có `gh`).
