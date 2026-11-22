// Bối cảnh của tám phong cách thêm. Chung hai bờ đất, khác hình khối, cây, hậu cảnh và đích.
import { vat, rand, CHAT, HINH } from './chung.js'
import { caoDich } from './mat-bang.js'
import { phoMua } from './do-thi-mua.js'

const X = 13.5
const { hop, bo, non, tru, da } = HINH

function dung(ds) {
  return (x, y, z, w, h, d, c, hinh = 0, them = {}) => vat(ds, [x, y, z], [w, h, d], c, { hinh, bo: 0.2, hat: rand(x * 3 + y, z * 7), ...them })
}
const rai = (n, lam) => { for (let i = 0; i < n; i++) lam(i, k => rand(i + 1, k)) }
const haiBo = H => [[-11.5, 15, 0], [12.5, 17, H]]
const gan = H => [[-16, 0, -3.6], [-9, 0, -3.9], [-13, 0, 3.7], [7.5, H, -3.8], [18.5, H, -3.4], [18.8, H, 3.6]]

function phieuLuu(o, bc, H) {
  const thong = (x, y, z, k) => {
    o(x, y + 0.6, z, 0.4, 1.2, 0.4, bc.than, tru)
    for (let i = 0; i < 3; i++) o(x, y + 1.5 + i * 0.9, z, 2.3 - i * 0.55, 1.6, 2.3 - i * 0.55, bc.la[(k + (i === 2 ? 1 : 0)) % 3], non)
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 0.5, 0, w, 1, 10, bc.dat[0], hop)
    o(x, y - 4.4, 0, w * 0.9, 7, 9, bc.da[1], non, { rx: Math.PI })
    rai(16, (i, r) => {
      const px = x + (r(1) - 0.5) * (w - 1), tr = i % 2 ? 1 : -1
      o(px, y + 0.05, tr * (3.3 + r(2) * 1.4), 0.6 + r(3), 0.5 + r(4) * 0.5, 0.8, bc.da[i % 4], da)
    })
  }
  gan(H).forEach((p, i) => thong(...p, i))
  o(0, -8, -8, 110, 1, 90, bc.nuoc, hop)
  rai(26, (i, r) => {
    const h = 6 + r(1) * 13, z = -17 - r(2) * 22, x = r(3) * 80 - 36
    o(x, -8 + h / 2, z, h * 1.2, h, h * 1.2, bc.da[i % 4], non)
    o(x, -8 + h * 0.875, z, h * 0.31, h * 0.26, h * 0.31, bc.nhan, non)
  })
  rai(22, (i, r) => {
    const x = r(4) * 56 - 26, z = -8 - r(5) * 9, y = -4 + r(6) * 4
    o(x, y - 1.4, z, 3.4, 4, 3.4, bc.dat[1], da)
    thong(x, y + 0.2, z, i)
  })
}

function kinhDi(o, bc, H) {
  const cayKho = (x, y, z, i) => {
    o(x, y + 1.9, z, 0.42, 3.8, 0.42, bc.than)
    for (let k = 0; k < 4; k++) o(x, y + 1.8 + k * 0.65, z + 0.2, 0.16, 1.7, 0.16, bc.than, 0, { ry: i + k * 1.7, rx: 0.9 })
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 3, 0, w, 6, 10, bc.dat[0])
    for (let px = x - w / 2 + 0.6; px < x + w / 2; px += 1.5) {
      o(px, y + 0.8, -4.7, 0.2, 1.6 + rand(px) * 0.5, 0.16, bc.than, 0, { rx: rand(px, 2) * 0.2 - 0.1 })
      o(px + 0.7, y + 1.1, -4.7, 1.5, 0.16, 0.1, bc.than)
    }
    rai(9, (i, r) => {
      const px = x + (r(1) - 0.5) * (w - 2)
      o(px, y + 0.5, i % 2 ? 3.4 : -3.3, 0.75, 1, 0.25, bc.da[i % 4], 0, { ry: r(2) - 0.5 })
    })
  }
  gan(H).forEach((p, i) => cayKho(...p, i))
  o(0, -7, -8, 100, 1, 80, bc.nuoc)
  rai(44, (i, r) => cayKho(r(1) * 64 - 30, -3 + r(2) * 3, -8 - r(3) * 15, i))
  for (const x of [-14, -2, 10]) {
    o(x, 1.2, -12, 4.5, 5, 4, bc.da[1])
    o(x, 4.7, -12, 5.6, 2.4, 5, bc.da[3], non)
    o(x + 1, 2, -9.97, 0.8, 1, 0.1, bc.nhan2, 0, { sang: 1 })
  }
  o(3, 13, -22, 4, 4, 4, bc.nhan, bo, { bo: 2, sang: 1 })
}

