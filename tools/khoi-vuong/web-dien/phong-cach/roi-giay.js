// Phong cách "Rối giấy 2,5D" (roi-giay), bối cảnh đồi đêm trăng.
//
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
//   - Tư thế, vị trí, hướng mặt, máy quay, sự kiện đều lấy từ dx (dien.js). Mô-đun này chỉ dựng hình.
//   - 1 đơn vị = chiều cao nhân vật, mặt đất y = 0, sân khấu x từ -3,2 tới 3,2, z = 0 là mặt phẳng diễn.
//   - Nhân vật chính lấy màu từ kb.nhan_vat; có kb.nhan_vat_phu thì vẽ thêm nhân vật phụ theo
//     dx.tuThe(T, 'phu') và dáng kb.nhan_vat_phu.dang (nguoi, thu; các dáng khác dùng dáng người).
//   - Thứ lạ của phong cách là con sói giấy nấp sau bụi, hiện ở dx.hienX(T) khi có sự kiện hien.
//   - Hàm thuần theo T: không Math.random, không Date, không mạng, không requestAnimationFrame.
//     Ngẫu nhiên dùng bam(seed). ve(T) gọi lặp hay bỏ khung đều ra cùng một hình.
//
// Nhìn: nhân vật giấy cắt nối đinh ghim, cảnh nhiều lớp giấy có bóng đổ và thị sai như sách truyện.
// Nhân vật có hai bộ mảnh: nhìn nghiêng và nhìn chính diện. Lúc quay người, mảnh co ngang rồi đổi
// bộ ở giữa cú quay (không lật hình một khung). Mảnh tay chân xoay quanh đinh ở khớp, thân nhún
// theo bước chạy nhờ khung2D của bộ diễn xuất.
// Cỡ nét, hạt, độ phân giải tranh vẽ tính theo H và Math.min(W, H) nên chạy đúng ở mọi khung.

// ---------- Số học và màu ----------
const PI = Math.PI, TAU = PI * 2
const kep = (v, a, b) => (v < a ? a : v > b ? b : v)
const tron = (a, b, k) => a + (b - a) * k
const muot = k => { k = kep(k, 0, 1); return k * k * (3 - 2 * k) }
// Nhiễu tất định 0..1: cùng hạt luôn ra cùng số.
const bam = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c }

const GIAY = '#f6eedd'                              // màu mép giấy cắt
const giayC = '#f6e7b4', giayC2 = '#e8d38e'          // trăng
const TROI = ['#11163a', '#2a2a5e', '#4a3f7c', '#6b4f7a']
const DOI = ['#41477e', '#2e6367', '#274c40']
const RUNG = ['#1f4038', '#285246']
const DAT = ['#4d7f3d', '#3f6e35', '#345c2e']
const NHA = { tuong: '#e9d3a6', mai: '#b0463c', cua: '#ffd36e' }

const soMau = h => {
  h = String(h || '#000000').replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const n = parseInt(h, 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const raMau = (r, g, b) => '#' + [r, g, b].map(v => kep(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')
const pha = (h, k) => { const [r, g, b] = soMau(h); return raMau(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) }
const dam = (h, k) => { const [r, g, b] = soMau(h); return raMau(r * (1 - k), g * (1 - k), b * (1 - k)) }
const doSang = h => { const [r, g, b] = soMau(h); return (r * 0.299 + g * 0.587 + b * 0.114) / 255 }

// ---------- Hình học giấy cắt ----------
function ell(cx, cy, rx, ry, n = 26) {
  const o = []
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]) }
  return o
}
function pill(x0, x1, y, r, n = 8) {
  const o = []
  for (let k = 0; k <= n; k++) { const a = -PI / 2 + (PI * k) / n; o.push([x1 + Math.cos(a) * r, y + Math.sin(a) * r]) }
  for (let k = 0; k <= n; k++) { const a = PI / 2 + (PI * k) / n; o.push([x0 + Math.cos(a) * r, y + Math.sin(a) * r]) }
  return o
}
// Dải cung (vành mũ, cổ áo): cung ngoài rồi cung trong, khép kín.
function cung(cx, cy, rx, ry, a0, a1, d0, d1, n = 14) {
  const o = [], q = []
  for (let i = 0; i <= n; i++) {
    const a = tron(a0, a1, i / n)
    o.push([cx + Math.cos(a) * (rx + d1), cy + Math.sin(a) * (ry + d1)])
    q.push([cx + Math.cos(a) * (rx + d0), cy + Math.sin(a) * (ry + d0)])
  }
  return o.concat(q.reverse())
}
// Mép giấy xơ: rung nhẹ từng đoạn theo hạt.
function jag(pts, seed, amp, step = 9) {
  const out = [], n = pts.length
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const k = Math.max(1, Math.round(len / step))
    for (let j = 0; j < k; j++) {
      const t = j / k
      out.push([
        a[0] + (b[0] - a[0]) * t + (bam(seed + i * 31 + j * 7) - 0.5) * 2 * amp,
        a[1] + (b[1] - a[1]) * t + (bam(seed + i * 17 + j * 13 + 99) - 0.5) * 2 * amp,
      ])
    }
  }
  return out
}
function duong(x, pts) {
  x.beginPath()
  pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])))
  x.closePath()
}
// Một mảnh giấy: mép kem, thân có sắc độ nhẹ từ trên xuống.
function cat(x, pts, mau, seed = 1, amp = 1.2, step = 9, vien = 3.4) {
  const q = jag(pts, seed, amp, step)
  duong(x, q)
  x.lineJoin = 'round'; x.lineCap = 'round'
  x.strokeStyle = GIAY; x.lineWidth = vien; x.stroke()
  let ymin = 1e9, ymax = -1e9
  for (const p of pts) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1] }
  const g = x.createLinearGradient(0, ymax, 0, ymin)
  g.addColorStop(0, pha(mau, 0.09)); g.addColorStop(0.55, mau); g.addColorStop(1, dam(mau, 0.09))
  x.fillStyle = g; x.fill()
}
// Chùm hình tròn: viền chung ngoài, không lộ viền trong.
function blob(x, circles, mau, seed = 1, vien = 3.4, amp = 1.2) {
  for (const [cx, cy, rx, ry] of circles) { duong(x, jag(ell(cx, cy, rx, ry, 20), seed, amp)); x.strokeStyle = GIAY; x.lineWidth = vien; x.stroke() }
  for (const [cx, cy, rx, ry] of circles) { duong(x, jag(ell(cx, cy, rx, ry, 20), seed, amp)); x.fillStyle = mau; x.fill() }
}
const line = (x, pts, mau, rong = 2.4) => {
  x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])))
  x.strokeStyle = mau; x.lineWidth = rong; x.lineCap = 'round'; x.lineJoin = 'round'; x.stroke()
}

// ---------- Màu nhân vật ----------
function layMau(nv) {
  const da = nv.than || '#f2c9a0', mat = nv.mat || '#2b1d14'
  const ao = nv.ao || '#d9a43a', quan = nv.quan || '#6a4c8c', phu = nv.phu || '#d23b2f'
  const sang = doSang(mat) > 0.66
  return {
    da, mat, ao, quan, phu,
    net: dam(mat, 0.45), netSoft: 'rgba(40,24,20,0.30)',
    matNen: sang ? mat : '#fff8ea', matLong: sang ? dam(mat, 0.78) : mat,
    toc: dam(mat, 0.16), giay: GIAY, giay2: '#efe2c8',
    miengToi: dam(phu, 0.62), soc: dam(ao, 0.35), long: da,
  }
}

// ---------- Mặt người ----------
// st: { mat, mieng, chop, longMay, mo, nhin }. view 0 = nghiêng, 1 = chính diện.
function veMatNguoi(x, st, view, M) {
  const net = M.net
  const E = view ? [[66, 96], [102, 96]] : [[78, 96], [102, 96]]
  const lid = { lieng: 0.38, ngai: 0.42, buon: 0.42, nham: 0.55, gian: 0.08 }[st.mat] || 0
  const to = { so: 1.22, 'mo-to': 1.1, vui: 1, buon: 0.94, ngai: 0.94, lieng: 0.98, gian: 0.96 }[st.mat] || 1
  for (let i = 0; i < 2; i++) {
    const ex = E[i][0], ey = E[i][1]
    const rx = (view ? 8.4 : (i ? 8 : 6.2)) * to
    const ry = (view ? 9.8 : (i ? 9.4 : 7.4)) * to
    if (st.chop || st.mat === 'nham') {
      x.strokeStyle = net; x.lineWidth = 2.6; x.lineCap = 'round'
      x.beginPath(); x.arc(ex, ey - 1, rx * 0.85, 0.25, PI - 0.25); x.stroke()
    } else if (st.mat === 'vui') {
      x.strokeStyle = net; x.lineWidth = 2.8; x.lineCap = 'round'
      x.beginPath(); x.arc(ex, ey - 4, rx * 0.85, 0.3, PI - 0.3); x.stroke()
    } else {
      x.beginPath(); x.ellipse(ex, ey, rx, ry, 0, 0, TAU); x.fillStyle = M.matNen; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.7; x.stroke()
      const px = ex + (view ? 0 : (1.4 + st.nhin * 1.6) * (i === 1 ? 1 : 0.55))
      const py = ey - (st.mat === 'buon' ? 2.6 : 0)
      const pr = Math.min(rx, ry) * ({ so: 0.28, 'mo-to': 0.42, gian: 0.46, lieng: 0.5, ngai: 0.52, buon: 0.52, thuong: 0.56 }[st.mat] || 0.56)
      x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fillStyle = M.matLong; x.fill()
      x.beginPath(); x.arc(px - pr * 0.4, py + pr * 0.5, pr * 0.34, 0, TAU); x.fillStyle = 'rgba(255,250,235,.9)'; x.fill()
      if (lid > 0) {
        x.save()
        x.beginPath(); x.ellipse(ex, ey, rx + 0.4, ry + 0.4, 0, 0, TAU); x.clip()
        x.fillStyle = M.da
        x.fillRect(ex - rx - 2, ey - ry - 2, 2 * rx + 4, 2 * ry * lid + 2)
        x.strokeStyle = net; x.lineWidth = 1.9
        x.beginPath(); x.moveTo(ex - rx, ey - ry + 2 * ry * lid); x.lineTo(ex + rx, ey - ry + 2 * ry * lid); x.stroke()
        x.restore()
      }
    }
  }
  // lông mày
  for (let i = 0; i < 2; i++) {
    const ex = E[i][0], ey = E[i][1], odd = i === 0 ? 1 : -1
    const len = view ? 18 : 16
    const by = ey + (view ? 14 : 13)
    let yi = 0, yo = 0
    if (st.longMay === 'lo') { yi = 3; yo = -1.5 }
    else if (st.longMay === 'nhuong') { yi = 4; yo = 0 }
    else if (st.longMay === 'buon') { yi = 4; yo = -1 }
    else if (st.longMay === 'nghi') { yi = i === 0 ? 4 : -2; yo = 0 }
    else if (st.longMay === 'gian') { yi = -4; yo = 1 }
    else if (st.longMay === 'vui') { yi = -1; yo = 2 }
    else { yi = 1.5; yo = 1 }
    if (st.mat === 'so') { yi = 5; yo = 1 }
    if (st.mat === 'buon') { yi = 4; yo = -1 }
    line(x, [[ex - odd * len * 0.55, by + yo], [ex + odd * len * 0.35, by + yi]], M.toc, 1.7)
  }
  // má hồng (luôn có chút ấm)
  for (const bx of (view ? [54, 114] : [102])) {
    x.beginPath(); x.ellipse(bx, 80, 9, 5.5, 0, 0, TAU)
    x.fillStyle = `rgba(226,110,110,${st.mat === 'ngai' || st.mat === 'vui' ? 0.38 : 0.18})`; x.fill()
  }
  // mũi: chỉ một nét nhỏ, không thành mảng
  if (view) {
    line(x, [[80, 87], [84, 89], [88, 87]], dam(M.da, 0.3), 1.8)
    x.beginPath(); x.arc(84, 84.5, 1.5, 0, TAU); x.fillStyle = M.netSoft; x.fill()
  } else {
    line(x, [[112, 91], [118, 89], [121, 85]], dam(M.da, 0.3), 2)
    x.beginPath(); x.arc(119, 84.5, 1.5, 0, TAU); x.fillStyle = M.netSoft; x.fill()
  }
  // giọt mồ hôi khi sợ / ngại
  if (st.mat === 'so' || st.mat === 'ngai') {
    cat(x, ell(view ? 118 : 126, view ? 112 : 110, 3.2, 5, 10), '#8fd3f0', 148, 0.3, 4, 1.4)
  }
  veMieng(x, view ? 84 : 108, 68, st, M, view)
}

