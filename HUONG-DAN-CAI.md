# Hướng dẫn cài YouTube Machine trên Windows

Làm lần lượt từ bước 1 đến bước 5, mất khoảng 15-30 phút. Bạn không cần biết lập trình. Lệnh nào cần gõ, bạn chỉ việc chép và dán.

Bạn cần có: Windows 10 hoặc 11, kết nối mạng, ổ đĩa còn trống nhiều (mỗi video thường chiếm 1-4 GB, nên chọn ổ còn từ 100 GB).

## Bước 1: Tải và giải nén

Tải bộ skill từ trang GitHub `DuongBaoNgocAI/youtube-machine`: bấm **Code → Download ZIP**. Biết dùng git thì chạy `git clone https://github.com/DuongBaoNgocAI/youtube-machine.git D:\YoutubeMachine` rồi sang bước 2.

1. Chuột phải vào file zip, chọn **Extract All**.
2. Chọn nơi lưu có đường dẫn ngắn, không dấu, ví dụ `D:\YoutubeMachine`. Không để trong `Program Files` hay thư mục đồng bộ OneDrive.
3. Mở thư mục vừa giải nén. Bạn phải thấy các file `README.md`, `AGENTS.md`, `HUONG-DAN-CAI.md` ngay bên trong. Nếu chỉ thấy một thư mục `youtube-machine`, hãy mở tiếp thư mục đó. Đây là thư mục gốc, các bước sau đều dùng nó.

## Bước 2: Cài Node.js

Node.js là chương trình chạy các công cụ đi kèm bộ skill.

