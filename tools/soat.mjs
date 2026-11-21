// Soát thành phẩm bằng máy: thông số, hình đứng yên, khung đen, tiếng tắt, âm lượng, tờ khung để xem bằng mắt.
//   node tools/soat.mjs <video> --ra <thư mục> [--loai dai|shorts|nhac] [--dung 6] [--tieng-tat 4]
// Ra: soat.json, soat.md, to-khung.jpg (30 khung), thu-nho.jpg (8 khung rộng 480 px, thử đọc chữ như trên điện thoại)
// Máy không biết video hay hay dở. Tờ khung vẫn phải có người hoặc trợ lý nhìn thật.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const vao = process.argv.slice(2);
const video = vao[0];
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const thuMuc = lay("ra");
const loai = lay("loai", "dai");
// Video nhạc nền chủ ý đứng yên lâu, nên không báo hình đứng yên.
const dungToiDa = Number(lay("dung", loai === "shorts" ? 3 : 6));
const tatToiDa = Number(lay("tieng-tat", loai === "shorts" ? 1.5 : 4));
if (!video || !thuMuc || video.startsWith("--")) {
  console.error("Dùng: node tools/soat.mjs <video> --ra <thư mục> [--loai dai|shorts|nhac] [--dung 6] [--tieng-tat 4]");
  process.exit(1);
}
if (!fs.existsSync(video)) { console.error(`Không thấy ${video}`); process.exit(1); }
fs.mkdirSync(thuMuc, { recursive: true });

const chay = (lenh, thamSo) => spawnSync(lenh, thamSo, { encoding: "utf8", maxBuffer: 1 << 28 });
const gio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const tt = JSON.parse(chay("ffprobe", ["-v", "error", "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate", "-of", "json", video]).stdout);
const dai = Number(tt.format.duration);
const hinh = tt.streams.find((s) => s.codec_type === "video");
const tieng = tt.streams.find((s) => s.codec_type === "audio");
const loi = [];
const bao = (muc, viec, chiTiet) => loi.push({ muc, viec, chi_tiet: chiTiet });

if (!hinh) bao("Đỏ", "Không có hình", "");
if (!tieng) bao("Đỏ", "Không có tiếng", "");
const doc = hinh && hinh.height > hinh.width;
if (hinh && Math.min(hinh.width, hinh.height) < 1080) bao("Vàng", "Độ phân giải dưới 1080p", `${hinh.width}x${hinh.height}`);
if (loai === "shorts" && !doc) bao("Đỏ", "Shorts chưa phải khung dọc", `${hinh?.width}x${hinh?.height}`);

// Thu nhỏ trước khi dò để video dài vẫn chạy nhanh.
const d = chay("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-an", "-vf",
  `scale=320:-2,freezedetect=n=0.003:d=${dungToiDa},metadata=mode=print:file=-,blackdetect=d=0.5:pix_th=0.1`, "-f", "null", "-"]);
const vanBan = (d.stdout || "") + (d.stderr || "");
const dungYen = [];
let dau = null;
for (const dong of vanBan.split(/\r?\n/)) {
  const a = dong.match(/freeze_start[=:]\s*([\d.]+)/);
  const b = dong.match(/freeze_end[=:]\s*([\d.]+)/);
  if (a) dau = Number(a[1]);
  if (b && dau !== null) { dungYen.push({ tu: dau, den: Number(b[1]) }); dau = null; }
}
if (dau !== null) dungYen.push({ tu: dau, den: dai });
const den = [...vanBan.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({ tu: Number(m[1]), den: Number(m[2]) }));
if (loai !== "nhac") {
  for (const x of dungYen) bao("Vàng", "Hình đứng yên", `${gio(x.tu)} đến ${gio(x.den)} (${(x.den - x.tu).toFixed(1)} giây)`);
}
for (const x of den) bao(x.den - x.tu > 1.5 ? "Đỏ" : "Vàng", "Khung đen", `${gio(x.tu)} đến ${gio(x.den)}`);

