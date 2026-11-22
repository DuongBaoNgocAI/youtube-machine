// Đô thị mưa xám: phố tĩnh, và lớp động tùy chọn theo `mua` trong file cảnh.
//   mua: { lo, bat, nang, dau_tay, tho[], roi, dau, vai, mieng, loa, bao, tat, het } (giây, mốc nào thiếu thì không diễn)
import { vat, rand, tron, muot, kep, HINH } from './chung.js'

const { hop, non, tru } = HINH
export const O_X = 5.2
const HANG = [-8.5, -15, -21, -27, -33, -39], NHA = 15, NGUOI_NUOC = O_X + 1.5
const LOA = [-2.5, 5.6, -2.9]
const xNha = i => i * 5.4 - 38
const caoNha = (h, i) => (h ? 5 + Math.floor(rand(i + 3, h) * 5) : i === 7 ? 8 : 7 + (i % 3) * 0.6)

// Mười hai vòi trên mỗi mái, sáu hàng nhà: hơn một nghìn vòi.
const VOI = []
HANG.forEach((z, h) => {
  for (let i = 0; i < NHA; i++) for (let k = 0; k < 12; k++)
    VOI.push({ x: xNha(i) - 1.9 + (k % 6) * 0.76, y: caoNha(h, i) + 1.05, z: z + (k < 6 ? 1.7 : -1.4), h, r: rand(i * 12 + k, h + 9) })
})

