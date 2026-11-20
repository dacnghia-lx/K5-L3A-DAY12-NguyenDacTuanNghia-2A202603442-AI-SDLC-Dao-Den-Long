# Phase 3 — Ticket-03 "Đèn cạn dầu" (Change Request, Contract v1.2)

Yêu cầu: [docs/lab/tickets/ticket-03.md](../lab/tickets/ticket-03.md). Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md). Bằng chứng: [docs/proof/phase-3/](../proof/phase-3/README.md).

## 1. Cách làm

1. Đọc ticket, đánh dấu từng luật **[THAY THẾ]** → liệt kê test cũ sẽ sai (mục 4) **trước khi** sửa code.
2. Viết ADR (mô hình trạng thái đèn mới, đơn vị nhiên liệu nguyên).
3. Sửa sim theo từng mục của ticket; viết 13 scenario mới với số tính tay; sửa/thay các test cũ kèm lý do.
4. Bản web: thanh dầu, nhấp nháy, chế độ mù màu, HUD sức chứa, màn kết quả theo điểm mới.

## 2. Tiêu chí nghiệm thu

| ID | Yêu cầu | Tiêu chí nghiệm thu | Kiểm bằng |
|---|---|---|---|
| P3-1 | Nhiên liệu đèn | Thắp (lần đầu/lại) → fuel 100; hao 1/s; châm `used = min(mang, ceil((100 − fuel)/10))`, +10/đom đóm, tối đa 100; đèn đầy không được chọn; fuel ≤ 0 → tắt, `deposited = 0`, `lantern_out`, `ever_lit` giữ; thắp lại cần 5; tính bằng đơn vị nguyên 1/60 | `fuel-decay`, `lantern-out`, `refuel`, `refuel-picks-nearest-accepting`, `relight` |
| P3-2 | Bóng Mực hút dầu | fuel < 30 mất vùng an toàn (đúng 30 vẫn còn); chỉ `wander` chọn đèn yếu gần nhất (id nhỏ); ≤ 2 m → `drain` đứng yên hút 5/s, cộng dồn; `fuel_drain` mỗi 60 tick; drain → chase (≤ 6 m) / stunned / wander; châm lên ≥ 30 đẩy bóng ra mép trong 30 tick không sát thương | `drain-until-out`, `drain-two-shades-add-up`, `safe-zone-needs-30`, `drain-to-chase`, `drain-pulse-15`, `refuel-evicts-drainers` |
| P3-3 | Luật thắng mới | 240/270/300 s; thắng khi còn sống lúc bình minh và đèn sáng ≥ ceil(0.6 × tổng) (3/5, 4/6, 5/7); không thắng sớm; hết lửa luôn thua trước (kể cả tick cuối); lý do `dawn_survived` / `dawn` / `no_flames` | `dawn-survived`, `dawn-below-threshold`, `no-flames-beats-dawn`, `no-early-win`, `dawn-lose` |
| P3-4 | Sức chứa tăng dần | `10 + 2 × successful_lights`, tối đa 20; đếm cả thắp lại; đèn đặt sẵn không tính; đặt lại mỗi Đêm; HUD hiện mang/sức chứa | `capacity-growth`, `capacity-max-20`, `deposit-light` (12 sau 1 lần thắp); ảnh p3-01 (8/14) |
| P3-5 | Điểm mới | +5/đom đóm nạp (thắp, thắp lại, châm), +100 thắp lần đầu, +40 thắp lại, +5 trúng Tỏa Sáng (+15 nếu đang drain), bình minh: mỗi đèn sáng 50 + floor(fuel), mỗi lửa 50; bỏ thưởng thời gian | `deposit-*`, `relight` (65), `drain-pulse-15`, `dawn-survived` (597); ảnh p3-03 |
| P3-6 | Chế độ mù màu | Cài đặt "Bảng màu dễ phân biệt" được lưu; viền/mắt Bóng Mực #00B3FF; cảnh báo UI trắng + ⚠; đèn tắt xẹp 20% + giấy rách; đèn sắp cạn nhấp nháy 1 Hz | ảnh p3-02 (bật) so với p3-01 (tắt) |
| P3-7 | Contract v1.2 | tuning thêm 8 khóa + thời lượng mới; snapshot đèn `fuel` (1 chữ số), `ever_lit`, `relit_count`, player `capacity`, trạng thái `drain`; scenario `lit/fuel/ever_lit`, `successful_lights`, `target_lantern_id`; event `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit.relight` | `tests/contract.test.js`, `tests/cli.test.js` (16 file hỏng → exit 2), scenario `default-level-night1` |