function neon(o, bc, H) {
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 2, 0, w, 4, 10, bc.dat[0])
    for (let px = x - w / 2 + 1; px < x + w / 2; px += 2) o(px, y + 0.01, 0, 0.07, 0.03, 10, bc.nhan2, 0, { sang: 1 })
    for (const z of [-4.8, -1.8, 1.8, 4.8]) o(x, y + 0.02, z, w, 0.04, 0.09, bc.nhan, 0, { sang: 1 })
  }
  gan(H).forEach(([x, y, z], i) => {
    o(x, y + 1.6, z, 0.22, 3.2, 0.22, bc.than)
    o(x, y + 3.5, z, 1.3, 0.75, 0.16, bc.la[i % 3], 0, { sang: 0.9 })
  })
  rai(46, (i, r) => {
    const h = 5 + r(1) * 17, x = (i / 45) * 76 - 34, z = -11 - r(2) * 22
    o(x, h / 2 - 8, z, 2.6 + r(3) * 2, h, 3, bc.da[i % 4], 0, { chat: CHAT.cua })
    if (i % 3 === 0) o(x, h - 8.8, z + 1.6, 1.8, 0.6, 0.12, bc.la[i % 3], 0, { sang: 1 })
  })
  o(0, -9, -6, 110, 1, 90, bc.nuoc)
  for (let i = -30; i <= 30; i += 3) {
    o(i, -8.46, -6, 0.1, 0.05, 80, bc.nhan2, 0, { sang: 1 })
    o(0, -8.45, i - 6, 80, 0.05, 0.1, bc.nhan2, 0, { sang: 1 })
  }
}

function diemAnh(o, bc, H) {
  const cay = (x, y, z, k) => {
    o(x, y + 0.9, z, 0.5, 1.8, 0.5, bc.than)
    ;[2.5, 2, 1.5, 0.9].forEach((w, i) => o(x, y + 1.9 + i * 0.65, z, w, 0.7, 1, bc.la[(k + (i > 1 ? 1 : 0)) % 3]))
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 0.4, 0, w, 0.8, 9, bc.dat[0])
    for (let i = 0; i < w; i++) for (let j = 0; j < 5; j++) o(x - w / 2 + 0.5 + i, y - 1.3 - j, 3.5, 1, 1, 2, bc.da[(i + j) % 2])
  }
  gan(H).forEach(([x, y, z], i) => { if (z < 0) cay(x, y, z, i) })
  // Ba lớp đồi phía sau, mỗi lớp một màu
  ;[[-9, 1.5, bc.da[2]], [-14, 4, bc.da[3]], [-19, 6.5, bc.la[2]]].forEach(([z, cao, c], lop) => {
    for (let i = 0; i < 36; i++) {
      const h = cao + Math.floor(Math.sin(i * 0.55 + lop * 2) * 2 + rand(i, lop)) + 8
      o(i * 2 - 34, h / 2 - 8, z, 2, h, 1, c)
      if (lop === 0 && i % 4 === 0) cay(i * 2 - 34, h - 8, z, i)
    }
  })
  rai(9, (i, r) => {
    const x = i * 8 - 30, y = 9 + r(1) * 5
    o(x, y, -23, 4, 1, 1, bc.nhan)
    o(x + 0.5, y + 0.8, -23, 2, 0.8, 1, bc.nhan)
  })
  o(0, -27, 0, 100, 40, 14, bc.nuoc)
}