export function phoMua(o, bc, H, kb) {
  o(0, -0.55, -8, 120, 1.1, 90, bc.dat[0], hop)
  for (let x = -22; x < 22; x += 2.2) o(x, 0.07, -4.1, 2.1, 0.14, 2.2, bc.dat[1], hop)
  for (let i = 0; i < 22; i++) o(rand(i, 1) * 34 - 18, 0.02, rand(i, 2) * 7 - 3, 0.7 + rand(i, 3) * 1.3, 0.03, 0.7, bc.nuoc, tru, { sang: 0.3 })

  HANG.forEach((z, h) => {
    for (let i = 0; i < NHA; i++) {
      const x = xNha(i), cao = caoNha(h, i)
      o(x, cao / 2, z, 4.8, cao, 4.4, bc.da[(i + h) % 4], hop)
      o(x, cao + 0.12, z + 2.1, 4.9, 0.24, 0.3, bc.than, hop)
      for (const dz of [1.7, -1.4]) o(x, cao + 0.4, z + dz, 4.6, 0.17, 0.17, bc.la[1], hop)
      o(x - 2.2, cao / 2, z + 2.3, 0.16, cao, 0.16, bc.la[1], hop)
      if (h < 3) for (let c = 0; c < 3; c++) for (let y = 2.4; y < cao - 0.6; y += 2) {
        const den = rand(i * 9 + c, y + h) > 0.86
        o(x - 1.4 + c * 1.4, y, z + 2.22, 0.75, 1, 0.1, den ? bc.nhan : '#20262c', hop, { sang: den ? 0.9 : 0 })
      }
    }
  })
  for (const v of VOI) if (v.h < 5) o(v.x, v.y - 0.32, v.z, 0.13, 0.7, 0.13, bc.la[2], hop)

  // Trăng và sao không bị sương nuốt: cả câu chuyện gài ở đây
  ;[2.4, 4, 4.8, 4.8, 4, 2.4].forEach((w, i) => o(-13, 23 - i * 0.8, -44, w, 0.82, 0.5, bc.hat, hop, { sang: 2 }))
  for (const [dx, dy, w] of [[-0.9, 21.6, 1], [0.8, 20.3, 0.7], [0.5, 22.3, 0.5]]) o(-13 + dx, dy, -43.7, w, w, 0.1, '#cfcdb8', hop, { sang: 2 })
  for (let i = 0; i < 90; i++) o(rand(i, 11) * 110 - 55, 17 + rand(i, 12) * 22, -48, 0.22, 0.22, 0.22, bc.hat, hop, { sang: 2 })

  if (!kb.mua) return
  // Biển cấm ô
  const bx = -13, by = 4.1, bz = -4.6
  o(bx, by / 2 - 0.7, bz - 0.1, 0.22, by - 1.2, 0.22, bc.than, hop)
  o(bx, by, bz, 3.3, 3.3, 0.16, bc.nhan2, hop, { sang: 0.85 })
  o(bx, by, bz + 0.1, 2.7, 2.7, 0.12, '#e9e6d8', hop, { sang: 0.8 })
  ;[2.1, 1.7, 1.0].forEach((w, i) => o(bx, by + 0.2 + i * 0.28, bz + 0.2, w, 0.3, 0.1, '#15181b', hop))
  o(bx, by - 0.4, bz + 0.2, 0.16, 1, 0.1, '#15181b', hop)
  o(bx + 0.2, by - 0.88, bz + 0.2, 0.5, 0.16, 0.1, '#15181b', hop)
  o(bx, by, bz + 0.34, 0.12, 0.3, 3.4, bc.nhan2, hop, { ry: Math.PI / 2, rx: 0.75, sang: 1 })

  // Mái hiên chỉ còn khung
  for (const x of [-9.4, -5.6]) {
    for (const z of [-6.1, -4.3]) o(x, 4.1, z, 3.5, 0.24, 0.24, '#c08650', hop, { sang: 0.4 })
    for (let k = 0; k < 5; k++) o(x - 1.6 + k * 0.8, 4.1, -5.2, 0.17, 0.17, 1.9, '#c08650', hop, { sang: 0.3 })
    for (const [dx, h] of [[-1.4, 1.1], [-0.9, 0.5], [1.5, 0.8]]) o(x + dx, 4 - h / 2, -4.3, 0.4, h, 0.06, '#b7473f', hop, { rx: 0.2, sang: 0.3 })
  }
  // Tấm mái bị giật xuống nằm dưới đất
  o(-6.6, 0.35, -3.6, 2.4, 0.1, 1.3, '#b7473f', hop, { rx: 0.4, sang: 0.3 })
  o(-5.2, 0.2, -3, 1.2, 0.12, 0.9, '#c08650', hop, { rx: -0.2, ry: 0.5, sang: 0.3 })
  // Mái trạm xe đục lỗ
  for (const x of [-18.3, -14.8]) o(x, 1.6, -4.1, 0.22, 3.2, 0.22, bc.than, hop)
  for (let a = 0; a < 6; a++) for (let b = 0; b < 4; b++) if ((a * 3 + b * 2) % 5 > 1 || a % 5 === 0 && b % 3 === 0)
    o(-18.1 + a * 0.64, 3.3, -4.3 + b * 0.62, 0.56, 0.14, 0.54, '#c9ad4a', hop)
  o(-14.5, 3.9, -3.5, 0.9, 1.2, 0.12, '#2f69a8', hop, { sang: 0.6 })
  o(-14.5, 3.98, -3.4, 0.56, 0.5, 0.08, '#f0f0e6', hop, { sang: 0.8 })
  o(-14.5, 4.05, -3.34, 0.4, 0.2, 0.06, '#24303c', hop)
  for (const dx of [-0.17, 0.17]) o(-14.5 + dx, 3.67, -3.36, 0.14, 0.14, 0.08, '#f0f0e6', hop, { sang: 0.8 })
  for (const z of [-4.5, -2.2]) o(-16.5, 3.18, z, 3.9, 0.12, 0.12, '#8a8f86', hop, { sang: 0.3 })
  o(-16.5, 0.7, -3.7, 2.6, 0.2, 0.7, bc.than, hop)

  // Hẻm
  for (let x = 1; x < 13; x += 1.5) for (let y = 0.5; y < 5; y++) o(x + (Math.floor(y) % 2) * 0.4, y, -3.5, 1.45, 0.96, 0.5, bc.da[(Math.round(x) + Math.floor(y)) % 4], hop)
  for (let z = -3; z < 4; z += 1.4) o(14, 2.8, z, 0.6, 5.6, 1.35, bc.da[2], hop)
  o(2.1, 0.6, -2.6, 1, 1.2, 1, bc.la[2], hop)
  o(3.3, 0.35, -2.7, 0.7, 0.7, 0.7, bc.than, hop)
  o(12.2, 2.5, -2.2, 0.22, 5, 0.22, bc.than, hop)
  o(11.7, 5, -2.2, 1.2, 0.16, 0.16, bc.than, hop)
  o(11.2, 4.75, -2.2, 0.8, 0.4, 0.7, '#ffe2a0', hop, { sang: 1 })
  o(11.4, 0.04, -1.3, 3.6, 0.05, 3.2, '#8d8064', tru, { sang: 0.45 })

  // Loa phường
  const [lx, ly, lz] = LOA
  o(lx, ly / 2, lz - 0.6, 0.2, ly + 0.8, 0.2, bc.than, hop)
  for (const s of [-1, 1]) {
    o(lx + s * 0.85, ly, lz, 1.6, 1.8, 1.6, '#aeb4ad', non, { rx: -Math.PI / 2, ry: s * 0.25, sang: 0.35 })
    o(lx + s * 0.95, ly, lz + 0.92, 1.1, 0.06, 1.0, '#14171a', tru, { rx: Math.PI / 2, ry: s * 0.25 })
    o(lx + s * 0.95, ly, lz + 0.99, 0.32, 0.06, 0.32, '#aeb4ad', tru, { rx: Math.PI / 2, ry: s * 0.25 })
  }

}

