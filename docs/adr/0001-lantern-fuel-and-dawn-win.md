# ADR 0001 — Đèn có nhiên liệu và luật thắng lúc bình minh

- **Trạng thái:** Đã chấp nhận (Phase 3, tag `phase-3`)
- **Bối cảnh:** [Ticket-03 "Đèn cạn dầu"](../lab/tickets/ticket-03.md) — người chơi giỏi thắp hết đèn trong 2 phút rồi game hết căng thẳng. Đèn phải có thể tắt; mục tiêu chuyển từ "thắp hết" sang "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn

Trước (Phase 1–2): `unlit → lit` một chiều, `deposited` chỉ tăng.

Sau:

```text
            nạp đủ costOf (10 nếu chưa từng sáng, 5 nếu ever_lit)
  ┌────────┐ ─────────────────────────────────────────────▶ ┌────────────┐
  │ unlit  │                                                 │ lit        │──▶ fuel giảm 1/s + 5/s mỗi Bóng Mực drain
  │ dep 0.. │ ◀───────────────────────────────────────────── │ fuel 0..100 │◀── châm dầu: +10/đom đóm, tối đa 100
  └────────┘   fuel ≤ 0: lantern_out, deposited = 0,        └────────────┘
               ever_lit = true (giữ mãi)                      fuel < 30: mất vùng an toàn
```

- Mỗi đèn có thêm `fuel`, `everLit`, `relitCount`. `deposited` vẫn giữ để tương thích event `deposit` cũ.
- **Nhiên liệu lưu bằng số nguyên đơn vị 1/60** (`FUEL_UNIT = 60`): hao 1 đơn vị/tick, bị hút 5 đơn vị/tick/Bóng Mực, châm +600/đom đóm. Không có sai số số thực, kết quả tất định trên mọi máy; chỉ đổi ra số thực (1 chữ số thập phân) khi xuất snapshot/event.
- Trừ dầu chạy ở **bước 2** (cùng các bộ đếm khác), ngay sau đó đèn hết dầu tắt — đúng thứ tự Ticket-03 §3.
- Vùng an toàn trở thành hàm `hasSafeZone(l) = lit && fuel ≥ 30`, dùng chung cho chặn Bóng Mực, điểm sinh và đẩy ra; nhờ vậy luật "mất vùng an toàn khi yếu" chỉ đổi một chỗ.
- Tương tác: `acceptsFuel(l) = !lit || refuelNeed(l) > 0`. Đèn đầy không bao giờ được chọn (không event, không điểm).

### 2. Bóng Mực hút dầu

Thêm trạng thái `drain` vào máy trạng thái hiện có: `wander → drain` (≤ 2 m tới đèn yếu được chọn), `drain → chase` (Mây ≤ 6 m), `drain → stunned` (Tỏa Sáng, +15 điểm thay vì +5), `drain → wander` (đèn tắt, được châm ≥ 30, hoặc > 2 m). Bóng đang `chase` không bị đèn yếu "kéo" đi.

### 3. Luật thắng

`Sim.step` bước 11:

```js
if (flames <= 0) lost('no_flames');                // luôn ưu tiên, kể cả tick bình minh
else if (timeLeft <= 0) litCount >= ceil(0.6 * n) ? won('dawn_survived') : lost('dawn');
```

Không còn `all_lit`. Thời lượng 240/270/300 s. Thưởng khi thắng: mỗi đèn đang sáng `50 + floor(fuel)`, mỗi Ngọn Lửa 50; bỏ thưởng thời gian (`per_second_left = 0` vẫn khai trong contract để bảng `score` không mất khóa cũ).

### 4. Sức chứa

`capacity() = min(20, 10 + 2 × successfulLights)`; `successfulLights` tăng ở mọi lần thắp thành công (cả thắp lại), đặt lại mỗi Đêm vì mỗi Đêm là một `Sim` mới.

## Phương án đã cân nhắc

- **Lưu `fuel` bằng số thực** — đơn giản hơn nhưng 1/60 cộng dồn sinh sai số (ví dụ 100 − 6000 × 1/60 ≠ 0 đúng tick). Bỏ.
- **Tách "đèn" thành lớp riêng** — gọn hơn về hướng đối tượng nhưng đổi nhiều code và test của Phase 2 khi còn ít thời gian. Giữ đối tượng thuần + vài hàm truy vấn (`costOf`, `hasSafeZone`, `refuelNeed`).

## Hệ quả

- Phá vỡ tương thích (ghi ở [CHANGELOG](../../CHANGELOG.md#phase-3)): `game_over.reason` không còn `all_lit`; điểm khác; thời lượng khác.
- 7 scenario/test cũ phải sửa hoặc thay (lý do ở [phase-3.md §4](../notes/phase-3.md#4-test-cũ-bị-ticket-03-làm-sai)).
- Game khó hơn: bot tham lam cũ thắng được Đêm 1 nay không giữ được 3 đèn tới bình minh.
