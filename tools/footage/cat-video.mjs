// Cắt video theo bản cắt của ban-cat.mjs. Giữ nguyên file gốc.
//   node tools/footage/cat-video.mjs --ban <x.cat.json> --ra <ra.mp4> [--dem 0.12] [--thu 60] [--loi x.stt.json]
// --dem: giữ thêm bao nhiêu giây hai đầu mỗi đoạn. --thu: chỉ lấy N giây đầu của bản cắt để xem thử.
// Có --loi là file .stt.json thì ghi thêm <ra>.stt.json và <ra>.srt theo thời gian mới, dùng được cho motion và phụ đề.
// Mốc cắt được làm tròn theo khung hình để hình và tiếng không lệch dần sau nhiều lần cắt.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const vao = process.argv.slice(2);
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const fileBan = lay("ban");
const ra = lay("ra");
const dem = Number(lay("dem", 0.12));
const thu = lay("thu") ? Number(lay("thu")) : null;
const fileLoi = lay("loi");
if (!fileBan || !ra) {
  console.error("Dùng: node tools/footage/cat-video.mjs --ban <x.cat.json> --ra <ra.mp4> [--dem 0.12] [--thu 60] [--loi x.stt.json]");
  process.exit(1);
}
const ban = JSON.parse(fs.readFileSync(fileBan, "utf8"));
if (!fs.existsSync(ban.video)) { console.error(`Không thấy video gốc: ${ban.video}`); process.exit(1); }

const luong = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=avg_frame_rate", "-of", "csv=p=0", ban.video], { encoding: "utf8" }).stdout.trim().split(",")[0];
const [so, mau] = luong.split("/").map(Number);
const fps = mau ? so / mau : so;
if (!fps) { console.error("Không đọc được số khung hình."); process.exit(1); }
const khung = (t) => Math.round(t * fps);

// Đoạn giữ, trừ từ đệm trong câu, nới đệm, gộp chỗ chồng nhau, làm tròn theo khung.
let cac = [];
for (const d of ban.doan.filter((x) => x.giu)) {
  let dau = d.tu;
  for (const b of [...(d.bo || [])].sort((a, c) => a.tu - c.tu)) {
    if (b.tu > dau) cac.push([dau, b.tu]);
    dau = Math.max(dau, b.den);
  }
  if (d.den > dau) cac.push([dau, d.den]);
}
cac = cac.map(([a, b]) => [Math.max(0, a - dem), Math.min(ban.thoi_luong, b + dem)]).sort((a, b) => a[0] - b[0]);
const gop = [];
for (const c of cac) {
  const cuoi = gop[gop.length - 1];
  if (cuoi && c[0] <= cuoi[1]) cuoi[1] = Math.max(cuoi[1], c[1]);
  else gop.push([...c]);
}
let doan = gop.map(([a, b]) => [khung(a), khung(b)]).filter(([a, b]) => b > a);
if (!doan.length) { console.error("Bản cắt không còn đoạn nào."); process.exit(1); }

if (thu) {
  const lay2 = [];
  let tong = 0;
  for (const [a, b] of doan) {
    if (tong >= thu * fps) break;
    const con = Math.ceil(thu * fps) - tong;
    const c = Math.min(b, a + con);
    lay2.push([a, c]);
    tong += c - a;
  }
  doan = lay2;
}
const tam = fs.mkdtempSync(path.join(os.tmpdir(), "cat-video-"));
const script = path.join(tam, "loc.txt");
// Hình tính theo số khung sau khi ép đều nhịp, tiếng tính theo giây. Biên khung kết thúc trừ 1 vì between lấy cả hai đầu.
const eps = 0.25 / fps;
const dsHinh = doan.map(([a, b]) => `between(n,${a},${b - 1})`).join("+");
const dsTieng = doan.map(([a, b]) => `between(t,${(a / fps - eps).toFixed(6)},${(b / fps - eps).toFixed(6)})`).join("+");
fs.writeFileSync(script,
  `[0:v]fps=${luong},select='${dsHinh}',setpts=N/(${luong})/TB[h];` +
  `[0:a]aresample=48000:async=1,aselect='${dsTieng}',asetpts=N/SR/TB[a]`);

// Có encoder chưa chắc chạy được: driver cũ báo lỗi lúc mở. Thử một khung trước, không được thì dùng x264.
const nvencChay = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=black:s=320x240:d=0.1", "-frames:v", "1", "-c:v", "h264_nvenc", "-f", "null", "-"]).status === 0;
const maHinh = nvencChay
  ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "19", "-b:v", "0"]
  : ["-c:v", "libx264", "-preset", "medium", "-crf", "18"];
// Bản ffmpeg mới bỏ -filter_complex_script, thay bằng -/filter_complex.
const coScriptCu = spawnSync("ffmpeg", ["-hide_banner", "-h", "long"], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout.includes("filter_complex_script");
const thamLoc = coScriptCu ? ["-filter_complex_script", script] : ["-/filter_complex", script];
const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", ban.video, ...thamLoc,
  "-map", "[h]", "-map", "[a]", ...maHinh, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", ra], { stdio: "inherit" });
fs.rmSync(tam, { recursive: true, force: true });
if (r.status !== 0) { console.error("ffmpeg lỗi."); process.exit(1); }

const tongKhung = doan.reduce((t, [a, b]) => t + b - a, 0);
console.log(`Ra: ${ra} | ${doan.length} đoạn | ${(tongKhung / fps).toFixed(2)} giây | gốc ${ban.thoi_luong} giây`);

if (fileLoi?.endsWith(".json")) {
  // Mỗi mốc gốc đổi sang thời gian mới; từ rơi vào phần đã cắt thì bỏ.
  const mocMoi = (t) => {
    let lech = 0;
    for (const [a, b] of doan) {
      const x = a / fps;
      const y = b / fps;
      if (t < x) return null;
      if (t <= y) return lech + t - x;
      lech += y - x;
    }
    return null;
  };
  const goc = JSON.parse(fs.readFileSync(fileLoi, "utf8"));
  const tu = (goc.words || []).filter((w) => w.type === "word").flatMap((w) => {
    const a = mocMoi(w.start);
    const b = mocMoi(w.end);
    return a === null || b === null ? [] : [{ ...w, start: Number(a.toFixed(3)), end: Number(b.toFixed(3)) }];
  });
  const goiRa = ra.replace(/\.[^.]+$/, "");
  fs.writeFileSync(`${goiRa}.stt.json`, JSON.stringify({ ...goc, words: tu, text: tu.map((w) => w.text.trim()).join(" ") }, null, 1));
  const dinh = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, l = 2) => String(n).padStart(l, "0");
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  const dong = [];
  let hien = [];
  tu.forEach((w, i) => {
    hien.push(w);
    const ke = tu[i + 1];
    if (hien.length >= 10 || /[.?!…,]["”']?$/.test(w.text.trim()) || !ke || ke.start - w.end > 0.6) {
      dong.push(`${dong.length + 1}\n${dinh(hien[0].start)} --> ${dinh(hien[hien.length - 1].end)}\n${hien.map((x) => x.text.trim()).join(" ")}\n`);
      hien = [];
    }
  });
  fs.writeFileSync(`${goiRa}.srt`, dong.join("\n"));
  console.log(`Lời mới: ${goiRa}.stt.json, ${goiRa}.srt (${tu.length} từ)`);
}