function vanNuoc(ds, bc) {
  const o = (x, y, z, w, h, d, c, sang = 0.3, rx = 0) => vat(ds, [x, y, z], [w, h, d], c, { sang, rx, hat: 0.4 })
  const vx = xNha(7) + 2.6, vy = 9.4, vz = -5.5
  o(vx, vy - 0.1, vz - 0.7, 3, 2.8, 0.7, '#20282e', 0)
  o(vx, vy - 1.3, vz - 0.2, 3.4, 0.3, 0.3, bc.la[1])
  for (let k = 0; k < 20; k++) {
    const a = k / 20 * Math.PI * 2
    o(vx + Math.cos(a) * 0.92, vy + Math.sin(a) * 0.92, vz, 0.31, 0.31, 0.24, '#e0463a', 0.7)
  }
  o(vx, vy, vz, 1.8, 0.16, 0.18, '#e0463a', 0.5); o(vx, vy, vz, 0.16, 1.8, 0.18, '#e0463a', 0.5)
  // Nhiều bàn tay giữ cho van luôn mở
  ;[[-1, 0.55, '#4b5663'], [-1, -0.5, '#5d5750'], [1, 0.4, '#66605a'], [1, -0.65, '#505068']].forEach(([s, dy, ao]) => {
    o(vx + s * 0.86, vy + dy, vz + 0.24, 0.42, 0.34, 0.26, '#c79b80', 0.35)
    for (let k = 1; k < 4; k++) o(vx + s * (0.86 + k * 0.33), vy + dy - k * 0.2, vz + 0.2, 0.4, 0.34, 0.26, ao, 0.2)
  })
}

// Tia nước phụt lên từ chính van
function phutVan(ds, T) {
  const vx = xNha(7) + 2.6
  for (let k = 0; k < 50; k++) {
    const u = (T * 2 + k / 50) % 1, a = rand(k, 3) * 6.28
    vat(ds, [vx + Math.cos(a) * u * 0.9, 10.6 + 2.6 * u - 2.1 * u * u, -6.2 + Math.sin(a) * u * 0.5], [0.07, 0.3, 0.07], '#d8f2fb', { sang: 1 })
  }
}

