// Nhạc nền và tiếng động tự tổng hợp từ kịch bản: không mẫu thu sẵn, không tải gì, luôn ra y hệt.
const SR = 48000
const TAU = Math.PI * 2

// Giai điệu là bậc trong thang âm, -1 là lặng.
export const KHONG_KHI = {
  'vui': { nhip: 124, goc: 60, thang: [0, 2, 4, 7, 9], bac: [0, 2, 3, 2, 4, 3, 1, -1, 0, 3, 5, 4, 2, -1, 1, -1], tram: [0, -5, -3, -7], song: 'go' },
  'phieu-luu': { nhip: 108, goc: 57, thang: [0, 2, 3, 7, 10], bac: [0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, 0, 3, 5, 4, -1], tram: [0, -4, 3, -2], song: 'day' },
  'cang': { nhip: 88, goc: 50, thang: [0, 1, 3, 6, 8], bac: [0, -1, -1, 1, -1, -1, 0, -1, 3, -1, -1, 2, -1, -1, 1, -1], tram: [0, 0, 1, 0], song: 'chuong' },
  'am': { nhip: 78, goc: 65, thang: [0, 2, 4, 7, 11], bac: [0, -1, 2, -1, 3, -1, 2, -1, 1, -1, 4, -1, 3, 2, -1, -1], tram: [0, -3, -7, -5], song: 'go' },
  'dien-tu': { nhip: 128, goc: 57, thang: [0, 3, 5, 7, 10], bac: [0, 2, 3, 2, 5, 3, 2, 4, 0, 2, 3, 2, 6, 4, 3, 2], tram: [0, 0, -4, -2], song: 'vuong' },
  '8-bit': { nhip: 136, goc: 64, thang: [0, 2, 4, 7, 9], bac: [0, 2, 4, 5, 4, 2, 3, -1, 1, 3, 5, 6, 5, 3, 2, -1], tram: [0, 5, -3, -5], song: 'vuong' },
}

const tanSo = n => 440 * 2 ** ((n - 69) / 12)
const bam = i => { const v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v) }
const SONG = {
  sin: p => Math.sin(TAU * p),
  vuong: p => (p % 1 < 0.5 ? 0.45 : -0.45),
  day: p => Math.sin(TAU * p) + 0.35 * Math.sin(TAU * 2 * p) + 0.18 * Math.sin(TAU * 3 * p),
  go: p => Math.sin(TAU * p) + 0.22 * Math.sin(TAU * 4 * p),
  chuong: p => Math.sin(TAU * p) + 0.4 * Math.sin(TAU * 2.76 * p),
}

// f nhận một tần số hoặc hàm của u (0..1) để trượt cao độ.
function not(b, t, dai, f, to, song = 'sin', tat = 5) {
  const a = Math.max(0, Math.floor(t * SR)), n = Math.min(Math.floor(dai * SR), b.length - a), s = SONG[song]
  let pha = 0
  for (let i = 0; i < n; i++) {
    const u = i / (dai * SR)
    pha += (typeof f === 'number' ? f : f(u)) / SR
    b[a + i] += s(pha) * to * Math.min(1, i / 160) * Math.exp(-u * tat) * Math.min(1, (1 - u) * 12)
  }
}

function on(b, t, dai, to, min = 0.3, tat = 6) {
  const a = Math.max(0, Math.floor(t * SR)), n = Math.min(Math.floor(dai * SR), b.length - a)
  let truoc = 0
  for (let i = 0; i < n; i++) {
    const u = i / (dai * SR)
    truoc += min * (bam(i + a) * 2 - 1 - truoc)
    b[a + i] += truoc * to * Math.min(1, i / 60) * Math.exp(-u * tat)
  }
}

