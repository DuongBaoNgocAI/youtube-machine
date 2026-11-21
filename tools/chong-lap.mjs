// So kịch bản của một video với các video khác trong kênh, tìm chỗ lặp khuôn. Chỉ đọc, không sửa file.
//   node tools/chong-lap.mjs <kenh>               soát video mới nhất có lời đọc
//   node tools/chong-lap.mjs <kenh> <NNN>         soát một video
//   node tools/chong-lap.mjs <kenh> --tat-ca      soát từng video với các video trước nó
//   thêm --json để lấy kết quả dạng máy đọc
// Đọc file *-voice.txt, hoặc *-loi.txt của video có lời nhưng không dùng giọng AI, và kenh/so-khac-biet.md nếu có.
// Mức Đỏ, Vàng là dấu hiệu để con người xem lại, không phải kết luận của YouTube.
import fs from "fs";
import path from "path";

const GOC = "channels";
const SO_TU_MO = 15;          // Số từ đầu tính là câu mở.
const NGRAM = 5;              // Cụm 5 từ liên tiếp để đo trùng lời.
const TU_CAU_LAP = 6;         // Câu từ 6 từ trở lên trùng nguyên văn mới báo.
const MO_VANG = 0.25;         // Độ trùng từ của câu mở.
const MO_DO = 0.4;
const LOI_VANG = 0.03;        // Tỉ lệ cụm 5 từ của video này đã có trong một video khác.
const LOI_DO = 0.1;
const CHUOI_CUNG_KIEU = 3;    // Số video liền nhau cùng một kiểu thì báo.

const doiSo = process.argv.slice(2);
const coJson = doiSo.includes("--json");
const tatCa = doiSo.includes("--tat-ca");
const [kenh, nnn] = doiSo.filter((d) => !d.startsWith("--"));

function dung(loi) {
  console.error(loi);
  process.exit(1);
}

if (!kenh) dung("Dùng: node tools/chong-lap.mjs <kenh> [NNN | --tat-ca] [--json]");
if (!fs.existsSync(GOC)) dung("Chạy lệnh này ở thư mục gốc dự án (nơi có channels/).");
const thuMucKenh = path.join(GOC, kenh);
if (!fs.existsSync(path.join(thuMucKenh, "videos"))) dung(`Không thấy thư mục videos của kênh ${kenh}.`);

