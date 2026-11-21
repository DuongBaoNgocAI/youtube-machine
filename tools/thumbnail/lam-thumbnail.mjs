// Ghép chữ lên ảnh nền thành thumbnail 1280x720, và so nhiều bản ở cỡ nhỏ như trên trang chủ YouTube.
//   node tools/thumbnail/lam-thumbnail.mjs ghep --nen <ảnh> --ra <ra.jpg> --chu "HAI DÒNG|CHỮ NGẮN" [--vi-tri trai|phai|tren|duoi|tren-trai|tren-phai|duoi-trai]
//        [--co 120] [--mau 0xFFFFFF] [--mau-vien 0x000000] [--vien-ngoai 0x000000] [--font <file.ttf>]
// --vien-ngoai thêm lớp viền thứ hai dày hơn bao ngoài --mau-vien (viền 2 lớp, ví dụ đỏ trong đen ngoài).
//   node tools/thumbnail/lam-thumbnail.mjs so <a.jpg> <b.jpg> [c.jpg] --ra <so-sanh.jpg>
// Dấu | trong --chu là xuống dòng. Bỏ --chu thì chỉ cắt ảnh về đúng cỡ.
// Font mặc định có đủ dấu tiếng Việt. Công cụ tự đọc bảng ký tự của font và dừng nếu thiếu chữ, vì ffmpeg chỉ vẽ ô vuông mà không báo lỗi.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const vao = process.argv.slice(2);
const lenh = vao[0];
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const dung = (l) => { console.error(l); process.exit(1); };
// Đọc bảng cmap của file TTF/OTF, trả về hàm kiểm tra một mã ký tự. File .ttc chứa nhiều font thì bỏ qua.
function bangChu(file) {
  const b = fs.readFileSync(file);
  if (b.toString("latin1", 0, 4) === "ttcf") return null;
  const so = b.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < so; i++) if (b.toString("latin1", 12 + i * 16, 16 + i * 16) === "cmap") cmap = b.readUInt32BE(12 + i * 16 + 8);
  if (!cmap) return null;
  const khoang = [];
  const bang = b.readUInt16BE(cmap + 2);
  for (let i = 0; i < bang; i++) {
    const o = cmap + b.readUInt32BE(cmap + 4 + i * 8 + 4);
    const dang = b.readUInt16BE(o);
    if (dang === 4) {
      const n = b.readUInt16BE(o + 6) / 2;
      for (let j = 0; j < n; j++) khoang.push([b.readUInt16BE(o + 16 + n * 2 + j * 2), b.readUInt16BE(o + 14 + j * 2)]);
    } else if (dang === 12) {
      const n = b.readUInt32BE(o + 12);
      for (let j = 0; j < n; j++) khoang.push([b.readUInt32BE(o + 16 + j * 12), b.readUInt32BE(o + 20 + j * 12)]);
    }
  }
  return (ma) => khoang.some(([a, z]) => ma >= a && ma <= z);
}
const chay = (ts, cwd) => {
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...ts], { encoding: "utf8", cwd });
  if (r.status !== 0) dung(r.stderr || "ffmpeg lỗi.");
};

