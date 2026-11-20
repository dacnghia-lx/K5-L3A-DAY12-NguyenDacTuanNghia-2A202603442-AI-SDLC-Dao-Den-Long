# Phase 2 — Ticket-02 "Ba hòn đảo" (Contract v1.1)

Yêu cầu: [docs/lab/tickets/ticket-02.md](../lab/tickets/ticket-02.md). Bằng chứng: [docs/proof/phase-2/](../proof/phase-2/README.md).

## 1. Quyết định kỹ thuật

- **Bản đồ là dữ liệu** (`src/sim/levels.js`): mỗi Đêm là danh sách mặt đi được (đĩa, chữ nhật, nửa vành khăn, dốc, tháp), điểm sinh, đèn, bục nhảy, bùa. Sim chỉ hỏi `floorAt()` / `blockedAt()`, nên 3 bản đồ dùng chung một bộ luật di chuyển; bản 3D vẽ từ đúng dữ liệu này.
- **Vách / bậc**: mặt cao hơn chân Mây quá 0.35 m là vách (chặn, trượt theo trục còn lại); thấp hơn thì rơi xuống. 0.35 m đủ để đi dốc (≤ 0.12 m/tick khi lướt) nhưng không leo được tầng 3 m.
- **Thứ tự tick đúng Ticket-02**, mỗi bước là một hàm trong `Sim.step` (comment đánh số 1–11).
- **Tạm dừng nằm trong sim** (input `pause`) để headless đúng contract; bản web dừng bằng cách không gọi `step`, kết quả như nhau.
- **Wander** (ticket không mô tả): Bóng Mực đi 2 m/s tới các điểm ngẫu nhiên trong bán kính 10 m quanh đèn tắt gần nhất. Bản đầu cho chúng đứng canh sát đèn (3 m) làm game gần như không thắng được (bot thua 18/18 ván) nên đã đổi — xem nhật ký AI.

## 2. Tiêu chí nghiệm thu