// Người dân ướt sũng, ngửa mặt. Mở đầu cả đám cúi xuống nhìn người xem một nhịp
function nguoiDan(ds, x, z, i, T) {
  const ao = ['#4b5663', '#5d5750', '#3f4c4a', '#66605a', '#505068'][i % 5], lac = Math.sin(T * 1.2 + i) * 0.04
  const cui = muot(kep((T - 0.9 - i * 0.04) / 0.22)) * (1 - muot(kep((T - 2.6) / 0.4))), g = -0.75 * (1 - cui), cs = Math.cos(g), sn = Math.sin(g)
  for (const s of [-1, 1]) {
    vat(ds, [x + s * 0.22, 0.5, z], [0.3, 1, 0.32], '#262b31', { hat: 0.3 })
    vat(ds, [x + s * 0.56 + lac, 1.35, z + 0.2], [0.22, 0.85, 0.24], ao, { rx: -0.7, hat: 0.5 })
    vat(ds, [x + s * 0.56 + lac, 1.12, z + 0.56], [0.22, 0.12, 0.26], '#b59a88', { hat: 0.5 })
  }
  vat(ds, [x + lac, 1.36, z], [0.85, 0.9, 0.5], ao, { hat: 0.7 })
  const mat = (dx, dy, dz, w, h, d, c, sang = 0) => vat(ds, [x + lac + dx, 2.1 + dy * cs - dz * sn, z + dy * sn + dz * cs], [w, h, d], c, { rx: g, hat: 0.2, sang })
  mat(0, 0.1, 0, 0.72, 0.66, 0.62, '#b59a88')
  mat(0, 0.36, -0.12, 0.78, 0.24, 0.52, '#191b1e')
  // Ngửa thì nhắm mắt, cúi nhìn thì mắt mở
  for (const s of [-1, 1]) mat(s * 0.17, 0.16, 0.33, 0.14, 0.04 + cui * 0.12, 0.06, cui > 0.5 ? '#030304' : '#15171a', cui > 0.5 ? 1 : 0)
  mat(0, -0.1, 0.33, 0.26, 0.06, 0.06, '#4a2a2c')
}

function baCu(ds, m, T) {
  if (m.gao === undefined || T < (m.ba_tu ?? m.gao - 0.3)) return
  const gao = T >= m.gao && T < (m.het_gao ?? m.gao + 3), x = 11.1, z = -1.3
  // ry -90 độ: w nằm theo z, d nằm theo x, mặt quay về -x
  const q = (dx, y, dz, w, h, d, c, { rx = 0, sang = 0 } = {}) => vat(ds, [x + dx, y, z + dz], [w, h, d], c, { rx, sang, ry: -Math.PI / 2, hat: 0.4 })
  // Áo bà ba nâu, quần đen, khăn rằn, lưng còng, tóc bạc
  for (const s of [-1, 1]) q(0.05, 0.45, s * 0.22, 0.32, 0.9, 0.36, '#17181b')
  q(-0.12, 1.25, 0, 0.82, 0.8, 0.56, '#80604a', { rx: 0.4 })
  for (let k = 0; k < 3; k++) q(-0.5 - k * 0.05, 1.5 - k * 0.22, 0, 0.07, 0.07, 0.05, '#d8c9a8', { sang: 0.5 })
  q(-0.42, 1.98, 0, 0.56, 0.6, 0.5, '#b98f76', { sang: 0.2 })
  q(-0.16, 2.12, 0, 0.66, 0.4, 0.2, '#b9b8b2')
  q(0.05, 2.1, 0, 0.3, 0.3, 0.3, '#b9b8b2')
  for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) q(-0.22 - b * 0.19, 2.34, (a - 1.5) * 0.18, 0.18, 0.14, 0.19, (a + b) % 2 ? '#34373c' : '#62635f', { sang: 0.15 })
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) q(-0.36, 2.22 - k * 0.18, s * 0.36, 0.22, 0.18, 0.1, (k + (s > 0 ? 1 : 0)) % 2 ? '#34373c' : '#62635f', { sang: 0.15 })
  for (const s of [-1, 1]) {
    q(-0.69, 2.04, s * 0.14, 0.09, gao ? 0.1 : 0.04, 0.05, '#101010')
    q(-0.68, 2.15, s * 0.16, 0.16, 0.04, 0.04, '#b9b8b2')
    if (gao) {
      const v = Math.sin(T * 12 + s) * 0.12
      q(-0.3, 1.9 + v, s * 0.58, 0.2, 0.9, 0.2, '#80604a', { rx: 0.5 })
      q(-0.55, 2.4 + v, s * 0.58, 0.2, 0.22, 0.2, '#b98f76', { sang: 0.2 })
    } else q(-0.4, 1.1, s * 0.46, 0.2, 0.8, 0.2, '#80604a', { rx: 0.3 })
  }
  q(-0.69, 1.82, 0, 0.2, gao ? 0.1 + Math.abs(Math.sin(T * 15)) * 0.12 : 0.05, 0.05, '#35161a')
  if (!gao) q(-0.8, 0.6, 0.5, 0.1, 1.2, 0.1, '#6b5a48')
}

