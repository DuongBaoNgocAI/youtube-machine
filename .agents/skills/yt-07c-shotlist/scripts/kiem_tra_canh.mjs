// Kiểm tra kế hoạch cảnh (plan.json) của bước 7c trước khi tạo hình. Không cần Flow AIC đang chạy.
//   node kiem_tra_canh.mjs <NNN-slug.plan.json> [--srt <NNN-slug.scenes.srt>] [--csv <bang-canh.csv>]
// Lỗi thì thoát mã 1. --srt so số cảnh với số dòng và ghép chữ. --csv xuất bảng cảnh để nạp vào Flow AIC hoặc dùng với công cụ ảnh khác.
//
// plan.json:
// { "aspect": "16:9", "wps": 2.4, "narration": "external",
//   "video": { "model": "Omni 1.1 Flash", "resolution": "720p", "count": 1 },
//   "library": ["TEN_CO_DINH"],
//   "scenes": [ { "type": "EST", "prompt": "...", "motion": "...", "duration": 6, "line": "...", "link": "cut", "video": false } ] }
import fs from "fs";

const doi = process.argv.slice(2);
const lay = (ten) => (doi.includes(ten) ? doi[doi.indexOf(ten) + 1] : null);
const file = doi.find((a, i) => !a.startsWith("--") && !["--srt", "--csv"].includes(doi[i - 1]));
if (!file) {
  console.error("Dùng: node kiem_tra_canh.mjs <plan.json> [--srt <scenes.srt>] [--csv <ra.csv>]");
  process.exit(2);
}
let ke;
try {
  ke = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
} catch (e) {
  console.error(`Không đọc được ${file}: ${e.message}`);
  process.exit(2);
}

// Giá Flow lúc viết; ảnh khóa miễn phí. Giá đổi thì sửa ở đây và trong references/viet-prompt.md.
const GIA = {
  "Omni 1.1 Flash": { "360p": { 4: 4, 6: 5, 8: 6, 10: 7 }, "720p": { 4: 7, 6: 10, 8: 12, 10: 15 } },
};
const THOI_LUONG = [4, 6, 8, 10];
const NOI = ["cut", "keyframe", "lastframe"];
const CO_DAU = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

const loi = [], luuY = [];
const canh = Array.isArray(ke.scenes) ? ke.scenes : [];
const v = { resolution: "720p", count: 1, ...(ke.video || {}) };
const bangGia = GIA[v.model]?.[v.resolution];
const thuVien = new Set((ke.library || []).map((x) => String(x).replace(/^@/, "").toUpperCase()));
if (!canh.length) loi.push("Không có cảnh nào trong scenes.");
if (ke.aspect && !["16:9", "9:16"].includes(ke.aspect)) loi.push(`Tỉ lệ ${ke.aspect} không hợp lệ, chỉ dùng 16:9 hoặc 9:16.`);
if (!v.model) loi.push("Thiếu video.model. Hỏi người dùng chọn model cho video này, không tự chọn.");
else if (!bangGia) luuY.push(`Chưa có giá cho ${v.model} ${v.resolution}, không tính được tín dụng.`);

