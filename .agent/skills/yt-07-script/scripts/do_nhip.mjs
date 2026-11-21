#!/usr/bin/env node
// Đo nhịp lời đọc truyện kể (đặc biệt truyện đếm ngày) và so với lời thoại đối thủ.
// Xem references/truyen-sinh-ton-dem-ngay.md.
//
//   node do_nhip.mjs voice.txt --phut 45 [--doi-thu a.txt b.txt ...] [--json]
//
// File đối thủ: văn bản lời thoại; mốc [m:ss] (nếu có) dùng để biết thời lượng.
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const phut = Number(opt('--phut')) || null;
const asJson = args.includes('--json');
const iDt = args.indexOf('--doi-thu');
const doiThu = iDt >= 0 ? args.slice(iDt + 1).filter((a) => !a.startsWith('--')) : [];
const main = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--phut' && (iDt < 0 || i < iDt));
if (!main) {
  console.error('Cách dùng: node do_nhip.mjs voice.txt --phut <số phút> [--doi-thu a.txt ...] [--json]');
  process.exit(2);
}

const SO = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|zero';
const reDay = new RegExp(`\\bday\\s+(\\d+|(?:${SO})(?:[- ](?:${SO}))*)\\b`, 'gi');

function doFile(path, phutCho) {
  let raw = fs.readFileSync(path, 'utf8').replace(/^﻿/, '').replace(/\r/g, '');
  // thời lượng từ mốc [m:ss] cuối cùng nếu không cho
  let thoiLuong = phutCho;
  const moc = [...raw.matchAll(/\[(\d+):(\d\d)\]/g)];
  if (!thoiLuong && moc.length) { const m = moc[moc.length - 1]; thoiLuong = (Number(m[1]) * 60 + Number(m[2]) + 30) / 60; }
  const t = raw.replace(/\[\d+:\d\d\]/g, ' ').replace(/\[[a-z ]+\]/gi, ' ').replace(/&gt;/g, '');
  const words = t.split(/\s+/).filter(Boolean);
  const n = words.length;
  const dem = (re) => (t.match(re) || []).length;
  // vị trí (theo từ) của các mốc ngày
  const viTri = [];
  // tính vị trí bằng chỉ số ký tự -> từ
  const idxWord = (ci) => t.slice(0, ci).split(/\s+/).filter(Boolean).length;
  for (const m of t.matchAll(reDay)) viTri.push(idxWord(m.index));
  const wpm = thoiLuong ? n / thoiLuong : null;
  const gaps = [];
  const pts = [0, ...viTri, n];
  for (let i = 1; i < pts.length; i++) gaps.push(pts[i] - pts[i - 1]);
  const gapMax = Math.max(...gaps);
  const sent = t.split(/[.!?]+/).filter((s) => s.trim()).length;
  return {
    file: path,
    tu: n,
    phut: thoiLuong ? +thoiLuong.toFixed(1) : null,
    tu_moi_phut: wpm ? Math.round(wpm) : null,
    cau_tb: +(n / sent).toFixed(1),
    you_1k: Math.round((dem(/\byou\b/gi) / n) * 1000),
    i_1k: Math.round((dem(/\bI\b/g) / n) * 1000),
    moc_ngay: viTri.length,
    moc_ngay_moi_phut: thoiLuong ? +(viTri.length / thoiLuong).toFixed(2) : null,
    tu_truoc_moc_dau: viTri.length ? viTri[0] : null,
    khoang_dai_nhat_phut: wpm ? +(gapMax / wpm).toFixed(1) : null,
    bao_dau_viec: dem(/\b(first|second|third|fourth|fifth|next|new) problem\b/gi),
    luat: dem(/\brule (one|two|three|four|five|\d)\b/gi),
  };
}

const kq = [doFile(main, phut), ...doiThu.map((f) => doFile(f, null))];
if (asJson) { console.log(JSON.stringify(kq, null, 2)); process.exit(0); }

const k = kq[0];
const canh = [];
if (k.tu_moi_phut && k.tu_moi_phut > 190) canh.push(`Tốc độ ${k.tu_moi_phut} từ/phút > 190: cắt lời hoặc giảm tốc độ giọng.`);
if (k.moc_ngay_moi_phut !== null && k.moc_ngay > 0 && k.moc_ngay_moi_phut < 0.5) canh.push(`Mốc ngày ${k.moc_ngay_moi_phut}/phút < 0,5: người xem không thấy đồng hồ chạy.`);
if (k.khoang_dai_nhat_phut && k.khoang_dai_nhat_phut > 6) canh.push(`Có khoảng ${k.khoang_dai_nhat_phut} phút không có mốc ngày (> 6). Chỗ đó cần câu treo hoặc nhảy ngày.`);
if (k.bao_dau_viec === 0) canh.push('Không có câu báo đầu việc ("First problem…"). Cân nhắc thêm.');

const cot = ['tu', 'phut', 'tu_moi_phut', 'cau_tb', 'you_1k', 'i_1k', 'moc_ngay', 'moc_ngay_moi_phut', 'tu_truoc_moc_dau', 'khoang_dai_nhat_phut', 'bao_dau_viec', 'luat'];
console.log(['file', ...cot].join(' | '));
for (const r of kq) console.log([r.file.split(/[\\/]/).pop(), ...cot.map((c) => r[c] ?? '-')].join(' | '));
console.log('');
console.log('Mốc tham khảo (9 video viral, 11/2026): 140-190 từ/phút; mốc ngày 0,7-1,2/phút; khoảng dài nhất không mốc ngày 3-8,5 phút ở bản thắng, 11 phút ở bản yếu; truyện chạy trước giây 20.');
console.log('tu_truoc_moc_dau chỉ đúng khi truyện mở bằng mốc ngày; nếu không, tự đếm số từ "giới thiệu" trước khi truyện chạy.');
if (canh.length) { console.log('\nNÊN XEM:'); canh.forEach((c) => console.log('- ' + c)); } else console.log('\nKhông có cảnh báo.');
