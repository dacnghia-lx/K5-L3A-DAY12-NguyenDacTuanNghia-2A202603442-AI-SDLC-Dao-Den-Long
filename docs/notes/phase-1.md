# Phase 1 — PRD-0: Đêm 1, Đảo Bến

Yêu cầu: PRD-0 + Test Contract v1.0 trên lab board (tóm tắt contract: [contract-v1.md](contract-v1.md)).
Bằng chứng: [docs/proof/phase-1/](../proof/phase-1/README.md).

## 1. Quyết định kỹ thuật (mỗi dòng một lý do)

- **Node.js + Three.js, không bundler.** Chạy giống nhau trên macOS/Linux/Windows; headless chỉ cần Node; game chạy trên trình duyệt nên không cần build.
- **Một bộ luật duy nhất `src/sim/`** dùng chung cho headless và bản 3D → game có giao diện và test ẩn không thể lệch nhau.
- **RNG có seed (mulberry32)**, cấm `Math.random`/`Date` trong sim → tất định.
- **Tuning một nguồn** (`src/sim/tuning.js`), test bắt buộc `game.contract.json` khớp → không khai sai số.

## 2. Tiêu chí nghiệm thu (yêu cầu → kiểm tra được)

| ID | Yêu cầu PRD-0 | Tiêu chí nghiệm thu |
|---|---|---|
| R1 | Một màn: Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn | Màn mặc định có đúng 5 đèn `L1..L5` chưa sáng, đảo bán kính 40 m |
| R2 | Đi lại, nhảy, camera 3D | Đi 6 m/s theo hướng camera; nhảy làm Y > 0 rồi về 0; camera góc nhìn thứ ba xoay được |
| R3 | Đom đóm rải rác, nhặt được | 20 đom đóm ngẫu nhiên theo seed; đến trong 1.5 m thì nhặt, tối đa mang 5 |
| R4 | Nạp ánh sáng thắp đèn | Nhấn interact trong 2.5 m: nạp min(đang mang, còn thiếu); đủ 5 thì đèn sáng |
| R5 | Bóng Mực xuất hiện, đuổi; chạm mất máu; sợ đèn | 2 con lúc đầu + thêm mỗi 30 s (từ 20 s), tối đa 5; đuổi 3.5 m/s; chạm (≤1 m) mất 1 lửa; không vào được 4 m quanh đèn đã sáng |
| R6 | Tỏa sáng xua Bóng Mực, tốn ánh sáng | Pulse tốn 1 đom đóm, choáng các con trong 6 m trong 2 s, đẩy lùi 4 m, hồi chiêu 1 s |
| R7 | Thắng / thua / điểm | Thắp đủ 5 → thắng `all_lit`; hết lửa → thua `no_flames`; hết giờ → thua `dawn`; điểm theo bảng ở README |
| R8 | HUD | Hiện lửa, đom đóm đang mang, số đèn đã sáng, thời gian, điểm, hồi chiêu tỏa sáng, gợi ý khi đứng gần đèn |
| R9 | Chơi lại | Màn kết thúc có bảng điểm và nút/phím R chơi lại, trạng thái reset về tick 0 |
| R10 | Phong cách | Đêm, ánh vàng cam = tốt, tím đen = nguy hiểm; đảo sáng dần khi thắp đèn; Mây đội nón lá có đèn lồng nhỏ; không bạo lực |
| C | Test Contract v1.0 | Đúng CLI, tick model, inputs, scenario, output, exit code, tất định (các mục C-B, C-C, C-D trong bảng bằng chứng) |

## 3. Giả định cho chỗ PRD-0 còn mơ hồ

