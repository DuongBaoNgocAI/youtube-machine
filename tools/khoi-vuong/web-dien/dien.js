// Bộ dựng diễn xuất: từ danh sách cảnh ra tư thế nhân vật, máy quay và sự kiện tại giây T.
// Hàm thuần: cùng kịch bản, cùng T luôn ra cùng tư thế. Không Math.random, không Date.
// Dùng chung cho mọi phong cách nhóm "dien-xuat" (khung ngang hoặc dọc).
//
// Đơn vị thế giới: 1 = chiều cao nhân vật. y lên trên, mặt đất y = 0, x sang phải.
// Góc tay chân đo trong mặt phẳng dọc của thân, tính từ hướng thẳng xuống, dương = về phía trước mặt.
// Gối gập dương = cẳng chân gập ra sau. Khuỷu gập dương = cẳng tay gập ra trước. ab = dang tay ra ngang (bản 3D).
// yaw: 0 = quay mặt sang phải (+x), PI = sang trái, PI/2 = nhìn thẳng máy quay.
// Bên PHẢI (P) của nhân vật là bên gần máy khi nhân vật quay sang phải.

export const XUONG = {
  dui: 0.245, cang: 0.235, coChan: 0.03,
  than: 0.30, co: 0.03, banKinhDau: 0.095,
  tayTren: 0.17, tayDuoi: 0.16, vaiXuong: 0.025,
  vaiRong: 0.075, hongRong: 0.05, // nửa bề ngang vai, hông khi nhìn chính diện
}

export const HANH_DONG = ['dung', 'nhin', 'noi', 'di', 'chay', 'nhay', 'nga', 'mung', 'xay', 'dao',
  'giat-minh', 'vay', 'run', 'chi', 'nghi', 'buon', 'quay']
export const SU_KIEN = ['hien', 'an', 'sang', 'rung']
export const DI_CHUYEN = ['di', 'chay', 'nhay', 'nga']

const PI = Math.PI
const kep = (v, a, b) => Math.max(a, Math.min(b, v))
const tron = (a, b, k) => a + (b - a) * k
const muot = k => { k = kep(k, 0, 1); return k * k * (3 - 2 * k) }
const raSau = k => { k = kep(k, 0, 1); return 1 - (1 - k) * (1 - k) }
const vao = k => { k = kep(k, 0, 1); return k * k }
const nay = k => { k = kep(k, 0, 1); const c = 1.7, u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u }
// rung tất định
const rungTD = (t, f, pha) => Math.sin(2 * PI * f * t + pha) * 0.6 + Math.sin(2 * PI * f * 1.73 * t + pha * 2.1) * 0.4
// đoạn khóa trong cảnh: [[u, giá trị], ...], u từ 0 tới 1
function khoa(ds, u, e = muot) {
  if (u <= ds[0][0]) return ds[0][1]
  for (let i = 1; i < ds.length; i++) if (u <= ds[i][0]) {
    const [u0, v0] = ds[i - 1], [u1, v1] = ds[i]
    return tron(v0, v1, e((u - u0) / Math.max(1e-6, u1 - u0)))
  }
  return ds[ds.length - 1][1]
}

const BUOC_DI = 0.72, BUOC_CHAY = 1.15

function chuKyChan(phi, manh) {
  const hong = 0.40 * manh * Math.sin(phi) + (manh > 1.2 ? 0.15 : 0)
  const sw = Math.max(0, Math.cos(phi + 0.5))
  const goi = 0.08 + (0.75 + 0.6 * (manh - 1)) * sw * sw + (manh > 1.2 ? 0.25 : 0)
  return { hong, goi }
}
function chuKyTay(phi, manh) {
  return { vai: -0.38 * manh * Math.sin(phi) + (manh > 1.2 ? 0.1 : 0), khuyu: manh > 1.2 ? 1.45 : 0.25 + 0.2 * Math.max(0, -Math.sin(phi)) }
}

// Tư thế đứng mặc định
function dung0() {
  return {
    lean: 0, dauNghieng: 0, nhin: 0.2, co: 1, bay: 0, nga: 0,
    tayP: { vai: 0.05, khuyu: 0.15, ab: 0.08 }, tayT: { vai: 0.05, khuyu: 0.15, ab: 0.08 },
    chanP: { hong: 0.02, goi: 0.06 }, chanT: { hong: -0.02, goi: 0.05 },
    mat: 'thuong', mieng: 'dong', longMay: 'thuong',
  }
}
const SO_GOC = ['lean', 'dauNghieng', 'nhin', 'co', 'bay', 'nga']
function tronTuThe(a, b, k) {
  const r = { ...b }
  for (const f of SO_GOC) r[f] = tron(a[f], b[f], k)
  for (const g of ['tayP', 'tayT']) r[g] = { vai: tron(a[g].vai, b[g].vai, k), khuyu: tron(a[g].khuyu, b[g].khuyu, k), ab: tron(a[g].ab, b[g].ab, k) }
  for (const g of ['chanP', 'chanT']) r[g] = { hong: tron(a[g].hong, b[g].hong, k), goi: tron(a[g].goi, b[g].goi, k) }
  if (k < 0.5) { r.mat = a.mat; r.mieng = a.mieng; r.longMay = a.longMay }
  return r
}

