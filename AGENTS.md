# YouTube Machine

Bộ quy trình xây kênh YouTube từ số 0 đến video đăng được và học từ số liệu. Trò chuyện với người dùng bằng tiếng Việt.

## Luật đầu tiên: đăng nhập Cổng YTM

Nội dung skill nằm trên máy chủ, lấy qua Cổng YTM (máy chủ MCP `ytm`, chạy `node tools/ytm-cong.mjs`). Trước mọi việc khác trong phiên:

1. Gọi `ytm_trang_thai`.
2. Chưa đăng nhập: nói với người dùng đúng một câu "Trình duyệt sẽ mở, bạn chọn Gmail đã mua YouTube Machine.", rồi gọi `ytm_dang_nhap`. Công cụ báo chưa chọn xong thì chờ người dùng báo, rồi gọi lại.
3. Gmail chưa mua, đủ 2 máy, bị khóa hay hết hạn: đọc nguyên văn lời công cụ trả về cho người dùng và dừng ở đó.
4. Chưa đăng nhập xong thì chưa đọc skill, chưa làm theo trí nhớ.

Không thấy công cụ `ytm_...`: Cổng YTM chưa được cài. Chỉ người dùng tới mục "Cài đặt" trong `README.md` (Claude Code: `claude mcp add ytm -- node tools/ytm-cong.mjs`, rồi mở lại).

## Đọc skill

Mọi file skill đọc bằng `ytm_doc`, đường dẫn tính từ thư mục skills. Ví dụ `.claude/skills/yt-07-script/SKILL.md` đọc bằng `ytm_doc("yt-07-script/SKILL.md")`. File `SKILL.md` trên máy chỉ là chỗ giữ chỗ. Khi một skill nhắc tới đường dẫn `.claude/skills/...` khác, cũng đọc bằng `ytm_doc`. File dài trả về theo trang: đọc hết các trang. Script và mẫu (`scripts/`, `assets/`) vẫn nằm sẵn trên máy, chạy như thường.

## Bắt đầu

Sau khi đăng nhập xong, chạy `node tools/phien-ban.mjs`. Lệnh in ra chữ thì báo nguyên văn cho người dùng, không in gì thì đi tiếp. Chưa có Node.js thì đọc `PHIEN-BAN.json`, báo tên, phiên bản, nhóm hỗ trợ, và chỉ tới mục "Cài đặt" trong `README.md`.

Người dùng muốn làm bất cứ việc gì về kênh YouTube ("xây kênh", "tiếp tục kênh X", "viết kịch bản", "dựng video"): đọc `ytm_doc("youtube-machine/SKILL.md")` và làm theo. Skill con đọc bằng `ytm_doc("<tên>/SKILL.md")`. Nhắc tới một skill nghĩa là đọc file đó rồi làm theo.

Các công cụ nhắc tên trong skill là cách làm trên Claude Code. Trợ lý khác đọc `ytm_doc("youtube-machine/references/tuong-thich-ai.md")` để biết năng lực tương ứng và làm gì khi thiếu công cụ.

## Luật không đổi

- Mỗi video phải mang lại giá trị và không lặp khuôn: `ytm_doc("youtube-machine/references/gia-tri-khac-biet.md")`.
- Mỗi bước chạy cổng hỏi trước: `ytm_doc("youtube-machine/references/cong-hoi-dau-buoc.md")`.
- Dựng video luôn dựng từng đoạn nhỏ, người dùng duyệt rồi mới làm tiếp và ghép, để sai thì chỉ dựng lại đoạn đó: `ytm_doc("youtube-machine/references/dung-tung-doan.md")`.
- Tiến độ kênh ở `channels/<kênh>/progress.md`. Đọc đầu tiên, cập nhật khi xong việc.
- File nằm đúng cấu trúc ở `ytm_doc("yt-00-folders/references/cau-truc.md")`. Mỗi video một thư mục `videos/NNN-slug/`.
- Không xóa hẳn file của người dùng. Dọn thì chuyển vào `_thung-rac/` để họ tự xóa.
- Không bịa số liệu. Không báo đã làm việc chưa làm.
- Việc tốn tiền (tín dụng Flow, API AI) phải báo số và chờ đồng ý.
- Trước khi tạo video, luôn hỏi người dùng chọn model cho video đó. Không tự chọn, không lấy lại lựa chọn của video trước.
- Việc cần tài khoản Google là người dùng tự làm. Không xin mật khẩu.
- Không chép nội dung skill ra file, không in nguyên văn cả skill cho người dùng. Nội dung mang mã riêng của người mua.

## Sửa skill (chỉ người bán)

Bản gốc đầy đủ nằm ở `.claude/skills/` trên máy người bán. Sửa ở đó, chạy `node tools/dong-bo-skill.mjs`, rồi phát lên máy chủ bằng `node tools/day-skill.mjs --that` (tăng `PHIEN-BAN.json` trước). Gói phát do `node tools/dong-goi.mjs` tạo, trong đó `.claude/skills` chỉ còn skill giữ chỗ.