function nhac(b, ten, dai) {
  const k = KHONG_KHI[ten], nua = 30 / k.nhip
  for (let i = 0; i * nua < dai; i++) {
    const t = i * nua, o = Math.floor(i / 16), bien = o % 4 === 3 ? 1 : 0
    const v = k.bac[(i + bien * 4) % 16]
    if (v >= 0 && !(o === 0 && i < 4)) {
      const n = k.goc + k.thang[v % 5] + 12 * Math.floor(v / 5)
      not(b, t, nua * 3, tanSo(n), k.song === 'vuong' ? 0.1 : 0.14, k.song, 6)
    }
    const tr = k.goc - 24 + k.tram[Math.floor(i / 8) % 4]
    if (i % 4 === 0) not(b, t, nua * 4, tanSo(tr + 12), 0.12, 'sin', 2)
    if (i % 8 === 0) {
      not(b, t, nua * 8.5, tanSo(tr + 24), 0.035, 'sin', 0.8)
      not(b, t, nua * 8.5, tanSo(tr + 31), 0.025, 'sin', 0.8)
    }
    if ((ten === 'dien-tu' || ten === '8-bit' || ten === 'vui') && i % 2 === 1) on(b, t, 0.05, 0.07, 0.95, 7)
    if (ten === 'dien-tu' && i % 2 === 0) not(b, t, 0.18, u => 120 - 75 * u, 0.22, 'sin', 5)
    if (ten === 'cang' && i % 8 === 0) {
      not(b, t, 0.25, u => 70 - 30 * u, 0.3, 'sin', 4)
      not(b, t + 0.24, 0.22, u => 62 - 25 * u, 0.2, 'sin', 4)
    }
  }
}

// Bộ diễn xuất: bước chân theo quãng đường (khớp web-dien/dien.js), thêm tiếng cho động tác cảm xúc.
const CHO_DIEN = { 'xuat-phat': -11, 'nua-duong': -8.1, mep: -5.2, giua: 0, 'ben-kia': 5.2, dich: 8 }
function tiengDien(b, c) {
  const t = c.tu, d = c.den - c.tu, a = c.hanh_dong
  if (a === 'di' || a === 'chay') {
    const dai = Math.abs((CHO_DIEN[c.den_cho] ?? 0) - (CHO_DIEN[c.tu_cho] ?? 0)) * 0.264
    const buoc = (a === 'chay' ? 1.15 : 0.72) / 2
    // nghịch đảo đường cong tăng tốc nhẹ đầu, hãm cuối của dien.js
    const nguoc = f => f < 0.05 ? f * 2 : f > 0.95 ? 0.9 + (f - 0.95) * 2 : 0.1 + (f - 0.05) * 0.8 / 0.9
    for (let k = 1; k * buoc < dai; k++) {
      const x = t + nguoc(k * buoc / dai) * d
      on(b, x, 0.09, a === 'chay' ? 0.6 : 0.45, 0.18)
      not(b, x, 0.08, u => 150 - 70 * u, a === 'chay' ? 0.18 : 0.14)
    }
  }
  if (a === 'giat-minh') {
    const x = t + Math.min(0.25, d * 0.15)
    on(b, x, 0.5, 0.9, 0.05); not(b, x, 0.7, u => 90 - 40 * u, 0.5, 'sin', 2)
    ;[61, 67, 73].forEach(n => not(b, x, 0.9, tanSo(n), 0.06, 'chuong', 3))
  }
  if (a === 'run') for (let x = t; x < c.den; x += 0.11) not(b, x, 0.1, 70, 0.05, 'sin', 4)
  if (a === 'vay') [76, 79].forEach((n, i) => not(b, t + 0.2 + i * 0.16, 0.3, tanSo(n), 0.08, 'go'))
  if (a === 'nghi') [72, 79, 84].forEach((n, i) => not(b, t + 0.3 + i * 0.22, 0.5, tanSo(n), 0.05, 'chuong'))
  if (a === 'buon') not(b, t + 0.2, Math.min(1.5, d * 0.7), u => 330 - 120 * u, 0.08, 'sin', 1.5)
  if (a === 'chi') not(b, t + 0.15 * d, 0.2, u => 500 + 400 * u, 0.06, 'sin', 3)
  if (a === 'quay') on(b, t + 0.1, 0.25, 0.25, 0.4)
  if ((c.su_kien || []).includes('hien')) { not(b, t, 1.6, u => 46 + 10 * u, 0.3, 'sin', 1.2); on(b, t, 1.2, 0.18, 0.02, 1.5) }
}

