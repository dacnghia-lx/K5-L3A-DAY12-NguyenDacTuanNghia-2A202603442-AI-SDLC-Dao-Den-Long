# Retro — Đảo Đèn Lồng (4 phase)

## 1. Tổng hợp Evaluation

| Phase | Kết quả chính | Test | Chưa đạt / giới hạn |
|---|---|---|---|
| 1 PRD-0 | Đêm 1 chơi được, contract v1.0, bot thắng 5/5 seed | 39 | Chưa có người chơi thử |
| 2 Ba hòn đảo | Số chuẩn, 3 bản đồ, lướt, rơi, Gió Lạc, Bùa Gió, tạm dừng, cài đặt, contract v1.1 | 73 | Bot chỉ thắng 1/5 ván Đêm 1 |
| 3 Đèn cạn dầu | Nhiên liệu, hút dầu, thắng lúc bình minh, sức chứa, mù màu, ADR, contract v1.2 | 90 | Bot không giữ được 3 đèn tới bình minh |
| 4 v1.0.0 | Bench 782 FPS / p1 309, soak 0 crash ×1.004, bảng xếp hạng, đổi phím, phụ đề, đóng gói, contract v1.3 | 96 | Video do người quay; Release tạo trên GitHub |

Tổng: 62 scenario headless qua CLI thật (số kỳ vọng tính tay), tất định từng byte, 15 lỗi AI được ghi lại ([ai-log.md](ai-log.md)).

## 2. Điều hiệu quả / không hiệu quả khi làm với AI

**Hiệu quả**
- **Một bộ luật duy nhất (`src/sim/`)** cho headless và bản 3D: mỗi ticket chỉ sửa luật một chỗ, bản web tự đúng theo.
- **Viết scenario với số tính tay trước khi chạy**: Phase 3 có 62/62 đạt ngay lần đầu; khi test đỏ thì phải quyết định *code sai hay kỳ vọng sai* (lần 7, 8 là kỳ vọng sai và đã ghi lý do).
- **Ghi trước các luật [THAY THẾ] và test sẽ sai** (Phase 3) trước khi sửa code → không test nào bị skip.
- Lưu ticket vào `docs/lab/tickets/` để agent đọc lại không cần trình duyệt.

**Không hiệu quả**
- Nội dung ticket chỉ hiện sau đăng nhập: mất nhiều lượt mới đọc được (phải dùng Edge của người dùng).
- Viết lệnh `node -e` dài trong bash: hỏng escape 2 lần → chuyển sang file `.mjs` hoặc công cụ Edit.
- Bot tham lam không theo kịp độ khó tăng dần; bằng chứng "chơi trọn" yếu dần qua các phase.
- Chỗ ticket bỏ trống (hành vi `wander`) do AI tự nghĩ đã làm game gần như không thắng được, chỉ phát hiện khi cho bot chơi.

## 3. Những lần AI sai và cách phát hiện (tóm tắt)

15 lần, chi tiết ở [ai-log.md](ai-log.md). Phát hiện chủ yếu bằng: test đỏ (5 lần), ảnh chụp trình duyệt (5), chạy thử headless/bot và đọc output (4), tự đọc lại code (1). Không lần nào phải sửa tay output để khớp.

## 4. Harness giúp nhiều nhất

1. **`AGENTS.md`** — thứ tự tick bắt buộc, "fuel là số nguyên 1/60", "tính năng mới phải có scenario trước", "không skip test". Giữ các phase sau nhất quán.
2. **Stop hook chặn kết thúc khi test đỏ** — không lần nào commit khi đỏ.
3. **Skill `verify-headless`** — quy trình bằng chứng lặp lại được; bổ sung cảnh báo `__shot` chỉ chụp canvas.
4. `scripts/proof.js` sinh báo cáo từ commit sạch → bằng chứng khớp tag.

## 5. Token / chi phí và cách tiết kiệm

Số đo thật (Claude Code, gói **Pro**, model Opus 5.5): cuối Phase 4 ngữ cảnh phiên ~**669k token** (tin nhắn ~602k, công cụ/hệ thống ~66k); dùng **88 % hạn mức 5 giờ** và **49 % hạn mức tuần**. Gói Pro tính theo hạn mức, không theo tiền; phần lớn token là cache nên chi phí API quy đổi thấp hơn nhiều so với 669k token mới mỗi lượt.

Tiết kiệm: không dùng subagent (mỗi cái đọc lại cả ngữ cảnh); lọc output test (`grep`, `tail`); kiểm trình duyệt bằng `window.__game` + JSON thay vì nhiều ảnh; ảnh chụp tỉ lệ 0.5–0.6 khi chỉ cần xem bố cục; vá file bằng script thay vì đọc lại file lớn.

## 6. Nếu làm lại

- Đọc **cả 4 ticket ngay từ đầu** (chúng đã mở sẵn) để thiết kế dữ liệu (bản đồ, nhiên liệu) một lần.
- Viết bot thông minh hơn sớm (né Bóng Mực, giữ đèn) để luôn có bằng chứng "chơi trọn thắng".
- Tag và **push từng phase đúng hạn** thay vì dồn cuối.
- Tách `main.js` (≈ 1000 dòng) thành module HUD / menu / input ngay từ Phase 2.

## Kịch bản video demo (< 5 phút, người dùng quay)

1. (0:00–1:30) `npm start`, menu → Đêm 1: nhặt đom đóm, thắp đèn, châm dầu, Tỏa Sáng xua Bóng Mực; tạm dừng → cài đặt (mù màu, đổi phím).
2. (1:30–2:15) Đêm 2: cầu tre, bục nhảy, Gió Lạc; Đêm 3: dốc, tầng, gió.
3. (2:15–3:15) `npm test` (96 đạt); một lệnh headless; `npm run bench` (đọc `bench.json`); `npm run soak`.
4. (3:15–4:30) Lướt `AGENTS.md`, `.claude/`, `docs/proof/`, `git log --oneline`, các tag.
