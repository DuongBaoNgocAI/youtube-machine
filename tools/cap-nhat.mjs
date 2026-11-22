// Cập nhật gói YouTube Machine trên máy người mua lên bản mới nhất họ được dùng.
//   node tools/cap-nhat.mjs                  kiểm, có bản mới thì tải về và cập nhật
//   node tools/cap-nhat.mjs --kiem           chỉ kiểm có bản mới không, không tải
//   node tools/cap-nhat.mjs --tu-zip <file>  cập nhật từ file zip đã tải tay ở trang YouTube Machine
//
// Link tải lấy qua Cổng YTM (tools/ytm-cong.mjs --goi), đúng bản tài khoản được dùng.
// Không đụng tới channels/, .youtube-machine/, _thung-rac/, .git/.
// File cũ bị thay hoặc bị bản mới bỏ được chuyển vào _thung-rac/cap-nhat-<cũ>-sang-<mới>-<giờ>/, không xóa hẳn.
// Node 18 trở lên, không cần cài thêm thư viện.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const co = (x) => process.argv.includes(x);
const thamSo = (x) => {
  const i = process.argv.indexOf(x);
  return i > 0 ? process.argv[i + 1] : null;
};
const dung = (thongBao, ma = 1) => {
  console.log(thongBao);
  process.exit(ma);
};
const GIU = ["channels/", ".youtube-machine/", "_thung-rac/", ".git/"]; // không bao giờ ghi đè hay dọn

