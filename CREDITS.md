# Credits

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Nhân vật, bối cảnh, tên gọi (Mây, Bóng Mực, Đảo Đèn Lồng, Đảo Bến) | Bản gốc của lab Day 12 AI SDLC | theo lab |
| Cú Tí (nhân vật phụ) | Tự tạo cho bài này | MIT |
| Thư viện 3D: [three.js](https://threejs.org) 0.160.0 (qua npm) | mrdoob & contributors | MIT |
| Mô hình 3D (Mây, đèn, Bóng Mực, đảo, cú…) | Dựng thủ tục bằng primitive của three.js trong `src/web/main.js` | MIT (bài này) |
| Âm thanh | Tổng hợp trực tiếp bằng WebAudio trong `src/web/audio.js`, không dùng file âm thanh | MIT (bài này) |
| Code, test, tài liệu | Viết cùng **Claude Code** (Anthropic, model Claude Opus 5.5), người học điều phối và review — xem `docs/notes/ai-log.md` | MIT |

Không dùng asset bên ngoài nào khác.

## Thêm từ Phase 2–4
- **Playwright** 1.65.1 (Apache-2.0) — chỉ dùng để mở cửa sổ trình duyệt cho lệnh benchmark.
- Mọi mô hình 3D, âm thanh (WebAudio tổng hợp), bản đồ, lời thoại Ông Đăng: tự làm trong mã, không dùng asset ngoài.
- Công cụ AI: Claude Code (Claude Opus 5.5) viết phần lớn mã, test và tài liệu theo yêu cầu và dưới kiểm tra của tác giả; không dùng AI tạo ảnh/âm thanh.