let tinDung = 0, soClip = 0;
canh.forEach((c, i) => {
  const so = `Cảnh ${i + 1}`;
  const prompt = String(c.prompt || "");
  const clip = c.video !== false;
  if (!prompt.trim()) loi.push(`${so}: thiếu prompt.`);
  if (prompt.length > 600) luuY.push(`${so}: prompt ${prompt.length} ký tự. Quá khoảng 600 thì công cụ ảnh hay bỏ phần cuối.`);
  if (CO_DAU.test(prompt)) luuY.push(`${so}: prompt có tiếng Việt. Nên viết tiếng Anh.`);
  if (!String(c.line || "").trim()) luuY.push(`${so}: thiếu chữ lời đọc (line).`);
  if (!THOI_LUONG.includes(Number(c.duration))) loi.push(`${so}: duration ${c.duration} phải là 4, 6, 8 hoặc 10.`);
  const noi = c.link || "cut";
  if (!NOI.includes(noi)) loi.push(`${so}: link "${noi}" phải là cut, keyframe hoặc lastframe.`);
  if (noi === "lastframe" && !clip) loi.push(`${so}: ảnh tĩnh không nối lastframe được vì không có khung cuối.`);
  if (noi === "lastframe" && canh[i + 1]?.video === false) loi.push(`Cảnh ${i + 2}: nhận lastframe từ cảnh trước nên phải là clip.`);
  if (clip && !String(c.motion || "").trim()) luuY.push(`${so}: clip chưa có motion.`);
  if (clip && ke.narration === "external" && !/no (dialogue|speech)/i.test(String(c.motion || ""))) {
    luuY.push(`${so}: thêm "no dialogue, no speech" vào motion để tiếng trong clip không đè giọng đọc.`);
  }
  const ten = [...new Set([...`${prompt} ${c.motion || ""}`.matchAll(/@([A-Za-z0-9_]+)/g)].map((m) => m[1].toUpperCase()))];
  if (ten.length > 3) luuY.push(`${so}: ${ten.length} @TÊN, Flow chỉ nhận tối đa 3 ảnh tham chiếu.`);
  if (thuVien.size) ten.filter((t) => !thuVien.has(t)).forEach((t) => luuY.push(`${so}: @${t} chưa có trong library.`));
  if (clip) {
    soClip++;
    if (bangGia?.[Number(c.duration)]) tinDung += bangGia[Number(c.duration)] * Number(v.count || 1);
  }
});

const srt = lay("--srt");
if (srt) {
  const khoi = fs.readFileSync(srt, "utf8").replace(/^﻿/, "").trim().split(/\r?\n\s*\r?\n/).filter((k) => k.includes("-->"));
  if (khoi.length !== canh.length) loi.push(`Plan có ${canh.length} cảnh, SRT có ${khoi.length} dòng. Cảnh N phải khớp dòng N.`);
  const gon = (s) => String(s || "").toLowerCase().replace(/\[[^\]]*\]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  khoi.forEach((k, i) => {
    const chu = gon(k.split(/\r?\n/).slice(k.split(/\r?\n/).findIndex((d) => d.includes("-->")) + 1).join(" "));
    if (canh[i] && canh[i].line && gon(canh[i].line) !== chu) luuY.push(`Cảnh ${i + 1}: line khác chữ trong SRT.`);
  });
}

const csv = lay("--csv");
if (csv) {
  const o = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dong = ["prompt,motion,duration,line,link,video"];
  for (const c of canh) dong.push([o(c.prompt), o(c.motion), c.duration, o(c.line), c.link || "cut", c.video === false ? "no" : "yes"].join(","));
  fs.writeFileSync(csv, "﻿" + dong.join("\r\n") + "\r\n");
}

const uocTinh = bangGia ? `Ước tính ${tinDung} tín dụng` : "Chưa tính được tín dụng, xem số trong workflow_estimate";
console.log(`${canh.length} cảnh: ${soClip} clip, ${canh.length - soClip} ảnh tĩnh. ${uocTinh} (${v.model || "chưa chọn model"} ${v.resolution}, ${v.count} bản mỗi cảnh).`);
if (loi.length) {
  console.log(`\nLỖI (${loi.length}):`);
  loi.forEach((x) => console.log(`- ${x}`));
}
if (luuY.length) {
  console.log(`\nNÊN XEM (${luuY.length}):`);
  luuY.slice(0, 40).forEach((x) => console.log(`- ${x}`));
  if (luuY.length > 40) console.log(`- ... và ${luuY.length - 40} mục nữa`);
}
if (!loi.length && !luuY.length) console.log("Không có lỗi.");
if (csv) console.log(`\nĐã ghi ${csv}`);
process.exit(loi.length ? 1 : 0);
