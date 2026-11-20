# Đảo Đèn Lồng

> **Video demo:** _(đính kèm GitHub Release `v1.0.0` — xem mục Phát hành)_ · **Bản chạy được:** Release `v1.0.0` (`dao-den-long-v1.0.0.zip`) · **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md) · [Phase 4](docs/proof/phase-4/README.md) · [Retro](docs/notes/retro.md) · Đề lab: [docs/lab](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Day 12 · AI SDLC Lab). Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng. Qua **ba Đêm trên ba hòn đảo**, gom đom đóm, nạp ánh sáng để thắp lại các **Đèn Lồng Lớn** trước bình minh, tỏa sáng để xua **Bóng Mực** và giữ đom đóm khỏi **Gió Lạc**.

![Đêm 1](docs/proof/phase-3/screens/p3-01-drain-lowfuel-capacity.jpg)

Tác giả: Nguyễn Đắc Tuấn Nghĩa · 2A202603442 · K5-L3A.

## Yêu cầu hệ thống

- Node.js ≥ 18 (đã thử Node 24) · macOS / Linux / Windows
- Trình duyệt có WebGL2 (Chrome, Edge, Firefox, Safari mới); GPU tích hợp là đủ (đo: ~180 draw call/khung)
- Lệnh benchmark cần Chromium của Playwright (`npx playwright install chromium`) hoặc Chrome/Edge đã cài

## Cài đặt và chạy

```bash
git clone <repo-url> && cd K5-L3A-DAY12-NguyenDacTuanNghia-2A202603442-AI-SDLC-Dao-Den-Long
npm install
npm start          # (= node scripts/serve.js) mở http://localhost:8080
```

Bản phát hành (không cần `npm install`): tải `dao-den-long-v1.0.0.zip` ở Release `v1.0.0`, giải nén, chạy `node scripts/serve.js`, mở http://localhost:8080.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D / phím mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái / J, L | Xoay camera (độ nhạy chỉnh trong Cài đặt) |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp ánh sáng vào đèn (đứng trong 2 m) |
| F / chuột phải | Tỏa Sáng: tốn 3 đom đóm, choáng + đẩy Bóng Mực trong 5 m |
| Esc / P | Tạm dừng (Tiếp tục · Chơi lại Đêm · Cài đặt · Về menu) · M: tắt/bật âm thanh |

Cài đặt (lưu lại giữa các lần mở game): âm lượng, độ nhạy chuột, tắt tiếng, **bảng màu dễ phân biệt**, **giảm chuyển động**, **chữ lớn ×1.25**, **đổi phím** cho mọi hành động (báo phím trùng, nút khôi phục mặc định). Phụ đề/mũi tên báo Bóng Mực xuất hiện, gió sắp thổi, 10 giây cuối, đèn sắp cạn dầu.

**Bảng xếp hạng:** sau màn Bình Minh hoặc khi thua, nhập tên (3–12 chữ/số/_ — có dấu được) để lưu; top 10 lưu trên đĩa (`data/leaderboard.json`), xem từ menu. Xuất: `node scripts/serve.js --export-leaderboard out.json`.

Thêm `?seed=123` vào URL để chơi lại đúng một màn.

## Ba Đêm

| Đêm | Đảo | Đèn (cần sáng lúc bình minh) | Thời gian | Điểm mới |
|---|---|---|---|---|
| 1 | Đảo Bến — đảo tròn 40 m | 5 (3) | 4:00 | — |
| 2 | Đảo Cau — hai đảo nối bằng cầu tre, bục nhảy | 6 (4) | 4:30 | Gió Lạc, Bùa Gió |
| 3 | Đảo Chuông — ba tầng, dốc, tháp chuông, gió mạnh | 7 (5) | 5:00 | Gió thổi 5 s mỗi 30 s |

Thắng Đêm 3 để thấy **Bình Minh** với tổng điểm. Thua thì chơi lại Đêm đó.

## Luật và cách tính điểm

- Mang tối đa **10** đom đóm, **+2 mỗi lần thắp đèn thành công** trong Đêm (tối đa 20). Mỗi đèn cần **10** để thắp (nạp nhiều lần được).
- **Đèn cạn dầu:** đèn đang sáng có 100 dầu, mất 1/giây. Đứng gần đèn sáng và bấm E để **châm dầu** (+10 mỗi đom đóm). Hết dầu → đèn tắt; thắp lại chỉ cần **5**. Dưới 30 dầu, đèn nhấp nháy, mất vòng an toàn và Bóng Mực sẽ tới **hút dầu**.
- **Thắng khi bình minh tới** mà Mây còn lửa và số đèn đang sáng ≥ 60% (3/5, 4/6, 5/7). Thắp đủ đèn sớm không kết thúc Đêm.
- Có **3 Ngọn Lửa** (hồi đầy mỗi Đêm). Bóng Mực chạm → mất 1 lửa, rơi một nửa số đom đóm ra quanh Mây (nhặt lại được trong 8 s), bất tử 1.5 s. Rơi khỏi đảo → mất 1 lửa và toàn bộ đom đóm. Hết lửa → **thua** ngay. Bình minh mà thiếu đèn sáng → **thua**.
- Bóng Mực không vào được vòng **6 m** quanh đèn đang sáng còn ≥ 30 dầu. **Gió Lạc** cướp tối đa 3 đom đóm khi bạn mang từ 5 con trở lên. **Bùa Gió** cho chạy nhanh và lướt không hồi chiêu trong 10 s.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp, thắp lại, châm dầu) | +5 |
| Thắp một đèn lần đầu | +100 |
| Thắp lại một đèn đã tắt | +40 |
| Mỗi Bóng Mực trúng Tỏa Sáng (đang hút dầu: +15) | +5 |
| Khi thắng: mỗi đèn đang sáng | +50 + số dầu còn (làm tròn xuống) |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Test Contract (headless, v1.3)

