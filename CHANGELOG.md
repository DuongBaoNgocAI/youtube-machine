# Nhật ký thay đổi

## 1.1.0 (2026-11-23)
- Skill mới `yt-07k-khoi-vuong`: làm Shorts dọc 3D từ kịch bản hoặc SRT, dựng ngay trên máy bằng trình duyệt, không tốn tín dụng hình.
- Chọn 1 trong 10 phong cách trước khi làm: khối pixel, đồ chơi nhựa vượt ải, kinh dị retro, low-poly phiêu lưu, neon tương lai, pixel 16-bit, đất sét, giấy gấp, sa bàn thu nhỏ, len nỉ.
- Có 4 mặt bằng, nhân vật phụ, phụ đề chạy theo từng từ, nhạc và tiếng động tự tổng hợp. Hình và nhân vật tự thiết kế, không lấy của hãng game nào.
- Cần Node 18 trở lên, ffmpeg, Chrome hoặc Edge. Không cần Blender hay Flow.
- Skill đã làm 3 Shorts thật, trong đó có kinh dị retro và giấy gấp. Các phong cách còn lại mới chạy bản mẫu.
- Cập nhật qua chat của bản 1.0.1 đã chạy thật với máy chủ: nâng 1.0.0 lên 1.0.1 đúng, giữ nguyên hồ sơ kênh.

## 1.0.1 (2026-11-23)
- Cập nhật qua chat. Khi có bản mới, trợ lý báo ngay đầu phiên. Bạn nói "cập nhật YouTube Machine" là trợ lý tải đúng bản tài khoản của bạn được dùng rồi thay các file của bộ skill. Thư mục `channels/` giữ nguyên.
- File cũ bị thay được chuyển vào `_thung-rac/cap-nhat-<bản cũ>-sang-<bản mới>-<giờ>/`. Bạn tự xóa khi không cần nữa.
- Đã tự tải zip ở trang YouTube Machine thì nói "cập nhật YouTube Machine từ file zip" kèm đường dẫn file.
- Đầu phiên báo đúng bản đang cài trên máy. Bản 1.0.0 có thể báo "đã cập nhật" khi chỉ nội dung skill trên máy chủ đổi, còn gói trên máy vẫn là bản cũ.
- Riêng bản này phải tải bằng tay một lần, vì gói 1.0.0 chưa có lệnh cập nhật. Từ 1.0.1 trở đi chỉ cần nói với trợ lý.
- Hướng dẫn cài gộp vào `README.md`, bỏ file `HUONG-DAN-CAI.md`. Thêm `README.en.md` bản tiếng Anh.
- Cập nhật qua chat đã thử trên Windows với máy chủ thử, chưa chạy với máy chủ thật.

## 1.0.0 (2026-11-21)
- Nội dung skill chuyển lên máy chủ. Trợ lý đọc skill qua Cổng YTM (`tools/ytm-cong.mjs`), một máy chủ MCP chạy trên máy bạn. Gói cài chỉ còn skill giữ chỗ, script và mẫu.
- Lần đầu trên mỗi máy, đăng nhập bằng Gmail đã đăng ký: trợ lý mở trang chọn tài khoản Google, bạn bấm chọn, xong. Không có mã phải nhập, trợ lý không thấy mật khẩu.
- Mỗi tài khoản dùng trên tối đa 2 máy. Gỡ máy cũ ở mục Tải về trên trang YouTube Machine.
- Cần mạng khi dùng. Bản 0.x đã tải vẫn chạy như cũ.
- Bỏ hỗ trợ chatbot web (ChatGPT web, Gemini web): gói không còn file `dist/youtube-machine-goi.md`.
- Mới thử trên Claude Code ở Windows. Gemini CLI, Antigravity, Codex chưa thử với Cổng YTM.

## 0.13.1 (2026-11-12)
- Thêm danh sách repo nguồn mở cho phim hoạt hình ở bước dựng video (`yt-07e-render/references/repo-hoat-hinh.md`), xếp theo công đoạn: khớp miệng, chuyển động từ BVH và từ câu chữ, uốn hình và rối 2D, chèn khung, tạo clip trên máy nhà khi Flow bị chặn, storyboard và tô màu.
- Mỗi repo ghi giấy phép và trạng thái: đã dùng trong video thật, đã học để viết lại, hoặc chưa thử. Có luật giấy phép riêng cho mô hình AI, vì code và trọng số có thể theo hai giấy phép khác nhau.
- Có bảng nối 9 hình miệng của Rhubarb Lip Sync với bộ miệng Flow vẽ theo âm. Bản hoàn chỉnh của hoạt hình rối có thể khớp miệng theo âm thay vì chỉ mở và đóng.
- Trợ lý chỉ đề xuất repo khi một khâu cụ thể cần làm tốt hơn, và hỏi trước khi tải. Repo không nằm trong gói.
- Chỉ RIFE đã chạy trong video thật. Các repo còn lại chưa được thử trong quy trình này.

