// Ghép đoạn motion vào video và trộn tiếng hiệu ứng, không cần dựng lại Blender hay CapCut.
// Dùng:
//   node tools/motion/ghep-motion.mjs --nen <video.mp4> --danh-sach <motion.json> --ra <ra.mp4> [--tu 100 --den 140]
//   node tools/motion/ghep-motion.mjs --nen <doan-motion.mp4> --am-nen <giong.mp3> --am-tu 12.5 --danh-sach <motion.json> --ra <ra.mp4>
// File danh sách (giây tính theo video nền đầy đủ):
//   { "chen": [ { "file": "doan.mp4", "tu": 104.583 }, { "file": "lop-chu.mov", "tu": 300 } ],
//     "sfx":  [ { "file": "whoosh.wav", "t": 108.5, "am": 0.5 }, { "file": "thud.wav", "dinh": 112.2, "am": 0.4 } ] }
// "t": đầu file rơi vào giây này. "dinh": chỗ to nhất của file rơi vào giây này, dùng cho tiếng phải trúng một cú chạm.
// Đường dẫn trong danh sách tính từ thư mục chứa file danh sách.
// File mp4 đặc thay hình ở đoạn đó. File mov có kênh trong suốt phủ lên hình. Tiếng của nền luôn được giữ.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";

const THAM = {};
for (let i = 2; i < process.argv.length; i += 2) THAM[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];
for (const k of ["nen", "ra"]) {
  if (!THAM[k]) {
    console.error(`Thiếu --${k}. Xem cách dùng ở đầu file.`);
    process.exit(1);
  }
}

const ds = THAM["danh-sach"] ? JSON.parse(fs.readFileSync(THAM["danh-sach"], "utf8")) : {};
const goc = THAM["danh-sach"] ? path.dirname(path.resolve(THAM["danh-sach"])) : process.cwd();
const tuyetDoi = (p) => (path.isAbsolute(p) ? p : path.join(goc, p));
const tu = THAM.tu !== undefined ? Number(THAM.tu) : 0;
const den = THAM.den !== undefined ? Number(THAM.den) : null;
const lech = THAM["lech-nen"] !== undefined ? Number(THAM["lech-nen"]) : 0; // nền bắt đầu ở giây này của video đầy đủ

function doDai(f) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
}
function coVideo(f) {
  const r = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0", f]).toString().trim().split(",");
  const [a, b] = r[2].split("/").map(Number);
  return { w: +r[0], h: +r[1], fps: a / (b || 1) };
}
// ffmpeg có thể liệt kê h264_nvenc dù driver quá cũ, nên thử mã hóa thật vài khung.
function coEncoder(ten) {
  return spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=640x360:d=0.2", "-c:v", ten, "-f", "null", "-"]).status === 0;
}

const nen = path.resolve(THAM.nen);
const tt = coVideo(nen);
const chen = (ds.chen || []).map((c) => ({ ...c, file: tuyetDoi(c.file), dai: doDai(tuyetDoi(c.file)) }));
const sfx = (ds.sfx || []).map((s) => ({ ...s, file: tuyetDoi(s.file) }));
for (const f of [...chen, ...sfx]) {
  if (!fs.existsSync(f.file)) {
    console.error("Không thấy file: " + f.file);
    process.exit(1);
  }
}