function datSet(o, bc, H) {
  const cay = (x, y, z, k) => {
    o(x, y + 1, z, 0.65, 2, 0.6, bc.than, bo, { bo: 0.3, rx: 0.1 })
    o(x, y + 2.5, z, 2, 1.8, 1.8, bc.la[k % 3], bo, { bo: 0.9 })
    o(x + 0.7, y + 2.1, z + 0.4, 1.1, 1, 1.1, bc.la[(k + 1) % 3], bo, { bo: 0.5 })
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 1, 0, w, 2, 10, bc.dat[0], bo, { bo: 0.9 })
    o(x, y - 3.3, 0, w - 1.5, 3.4, 8.6, bc.da[1], bo, { bo: 1.4 })
    rai(14, (i, r) => {
      const px = x + (r(1) - 0.5) * (w - 2.5), z = i % 2 ? 3.7 : -3
      o(px, y + 0.3, z, 0.13, 0.6, 0.13, bc.la[0], bo, { bo: 0.06 })
      o(px, y + 0.65, z, 0.48, 0.38, 0.48, bc.da[i % 4], bo, { bo: 0.18 })
    })
  }
  gan(H).forEach((p, i) => cay(...p, i))
  o(0, -7, -8, 100, 1, 80, bc.nuoc, bo, { bo: 0.4 })
  rai(22, (i, r) => {
    const w = 6 + r(1) * 7, x = r(2) * 72 - 34, z = -14 - r(3) * 18, h = 5 + r(4) * 9
    o(x, -6.5 + h / 2, z, w, h, w, bc.da[i % 4], bo, { bo: 3 })
    if (i % 2) cay(x, -6.7 + h, z, i)
  })
  rai(9, (i, r) => {
    for (let k = 0; k < 3; k++) o(i * 7 - 28 + k * 1.1, 9 + r(1) * 4 + (k % 2) * 0.4, -14, 2, 1.5, 1.4, bc.nhan, bo, { bo: 0.75 })
  })
}

function giay(o, bc, H) {
  const cay = (x, y, z, k) => {
    o(x, y + 0.7, z, 0.35, 1.4, 0.35, bc.than)
    o(x, y + 2.3, z, 2.2, 2.6, 0.9, bc.la[k % 3], non)
    o(x, y + 3.2, z, 1.6, 2, 0.7, bc.la[(k + 1) % 3], non)
  }
  for (const [x, w, y] of haiBo(H)) {
    for (let i = 0; i < 5; i++) o(x, y - 0.4 - i * 0.82, 0, w - i * 0.7, 0.8, 10 - i * 0.7, i ? bc.da[i % 4] : bc.dat[0])
    rai(10, (i, r) => o(x + (r(1) - 0.5) * (w - 2), y + 0.3, i % 2 ? 3.8 : -3.1, 0.6, 0.6, 0.2, bc.la[i % 3], non, { ry: r(2) }))
  }
  gan(H).forEach((p, i) => cay(...p, i))
  rai(30, (i, r) => {
    const lop = i % 3, h = 7 + lop * 4 + r(1) * 4
    o(r(2) * 76 - 36, h / 2 - 7, -13 - lop * 6, h * 1.1, h, 1.2, bc.da[lop + 1], non)
  })
  o(0, -7.5, -8, 110, 1, 80, bc.nuoc)
  rai(9, (i, r) => {
    const x = i * 7 - 28, y = 8 + r(1) * 4
    o(x, y + 9, -10, 0.05, 18, 0.05, bc.nhan)
    o(x, y, -10, 2.6, 0.7, 0.2, bc.nhan)
    o(x + 0.3, y + 0.5, -10, 1.4, 0.7, 0.2, bc.nhan)
  })
}

function saBan(o, bc, H) {
  const cay = (x, y, z, k) => {
    o(x, y + 0.4, z, 0.22, 0.8, 0.22, bc.than, tru)
    o(x, y + 1.3, z, 1.2, 1.4, 1.2, bc.la[k % 3], da)
  }
  const nha = (x, y, z, k) => {
    o(x, y + 1, z, 2.2, 2, 2, bc.nhan)
    o(x, y + 2.6, z, 2.9, 1.3, 2.7, bc.la[k % 3], non, { ry: Math.PI / 4 })
    o(x, y + 0.5, z + 1.02, 0.5, 1, 0.06, bc.than)
    for (const d of [-0.65, 0.65]) o(x + d, y + 1.4, z + 1.02, 0.45, 0.45, 0.06, bc.nuoc)
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 0.3, 0, w, 0.6, 10, bc.dat[0])
    o(x, y - 2.3, 0, w, 3.4, 10, bc.da[1])
    o(x, y + 0.01, 0, w, 0.06, 2.4, bc.da[2])
    for (let px = x - w / 2 + 1; px < x + w / 2; px += 1.6) o(px, y + 0.05, 0, 0.7, 0.03, 0.12, bc.nhan)
    o(x, y - 4.4, 0, w + 0.8, 0.8, 10.8, bc.than)
  }
  gan(H).forEach(([x, y, z], i) => (i % 3 === 1 && z < 0 ? nha(x, y, z, i) : cay(x, y, z, i)))
  rai(20, (i, r) => cay((i % 2 ? 5.2 : -18) + Math.floor(i / 4) * 3 + r(1) * 1.2, i % 2 ? H : 0, i % 4 < 2 ? -4.6 : 4.5, i))
  o(0, -5.2, -8, 160, 0.8, 130, bc.nuoc)
  rai(18, (i, r) => {
    const x = i * 4 - 34, z = -10 - r(1) * 7
    o(x, -4.2, z, 3.8, 1.2, 3.8, bc.dat[1])
    if (i % 3) nha(x, -3.6, z, i)
    else cay(x, -3.6, z, i)
  })
}

