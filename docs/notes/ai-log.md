# Nhật ký dùng AI

Công cụ: **Claude Code** (desktop app, model Claude Opus 5.5), gói **Pro**. Harness: [AGENTS.md](../../AGENTS.md) (CLAUDE.md trỏ tới), Stop hook [scripts/hooks/stop-tests.js](../../scripts/hooks/stop-tests.js) cấu hình ở [.claude/settings.json](../../.claude/settings.json), skill [verify-headless](../../.claude/skills/verify-headless/SKILL.md), agent review [contract-reviewer](../../.claude/agents/contract-reviewer.md), CI [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

## Phase 1

**Lời nhắc chính:** "Read all the md file and complete all the task" — agent đọc 6 file lab + tab Phase 1 trên lab board, rồi tự lập kế hoạch: sim tất định → CLI headless → scenario test → bản 3D → bằng chứng → ghi chép → tag.

**Token / chi phí (số đo thật, không đoán):**

| Thời điểm | Ngữ cảnh phiên | Hạn mức Pro 5 giờ |
|---|---|---|
| Sau khi code + kiểm chứng xong, trước ghi chép | ~226k token (tin nhắn ~169k, công cụ/hệ thống ~57k) | 14 % |

Gói Pro tính theo hạn mức chứ không theo tiền; nếu quy ra API thì phần lớn ngữ cảnh là cache nên chi phí thấp hơn nhiều so với 226k token đầu vào mới mỗi lượt.

**Cách tiết kiệm token đã dùng:**
- Chỉ đọc lab board **một lần**, trích phần text (≈10 KB) thay vì giữ 180 KB HTML trong ngữ cảnh.
- Dùng một mô hình mạnh nhưng không chạy subagent song song (mỗi subagent phải đọc lại toàn bộ ngữ cảnh).
- Viết scenario với số kỳ vọng tính tay **trước** khi chạy → hầu hết pass ngay lần đầu, chỉ 1 vòng sửa.
- Lọc output test bằng `grep`/`tail` thay vì đổ toàn bộ log.
- Kiểm thử trình duyệt bằng `window.__game.tick()` + đọc state JSON; chỉ chụp ảnh ở các khung cần làm bằng chứng.

## Các lần AI sai và cách phát hiện

| # | Sai gì | Phát hiện bằng | Sửa / chỉnh harness |
|---|---|---|---|
| 1 | Scenario `default-level` kỳ vọng Bóng Mực thứ 3 sinh ở tick 1200, nhưng người chơi đứng yên đã bị đánh bại trước đó (~tick 780) | Test đỏ: `shade_spawned` rỗng | Tách scenario: kiểm sinh quái khi người chơi đứng trong vùng an toàn của đèn đã sáng. Bài học: scenario dài phải tính đến cái chết của người chơi |
| 2 | `npm test` dùng `node --test tests/` — Node 24 không nhận thư mục làm đối số | Lỗi "Cannot find module …\tests" | Đổi thành `node --test` (tự tìm `*.test.js`) |
| 3 | Hook viết `require('node:fs')` trong ES module | Tự đọc lại trước khi chạy | Đổi sang `import`; kiểm hook bằng một test đỏ tạm thời (exit 2) rồi xóa |
| 4 | Toast của ván trước còn hiện sau khi chơi lại | Ảnh chụp trong trình duyệt | `newGame()` ẩn toast. Bài học: luôn chụp lại sau khi restart |
| 5 | Bản đầu bụi cây quá to và tối, che đảo | Ảnh chụp | Thu nhỏ, đổi màu, tăng ánh sáng nền |
| 6 | Kiểm thử trình duyệt: sim gần như không chạy (8 tick) | Đọc state JSON thay vì tin ảnh | Pane trình duyệt bị ẩn → `requestAnimationFrame` dừng. Thêm `__game.tick(n)` đi qua đúng đường input thật; ghi vào skill |

Không phát hiện AI bịa yêu cầu; các chỗ mơ hồ được ghi thành giả định A1–A16 trong [phase-1.md](phase-1.md) thay vì coi là yêu cầu.

## Tự soát lỗi biên (thay cho reviewer riêng ở Phase 1)
- Bán kính đúng biên (`≤`): đom đóm cách 1.5 m được nhặt ở tick 35, đèn cách 2.6 m không nạp được.
- Bóng Mực ở ngay vị trí người chơi khi pulse: đẩy theo hướng di chuyển cuối.
- Bóng Mực trong vùng đèn vừa thắp: bị đẩy ra ngay trong bước đó.
- Làm tròn 3 chữ số không làm khoảng cách tới đèn < 4 m (đặt ở 4.002 m).