1. Vào [nodejs.org](https://nodejs.org), tải bản **LTS**.
2. Mở file vừa tải, bấm **Next** tới hết, giữ nguyên lựa chọn có sẵn.
3. Bấm Start, gõ `PowerShell`, mở lên, dán lệnh này rồi Enter:

```bash
node -v
```

Hiện ra số phiên bản như `v22...` là được. Hiện lỗi `not recognized` thì đóng PowerShell, mở lại rồi thử lần nữa; vẫn lỗi thì khởi động lại máy.

## Bước 3: Cài trợ lý AI

Chọn một trợ lý chạy được lệnh trên máy bạn. Bộ skill dùng với các trợ lý sau:

| Trợ lý | Cách mở bộ skill |
|---|---|
| Claude (ứng dụng Claude cho máy tính, tab Code, hoặc Claude Code) | Chọn thư mục gốc làm thư mục làm việc |
| Google Antigravity | File, Open Folder, chọn thư mục gốc |
| Codex hoặc ứng dụng ChatGPT trên máy tính có chế độ làm việc với thư mục | Mở thư mục gốc |
| Gemini CLI | Mở PowerShell tại thư mục gốc rồi chạy `gemini` |

Mỗi trợ lý cần tài khoản riêng của nhà cung cấp.

Từ bản 1.0, ChatGPT, Gemini và các chatbot bản web không dùng được bộ skill, vì chúng không chạy được Cổng YTM.

### Cổng YTM

Từ bản 1.0, nội dung skill nằm trên máy chủ. Trợ lý lấy nội dung qua Cổng YTM (`tools/ytm-cong.mjs`), một chương trình nhỏ chạy trên máy bạn. Cần có mạng khi dùng.

- **Claude Code / app Claude (tab Code):** mở thư mục gốc. Claude hỏi có dùng máy chủ MCP `ytm` trong file `.mcp.json` không thì chọn đồng ý. Không thấy câu hỏi thì mở PowerShell tại thư mục gốc, chạy lệnh dưới, rồi mở lại Claude:

```bash
claude mcp add ytm -- node tools/ytm-cong.mjs
```

- **Gemini CLI, Antigravity, Codex:** cách cài sẽ có ở bản sau.

## Bước 4: Mở lần đầu

Mở trợ lý tại thư mục gốc và gõ:

> Tôi muốn xây kênh YouTube mới

Lần đầu trên mỗi máy, trợ lý mở trình duyệt tới trang chọn tài khoản Google. Bạn bấm chọn **Gmail đã đăng ký YouTube Machine**. Trình duyệt báo "Đã đăng nhập" thì quay lại cửa sổ trợ lý. Mỗi tài khoản dùng được trên 2 máy. Muốn đổi máy thì gỡ máy cũ ở mục Tải về trên trang YouTube Machine.

Trợ lý sẽ báo phiên bản đã cài và nhóm hỗ trợ. Không thấy thông báo thì gõ: `Chạy lệnh node tools/phien-ban.mjs --xem cho tôi xem`.

Sau đó trợ lý dò máy, đề xuất dựng bằng Blender hay CapCut, rồi hỏi vài câu để dẫn bạn từ bước 1. Trợ lý xin phép chạy lệnh thì đọc qua rồi cho phép. Đừng đưa mật khẩu Google cho trợ lý; việc cần tài khoản Google bạn tự làm theo danh sách nó đưa.

## Bước 5: Cài công cụ theo nhu cầu

Không cần cài hết ngay. Tới bước nào, trợ lý sẽ báo bước đó cần gì.

| Công cụ | Dùng để | Có bắt buộc không |
|---|---|---|
| ElevenLabs | Tạo giọng đọc và phụ đề | Hoặc aicong.pro, hoặc công cụ khác xuất được MP3 và SRT. Có khóa API thì Claude tạo giọng và SRT giúp bạn |
| Flow AIC | Tạo ảnh và clip hàng loạt | Không. Thiếu thì bạn dùng công cụ tạo hình khác và đặt file đúng tên |
| CapCut | Dựng tay, hợp máy yếu | Chọn CapCut hoặc Blender |
| Blender 5.x và ffmpeg | Dựng tự động, cần máy khỏe hơn | Chọn CapCut hoặc Blender |
| HyperFrames và ffmpeg | Motion khi bạn yêu cầu | Không. Tự tải qua `npx` lúc dùng, lần đầu cần mạng |

Các công cụ trên không đi kèm bộ skill và có điều khoản riêng.

**Tải Flow AIC:**

| App | Trang tải bản mới nhất |
|---|---|
| Flow AIC | https://github.com/DuongBaoNgocAI/flow-aic-releases/releases/latest |

1. Mở trang tải, kéo xuống mục **Assets**.
2. Bấm file có đuôi `.exe`, tên dạng `Flow-AIC-Setup-...exe`.
3. Mở file vừa tải và cài. Windows cảnh báo khi mở file thì kiểm tra lại file đúng từ trang trên; chưa chắc thì hỏi nhóm hỗ trợ trước khi mở.
4. Nối với trợ lý. Flow AIC: vào Cài đặt, bật **Cho Claude điều khiển**, bấm **Chép lệnh kết nối**, dán vào PowerShell, mở lại trợ lý.
5. Kiểm tra bằng cách gõ cho trợ lý: "Kiểm tra Flow AIC đã kết nối chưa".

**Cài Blender:** tải bản 5.x ở [blender.org](https://www.blender.org/download/), cài với lựa chọn có sẵn.

**Cài ffmpeg:** mở PowerShell, chạy lệnh dưới, rồi đóng và mở lại trợ lý.

```bash
winget install Gyan.FFmpeg
```

**Kiểm tra máy đã đủ chưa** (chạy trong PowerShell tại thư mục gốc, hoặc nhờ trợ lý chạy):

```bash
node tools/do-may.mjs
```

**Hiệu ứng nâng cao của đường Blender** không có sẵn trong gói vì quá nặng. Bạn vẫn dựng được video khi chưa có chúng.

- Lớp phủ bụi, sương, mưa, tuyết, lửa, khói: nói với trợ lý "tạo lớp phủ cho Blender". Tốn khoảng 4 GB, phần lửa và khói chạy khoảng 1-2 giờ, chỉ cần làm một lần.
- Parallax (ảnh có chiều sâu khi máy di chuyển): nói với trợ lý "cài parallax cho Blender". Trợ lý cài thư viện và tải model khoảng 200 MB.

## Lỗi thường gặp

| Bạn thấy | Làm gì |
|---|---|
| `node` is not recognized | Làm lại bước 2, rồi khởi động lại máy |
| Trợ lý không biết quy trình YouTube Machine | Kiểm tra đã mở đúng thư mục gốc, nơi có file `AGENTS.md`, rồi mở phiên mới |
| Trợ lý báo không chạy được lệnh | Đổi sang chế độ cho phép chạy lệnh, hoặc dùng trợ lý ở bước 3 |
| `APP_OFFLINE` | Mở Flow AIC rồi thử lại. Với Flow AIC, bật **Cho Claude điều khiển** trong Cài đặt |
| Báo chưa có Blender | Cài như bước 5. Blender đặt ở chỗ khác thì đưa đường dẫn file `blender.exe` cho trợ lý |
| Báo chưa có ffmpeg | Chạy lệnh cài ở bước 5, đóng và mở lại trợ lý |
| Hết ổ đĩa | Nói với trợ lý "dọn file video đã đăng". Nó liệt kê trước và chờ bạn đồng ý |

Vẫn chưa xong thì vào nhóm hỗ trợ, gửi ảnh chụp lỗi và tên trợ lý bạn dùng. Đừng gửi mật khẩu hay khóa API lên nhóm.

Nhóm hỗ trợ: https://zalo.me/g/yenkqg494

## Cập nhật bản mới

1. Đóng trợ lý.
2. Cài bằng git thì chạy `git pull` tại thư mục gốc. Cài bằng zip thì tải bản mới, giải nén, chép đè toàn bộ vào thư mục gốc đang dùng. Gói không có dữ liệu kênh, nên `channels/` của bạn giữ nguyên. Vẫn nên sao lưu `channels/` trước khi chép.
3. Mở lại trợ lý. Nó báo đã lên bản nào và có gì mới.

Bản mới được cập nhật trong 12 tháng kể từ ngày đăng ký.