// Miệng theo p.mieng; p.mieng_mo làm miệng mở to nhỏ khi đang nói.
function veMieng(x, cx, cy, st, M, view) {
  const net = M.net, toi = M.miengToi
  const mo = st.mo / 3
  const rong = view ? 1 : 0.85
  switch (st.mieng) {
    case 'noi': {
      const h = 2.6 + 7 * mo
      x.beginPath(); x.ellipse(cx, cy, (4 + 2 * mo) * rong, h, 0, 0, TAU); x.fillStyle = toi; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.6; x.stroke()
      x.beginPath(); x.ellipse(cx, cy - h * 0.34, 2.6 * rong, h * 0.3, 0, 0, TAU); x.fillStyle = pha(M.phu, 0.34); x.fill()
      break
    }
    case 'o': {
      x.beginPath(); x.ellipse(cx, cy, 5 * rong, 5.4, 0, 0, TAU); x.fillStyle = toi; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.6; x.stroke()
      break
    }
    case 'het': {
      x.beginPath(); x.ellipse(cx, cy - 2, 8 * rong, 11, 0, 0, TAU); x.fillStyle = toi; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.8; x.stroke()
      x.beginPath(); x.ellipse(cx, cy + 3, 5 * rong, 4, 0, 0, TAU); x.fillStyle = pha(M.phu, 0.3); x.fill()
      x.fillStyle = M.giay; x.fillRect(cx - 6 * rong, cy - 11, 12 * rong, 2.6)
      break
    }
    case 'cuoi': case 'cuoi-guong': {
      const r = st.mieng === 'cuoi' ? 12 * rong : 8 * rong
      x.beginPath()
      x.moveTo(cx - r, cy + 1)
      x.quadraticCurveTo(cx, cy - 7, cx + r, cy + 1)
      x.quadraticCurveTo(cx, cy - 15, cx - r, cy + 1)
      x.fillStyle = toi; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.6; x.stroke()
      x.save()
      x.beginPath(); x.moveTo(cx - r, cy + 1); x.quadraticCurveTo(cx, cy - 7, cx + r, cy + 1); x.clip()
      x.fillStyle = M.giay; x.fillRect(cx - r, cy - 5, 2 * r, 5)
      x.restore()
      break
    }
    case 'buon': {
      x.beginPath(); x.moveTo(cx - 9, cy - 1); x.quadraticCurveTo(cx, cy + 5, cx + 9, cy - 1)
      x.strokeStyle = net; x.lineWidth = 2.2; x.lineCap = 'round'; x.stroke()
      break
    }
    case 'run': {
      const pts = []
      for (let i = 0; i < 6; i++) pts.push([cx - 10 + i * 4, i % 2 ? cy + 2 : cy - 1])
      line(x, pts, net, 2.2)
      break
    }
    case 'gam': {
      x.beginPath(); x.ellipse(cx, cy, 8 * rong, 4.4, 0, 0, TAU); x.fillStyle = toi; x.fill()
      x.strokeStyle = net; x.lineWidth = 1.6; x.stroke()
      for (let i = -2; i <= 2; i++) { x.fillStyle = M.giay; x.fillRect(cx + i * 2.8 - 0.8, cy - 3.6, 1.6, 7.2) }
      break
    }
    default: {
      x.beginPath(); x.moveTo(cx - 6, cy); x.quadraticCurveTo(cx, cy - 2.5, cx + 6, cy)
      x.strokeStyle = net; x.lineWidth = 2.2; x.lineCap = 'round'; x.stroke()
    }
  }
}

// Đầu người: nghiêng (mũ trùm nhọn, mặt hướng +x) và chính diện (mũ trùm đối xứng).
// Mũ trùm phủ quanh mặt, viền kem mảnh; tóc mái lộ dưới viền; mắt to tròn cho dễ đọc cảm xúc.
function veDauNguoi(x, st, view, M) {
  if (!view) {
    cat(x, ell(70, 108, 51, 46, 24), M.phu, 141, 1.0, 7, 3.2)                 // mũ trùm sau gáy
    cat(x, [[32, 130], [6, 142], [12, 113], [44, 108]], M.phu, 142, 1.2, 6, 3.0) // đuôi mũ
    cat(x, ell(60, 94, 23, 27, 16), M.toc, 143, 0.9, 6, 2.4)                  // tóc sau
    cat(x, [[78, 26], [104, 26], [102, 56], [80, 56]], M.da, 144, 0.6, 6, 2.2) // cổ
    cat(x, ell(60, 90, 8, 10, 12), M.da, 145, 0.5, 5, 2.2)                    // tai
    cat(x, ell(88, 88, 32, 35, 30), M.da, 146, 0.7, 6, 2.6)                   // mặt
    cat(x, cung(88, 88, 32, 35, 0.45, 2.58, -1, 3.6), M.giay, 148, 0.5, 6, 2.4) // viền mũ
    line(x, [[68, 60], [74, 56], [83, 55]], 'rgba(80,40,30,.16)', 2)
    veMatNguoi(x, st, view, M)
  } else {
    cat(x, [[84, 158], [70, 134], [98, 134]], M.phu, 240, 1.0, 6, 3.0)        // chóp mũ
    cat(x, ell(84, 110, 48, 42, 26), M.phu, 241, 1.0, 7, 3.2)                 // mũ trùm
    cat(x, [[36, 136], [28, 66], [48, 58], [58, 104], [52, 132]], M.phu, 242, 1.0, 6, 3.0)
    cat(x, [[132, 136], [140, 66], [120, 58], [110, 104], [116, 132]], M.phu, 243, 1.0, 6, 3.0)
    cat(x, ell(84, 98, 38, 40, 22), M.toc, 244, 0.9, 6, 2.4)
    cat(x, [[74, 26], [98, 26], [96, 56], [76, 56]], M.da, 245, 0.6, 6, 2.2)
    cat(x, ell(48, 92, 8, 10, 12), M.da, 246, 0.5, 5, 2.2)
    cat(x, ell(120, 92, 8, 10, 12), M.da, 247, 0.5, 5, 2.2)
    cat(x, ell(84, 88, 33, 35, 30), M.da, 248, 0.7, 6, 2.6)
    cat(x, cung(84, 88, 33, 35, 0.3, 2.84, -1, 3.6), M.giay, 250, 0.5, 6, 2.4)
    line(x, [[68, 60], [74, 56], [84, 55], [94, 56], [100, 60]], 'rgba(80,40,30,.16)', 2)
    veMatNguoi(x, st, view, M)
  }
}

// ---------- Đầu sói ----------
function veMatSoi(x, st, view, M) {
  const net = dam(M.long, 0.45)
  const E = view ? [[64, 96], [102, 96]] : [[76, 102], [108, 100]]
  for (let i = 0; i < 2; i++) {
    const ex = E[i][0], ey = E[i][1], rx = view ? 9 : (i ? 9 : 7.5), ry = view ? 7.5 : 8
    x.beginPath(); x.ellipse(ex, ey, rx, ry, 0, 0, TAU); x.fillStyle = M.phu; x.fill()
    x.strokeStyle = net; x.lineWidth = 2; x.stroke()
    if (st.chop || st.mat === 'nham') { line(x, [[ex - rx, ey], [ex + rx, ey]], net, 2.6); continue }
    x.beginPath(); x.ellipse(ex + (view ? 0 : 2), ey, rx * 0.16, ry * 0.72, 0, 0, TAU); x.fillStyle = '#1a1210'; x.fill()
  }
  for (let i = 0; i < 2; i++) {
    const ex = E[i][0], ey = E[i][1], odd = i === 0 ? 1 : -1
    const nang = st.mat === 'gian' || st.mat === 'so' ? 4 : st.mat === 'buon' ? -2 : 0
    line(x, [[ex - odd * 12, ey + 12 + nang], [ex + odd * 9, ey + 9 + nang * 1.6]], net, 3.2)
  }
  if (st.mat === 'so' || st.mat === 'buon') {
    x.beginPath(); x.ellipse(view ? 50 : 68, 86, 7, 5, 0, 0, TAU); x.fillStyle = 'rgba(160,150,160,.35)'; x.fill()
  }
}

