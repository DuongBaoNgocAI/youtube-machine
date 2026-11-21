// Xóa dấu sao Gemini ở góc phải dưới ảnh và clip Flow: chép vân hình ngay bên trái đè lên, viền mềm 12 px.
// Clip 1280x720: sao ở x 1136-1183, y 576-623. Ảnh 1376x768: sao quanh tâm (1278, 671).
// Dùng: node tools/flow/xoa-dau-sao.mjs <thư mục nguồn> <thư mục ra>
// Tên file: *-clip.mp4 và *-anh.jpg. Cần ffmpeg. Bản Node của xoa-dau-sao.sh, không cần bash.
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

const [nguon, ra] = process.argv.slice(2);
if (!nguon || !ra) {
  console.error("Dùng: node xoa-dau-sao.mjs <thư mục nguồn> <thư mục ra>");
  process.exit(1);
}
fs.mkdirSync(ra, { recursive: true });

// Alpha 255 ở lõi, mờ dần 12 px ra mép ô vá.
function vien(canh) {
  const h = canh / 2;
  return `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='255*min(1,max(0,(${h}-max(abs(X-${h}+0.5),abs(Y-${h}+0.5)))/12))'`;
}

function ffmpeg(...thamSo) {
  execFileSync("ffmpeg", ["-v", "error", "-y", ...thamSo], { stdio: "inherit" });
}

let n = 0;
for (const ten of fs.readdirSync(nguon).sort()) {
  const vao = path.join(nguon, ten);
  const raFile = path.join(ra, ten);
  if (ten.endsWith("-clip.mp4")) {
    ffmpeg("-i", vao, "-filter_complex",
      `[0:v]split[a][b];[b]crop=72:72:1044:564,${vien(72)}[p];[a][p]overlay=1124:564,format=yuv420p`,
      "-c:v", "libx264", "-crf", "15", "-preset", "medium", "-an", raFile);
    n++;
  } else if (ten.endsWith("-anh.jpg")) {
    ffmpeg("-i", vao, "-filter_complex",
      `[0:v]split[a][b];[b]crop=76:76:1156:633,${vien(76)}[p];[a][p]overlay=1240:633`,
      "-q:v", "1", raFile);
    n++;
  }
}
console.log(`xong ${n}`);