`game.contract.json` ở gốc repo khai báo lệnh và mọi số tuning (số chuẩn Ticket-02 + Ticket-03). Chạy headless:

```bash
node src/headless.js --seed 1 --night 2 [--scenario s.json] [--inputs i.json] --ticks 600 --out out.jsonl [--snapshot-every 10]
```

Exit 0 khi chạy xong; **2** khi file inputs/scenario sai định dạng; 1 cho lỗi khác (ví dụ `--night 4`). Ghi chú triển khai contract: [docs/notes/contract-v1.md](docs/notes/contract-v1.md). Giả định: [Phase 1](docs/notes/phase-1.md#3-giả-định-cho-chỗ-prd-0-còn-mơ-hồ), [Phase 2](docs/notes/phase-2.md#3-giả-định-cho-chỗ-ticket-chưa-nói-rõ).

## Benchmark và soak test (Test Contract v1.3)

```bash
node scripts/bench.js --seed 42 --duration 30 --out bench.json      # cửa sổ 1280×720, vsync tắt (npm run bench)
node --expose-gc scripts/soak.js --seed 7 --nights 10 --out soak.json   # 10 Đêm trong 1 tiến trình (npm run soak)
```

Số đo của tôi (i5-12400F, RTX 2060, Chrome 158): avg **782 FPS**, 1 % low **309 FPS**, load **637 ms**; soak 0 crash, RAM ×1.004 — [docs/proof/phase-4](docs/proof/phase-4/README.md). Bản web không đọc được RSS của trình duyệt nên `peak_mem_mb` là `null`.

## Kiểm thử

```bash
npm test           # 96 test: contract + CLI + 62 scenario qua CLI thật + tất định + phát lại ván chơi + bảng xếp hạng/soak/bench
npm run proof      # sinh lại docs/proof/<phase>/headless-report.md
node scripts/bot.js --seed 3 --night 1 --out inputs.json   # bot tự chơi, ghi file inputs
```

CI (GitHub Actions) chạy `npm test` trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi

Tất cả chỉ nằm ở `src/web/` (phần hiển thị), không có trong headless nên **không đổi đầu ra contract** — bằng chứng: toàn bộ scenario và kiểm tra tất định chạy trên `src/sim/` vẫn xanh, và `src/sim/` không import gì từ `src/web/`.

- **Cú Tí** — chú cú nhỏ bay theo Mây; khi Mây đang mang ánh sáng, Cú Tí bay tới lượn trên **đèn chưa sáng gần nhất** và kêu "hú hú" để chỉ đường.
- **Đom đóm bay quanh nón lá** — số đốm sáng xoay quanh nón đúng bằng số đom đóm đang mang.
- **Ông Đăng** — người giữ đèn già giới thiệu từng Đêm.
- **Âm thanh tự tổng hợp** bằng WebAudio (không dùng file): nhạc nền ngũ cung, tiếng nhặt cao dần, hợp âm thắp đèn, gió, tiếng đếm ngược.
- **Lá bay** báo trước cơn gió ở Đêm 3; Bóng Mực "trồi lên" từ sương khi sinh ra.

## Phát hành

`node scripts/package.js` tạo `dist/dao-den-long-v1.0.0/` và `.zip` (chỉ cần Node). Release `v1.0.0` trên GitHub đính kèm file zip này và video demo.

## Cấu trúc

```text
src/sim/        luật chơi thuần, tất định (dùng chung) — tuning.js số liệu, levels.js 3 bản đồ chuẩn
src/headless.js CLI theo Test Contract v1.1
src/web/        bản 3D Three.js (main.js luồng game + HUD, world.js mô hình, audio.js âm thanh)
tests/          node:test — scenarios.js là danh sách scenario có ID yêu cầu
scripts/        serve.js (server tĩnh), bot.js (tự chơi), proof.js (sinh bằng chứng), hooks/
docs/notes/     giả định, tiêu chí nghiệm thu, nhật ký AI · docs/proof/ bằng chứng từng phase · docs/lab/ đề bài + ticket
AGENTS.md, CLAUDE.md, .claude/ (hook, skill, agent)   harness AI
```

Giấy phép: [MIT](LICENSE) · Nguồn và công cụ: [CREDITS.md](CREDITS.md) · Thay đổi: [CHANGELOG.md](CHANGELOG.md)