function tiengDong(b, canh, dien) {
  for (const c of canh) {
    const t = c.tu, d = c.den - c.tu, a = c.hanh_dong
    if (dien) {
      tiengDien(b, c)
      if (a === 'di' || a === 'chay') continue
    }
    // Cùng nhịp chân với khung.js
    if (a === 'di' || a === 'chay' || a === 'leo') {
      const nhip = Math.PI / (a === 'chay' ? 15 : a === 'leo' ? 7 : 9)
      for (let x = Math.ceil(t / nhip) * nhip; x < c.den; x += nhip) {
        on(b, x, 0.09, 0.5, 0.18)
        not(b, x, 0.08, u => 150 - 70 * u, 0.16)
      }
    }
    if (a === 'nhay') {
      not(b, t + 0.12 * d, 0.28, u => 280 + 560 * u, 0.22, 'sin', 2)
      on(b, t + 0.82 * d, 0.2, 0.7, 0.12)
    }
    if (a === 'nga') {
      not(b, t + 0.3 * d, Math.min(1.1, 0.6 * d), u => 720 - 540 * u, 0.17, 'sin', 1.2)
      on(b, t + 0.88 * d, 0.3, 0.8, 0.08)
    }
    if (a === 'dao') for (let x = t + 0.2; x < c.den - 0.1; x += TAU / 11) { on(b, x, 0.14, 0.6, 0.55, 8); not(b, x, 0.1, 420, 0.08, 'chuong') }
    if (a === 'xay') for (let i = 0; i < 8; i++) { on(b, t + d * (0.18 + i * 0.09), 0.1, 0.55, 0.25); not(b, t + d * (0.18 + i * 0.09), 0.1, 300 + i * 35, 0.12) }
    if (a === 'mung') [72, 76, 79, 84].forEach((n, i) => not(b, t + i * 0.1, 0.6, tanSo(n), 0.14, 'go'))
    if (c.phu === 'duoi') for (let x = t; x < c.den; x += 0.42) { not(b, x, 0.3, u => 85 - 35 * u, 0.4, 'sin', 3); on(b, x, 0.16, 0.3, 0.05) }
    if ((c.su_kien || []).includes('sang')) [84, 88, 91, 96].forEach((n, i) => not(b, t + 0.15 * d + i * 0.07, 0.9, tanSo(n), 0.09, 'chuong'))
  }
}