let lufs = null;
let dinh = null;
const quangTat = [];
if (tieng) {
  const a = chay("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vn", "-af", `silencedetect=noise=-45dB:d=${tatToiDa},ebur128=peak=true:framelog=quiet`, "-f", "null", "-"]).stderr || "";
  const tomTat = a.slice(a.lastIndexOf("Summary:"));
  lufs = Number((tomTat.match(/I:\s*(-?[\d.]+) LUFS/) || [])[1]);
  dinh = Number((tomTat.match(/Peak:\s*(-?[\d.]+) dBFS/) || [])[1]);
  let bd = null;
  for (const dong of a.split(/\r?\n/)) {
    const x = dong.match(/silence_start: (-?[\d.]+)/);
    const y = dong.match(/silence_end: ([\d.]+)/);
    if (x) bd = Math.max(0, Number(x[1]));
    if (y && bd !== null) { quangTat.push({ tu: bd, den: Number(y[1]) }); bd = null; }
  }
  if (Number.isFinite(lufs) && (lufs > -12 || lufs < -16)) bao("Vàng", "Âm lượng lệch -14 LUFS", `${lufs} LUFS`);
  if (Number.isFinite(dinh) && dinh > -1) bao("Vàng", "Đỉnh tiếng quá -1 dBFS", `${dinh} dBFS`);
  if (loai !== "nhac") for (const x of quangTat) bao("Vàng", "Tiếng tắt", `${gio(x.tu)} đến ${gio(x.den)}`);
}

// Tờ khung lấy đều cả video, thêm 30 giây đầu vì người xem rời đi nhiều nhất ở đó.
const buoc = Math.max(dai / 30, 0.5);
chay("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", video, "-vf", `fps=1/${buoc.toFixed(3)},scale=${doc ? 216 : 320}:-2,tile=${doc ? "10x3" : "6x5"}`, "-frames:v", "1", "-q:v", "4", path.join(thuMuc, "to-khung.jpg")]);
const buocNho = Math.max(Math.min(dai, 30) / 8, 0.5);
chay("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-t", "30", "-i", video, "-vf", `fps=1/${buocNho.toFixed(3)},scale=${doc ? 270 : 480}:-2,tile=4x2`, "-frames:v", "1", "-q:v", "4", path.join(thuMuc, "thu-nho.jpg")]);

const ketQua = {
  video, ngay: new Date().toISOString().slice(0, 10), loai, dai_giay: dai, dung_luong_mb: Math.round(tt.format.size / 1048576),
  hinh: hinh ? `${hinh.width}x${hinh.height} ${hinh.codec_name} ${hinh.r_frame_rate}` : null,
  tieng: tieng?.codec_name ?? null, lufs, dinh_dbfs: dinh, hinh_dung_yen: dungYen, khung_den: den, tieng_tat: quangTat, viec_can_xem: loi,
};
fs.writeFileSync(path.join(thuMuc, "soat.json"), JSON.stringify(ketQua, null, 1));
const md = [
  `# Soát máy: ${path.basename(video)}`, "",
  `- Dài: ${gio(dai)} | Hình: ${ketQua.hinh} | Tiếng: ${ketQua.tieng} | ${lufs} LUFS, đỉnh ${dinh} dBFS | ${ketQua.dung_luong_mb} MB`,
  `- Hình đứng yên từ ${dungToiDa} giây: ${dungYen.length} | Khung đen: ${den.length} | Tiếng tắt từ ${tatToiDa} giây: ${quangTat.length}`, "",
  ...(loi.length ? ["| Mức | Việc | Chi tiết |", "|---|---|---|", ...loi.map((l) => `| ${l.muc} | ${l.viec} | ${l.chi_tiet} |`)] : ["Máy không thấy lỗi nào."]),
  "", "Máy chỉ đo kỹ thuật. Xem `to-khung.jpg` và `thu-nho.jpg` bằng mắt.",
];
fs.writeFileSync(path.join(thuMuc, "soat.md"), md.join("\n") + "\n");
console.log(md.slice(2, 4).join("\n"));
console.log(loi.length ? `Cần xem: ${loi.length} mục, ghi ở ${path.join(thuMuc, "soat.md")}` : "Máy không thấy lỗi nào.");
