// Lập bản cắt cho video quay hoặc ghi màn hình: tìm khoảng lặng, chia câu theo lời bóc, đề xuất câu hỏng và câu nói lại.
// Không sửa video. Người dùng hoặc trợ lý đọc bản cắt, đổi "giu", rồi chạy cat-video.mjs.
//   node tools/footage/ban-cat.mjs --video <video> --ra <tiền tố> [--loi <x.stt.json | x.srt>] [--nguong -35] [--lang 0.6]
// Ra: <tiền tố>.cat.json và <tiền tố>.cat.md
// Có .stt.json: chia theo câu, cắt được từ đệm riêng lẻ, nhận ra câu nói lại.
// Có .srt: chia theo dòng, nhận ra câu nói lại, không cắt được từ đệm trong câu.
// Không có lời bóc: chỉ cắt khoảng lặng.
import fs from "fs";
import { spawnSync } from "child_process";

const vao = process.argv.slice(2);
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const video = lay("video");
const tienTo = lay("ra");
const fileLoi = lay("loi");
const nguong = Number(lay("nguong", -35));
const lang = Number(lay("lang", 0.6));
if (!video || !tienTo) {
  console.error("Dùng: node tools/footage/ban-cat.mjs --video <video> --ra <tiền tố> [--loi x.stt.json|x.srt] [--nguong -35] [--lang 0.6]");
  process.exit(1);
}
if (!fs.existsSync(video)) { console.error(`Không thấy ${video}`); process.exit(1); }

const TU_DEM = new Set(["um", "uh", "uhm", "umm", "erm", "hmm", "ờ", "ừ", "ừm", "ờm", "ơ", "à", "ạ"]);
const CAU_MOI_GIAY = 0.8;  // Khoảng nghỉ từ 0,8 giây là hết câu dù không có dấu.
const TOI_DA_TU = 28;
const lamTron = (x) => Number(x.toFixed(3));
const gio = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const chuan = (c) => c.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

function thoiLuong() {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video], { encoding: "utf8" });
  if (r.status !== 0) { console.error("ffprobe không đọc được file."); process.exit(1); }
  return Number(r.stdout);
}

function timLang() {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", video, "-vn", "-af", `silencedetect=noise=${nguong}dB:d=${lang}`, "-f", "null", "-"],
    { encoding: "utf8", maxBuffer: 1 << 28 });
  const ds = [];
  let dau = null;
  for (const d of (r.stderr || "").split(/\r?\n/)) {
    const a = d.match(/silence_start: (-?[\d.]+)/);
    const b = d.match(/silence_end: ([\d.]+)/);
    if (a) dau = Math.max(0, Number(a[1]));
    if (b && dau !== null) { ds.push({ tu: lamTron(dau), den: lamTron(Number(b[1])) }); dau = null; }
  }
  return ds;
}

const giay = (t) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000; };

function docSrt(p) {
  return fs.readFileSync(p, "utf8").replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/).flatMap((k) => {
    const dong = k.trim().split("\n");
    const i = dong.findIndex((d) => d.includes("-->"));
    if (i < 0) return [];
    const [a, b] = dong[i].split("-->").map((x) => giay(x.trim()));
    const chu = dong.slice(i + 1).join(" ").trim();
    return chu ? [{ tu: a, den: b, chu, bo: [] }] : [];
  });
}