// Đô thị mưa: lớp mưa liền, và tiếng theo mốc trong kb.mua
function tiengMua(b, m, dai) {
  const het = m.het ?? Infinity, tat = m.tat ?? Infinity, n = Math.min(b.length, Math.ceil(dai * SR))
  let a = 0, c = 0
  for (let i = 0; i < n; i++) {
    const t = i / SR, v = bam(i + 0.37) * 2 - 1
    a += 0.22 * (v - a); c += 0.025 * (v - c)
    let to = t > tat ? Math.max(0, 1 - (t - tat) / (het - tat)) : 1
    const che = t >= m.bat && !(t >= m.roi)
    if (che) to *= 0.6
    b[i] += (a * 0.2 + c * (che ? 0.9 : 0.5)) * to * Math.min(1, t / 0.2)
  }
  const tho = (t, d, to) => {
    const s = Math.floor(t * SR), l = Math.min(Math.floor(d * SR), b.length - s)
    let p = 0, q = 0
    for (let i = 0; i < l; i++) {
      const u = i / (d * SR), v = bam(i + 9.1) * 2 - 1
      p += 0.16 * (v - p); q += 0.04 * (p - q)
      b[s + i] += (p - q) * to * Math.sin(Math.PI * u) ** 2
    }
  }
  if (m.bat !== undefined) {
    on(b, m.bat, 0.28, 1.1, 0.35, 7); not(b, m.bat, 0.2, u => 190 - 110 * u, 0.4)
    for (let t = m.bat + 0.4; t < (m.roi ?? m.bat + 4); t += 0.07 + bam(t * 91) * 0.13) on(b, t, 0.035, 0.25, 0.6, 7)
  }
  if (m.nang !== undefined) for (let k = 0; k < 3; k++) not(b, m.nang + k * 0.3, 0.45, u => 210 - 60 * u + 18 * Math.sin(u * 50), 0.12, 'day', 2)
  for (const t of m.tho || []) { tho(t, 1.15, 1.1); tho(t + 0.7, 0.5, 0.45) }
  if (m.roi !== undefined) { on(b, m.roi + 0.65, 0.4, 0.9, 0.2, 5); not(b, m.roi + 0.68, 0.18, u => 150 - 80 * u, 0.3) }
  if (m.dau !== undefined) { on(b, m.dau, 1.2, 1.2, 0.12, 3); on(b, m.vai ?? m.dau + 1, 0.8, 0.8, 0.14, 4) }
  if (m.mieng !== undefined) {
    not(b, m.mieng, 2.2, u => 58 + 30 * u, 0.3, 'day', 1)
    not(b, m.mieng, 2.2, u => 415 + 170 * u, 0.07, 'chuong', 0.8)
  }
  if (m.loa !== undefined) {
    for (let t = m.loa; t < (m.bao ?? m.loa + 2); t += 0.03 + bam(t * 37) * 0.12) on(b, t, 0.02, t < m.loa + 0.35 ? 0.4 : 0.1, 0.5, 5)
    not(b, m.loa + 0.1, 0.8, u => 1350 + 250 * u, 0.012, 'sin', 1)
    ;[784, 659, 523].forEach((f, k) => not(b, (m.bao ?? m.loa + 2) - 0.3 + k * 0.1, 0.22, f, 0.05, 'chuong', 4))
  }
  if (m.tat !== undefined) {
    for (let k = 0; k < 7; k++) { const t = m.tat + k * ((het - m.tat) / 7); on(b, t, 0.1, 0.22, 0.12, 7); not(b, t, 0.16, 120 - k * 6, 0.1) }
    not(b, het + 0.1, 0.16, u => 700 + 700 * u, 0.2)
  }
}

export function taoAm(kb, canh, dai) {
  const am = kb.am || {}, ten = am.nhac || 'khong', coNhac = ten !== 'khong', coTieng = am.tieng_dong !== false
  const b = new Float32Array(Math.ceil(dai * SR))
  if (coNhac) {
    nhac(b, ten, dai)
    for (let i = 0; i < b.length; i++) b[i] *= 0.75 * Math.min(1, i / (SR * 0.3), (b.length - i) / (SR * 0.6))
  }
  if (coTieng) tiengDong(b, canh, kb.mat_bang === 'san-khau')
  if (coTieng && (kb.mua || kb.boi_canh === 'do-thi-mua')) tiengMua(b, kb.mua || {}, dai)
  if (!coNhac && !coTieng) return null
  if (!b.some(v => v)) return null // toàn lặng thì bỏ track, loudnorm gặp lặng sẽ ra NaN

  const ra = Buffer.alloc(44 + b.length * 2)
  ra.write('RIFF', 0); ra.writeUInt32LE(36 + b.length * 2, 4); ra.write('WAVEfmt ', 8)
  ra.writeUInt32LE(16, 16); ra.writeUInt16LE(1, 20); ra.writeUInt16LE(1, 22)
  ra.writeUInt32LE(SR, 24); ra.writeUInt32LE(SR * 2, 28); ra.writeUInt16LE(2, 32); ra.writeUInt16LE(16, 34)
  ra.write('data', 36); ra.writeUInt32LE(b.length * 2, 40)
  for (let i = 0; i < b.length; i++) ra.writeInt16LE(Math.round(Math.tanh(b[i]) * 30000), 44 + i * 2)
  return ra
}