| ID | Yêu cầu | Tiêu chí nghiệm thu (kiểm được) | Kiểm bằng |
|---|---|---|---|
| P2-1 | Số liệu chuẩn Phần 1 | `game.contract.json` = Ticket-02 (test so từng số); nhặt 1.0 m + chênh cao 1.5; sức chứa 10; đèn 10, tương tác 2.0, chọn đèn gần nhất rồi id nhỏ; Tỏa Sáng 3/5 m 3D từ chân+0.8/3 s, choáng 120 tick, đẩy 4 m trong 15 tick (trùng vị trí → +X), pulse lại làm mới; Bóng Mực 4.0 (Đêm 3: 4.5) m/s, phát hiện 12 / bỏ 18 m, chạm XZ 1.0 + chênh 1.5, 1 hit/tick theo id tăng dần, recoil 2 m/60 tick; bị đánh rơi floor(n/2) ra vành 1.5–2.5 m, sống 480 tick; vùng an toàn 6 m, bóng kẹt trong bị đẩy ra trong 30 tick không gây sát thương; điểm chuẩn hóa; thắng được xét trước bình minh | scenario `pickup-*`, `carry-capacity`, `deposit-*`, `interact-*`, `win-*`, `pulse-*`, `shade-*`, `hit-*`, `dropped-*`, `safe-*`, `dawn-lose`, `jump`, `mote-spawn-schedule`; `tests/contract.test.js` |
| P2-2 | Bản đồ chuẩn Phần 2 | Đèn, điểm sinh đom đóm/Bóng Mực đúng tọa độ; lịch sinh Bóng Mực 300 (2 con) rồi mỗi 480/420/360 tick, tối đa 6/8/10, cách người chơi ≥ 15 m; Đêm 2 cầu tre `x∈[26,44], |z|≤2`, bục nhảy vy 14 / 24 m/s; Đêm 3 ba tầng, vách, 2 dốc, bục vy 12 / 8 m/s → tầng 2, tháp chuông chặn; gió 5 s mỗi 30 s, 2 m/s | `default-level-night1/3`, `shade-spawn-schedule-n1/n3`, `jump-pad-night2`, `night2-bridge`, `night3-*` |
| P2-3 | Lướt, rơi | Lướt 14 m/s × 12 tick, hồi 90 tick từ lúc bắt đầu, hướng di chuyển hoặc hướng mặt, giữ độ cao trên không, không bất tử; rơi Y < −10 đúng 1 lần: −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở điểm xuất phát, bất tử 90 tick; hết lửa thì thua ngay | `dash`, `dash-in-air-keeps-height`, `fall-off-island`, `fall-last-flame` |
| P2-4 | **Gió Lạc** | Chỉ Đêm 2–3; sinh tick 1200, 2400…, tối đa 2, id D1…; idle 2 m/s → chase (mang ≥ 5 và ≤ 15 m) 7 m/s → chạm ≤ 1.2 m cướp min(3, mang) một lần, flee 240 tick rồi biến mất; Tỏa Sáng trúng lúc chase → flee không cướp; trúng lúc flee có đồ → thả hết thành đom đóm rơi, biến mất sau 120 tick; không làm mất lửa, vùng an toàn và bất tử không chặn | `drifter-steal-flee`, `drifter-idle-below-5`, `drifter-pulse`, `drifter-spawn-schedule` |
| P2-5 | **Bùa Gió** | Đêm 2 (35,0,0); Đêm 3 (±30,0,25); nhặt như đom đóm; 600 tick (nhặt lại làm mới): chạy 7.2 m/s, lướt không hồi chiêu (vẫn phải nhấn lại, nhấn khi đang lướt bị bỏ qua); xuất hiện lại sau 2700 tick | `charm-wind` |
| P2-6 | **Chuỗi 3 Đêm** | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → màn Bình Minh với tổng điểm các Đêm đã thắng; thua → chơi lại Đêm đó | trình duyệt, ảnh `p2-05`, kiểm `__game` |
| P2-7 | **Tạm dừng** | Esc/P dừng hoàn toàn logic (số bước không đổi); menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; headless: `pause` → `paused`/`resumed`, `sim_tick` đứng yên | scenario `pause`, trình duyệt (`stepsFrozen: true`), ảnh `p2-04` |
| P2-8 | **Cài đặt** | Âm lượng + độ nhạy chuột, lưu `localStorage` (`ddl-settings-v1`), đọc lại khi mở game | trình duyệt (đọc lại `localStorage` sau khi kéo thanh trượt) |
| P2-9 | **Âm thanh** | Nhạc nền đêm + hiệu ứng: nhặt, thắp đèn, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s cuối (tổng hợp WebAudio) | đọc mã `src/web/audio.js` + `handleEvent` (không ghi âm được) |
| P2-10 | **HUD** | Lửa trên trái; đồng hồ mm:ss trên giữa, đỏ + nhấp nháy khi ≤ 30 s; đèn k/n + điểm trên phải; thanh 10 ô đom đóm dưới giữa; hồi chiêu Lướt + Tỏa Sáng dưới phải; "E — Nạp ánh sáng (x/10)" khi gần đèn; mũi tên chỉ đèn chưa sáng gần nhất khi nó ngoài màn hình | ảnh `p2-01..03` |
| P2-11 | **Bảng màu + ánh sáng** | Màu chuẩn trong `src/web/world.js PAL` và `style.css :root`; `ambient.intensity = 0.15 + 0.55 × đèn sáng / tổng đèn` | đọc mã, ảnh |
| P2-12 | Contract v1.1 | Như [contract-v1.md](contract-v1.md#v11-ticket-02--thay-đổi-so-với-v10) | `tests/cli.test.js`, `snapshot-v1.1-fields`, `scenario-build-silent`, `tick-model` |
| P2-13 | Hiệu năng | Headless 1 Đêm ≤ 30 s; bản web ≥ 30 FPS ở 1280×720 | `tests/cli.test.js` (Đêm 3 21.600 tick < 5 s); trình duyệt: ~2.5 ms/khung (xem bằng chứng) |

## 3. Giả định cho chỗ ticket chưa nói rõ

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| A-P2-1 | Điểm xuất phát Đêm 2/3 | Đêm 2 (0,0,0). Đêm 3 **(0,0,−20)** vì (0,0,0) nằm trong tháp chuông; quay mặt +Z |
| A-P2-2 | "tăng tốc/dừng trong ≤ 0.1 s" | Đặt vận tốc tức thì (0 s ≤ 0.1 s) — tính tay đơn giản, đúng giới hạn |
| A-P2-3 | Trạng thái `spawning` | 60 tick (1 s) đứng yên, không gây hit; vẫn trúng Tỏa Sáng; xong thì `wander` |
| A-P2-4 | Hành vi `wander` | Xem mục 1. Bóng Mực trong scenario không ghi `state` bắt đầu ở `wander` (trong 12 m thì chuyển `chase` ngay tick đầu) |
| A-P2-5 | Chênh cao khi chạm / nhặt | So chân Mây với tâm Bóng Mực (tâm = mặt đất + 1 m) và với điểm đất của đom đóm/bùa |
| A-P2-6 | Trần 30 đom đóm | Đếm cả đom đóm rơi; Đêm 1 chỉ có 24 điểm sinh nên thực tế dừng ở 24 |
| A-P2-7 | `night_start` | Ghi ở tick 0 ngay sau snapshot 0 (không thuộc bước nào) |
| A-P2-8 | `player.invuln` trong snapshot | Boolean (các trường thời gian khác có hậu tố `_s`) |
| A-P2-9 | Gió Lạc "điểm sương ngẫu nhiên" | Một điểm sinh Bóng Mực ngẫu nhiên; chỉ con đang `chase` mới cướp; lượn idle đổi hướng mỗi 120 tick |
| A-P2-10 | Hướng gió | Chọn ngẫu nhiên (RNG có seed) lúc bắt đầu mỗi cơn; cơn k chạy sim tick `1800k … 1800k+299`; báo trước 120 tick (chỉ hiển thị) |
| A-P2-11 | Bóng Mực ở tầng cao/biển | Bay theo mặt đất cao nhất bên dưới (+1 m), bị giới hạn trong vùng các đảo (+ cầu) |
| A-P2-12 | Rơi lúc chờ hồi sinh | Mây đứng yên ở chỗ rơi; không nhặt, không bị chạm, không cướp được |

## 4. Test cũ bị Ticket-02 làm sai (đã sửa, không skip)

Toàn bộ số trong 18 scenario Phase 1 đổi theo số chuẩn. Mỗi scenario được giữ ý cũ và tính lại tay:

| Scenario Phase 1 | Vì sao sai | Thay bằng |
|---|---|---|
| `pickup-walk` (tick 35, +10 điểm khi nhặt) | bán kính 1.5 → 1.0; điểm chuyển sang lúc **nạp** | tick 40, điểm 0 |
| `carry-capacity` (5) | sức chứa 10 | 12 con, nhặt 10 |
| `deposit-light` (5 con, 100 điểm), `deposit-partial-and-hold`, `interact-out-of-range` (2.6 m) | chi phí 10, tương tác 2.0, +10/đom đóm nạp | 10 con → 200 điểm; 3 con → 30 điểm; 2.1 m |
| `win-all-lit` (848) | điểm mới | 858 |
| `pulse-stun-push` (tốn 1, 6 m, đẩy tức thì, +20) | 3 / 5 m 3D / đẩy trong 15 tick / +5 | tính lại vị trí từng tick |
| `pulse-cooldown-cost` (1 s) | 3 s | pulse ở tick 1, 181, 401 |
| `safe-radius` (4 m) | 6 m | |
| `island-edge-no-fall` | `fall_enabled: true`, mép đảo là biển | **xóa**, thay bằng `fall-off-island`, `fall-last-flame` |
| `default-level` (2 Bóng Mực lúc dựng, đèn trên vòng 24 m) | Bóng Mực sinh ở tick 300, đèn theo bản đồ chuẩn | `default-level-night1/3` |
| `shade-spawning` (20 s rồi mỗi 30 s, tối đa 5) | lịch mới | `shade-spawn-schedule-n1/n3` |
| `scenario-build-silent` ("không có event nào") | v1.1 có `night_start` ở tick 0 | chỉ cho phép đúng `night_start` |
| `tests/cli.test.js` "`--night 2` là sai" | v1.1 nhận 1–3 | `--night 4` |
| `tests/playthrough.test.js` "bot thắng seed 1–3 Đêm 1" | luật khó hơn, bot thắng Đêm 1 seed 3 | seed 3 phải thắng; Đêm 2/3 kiểm phát lại qua CLI cho đúng cùng kết quả |

## 5. Đánh giá Phase 2

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| P2-1 … P2-5, P2-12 | **Đạt** | 47 scenario + 26 test khác xanh — [proof](../proof/phase-2/README.md) |
| P2-6 … P2-11 | **Đạt** (kiểm trên trình duyệt + ảnh) | `docs/proof/phase-2/screens/` |
| P2-13 | **Đạt** headless; web: đo chi phí khung ~2.5 ms ở 1280×720 (≈ 400 khung/s trần), không đo được FPS thật vì pane trình duyệt bị ẩn | proof README |

Giới hạn trung thực:
- **Bot không thắng Đêm 2/3** (thắng Đêm 1 seed 3; seed khác thua). Game có thể khó với số chuẩn; chưa có người chơi thật thử.
- Âm thanh chỉ kiểm bằng đọc mã (không ghi được âm thanh trong môi trường kiểm thử).
- FPS thật chưa đo trên màn hình hiển thị; con số trên là thời gian CPU+GPU mỗi khung khi ép đồng bộ.