// Dáng của từng động tác. u: 0..1 trong cảnh, d: độ dài cảnh (giây), tc: giây kể từ đầu cảnh.
// Trả tư thế (chưa có x, yaw). Tay giơ cao luôn dang ra (ab) để không che mặt.
function dang(viec, u, d, tc, T) {
  const p = dung0()
  const tho = Math.sin(2 * PI * 0.35 * T)
  p.lean += 0.012 * tho; p.dauNghieng += 0.015 * Math.sin(2 * PI * 0.35 * T - 0.6)
  switch (viec) {
    case 'nhin':
      p.nhin = khoa([[0, 0.2], [0.12, 0.7], [0.88, 0.7], [1, 0.4]], u)
      p.dauNghieng += khoa([[0, 0], [0.15, 0.12], [0.85, 0.08], [1, 0]], u)
      p.mat = 'lieng'
      break
    case 'noi': {
      const g = Math.sin(tc * 2.6), g2 = Math.sin(tc * 2.1 + 1.3)
      p.tayP.vai = 0.35 + 0.18 * g; p.tayP.khuyu = 1.15 + 0.3 * g2; p.tayP.ab = 0.12
      p.tayT.vai = 0.15 + 0.1 * g2; p.tayT.khuyu = 0.6 + 0.25 * g
      p.dauNghieng += 0.05 * Math.sin(tc * 1.7)
      p.nhin = 0.8; p.mieng = 'noi'
      break
    }
    case 'mung': {
      const nh = Math.abs(Math.sin(tc * 5.5))
      p.tayP = { vai: 2.25, khuyu: 0.35 + 0.2 * Math.sin(tc * 11), ab: 0.6 }
      p.tayT = { vai: 2.2, khuyu: 0.4 + 0.2 * Math.sin(tc * 11 + 1), ab: 0.6 }
      p.bay = 0.07 * nh; p.chanP = { hong: 0.15 * nh, goi: 0.35 * nh }; p.chanT = { hong: 0.1 * nh, goi: 0.3 * nh }
      p.lean = -0.08; p.dauNghieng = -0.1; p.mat = 'vui'; p.mieng = 'cuoi'; p.longMay = 'vui'
      break
    }
    case 'xay': case 'dao': {
      const n = Math.sin(tc * (viec === 'dao' ? 9 : 11))
      p.tayP = { vai: 1.1 + 0.45 * n, khuyu: 0.9 - 0.4 * n, ab: 0.1 }
      p.tayT = { vai: 0.9 + 0.35 * n, khuyu: 1.1 - 0.3 * n, ab: 0.1 }
      p.lean = viec === 'dao' ? 0.3 + 0.1 * n : 0.15; p.chanP.goi = 0.25; p.chanT.goi = 0.2; p.chanP.hong = 0.15
      p.nhin = 0.9; p.mat = 'thuong'
      break
    }
    case 'giat-minh': {
      // khựng, thu người, bật giơ tay, hét, rồi run
      const a = Math.min(0.25, d * 0.15) / d, b = a + 0.12 / d, c = b + 0.3 / d
      p.co = khoa([[0, 1], [a, 0.9], [b, 1.07], [c, 1]], u)
      p.lean = khoa([[0, -0.06], [a, 0.16], [b, -0.16], [c, -0.07]], u)
      p.dauNghieng = khoa([[0, -0.1], [a, 0.1], [b, -0.18], [c, -0.08]], u)
      // tay bật ra trước ngang ngực, cẳng tay dựng lên: không giơ qua mặt ở góc nghiêng
      const vai = khoa([[0, 0.1], [a, -0.25], [b, 1.65], [1, 1.5]], u, raSau)
      p.tayP = { vai, khuyu: khoa([[0, 0.2], [a, 1.3], [b, 0.95], [1, 0.9]], u), ab: khoa([[0, 0.1], [a, 0.1], [b, 0.5], [1, 0.45]], u) }
      p.tayT = { vai: vai - 0.15, khuyu: khoa([[0, 0.2], [a, 1.2], [b, 1.05], [1, 1.0]], u), ab: khoa([[0, 0.1], [a, 0.1], [b, 0.5], [1, 0.45]], u) }
      p.chanP = { hong: khoa([[0, 0.02], [a, 0.35], [b, 0], [1, 0.15]], u), goi: khoa([[0, 0.06], [a, 0.75], [b, 0.05], [1, 0.3]], u) }
      p.chanT = { hong: p.chanP.hong * 0.85 - 0.04, goi: p.chanP.goi * 0.9 }
      p.bay = khoa([[0, 0], [a, 0], [b, 0.035], [c, 0]], u)
      p.nhin = 1
      p.mat = u < a ? 'mo-to' : 'so'; p.mieng = u < a ? 'o' : u < c + 0.1 ? 'het' : 'run'; p.longMay = 'nhuong'
      if (u > c) { const r = 0.05; p.tayP.vai += r * rungTD(T, 9, 0.3); p.tayT.vai += r * rungTD(T, 9.7, 1.9); p.chanP.goi += r * rungTD(T, 8, 1.1) }
      break
    }
    case 'vay': {
      const k = Math.min(1, tc / 0.25)
      // bắp tay chếch lên phía trước, cẳng tay dựng đứng; lắc lệch ra trước để bàn tay không lướt qua mặt
      p.tayP = { vai: tron(0.1, 1.9, k), khuyu: tron(0.3, 1.1, k) + k * (0.32 * Math.sin(2 * PI * 2.2 * tc) - 0.08), ab: tron(0.1, 0.45, k) }
      p.tayT = { vai: 0.35, khuyu: 1.75, ab: 0.12 }
      p.dauNghieng += 0.12; p.nhin = 0.8; p.mat = 'ngai'; p.mieng = 'cuoi-guong'; p.longMay = 'lo'
      break
    }
    case 'run': {
      const r = 0.06
      p.tayP = { vai: 0.4 + r * rungTD(T, 9, 0.3), khuyu: 1.9 + r * rungTD(T, 11, 2.2), ab: 0.15 }
      p.tayT = { vai: 0.35 + r * rungTD(T, 9.7, 1.9), khuyu: 1.8 + r * rungTD(T, 10.3, 0.7), ab: 0.15 }
      p.chanP = { hong: 0.25, goi: 0.5 + r * rungTD(T, 8, 1.1) }; p.chanT = { hong: 0.2, goi: 0.45 + r * rungTD(T, 8.5, 2.7) }
      p.lean = 0.1; p.dauNghieng = 0.12; p.co = 0.96
      p.mat = 'so'; p.mieng = 'run'; p.longMay = 'lo'
      break
    }
    case 'chi': {
      const k = Math.min(1, tc / 0.3)
      p.tayP = { vai: tron(0.1, 1.55, raSau(k)), khuyu: tron(0.2, 0.05, k), ab: 0.08 }
      p.tayT = { vai: 0.1, khuyu: 0.3, ab: 0.1 }
      p.lean = 0.05; p.nhin = 1; p.mat = 'mo-to'; p.mieng = 'o'
      break
    }
    case 'nghi':
      p.tayP = { vai: 0.55, khuyu: 2.25, ab: 0.15 }
      p.tayT = { vai: 0.3, khuyu: 1.6, ab: 0.1 }
      p.dauNghieng = -0.12 + 0.03 * Math.sin(tc * 1.3); p.nhin = 0.4
      p.mat = 'lieng'; p.mieng = 'dong'; p.longMay = 'nghi'
      break
    case 'buon':
      p.tayP = { vai: -0.05, khuyu: 0.1, ab: 0.04 }; p.tayT = { vai: -0.05, khuyu: 0.1, ab: 0.04 }
      p.lean = 0.12; p.dauNghieng = 0.35; p.co = 0.97; p.nhin = 0
      p.mat = 'buon'; p.mieng = 'buon'; p.longMay = 'buon'
      break
    case 'nga': {
      // vấp, đổ xuống, nằm, gượng dậy (cảnh đủ dài)
      const dau = d >= 1.6
      p.nga = dau ? khoa([[0, 0], [0.22, 0.05], [0.42, 1], [0.72, 1], [0.95, 0]], u, vao) : khoa([[0, 0], [0.3, 0.05], [0.7, 1]], u, vao)
      p.lean = khoa([[0, 0.1], [0.22, 0.45], [0.42, 0.1]], u)
      p.tayP = { vai: khoa([[0, 0.3], [0.25, 2.0], [0.45, 1.6], [0.8, 1.2], [1, 0.1]], u), khuyu: 0.3, ab: 0.35 }
      p.tayT = { vai: khoa([[0, -0.4], [0.25, 1.8], [0.45, 1.5], [0.8, 1.1], [1, 0.1]], u), khuyu: 0.35, ab: 0.35 }
      p.chanP = { hong: khoa([[0, 0.3], [0.25, -0.4], [0.45, 0.1], [0.8, 0.9], [1, 0]], u), goi: khoa([[0, 0.2], [0.45, 0.4], [0.8, 1.4], [1, 0.05]], u) }
      p.chanT = { hong: p.chanP.hong - 0.3, goi: p.chanP.goi * 0.8 }
      p.mat = u < 0.42 ? 'mo-to' : 'nham'; p.mieng = u < 0.42 ? 'het' : 'run'
      break
    }
    case 'quay':
      p.nhin = 0.6; p.mat = 'thuong'
      break
  }
  return p
}