| # | Chỗ mơ hồ | Giả định của tôi |
|---|---|---|
| A1 | "Máu" là gì | `flames` = 3 ngọn lửa; mỗi lần chạm mất 1; sau đó bất tử 1.5 s |
| A2 | "Tốn ánh sáng" khi tỏa sáng | Tiêu 1 đom đóm đang mang (`pulse_cost`=1). Không có đom đóm hoặc đang hồi chiêu → nhấn không có tác dụng, **không ghi event** |
| A3 | Đánh rơi khi bị chạm | `dropped = floor(carried × 0.5)`; đom đóm rơi **mất luôn** (không rải lại) để `random_motes:false` vẫn "chỉ có những con được liệt kê" |
| A4 | Bóng Mực "sợ đèn" | Chỉ **đèn đã sáng** có vùng an toàn 4 m; đèn tối không đuổi được Bóng Mực. Bóng Mực bị đẩy ra mép vùng (+2 mm cho sai số làm tròn) |
| A5 | Điểm `per_mote` tính lúc nào | Lúc **nhặt** (khớp ví dụ snapshot contract: mang 2, điểm 20) |
| A6 | Thưởng thời gian / lửa còn lại | Chỉ khi **thắng**: `floor(time_left_s)×2 + flames×50` |
| A7 | Pulse trúng ai | Mọi Bóng Mực có tâm trong 6 m (kể cả con đang choáng — bị choáng lại, vẫn +20); event `pulse` ghi cả khi `stunned_ids` rỗng |
| A8 | Thời gian choáng | Choáng trong 120 trạng thái tick sau pulse (tick k+1…k+120), tick k+121 đuổi lại |
| A9 | Rơi khỏi đảo | Không có: mép đảo là tường mềm (`fall_enabled:false`), không có event `fall` |
| A10 | Thời lượng đêm | 300 s (5 phút) |
| A11 | Nhiều đèn trong tầm interact | Nạp vào đèn chưa sáng **gần nhất** |
| A12 | Nhặt nhiều đom đóm cùng lúc | Gần trước, cùng khoảng cách thì theo thứ tự danh sách; dừng khi đủ 5 |
| A13 | Thứ tự trong một bước | di chuyển → nhảy → nhặt → nạp đèn → (thắng?) → pulse → Bóng Mực di chuyển → va chạm → (thua?) → sinh Bóng Mực/đom đóm → hết giờ? |
| A14 | `random_motes:true` | Giữ 20 đom đóm: con bị nhặt hồi sinh chỗ ngẫu nhiên sau 2 s |
| A15 | Đèn đặt `deposited` ≥ 5 trong scenario | Coi là đã sáng (không event, không điểm) |
| A16 | Input `move` ngoài [−1,1] | Coi là file sai định dạng → exit 2 |

## 4. Kế hoạch kiểm chứng (viết trước khi code)

1. Scenario headless chạy qua **CLI thật** cho từng R/C, con số kỳ vọng tính tay từ tuning (`tests/scenarios.js`).
2. Test CLI: exit code 2 cho 9 kiểu file hỏng, exit ≠ 0 cho tham số sai, định dạng output, làm tròn.
3. Tất định: cùng seed + inputs chạy 2 lần so từng byte; seed khác cho màn khác.
4. Chơi trọn màn: bot tham lam chơi màn mặc định → ghi inputs → phát lại qua CLI phải thắng với cùng điểm (5 seed).
5. Phần chỉ nhìn mới thấy (HUD, ánh sáng, màn thắng/thua, chơi lại): chạy trên trình duyệt, chụp ảnh.

## 5. Đánh giá Phase 1

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| R1–R7, C | **Đạt** | 18/18 scenario, 39 test xanh — xem [proof](../proof/phase-1/README.md) |
| R8, R9, R10 | **Đạt** (kiểm bằng mắt) | ảnh `docs/proof/phase-1/screens/` |
| Chơi trọn từ đầu tới thắng/thua | **Đạt** | bot thắng 5/5 seed qua CLI; màn thua khi đứng yên (ảnh p1-05) |

Chưa làm / giới hạn trung thực:
- Chưa có người chơi thật thử cảm giác điều khiển (chỉ kiểm bằng input giả lập + ảnh). Bot thắng trong ~45–72 s nên độ khó có thể **quá dễ**; để nguyên vì số đã khai trong contract, sẽ chỉnh nếu ticket sau yêu cầu.
- Không có `dash` (input `dash` được chấp nhận nhưng bỏ qua).
- Hiển thị không nội suy giữa các tick (màn 144 Hz có thể hơi giật).
- Contract-reviewer agent (`.claude/agents/contract-reviewer.md`) đã chuẩn bị nhưng phiên này chưa chạy; tôi tự soát lỗi biên (xem nhật ký AI).

Harness cần chỉnh sau phase này: xem [ai-log.md](ai-log.md).