function veMiengSoi(x, cx, cy, st, M) {
  const net = dam(M.long, 0.45), toi = '#3a1620'
  if (st.mieng === 'het' || st.mieng === 'o' || st.mieng === 'noi' || st.mat === 'gian') {
    const mo = st.mieng === 'het' || st.mat === 'gian' ? 1 : 0.35 + st.mo / 3 * 0.5
    x.beginPath(); x.ellipse(cx, cy - 2, 12, 7 * mo + 2, 0, 0, TAU); x.fillStyle = toi; x.fill()
    x.strokeStyle = net; x.lineWidth = 2; x.stroke()
    x.beginPath(); x.ellipse(cx, cy + 1, 7, 3.4 * mo, 0, 0, TAU); x.fillStyle = '#e8708a'; x.fill()
    x.fillStyle = M.giay
    for (const sx of [-9, -3, 3, 9]) { x.beginPath(); x.moveTo(cx + sx, cy - 7); x.lineTo(cx + sx + 3.4, cy - 7); x.lineTo(cx + sx + 1.8, cy - 1); x.fill() }
  } else if (st.mieng === 'cuoi' || st.mieng === 'cuoi-guong') {
    x.beginPath(); x.moveTo(cx - 12, cy); x.quadraticCurveTo(cx, cy - 8, cx + 12, cy); x.strokeStyle = net; x.lineWidth = 2.4; x.stroke()
    x.beginPath(); x.ellipse(cx + 2, cy + 2, 5, 6, 0, 0, TAU); x.fillStyle = '#e8708a'; x.fill()
  } else if (st.mieng === 'buon') {
    x.beginPath(); x.moveTo(cx - 9, cy - 2); x.quadraticCurveTo(cx, cy + 5, cx + 9, cy - 2); x.strokeStyle = net; x.lineWidth = 2.4; x.stroke()
  } else {
    line(x, [[cx - 10, cy], [cx + 10, cy - 2]], net, 2.4)
  }
}

function veDauSoi(x, st, view, M) {
  const long = M.long, net = dam(long, 0.45)
  if (!view) {
    cat(x, [[34, 122], [46, 158], [68, 132]], long, 161, 1.4, 6, 3.0)
    cat(x, [[46, 130], [52, 150], [62, 136]], dam(long, 0.28), 162, 0.6, 5, 1.6)
    cat(x, [[96, 134], [112, 158], [126, 122]], long, 163, 1.4, 6, 3.0)
    cat(x, [[102, 135], [110, 150], [120, 132]], dam(long, 0.28), 164, 0.6, 5, 1.6)
    cat(x, ell(82, 98, 42, 40, 26), long, 165, 1.0, 7, 3.2)
    cat(x, ell(60, 58, 38, 27, 20), pha(long, 0.12), 166, 1.2, 7, 3.0)
    cat(x, [[104, 100], [150, 94], [147, 73], [110, 72]], pha(long, 0.22), 167, 0.8, 6, 2.8)
    cat(x, ell(149, 86, 7, 6, 10), dam(long, 0.55), 168, 0.4, 4, 2.0)
    veMatSoi(x, st, view, M)
    veMiengSoi(x, 128, 77, st, M)
  } else {
    cat(x, [[34, 130], [44, 160], [62, 136]], long, 261, 1.4, 6, 3.0)
    cat(x, [[104, 136], [122, 160], [132, 130]], long, 263, 1.4, 6, 3.0)
    cat(x, ell(84, 102, 44, 40, 26), long, 265, 1.0, 7, 3.2)
    cat(x, ell(84, 58, 40, 26, 20), pha(long, 0.12), 266, 1.2, 7, 3.0)
    cat(x, [[62, 96], [106, 96], [100, 70], [68, 70]], pha(long, 0.22), 267, 0.8, 6, 2.8)
    cat(x, ell(84, 74, 8, 6, 10), dam(long, 0.55), 268, 0.4, 4, 2.0)
    veMatSoi(x, st, view, M)
    veMiengSoi(x, 84, 66, st, M)
  }
}

// ---------- Thân, tay, chân ----------
function veThanNguoi(x, L, W, M, view) {
  const w = W / 2 - 3
  const pts = view
    ? [[-18, -34], [-4, -41], [28, -46], [68, -48], [108, -44], [126, -30],
      [126, 30], [108, 44], [68, 48], [28, 46], [-4, 41], [-18, 34]]
    : [[-16, -31], [-2, -37], [24, -41], [60, -42], [100, -38], [120, -30],
      [126, -16], [126, 16], [120, 30], [100, 38], [60, 42], [24, 41], [-2, 37], [-16, 31]]
  cat(x, pts, M.ao, 121, 1.2, 7, 3.4)
  // gấu áo tối hơn
  cat(x, view ? [[-18, -34], [-4, -41], [10, -38], [10, -20], [-8, -18], [-18, -26]]
    : [[-16, -31], [-2, -37], [12, -33], [12, -16], [-8, -15], [-16, -24]], dam(M.ao, 0.16), 126, 0.6, 6, 2.4)
  cat(x, [[2, -w + 2], [16, -w], [16, w], [2, w + 2]], M.quan, 122, 0.8, 6, 2.6)      // thắt lưng
  cat(x, [[L - 22, -w + 5], [L - 2, -w + 9], [L - 2, w - 9], [L - 22, w - 5]], M.phu, 123, 1.0, 6, 2.8) // khăn quàng
  cat(x, view ? [[L - 26, -14], [L - 4, -10], [L - 4, 10], [L - 26, 14]] : [[L - 24, w - 14], [L - 4, w - 8], [L - 4, w - 2], [L - 24, w - 8]], M.giay, 127, 0.6, 6, 2.2) // cổ áo
  // nút thắt khăn
  cat(x, ell(view ? L - 27 : L - 25, view ? 0 : w - 8, 5, 5, 10), M.phu, 128, 0.5, 4, 2)
  const seamY = view ? 0 : 18
  line(x, [[24, seamY], [L - 26, seamY + 2]], M.netSoft, 1.8)
  for (let i = 0; i < 3; i++) cat(x, ell(32 + i * 18, seamY + 7, 2.8, 2.8, 8), M.phu, 130 + i, 0.4, 4, 1.5)
  line(x, [[24, -w + 6], [L - 30, -w + 2]], 'rgba(255,250,235,.35)', 1.6)
  line(x, [[20, w - 8], [L - 34, w - 4]], 'rgba(60,30,20,.18)', 1.6)
  if (view) cat(x, [[L - 34, -w + 8], [L - 20, -w + 8], [L - 20, w - 8], [L - 34, w - 8]], pha(M.ao, 0.12), 135, 0.6, 6, 2.2)
}

function veThanSoi(x, L, W, M, view) {
  const w = W / 2 - 3
  const pts = view
    ? [[-8, -34], [16, -42], [52, -46], [96, -44], [L - 4, -34], [L - 2, 0],
      [L - 4, 34], [96, 44], [52, 46], [16, 42], [-8, 34]]
    : [[-8, -32], [18, -38], [60, -40], [100, -36], [L - 4, -22], [L - 2, 0],
      [L - 4, 22], [100, 36], [60, 40], [18, 38], [-8, 32]]
  cat(x, pts, M.long, 121, 1.8, 7, 3.4)
  // ức lông sáng
  cat(x, view ? [[10, -w + 8], [58, -w + 12], [98, -w + 4], [98, w - 4], [58, w - 8], [10, w - 6]]
    : [[14, -w + 8], [58, -w + 10], [98, -w + 2], [98, w - 2], [58, w - 6], [14, w - 6]], pha(M.long, 0.16), 128, 1.6, 6, 2.6)
  // áo gi-lê phía sau lưng
  cat(x, view ? [[L - 46, -w + 6], [L - 2, -w + 10], [L - 2, -8], [L - 46, -6]]
    : [[L - 40, -w + 6], [L - 2, -w + 12], [L - 2, -4], [L - 40, -8]], M.ao, 124, 0.9, 6, 2.8)
  cat(x, [[L - 22, w - 14], [L - 2, w - 8], [L - 2, w - 2], [L - 22, w - 6]], pha(M.long, 0.3), 125, 0.8, 6, 2.4)
  cat(x, [[2, -w + 2], [16, -w], [16, w], [2, w + 2]], M.quan, 122, 0.8, 6, 2.6)
  cat(x, ell(view ? 9 : 9, 0, 3.2, 3.2, 8), M.phu, 127, 0.3, 4, 1.4)
  for (let i = 0; i < 3; i++) cat(x, ell(24 + i * 20, w - 10, 3, 4, 8), pha(M.long, 0.16), 131 + i, 0.5, 4, 1.4)
  // lông cổ
  for (const sx of [-0.24, 0.0, 0.24]) {
    const cx = L - 10 + sx * 8
    cat(x, [[cx - 5, w - 12], [cx + 5, w - 12], [cx, w - 2]], pha(M.long, 0.22), 140 + sx * 10, 0.5, 4, 1.4)
  }
}

function veDui(x, L, W, M, soi) {
  cat(x, pill(-4, L + 4, 0, W / 2 - 3), soi ? M.long : M.quan, soi ? 171 : 151, soi ? 1.5 : 0.8, 7, 3.2)
  line(x, [[10, -W / 2 + 6], [L - 12, -W / 2 + 7]], M.netSoft, 1.4)
}

