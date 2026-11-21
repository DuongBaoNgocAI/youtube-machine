#!/usr/bin/env node
// Công cụ SRT cho quy trình YouTube Machine (bước 7b, 7c, 8). Chỉ cần Node, không cần thư viện.
//
//   node srt_tools.mjs stats     voice.srt
//   node srt_tools.mjs fix       voice.srt --text voice.txt [--standard] --out voice.fixed.srt
//   node srt_tools.mjs normalize voice.fixed.srt --min 1.5 --max 8 --out scenes.srt
//   node srt_tools.mjs chapters  scenes.srt --phrases chapters.txt
//   node srt_tools.mjs scenes    scenes.srt [--json]
//
// stats     : số dòng, tổng thời lượng, dòng quá ngắn / quá dài, chữ mỗi giây.
// fix       : SRT từ Speech-to-Text hay sai chính tả tên riêng. Căn từng từ của SRT với lời gốc (voice.txt)
//             rồi thay chữ trong SRT bằng chữ gốc, giữ nguyên mốc thời gian. In tỉ lệ khớp.
//             Thẻ cảm xúc Eleven v3 ([sighs]...) bị bỏ. --standard đổi dạng nói (gonna, wanna, kinda...) về dạng chuẩn.
// normalize : mỗi dòng SRT sẽ thành một cảnh hình. Gộp dòng ngắn hơn --min giây vào dòng bên cạnh,
//             tách dòng dài hơn --max giây tại dấu câu gần giữa nhất. Thời gian chia theo số ký tự.
// chapters  : file phrases mỗi dòng "Tên chương | vài từ đầu chương". In danh sách chương YouTube (0:00 ...).
// scenes    : in bảng cảnh: số, bắt đầu, khe (tới đầu dòng sau), thời lượng Flow làm tròn 4/6/8/10, chữ.
import fs from 'node:fs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const file = argv[1];
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i > 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes('--' + name);
const read = (f) => fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r/g, '');

if (!cmd || !file) {
  console.error('Cách dùng: node srt_tools.mjs <stats|fix|normalize|chapters|scenes> file.srt [tuỳ chọn]');
  process.exit(2);
}

// ---------- SRT ----------
const toSec = (t) => { const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0').slice(0, 3) / 1000 : NaN; };
const fmt = (s) => { const ms = Math.max(0, Math.round(s * 1000)); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, se = Math.floor(ms / 1000) % 60, r = ms % 1000; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(se).padStart(2, '0')},${String(r).padStart(3, '0')}`; };
const mmss = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, se = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(se).padStart(2, '0')}` : `${m}:${String(se).padStart(2, '0')}`; };

function parseSrt(text) {
  return text.split(/\n\s*\n/).map((b) => {
    const lines = b.trim().split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) return null;
    const [a, z] = lines[i].split('-->').map((x) => toSec(x.trim()));
    const t = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return Number.isFinite(a) && Number.isFinite(z) && t ? { start: a, end: z, text: t } : null;
  }).filter(Boolean).sort((p, q) => p.start - q.start);
}

