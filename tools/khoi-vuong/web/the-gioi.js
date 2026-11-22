// Bối cảnh. Mọi phong cách chung một mặt bằng để dùng chung kịch bản:
// lối đi dọc trục x ở y = 0, khoảng trống từ x = -4 tới 4, mốc đích ở x = 13,5.
import { vat, rand, tron, muot, CHAT, SO } from './chung.js'
import { coHo, caoDich, themMatBang } from './mat-bang.js'
import { theGioiThem } from './the-gioi-them.js'

export const MOC_X = 13.5
export const DEN_Y = { thap: 12.5, nha: 7.5, cong: 8.5 }

function nhieu(x, z) {
  const i = Math.floor(x), j = Math.floor(z), u = muot(x - i), v = muot(z - j)
  return tron(tron(rand(i, j), rand(i + 1, j), u), tron(rand(i, j + 1), rand(i + 1, j + 1), u), v)
}

let mb = 'vuc' // mặt bằng của lần dựng này
function caoDat(x, z) {
  const az = Math.abs(z)
  if (!coHo(mb) && az <= 5) {
    if (mb === 'leo') {
      if (x > 4 && x < 21) return 4
      if (az <= 2 && Math.abs(x) < 4) return Math.floor((x + 4) / 2) + 1
    }
    if (Math.abs(x) < 4) return 0
  }
  const tam = az <= 2 ? 0 : Math.sin(z * 0.17) * 1.8
  const rong = az <= 2 ? 4 : 4 + (nhieu(z * 0.3, 7) - 0.4) * 2.5
  if (Math.abs(x - tam) < rong) return -7
  if (az <= 5 && x > -21 && x < 21) return 0
  const n = nhieu(x * 0.16, z * 0.16)
  let h = 0
  if (z < -5) h = Math.floor(Math.min(9, (-z - 5) * 0.5) * n + n * 1.5)
  if (z > 5) h = -Math.floor(Math.min(4, (z - 5) * 0.45) * (0.5 + n))
  if (Math.abs(x) > 20 && z < 8) h += Math.floor(Math.min(6, (Math.abs(x) - 20) * 0.6) * n)
  return h
}