if (lenh === "ghep") {
  const nen = lay("nen");
  const ra = lay("ra");
  const chu = lay("chu", "");
  if (!nen || !ra) dung('Dùng: node tools/thumbnail/lam-thumbnail.mjs ghep --nen <ảnh> --ra <ra.jpg> --chu "CHỮ" [--vi-tri trai|phai|tren|duoi|tren-trai|tren-phai|duoi-trai]');
  if (!fs.existsSync(nen)) dung(`Không thấy ${nen}`);
  const viTri = lay("vi-tri", "trai");
  const co = Number(lay("co", 120));
  const mau = lay("mau", "0xFFFFFF");
  const vien = lay("mau-vien", "0x000000");
  const vienNgoai = lay("vien-ngoai", "");
  const FONT = { win32: "C:/Windows/Fonts/arialbd.ttf", darwin: "/System/Library/Fonts/Supplemental/Arial Bold.ttf" }[process.platform] ?? "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const font = path.resolve(lay("font", FONT));
  if (!fs.existsSync(font)) dung(`Không thấy font ${font}, truyền --font.`);
  const coChu = bangChu(font);
  const thieu = coChu ? [...new Set(chu.normalize("NFC").replace(/[|s]/g, ""))].filter((c) => !coChu(c.codePointAt(0))) : [];
  if (thieu.length) dung(`Font ${path.basename(font)} thiếu chữ: ${thieu.join(" ")}. Chọn font khác bằng --font.`);
  const tam = fs.mkdtempSync(path.join(os.tmpdir(), "thumb-"));
  fs.copyFileSync(font, path.join(tam, "f.ttf"));
  let loc = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720";
  const dong = chu.split("|").map((d) => d.trim()).filter(Boolean);
  if (dong.length) {
    if (dong.length > 3 || chu.replace(/\|/g, " ").trim().split(/\s+/).length > 6) console.error("Chữ dài hơn 6 từ hoặc 3 dòng: khó đọc ở cỡ nhỏ.");
    const caoDong = Math.round(co * 1.12);
    const tong = caoDong * dong.length;
    // tren-trai, tren-phai, duoi-trai: góc. Không có duoi-phai vì YouTube hiện thời lượng ở đó.
    const x = /phai/.test(viTri) ? "w-text_w-48" : /trai/.test(viTri) ? "48" : "(w-text_w)/2";
    const y0 = /tren/.test(viTri) ? 40 : /duoi/.test(viTri) ? 720 - tong - 40 : Math.round((720 - tong) / 2);
    dong.forEach((d, i) => {
      fs.writeFileSync(path.join(tam, `d${i}.txt`), d.normalize("NFC"));
      const ve = (bw, mv) => `,drawtext=fontfile=f.ttf:textfile=d${i}.txt:fontsize=${co}:fontcolor=${mau}:borderw=${bw}:bordercolor=${mv}:x=${x}:y=${y0 + i * caoDong}`;
      if (vienNgoai) loc += ve(Math.max(8, Math.round(co / 6)), vienNgoai);
      loc += ve(Math.max(4, Math.round(co / 14)), vien);
    });
  }
  chay(["-i", path.resolve(nen), "-vf", loc, "-frames:v", "1", "-q:v", "2", path.resolve(ra)], tam);
  fs.rmSync(tam, { recursive: true, force: true });
  const mb = fs.statSync(ra).size / 1048576;
  console.log(`Ra: ${ra} | 1280x720 | ${mb.toFixed(2)} MB${mb > 2 ? " | QUÁ 2 MB, YouTube có thể từ chối" : ""}`);
} else if (lenh === "so") {
  const ra = lay("ra");
  const iRa = vao.indexOf("--ra");
  const anh = vao.slice(1).filter((_, i) => i + 1 !== iRa && i + 1 !== iRa + 1);
  if (!ra || anh.length < 1 || anh.length > 4) dung("Dùng: node tools/thumbnail/lam-thumbnail.mjs so <a.jpg> <b.jpg> ... --ra <so-sanh.jpg> (tối đa 4 ảnh)");
  for (const a of anh) if (!fs.existsSync(a)) dung(`Không thấy ${a}`);
  // Hàng trên: cỡ trang chủ máy tính. Hàng giữa và dưới: cỡ xem tiếp trên nền tối và nền sáng.
  const n = anh.length;
  const o = anh.flatMap((a) => ["-i", a]);
  const nhan = anh.map((_, i) => i);
  const loc = [
    ...nhan.map((i) => `[${i}:v]split=3[a${i}][b${i}][c${i}]`),
    ...nhan.map((i) => `[a${i}]scale=320:180,pad=340:200:10:10:0x202020[x${i}]`),
    ...nhan.map((i) => `[b${i}]scale=168:94,pad=340:114:86:10:0x0F0F0F[y${i}]`),
    ...nhan.map((i) => `[c${i}]scale=168:94,pad=340:114:86:10:0xFFFFFF[z${i}]`),
    n > 1 ? `${nhan.map((i) => `[x${i}]`).join("")}hstack=inputs=${n}[h1]` : "[x0]null[h1]",
    n > 1 ? `${nhan.map((i) => `[y${i}]`).join("")}hstack=inputs=${n}[h2]` : "[y0]null[h2]",
    n > 1 ? `${nhan.map((i) => `[z${i}]`).join("")}hstack=inputs=${n}[h3]` : "[z0]null[h3]",
    "[h1][h2][h3]vstack=inputs=3[ra]",
  ].join(";");
  chay([...o, "-filter_complex", loc, "-map", "[ra]", "-frames:v", "1", "-q:v", "2", path.resolve(ra)]);
  console.log(`Ra: ${ra}`);
} else {
  dung("Dùng: node tools/thumbnail/lam-thumbnail.mjs ghep|so ... Xem đầu file.");
}