const docJson = (f) => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));
const so = (v) => String(v ?? "0").split(".").map((x) => parseInt(x, 10) || 0);
function soSanh(a, b) {
  const x = so(a), y = so(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

// Máy người bán có bản gốc đầy đủ của skill: gói phát chỉ có skill giữ chỗ, ghi đè là mất bản gốc.
if (fs.existsSync(path.join(GOC, "tools", "day-skill.mjs")) && !co("--may-thu")) {
  dung("Đây là thư mục gốc của người bán (có tools/day-skill.mjs). Không cập nhật từ gói phát ở đây.");
}

let banMay;
try {
  banMay = docJson(path.join(GOC, "PHIEN-BAN.json")).phien_ban;
} catch {
  dung("Không đọc được PHIEN-BAN.json. Hãy chạy lệnh này trong thư mục YouTube Machine.");
}

// ---------------------------------------------------------------------------
// 1. Lấy gói: từ máy chủ hoặc từ file zip người dùng đưa
// ---------------------------------------------------------------------------
const THU_TAI = path.join(GOC, ".youtube-machine", "cap-nhat");
let tepZip = thamSo("--tu-zip");
let tuMayChu = null;

const hoiCong = (coHieu) => {
  const r = spawnSync(process.execPath, [path.join(GOC, "tools", "ytm-cong.mjs"), coHieu], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  try {
    return JSON.parse(r.stdout.trim().split("\n").pop() || "null");
  } catch {
    return null;
  }
};

if (!tepZip) {
  // Bước 1: hỏi bản được dùng (lệnh trạng thái). Bước 2: chỉ khi cần tải mới xin link.
  const tt = hoiCong("--phien-ban");
  if (!tt) dung("Không hỏi được máy chủ YouTube Machine. Kiểm tra mạng rồi thử lại.");
  if (!tt.dang_nhap) dung("Chưa đăng nhập Cổng YTM. Trợ lý gọi ytm_dang_nhap trước, rồi chạy lại lệnh cập nhật.");
  if (tt.loi || !tt.phien_ban) dung(`Máy chủ chưa cho biết bản được dùng (${tt.loi ?? "không có bản"}). Trợ lý gọi ytm_trang_thai để xem lý do.`);

  const ban = tt.phien_ban;
  const ghiChuHan =
    tt.ban_moi_nhat && soSanh(tt.ban_moi_nhat, ban) > 0
      ? `\nĐã có bản ${tt.ban_moi_nhat}, nhưng hạn cập nhật của bạn đã hết nên được dùng tới bản ${ban}. Gia hạn tại https://tool.aicong.vn/youtube-machine/`
      : "";
  if (soSanh(ban, banMay) <= 0) dung(`Bạn đang dùng YouTube Machine bản ${banMay}, là bản mới nhất bạn được dùng.${ghiChuHan}`, 0);
  if (co("--kiem")) dung(`Đã có YouTube Machine bản ${ban} (máy đang cài bản ${banMay}). Nói "cập nhật YouTube Machine" để cập nhật.${ghiChuHan}`, 0);

  tuMayChu = hoiCong("--goi");
  if (!tuMayChu) dung("Không lấy được link tải gói. Kiểm tra mạng rồi thử lại.");
  if (tuMayChu.loi === "chua-dang-nhap") dung("Chưa đăng nhập Cổng YTM. Trợ lý gọi ytm_dang_nhap trước, rồi chạy lại lệnh cập nhật.");
  if (tuMayChu.loi === "sai-hanh-dong") {
    dung(
      `Máy chủ chưa mở cập nhật qua chat. Tải bản ${ban} ở mục Tải về trên https://tool.aicong.vn/youtube-machine/, ` +
        'rồi nói "cập nhật YouTube Machine từ file zip <đường dẫn file>".',
    );
  }
  if (tuMayChu.loi || !tuMayChu.url) dung(tuMayChu.thong_bao || `Máy chủ chưa giao được gói bản ${ban} (${tuMayChu.loi}). Báo nhóm hỗ trợ.`);
  if (tuMayChu.phien_ban !== ban) dung(`Máy chủ báo hai bản khác nhau (${ban} và ${tuMayChu.phien_ban}). Thử lại sau ít phút.`);

  fs.mkdirSync(THU_TAI, { recursive: true });
  tepZip = path.join(THU_TAI, tuMayChu.ten || `youtube-machine-v${ban}.zip`);
  console.log(`Đang tải YouTube Machine bản ${ban}...`);
  let res;
  try {
    res = await fetch(tuMayChu.url);
  } catch (e) {
    dung(`Tải gói không được (${e.message}). Kiểm tra mạng rồi thử lại.`);
  }
  if (!res.ok) dung(`Tải gói không được (máy chủ trả ${res.status}). Thử lại sau ít phút.`);
  const buf = Buffer.from(await res.arrayBuffer());
  const kt = Number(res.headers.get("content-length") || 0);
  if (!buf.length || (kt && kt !== buf.length)) dung("Gói tải về bị thiếu. Thử lại.");
  fs.writeFileSync(tepZip, buf);
} else if (!fs.existsSync(tepZip)) {
  dung(`Không thấy file ${tepZip}.`);
}

// ---------------------------------------------------------------------------
// 2. Đọc zip (deflate hoặc lưu thẳng), kiểm CRC từng file
// ---------------------------------------------------------------------------
const BANG_CRC = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(b) {
  let c = 0xffffffff;
  for (const x of b) c = BANG_CRC[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function docZip(f) {
  const z = fs.readFileSync(f);
  let e = -1;
  for (let i = z.length - 22; i >= Math.max(0, z.length - 22 - 65535); i--) {
    if (z.readUInt32LE(i) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) throw new Error("không phải file zip");
  const soMuc = z.readUInt16LE(e + 10);
  let p = z.readUInt32LE(e + 16);
  const ra = new Map();
  for (let k = 0; k < soMuc; k++) {
    if (z.readUInt32LE(p) !== 0x02014b50) throw new Error("mục lục zip hỏng");
    const cachNen = z.readUInt16LE(p + 10);
    const crc = z.readUInt32LE(p + 16);
    const dai = z.readUInt32LE(p + 20);
    const nl = z.readUInt16LE(p + 28), xl = z.readUInt16LE(p + 30), cl = z.readUInt16LE(p + 32);
    const vt = z.readUInt32LE(p + 42);
    const ten = z.slice(p + 46, p + 46 + nl).toString("utf8").replace(/\\/g, "/"); // zip của PowerShell 5.1 dùng dấu \
    p += 46 + nl + xl + cl;
    if (ten.endsWith("/")) continue;
    const bd = vt + 30 + z.readUInt16LE(vt + 26) + z.readUInt16LE(vt + 28);
    const tho = z.slice(bd, bd + dai);
    const goc = cachNen === 0 ? tho : cachNen === 8 ? zlib.inflateRawSync(tho) : null;
    if (!goc) throw new Error(`${ten}: cách nén ${cachNen} chưa hỗ trợ`);
    if (crc32(goc) !== crc) throw new Error(`${ten}: hỏng (sai CRC)`);
    ra.set(ten, goc);
  }
  return ra;
}

let tho;
try {
  tho = docZip(tepZip);
} catch (e) {
  dung(`Gói ${path.basename(tepZip)} bị lỗi: ${e.message}. Tải lại rồi thử.`);
}
// Zip của YouTube Machine có thư mục gốc youtube-machine/: bỏ phần đó đi.
const dau = [...tho.keys()].map((t) => t.split("/")[0]);
const coGoc = dau.length && dau.every((d) => d === dau[0]) && [...tho.keys()].every((t) => t.includes("/"));
const moi = new Map();
for (const [ten, b] of tho) {
  const rel = path.posix.normalize(coGoc ? ten.slice(dau[0].length + 1) : ten);
  if (!rel || rel.startsWith("../") || rel.startsWith("/") || /^[A-Za-z]:/.test(rel)) dung(`Gói có đường dẫn lạ (${ten}), dừng để an toàn.`);
  if (GIU.some((g) => rel.startsWith(g))) continue;
  moi.set(rel, b);
}
if (!moi.has("PHIEN-BAN.json") || !moi.has("AGENTS.md")) dung("Gói này không phải gói YouTube Machine (thiếu PHIEN-BAN.json hoặc AGENTS.md).");
const banMoi = JSON.parse(moi.get("PHIEN-BAN.json").toString("utf8").replace(/^﻿/, "")).phien_ban;
if (tuMayChu && banMoi !== tuMayChu.phien_ban) dung(`Gói tải về là bản ${banMoi}, không khớp bản máy chủ báo (${tuMayChu.phien_ban}). Báo nhóm hỗ trợ.`);
if (soSanh(banMoi, banMay) <= 0 && !co("--ep")) dung(`Gói là bản ${banMoi}, không mới hơn bản đang cài (${banMay}). Không đổi gì.`, 0);

// ---------------------------------------------------------------------------
// 3. Thay file. Bản cũ của file bị thay hay bị bỏ chuyển vào _thung-rac/.
// ---------------------------------------------------------------------------
const gio = new Date();
const nhan = `${gio.getFullYear()}${String(gio.getMonth() + 1).padStart(2, "0")}${String(gio.getDate()).padStart(2, "0")}-${String(gio.getHours()).padStart(2, "0")}${String(gio.getMinutes()).padStart(2, "0")}`;
const THUNG = path.join(GOC, "_thung-rac", `cap-nhat-${banMay}-sang-${banMoi}-${nhan}`);
const vaoThung = (rel, chuyen) => {
  const dich = path.join(THUNG, rel);
  fs.mkdirSync(path.dirname(dich), { recursive: true });
  chuyen ? fs.renameSync(path.join(GOC, rel), dich) : fs.copyFileSync(path.join(GOC, rel), dich);
};

let dsCu = [];
try {
  dsCu = docJson(path.join(GOC, "tools", "goi-tep.json"));
} catch {
  dsCu = []; // gói 1.0.0 chưa có danh sách: không dọn file cũ, chỉ thêm và thay
}

const dem = { them: 0, thay: 0, bo: 0, giong: 0 };
const daDoi = [];
try {
  for (const [rel, b] of moi) {
    const dich = path.join(GOC, rel);
    if (fs.existsSync(dich)) {
      if (fs.statSync(dich).isDirectory()) throw new Error(`${rel} đang là thư mục trên máy`);
      if (fs.readFileSync(dich).equals(b)) {
        dem.giong++;
        continue;
      }
      vaoThung(rel, false);
      dem.thay++;
    } else dem.them++;
    fs.mkdirSync(path.dirname(dich), { recursive: true });
    fs.writeFileSync(dich, b);
    daDoi.push(rel);
  }
  for (const rel of dsCu) {
    if (moi.has(rel) || GIU.some((g) => rel.startsWith(g)) || !fs.existsSync(path.join(GOC, rel))) continue;
    vaoThung(rel, true);
    dem.bo++;
  }
} catch (e) {
  dung(
    `Cập nhật dừng giữa chừng: ${e.message}. Bản cũ của các file đã đổi nằm ở ${path.relative(GOC, THUNG)}. ` +
      "Đóng các chương trình đang mở file trong thư mục rồi chạy lại lệnh cập nhật.",
  );
}

fs.mkdirSync(THU_TAI, { recursive: true });
fs.appendFileSync(
  path.join(THU_TAI, "nhat-ky.jsonl"),
  JSON.stringify({ luc: gio.toISOString(), tu: banMay, len: banMoi, ...dem, nguon: tuMayChu ? "may-chu" : "zip-tay" }) + "\n",
);
if (tuMayChu) fs.rmSync(tepZip, { force: true }); // zip tạm do lệnh này tải, không phải file của người dùng

console.log(
  `Đã cập nhật YouTube Machine từ bản ${banMay} lên ${banMoi}: ${dem.them} file mới, ${dem.thay} file thay, ${dem.bo} file bản mới bỏ, ${dem.giong} file giữ nguyên.`,
);
if (dem.thay || dem.bo) console.log(`Bản cũ của file bị thay hoặc bị bỏ nằm ở ${path.relative(GOC, THUNG)}. Bạn tự xóa khi không cần nữa.`);
console.log("Thư mục channels/ và hồ sơ kênh giữ nguyên.");

// Thông báo bản mới và các thay đổi (tools/phien-ban.mjs của bản vừa cài).
const tb = spawnSync(process.execPath, [path.join(GOC, "tools", "phien-ban.mjs")], { encoding: "utf8", timeout: 30_000, windowsHide: true });
if (tb.stdout?.trim()) console.log(`\n${tb.stdout.trim()}`);
if (daDoi.some((r) => ["AGENTS.md", "GEMINI.md", ".mcp.json", "tools/ytm-cong.mjs"].includes(r))) {
  console.log("\nHướng dẫn cho trợ lý hoặc Cổng YTM vừa đổi. Mở phiên chat mới để trợ lý dùng bản mới.");
}