// Chỗ đứng trên sân khấu: dùng chung tên chỗ với bộ khối (bảng cho), đổi đơn vị.
export const HE_SO_CHO = 0.264

export function taoDien(kb, bang, { W, H }) {
  const doc = H > W
  const canh = kb.canh
  const X = ten => (bang.cho[ten] ?? 0) * HE_SO_CHO
  const caoNhin = H / W > 1 ? 2.2 : 2.57 // chiều cao thế giới thấy được ở cảnh toàn

  // Hướng mặt từng cảnh: theo hướng đi, hoặc nhin_ve, hoặc giữ cảnh trước.
  const huong = []
  let h = 0 // yaw đích, bắt đầu quay sang phải
  for (const c of canh) {
    const a = X(c.tu_cho), b = X(c.den_cho), dau = h
    if (c.nhin_ve === 'phai') h = 0
    else if (c.nhin_ve === 'trai') h = PI
    else if (c.nhin_ve === 'may') h = PI / 2
    else if (DI_CHUYEN.includes(c.hanh_dong) && Math.abs(b - a) > 0.05 && c.hanh_dong !== 'nhay') h = b > a ? 0 : PI
    if (c.hanh_dong === 'quay') h = h < PI / 2 ? PI : 0
    huong.push({ dau, cuoi: h })
  }

  function viTri(c, u) {
    const a = X(c.tu_cho), b = X(c.den_cho)
    if (a === b) return a
    if (c.hanh_dong === 'nhay') return tron(a, b, kep((u - 0.2) / 0.6, 0, 1))
    if (c.hanh_dong === 'nga') return tron(a, b, raSau(kep(u / 0.45, 0, 1)))
    // tăng tốc nhẹ đầu cảnh, hãm cuối cảnh
    return tron(a, b, khoa([[0, 0], [0.1, 0.05], [0.9, 0.95], [1, 1]], u, k => k))
  }

  // Tư thế riêng của cảnh i tại giây T (chưa trộn với cảnh trước)
  function tuTheCanh(i, T) {
    const c = canh[i], d = Math.max(0.05, c.den - c.tu), tc = kep(T - c.tu, 0, d), u = tc / d
    const p = dang(c.hanh_dong, u, d, tc, T)
    p.x = viTri(c, u)
    // quay mặt đầu cảnh trong 0,35 giây
    const hh = huong[i]
    const kq = c.hanh_dong === 'quay' ? Math.min(1, tc / Math.min(0.6, d * 0.6)) : Math.min(1, tc / 0.35)
    p.yaw = tron(hh.dau, hh.cuoi, muot(kq))
    p.quay = Math.abs(hh.cuoi - hh.dau) > 0.01 && kq < 1 ? Math.sin(PI * kq) : 0
    // mừng quay hẳn về máy; vẫy, giật mình quay chếch 3/4 để tay dang ra hai bên, không che mặt
    const veMay = { mung: 0.85, vay: 0.4, 'giat-minh': 0.35 }[c.hanh_dong]
    if (veMay) p.yaw = tron(p.yaw, PI / 2, veMay * muot(Math.min(1, tc / 0.35)))
    // nhìn quanh: quay ra sau rồi quay lại
    if (c.hanh_dong === 'nhin' && d >= 1.4) {
      const b = khoa([[0, 0], [0.3, 0], [0.42, 1], [0.6, 1], [0.72, 0]], u)
      p.yaw = tron(p.yaw, p.yaw < PI / 2 ? PI : 0, b)
      p.quay = Math.max(p.quay, Math.sin(PI * b) * (b > 0 && b < 1 ? 1 : 0))
    }
    // đi, chạy
    const a0 = X(c.tu_cho), b0 = X(c.den_cho)
    if ((c.hanh_dong === 'di' || c.hanh_dong === 'chay') && a0 !== b0) {
      const manh = c.hanh_dong === 'chay' ? 1.6 : 1
      const phi = (2 * PI * Math.abs(p.x - a0)) / (manh > 1 ? BUOC_CHAY : BUOC_DI)
      const k = khoa([[0, 0], [0.06, 1], [0.94, 1], [1, 0.2]], u)
      const cp = chuKyChan(phi, manh), ct = chuKyChan(phi + PI, manh), tp = chuKyTay(phi + PI, manh), tt = chuKyTay(phi, manh)
      p.chanP = { hong: tron(p.chanP.hong, cp.hong, k), goi: tron(p.chanP.goi, cp.goi, k) }
      p.chanT = { hong: tron(p.chanT.hong, ct.hong, k), goi: tron(p.chanT.goi, ct.goi, k) }
      p.tayP = { vai: tron(p.tayP.vai, tp.vai, k), khuyu: tron(p.tayP.khuyu, tp.khuyu, k), ab: 0.08 }
      p.tayT = { vai: tron(p.tayT.vai, tt.vai, k), khuyu: tron(p.tayT.khuyu, tt.khuyu, k), ab: 0.08 }
      p.lean = tron(p.lean, manh > 1 ? 0.3 : 0.08, k)
      p.dauNghieng += 0.03 * Math.sin(2 * phi)
      if (manh > 1) { p.bay += 0.03 * Math.max(0, Math.sin(2 * phi)) * k; p.mat = 'so'; p.mieng = 'run' }
      p.nhin = 0.6
    }
    // nhảy: lấy đà, bay, tiếp đất
    if (c.hanh_dong === 'nhay') {
      const cao = a0 === b0 ? 0.22 : 0.32
      p.bay = u > 0.2 && u < 0.8 ? cao * Math.sin(PI * (u - 0.2) / 0.6) : 0
      p.co = khoa([[0, 1], [0.17, 0.9], [0.23, 1.07], [0.4, 1], [0.8, 1], [0.86, 0.88], [1, 1]], u)
      p.lean = khoa([[0, 0], [0.18, 0.28], [0.3, b0 < a0 && hh.cuoi < PI / 2 ? -0.2 : 0.12], [0.8, 0], [0.88, 0.25], [1, 0.05]], u)
      p.chanP = { hong: khoa([[0, 0.02], [0.18, 0.6], [0.24, 0.1], [0.45, 0.95], [0.78, 0.5], [0.86, 0.65], [1, 0.05]], u), goi: khoa([[0, 0.06], [0.18, 1.1], [0.24, 0.1], [0.45, 1.45], [0.78, 0.6], [0.86, 1.2], [1, 0.08]], u) }
      p.chanT = { hong: p.chanP.hong * 0.85 - 0.04, goi: p.chanP.goi * 0.9 }
      const vai = khoa([[0, 0.05], [0.18, -0.9], [0.3, 1.7], [0.8, 1.5], [1, 0.1]], u, raSau)
      p.tayP = { vai, khuyu: 0.45, ab: 0.2 }; p.tayT = { vai: vai + 0.2, khuyu: 0.5, ab: 0.2 }
      p.mat = 'mo-to'; p.mieng = u > 0.2 && u < 0.8 ? 'het' : 'dong'
    }
    return p
  }

  // Tư thế cuối của cảnh i, để trộn sang cảnh sau
  const cuoi = new Map()
  const tuTheCuoi = i => { if (!cuoi.has(i)) cuoi.set(i, tuTheCanh(i, canh[i].den - 1e-3)); return cuoi.get(i) }

  const timCanh = T => { let i = canh.findIndex(c => T < c.den); return i < 0 ? canh.length - 1 : i }

  function chopMat(T) { const k = T % 3.7; return k > 3.55 && k < 3.67 }

  // Miệng: mở theo mốc từ khi đang nói
  function moMieng(c, T) {
    const moc = c.tu_moc && c.tu_moc.length ? c.tu_moc.map(m => m.tu) : null
    if (moc) {
      let j = -1
      for (let k = 0; k < moc.length; k++) if (T >= moc[k]) j = k
      if (j < 0) return 0
      const ke = j + 1 < moc.length ? moc[j + 1] : Math.min(c.den, moc[j] + 0.4)
      const dai = Math.max(0.08, ke - moc[j]), x = (T - moc[j]) / dai
      if (x > 1) return 0
      const am = Math.max(1, Math.round(dai / 0.18))
      return Math.abs(Math.sin(PI * x * am)) * 0.9
    }
    return Math.abs(Math.sin(T * 13)) * 0.8 * (0.6 + 0.4 * Math.abs(Math.sin(T * 3.1)))
  }

  function sanKhauNhanVat(T) {
    T = kep(T, 0, canh[canh.length - 1].den)
    const i = timCanh(T), c = canh[i]
    let p = tuTheCanh(i, T)
    const tc = T - c.tu
    if (i > 0 && tc < 0.25) {
      const a = tuTheCuoi(i - 1), k = muot(tc / 0.25)
      const x = p.x, yaw = p.yaw, quay = p.quay
      p = tronTuThe(a, p, k)
      p.x = x; p.yaw = yaw; p.quay = quay
    }
    p.t = T; p.viec = c.hanh_dong; p.canh = i
    p.chop = chopMat(T) && p.mat !== 'nham'
    const noi = c.hanh_dong === 'noi' ? (c.noi || 'chinh') === 'chinh' : c.noi === 'chinh'
    p.mieng_mo = noi ? moMieng(c, T) : 0
    if (noi && p.mieng === 'dong') p.mieng = 'noi'
    return datLenDat(p)
  }

  // Nhân vật phụ: đi cùng, đuổi phía sau, đứng đối diện, hoặc vắng
  function nhanVatPhu(T) {
    if (!kb.nhan_vat_phu) return null
    T = kep(T, 0, canh[canh.length - 1].den)
    const i = timCanh(T), c = canh[i]
    if (!c.phu || c.phu === 'vang') return null
    const chinh = sanKhauNhanVat(T)
    const tc = T - c.tu, d = Math.max(0.05, c.den - c.tu), u = tc / d
    const mat = Math.cos(chinh.yaw) >= 0 ? 1 : -1
    let p
    if (c.phu === 'doi-dien') {
      p = dang(c.noi === 'phu' ? 'noi' : 'dung', u, d, tc, T + 1.3)
      p.x = chinh.x + 0.62 * mat
      p.yaw = mat > 0 ? PI : 0
    } else {
      const viec = DI_CHUYEN.includes(c.hanh_dong) && c.hanh_dong !== 'nga' ? (c.phu === 'duoi' ? 'chay' : c.hanh_dong) : (c.noi === 'phu' ? 'noi' : 'dung')
      p = tuTheCanh(i, T - 0.18)
      if (!DI_CHUYEN.includes(viec)) { const q = dang(viec, u, d, tc, T + 1.3); q.x = p.x; q.yaw = p.yaw; p = q }
      const lui = c.phu === 'duoi' ? (doc ? 0.42 : 0.62) : 0.42
      p.x = p.x - lui * mat
      if (c.phu === 'duoi') { p.mat = 'gian'; p.mieng = 'gam' }
    }
    p.quay = 0; p.t = T; p.viec = c.hanh_dong; p.canh = i
    p.chop = chopMat(T + 1.7)
    p.mieng_mo = c.noi === 'phu' ? moMieng(c, T) : 0
    if (c.noi === 'phu' && p.mieng === 'dong') p.mieng = 'noi'
    return datLenDat(p)
  }

  function datLenDat(p) {
    const k = khung2D({ ...p, yGoc: 0 }, 0)
    const ds = [k.coChanP, k.coChanT, k.banP, k.banT, k.dau, k.goiP, k.goiT]
    let thap = Math.min(k.coChanP[1], k.coChanT[1]) - XUONG.coChan
    if (p.nga > 0.01) thap = Math.min(thap, Math.min(...ds.map(v => v[1])) - XUONG.banKinhDau * p.nga)
    p.yGoc = -thap + p.bay
    return p
  }

  // ---- Máy quay ----
  // Trả { tam: [x, y], cao } theo đơn vị thế giới: điểm giữa khung và chiều cao thấy được.
  const XMIN = -3.2, XMAX = 3.2
  function mayCanh(i, T) {
    const c = canh[i], p = sanKhauNhanVat(T), ph = nhanVatPhu(T)
    const nho = doc ? 0.85 : 1
    const theoX = (x, cao) => {
      const rong = cao * W / H / 2
      return kep(x, XMIN + rong, XMAX - rong)
    }
    const tc = T - c.tu, d = Math.max(0.05, c.den - c.tu), u = tc / d
    let tam, cao
    switch (c.may) {
      case 'can': cao = 1.05 * nho; tam = [p.x + 0.1 * Math.cos(p.yaw), 0.72 + p.yGoc * 0.6]; break
      case 'theo': cao = 1.75 * nho; tam = [p.x + 0.25 * Math.cos(p.yaw), 0.85 + p.yGoc * 0.4]; break
      case 'ngang': cao = 1.5 * nho; tam = [p.x, 0.8 + p.yGoc * 0.4]; break
      case 'doi': { cao = (doc ? 2.1 : 1.65) * nho; const x2 = ph ? (p.x + ph.x) / 2 : p.x; tam = [x2, 0.85]; break }
      case 'vut': { const k = muot(u); cao = tron(1.1, caoNhin * 1.05, k) * nho; tam = [p.x, tron(0.75, caoNhin / 2 - 0.25, k)]; break }
      case 'tren': cao = 2.0 * nho; tam = [p.x, 0.9]; break
      default: cao = caoNhin; tam = [p.x, caoNhin / 2 - 0.25]
    }
    // trôi chậm cho có sống
    tam[0] += 0.02 * Math.sin(T * 0.37); tam[1] += 0.012 * Math.sin(T * 0.29)
    // Khung dọc thấp hơn khung ngang: hạ tầm ngắm để chân không bị cắt (trừ cận mặt)
    if (c.may !== 'can') tam[1] = Math.min(tam[1], Math.max(0.3, cao / 2 - 0.04))
    // Khung dọc hẹp: có nhân vật phụ thì lùi máy đủ chỗ cho cả hai, trừ cận mặt
    if (doc && ph && c.may !== 'can') {
      const caoT = (Math.abs(p.x - ph.x) + 0.6) / (W / H)
      if (caoT > cao) cao = caoT
      tam[0] = (p.x + ph.x) / 2
    }
    // Ngã thì thân nằm ngang: khung dọc lùi máy và ngắm vào giữa thân mới thấy trọn
    if (doc && p.nga > 0.02 && c.may !== 'can') {
      const k = khung2D(p)
      const xs = ['dau', 'banP', 'banT', 'coChanP', 'coChanT', 'goiP', 'goiT'].map(q => k[q][0])
      const min = Math.min(...xs), max = Math.max(...xs)
      const caoT = (max - min + 0.36) / (W / H)
      cao = Math.max(cao, Math.min(caoT, 3))
      tam[0] = (min + max) / 2
    }
    tam[0] = theoX(tam[0], cao)
    return { tam, cao, kieu: c.may || 'toan', tren: c.may === 'tren' ? 1 : 0 }
  }
  function may(T) {
    T = kep(T, 0, canh[canh.length - 1].den)
    const i = timCanh(T), c = canh[i], m = mayCanh(i, T)
    const tc = T - c.tu
    if (i > 0 && tc < 0.4) {
      // cắt cảnh: đổi góc ngay, chỉ trượt nhẹ 0,4 giây đầu cho khỏi giật khi cùng góc
      if (canh[i - 1].may === c.may) {
        const a = mayCanh(i - 1, T), k = muot(tc / 0.4)
        return { tam: [tron(a.tam[0], m.tam[0], k), tron(a.tam[1], m.tam[1], k)], cao: tron(a.cao, m.cao, k), kieu: m.kieu, tren: m.tren }
      }
    }
    return m
  }

  // ---- Sự kiện ----
  // hien: thứ lạ hiện ở phía phải sân khấu (quái, ánh sáng, con mắt...) tới khi có su_kien "an".
  // sang: cảnh bừng sáng (kết vui). rung: rung khung đầu cảnh.
  function suKien(T) {
    let hien = 0, hienTu = null, anTu = null, sang = 0, rung = 0
    for (const c of canh) {
      const sk = c.su_kien || []
      if (c.tu > T) break
      if (sk.includes('hien')) { hienTu = c.tu; anTu = null }
      if (sk.includes('an') && hienTu !== null) { anTu = c.tu; hienTu = null }
      if (sk.includes('sang')) sang = Math.max(sang, muot((T - c.tu) / Math.max(0.3, (c.den - c.tu) * 0.5)))
      if (sk.includes('rung') || c.hanh_dong === 'giat-minh') {
        const tr = c.hanh_dong === 'giat-minh' ? c.tu + Math.min(0.25, (c.den - c.tu) * 0.15) + 0.06 : c.tu
        if (T >= tr) rung = Math.max(rung, Math.exp(-(T - tr) * 9))
      }
      if (c.hanh_dong === 'nga' && c.den - c.tu > 0.3) {
        const tr = c.tu + 0.42 * (c.den - c.tu)
        if (T >= tr) rung = Math.max(rung, 0.6 * Math.exp(-(T - tr) * 9))
      }
    }
    if (hienTu !== null) hien = muot((T - hienTu) / 0.4)
    else if (anTu !== null) hien = 1 - muot((T - anTu) / 0.3)
    return { hien, hienTu, sang, rung }
  }

  // Chỗ thứ lạ hiện ra: bám mép phải khung của cảnh, giữ trong sân khấu và trong khung
  function hienX(T) {
    const s = suKien(T)
    const m = may(s.hienTu ?? T)
    const mep = m.tam[0] + m.cao * W / H * 0.30
    const trongKhung = m.tam[0] + m.cao * W / H / 2 - 0.12
    return kep(Math.min(mep, trongKhung), XMIN + 0.25, XMAX - 0.25)
  }

  // Đổi tọa độ thế giới sang điểm ảnh của khung, theo máy quay m = may(T)
  const raMan = (pt, m) => { const k = H / m.cao; return [W / 2 + (pt[0] - m.tam[0]) * k, H / 2 - (pt[1] - m.tam[1]) * k] }
  // Đặt máy phối cảnh three.js cho khớp khung với máy m: nhìn thẳng vào mặt phẳng z = 0
  function datMay3D(cam, m, { z = 0, ngua = 0.12 } = {}) {
    const fov = cam.fov * PI / 180, xa = m.cao / 2 / Math.tan(fov / 2)
    const nghieng = ngua + (m.tren ? 0.35 : 0)
    cam.position.set(m.tam[0], m.tam[1] + Math.sin(nghieng) * xa, z + Math.cos(nghieng) * xa)
    cam.lookAt(m.tam[0], m.tam[1], z)
    cam.aspect = W / H; cam.updateProjectionMatrix()
  }
  return { tuThe: (T, ai = 'chinh') => ai === 'phu' ? nhanVatPhu(T) : sanKhauNhanVat(T), khung2D, may, suKien, hienX, raMan, datMay3D, X, doc, W, H, XUONG, canh, timCanh: T => canh[timCanh(T)] }
}