function veCang(x, L, W, M, soi, view) {
  if (!soi) {
    cat(x, pill(0, L - 24, 0, W / 2 - 5), M.giay2, 153, 0.8, 7, 2.8)
    if (!view) {
      cat(x, [[L - 34, -W / 2 + 5], [L - 2, -W / 2 + 6], [L + 2, 2], [L - 8, W / 2 - 3], [L - 34, W / 2 - 5]], dam(M.quan, 0.7), 154, 1.0, 6, 2.8)
      cat(x, [[L - 35, -W / 2 + 5], [L - 29, -W / 2 + 5], [L - 29, W / 2 - 5], [L - 35, W / 2 - 5]], M.giay, 156, 0.4, 5, 1.8)
      line(x, [[L - 30, -W / 2 + 9], [L - 2, -W / 2 + 10]], 'rgba(255,250,235,.5)', 1.4)
      line(x, [[L - 26, W / 2 - 9], [L - 6, W / 2 - 8]], 'rgba(255,250,235,.35)', 1.2)
    } else {
      cat(x, ell(L - 6, 0, 11, W / 2 - 2, 16), dam(M.quan, 0.7), 155, 0.8, 6, 2.8)
      line(x, [[L - 14, -4], [L, -4]], M.giay, 1.6)
      cat(x, [[L - 13, -W / 2 + 4], [L - 8, -W / 2 + 4], [L - 8, W / 2 - 4], [L - 13, W / 2 - 4]], M.giay, 157, 0.4, 5, 1.6)
    }
  } else {
    cat(x, pill(0, L - 18, 0, W / 2 - 5), M.long, 173, 1.6, 7, 2.8)
    cat(x, [[L - 20, -W / 2 + 4], [L - 15, -W / 2 + 2], [L - 15, W / 2 - 2], [L - 20, W / 2 - 4]], pha(M.long, 0.18), 177, 0.8, 5, 2.2)
    if (!view) {
      cat(x, [[L - 26, -W / 2 + 3], [L - 2, -W / 2 + 4], [L + 4, 4], [L - 6, W / 2 - 2], [L - 26, W / 2]], dam(M.long, 0.28), 174, 1.2, 6, 2.8)
    } else {
      cat(x, ell(L - 6, 0, 12, W / 2 - 2, 16), dam(M.long, 0.28), 175, 1.0, 6, 2.8)
    }
    for (let i = -1; i <= 1; i++) cat(x, ell(L + 4, i * 4.6, 2.6, 3.8, 8), pha(M.long, 0.28), 178 + i, 0.4, 4, 1.4)
    x.fillStyle = M.giay
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(L + 4, (i - 1) * 4.6 - 1); x.lineTo(L + 9, (i - 1) * 4.6); x.lineTo(L + 4, (i - 1) * 4.6 + 1); x.fill() }
  }
}

function veTayTren(x, L, W, M, soi) {
  cat(x, pill(0, L, 0, W / 2 - 3), soi ? M.long : M.ao, soi ? 181 : 161, soi ? 1.5 : 0.8, 7, 3.0)
  line(x, [[8, -W / 2 + 5], [L - 8, -W / 2 + 6]], M.netSoft, 1.4)
}

function veTayDuoi(x, L, W, M, soi, view) {
  if (!soi) {
    cat(x, pill(0, L - 14, 0, W / 2 - 5), M.ao, 163, 0.8, 7, 2.8)
    cat(x, [[L - 19, -W / 2 + 5], [L - 13, -W / 2 + 5], [L - 13, W / 2 - 5], [L - 19, W / 2 - 5]], M.giay, 164, 0.4, 5, 1.8)
    // găng giấy liền khối, ngón chỉ gợi bằng nét
    cat(x, [[L - 10, -9], [L - 2, -10], [L + 4, -6], [L + 6, 0], [L + 4, 6], [L - 2, 10], [L - 10, 9]], M.da, 166, 0.5, 5, 2.2)
    cat(x, ell(L - 4, 9, 3.6, 4.2, 8), M.da, 171, 0.3, 4, 1.4)
    line(x, [[L + 1, -6], [L + 3, 0], [L + 1, 6]], M.netSoft, 1.2)
    line(x, [[L - 4, -5], [L - 2, 0], [L - 4, 5]], M.netSoft, 1.2)
  } else {
    cat(x, pill(0, L - 12, 0, W / 2 - 5), M.long, 183, 1.6, 7, 2.8)
    cat(x, ell(L - 1, 0, 10, 10.5, 16), dam(M.long, 0.18), 184, 1.0, 6, 2.6)
    for (let i = -1; i <= 1; i++) cat(x, ell(L + 4, i * 5, 3.4, 4, 8), pha(M.long, 0.2), 186 + i, 0.4, 4, 1.6)
    x.fillStyle = M.giay
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(L + 6, (i - 1) * 5 - 1); x.lineTo(L + 10, (i - 1) * 5); x.lineTo(L + 6, (i - 1) * 5 + 1); x.fill() }
  }
}