function cayO(ds, m, T, x) {
  if (!(T >= m.bat)) return
  const mo = muot(kep((T - m.bat) / 0.32)), nang = m.nang === undefined ? 0 : muot(kep((T - m.nang) / 0.45)), r = m.roi === undefined ? 0 : kep((T - m.roi) / 0.8)
  const dau = '#d04438', tay = [x + 0.62, 1.66 - nang * 0.48, 0.62]
  if (r > 0) {
    // Văng ra ngoài trước rồi mới lật, khỏi xuyên qua đầu
    const ra = muot(kep(r * 3)), lat = muot(kep((r - 0.25) / 0.75)), cao = 3.7 - nang * 0.72
    const p = [tron(x + 0.3, x - 2.1, muot(r)), r < 0.25 ? cao + r : tron(cao + 0.25, 0.55, lat * lat), tron(0.3, 2.5, ra)]
    vat(ds, p, [3.4, 1, 3.4], dau, { hinh: non, rx: lat * Math.PI, sang: 0.3 })
    vat(ds, [p[0], p[1] + (lat < 0.5 ? -1 : 0.9), p[2]], [0.13, 1.7, 0.13], '#d9d2bd', { rx: lat * 0.3 })
    const kho = 3.7 * (1 - muot(kep(r * 1.4)))
    if (kho > 0.1) vat(ds, [x + 0.35, 0.045, 0.3], [kho, 0.06, kho], '#a89f8c', { hinh: tru, sang: 0.3 * (1 - r) })
    return
  }
  const dinh = 3.7 - nang * 0.72, rung = nang * Math.sin(T * 31) * 0.03, co = 0.5 + mo * 3.2
  vat(ds, [x + 0.35, dinh + 0.3, 0.3 + rung], [co, 1.5 - mo * 0.6, co], dau, { hinh: non, sang: 0.3 })
  vat(ds, [tay[0], (tay[1] + dinh) / 2, tay[2] + rung], [0.15, dinh - tay[1] + 0.3, 0.15], '#d9d2bd', { sang: 0.3 })
  vat(ds, [tay[0], tay[1] - 0.2, tay[2] + rung], [0.22, 0.5, 0.22], '#7a5238')
  // Bốn dấu ngón ướt chỉ thoáng hiện trên cán rồi khô mất
  const dt = T - m.dau_tay
  if (dt >= 0 && dt < 1) for (let k = 0; k < 4; k++) {
    const u = muot(kep((dt - k * 0.07) / 0.15)) * (1 - muot(kep((dt - 0.65) / 0.35)))
    if (!u) continue
    const p = [tay[0] - 0.02, tay[1] + 0.34 + k * 0.17, tay[2] + 0.1 + rung]
    vat(ds, p, [0.3 * u, 0.07, 0.07], '#b4e4f2', { sang: 0.85 })
    vat(ds, [p[0] - 0.1, p[1] - dt * 0.25, p[2]], [0.04, 0.1 * u, 0.04], '#b4e4f2', { sang: 0.9 })
  }
  // Khoảng khô và giọt rơi quanh vành
  vat(ds, [x + 0.35, 0.045, 0.3], [co, 0.06, co], '#a89f8c', { hinh: tru, sang: 0.35 * mo })
  if (mo > 0.9) for (let k = 0; k < 30; k++) {
    const a = k / 30 * Math.PI * 2, u = (T * 2.1 + rand(k, 3)) % 1
    if (Math.sin(a) > 0.2) continue
    vat(ds, [x + 0.35 + Math.cos(a) * 1.95, dinh * (1 - u * u), 0.3 + Math.sin(a) * 1.95], [0.035, 0.18, 0.035], '#b9d8e6', { sang: 0.8 })
  }
}