function len(o, bc, H) {
  const cay = (x, y, z, k) => {
    o(x, y + 1, z, 0.6, 2, 0.6, bc.than, bo, { bo: 0.3 })
    o(x, y + 2.6, z, 2.1, 2.1, 1.7, bc.la[k % 3], bo, { bo: 0.8 })
    o(x, y + 2.6, z + 0.87, 0.4, 0.4, 0.12, bc.nhan, bo, { bo: 0.06 })
  }
  for (const [x, w, y] of haiBo(H)) {
    o(x, y - 0.7, 0, w, 1.4, 10, bc.dat[0], bo, { bo: 0.65 })
    o(x, y - 2.5, 0, w - 1, 2.5, 9, bc.da[1], bo, { bo: 1.1 })
    for (let px = x - w / 2 + 0.9; px < x + w / 2 - 0.6; px += 0.9)
      for (const z of [-4.1, 4.1]) o(px, y + 0.03, z, 0.46, 0.1, 0.12, bc.nhan, bo, { bo: 0.05 })
  }
  gan(H).forEach((p, i) => cay(...p, i))
  rai(24, (i, r) => {
    const s = 5 + r(1) * 6, x = r(2) * 72 - 34, z = -13 - r(3) * 18
    o(x, -4 + r(4) * 3, z, s, s * 0.85, s, bc.da[i % 4], bo, { bo: 2.4 })
  })
  rai(14, (i, r) => {
    const x = i * 5 - 30, y = 9 + r(1) * 3
    o(x, y, -9, 1.2, 1.2, 1.2, bc.la[i % 3], bo, { bo: 0.6 })
    o(x, y + 9, -9, 0.05, 17, 0.05, bc.nhan)
  })
  o(0, -7.5, -8, 110, 1, 80, bc.nuoc, bo)
}

const KIEU = { 'phieu-luu': phieuLuu, 'kinh-di': kinhDi, neon, 'diem-anh': diemAnh, 'dat-set': datSet, giay, 'sa-ban': saBan, len }

function dich(o, pc, bc, H, moc) {
  const mem = pc.hinh === 'bo', hep = pc.canh === 'phieu-luu' || pc.canh === 'giay'
  const cot = mem ? { bo: 0.6 } : {}
  if (moc === 'thap') {
    for (let i = 0; i < 5; i++) {
      const w = 3.6 - i * 0.3
      o(X, H + 1.1 + i * 2.15, 0, w, 2.2, w, i % 2 ? bc.nhan2 : bc.nhan, hep ? tru : 0, cot)
    }
    o(X, H + 11.1, 0, 3, 0.4, 3, bc.than, hep ? tru : 0, mem ? { bo: 0.2 } : {})
    for (const i of [-1, 1]) for (const j of [-1, 1]) o(X + i * 1.1, H + 12.3, j * 1.1, 0.22, 2.2, 0.22, bc.than)
    o(X, H + 14.1, 0, 3.5, 1.5, 3.5, bc.nhan2, mem ? bo : non, mem ? { bo: 0.7 } : {})
  } else if (moc === 'nha') {
    o(X, H + 2.4, 0, 4.4, 4.8, 4.4, bc.nhan, 0, cot)
    o(X, H + 6, 0, 5.8, 2.6, 5.8, bc.nhan2, mem ? bo : non, mem ? { bo: 1.1 } : { ry: Math.PI / 4 })
    o(X - 2.23, H + 1.2, 0, 0.15, 2.4, 1.3, bc.than)
    for (const j of [-1.3, 1.3]) o(X - 2.23, H + 3.3, j, 0.15, 0.9, 0.8, '#ffd67a', 0, { sang: 0.8 })
  } else {
    for (const j of [-2.8, 2.8]) o(X, H + 3.5, j, 1.4, 7, 1.4, bc.nhan, hep ? tru : 0, cot)
    o(X, H + 7.4, 0, 1.6, 1.3, 7.2, bc.nhan2, 0, cot)
  }
}

export function theGioiThem(ds, pc, bc, kb) {
  const o = dung(ds), H = caoDich(kb.mat_bang)
  if (bc.pho) phoMua(o, bc, H, kb)
  else KIEU[pc.canh](o, bc, H)
  if (!kb.mua) dich(o, pc, bc, H, kb.moc)
}
