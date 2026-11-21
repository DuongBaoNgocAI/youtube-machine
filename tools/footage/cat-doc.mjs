// Cắt một đoạn của video ngang thành Shorts dọc 1080x1920, tùy chọn in phụ đề. Không đụng file gốc.
//   node tools/footage/cat-doc.mjs --video <v> --tu 12.5 --den 58 --ra <ra.mp4> [--che-do cat|nen-mo] [--tam 0.5]
//        [--khung "0:0.3,12.5:0.7"] [--phu-de <x.srt>]
// cat: cắt khung dọc, --tam là vị trí giữa khung theo chiều ngang, 0 là mép trái, 1 là mép phải.
// --khung: đổi tâm theo mốc giây tính từ đầu đoạn, đổi dứt khoát không lia. Xem hình trước rồi mới đặt.
// nen-mo: giữ nguyên khung ngang ở giữa, nền là chính hình đó làm mờ. Hợp màn hình và bản đồ.
// --phu-de: SRT theo giờ của video gốc, tự dời theo --tu. Công cụ không tự tìm mặt người.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const vao = process.argv.slice(2);
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const video = lay("video");
const ra = lay("ra");
const tu = Number(lay("tu"));
const den = Number(lay("den"));
const cheDo = lay("che-do", "cat");
const tam = Number(lay("tam", 0.5));
const fileKhung = lay("khung");
const phuDe = lay("phu-de");
if (!video || !ra || !Number.isFinite(tu) || !Number.isFinite(den) || den <= tu) {
  console.error('Dùng: node tools/footage/cat-doc.mjs --video <v> --tu 12.5 --den 58 --ra <ra.mp4> [--che-do cat|nen-mo] [--tam 0.5] [--khung "0:0.3,12.5:0.7"] [--phu-de x.srt]');
  process.exit(1);
}
if (!fs.existsSync(video)) { console.error(`Không thấy ${video}`); process.exit(1); }
if (den - tu > 180) console.error("Đoạn dài hơn 3 phút, kiểm tra lại giới hạn Shorts hiện hành.");

const tam2 = fs.mkdtempSync(path.join(os.tmpdir(), "cat-doc-"));
let loc;
if (cheDo === "nen-mo") {
  loc = "split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.12[nen];[b]scale=1080:-2[hinh];[nen][hinh]overlay=(W-w)/2:(H-h)/2";
} else {
  const moc = (fileKhung ? fileKhung.split(",") : [`0:${tam}`]).map((m) => m.split(":").map(Number)).sort((a, b) => a[0] - b[0]);
  // Dấu phẩy trong biểu thức phải thoát vì nằm trong chuỗi lọc.
  const giaTri = moc.slice(1).reduceRight((sau, [giay, t]) => `if(gte(t\\,${giay})\\,${t}\\,${sau})`, String(moc[0][1]));
  loc = `crop=w=trunc(ih*9/16/2)*2:h=ih:x=(iw-trunc(ih*9/16/2)*2)*(${giaTri}):y=0,scale=1080:1920`;
}

if (phuDe) {
  const giay = (t) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000; };
  const p = (n, l = 2) => String(n).padStart(l, "0");
  const dinh = (s) => { const ms = Math.round(s * 1000); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  const khoi = fs.readFileSync(phuDe, "utf8").replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/).flatMap((k) => {
    const dong = k.trim().split("\n");
    const i = dong.findIndex((d) => d.includes("-->"));
    if (i < 0) return [];
    const [a, b] = dong[i].split("-->").map((x) => giay(x.trim()));
    return b <= tu || a >= den ? [] : [[Math.max(a, tu) - tu, Math.min(b, den) - tu, dong.slice(i + 1).join(" ")]];
  });
  fs.writeFileSync(path.join(tam2, "pd.srt"), khoi.map(([a, b, c], i) => `${i + 1}\n${dinh(a)} --> ${dinh(b)}\n${c}\n`).join("\n"));
  // Cỡ tính theo khung 288 dòng của libass: 13 ứng với khoảng 87 px ở 1920; lề dưới tránh nút của giao diện Shorts.
  loc += ",subtitles=pd.srt:force_style='FontName=Arial,FontSize=13,Bold=1,Outline=2,Shadow=0,Alignment=2,MarginV=70,MarginL=20,MarginR=20'";
}

const nvencChay = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=320x240:d=0.1", "-frames:v", "1", "-c:v", "h264_nvenc", "-f", "null", "-"]).status === 0;
const maHinh = nvencChay
  ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "20", "-b:v", "0"]
  : ["-c:v", "libx264", "-preset", "medium", "-crf", "19"];
const raTuyetDoi = path.resolve(ra);
// Chạy trong thư mục tạm để đường dẫn phụ đề không vướng dấu hai chấm của Windows.
const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(tu), "-to", String(den), "-i", path.resolve(video),
  "-vf", loc, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000", ...maHinh, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", raTuyetDoi],
{ cwd: tam2, stdio: "inherit" });
fs.rmSync(tam2, { recursive: true, force: true });
if (r.status !== 0) { console.error("ffmpeg lỗi."); process.exit(1); }
console.log(`Ra: ${ra} | ${(den - tu).toFixed(1)} giây | ${cheDo}`);
