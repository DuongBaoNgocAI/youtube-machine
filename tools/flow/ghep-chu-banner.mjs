// Ghép chữ lên banner 2560x1440, chữ nằm trong vùng an toàn YouTube 1546x423 ở giữa (x 507..2053, y 508..931).
// Flow không vẽ chữ đúng nên chữ luôn ghép sau bằng script này.
// Dùng: node tools/flow/ghep-chu-banner.mjs <nền.png> <ra.png> --ten "TÊN KÊNH" [--phu "tagline"] [--dong3 "lịch đăng"]
//       [--mau 0xF59E0B] [--mau-phu 0x06B6D4] [--font <file.ttf>] [--kiem-tra <ra-kiem-tra.png>]
// Bản kiểm tra vẽ khung đỏ vùng an toàn và khung vàng vùng hiển thị trên máy tính.
import { execFileSync } from "child_process";

const vao = process.argv.slice(2);
const [nen, ra] = vao;
const lay = (khoa, macDinh = "") => {
  const i = vao.indexOf(khoa);
  return i >= 0 ? vao[i + 1] : macDinh;
};
const ten = lay("--ten");
if (!nen || !ra || !ten) {
  console.error('Dùng: node ghep-chu-banner.mjs <nền.png> <ra.png> --ten "TÊN KÊNH" [--phu ...] [--dong3 ...]');
  process.exit(1);
}
const FONT_MAC_DINH = {
  win32: "C:/Windows/Fonts/impact.ttf",
  darwin: "/System/Library/Fonts/Supplemental/Impact.ttf",
}[process.platform] ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const font = lay("--font", FONT_MAC_DINH).replace(/\\/g, "/").replace(/:/g, "\\:");
const mau = lay("--mau", "0xF59E0B");
const mauPhu = lay("--mau-phu", "0x06B6D4");
const thoat = (s) => s.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/,/g, "\\,");

const chu = [
  `drawtext=fontfile='${font}':text='${thoat(ten)}':fontsize=150:fontcolor=${mau}:borderw=10:bordercolor=0x0B0F19:shadowx=0:shadowy=12:shadowcolor=0x000000@0.6:x=(w-text_w)/2:y=565`,
];
if (lay("--phu")) {
  chu.push(`drawbox=x=930:y=745:w=700:h=5:color=${mauPhu}@0.95:t=fill`);
  chu.push(`drawtext=fontfile='${font}':text='${thoat(lay("--phu"))}':fontsize=54:fontcolor=white:borderw=5:bordercolor=0x0B0F19:x=(w-text_w)/2:y=768`);
}
if (lay("--dong3")) {
  chu.push(`drawtext=fontfile='${font}':text='${thoat(lay("--dong3"))}':fontsize=36:fontcolor=${mauPhu}:borderw=4:bordercolor=0x0B0F19:x=(w-text_w)/2:y=846`);
}
// Quầng tối elip mềm sau khối chữ để chữ nổi trên nền sáng.
const quang = "color=c=0x0B0F19:s=2560x1440,format=rgba,geq=r=11:g=15:b=25:a='185*max(0,1-pow((X-1280)/880,2)-pow((Y-720)/250,2))'";

function ffmpeg(...thamSo) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...thamSo], { stdio: "inherit" });
}

ffmpeg("-i", nen, "-filter_complex",
  `[0]scale=2560:1440:flags=lanczos[n];${quang}[q];[n][q]overlay=format=auto,${chu.join(",")}`,
  "-frames:v", "1", ra);

const kiemTra = lay("--kiem-tra");
if (kiemTra) {
  ffmpeg("-i", ra, "-vf",
    "drawbox=x=507:y=508:w=1546:h=423:color=red:t=6,drawbox=x=0:y=508:w=2560:h=423:color=yellow@0.7:t=4",
    "-frames:v", "1", kiemTra);
}
console.log(`xong ${ra}`);
