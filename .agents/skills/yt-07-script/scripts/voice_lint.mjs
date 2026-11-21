#!/usr/bin/env node
// Soát lời đọc tiếng Anh (voice.txt) để giọng AI nghe như người Mỹ nói, không như đọc văn bản.
// Chỉ cần Node. Xem quy tắc ở references/giong-my-tu-nhien.md.
//
//   node voice_lint.mjs voice.txt [--level formal|story|casual] [--json]
//
// Mức lỗi: LỖI (nên sửa), NÊN XEM (cân nhắc), THÔNG TIN.
import fs from 'node:fs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--level');
const level = args.includes('--level') ? args[args.indexOf('--level') + 1] : 'story';
const asJson = args.includes('--json');
if (!file || !['formal', 'story', 'casual'].includes(level)) {
  console.error('Cách dùng: node voice_lint.mjs voice.txt [--level formal|story|casual] [--json]');
  process.exit(2);
}
const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r/g, '');
const lines = text.split('\n');
const issues = [];
const add = (sev, line, msg, hint = '') => issues.push({ sev, line, msg, hint });

// ---- cặp chưa rút gọn ----
const PAIRS = [
  ['it is', "it's"], ['that is', "that's"], ['there is', "there's"], ['here is', "here's"], ['what is', "what's"], ['who is', "who's"],
  ['let us', "let's"], ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"],
  ['was not', "wasn't"], ['were not', "weren't"], ['cannot', "can't"], ['can not', "can't"], ['could not', "couldn't"], ['will not', "won't"],
  ['would not', "wouldn't"], ['should not', "shouldn't"], ['have not', "haven't"], ['has not', "hasn't"], ['had not', "hadn't"],
  ['i am', "I'm"], ['i have', "I've"], ['i will', "I'll"], ['i would', "I'd"], ['you are', "you're"], ['you will', "you'll"], ['you have', "you've"],
  ['we are', "we're"], ['we will', "we'll"], ['we have', "we've"], ['they are', "they're"], ['they will', "they'll"], ['they have', "they've"],
  ['he is', "he's"], ['she is', "she's"], ['he will', "he'll"], ['she will', "she'll"],
];
// "have/has/had" + danh từ là sở hữu, không rút gọn được -> chỉ bắt khi theo sau là quá khứ phân từ / "been" / "got"
const POSSESSIVE_SAFE = /^(i|you|we|they) have$/;
let contractable = 0, contracted = 0;
lines.forEach((ln, i) => {
  const lower = ln.toLowerCase();
  for (const [full, short] of PAIRS) {
    const re = new RegExp(`\\b${full.replace(' ', '\\s+')}\\b(\\s+\\w+)?`, 'g');
    let m;
    while ((m = re.exec(lower))) {
      const next = (m[1] || '').trim();
      if (POSSESSIVE_SAFE.test(full) && next && !/^(been|got|seen|done|never|already|just|ever|\w+ed)$/.test(next)) continue;
      if (/^(it|that|there|what|here) is$/.test(full) && /^[.,!?]?$/.test(next) && /\b(is)\s*[.!?]/.test(lower.slice(m.index, m.index + full.length + 2))) continue; // "that's what it is." cuối câu không rút gọn
      contractable++;
      add('LỖI', i + 1, `"${ln.substr(m.index, full.length)}" chưa rút gọn`, `viết "${short}", trừ khi cố ý nhấn mạnh`);
    }
  }
  contracted += (ln.match(/\b\w+'(s|t|re|ll|ve|d|m)\b/gi) || []).length;
});
contractable += contracted;

// ---- dạng nói và thẻ v3 ----
const REDUCTIONS = ['gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'lemme', 'gimme', 'dunno', "'cause", 'outta', 'lotta', 'hafta'];
const CASUAL_ONLY = ['lemme', 'gimme', 'dunno', "'cause", 'outta', 'lotta', 'hafta'];
const words = (text.match(/[A-Za-z']+/g) || []).length;
let reductions = 0, tags = 0;
lines.forEach((ln, i) => {
  for (const r of REDUCTIONS) {
    const re = new RegExp(`(^|[^\\w'])${r.replace("'", "'")}\\b`, 'gi');
    const n = (ln.match(re) || []).length; if (!n) continue;
    reductions += n;
    if (level === 'formal') add('LỖI', i + 1, `"${r}" không hợp mức nói trang trọng`, 'viết dạng chuẩn');
    else if (level === 'story' && CASUAL_ONLY.includes(r)) add('NÊN XEM', i + 1, `"${r}" thuộc mức rất đời thường`, 'mức kể chuyện chỉ nên dùng gonna, wanna, kinda, gotta, sorta');
  }
  const t = ln.match(/\[[^\]]+\]/g) || []; tags += t.length;
  t.forEach((tag) => { if (/\[[^\]]*\s[^\]]*\s[^\]]*\]/.test(tag)) add('NÊN XEM', i + 1, `thẻ ${tag} dài`, 'thẻ v3 nên 1-2 từ'); });
  // phiên âm tự chế
  const odd = ln.match(/\b\w+'(?![stdm]\b|re\b|ll\b|ve\b)|\b(an'|prob'ly|'em|ya|y'know|nothin'|somethin')\b/gi);
  if (odd) add('LỖI', i + 1, `phiên âm tự chế: ${[...new Set(odd)].join(', ')}`, 'chỉ dùng dạng nói trong bảng; nuốt âm trong từ là việc của giọng đọc');
});
const per100 = (reductions / Math.max(1, words)) * 100;
if (level === 'story' && per100 > 1.2) add('NÊN XEM', 0, `dạng nói dày (${per100.toFixed(1)} lần mỗi 100 từ)`, 'mức kể chuyện khoảng 1 lần mỗi 100 từ');
const minutes = words / 150;
if (level === 'formal' && tags > Math.ceil(minutes / 3)) add('NÊN XEM', 0, `${tags} thẻ v3 cho mức trang trọng`, 'gần như không dùng');
if (level === 'story' && tags > Math.ceil(minutes * 1.2)) add('NÊN XEM', 0, `${tags} thẻ v3 trong khoảng ${minutes.toFixed(1)} phút`, 'tối đa khoảng 1 thẻ mỗi phút');

// ---- ký tự máy đọc dở ----
lines.forEach((ln, i) => {
  const clean = ln.replace(/\[[^\]]+\]/g, '');
  if (/\d/.test(clean)) add('LỖI', i + 1, `có chữ số: ${clean.match(/\S*\d\S*/g).join(', ')}`, 'viết thành chữ như người Mỹ đọc');
  if (/[%&\/#@$€£°~+=<>]/.test(clean)) add('LỖI', i + 1, `có ký hiệu: ${[...new Set(clean.match(/[%&\/#@$€£°~+=<>]/g))].join(' ')}`, 'viết thành chữ');
  if (/[()]/.test(clean)) add('LỖI', i + 1, 'có ngoặc đơn', 'tách thành câu riêng');
  if (/;/.test(clean)) add('NÊN XEM', i + 1, 'có dấu chấm phẩy', 'tách thành hai câu');
  if (/\b[A-Z]{4,}\b/.test(clean)) add('NÊN XEM', i + 1, `chữ in hoa: ${clean.match(/\b[A-Z]{4,}\b/g).join(', ')}`, 'giọng có thể đánh vần hoặc hét');
});

// ---- câu dài, phẩy dày ----
lines.forEach((ln, i) => {
  const clean = ln.replace(/\[[^\]]+\]/g, '').trim(); if (!clean) return;
  clean.split(/(?<=[.!?…])\s+/).forEach((s) => {
    const n = (s.match(/[A-Za-z']+/g) || []).length;
    if (n > 25) add('NÊN XEM', i + 1, `câu ${n} từ: "${s.slice(0, 60)}…"`, 'tách cho một hơi đọc được');
    const commas = (s.match(/,/g) || []).length;
    const isList = /,\s+(and|or)\s+/i.test(s); // liệt kê "a, b, and c" là nhịp tự nhiên
    if (commas >= (isList ? 5 : 3)) add('NÊN XEM', i + 1, `câu có ${commas} dấu phẩy: "${s.slice(0, 60)}…"`, 'mỗi dấu phẩy là một chỗ nghỉ, cắt mạch nối âm');
  });
});

// ---- từ ngữ ----
const LATINATE = { utilize: 'use', utilized: 'used', commence: 'start', commenced: 'started', ascertain: 'find out', ascertained: 'found out', approximately: 'about', subsequently: 'later', prior: 'before', obtain: 'get', obtained: 'got', endeavor: 'try', numerous: 'a lot of / many', additionally: 'also / plus', furthermore: 'and / plus', therefore: 'so', however: 'but', thus: 'so', hence: 'so', individuals: 'people', demonstrate: 'show', demonstrated: 'showed', facilitate: 'help', regarding: 'about', sufficient: 'enough', retain: 'keep', retained: 'kept', determine: 'figure out', determined: 'figured out', establish: 'set up', established: 'set up', reside: 'live', purchase: 'buy', assist: 'help' };
const BRITISH = { whilst: 'while', amongst: 'among', fortnight: 'two weeks', lorry: 'truck', rubbish: 'trash', maths: 'math', colour: 'color', colours: 'colors', centre: 'center', metre: 'meter', metres: 'meters', litre: 'liter', litres: 'liters', grey: 'gray', favourite: 'favorite', theatre: 'theater', organise: 'organize', realise: 'realize', realised: 'realized', analyse: 'analyze', travelled: 'traveled', defence: 'defense', armour: 'armor', programme: 'program', flat: '(apartment?)', autumn: 'fall', mould: 'mold', plough: 'plow', tyre: 'tire', aluminium: 'aluminum' };
lines.forEach((ln, i) => {
  (ln.toLowerCase().match(/[a-z]+/g) || []).forEach((w) => {
    if (LATINATE[w]) add('NÊN XEM', i + 1, `"${w}" nghe như văn viết`, `cân nhắc "${LATINATE[w]}"`);
    if (BRITISH[w] && w !== 'flat') add('LỖI', i + 1, `"${w}" là từ hoặc chính tả kiểu Anh`, `dùng "${BRITISH[w]}"`);
  });
  if (/\b(celsius|kilomet(er|re)s?|kilograms?)\b/i.test(ln)) add('THÔNG TIN', i + 1, 'đơn vị hệ mét', 'kiểm tra lựa chọn đơn vị trong 04-brand.md (khán giả Mỹ quen độ F, feet, miles, pounds)');
});

// ---- tổng kết ----
const ratio = contractable ? contracted / contractable : 1;
const summary = { file, level, words, minutes: +minutes.toFixed(1), contraction_ratio: +(ratio * 100).toFixed(0), reductions, v3_tags: tags,
  errors: issues.filter((x) => x.sev === 'LỖI').length, warnings: issues.filter((x) => x.sev === 'NÊN XEM').length };
if (level !== 'formal' && ratio < 0.85) add('NÊN XEM', 0, `tỉ lệ rút gọn ${summary.contraction_ratio}%`, 'mức kể chuyện nên trên 85%');
if (asJson) { console.log(JSON.stringify({ summary, issues }, null, 2)); process.exit(0); }
console.log(`Soát ${file} | mức ${level} | ${words} từ (~${summary.minutes} phút)`);
console.log(`Tỉ lệ rút gọn: ${summary.contraction_ratio}% | dạng nói: ${reductions} | thẻ v3: ${tags} | LỖI: ${summary.errors} | NÊN XEM: ${summary.warnings}`);
const order = { 'LỖI': 0, 'NÊN XEM': 1, 'THÔNG TIN': 2 };
issues.sort((a, b) => order[a.sev] - order[b.sev] || a.line - b.line)
  .forEach((x) => console.log(`[${x.sev}] ${x.line ? 'dòng ' + x.line : 'toàn bài'}: ${x.msg}${x.hint ? ' → ' + x.hint : ''}`));
process.exit(summary.errors ? 1 : 0);
