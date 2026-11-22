// Thông báo phiên bản: in lời chào ở lần đầu mở bộ skill, in thay đổi sau khi cập nhật bản mới,
// và báo khi máy chủ đã có bản mới hơn gói đang cài trên máy.
//   node tools/phien-ban.mjs          lần đầu, vừa cập nhật, hoặc có bản mới thì in thông báo, còn lại không in gì
//   node tools/phien-ban.mjs --xem    luôn in phiên bản đang cài
// Dấu đã xem nằm ở .youtube-machine/da-cai.json, không nằm trong gói phát.
// Bản trên máy lấy theo PHIEN-BAN.json của gói. Bản được dùng lấy từ máy chủ qua tools/ytm-cong.mjs --phien-ban.
// Máy chủ có bản mới hơn gói thì nhắc người dùng nói "cập nhật YouTube Machine" (tools/cap-nhat.mjs).
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAU = path.join(GOC, ".youtube-machine", "da-cai.json");
const goi = JSON.parse(fs.readFileSync(path.join(GOC, "PHIEN-BAN.json"), "utf8").replace(/^﻿/, ""));

const so = (v) => String(v ?? "0").split(".").map((x) => parseInt(x, 10) || 0);
function soSanh(a, b) {
  const x = so(a), y = so(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

let mayChu = null;
try {
  const r = spawnSync(process.execPath, [path.join(GOC, "tools", "ytm-cong.mjs"), "--phien-ban"], {
    encoding: "utf8",
    timeout: 15_000,
    windowsHide: true,
  });
  mayChu = JSON.parse(r.stdout.trim().split("\n").pop() || "null");
} catch {
  mayChu = null;
}
const coCapNhat = fs.existsSync(path.join(GOC, "tools", "cap-nhat.mjs"));
const banCoMoi = mayChu?.phien_ban && soSanh(mayChu.phien_ban, goi.phien_ban) > 0 ? mayChu.phien_ban : null;
const loiCoMoi = banCoMoi
  ? coCapNhat
    ? `Đã có YouTube Machine bản ${banCoMoi} (máy đang cài bản ${goi.phien_ban}). Nói "cập nhật YouTube Machine" để trợ lý cập nhật, thư mục channels/ giữ nguyên.`
    : `Đã có YouTube Machine bản ${banCoMoi} (máy đang cài bản ${goi.phien_ban}). Tải bản mới ở mục Tải về trên https://tool.aicong.vn/youtube-machine/ rồi chép đè vào thư mục này. Từ bản đó trở đi, chỉ cần nói "cập nhật YouTube Machine".`
  : null;
const banMoiNhat = mayChu?.ban_moi_nhat && soSanh(mayChu.ban_moi_nhat, mayChu.phien_ban) > 0 ? mayChu.ban_moi_nhat : null;
const loiGiaHan = banMoiNhat
  ? `Đã có bản ${banMoiNhat}. Hạn cập nhật của bạn đã hết nên được dùng tới bản ${mayChu.phien_ban}. Gia hạn tại https://tool.aicong.vn/youtube-machine/`
  : null;

function docDau() {
  try {
    return JSON.parse(fs.readFileSync(DAU, "utf8"));
  } catch {
    return null;
  }
}

// Lấy các mục trong CHANGELOG mới hơn bản cũ. Mục mới nằm trên cùng, tiêu đề dạng "## 1.2.0 (ngày)".
function thayDoiTu(cu) {
  let t = "";
  try {
    t = fs.readFileSync(path.join(GOC, "CHANGELOG.md"), "utf8");
  } catch {
    return "";
  }
  const muc = t.split(/^## /m).slice(1);
  const moi = [];
  for (const m of muc) {
    if (soSanh(m.split(/\s/)[0], cu) <= 0) break;
    moi.push(`Bản ${m.trim()}`);
  }
  return moi.join("\n\n");
}

const cuoi = [
  `Hỗ trợ: nhóm Zalo ${goi.ho_tro}`,
  `Cập nhật miễn phí ${goi.cap_nhat}. Phạm vi dùng: ${goi.pham_vi}. Điều khoản ở LICENSE.txt.`,
];
const nhac = () => {
  if (loiCoMoi) console.log(loiCoMoi);
  if (loiGiaHan) console.log(loiGiaHan);
};

const daCai = docDau();
if (process.argv.includes("--xem")) {
  console.log(`${goi.ten} phiên bản ${goi.phien_ban} (${goi.ngay}), phát hành bởi ${goi.ban_hanh}.`);
  console.log(cuoi.join("\n"));
  console.log(
    mayChu?.email
      ? `Cổng YTM: đã đăng nhập bằng ${mayChu.email}, được dùng bản ${mayChu.phien_ban ?? "chưa có"}.`
      : "Cổng YTM: chưa đăng nhập hoặc không kết nối được máy chủ.",
  );
  nhac();
  process.exit(0);
}
if (daCai?.phien_ban === goi.phien_ban) {
  nhac(); // không in gì nếu không có bản mới
  process.exit(0);
}

if (!daCai) {
  console.log(`Chào bạn. Đã cài xong ${goi.ten} phiên bản ${goi.phien_ban} (${goi.ngay}), phát hành bởi ${goi.ban_hanh}.`);
  console.log(cuoi.join("\n"));
  console.log("Cần cài thêm gì: xem mục Cài đặt trong README.md. Bắt đầu bằng câu: \"Tôi muốn xây kênh YouTube mới\".");
} else {
  console.log(`Đang dùng ${goi.ten} bản ${goi.phien_ban} (${goi.ngay}), cập nhật từ bản ${daCai.phien_ban}. Thư mục channels/ của bạn giữ nguyên.`);
  const thayDoi = thayDoiTu(daCai.phien_ban);
  if (thayDoi) console.log(`\n${thayDoi}\n`);
  console.log(cuoi[0]);
}
nhac();

try {
  fs.mkdirSync(path.dirname(DAU), { recursive: true });
  fs.writeFileSync(DAU, JSON.stringify({ phien_ban: goi.phien_ban, luc: new Date().toISOString() }, null, 2) + "\n");
} catch (e) {
  console.error(`Không ghi được dấu đã xem (${e.message}). Thông báo sẽ hiện lại ở lần sau.`);
}