function nguoiNuoc(ds, m, T, toi) {
  if (!(T >= m.dau)) return
  const tan = m.tat === undefined ? 0 : kep((T - (m.tan ?? m.tat)) / ((m.het ?? m.tat + 3) - (m.tan ?? m.tat))), cx = NGUOI_NUOC + Math.sin(T * 2) * 0.03, cy = 2.4
  const len = t => (t === undefined ? 0 : kep((T - t) / 1.1))
  const giot = (p, i, hien, cao) => {
    // Hiện từ trên xuống, tan cũng từ trên xuống
    if (cao > hien || 1 - cao > 1 - tan * 1.25 + rand(i, 8) * 0.15 || tan >= 1) return
    const chay = (T * 1.6 + rand(i, 5)) % 1
    vat(ds, [p[0], p[1] - chay * 0.14, p[2]], [0.085, 0.12 + chay * 0.13, 0.085], i % 4 ? '#9cc4d2' : '#e8fbff', { sang: 0.95 })
  }
  const a = len(m.dau), b = len(m.vai)
  for (let i = 0; i < 300; i++) {
    const v = 1 - 2 * (i + 0.5) / 300, r = Math.sqrt(1 - v * v), g = i * 2.39996
    giot([cx + Math.cos(g) * r * 0.64, cy + v * 0.84, Math.sin(g) * r * 0.68], i, a, (1 - v) / 2)
  }
  for (let i = 0; i < 400; i++) {
    const u = rand(i, 1), g = i * 2.39996, w = u < 0.22 ? 0.55 + u * 3.4 : 1.3 - (u - 0.22) * 0.7
    giot([cx + 0.2 + Math.cos(g) * 0.42, 1.68 - u * 1.65, Math.sin(g) * w], i, b, u)
  }
  // Hai cánh tay dài quá gối
  if (b > 0.6) for (const s of [-1, 1]) for (let i = 0; i < 60; i++) giot([cx + 0.05 - (i / 60) * 0.3 + rand(i, 2) * 0.15, 1.6 - i * 0.018, s * (1.08 + rand(i, 4) * 0.16)], i + 7, b, i / 50)
  if (T >= m.mieng && tan < 0.55 && !toi) {
    const mo = muot(kep((T - m.mieng) / 1.3))
    for (let k = -16; k <= 16; k++) {
      const u = k / 16, g = u * 1.45 * (0.35 + mo * 0.65), p = [cx - Math.cos(g) * 0.71, cy - 0.46 + u * u * 0.46 * mo, Math.sin(g) * 0.75]
      const h = 0.06 + mo * 0.38 * (1 - u * u * 0.85)
      vat(ds, p, [0.13, h, 0.13], '#030507', { sang: 1, ry: g })
      if (k % 2 === 0 && mo > 0.3) for (const s of [-1, 1]) vat(ds, [p[0] - Math.cos(g) * 0.07, p[1] + s * h * 0.4, p[2] + Math.sin(g) * 0.07], [0.06, 0.11, 0.06], '#f2ffff', { sang: 1 })
    }
  }
}

function hoiTho(ds, m, T, x) {
  for (const [n, t] of (m.tho || []).entries()) {
    const cuoi = T >= (m.tan ?? Infinity), u = (T - t) / (cuoi ? 1.2 : 1.05)
    if (u <= 0 || u >= 1) continue
    // Dưới ô: phả từ chỗ trống bên tai. Cuối truyện: phả thẳng vào mặt
    const tu = cuoi ? [x + 1.6, 2.2, 0.05] : [x - 1.7, 2.1, 1.2], toi = cuoi ? [x + 0.7, 2.25, 0.05] : [x - 0.65, 2.2, 0.7]
    for (let k = 0; k < 44; k++) {
      const d = muot(kep(u * 1.5 - rand(k, 1) * 0.4)), loe = 0.15 + d * 0.5, co = (cuoi ? 0.14 : 0.1) * Math.sin(u * Math.PI) ** 0.4 * (0.6 + rand(k, 4) * 0.6)
      if (!d) continue
      const p = tu.map((v, j) => tron(v, toi[j], d) + (rand(k, j + n + 5) - 0.5) * loe)
      vat(ds, p, [co, co, co], '#d5e3e8', { sang: 0.85 })
    }
  }
}