## 0.13.0 (2026-11-08)
- Thêm luật dựng từng đoạn cho mọi bước dựng. Video được chia thành đoạn 1-3 phút theo chặng, đoạn hook duyệt trước, các đoạn sau gửi duyệt 2-3 đoạn một lần. Sai ở đoạn nào chỉ dựng lại đoạn đó, không phải dựng lại cả clip.
- Kế hoạch dựng có thêm bảng đoạn dựng, ghi trạng thái từng đoạn: chờ duyệt, đã duyệt, cần sửa, chưa ai xem. Đoạn chưa ai xem không bị tính là đã duyệt.
- Thêm `tools/blender/ghep_doan.py`: ghép các đoạn đã duyệt, hình không nén lại, tiếng chuẩn hóa -14 LUFS một lần. `ghep_video.py` thêm cờ `--doan-cuoi` cho đoạn cuối.
- Đường CapCut dựng theo chặng, mỗi chặng xuất thử một lần. Motion, cắt theo lời và Shorts duyệt cái đầu trước rồi mới làm tiếp. Bước soát xem thêm các điểm nối.
- Công cụ ghép mới chỉ thử trên clip mẫu, chưa chạy trên video thật của kênh.

## 0.12.0 (2026-11-08)
- Thêm skill `yt-mo-xe-dung`: mổ xẻ cách dựng video đối thủ. Dán link là chạy, không phải chụp màn hình.
- Máy đo nhịp cắt theo từng đoạn, ra tờ khung có số cảnh và mốc giờ, gắn lời vào từng cảnh, đo xem tiếng động có rơi đúng điểm cắt không, tìm khoảng lặng. Trợ lý xem hết tờ khung rồi viết cấu trúc câu chuyện, chữ trên hình, cách chuyển cảnh, và cơ chế học được cho kênh mình kèm danh sách không được chép.
- Video tải tạm để phân tích rồi tự xóa, chỉ giữ ảnh khung và lời. Không dùng để đăng lại hay cắt đoạn của người khác.
- Bước 2 đề xuất mổ xẻ 2-3 video vượt trội, bước 7d đọc lại bản mổ xẻ trước khi lập kế hoạch dựng.
- Cần ffmpeg và yt-dlp. Đã chạy thật trên một video hoạt hình gần 11 phút ở Windows. Chưa thử trên Mac và trên Shorts dọc.

## 0.11.1 (2026-11-06)
- Sửa hướng dẫn Flow AIC: mỗi prompt ghép đủ khóa phong cách, vì đã có lần kênh không tự gắn khóa. Xem 4-6 ảnh đầu trước khi tạo tiếp.
- Thêm cảnh báo clip có thể tự chạy nếu bật video khi hàng đợi ảnh chưa rỗng, và cách đọc số tín dụng đã dùng.
- Khuyên dùng Flow AIC từ 1.16.0. Bản cũ có thể tự gửi lại clip và trừ thêm tín dụng.

## 0.11.0 (2026-11-06)
- Thêm 5 skill: chuẩn bị quay, cắt theo lời, cắt Shorts dọc, soát thành phẩm, làm thumbnail.
- Cắt video như sửa văn bản: bóc lời, đọc bản cắt, bỏ câu hỏng và khoảng lặng, file gốc giữ nguyên, phụ đề tự theo thời gian mới. Đã đo trên video mẫu: sau 38 lần cắt, hình và tiếng không lệch dần. Chưa thử trên video quay thật, nên đường Quay trước vẫn là bản thử.
- Mọi video có bước soát trước khi đăng: máy đo kỹ thuật, một người soát độc lập đối chiếu thành phẩm với lời hứa.
- Thumbnail ghép chữ bằng máy, tự dừng khi font thiếu dấu tiếng Việt, có tờ so ở cỡ nhỏ.
- Motion thêm quy tắc chữ đọc được, liều lượng, tiếng trúng cú chạm, và 7 công thức mới.
- Chưa có: tự dò mặt khi cắt dọc, tìm tiếng hiệu ứng trên mạng, bóc lời miễn phí tiếng Việt.

## 0.10.2 (2026-11-06)
- Trước khi chốt dàn ý, viết ba cấu trúc khác nhau và mốc chuẩn học gì, không lấy gì, để tránh ý đầu tiên sáo mòn.
- Sổ khác biệt thêm cảnh đặc trưng và hình dạng nhạc. Mỗi video đổi ít nhất 3 trong 6 cột so với video liền trước.
- Thêm luật bằng chứng: sổ tuyên bố có nguyên văn, sổ tư liệu có giấy phép và giây đã dùng, luật riêng cho bản đồ.
- Phong cách kênh thêm phần bản chất: không phải là gì, được đổi gì, đổi là mất chất, chiêu riêng của chất liệu.