## 3. Giả định

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| A-P3-1 | `deposited` của đèn đang sáng | = chi phí đã nạp (10, hoặc 5 nếu là thắp lại); đặt sẵn `lit` trong scenario → 10 (trừ khi `ever_lit: true`) |
| A-P3-2 | Đèn đặt sẵn `lit: true` có `ever_lit`? | Có (đã từng sáng) nếu scenario không ghi `ever_lit` |
| A-P3-3 | Tốc độ Bóng Mực đi tới đèn yếu | Tốc độ wander 2 m/s, đi thẳng |
| A-P3-4 | `fuel_drain` khi nhiều bóng cùng hút | Mỗi cặp (bóng, đèn) một event, mỗi 60 tick kể từ lúc bóng đó bắt đầu hút; `fuel` là giá trị sau khi trừ ở tick đó |
| A-P3-5 | `refuel.amount` | Số đom đóm đã dùng (`used`) |
| A-P3-6 | Đẩy bóng ra khi châm | Chỉ khi đèn đang yếu (< 30) được châm lên ≥ 30 (đèn ≥ 30 thì không bóng nào ở trong) |
| A-P3-7 | `per_second_left` | Giữ khóa trong contract với giá trị 0 (luật bỏ thưởng thời gian) |
| A-P3-8 | Đèn tắt "xẹp 20%, giấy rách" chỉ trong chế độ mù màu? | Áp dụng luôn (không hại gì, giúp mọi người chơi) |

## 4. Test cũ bị Ticket-03 làm sai

| Test Phase 2 | Vì sao sai | Xử lý |
|---|---|---|
| `win-all-lit` (thắng `all_lit`, 858 điểm) | Không còn thắng sớm; điểm mới | **Thay** bằng `no-early-win` (vẫn chơi, 105 điểm) |
| `win-on-dawn-tick` (thắng khi đèn cuối sáng đúng tick cuối, thưởng thời gian) | Luật thắng mới, bỏ thưởng thời gian | **Thay** bằng `dawn-survived` (597), `dawn-below-threshold`, `no-flames-beats-dawn` |
| `deposit-light` (200 điểm), `deposit-partial-and-hold` (30) | +5 mỗi đom đóm | 150, 15; thêm kiểm `fuel`, `capacity`, `relight:false` |
| `tick-model` (299.9 s), `default-level-night1` (300 s), `default-level-night3` (360 s) | Thời lượng 240/300 s | 239.9, 240, 300 |
| `tests/contract.test.js` (v1.1, số cũ) | v1.2 | So với số Ticket-03 |
| `tests/playthrough.test.js` (bot thắng Đêm 1 seed 3) | Bot không còn sống tới bình minh với 3 đèn | Bỏ kỳ vọng "won", giữ kiểm phát lại qua CLI cho đúng cùng kết quả; luật thắng được kiểm bằng `dawn-survived` |

Không test nào bị `skip`.

## 5. Đánh giá Phase 3

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| P3-1 … P3-5, P3-7 | **Đạt** | 62 scenario + 28 test khác xanh |
| P3-6 | **Đạt** (kiểm bằng mắt) | ảnh p3-01 / p3-02 |
| Test Phase 1–2 không bị thay | **Đạt** | các scenario cũ còn lại vẫn xanh |

Giới hạn trung thực: bot không thắng được Đêm nào với luật mới (thua do Bóng Mực); chưa có người chơi thật đánh giá độ khó.