function sandbox(ds, bc, moc, tenCanh) {
  const khoi = (x, y, z, c, chat, sang = 0) => vat(ds, [x, y, z], [1, 1, 1], c, { chat, sang, hat: rand(x * 3 + y, z * 7) })

  for (let x = -37.5; x < 42; x++) for (let z = -46; z < 22; z++) {
    const h = caoDat(x, z)
    const thap = Math.min(caoDat(x + 1, z), caoDat(x - 1, z), caoDat(x, z + 1), caoDat(x, z - 1), h)
    for (let y = h; y > Math.min(h - 1, thap); y--) {
      const tren = y === h && h > -7
      const c = tren ? bc.dat[Math.floor(rand(x, z) * 2)] : bc.da[((Math.floor(y + nhieu(x * 0.2, z * 0.2) * 2) % 4) + 4) % 4]
      khoi(x, y - 0.5, z, c, tren ? CHAT.dat : CHAT.da)
    }
    if (h === -7) khoi(x, -5.9, z, bc.nuoc, CHAT.nuoc, tenCanh === 'rung-nam' ? 0.5 : 0)
  }

  function cay(x, z, cao, k) {
    const g = caoDat(x, z)
    if (g < -5) return
    for (let y = 0; y < cao; y++) khoi(x, g + y + 0.5, z, bc.than, CHAT.go)
    const c = bc.la[k % 3]
    if (tenCanh === 'rung-nam') {
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
        if (Math.abs(i) + Math.abs(j) < 4) khoi(x + i, g + cao + 0.5, z + j, c, CHAT.la, 0.35)
        if (Math.abs(i) + Math.abs(j) < 2) khoi(x + i, g + cao + 1.5, z + j, c, CHAT.la, 0.35)
      }
      return
    }
    // Tán bậc nhọn hình tháp
    ;[1, 2, 1, 2, 1, 0, 0].forEach((r, t) => {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++)
        if (Math.abs(i) + Math.abs(j) <= r) khoi(x + i, g + cao + t + 0.5, z + j, c, CHAT.la)
    })
  }
  ;[[-13.5, -4, 2], [-8.5, -6, 3], [-17.5, 5, 2], [7.5, -6, 2], [18.5, -5, 3], [17.5, 5, 1]].forEach(([x, z, h], i) => cay(x, z, h, i))
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand(i, 1) * 74 - 35) + 0.5, z = -9 - Math.floor(rand(i, 2) * 34)
    if (Math.abs(x - MOC_X) < 4 && z > -12) continue
    cay(x, z, 2 + Math.floor(rand(i, 3) * 3), i)
  }
  for (let i = 0; i < 170; i++) {
    const x = Math.floor(rand(i, 4) * 40 - 20) + 0.5, z = Math.floor(rand(i, 5) * 13 - 6)
    if (Math.abs(z) < 2 || Math.abs(x - MOC_X) < 3.5) continue
    const g = caoDat(x, z)
    if (g > -5) vat(ds, [x, g + 0.2, z], [0.2, 0.4, 0.2], bc.la[i % 3], { chat: CHAT.la })
  }

  const X = MOC_X, dauMoc = ds.length
  if (moc === 'thap') {
    for (let y = 0; y < 11; y++) {
      const r = y < 3 || y === 10 ? 2 : 1
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue
        if (y < 2 && i === -r && j === 0) continue
        khoi(X + i, y + 0.5, j, y % 4 === 3 || y === 10 ? bc.nhan2 : bc.nhan, CHAT.gach)
      }
    }
    for (const i of [-1, 1]) for (const j of [-1, 1]) vat(ds, [X + i * 1.2, 12.5, j * 1.2], [0.4, 3, 0.4], bc.than, { chat: CHAT.go })
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) khoi(X + i, 14.5, j, bc.nhan2, CHAT.gach)
  } else if (moc === 'nha') {
    for (let y = 0; y < 5; y++) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== 2 || (y < 2 && i === -2 && j === 0) || (y === 2 && (i === 0 || j === 0))) continue
      khoi(X + i, y + 0.5, j, Math.abs(i) === 2 && Math.abs(j) === 2 ? bc.than : bc.nhan, CHAT.go)
    }
    for (let y = 0; y < 2; y++) for (let i = -3 + y; i <= 3 - y; i++) for (let j = -3 + y; j <= 3 - y; j++) khoi(X + i, y + 5.5, j, bc.nhan2, CHAT.gach)
  } else {
    for (let y = 0; y < 8; y++) for (let j = -3; j <= 3; j++) {
      if ((Math.abs(j) < 2 && y < 5) || (Math.abs(j) < 1 && y < 6)) continue
      khoi(X, y + 0.5, j, (y + j) % 3 ? bc.nhan : bc.nhan2, CHAT.gach)
    }
  }
  for (let i = dauMoc + 1; i < ds.length; i += SO) ds[i] += caoDich(mb)
}