function veDuoiSoi(x, L, W, M) {
  const tren = [], duoi = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const cx = t * L
    const cy = -6 + Math.sin(t * PI * 1.1) * 16 - t * 4
    const r = 15 * (1 - t) + 5
    tren.push([cx, cy + r]); duoi.push([cx, cy - r])
  }
  cat(x, tren.concat(duoi.reverse()), M.long, 191, 1.6, 8, 3.2)
  cat(x, ell(L - 6, 12, 13, 16, 14), pha(M.long, 0.22), 192, 1.2, 6, 2.8)
}

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const MIN = Math.min(W, H)
  const doc = H > W
  const PXB = 420                                      // tranh vẽ nhân vật: 420 điểm ảnh cho 1 đơn vị
  const Z = kep(H / 300, 1.2, 3.6)                     // độ phân giải tranh nhân vật
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace
  r.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  const FOV = 30 * PI / 180
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.02, 300)
  scene.add(cam)
  const xaOf = m => m.cao / (2 * Math.tan(FOV / 2))
  const REF = { x: 0, y: 1.0, cao: 2.3 }               // khung tham chiếu để đẩy lớp giấy về sau
  const xaRef = REF.cao / (2 * Math.tan(FOV / 2))
  const unit = new THREE.PlaneGeometry(1, 1)

  // ---------- Hạt giấy ----------
  const hatTile = (() => {
    const c = cv(256, 256), x = c.getContext('2d')
    for (let i = 0; i < 2600; i++) {
      const px = bam(i) * 256, py = bam(i + 5e4) * 256
      const lt = bam(i + 9e4) > 0.45
      x.fillStyle = lt ? `rgba(255,250,235,${0.04 + bam(i + 3e4) * 0.10})` : `rgba(40,20,30,${0.03 + bam(i + 7e4) * 0.06})`
      x.fillRect(px, py, 1 + bam(i + 1e4) * 1.4, 1 + bam(i + 2e4) * 1.4)
    }
    for (let i = 0; i < 240; i++) {
      const px = bam(i + 123) * 256, py = bam(i + 456) * 256, a = bam(i + 789) * TAU, l = 3 + bam(i + 321) * 9
      x.strokeStyle = `rgba(255,250,235,${0.06 + bam(i + 654) * 0.09})`; x.lineWidth = 0.8
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke()
    }
    return c
  })()
  const hatPat = cv(1, 1).getContext('2d').createPattern(hatTile, 'repeat')
  const grained = (c, x) => {
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-atop'
    x.fillStyle = hatPat; x.fillRect(0, 0, c.width, c.height)
    x.globalCompositeOperation = 'source-over'
  }
  const tex = c => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy())
    return t
  }

  // ---------- Trời ----------
  {
    const c = cv(512, 512), x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, TROI[0]); g.addColorStop(0.42, TROI[1]); g.addColorStop(0.72, TROI[2]); g.addColorStop(1, TROI[3])
    x.fillStyle = g; x.fillRect(0, 0, 512, 512)
    const rg = x.createRadialGradient(330, 300, 10, 330, 300, 280)
    rg.addColorStop(0, 'rgba(255,214,160,.22)'); rg.addColorStop(0.5, 'rgba(210,150,170,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = rg; x.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 4; i++) {
      const yy = 330 + i * 26
      x.fillStyle = `rgba(255,220,190,${0.035 - i * 0.005})`
      x.beginPath(); x.moveTo(0, yy)
      for (let px = 0; px <= 512; px += 32) x.lineTo(px, yy + Math.sin(px * 0.02 + i) * 6)
      x.lineTo(512, yy + 20); x.lineTo(0, yy + 20); x.fill()
    }
    // mây giấy in vào nền trời (nền bám khung nên mây đứng yên như tranh)
    x.globalAlpha = 0.8
    blob(x, [[94, 172, 28, 20], [120, 160, 34, 24], [148, 172, 26, 18]], '#e8b6ae', 91, 2, 0.6)
    blob(x, [[300, 150, 24, 17], [324, 140, 30, 21], [348, 152, 22, 15]], '#f0c9b4', 92, 2, 0.6)
    x.globalAlpha = 1
    x.globalCompositeOperation = 'source-atop'
    x.fillStyle = hatPat; x.fillRect(0, 0, 512, 512)
    scene.background = tex(c)
  }

  // ---------- Bóng đổ mềm cho lớp giấy ----------
  function themBong(c, dxp, dyp, blur) {
    const o = cv(c.width, c.height), x = o.getContext('2d')
    x.filter = `blur(${Math.max(1, blur)}px)`
    x.drawImage(c, dxp, dyp)
    x.filter = 'none'
    x.globalCompositeOperation = 'source-in'
    x.fillStyle = 'rgba(20,10,32,0.55)'
    x.fillRect(0, 0, o.width, o.height)
    x.globalCompositeOperation = 'source-over'
    x.drawImage(c, 0, 0)
    return o
  }

  // ---------- Lớp cảnh ----------
  function datLop(L, x0 = L.cx, y0 = L.cy) {
    const k = (xaRef + L.d) / xaRef
    L.mesh.position.set(REF.x + (x0 - REF.x) * k, REF.y + (y0 - REF.y) * k, -L.d)
    L.mesh.scale.set(L.w * k, L.h * k, 1)
  }
  function taoLop(o) {
    const P = o.res * (H / 1080)
    const c = cv(o.w * P, o.h * P), x = c.getContext('2d')
    x.setTransform(P, 0, 0, -P, (o.w / 2 - o.cx) * P, (o.h / 2 + o.cy) * P)
    o.ve(x, P)
    grained(c, x)
    const anh = o.bong === false ? c : themBong(c, -0.026 * P, 0.036 * P, Math.max(1.6, 0.02 * P))
    const mesh = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: tex(anh), transparent: true, depthWrite: false, depthTest: false }))
    mesh.renderOrder = o.tt
    mesh.frustumCulled = false
    scene.add(mesh)
    const L = { mesh, w: o.w, h: o.h, cx: o.cx, cy: o.cy, d: o.d }
    datLop(L)
    return L
  }

  const veDoi = (mau, seed, top) => (x) => {
    const pts = []
    for (let xx = -4.8; xx <= 4.8; xx += 0.22) pts.push([xx, top + 0.05 * Math.sin(xx * 1.25 + seed) + 0.025 * Math.sin(xx * 3.1 + seed * 2)])
    pts.push([4.9, -1.6], [-4.9, -1.6])
    cat(x, pts, mau, seed, 0.008, 0.25, 0.010)
    line(x, [[-4.4, top - 0.12], [-1.2, top - 0.2], [2.1, top - 0.16]], 'rgba(255,250,235,.12)', 0.010)
  }
  taoLop({ w: 8.8, h: 2.2, cx: 0, cy: 0.5, d: 5.4, res: 300, tt: 2, bong: 10, ve: veDoi(DOI[0], 3, 0.66) })
  taoLop({ w: 8.8, h: 2.2, cx: 0, cy: 0.32, d: 4.5, res: 320, tt: 3, bong: 9, ve: veDoi(DOI[1], 11, 0.5) })

  taoLop({
    w: 8.8, h: 1.9, cx: 0, cy: 0.4, d: 3.6, res: 340, tt: 4, bong: 9,
    ve: (x) => {
      for (let i = 0; i < 24; i++) {
        const cx = -4.4 + i * 0.38 + bam(i + 21) * 0.12
        const base = 0.26 + bam(i + 31) * 0.06
        const h = 0.42 + bam(i + 41) * 0.5
        const wid = 0.18 + bam(i + 51) * 0.1
        cat(x, [[cx - 0.012, base], [cx + 0.012, base], [cx + 0.01, base + h * 0.2], [cx - 0.01, base + h * 0.2]], '#4a2f2a', 200 + i, 0.004, 0.2, 0.006)
        for (let t = 0; t < 4; t++) {
          const yb = base + h * (0.1 + 0.2 * t), yt = yb + h * 0.36, ww = wid * (1 - t * 0.19)
          cat(x, [[cx - ww / 2, yb], [cx + ww / 2, yb], [cx, yt]], t % 2 ? RUNG[0] : RUNG[1], 240 + i * 7 + t, 0.005, 0.18, 0.007)
        }
      }
    },
  })

  // Nhà tranh bên trái
  const nhaX = -2.28
  taoLop({
    w: 1.12, h: 1.0, cx: nhaX, cy: 0.4, d: 2.7, res: 560, tt: 5, bong: 8,
    ve: (x) => {
      const X = nhaX
      cat(x, [[X - 0.32, 0.0], [X + 0.32, 0.0], [X + 0.32, 0.44], [X - 0.32, 0.44]], NHA.tuong, 301, 0.006, 0.18, 0.008)
      cat(x, [[X - 0.42, 0.42], [X, 0.76], [X + 0.42, 0.42]], NHA.mai, 302, 0.008, 0.15, 0.009)
      cat(x, [[X + 0.16, 0.5], [X + 0.27, 0.5], [X + 0.27, 0.68], [X + 0.16, 0.68]], '#7d4a3c', 303, 0.004, 0.12, 0.006)
      cat(x, [[X - 0.03, 0.0], [X + 0.11, 0.0], [X + 0.11, 0.36], [X - 0.03, 0.36]], '#6a4530', 304, 0.004, 0.12, 0.006)
      cat(x, [[X - 0.26, 0.17], [X - 0.12, 0.17], [X - 0.12, 0.33], [X - 0.26, 0.33]], NHA.cua, 305, 0.004, 0.12, 0.005)
      cat(x, [[X + 0.14, 0.17], [X + 0.27, 0.17], [X + 0.27, 0.33], [X + 0.14, 0.33]], NHA.cua, 306, 0.004, 0.12, 0.005)
      line(x, [[X - 0.22, 0.18], [X - 0.22, 0.32]], 'rgba(120,70,40,.6)', 0.006)
      line(x, [[X - 0.16, 0.18], [X - 0.16, 0.32]], 'rgba(120,70,40,.6)', 0.006)
    },
  })
  // Cửa sổ ấm (sáng nhấp nháy)
  const cuaGlow = (() => {
    const c = cv(128, 128), x = c.getContext('2d')
    const g = x.createRadialGradient(64, 64, 2, 64, 64, 62)
    g.addColorStop(0, 'rgba(255,205,110,.8)'); g.addColorStop(0.45, 'rgba(255,180,90,.32)'); g.addColorStop(1, 'rgba(255,180,90,0)')
    x.fillStyle = g; x.fillRect(0, 0, 128, 128)
    const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))
    m.renderOrder = 6
    m.frustumCulled = false
    scene.add(m)
    return { m, x: nhaX - 0.19, y: 0.25, d: 2.65 }
  })()
  const datDiem = (o) => {
    const k = (xaRef + o.d) / xaRef
    o.m.position.set(REF.x + (o.x - REF.x) * k, REF.y + (o.y - REF.y) * k, -o.d)
    o.m.scale.set(o.w * k, o.w * k, 1)
  }
  datDiem({ m: cuaGlow.m, x: cuaGlow.x, y: cuaGlow.y, d: cuaGlow.d, w: 0.55 })
  // khói ấm từ ống khói
  const khoi = (() => {
    const c = cv(96, 96), x = c.getContext('2d')
    const g = x.createRadialGradient(48, 48, 4, 48, 48, 46)
    g.addColorStop(0, 'rgba(238,232,238,.85)'); g.addColorStop(0.55, 'rgba(224,216,232,.32)'); g.addColorStop(1, 'rgba(224,216,232,0)')
    x.fillStyle = g; x.fillRect(0, 0, 96, 96)
    const t = tex(c)
    const ds = []
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }))
      m.renderOrder = 6
      m.frustumCulled = false
      scene.add(m)
      ds.push(m)
    }
    return ds
  })()
  const datDiemD = (mesh, x0, y0, d, w) => {
    const k = (xaRef + d) / xaRef
    mesh.position.set(REF.x + (x0 - REF.x) * k, REF.y + (y0 - REF.y) * k, -d)
    mesh.scale.set(w * k, w * k, 1)
  }

  // Cây lớn bên phải
  taoLop({
    w: 1.5, h: 2.2, cx: 2.24, cy: 0.85, d: 2.5, res: 480, tt: 7, bong: 9,
    ve: (x) => {
      const X = 2.24
      const cay = (cx, base, h, wid, seed) => {
        cat(x, [[cx - 0.03, base], [cx + 0.03, base], [cx + 0.02, base + h * 0.22], [cx - 0.02, base + h * 0.22]], '#4a2f2a', seed, 0.006, 0.15, 0.008)
        for (let t = 0; t < 5; t++) {
          const yb = base + h * (0.12 + 0.17 * t), yt = yb + h * 0.34, ww = wid * (1 - t * 0.16)
          cat(x, [[cx - ww / 2, yb], [cx + ww / 2, yb], [cx, yt]], t % 2 ? '#16302a' : '#1d3b33', seed + t, 0.008, 0.14, 0.009)
        }
      }
      cay(X - 0.26, 0.0, 1.55, 0.55, 401)
      cay(X + 0.26, 0.0, 1.25, 0.45, 421)
    },
  })

  // Bụi cây bên trái
  taoLop({
    w: 0.9, h: 0.62, cx: -1.42, cy: 0.2, d: 1.7, res: 460, tt: 8, bong: 7,
    ve: (x) => {
      const X = -1.42
      blob(x, [[X - 0.2, 0.1, 0.17, 0.12], [X + 0.02, 0.18, 0.2, 0.15], [X + 0.24, 0.12, 0.16, 0.11]], '#1f4c2c', 441, 0.007, 0.006)
      blob(x, [[X - 0.04, 0.12, 0.12, 0.08], [X + 0.18, 0.1, 0.1, 0.07]], '#2f6a3c', 442, 0.007, 0.005)
      blob(x, [[X - 0.06, 0.22, 0.1, 0.06], [X + 0.14, 0.24, 0.1, 0.05]], '#4c9a56', 443, 0.006, 0.005)
    },
  })

  // Đất, hoa, cỏ
  // Đất nằm sát mặt phẳng diễn (d rất nhỏ) để chân nhân vật luôn chạm cỏ, không lơ lửng.
  taoLop({
    w: 8.8, h: 1.7, cx: 0, cy: -0.66, d: 0.05, res: 400, tt: 9, bong: 8,
    ve: (x) => {
      const lop = (base, amp, mau, seed) => {
        const pts = []
        for (let xx = -4.6; xx <= 4.6; xx += 0.2) pts.push([xx, base + amp * Math.sin(xx * 1.1 + seed) + amp * 0.4 * Math.sin(xx * 2.7 + seed * 2)])
        pts.push([4.7, -1.8], [-4.7, -1.8])
        cat(x, pts, mau, seed, 0.008, 0.22, 0.010)
      }
      lop(0.055, 0.012, DAT[0], 31)
      lop(-0.18, 0.02, DAT[1], 47)
      lop(-0.46, 0.02, DAT[2], 53)
      // lối mòn uốn về nhà bên trái
      const trai = [], phai = []
      for (let i = 0; i <= 14; i++) {
        const t = i / 14
        const cx = tron(0.42, -2.26, t)
        const cy = tron(-0.36, 0.03, t) + 0.03 * Math.sin(t * 4.2)
        const rong = 0.16 - 0.05 * t
        trai.push([cx - rong, cy]); phai.push([cx + rong, cy])
      }
      cat(x, trai.concat(phai.reverse()), '#c9a06c', 71, 0.006, 0.18, 0.009)
      for (let i = 0; i < 9; i++) {
        const t = bam(i + 610)
        const cx = tron(0.3, -2.15, t) + (bam(i + 620) - 0.5) * 0.1
        const cy = tron(-0.32, 0.03, t)
        cat(x, ell(cx, cy, 0.018, 0.012, 8), '#b08c60', i + 630, 0.003, 0.1, 0.005)
      }
      // hàng rào bên trái
      for (let i = 0; i < 4; i++) {
        const fx = -3.55 + i * 0.3
        cat(x, [[fx - 0.022, 0.02], [fx + 0.022, 0.02], [fx + 0.022, 0.26], [fx - 0.022, 0.26]], '#6a4530', 640 + i, 0.004, 0.12, 0.006)
      }
      line(x, [[-3.6, 0.1], [-2.6, 0.11]], '#7d5a40', 0.016)
      line(x, [[-3.6, 0.2], [-2.6, 0.21]], '#7d5a40', 0.016)
      // hoa và cỏ
      for (let i = 0; i < 34; i++) {
        const fx = -4.2 + bam(i + 300) * 8.4
        const fy = 0.02 + bam(i + 340) * 0.06
        const cao = 0.06 + bam(i + 360) * 0.13
        line(x, [[fx, fy], [fx + 0.02 * (bam(i + 380) - 0.5), fy + cao]], '#2c5a2a', 0.006)
        const mau = ['#f4a7b9', '#fff3d6', '#ffd24f', '#c9a7f0'][(bam(i + 400) * 4) | 0]
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU
          cat(x, ell(fx + Math.cos(a) * 0.022, fy + cao + Math.sin(a) * 0.022, 0.018, 0.016, 8), mau, i * 9 + k, 0.003, 0.1, 0.005)
        }
        cat(x, ell(fx, fy + cao, 0.012, 0.012, 8), '#d98a2a', i + 700, 0.002, 0.1, 0.004)
      }
    },
  })

  // Cỏ tiền cảnh hai góc
  taoLop({
    w: 8.8, h: 0.55, cx: 0, cy: 0.12, d: -0.28, res: 460, tt: 55, bong: false,
    ve: (x) => {
      for (const goc of [-2.7, 2.6]) {
        for (let i = 0; i < 9; i++) {
          const bx = goc + (bam(i + 500) - 0.5) * 0.38
          const cao = 0.1 + bam(i + 520) * 0.16
          const ngang = (bam(i + 540) - 0.5) * 0.12
          cat(x, [[bx - 0.02, -0.12], [bx + 0.02, -0.12], [bx + ngang, cao], [bx + ngang * 0.5 + 0.015, cao * 0.8]], '#183524', 550 + i, 0.005, 0.1, 0.006)
        }
      }
    },
  })

  // ---------- Trăng, sao, mây: như vật ở xa vô cực, giữ chỗ trên khung ----------
  // Vật ở xa vô cực: giữ nguyên cỡ trên khung dù máy lại gần (trăng, sao, mây).
  function datXa(mesh, fx, fy, d, w0, h0) {
    const xa = xaOf(m), k = (xa + d) / xaRef
    mesh.position.set(m.tam[0] + fx * m.cao * W / H * (xa + d) / xa, m.tam[1] + fy * m.cao * (xa + d) / xa, -d)
    mesh.scale.set(w0 * k, h0 * k, 1)
  }
  function taoAnh(c, w0, h0, tt, add = false) {
    const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({
      map: tex(c), transparent: true, depthWrite: false, depthTest: false,
      blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
    }))
    m.scale.set(w0, h0, 1)
    m.renderOrder = tt
    m.frustumCulled = false
    scene.add(m)
    return m
  }
  const moon = (() => {
    const c = cv(256, 256), x = c.getContext('2d')
    cat(x, ell(128, 128, 92, 92, 44), giayC, 5, 1.2, 8, 4)
    cat(x, ell(98, 100, 17, 15, 14), giayC2, 6, 0.6, 5, 2)
    cat(x, ell(158, 140, 23, 21, 14), giayC2, 7, 0.6, 5, 2)
    cat(x, ell(146, 76, 10, 9, 10), giayC2, 8, 0.5, 4, 1.6)
    grained(c, x)
    return taoAnh(c, 0.56, 0.56, 1)
  })()
  const moonGlow = (() => {
    const c = cv(256, 256), x = c.getContext('2d')
    const g = x.createRadialGradient(128, 128, 6, 128, 128, 126)
    g.addColorStop(0, 'rgba(255,235,170,.45)'); g.addColorStop(0.4, 'rgba(255,225,160,.16)'); g.addColorStop(1, 'rgba(255,225,160,0)')
    x.fillStyle = g; x.fillRect(0, 0, 256, 256)
    return taoAnh(c, 1.5, 1.5, 1, true)
  })()
  const stars = []
  {
    const c = cv(48, 48), x = c.getContext('2d')
    const p = []
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - PI / 2, rr = i % 2 ? 6 : 19; p.push([24 + Math.cos(a) * rr, 24 + Math.sin(a) * rr]) }
    cat(x, p, '#fbeeb0', 3, 0.4, 5, 1.6)
    grained(c, x)
    for (let i = 0; i < 14; i++) {
      const m = taoAnh(c, 0.05, 0.05, 1)
      stars.push({ m, fx: 0.05 + bam(i + 601) * 0.4, fy: 0.12 + bam(i + 631) * 0.3, to: 0.7 + bam(i + 661) * 0.7, ph: bam(i + 691) * TAU })
    }
  }
  // (mây in vào nền trời)

  // ---------- Khuôn mảnh giấy nhân vật ----------
  const lamManh = ({ L0, W: Wd, veS, veF }) => {
    const M = 16
    const bw = L0 + 2 * M, bh = Wd + 2 * M
    const lam = fn => {
      const c = cv(bw * Z, bh * Z), x = c.getContext('2d')
      x.setTransform(Z, 0, 0, -Z, M * Z, (bh / 2) * Z)
      fn(x, L0, Wd)
      grained(c, x)
      return tex(c)
    }
    const ts = [lam(veS), veF ? lam(veF) : null]
    if (!ts[1]) ts[1] = ts[0]
    return { ts, L0 }
  }
  const datManh = (o, A, B, huong, fwd, widthMul, view) => {
    const dxp = B[0] - A[0], dyp = B[1] - A[1]
    const len = Math.hypot(dxp, dyp) || 1e-5
    o.g.position.set(A[0], A[1], 0)
    o.g.rotation.z = Math.atan2(dyp, dxp)
    o.g.scale.set(len / (o.L0 / PXB), fwd * huong * widthMul, 1)
    o.mesh.material.map = o.ts[view]
  }
  function taoManhDat(anh, thuTu) {
    const mesh = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: anh.ts[0], transparent: true, depthWrite: false, depthTest: false }))
    mesh.scale.set((anh.L0 + 32) / PXB, (anh.W + 32) / PXB, 1)
    mesh.position.set(anh.L0 / 2 / PXB, 0, 0)
    mesh.renderOrder = thuTu
    mesh.frustumCulled = false
    const g = new THREE.Group()
    g.add(mesh); scene.add(g)
    return { g, mesh, ts: anh.ts, L0: anh.L0, dat: (A, B, huong, fwd, widthMul, view) => datManh({ g, mesh, ts: anh.ts, L0: anh.L0 }, A, B, huong, fwd, widthMul, view) }
  }

  function taoDau({ ve, cache }) {
    const c = cv(168 * Z, 168 * Z)
    const mesh = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false }))
    mesh.scale.set(168 / PXB, 168 / PXB, 1)
    mesh.frustumCulled = false
    const g = new THREE.Group()
    g.add(mesh); scene.add(g)
    const lay = (st, view) => {
      const key = `${view}|${st.mat}|${st.mieng}|${st.chop ? 1 : 0}|${st.longMay}|${st.mo}|${st.nhin}`
      let t = cache.get(key)
      if (t) return t
      const cc = cv(168 * Z, 168 * Z), xx = cc.getContext('2d')
      xx.setTransform(Z, 0, 0, -Z, 0, 168 * Z)
      ve(xx, st, view)
      grained(cc, xx)
      t = tex(cc)
      if (cache.size > 64) {
        const k0 = cache.keys().next().value
        cache.get(k0).dispose()
        cache.delete(k0)
      }
      cache.set(key, t)
      return t
    }
    return { g, mesh, lay }
  }

  function taoNguoi(nv, ten) {
    const M = layMau(nv)
    const soi = nv.dang === 'thu'
    const base = ten === 'phu' ? 25 : 40
    const cache = new Map()
    const anh = {}
    const mk = (khoa, L0, Wd, veS, veF) => {
      anh[khoa] = lamManh({
        L0, W: Wd,
        veS: (x, L, Ww) => veS(x, L, Ww, M),
        veF: veF ? (x, L, Ww) => veF(x, L, Ww, M) : null,
      })
      anh[khoa].W = Wd
    }
    if (!soi) {
      mk('dui', 103, 36, (x, L, Ww, m) => veDui(x, L, Ww, m, false))
      mk('cang', 99, 40, (x, L, Ww, m) => veCang(x, L, Ww, m, false, 0), (x, L, Ww, m) => veCang(x, L, Ww, m, false, 1))
      mk('tayTren', 71, 30, (x, L, Ww, m) => veTayTren(x, L, Ww, m, false))
      mk('tayDuoi', 67, 34, (x, L, Ww, m) => veTayDuoi(x, L, Ww, m, false, 0), (x, L, Ww, m) => veTayDuoi(x, L, Ww, m, false, 1))
      mk('than', 126, 100, (x, L, Ww, m) => veThanNguoi(x, L, Ww, m, 0), (x, L, Ww, m) => veThanNguoi(x, L, Ww, m, 1))
    } else {
      mk('dui', 103, 38, (x, L, Ww, m) => veDui(x, L, Ww, m, true))
      mk('cang', 99, 42, (x, L, Ww, m) => veCang(x, L, Ww, m, true, 0), (x, L, Ww, m) => veCang(x, L, Ww, m, true, 1))
      mk('tayTren', 71, 32, (x, L, Ww, m) => veTayTren(x, L, Ww, m, true))
      mk('tayDuoi', 67, 36, (x, L, Ww, m) => veTayDuoi(x, L, Ww, m, true, 0), (x, L, Ww, m) => veTayDuoi(x, L, Ww, m, true, 1))
      mk('than', 126, 104, (x, L, Ww, m) => veThanSoi(x, L, Ww, m, 0), (x, L, Ww, m) => veThanSoi(x, L, Ww, m, 1))
      mk('duoi', 150, 80, (x, L, Ww, m) => veDuoiSoi(x, L, Ww, m))
    }
    const D = {
      than: taoManhDat(anh.than, base + 5),
      duiT: taoManhDat(anh.dui, base + 0),
      cangT: taoManhDat(anh.cang, base + 1),
      tayTrenT: taoManhDat(anh.tayTren, base + 3),
      tayDuoiT: taoManhDat(anh.tayDuoi, base + 4),
      duiP: taoManhDat(anh.dui, base + 6),
      cangP: taoManhDat(anh.cang, base + 7),
      tayTrenP: taoManhDat(anh.tayTren, base + 9),
      tayDuoiP: taoManhDat(anh.tayDuoi, base + 10),
      duoi: soi ? taoManhDat(anh.duoi, base + 2) : null,
    }
    const dau = taoDau({ ve: (x, st, view) => (soi ? veDauSoi : veDauNguoi)(x, st, view, M), cache })
    dau.mesh.renderOrder = base + 8
    // bóng mềm của đầu trên vai
    const dsh = (() => {
      const c = cv(128, 64), x = c.getContext('2d')
      const g = x.createRadialGradient(64, 32, 2, 64, 32, 60)
      g.addColorStop(0, 'rgba(30,16,26,.42)'); g.addColorStop(1, 'rgba(30,16,26,0)')
      x.fillStyle = g; x.beginPath(); x.ellipse(64, 32, 62, 26, 0, 0, TAU); x.fill()
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }))
      m.renderOrder = base + 7
      m.frustumCulled = false
      scene.add(m)
      return m
    })()
    const sh = (() => {
      const c = cv(128, 64), x = c.getContext('2d')
      const g = x.createRadialGradient(64, 32, 2, 64, 32, 60)
      g.addColorStop(0, 'rgba(10,6,20,.5)'); g.addColorStop(1, 'rgba(10,6,20,0)')
      x.fillStyle = g; x.beginPath(); x.ellipse(64, 32, 62, 26, 0, 0, TAU); x.fill()
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }))
      m.renderOrder = base - 1
      m.frustumCulled = false
      scene.add(m)
      return m
    })()
    const pinTex = (() => {
      const c = cv(64, 64), x = c.getContext('2d')
      const g = x.createRadialGradient(26, 24, 2, 32, 32, 26)
      g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#d3a43a'); g.addColorStop(1, '#7a5a1e')
      x.fillStyle = g; x.beginPath(); x.arc(32, 32, 24, 0, TAU); x.fill()
      x.strokeStyle = 'rgba(40,20,10,.55)'; x.lineWidth = 3; x.stroke()
      return tex(c)
    })()
    const pins = []
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: pinTex, transparent: true, depthWrite: false, depthTest: false }))
      m.scale.set(0.028, 0.028, 1)
      m.renderOrder = base + 11
      m.frustumCulled = false
      scene.add(m)
      pins.push(m)
    }
    const ds = [sh, dsh, dau.g, ...Object.values(D).filter(Boolean).map(o => o.g), ...pins]
    return {
      dat(p, k) {
        const huong = k.huong, cd = k.chinhDien
        const view = cd > 0.5 ? 1 : 0
        const sq = cd < 0.5 ? 1 - 0.52 * (cd / 0.5) : 0.48 + 0.52 * ((cd - 0.5) / 0.5)
        const wTay = 1 + 0.22 * cd, wChan = 1 + 0.08 * cd
        const st = { mat: p.mat, mieng: p.mieng, chop: p.chop, longMay: p.longMay, mo: Math.round(p.mieng_mo * 3), nhin: Math.round(p.nhin * 2) }
        if (D.duoi) {
          D.duoi.g.position.set(k.hong[0], k.hong[1], 0)
          D.duoi.g.rotation.z = (huong > 0 ? PI + 0.3 : -0.3) + 0.14 * Math.sin(p.t * 5)
          D.duoi.g.scale.set(1, huong, 1)
          D.duoi.mesh.material.map = anh.duoi.ts[0]
        }
        D.than.dat(k.hong, k.coGoc, huong, -1, sq, view)
        D.duiT.dat(k.hongT, k.goiT, huong, 1, wChan, view)
        D.cangT.dat(k.goiT, k.coChanT, huong, 1, wChan, view)
        D.tayTrenT.dat(k.vaiT, k.khuyuT, huong, 1, wTay, view)
        D.tayDuoiT.dat(k.khuyuT, k.banT, huong, 1, wTay, view)
        D.duiP.dat(k.hongP, k.goiP, huong, 1, wChan, view)
        D.cangP.dat(k.goiP, k.coChanP, huong, 1, wChan, view)
        D.tayTrenP.dat(k.vaiP, k.khuyuP, huong, 1, wTay, view)
        D.tayDuoiP.dat(k.khuyuP, k.banP, huong, 1, wTay, view)
        dau.g.position.set(k.dau[0], k.dau[1] - 0.02, 0)
        dau.g.rotation.z = -k.gocDau * huong
        dau.g.scale.set(huong * sq, 1, 1)
        dau.mesh.material.map = dau.lay(st, view)
        dsh.position.set(k.dau[0] - 0.03, k.dau[1] - 0.12, 0)
        dsh.scale.set(0.24, 0.1, 1)
        dsh.material.opacity = 0.8
        const sb = 1 / (1 + p.bay * 2.4)
        sh.position.set(p.x, 0.008, 0)
        sh.scale.set(0.74 * sb, 0.24 * sb, 1)
        sh.material.opacity = 0.95 * sb
        const J = [k.hong, k.vaiP, k.vaiT, k.khuyuP, k.khuyuT, k.goiP, k.goiT]
        J.forEach((pt, i) => pins[i].position.set(pt[0], pt[1], 0))
      },
      an(v) { for (const o of ds) o.visible = v },
    }
  }

  const nvChinh = taoNguoi(kb.nhan_vat || pc.nhan_vat || {}, 'chinh')
  const nvPhu = kb.nhan_vat_phu ? taoNguoi(kb.nhan_vat_phu, 'phu') : null

  // ---------- Sói sau bụi (thứ lạ) ----------
  const soiGoi = (() => {
    const SW = 480 * kep(H / 1080, 0.6, 1.4)
    const S = SW / 420
    const c = cv(420 * S, 400 * S), x = c.getContext('2d')
    x.setTransform(S, 0, 0, S, 0, 0)                    // vẽ theo toạ độ tranh 420x400, y hướng xuống
    const fur = '#6d7280', fur2 = '#878e9a', net = '#241a2c'
    // vai và ức (bị bụi che)
    cat(x, ell(210, 380, 180, 80, 26), fur, 60, 6, 12, 4)
    // tai
    cat(x, [[40, 200], [88, 26], [158, 128]], fur, 61, 1.8, 8, 4)
    cat(x, [[62, 170], [90, 70], [128, 124]], '#b08a92', 62, 0.8, 6, 2)
    cat(x, [[300, 128], [370, 26], [410, 200]], fur, 63, 1.8, 8, 4)
    cat(x, [[330, 124], [368, 70], [390, 170]], '#b08a92', 64, 0.8, 6, 2)
    // đầu
    cat(x, ell(222, 218, 140, 106, 34), fur, 65, 8, 14, 5)
    cat(x, [[118, 208], [66, 240], [108, 272], [150, 250]], fur2, 66, 3, 8, 3)
    cat(x, [[312, 228], [362, 250], [330, 282], [300, 256]], fur2, 67, 3, 8, 3)
    // mõm dài chếch xuống trái
    cat(x, [[152, 246], [36, 298], [66, 344], [172, 350], [238, 318], [242, 254]], fur2, 68, 3, 9, 4)
    cat(x, ell(42, 298, 24, 17, 14), '#241a2c', 69, 1, 6, 2)
    // miệng và răng
    x.strokeStyle = net; x.lineWidth = 5; x.lineCap = 'round'
    x.beginPath(); x.moveTo(58, 318); x.quadraticCurveTo(142, 352, 232, 318); x.stroke()
    x.fillStyle = '#fff6e4'
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(88 + i * 34, 306); x.lineTo(104 + i * 34, 306); x.lineTo(96 + i * 34, 330); x.fill() }
    // mắt: mí trên nặng, con ngươi khe
    const eye = (ex, ey) => {
      x.save()
      x.beginPath(); x.ellipse(ex, ey, 30, 19, -0.12, 0, TAU); x.clip()
      x.fillStyle = '#f2cf4a'; x.fillRect(ex - 34, ey - 24, 68, 48)
      x.fillStyle = '#1a1220'; x.beginPath(); x.ellipse(ex + 4, ey + 1, 5, 13, 0, 0, TAU); x.fill()
      x.fillStyle = 'rgba(255,250,235,.85)'; x.beginPath(); x.arc(ex - 2, ey - 4, 3, 0, TAU); x.fill()
      x.restore()
      x.strokeStyle = net; x.lineWidth = 3.4
      x.beginPath(); x.ellipse(ex, ey, 30, 19, -0.12, 0, TAU); x.stroke()
    }
    eye(150, 205); eye(272, 198)
    x.fillStyle = fur
    x.beginPath(); x.moveTo(112, 186); x.quadraticCurveTo(150, 200, 196, 190); x.lineTo(196, 170); x.lineTo(112, 164); x.fill()
    x.beginPath(); x.moveTo(232, 188); x.quadraticCurveTo(276, 198, 312, 184); x.lineTo(312, 160); x.lineTo(232, 166); x.fill()
    x.strokeStyle = '#3e424e'; x.lineWidth = 12; x.lineCap = 'round'
    x.beginPath(); x.moveTo(112, 172); x.lineTo(188, 192); x.moveTo(226, 188); x.lineTo(306, 166); x.stroke()
    x.strokeStyle = net; x.lineWidth = 2.4
    for (let i = 0; i < 3; i++) {
      x.beginPath(); x.moveTo(66 + i * 8, 300); x.lineTo(30 + i * 10, 286 + i * 8); x.stroke()
      x.beginPath(); x.moveTo(130, 258 + i * 4); x.lineTo(158, 240 + i * 6); x.stroke()
    }
    grained(c, x)
    const mesh = taoAnh(c, 1.0, 400 / 420, 16)
    mesh.visible = false
    const eyeTex = (() => {
      const cc = cv(64, 64), xx = cc.getContext('2d')
      const g = xx.createRadialGradient(32, 32, 2, 32, 32, 31)
      g.addColorStop(0, 'rgba(255,226,120,.85)'); g.addColorStop(1, 'rgba(255,200,80,0)')
      xx.fillStyle = g; xx.fillRect(0, 0, 64, 64)
      return tex(cc)
    })()
    const mat1 = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))
    const mat2 = mat1.clone()
    for (const o of [mat1, mat2]) { o.scale.set(0.08, 0.08, 1); o.renderOrder = 18; o.frustumCulled = false; o.visible = false; scene.add(o) }
    // bụi che 1,15 x 0,41 đơn vị, tranh bụi phủ kín khung để luôn che chân sói
    const S2 = (1.15 * SW) / 420
    const cb = cv(420 * S2, 150 * S2), bx = cb.getContext('2d')
    bx.setTransform(S2, 0, 0, S2, 0, 0)
    blob(bx, [[64, 112, 70, 46], [164, 82, 82, 54], [284, 86, 86, 56], [376, 114, 64, 42], [214, 122, 80, 48]], '#1f4c2c', 81, 5, 3)
    blob(bx, [[120, 112, 48], [280, 106, 52], [366, 118, 40]], '#2f6a3c', 82, 5, 2)
    blob(bx, [[120, 58, 34], [250, 48, 38], [368, 68, 30]], '#4c9a56', 83, 4, 1.6)
    for (let i = 0; i < 5; i++) cat(bx, ell(96 + i * 58, 94 + (i % 2) * 16, 8, 7, 8), '#f4d8e0', 84 + i, 0.6, 4, 1.4)
    grained(cb, bx)
    const bui = taoAnh(cb, 1.15, 0.41, 19)
    bui.visible = false
    // gò đất nhỏ cho sói đứng
    const S3 = (1.5 * SW) / 420
    const cm = cv(420 * S3, 150 * S3), mx = cm.getContext('2d')
    mx.setTransform(S3, 0, 0, S3, 0, 0)
    cat(mx, [[-20, 160], [30, 92], [130, 58], [250, 50], [350, 66], [440, 122], [450, 180], [-20, 180]], '#24493f', 85, 6, 10, 4)
    cat(mx, [[10, 160], [120, 96], [260, 88], [420, 140], [420, 180], [10, 180]], '#2f6a68', 86, 6, 10, 3)
    grained(cm, mx)
    const go = taoAnh(cm, 1.5, 0.32, 17)
    go.visible = false
    return { ds: [go, mesh, mat1, mat2, bui], mesh, mat1, mat2, bui, go }
  })()

  // ---------- Bụi giấy bay ----------
  const bot = []
  {
    const c = cv(32, 32), x = c.getContext('2d')
    const g = x.createRadialGradient(16, 16, 1, 16, 16, 15)
    g.addColorStop(0, 'rgba(255,246,220,.9)'); g.addColorStop(0.5, 'rgba(255,238,200,.4)'); g.addColorStop(1, 'rgba(255,238,200,0)')
    x.fillStyle = g; x.fillRect(0, 0, 32, 32)
    const t = tex(c)
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, opacity: 0.35 + bam(i + 800) * 0.35 }))
      m.renderOrder = bam(i + 840) > 0.5 ? 60 : 18
      m.frustumCulled = false
      scene.add(m)
      bot.push({ m, fx: bam(i + 860) - 0.5, fy: bam(i + 880) * 0.9 - 0.45, z: -1.4 + bam(i + 900) * 2.0, to: 2 + bam(i + 920) * 5, ph: bam(i + 940) * TAU })
    }
  }

  // ---------- Lớp phủ: viền tối, hạt giấy, dải tối cho phụ đề ----------
  {
    const ow = doc ? Math.round(MIN * 1.9 * W / H) : Math.round(MIN * 1.9)
    const oh = doc ? Math.round(MIN * 1.9) : Math.round(MIN * 1.9 * H / W)
    const c = cv(ow, oh), x = c.getContext('2d')
    const g = x.createRadialGradient(ow / 2, oh * 0.46, MIN * 0.4, ow / 2, oh * 0.5, Math.max(ow, oh) * 0.72)
    g.addColorStop(0, 'rgba(16,8,26,0)'); g.addColorStop(1, 'rgba(16,8,26,.42)')
    x.fillStyle = g; x.fillRect(0, 0, ow, oh)
    const band = (y0, y1, a) => {
      const gg = x.createLinearGradient(0, y0, 0, y1)
      gg.addColorStop(0, 'rgba(10,7,20,0)'); gg.addColorStop(1, `rgba(10,7,20,${a})`)
      x.fillStyle = gg; x.fillRect(0, Math.min(y0, y1), ow, Math.abs(y1 - y0))
    }
    if (doc) { band(oh * 0.3, 0, 0.3); band(oh * 0.88, oh, 0.28) } else { band(oh * 0.7, oh, 0.34); band(0, oh * 0.1, 0.2) }
    for (let i = 0; i < 5200; i++) {
      const px = bam(i + 1000) * ow, py = bam(i + 2000) * oh
      const lt = bam(i + 3000) > 0.5
      x.fillStyle = lt ? `rgba(255,248,232,${0.012 + bam(i + 4000) * 0.032})` : `rgba(20,10,30,${0.010 + bam(i + 5000) * 0.028})`
      x.fillRect(px, py, 1 + bam(i + 6000) * 1.8, 1 + bam(i + 7000) * 1.8)
    }
    const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, depthTest: false }))
    m.position.set(0, 0, -0.7)
    m.scale.set(2 * 0.7 * Math.tan(FOV / 2) * 1.04 * W / H, 2 * 0.7 * Math.tan(FOV / 2) * 1.04, 1)
    m.renderOrder = 999
    m.frustumCulled = false
    cam.add(m)
  }
  const sang = (() => {
    const m = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }))
    m.position.set(0, 0, -0.69)
    m.scale.set(2 * 0.69 * Math.tan(FOV / 2) * 1.04 * W / H, 2 * 0.69 * Math.tan(FOV / 2) * 1.04, 1)
    m.renderOrder = 998
    m.frustumCulled = false
    cam.add(m)
    return m
  })()

  // ---------- Một khung ----------
  let m = null
  function ve(T) {
    m = dx.may(T)
    const p = dx.tuThe(T)
    const k = dx.khung2D(p)
    const sk = dx.suKien(T)
    dx.datMay3D(cam, m, { ngua: 0.02 })
    cam.position.x += 0.0035 * Math.sin(T * 0.83) + 0.02 * sk.rung * Math.sin(T * 91)
    cam.position.y += 0.0025 * Math.sin(T * 0.61 + 1.2) + 0.015 * sk.rung * Math.sin(T * 79 + 1.1)

    datXa(moon, 0.27, doc ? 0.17 : 0.3, 8.5, 0.56, 0.56)
    datXa(moonGlow, 0.27, doc ? 0.17 : 0.3, 8.6, 1.5, 1.5)
    moonGlow.material.opacity = 0.62 + 0.12 * Math.sin(T * 1.3)
    for (const s of stars) {
      datXa(s.m, s.fx + 0.003 * Math.sin(T * 0.2 + s.ph), s.fy, 8.4, 0.05 * s.to, 0.05 * s.to)
      s.m.material.opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(T * 1.9 + s.ph))
    }
    cuaGlow.m.material.opacity = 0.7 + 0.18 * Math.sin(T * 6.7) * Math.sin(T * 3.1)
    for (let i = 0; i < 3; i++) {
      const ph = (T * 0.18 + i / 3) % 1
      datDiemD(khoi[i], nhaX + 0.215 + 0.07 * ph + 0.015 * Math.sin(T * 1.3 + i), 0.74 + 0.5 * ph, 2.6, 0.1 + 0.2 * ph)
      khoi[i].material.opacity = 0.5 * Math.min(1, ph * 6) * (1 - ph)
    }

    const xa = xaOf(m)
    for (const b of bot) {
      const f = (xa - b.z) / xa
      b.m.position.set(
        m.tam[0] + (b.fx + 0.012 * Math.sin(T * 0.21 + b.ph)) * m.cao * W / H * f,
        m.tam[1] + (b.fy + 0.015 * Math.sin(T * 0.33 + b.ph * 1.7)) * m.cao * f, 0)
      const s = b.to * m.cao / H * f * 1.15
      b.m.scale.set(s, s, 1)
    }

    nvChinh.dat(p, k)
    const pp = dx.tuThe(T, 'phu')
    if (nvPhu) {
      if (pp) { nvPhu.an(true); nvPhu.dat(pp, dx.khung2D(pp)) } else nvPhu.an(false)
    }

    // sói sau bụi: đứng đúng chỗ dx.hienX(T) (bộ dựng đã bám mép phải khung)
    const hien = sk.hien
    for (const o of soiGoi.ds) o.visible = hien > 0.015
    if (hien > 0.015) {
      const halfW = m.cao * W / H / 2
      const sc = kep(halfW * 1.5, 0.4, 0.6)
      const xh = dx.hienX(T)
      const rise = muot(hien)
      const y0 = 0.52 * rise
      const cy = y0 + 0.476 * sc
      soiGoi.go.position.set(xh, 0.16, 0)
      soiGoi.go.scale.set(1.5 * sc, 0.32, 1)
      soiGoi.bui.position.set(xh, 0.21 + 0.205, 0)
      soiGoi.bui.scale.set(1.15 * sc, 0.41, 1)
      soiGoi.mesh.position.set(xh, cy, 0)
      soiGoi.mesh.scale.set(sc, sc, 1)
      soiGoi.mesh.rotation.z = 0.03 * Math.sin(T * 1.7)
      const e1 = [-0.143 * sc, -0.012 * sc], e2 = [0.148 * sc, -0.008 * sc]
      soiGoi.mat1.position.set(xh + e1[0], cy + e1[1], 0)
      soiGoi.mat2.position.set(xh + e2[0], cy + e2[1], 0)
      const gl = 0.45 + 0.3 * Math.sin(T * 2.6)
      soiGoi.mat1.material.opacity = gl * hien
      soiGoi.mat2.material.opacity = gl * hien
    }

    sang.material.opacity = 0.28 * sk.sang
    r.render(scene, cam)
  }

  return { ve }
}