function wrap(text, width = 42) {
  if (text.length <= width) return text;
  const words = text.split(' ');
  let best = text, bestDiff = Infinity;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) { bestDiff = diff; best = a + '\n' + b; }
  }
  return best;
}
const writeSrt = (cues) => cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${wrap(c.text)}\n`).join('\n');
const norm = (w) => w.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '');
const endsSentence = (t) => /[.!?…]["')\]]?$/.test(t.trim());

// Dạng nói tiếng Anh Mỹ trong lời đọc -> dạng chuẩn trên phụ đề (fix --standard)
const SPOKEN = { gonna: 'going to', wanna: 'want to', gotta: 'got to', kinda: 'kind of', sorta: 'sort of', lemme: 'let me', gimme: 'give me', dunno: "don't know", "'cause": 'because', outta: 'out of', lotta: 'lot of', hafta: 'have to' };
// Bung một từ thành các mảnh chuẩn hoá để so khớp: gonna -> going to, didn't -> did not, it's -> it is
const SPOKEN_X = { gonna: ['going', 'to'], wanna: ['want', 'to'], gotta: ['got', 'to'], kinda: ['kind', 'of'], sorta: ['sort', 'of'], lemme: ['let', 'me'], gimme: ['give', 'me'], dunno: ['do', 'not', 'know'], cause: ['because'], cuz: ['because'], outta: ['out', 'of'], lotta: ['lot', 'of'], hafta: ['have', 'to'], cannot: ['can', 'not'] };
function expand(word) {
  const w = word.toLowerCase().normalize('NFC').replace(/[’‘]/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').replace(/^'(?=cause)/, '');
  if (!w) return [];
  if (SPOKEN_X[w]) return SPOKEN_X[w];
  if (w === "can't") return ['can', 'not'];
  if (w === "won't") return ['will', 'not'];
  if (w === "ain't") return ['is', 'not'];
  const m = /^(.+?)(n't|'re|'ll|'ve|'m|'s|'d)$/.exec(w);
  if (m) return [norm(m[1]), { "n't": 'not', "'re": 'are', "'ll": 'will', "'ve": 'have', "'m": 'am', "'s": 'is', "'d": 'would' }[m[2]]].filter(Boolean);
  const t = norm(w); return t ? [t] : [];
}
function toStandard(t) {
  return t.replace(/(^|[^\w'])('cause|gonna|wanna|gotta|kinda|sorta|lemme|gimme|dunno|outta|lotta|hafta)\b/gi, (m, pre, w) => {
    const std = SPOKEN[w.toLowerCase()];
    const out = w[0] === w[0].toUpperCase() && /[a-z]/i.test(w[0]) ? std[0].toUpperCase() + std.slice(1) : (w.startsWith("'") && pre === '' ? std[0].toUpperCase() + std.slice(1) : std);
    return pre + out;
  });
}

const cues = parseSrt(read(file));
if (!cues.length) { console.error('Không đọc được dòng nào trong ' + file); process.exit(2); }
const out = opt('out');
const save = (txt) => { if (out) { fs.writeFileSync(out, txt, 'utf8'); console.log('Đã ghi ' + out); } else process.stdout.write(txt); };

// ---------- stats ----------
if (cmd === 'stats') {
  const durs = cues.map((c) => c.end - c.start);
  const total = cues[cues.length - 1].end;
  const words = cues.reduce((n, c) => n + c.text.split(/\s+/).length, 0);
  const short = durs.filter((d) => d < 1.5).length, long = durs.filter((d) => d > 8).length;
  const gaps = cues.slice(1).map((c, i) => c.start - cues[i].end).filter((g) => g > 1.5).length;
  console.log(`Số dòng: ${cues.length}`);
  console.log(`Tổng thời lượng: ${mmss(total)} (${total.toFixed(1)} giây)`);
  console.log(`Số từ: ${words} | Tốc độ: ${(words / total).toFixed(2)} từ/giây`);
  console.log(`Dòng ngắn nhất: ${Math.min(...durs).toFixed(2)} s | dài nhất: ${Math.max(...durs).toFixed(2)} s | trung bình: ${(durs.reduce((a, b) => a + b, 0) / durs.length).toFixed(2)} s`);
  console.log(`Dòng dưới 1,5 s: ${short} | trên 8 s: ${long} | khoảng lặng trên 1,5 s: ${gaps}`);
  process.exit(0);
}

// ---------- fix ----------
if (cmd === 'fix') {
  const textFile = opt('text');
  if (!textFile) { console.error('Thiếu --text voice.txt'); process.exit(2); }
  // bỏ thẻ cảm xúc Eleven v3 ([sighs], [whispers]...) vì không có trong giọng và không được hiện trên phụ đề
  const src = read(textFile).replace(/\[[^\]\n]{1,40}\]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  // So khớp trên dạng bung đầy đủ ở cả hai phía: lời gốc viết "gonna", "didn't" còn máy nghe có thể ghi
  // "going to", "did not" (hoặc ngược lại). Mỗi từ bung ra 1-3 mảnh, mảnh nhớ từ gốc của nó.
  const srt = []; cues.forEach((c, ci) => c.text.split(' ').forEach((w) => expand(w).forEach((t) => srt.push({ w: t, ci }))));
  const srcX = []; src.forEach((w, k) => expand(w).forEach((t) => srcX.push({ w: t, k })));
  const a = srcX.map((x) => x.w), b = srt.map((x) => x.w);
  const n = a.length, m = b.length;
  if (n * m > 60_000_000) { console.error('Văn bản quá dài để căn một lần; chia file theo chương.'); process.exit(2); }
  // LCS từ cuối lên để dò xuôi
  const W = m + 1; const L = new Uint16Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i * W + j] = a[i] && a[i] === b[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  const cueOf = new Array(src.length).fill(-1);
  let i = 0, j = 0, matched = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) { if (cueOf[srcX[i].k] < 0) cueOf[srcX[i].k] = srt[j].ci; matched++; i++; j++; }
    else if (L[(i + 1) * W + j] >= L[i * W + j + 1]) i++; else j++;
  }
  // từ không khớp: theo từ khớp trước đó, trừ khi từ trước kết thúc câu thì theo từ khớp sau
  const N = src.length;
  const next = new Array(N).fill(-1); let nx = -1;
  for (let k = N - 1; k >= 0; k--) { if (cueOf[k] >= 0) nx = cueOf[k]; next[k] = nx; }
  let prev = -1;
  for (let k = 0; k < N; k++) {
    if (cueOf[k] >= 0) { prev = cueOf[k]; continue; }
    const startSentence = k === 0 || endsSentence(src[k - 1]);
    cueOf[k] = prev < 0 || (startSentence && next[k] >= 0) ? (next[k] >= 0 ? next[k] : prev) : prev;
  }
  for (let k = 1; k < N; k++) if (cueOf[k] < cueOf[k - 1]) cueOf[k] = cueOf[k - 1]; // giữ thứ tự
  const texts = cues.map(() => []);
  src.forEach((w, k) => texts[cueOf[k]].push(w));
  let fixed = cues.map((c, k) => ({ ...c, text: texts[k].join(' ') })).filter((c) => c.text);
  if (flag('standard')) fixed = fixed.map((c) => ({ ...c, text: toStandard(c.text) }));
  const ratio = matched / Math.max(1, a.filter(Boolean).length);
  const changed = fixed.filter((c, k) => norm(c.text) !== norm(cues[k]?.text || '')).length;
  console.error(`Khớp ${(ratio * 100).toFixed(1)}% số từ lời gốc với SRT | ${changed}/${cues.length} dòng đã sửa chữ.`);
  if (ratio < 0.85) console.error('Cảnh báo: độ khớp thấp. Có thể giọng đọc đã bỏ hoặc thêm câu so với voice.txt. Nghe lại trước khi dùng.');
  save(writeSrt(fixed));
  process.exit(0);
}

// ---------- normalize ----------
if (cmd === 'normalize') {
  const min = +opt('min', 1.5), max = +opt('max', 8);
  let list = cues.map((c) => ({ ...c }));
  // tách dòng dài
  const splitCue = (c) => {
    const words = c.text.split(' ');
    if (words.length < 4) return [c];
    const mid = c.text.length / 2; let best = -1, bestScore = Infinity, pos = 0;
    for (let k = 0; k < words.length - 1; k++) {
      pos += words[k].length + 1;
      const w = words[k];
      const penalty = /[.!?…]["')\]]?$/.test(w) ? 0 : /[,;:—-]$/.test(w) ? 15 : 1000; // ưu tiên cuối câu, rồi dấu phẩy
      const score = penalty + Math.abs(pos - mid);
      if (score < bestScore) { bestScore = score; best = k; }
    }
    const t1 = words.slice(0, best + 1).join(' '), t2 = words.slice(best + 1).join(' ');
    const cut = c.start + (c.end - c.start) * (t1.length / (t1.length + t2.length));
    return [{ start: c.start, end: cut, text: t1 }, { start: cut, end: c.end, text: t2 }];
  };
  for (let guard = 0; guard < 20; guard++) {
    const nextList = list.flatMap((c) => (c.end - c.start > max ? splitCue(c) : [c]));
    if (nextList.length === list.length) break; list = nextList;
  }
  // gộp dòng ngắn
  let changed = true;
  while (changed) {
    changed = false;
    for (let k = 0; k < list.length; k++) {
      const c = list[k]; if (c.end - c.start >= min || list.length < 2) continue;
      const pv = list[k - 1], nx = list[k + 1];
      const toNext = nx && (!endsSentence(c.text) || !pv) && nx.end - c.start <= max;
      const toPrev = pv && c.end - pv.start <= max;
      if (toNext) { list.splice(k, 2, { start: c.start, end: nx.end, text: c.text + ' ' + nx.text }); changed = true; break; }
      if (toPrev) { list.splice(k - 1, 2, { start: pv.start, end: c.end, text: pv.text + ' ' + c.text }); changed = true; break; }
    }
  }
  console.error(`Từ ${cues.length} dòng thành ${list.length} cảnh (mỗi cảnh ${min}-${max} giây khi được).`);
  save(writeSrt(list));
  process.exit(0);
}

// ---------- chapters ----------
if (cmd === 'chapters') {
  const pf = opt('phrases');
  if (!pf) { console.error('Thiếu --phrases chapters.txt (mỗi dòng: Tên chương | vài từ đầu chương)'); process.exit(2); }
  const rows = read(pf).split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const [title, phrase] = l.split('|').map((x) => x.trim()); return { title, phrase: phrase || title }; });
  const words = []; cues.forEach((c) => c.text.split(' ').forEach((w, wi, arr) => words.push({ w: norm(w), t: c.start + (c.end - c.start) * (wi / arr.length) })));
  let from = 0; const outRows = [];
  for (const r of rows) {
    const p = r.phrase.split(/\s+/).map(norm).filter(Boolean).slice(0, 6);
    let found = -1, bestHit = 0;
    for (let k = from; k < words.length; k++) {
      let hit = 0; for (let q = 0; q < p.length; q++) if (words[k + q]?.w === p[q]) hit++;
      if (hit > bestHit) { bestHit = hit; found = k; if (hit === p.length) break; }
    }
    const ok = found >= 0 && bestHit >= Math.ceil(p.length * 0.6);
    const t = ok ? words[found].t : null;
    if (ok) from = found + 1;
    outRows.push({ title: r.title, t, ok });
  }
  if (outRows[0]) { outRows[0].t = 0; outRows[0].ok = true; }
  outRows.forEach((r) => console.log(r.ok ? `${mmss(r.t)} ${r.title}` : `?? ${r.title}  (không tìm thấy câu mở đầu, kiểm tra lại)`));
  const short = outRows.filter((r, k) => r.ok && outRows[k + 1]?.ok && outRows[k + 1].t - r.t < 10);
  if (short.length) console.error('Lưu ý: có chương ngắn hơn 10 giây; YouTube sẽ không hiện chương.');
  process.exit(0);
}

// ---------- scenes ----------
if (cmd === 'scenes') {
  const FLOW = [4, 6, 8, 10];
  const rows = cues.map((c, k) => {
    const slot = (cues[k + 1] ? cues[k + 1].start : c.end) - c.start;
    return { scene: k + 1, start: +c.start.toFixed(3), start_tc: mmss(c.start), slot: +slot.toFixed(2), flow_duration: FLOW.find((d) => d >= slot) || 10, text: c.text };
  });
  if (flag('json')) { console.log(JSON.stringify(rows, null, 2)); process.exit(0); }
  rows.forEach((r) => console.log(`${String(r.scene).padStart(3)}  ${r.start_tc.padStart(6)}  ${r.slot.toFixed(2).padStart(5)}s  ${String(r.flow_duration).padStart(2)}s  ${r.text}`));
  process.exit(0);
}

console.error('Lệnh không hợp lệ: ' + cmd); process.exit(2);