export function muaDong(ds, bc, kb, T, { mat, nhin, xo = O_X }) {
  const m = kb.mua || {}
  // Từng mái tắt lần lượt, mưa thưa theo
  const tatLuc = r => (m.tat === undefined ? Infinity : m.tat + r * ((m.tan ?? m.het ?? m.tat + 3) - m.tat))

  // Trước giây lộ thì không thấy vòi, thấy thì chỉ là mưa
  const lo = T >= m.lo, tran = lo ? 9.6 : 19
  if (lo) {
    vanNuoc(ds, bc)
    if (T < tatLuc(0.2)) phutVan(ds, T)
    for (let n = 0; n < VOI.length; n++) {
      const v = VOI[n], con = T < tatLuc(v.r)
      if (v.h === 0 && Math.abs(v.x - xNha(7) - 2.6) < 1.8 && v.z > -8) continue
      vat(ds, [v.x, v.y + 0.02, v.z], [0.26, 0.3, 0.26], '#d2a13c', { sang: 0.75 })
      vat(ds, [v.x, v.y + 0.2, v.z], [0.44, 0.1, 0.14], con ? '#f0d58c' : '#4a4436', { sang: con ? 1 : 0 })
      if (!con) continue
      const soGiot = v.h === 0 ? 14 : v.h === 1 ? 6 : 3
      for (let k = 0; k < soGiot; k++) {
        const u = (T * 1.5 + k / soGiot + v.r) % 1, huong = k % 2 ? 1 : -1
        vat(ds, [v.x + huong * u * 0.3, v.y + 0.3 + 2.4 * u - 2.1 * u * u, v.z + u * 0.9], [0.06, 0.26, 0.06], '#d8f2fb', { sang: v.h < 2 ? 0.95 : 1.3 })
      }
    }
  }

  // Mưa chỉ có từ tầm vòi trở xuống, phía trên trời quang
  const gx = (mat[0] + nhin[0]) / 2, cheO = T >= m.bat && !(T >= m.roi)
  for (let i = 0; i < (lo ? 900 : 1300); i++) {
    if (T >= tatLuc(rand(i, 30))) continue
    const x = gx + rand(i, 31) * 24 - 12, z = rand(i, 32) * 16 - 8, y = tran - ((T * (10 + rand(i, 33) * 4) + rand(i, 34) * tran) % tran)
    if (z < -6.2 && y < 8) continue
    if (cheO && y < 4.2 && Math.hypot(x - xo - 0.35, z - 0.3) < 2.6) continue
    if (cheO && y < 4.5 && z > 0.3 && Math.abs(x - xo - 0.5) < 3.6) continue // không vạch qua mặt người dưới ô
    if (Math.hypot(x - mat[0], y - mat[1], z - mat[2]) < 3.3) continue
    vat(ds, [x, y, z], [0.045, 0.62, 0.045], '#a9bdc7', { sang: 0.75 })
    if (y < 0.9) vat(ds, [x, 0.07, z], [0.22 * (1 - y), 0.03, 0.22 * (1 - y)], '#b8ccd5', { sang: 0.7 })
  }
  if (!kb.mua) return

  for (const [i, x, z] of [[0, -15.8, -2.4], [1, -12.1, -2.8], [2, -10.6, -2.2], [3, -9.2, -3.3], [4, -7.8, -2.5], [5, -17.4, -2.1]]) nguoiDan(ds, x, z, i, T)
  baCu(ds, m, T)
  cayO(ds, m, T, xo)
  hoiTho(ds, m, T, xo)
  nguoiNuoc(ds, m, T)

  const [lx, ly, lz] = LOA
  if (T >= m.loa) {
    const keu = T >= m.bao
    vat(ds, [lx, ly + 0.95, lz + 0.2], [0.2, 0.2, 0.2], '#ff4438', { sang: (T * 4) % 1 < 0.6 || keu ? 1.2 : 0 })
    // Sóng tiếng chỉ là ba vạch dọc ngoài mỗi miệng loa
    for (const s of [-1, 1]) for (let v = 0; v < 3; v++) {
      if (!keu && rand(v + s * 5, Math.floor(T * 14)) < 0.5) continue
      const r = 0.95 + v * 0.36 + ((T * 2) % 1) * 0.2
      for (let k = -2; k <= 2; k++) {
        const a = k * 0.27
        vat(ds, [lx + s * (0.95 + Math.cos(a) * r), ly + Math.sin(a) * r, lz + 1], [0.1, 0.27 * r * 0.8, 0.08], '#e8d28a', { sang: 1 })
      }
    }
  }
}