// ---- Khớp 2D ----
// Tọa độ thế giới các khớp. Quay người không lật một khung: khi yaw đi qua PI/2 (nhìn máy),
// tay chân tách sang hai bên như dáng chính diện, rồi khép lại ở phía bên kia.
export function khung2D(p, yGoc = p.yGoc ?? 0) {
  const X = XUONG
  const c = Math.cos(p.yaw), s = Math.abs(Math.sin(p.yaw))
  const co = p.co ?? 1
  // vị trí cục bộ khi nhìn nghiêng sang phải, rồi chiếu theo yaw
  const v = ang => [Math.sin(ang), -Math.cos(ang)]
  const cong = (a, d, L) => [a[0] + d[0] * L, a[1] + d[1] * L]
  const hip = [0, 0]
  const thanV = [Math.sin(p.lean), Math.cos(p.lean)]
  const coGoc = cong(hip, thanV, X.than)
  const vai = cong(coGoc, [-thanV[0], -thanV[1]], X.vaiXuong)
  const gDau = p.lean + p.dauNghieng
  const dau = cong(coGoc, [Math.sin(gDau), Math.cos(gDau)], X.co + X.banKinhDau)
  const tay = tt => {
    const a1 = tt.vai + p.lean, a2 = a1 + tt.khuyu
    const khuyu = cong(vai, v(a1), X.tayTren)
    return { khuyu, ban: cong(khuyu, v(a2), X.tayDuoi), a1, a2 }
  }
  const chan = cc => {
    const a1 = cc.hong, a2 = a1 - cc.goi
    const goi = cong(hip, v(a1), X.dui)
    return { goi, coChan: cong(goi, v(a2), X.cang), a1, a2 }
  }
  const tp = tay(p.tayP), tt = tay(p.tayT), cp = chan(p.chanP), ct = chan(p.chanT)

  // chiếu: x cục bộ nhân cos(yaw); tay chân bên phải/trái dạt ra theo sin(yaw)
  // ab (dang tay) cũng đẩy bàn tay ra ngang khi nhìn chính diện
  const vaiR = X.vaiRong * s, hongR = X.hongRong * s
  const lech = (pt, mo, them) => [pt[0] * c + mo + them, pt[1]]
  const ab = (t, L) => Math.sin(t.ab ?? 0) * L
  const out = {
    huong: c >= 0 ? 1 : -1, ngang: c, chinhDien: s,
    hong: [hip[0], hip[1]], coGoc: lech(coGoc, 0, 0), vai: lech(vai, 0, 0), dau: lech(dau, 0, 0),
    vaiP: lech(vai, vaiR, 0), vaiT: lech(vai, -vaiR, 0),
    hongP: [hongR, 0], hongT: [-hongR, 0],
    khuyuP: lech(tp.khuyu, vaiR, ab(p.tayP, X.tayTren) * s),
    banP: lech(tp.ban, vaiR, ab(p.tayP, X.tayTren + X.tayDuoi) * s),
    khuyuT: lech(tt.khuyu, -vaiR, -ab(p.tayT, X.tayTren) * s),
    banT: lech(tt.ban, -vaiR, -ab(p.tayT, X.tayTren + X.tayDuoi) * s),
    goiP: lech(cp.goi, hongR, 0), coChanP: lech(cp.coChan, hongR, 0),
    goiT: lech(ct.goi, -hongR, 0), coChanT: lech(ct.coChan, -hongR, 0),
    gocDau: gDau, gocThan: p.lean,
    goc: { tayTrenP: tp.a1, tayDuoiP: tp.a2, tayTrenT: tt.a1, tayDuoiT: tt.a2, duiP: cp.a1, cangP: cp.a2, duiT: ct.a1, cangT: ct.a2 },
  }
  // ngã: xoay cả người quanh cổ chân trước (ngã về phía trước mặt)
  const nga = p.nga ?? 0
  const KHOP = ['hong', 'coGoc', 'vai', 'dau', 'vaiP', 'vaiT', 'hongP', 'hongT', 'khuyuP', 'banP', 'khuyuT', 'banT', 'goiP', 'coChanP', 'goiT', 'coChanT']
  if (nga > 0.001) {
    const g = -nga * 1.45 * (c >= 0 ? 1 : -1), tr = out.coChanP, cg = Math.cos(g), sg = Math.sin(g)
    for (const k of KHOP) {
      const dx = out[k][0] - tr[0], dy = out[k][1] - tr[1]
      out[k] = [tr[0] + dx * cg - dy * sg, tr[1] + dx * sg + dy * cg]
    }
    out.gocNga = g
  } else out.gocNga = 0
  // dời về chỗ đứng, co giãn dọc quanh mặt đất
  for (const k of KHOP) {
    const y = out[k][1] + yGoc
    out[k] = [p.x + out[k][0] / Math.sqrt(co), y * co]
  }
  return out
}