// Bỏ thẻ cảm xúc [sighs], dấu câu, chữ hoa; giữ dấu tiếng Việt vì bỏ dấu sẽ làm nhiều từ trùng nhầm.
const tachTu = (van) => van
  .replace(/\[[^\]]*\]/g, " ")
  .toLowerCase()
  .replace(/[’']/g, "")
  .match(/[\p{L}\p{N}]+/gu) || [];

const tachCau = (van) => van
  .replace(/\[[^\]]*\]/g, " ")
  .split(/(?<=[.!?…])\s+|\n+/)
  .map((c) => c.trim())
  .filter(Boolean);

function docVideo(ten) {
  const d = path.join(thuMucKenh, "videos", ten, "1-kich-ban");
  if (!fs.existsSync(d)) return null;
  const tep = fs.readdirSync(d).find((m) => /-(voice|loi)\.txt$/.test(m));
  if (!tep) return null;
  const van = fs.readFileSync(path.join(d, tep), "utf8").replace(/^﻿/, "");
  const tu = tachTu(van);
  if (tu.length < NGRAM) return null;
  const cum = new Set();
  for (let i = 0; i + NGRAM <= tu.length; i++) cum.add(tu.slice(i, i + NGRAM).join(" "));
  const cau = new Map();
  for (const c of tachCau(van)) {
    const k = tachTu(c);
    if (k.length >= TU_CAU_LAP) cau.set(k.join(" "), c);
  }
  return { ten, so: ten.slice(0, 3), tu, cum, cau, mo: tu.slice(0, SO_TU_MO) };
}

const trungTu = (a, b) => {
  const x = new Set(a);
  const y = new Set(b);
  const chung = [...x].filter((t) => y.has(t)).length;
  return chung / (x.size + y.size - chung || 1);
};

const muc = (gt, vang, doDo) => (gt >= doDo ? "Đỏ" : gt >= vang ? "Vàng" : "Xanh");
const THU_TU = { Xanh: 0, "Vàng": 1, "Đỏ": 2 };
const nangMuc = (a, b) => (THU_TU[b] > THU_TU[a] ? b : a);
const pt = (x) => `${(x * 100).toFixed(1)}%`;

function soVoi(v, truoc) {
  const ketQua = { video: v.ten, muc: "Xanh", mo: [], loi: [], cau: [] };
  for (const k of truoc) {
    const doMo = trungTu(v.mo, k.mo);
    const baTuDau = v.mo.slice(0, 3).join(" ") === k.mo.slice(0, 3).join(" ");
    const mucMo = baTuDau ? "Đỏ" : muc(doMo, MO_VANG, MO_DO);
    if (mucMo !== "Xanh") {
      ketQua.mo.push({ voi: k.ten, do_trung: Number(doMo.toFixed(3)), cung_ba_tu_dau: baTuDau, muc: mucMo });
      ketQua.muc = nangMuc(ketQua.muc, mucMo);
    }
    const chung = [...v.cum].filter((c) => k.cum.has(c)).length;
    const tiLe = chung / v.cum.size;
    const mucLoi = muc(tiLe, LOI_VANG, LOI_DO);
    if (mucLoi !== "Xanh") {
      ketQua.loi.push({ voi: k.ten, ti_le: Number(tiLe.toFixed(4)), muc: mucLoi });
      ketQua.muc = nangMuc(ketQua.muc, mucLoi);
    }
    for (const [khoa, goc] of v.cau) {
      if (k.cau.has(khoa)) {
        ketQua.cau.push({ voi: k.ten, cau: goc });
        ketQua.muc = nangMuc(ketQua.muc, "Vàng");
      }
    }
  }
  return ketQua;
}

// Đọc bảng trong kenh/so-khac-biet.md, tìm kiểu lặp ở các video gần nhất, theo từng cột.
function chuoiCungKieu() {
  const p = path.join(thuMucKenh, "kenh", "so-khac-biet.md");
  if (!fs.existsSync(p)) return { coSo: false, chuoi: [] };
  const dong = fs.readFileSync(p, "utf8").split(/\r?\n/).filter((d) => d.trim().startsWith("|"));
  if (dong.length < 3) return { coSo: true, chuoi: [] };
  const cat = (d) => d.trim().replace(/^\||\|$/g, "").split("|").map((o) => o.trim());
  const dau = cat(dong[0]);
  const hang = dong.slice(2).map(cat).filter((h) => h[0]);
  const chuoi = [];
  for (let c = 1; c < dau.length; c++) {
    if (/^(ghi chú|yếu tố riêng|tiêu đề|định dạng)/i.test(dau[c])) continue;
    const cuoi = hang[hang.length - 1]?.[c]?.toLowerCase();
    if (!cuoi || cuoi === "—" || cuoi === "-") continue;
    let dem = 0;
    for (let i = hang.length - 1; i >= 0 && hang[i][c]?.toLowerCase() === cuoi; i--) dem++;
    if (dem >= CHUOI_CUNG_KIEU) chuoi.push({ cot: dau[c], gia_tri: hang[hang.length - 1][c], so_video: dem });
  }
  return { coSo: true, chuoi };
}

const tenVideo = fs.readdirSync(path.join(thuMucKenh, "videos"), { withFileTypes: true })
  .filter((m) => m.isDirectory()).map((m) => m.name).sort();
const video = tenVideo.map(docVideo).filter(Boolean);
if (!video.length) dung(`Kênh ${kenh} chưa có file lời đọc nào.`);

let canSoat;
if (tatCa) canSoat = video;
else if (nnn) {
  canSoat = video.filter((v) => v.so === String(nnn).padStart(3, "0"));
  if (!canSoat.length) dung(`Không thấy lời đọc của video ${nnn}.`);
} else canSoat = [video[video.length - 1]];

const ketQua = canSoat.map((v) => {
  const khac = tatCa ? video.slice(0, video.indexOf(v)) : video.filter((k) => k !== v);
  return { ...soVoi(v, khac), so_video_so_sanh: khac.length };
});
const so = chuoiCungKieu();

if (coJson) {
  console.log(JSON.stringify({ kenh, ket_qua: ketQua, chuoi_cung_kieu: so.chuoi, co_so_khac_biet: so.coSo }, null, 2));
  process.exit(0);
}

for (const k of ketQua) {
  console.log(`\n${k.video}: ${k.muc} (so với ${k.so_video_so_sanh} video)`);
  for (const m of k.mo) console.log(`  Câu mở giống ${m.voi}: trùng ${pt(m.do_trung)}${m.cung_ba_tu_dau ? ", cùng ba từ đầu" : ""} [${m.muc}]`);
  for (const l of k.loi) console.log(`  Lời trùng ${l.voi}: ${pt(l.ti_le)} cụm 5 từ [${l.muc}]`);
  for (const c of k.cau.slice(0, 8)) console.log(`  Câu lặp với ${c.voi}: "${c.cau}"`);
  if (k.cau.length > 8) console.log(`  ... và ${k.cau.length - 8} câu nữa`);
}
if (!so.coSo) console.log("\nChưa có kenh/so-khac-biet.md nên chưa soát kiểu mở, khung, hình, kết.");
for (const c of so.chuoi) console.log(`\nCột "${c.cot}": ${c.so_video} video liền dùng "${c.gia_tri}". Video kế nên đổi.`);