function docStt(p) {
  const tu = (JSON.parse(fs.readFileSync(p, "utf8")).words || []).filter((w) => w.type === "word");
  const ds = [];
  let hien = [];
  const dong = () => {
    if (!hien.length) return;
    const bo = hien.filter((w) => TU_DEM.has(chuan(w.text).join(""))).map((w) => ({ tu: w.start, den: w.end, chu: w.text.trim() }));
    ds.push({ tu: hien[0].start, den: hien[hien.length - 1].end, chu: hien.map((w) => w.text.trim()).join(" "), bo });
    hien = [];
  };
  tu.forEach((w, i) => {
    const ke = tu[i + 1];
    hien.push(w);
    if (/[.?!…]["”']?$/.test(w.text.trim()) || !ke || ke.start - w.end >= CAU_MOI_GIAY || hien.length >= TOI_DA_TU) dong();
  });
  return ds;
}

// Hai câu gần nhau có đoạn đầu giống nhau, hoặc gần trùng: coi câu trước là lần nói hỏng.
function laNoiLai(a, b) {
  const x = chuan(a.chu);
  const y = chuan(b.chu);
  if (x.length < 3 || y.length < 3) return false;
  let chungDau = 0;
  while (chungDau < x.length && chungDau < y.length && x[chungDau] === y[chungDau]) chungDau++;
  if (chungDau >= 4) return true;
  if (chungDau === x.length) return true;
  const sx = new Set(x);
  const sy = new Set(y);
  const chung = [...sx].filter((t) => sy.has(t)).length;
  return chung / (sx.size + sy.size - chung) >= 0.7;
}

const dai = thoiLuong();
const quangLang = timLang();
let doan;
let che;

if (fileLoi) {
  if (!fs.existsSync(fileLoi)) { console.error(`Không thấy ${fileLoi}`); process.exit(1); }
  che = fileLoi.endsWith(".json") ? "stt" : "srt";
  const cau = che === "stt" ? docStt(fileLoi) : docSrt(fileLoi);
  doan = cau.map((c, i) => ({ id: i + 1, tu: lamTron(c.tu), den: lamTron(c.den), chu: c.chu, giu: true, ly_do: "", bo: c.bo.map((b) => ({ tu: lamTron(b.tu), den: lamTron(b.den), chu: b.chu })) }));
  doan.forEach((d, i) => {
    const tu = chuan(d.chu);
    if (tu.length && tu.every((t) => TU_DEM.has(t))) { d.giu = false; d.ly_do = "chỉ có từ đệm"; return; }
    for (const ke of doan.slice(i + 1, i + 3)) {
      if (laNoiLai(d, ke)) { d.giu = false; d.ly_do = `có vẻ nói lại ở câu ${ke.id}`; break; }
    }
  });
} else {
  che = "lang";
  doan = [];
  let dau = 0;
  for (const q of [...quangLang, { tu: dai, den: dai }]) {
    if (q.tu - dau >= 0.15) doan.push({ id: doan.length + 1, tu: lamTron(dau), den: lamTron(q.tu), chu: "", giu: true, ly_do: "", bo: [] });
    dau = q.den;
  }
}

const ban = { video, che_do: che, thoi_luong: lamTron(dai), nguong_db: nguong, lang_toi_thieu: lang, quang_lang: quangLang, doan };
fs.writeFileSync(`${tienTo}.cat.json`, JSON.stringify(ban, null, 1));

const boDe = doan.filter((d) => !d.giu);
const soBoTu = doan.reduce((t, d) => t + d.bo.length, 0);
const giuGiay = doan.filter((d) => d.giu).reduce((t, d) => t + d.den - d.tu, 0);
const md = [
  `# Bản cắt: ${video}`,
  "",
  `- Chế độ: ${che} | Dài gốc: ${gio(dai)} | Lời còn lại khoảng: ${gio(giuGiay)}`,
  `- Khoảng lặng từ ${lang} giây: ${quangLang.length} | Đề xuất bỏ: ${boDe.length} đoạn | Từ đệm trong câu: ${soBoTu}`,
  "",
  "Đổi `giu` trong file `.cat.json` rồi chạy `tools/footage/cat-video.mjs`. Đề xuất do máy đoán, phải đọc lại trước khi cắt.",
  "",
  "| # | Giờ | Giữ | Lý do | Lời |",
  "|---|---|---|---|---|",
  ...doan.map((d) => `| ${d.id} | ${gio(d.tu)} | ${d.giu ? "có" : "**bỏ**"} | ${d.ly_do} | ${d.chu.replace(/\|/g, "/").slice(0, 120)} |`),
];
fs.writeFileSync(`${tienTo}.cat.md`, md.join("\n") + "\n");
console.log(`Chế độ ${che}: ${doan.length} đoạn, ${quangLang.length} khoảng lặng, đề xuất bỏ ${boDe.length} đoạn, ${soBoTu} từ đệm.`);
console.log(`Ra: ${tienTo}.cat.json, ${tienTo}.cat.md`);
