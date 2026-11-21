// Thông báo phiên bản: in lời chào ở lần đầu mở bộ skill, và in thay đổi sau khi cập nhật bản mới.
//   node tools/phien-ban.mjs          lần đầu hoặc có bản mới thì in thông báo, còn lại không in gì
//   node tools/phien-ban.mjs --xem    luôn in phiên bản đang cài
// Dấu đã xem nằm ở .youtube-machine/da-cai.json, không nằm trong gói phát.
// Từ 1.0.0, nội dung skill đến từ máy chủ: phiên bản lấy theo ytm_trang_thai (qua tools/ytm-cong.mjs --phien-ban).
// Chưa đăng nhập hay mất mạng thì dùng phiên bản ghi trong PHIEN-BAN.json.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAU = path.join(GOC, ".youtube-machine", "da-cai.json");
const goi = JSON.parse(fs.readFileSync(path.join(GOC, "PHIEN-BAN.json"), "utf8").replace(/^﻿/, ""));

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
const banGoi = goi.phien_ban;
if (mayChu?.phien_ban) {
  goi.phien_ban = mayChu.phien_ban;
  if (goi.phien_ban !== banGoi) goi.ngay = `máy chủ, gói cài ${banGoi}`;
}
const banMoiHon = mayChu?.ban_moi_nhat && mayChu.ban_moi_nhat !== mayChu.phien_ban ? mayChu.ban_moi_nhat : null;
const loiGiaHan = banMoiHon
  ? `Đã có bản ${banMoiHon}. Hạn cập nhật của bạn đã hết nên vẫn dùng bản ${mayChu.phien_ban}. Gia hạn tại https://tool.aicong.vn/youtube-machine/`
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
    if (m.split(/\s/)[0] === cu) break;
    moi.push(`Bản ${m.trim()}`);
  }
  return moi.join("\n\n");
}

const cuoi = [
  `Hỗ trợ: nhóm Zalo ${goi.ho_tro}`,
  `Cập nhật miễn phí ${goi.cap_nhat}. Phạm vi dùng: ${goi.pham_vi}. Điều khoản ở LICENSE.txt.`,
];

const daCai = docDau();
if (process.argv.includes("--xem")) {
  console.log(`${goi.ten} phiên bản ${goi.phien_ban} (${goi.ngay}), phát hành bởi ${goi.ban_hanh}.`);
  console.log(cuoi.join("\n"));
  console.log(mayChu?.email ? `Cổng YTM: đã đăng nhập bằng ${mayChu.email}.` : "Cổng YTM: chưa đăng nhập hoặc không kết nối được máy chủ.");
  if (loiGiaHan) console.log(loiGiaHan);
  process.exit(0);
}
if (daCai?.phien_ban === goi.phien_ban) process.exit(0);

if (!daCai) {
  console.log(`Chào bạn. Đã cài xong ${goi.ten} phiên bản ${goi.phien_ban} (${goi.ngay}), phát hành bởi ${goi.ban_hanh}.`);
  console.log(cuoi.join("\n"));
  console.log("Cần cài thêm gì: xem HUONG-DAN-CAI.md. Bắt đầu bằng câu: \"Tôi muốn xây kênh YouTube mới\".");
} else {
  console.log(`Đã cập nhật ${goi.ten} từ ${daCai.phien_ban} lên ${goi.phien_ban} (${goi.ngay}). Thư mục channels/ của bạn giữ nguyên.`);
  const thayDoi = thayDoiTu(daCai.phien_ban);
  if (thayDoi) console.log(`\n${thayDoi}\n`);
  console.log(cuoi[0]);
}
if (loiGiaHan) console.log(loiGiaHan);

try {
  fs.mkdirSync(path.dirname(DAU), { recursive: true });
  fs.writeFileSync(DAU, JSON.stringify({ phien_ban: goi.phien_ban, luc: new Date().toISOString() }, null, 2) + "\n");
} catch (e) {
  console.error(`Không ghi được dấu đã xem (${e.message}). Thông báo sẽ hiện lại ở lần sau.`);
}