const dauNen = Math.max(0, tu - lech);
const hetNen = den === null ? doDai(nen) : Math.min(doDai(nen), den - lech);
const dai = hetNen - dauNen;
const dungChen = chen.filter((c) => c.tu < tu + dai && c.tu + c.dai > tu);
// Tiếng có đoạn lấy đà nên chỗ to nhất nằm sau đầu file. Đo khung 10 ms to nhất rồi lùi thời điểm phát.
const dinhCuaFile = new Map();
function doDinh(f) {
  if (dinhCuaFile.has(f)) return dinhCuaFile.get(f);
  const sr = 16000;
  const b = execFileSync("ffmpeg", ["-v", "error", "-i", f, "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 28 });
  const n = Math.floor(b.length / 4);
  const o = Math.floor(sr / 100);
  let tot = 0;
  let cho = 0;
  for (let i = 0; i + o <= n; i += o) {
    let e = 0;
    for (let j = i; j < i + o; j++) { const x = b.readFloatLE(j * 4); e += x * x; }
    if (e > tot) { tot = e; cho = i; }
  }
  const giay = cho / sr;
  dinhCuaFile.set(f, giay);
  return giay;
}
for (const s of sfx) if (s.dinh !== undefined) s.t = Math.max(0, s.dinh - doDinh(s.file));
const dungSfx = sfx.filter((s) => s.t >= tu && s.t < tu + dai);

const vao = ["-ss", String(dauNen), "-t", String(dai), "-i", nen];
let soVao = 1;
let idAmNen = "0:a:0";
if (THAM["am-nen"]) {
  vao.push("-ss", String(Number(THAM["am-tu"] || 0)), "-t", String(dai), "-i", path.resolve(THAM["am-nen"]));
  idAmNen = `${soVao}:a:0`;
  soVao++;
}

const loc = [];
let hinh = "0:v";
dungChen.forEach((c, i) => {
  const so = soVao++;
  const batDau = Math.max(0, tu - c.tu);
  vao.push("-ss", String(batDau), "-i", c.file);
  const dat = Math.max(0, c.tu - tu);
  loc.push(`[${so}:v]setpts=PTS-STARTPTS+${dat}/TB,scale=${tt.w}:${tt.h},fps=${tt.fps}[c${i}]`);
  loc.push(`[${hinh}][c${i}]overlay=eof_action=pass:format=auto:shortest=0[h${i}]`);
  hinh = `h${i}`;
});

let tiengRa = idAmNen;
const coAm = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", THAM["am-nen"] ? path.resolve(THAM["am-nen"]) : nen], { encoding: "utf8" }).stdout.trim() !== "";
if (dungSfx.length) {
  const nhan = coAm ? [`[${idAmNen}]`] : [];
  // Mỗi file tiếng chỉ mở một lần rồi tách nhánh, để nhiều tiếng không làm lệnh quá dài trên Windows.
  const nguon = new Map();
  dungSfx.forEach((s) => nguon.set(s.file, (nguon.get(s.file) || 0) + 1));
  const nhanh = new Map();
  for (const [file, soLan] of nguon) {
    const so = soVao++;
    vao.push("-i", file);
    const ten = Array.from({ length: soLan }, (_, i) => `[n${so}_${i}]`);
    loc.push(`[${so}:a]${soLan > 1 ? "asplit=" + soLan : "anull"}${ten.join("")}`);
    nhanh.set(file, ten);
  }
  dungSfx.forEach((s, i) => {
    const ms = Math.round((s.t - tu) * 1000);
    loc.push(`${nhanh.get(s.file).shift()}aformat=sample_rates=48000:channel_layouts=stereo,volume=${s.am ?? 0.5},adelay=${ms}|${ms}[s${i}]`);
    nhan.push(`[s${i}]`);
  });
  loc.push(`${nhan.join("")}amix=inputs=${nhan.length}:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.7:attack=1:release=60:level=false[am]`);
  tiengRa = "am";
}

const dungNvenc = coEncoder("h264_nvenc");
const maHinh = dungNvenc
  ? ["-c:v", "h264_nvenc", "-preset", "p5", "-cq", "19", "-b:v", "0"]
  : ["-c:v", "libx264", "-preset", "medium", "-crf", "18"];

const lenh = ["-y", "-hide_banner", "-loglevel", "error", ...vao];
// Bộ lọc ghi ra file vì dòng lệnh Windows giới hạn khoảng 32.000 ký tự.
const fileLoc = path.join(os.tmpdir(), `ghep-motion-${process.pid}.txt`);
if (loc.length) {
  fs.writeFileSync(fileLoc, loc.join(";"));
  // ffmpeg bản mới bỏ -filter_complex_script, thay bằng tiền tố "-/" (đọc giá trị từ file).
  const banCu = spawnSync("ffmpeg", ["-hide_banner", "-h", "full"], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout.includes("-filter_complex_script");
  lenh.push(banCu ? "-filter_complex_script" : "-/filter_complex", fileLoc);
}
lenh.push("-map", hinh === "0:v" ? "0:v:0" : `[${hinh}]`);
if (coAm || dungSfx.length) lenh.push("-map", tiengRa === "am" ? "[am]" : tiengRa);
lenh.push(...maHinh, "-pix_fmt", "yuv420p", "-t", String(dai));
if (coAm || dungSfx.length) lenh.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000");
lenh.push("-movflags", "+faststart", path.resolve(THAM.ra));

fs.mkdirSync(path.dirname(path.resolve(THAM.ra)), { recursive: true });
const r = spawnSync("ffmpeg", lenh, { stdio: "inherit" });
fs.rmSync(fileLoc, { force: true });
if (r.status !== 0) {
  console.error("ffmpeg lỗi, mã " + r.status + (r.error ? " (" + r.error.message + ")" : ""));
  process.exit(r.status || 1);
}
console.log(`Xong: ${THAM.ra} | ${doDai(path.resolve(THAM.ra)).toFixed(2)} giây | ${dungChen.length} đoạn motion, ${dungSfx.length} tiếng | ${dungNvenc ? "h264_nvenc" : "libx264"}`);
