# Đảo Đèn Lồng

> **Video demo:** _(có ở Phase 4, Release `v1.0.0`)_ · **Bằng chứng Phase 1:** [docs/proof/phase-1](docs/proof/phase-1/README.md) · Đề lab: [docs/lab](docs/lab/README.md)

Game 3D góc nhìn thứ ba (Day 12 · AI SDLC Lab). Bạn là **Mây**, người giữ đèn nhỏ tuổi đội nón lá treo đèn lồng. Gom đom đóm khắp Đảo Bến, nạp ánh sáng để thắp lại **5 Đèn Lồng Lớn** trước bình minh, và tỏa sáng để xua **Bóng Mực** trong sương đen.

Tác giả: Nguyễn Đắc Tuấn Nghĩa · 2A202603442 · K5-L3A.

## Cài đặt và chạy (cần Node.js ≥ 18; macOS / Linux / Windows)

```bash
git clone <repo-url> && cd K5-L3A-DAY12-NguyenDacTuanNghia-2A202603442-AI-SDLC-Dao-Den-Long
npm install
npm start          # mở http://localhost:8080
```

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D / phím mũi tên | Di chuyển (theo hướng camera) |
| Kéo chuột trái / J, L | Xoay camera |
| Space | Nhảy |
| E | Nạp ánh sáng vào đèn (đứng trong 2.5 m) |
| F / chuột phải | Tỏa sáng: tốn 1 đom đóm, choáng + đẩy Bóng Mực trong 6 m |
| R | Chơi lại · M: tắt/bật âm thanh · P: chụp ảnh (chỉ với `npm start`) |

Thêm `?seed=123` vào URL để chơi lại đúng một màn.

## Luật và cách tính điểm

- Mang tối đa **5** đom đóm. Mỗi đèn cần **5** đom đóm. Thắp đủ 5 đèn → **thắng**.
- Có **3 ngọn lửa**. Bóng Mực chạm (≤ 1 m) → mất 1 lửa, rơi mất một nửa số đom đóm đang mang (làm tròn xuống), bất tử 1.5 s. Hết lửa → **thua**. Hết 5 phút → bình minh → **thua**.
- Bóng Mực không vào được vòng 4 m quanh **đèn đã sáng**. Tỏa sáng hồi chiêu 1 s, choáng 2 s.

| Sự kiện | Điểm |
|---|---|
| Nhặt một đom đóm | +10 |
| Thắp một đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Test Contract (headless)

`game.contract.json` ở gốc repo khai báo lệnh và mọi số tuning. Chạy headless:

```bash
node src/headless.js --seed 1 --night 1 [--scenario s.json] [--inputs i.json] --ticks 600 --out out.jsonl [--snapshot-every 10]
```

Exit 0 khi chạy xong; **2** khi file inputs/scenario sai định dạng; 1 cho lỗi khác (thông báo ra stderr). Tuning không có khái niệm tương ứng: `fall_enabled: false` vì mép đảo là tường, không rơi được (không bao giờ có `player_hit` với `by: "fall"`). Mọi giả định khác: [docs/notes/phase-1.md](docs/notes/phase-1.md#3-giả-định-cho-chỗ-prd-0-còn-mơ-hồ).

## Kiểm thử

```bash
npm test           # unit + contract + 18 scenario qua CLI thật + tất định + 3 ván chơi trọn
npm run proof      # sinh lại docs/proof/phase-1/headless-report.md
```

CI (GitHub Actions) chạy `npm test` trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi

Tất cả chỉ nằm ở `src/web/` (phần hiển thị), không có trong headless nên **không đổi đầu ra contract** — bằng chứng: toàn bộ scenario và kiểm tra tất định chạy trên `src/sim/` vẫn xanh, và `src/sim/` không import gì từ `src/web/`.

- **Cú Tí** — nhân vật phụ mới: một chú cú nhỏ bay theo Mây; khi Mây đang mang ánh sáng, Cú Tí bay tới lượn trên **đèn chưa sáng gần nhất** và kêu "hú hú" để chỉ đường ([ảnh p1-02](docs/proof/phase-1/screens/p1-02-pulse-stun.jpg)).
- **Đom đóm bay quanh nón lá** — số đốm sáng xoay quanh nón đúng bằng số đom đóm đang mang, đèn trên nón sáng mạnh dần.
- **Đảo bừng sáng** — sương tím tan dần, trời và cỏ sáng lên theo số đèn đã thắp; đèn vừa thắp "bùng" sáng.
- **Âm thanh tự tổng hợp** bằng WebAudio (không dùng file âm thanh): tiếng nhặt cao dần theo số đom đóm, hợp âm khi thắp đèn, tiếng gió khi tỏa sáng, giai điệu thắng/thua.
- **Bến** — cầu tàu gỗ ở mép đảo và biển mây quanh đảo (đúng tên "Đảo Bến").

## Cấu trúc

```text
src/sim/        luật chơi thuần, tất định (dùng chung) — tuning.js là nguồn số duy nhất
src/headless.js CLI theo Test Contract v1.0
src/web/        bản 3D Three.js (chỉ vẽ + input + âm thanh)
tests/          node:test — scenarios.js là danh sách scenario có ID yêu cầu
scripts/        serve.js (server tĩnh), bot.js (tự chơi), proof.js (sinh bằng chứng), hooks/
docs/notes/     giả định, nhật ký AI, retro · docs/proof/ bằng chứng từng phase · docs/lab/ đề bài
AGENTS.md, CLAUDE.md, .claude/ (hook, skill, agent)   harness AI
```

Giấy phép: [MIT](LICENSE) · Nguồn và công cụ: [CREDITS.md](CREDITS.md) · Thay đổi: [CHANGELOG.md](CHANGELOG.md)