function doChoi(ds, bc, moc, tenCanh) {
  const b = (p, s, c, bo = 0.2, them = {}) => vat(ds, p, s, c, { bo, ...them })
  const cau = (p, d, c) => b(p, [d, d, d], c, d / 2)

  for (const [x, r, k] of [[-11, 14, 0], [12.5, 17, 1]]) {
    b([x, -0.4, 0], [r, 0.8, 10], bc.dat[0], 0.35)
    b([x, -1.5, 0], [r - 0.7, 1.8, 9.4], bc.da[k], 0.7)
    b([x, -3.2, 0], [r - 3, 2.2, 6.8], bc.da[k + 2], 0.9)
    for (let i = 0; i < r - 2; i += 2) b([x - r / 2 + 1.8 + i, 0.015, 0], [1.1, 0.1, 1.5], bc.nhan, 0.05)
    for (let i = 0; i <= r - 1; i += 1.6) {
      const px = x - r / 2 + 0.5 + i
      b([px, 0.45, -4.5], [0.28, 0.9, 0.28], bc.nhan, 0.14)
      cau([px, 1, -4.5], 0.45, bc.da[Math.round(i / 1.6) % 4])
    }
  }

  function cay(x, y, z, k) {
    b([x, y + 1.1, z], [0.45, 2.2, 0.45], bc.than, 0.22)
    cau([x, y + 2.8, z], 2, bc.la[k % 3])
    cau([x + 0.7, y + 2.4, z + 0.3], 1.2, bc.la[(k + 1) % 3])
  }
  ;[[-15, -3], [-8, -3.4], [8.5, -3.6], [18, -3.2], [-16, 3.5], [19, 3.6]].forEach(([x, z], i) => cay(x, 0, z, i))

  // Chặng vượt ải phía sau
  for (let i = 0; i < 22; i++) {
    const x = -25 + i * 2.6, y = Math.sin(i * 0.8) * 2.2 + 1 + i * 0.22, z = -11 - Math.cos(i * 0.6) * 3
    b([x, y, z], [1.9, 0.6, 1.9], bc.da[i % 4], 0.25)
    b([x, y - 2.2, z], [0.4, 3.8, 0.4], bc.nhan, 0.2)
    if (i % 5 === 2) {
      for (let a = 0; a <= 12; a++) {
        const g = a / 12 * Math.PI
        cau([x, y + 0.5 + Math.sin(g) * 2, z + Math.cos(g) * 1.7], 0.55, bc.da[a % 4])
      }
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = rand(i, 1) * 70 - 32, y = rand(i, 2) * 15 - 7, z = -21 - rand(i, 3) * 16
    b([x, y, z], [6, 1.2, 5], bc.dat[0], 0.5)
    b([x, y - 1.6, z], [4.5, 2.2, 3.6], bc.da[i % 4], 0.8)
    cay(x, y + 0.6, z, i)
  }
  if (tenCanh === 'cong-vien') {
    for (let i = 0; i < 40; i++) {
      const x = rand(i, 7) * 70 - 35, z = rand(i, 8) * 45 - 36, y = -10 - rand(i, 9) * 3
      for (let k = 0; k < 3; k++) cau([x + k * 2, y + (k % 2) * 0.7, z], 3.2 + (k % 2), bc.nuoc)
    }
  } else {
    b([0, -10, -10], [100, 1, 80], bc.nuoc, 0.4, { chat: CHAT.nuoc, sang: tenCanh === 'dung-nham' ? 0.85 : 0 })
  }

  const X = MOC_X
  if (moc === 'thap') {
    for (let i = 0; i < 6; i++) b([X, 1 + i * 1.8, 0], [4 - i * 0.35, 1.9, 4 - i * 0.35], bc.da[i % 4], 0.6)
    b([X, 11.1, 0], [3, 0.5, 3], bc.nhan, 0.25)
    for (const i of [-1, 1]) b([X + i * 1.2, 12.3, 0], [0.25, 2.2, 0.25], bc.nhan, 0.12)
    b([X, 13.7, 0], [3.2, 0.7, 2.6], bc.nhan2, 0.35)
  } else if (moc === 'nha') {
    b([X, 2.4, 0], [4.6, 4.8, 4.6], bc.nhan, 0.6)
    b([X, 5.6, 0], [5.6, 1.6, 5.6], bc.nhan2, 0.8)
    b([X - 2.3, 1.2, 0], [0.2, 2.4, 1.3], bc.da[2], 0.1)
    for (const j of [-1, 1]) b([X - 2.32, 3.4, j * 1.3], [0.15, 1, 1], bc.da[1], 0.07)
  } else {
    for (const j of [-1, 1]) for (let y = 0; y < 4; y++) b([X, 1 + y * 1.8, j * 2.8], [1.5, 1.8, 1.5], bc.da[y % 4], 0.5)
    b([X, 7.4, 0], [1.6, 1.4, 7.4], bc.nhan2, 0.6)
  }
}

export function theGioi(pc, bc, kb) {
  const ds = []
  mb = kb.mat_bang
  if (pc.luoi === 'vuong') sandbox(ds, bc, kb.moc, kb.boi_canh)
  else if (pc.luoi === 'tron') {
    doChoi(ds, bc, kb.moc, kb.boi_canh)
    // Leo: nâng cả bờ đích, không nâng hậu cảnh.
    for (let i = 0; i < ds.length; i += SO) if (ds[i] > 3.9 && ds[i] < 22 && Math.abs(ds[i + 2]) < 5.8 && ds[i + 1] > -4.5) ds[i + 1] += caoDich(mb)
  } else theGioiThem(ds, pc, bc, kb)
  if (!(bc.pho && mb === 'ham')) themMatBang(ds, pc, bc, mb) // phố đã có mặt đường liền
  return new Float32Array(ds)
}