## 0.10.1 (2026-11-06)
- Motion thêm mô phỏng chạy từ dữ liệu thật và kiểu một đơn vị một dấu. Mô phỏng trên Canvas đã dựng thử một đoạn ngắn, chưa dùng trên video thật.
- Motion thêm bước duyệt khung trắng: chốt bố cục và nhịp trước khi phủ màu, ảnh.
- Thêm chế độ xen đồ họa vào video quay và podcast, là bản thử.
- Thêm kiểu mỗi đoạn một phong cách, và các khuôn mới: theo một ví dụ thật, bài viết thành video, dẫn qua một luồng thật, biên niên đổi mô-típ theo thời đại.

## 0.10.0 (2026-11-06)
- Bộ skill không còn chỉ dành cho video kể chuyện. Mỗi video có định dạng và đường sản xuất riêng, có 16 công thức: kể chuyện, giải thích, top, tin tức, tài liệu, phim ngắn, nói trước ống kính, review, vlog, podcast, hướng dẫn, gameplay, nhạc nền, dữ liệu, tổng hợp và Shorts.
- Thêm năm cổng giá trị cho mọi video: thẻ giá trị, sổ khác biệt, cắt mỡ, soát thành phẩm, học từ người xem.
- Thêm `tools/chong-lap.mjs`: so kịch bản với các video trước, báo câu mở giống nhau, lời trùng, câu lặp, chuỗi cùng kiểu.
- Chỉ đường Lời trước đã chạy thật. Các đường còn lại là bản thử, chưa có công cụ riêng, nhiều phần còn phải làm tay.
- Kênh đang làm dở không phải đổi gì.

## 0.9.3 (2026-11-06)
- Thêm skill `yt-osint`: tra nguồn cho video. Tìm tài liệu gốc, kiểm chứng tuyên bố, tìm nguồn gốc ảnh, lấy số liệu, bản đồ và tư liệu địa lý, ghi danh sách nguồn có link.
- Có 112 công cụ chọn lọc từ trang OSINT4ALL, kèm lệnh kiểm tra link định kỳ.
- Các bước 2, 3, 6b, 6c, 7, 7c, 7m, 8 đề xuất một dòng khi cần tra cứu, bạn đồng ý mới chạy.
- Skill không tìm thông tin người riêng tư, không dùng dữ liệu rò rỉ, giấy tờ giả, tìm mặt người hay camera không bảo mật.

## 0.9.2 (2026-11-05)
- Thêm skill `yt-07m-motion`: dựng motion graphics khi bạn yêu cầu. Chữ chạy theo giọng đọc, số đếm đúng lúc nói, bản đồ có tuyến đường vẽ dần, sơ đồ giải thích, chuyển cảnh có nguyên cớ.
- Làm được hai kiểu: chèn đoạn motion vào video có sẵn, hoặc làm cả video bằng motion. Không cần dựng lại Blender hay CapCut.
- Thêm `tools/motion`: ghép motion vào MP4, tự tạo bộ tiếng hiệu ứng không vướng giấy phép.
- Motion dùng HyperFrames miễn phí, chạy qua Node.js, lần đầu cần mạng.

## 0.9.1 (2026-11-03)
- Bước 7b hỏi bạn có muốn tạo giọng đọc luôn không. Có thì dán khóa API (ElevenLabs hoặc aicong.pro) vào ô chat; Claude quét thư viện giọng, đề xuất vài giọng hợp kênh kèm mẫu nghe, tạo luôn MP3 và phụ đề SRT sau khi báo số ký tự.
- Giọng đã chọn lưu trong hồ sơ kênh, video sau dùng lại. Khóa API chỉ lưu trong máy của bạn.
- Cập nhật theo chính sách YouTube hiện hành: khai báo nội dung AI, dùng trích đoạn (fair use), nhân vật AI đóng vai chuyên gia, hashtag, ngưỡng CTR và thử A/B thumbnail.
- Chỉnh giờ đăng gợi ý, nhịp đăng cho kênh mới, số cảnh ước tính của video 10 phút.

## 0.9.0 (2026-10-30)
- Bản thử đầu tiên, gửi cho một nhóm nhỏ trước khi bán.
- 19 skill từ chọn ngách tới học từ số liệu, luôn hỏi trước khi làm.
- Dựng video bằng Blender hoặc CapCut, tùy cấu hình máy.
- Dùng được Flow AIC và Eureka AIC khi có; không có thì đi đường web và công cụ khác.
- Luôn hỏi chọn model trước khi tạo video.
- Có link và cách tải Flow AIC, Eureka AIC.
