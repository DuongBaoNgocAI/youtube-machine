// Một khung hình: vật động, nhân vật, máy quay. Chỉ phụ thuộc kịch bản và giây, nên dựng lại luôn ra y hệt.
import { vat, rand, tron, muot, kep, CHAT } from './chung.js'
import { MOC_X, DEN_Y } from './the-gioi.js'
import { coHo, caoDich, caoLoi } from './mat-bang.js'
import { muaDong, O_X } from './do-thi-mua.js'

function nhanVat(ds, nv, vuong, [x, y, z], huong, viec, t, { noi = false, do_nga = 0, cam = null, run = 0, dau = [0, 0] } = {}) {
  const cos = Math.cos(huong), sin = Math.sin(huong)
  const nc = Math.cos(do_nga), ns = Math.sin(do_nga)
  let laDau = false
  const q = (g, s, c, bo = 0.18, rx = 0, sang = 0) => {
    let them = 0
    if (laDau) {
      const [dy, dx] = dau, py = g[1] - 1.6, y1 = py * Math.cos(dx) - g[2] * Math.sin(dx), z1 = py * Math.sin(dx) + g[2] * Math.cos(dx)
      g = [g[0] * Math.cos(dy) + z1 * Math.sin(dy), y1 + 1.6, -g[0] * Math.sin(dy) + z1 * Math.cos(dy)]
      rx += dx; them = dy
    }
    const u = [g[0], g[1] * nc - g[2] * ns, g[1] * ns + g[2] * nc]
    vat(ds, [x + u[0] * cos + u[2] * sin, y + u[1], z - u[0] * sin + u[2] * cos], s, c,
      { ry: huong + them, rx: rx + do_nga, bo, sang, chat: vuong && !sang ? CHAT.vai : 0, hat: 0.2 + (s[0] % 0.3) })
  }
  const chi = (px, py, dai, day, c, goc) => q([px, py - Math.cos(goc) * dai / 2, -Math.sin(goc) * dai / 2], [day, dai, day], c, day / 2, goc)

  const buoc = viec === 'chay' ? 15 : 9, di = viec === 'chay' || viec === 'di'
  let nhun = Math.sin(t * 3) * 0.025
  if (di) nhun = Math.abs(Math.sin(t * buoc)) * (viec === 'chay' ? 0.17 : 0.07)
  if (viec === 'mung') nhun = Math.abs(Math.sin(t * 9)) * 0.45
  y += nhun

  for (const s of [-1, 1]) {
    let chan = di ? Math.sin(t * buoc) * s * (viec === 'chay' ? 0.95 : 0.5) : 0
    let tay = di ? -chan : 0.06
    if (viec === 'nhay') { chan = s * 0.6; tay = -2.5 }
    if (viec === 'nga') { chan = Math.sin(t * 18) * s * 0.8; tay = Math.PI + Math.sin(t * 20) * s * 0.5 }
    if (viec === 'mung') tay = Math.PI - 0.35
    if (viec === 'xay') tay = -1.4 + Math.sin(t * 12) * 0.3
    if (viec === 'dao') tay = -1.2 + Math.sin(t * 11) * 0.9
    if (viec === 'leo') { chan = Math.sin(t * 7) * s * 0.7; tay = -2.2 + Math.sin(t * 7) * s * 0.7 }
    if (noi && !di) tay = -0.45 + Math.sin(t * 5 + s) * 0.35
    if (nv.dang === 'quai' && !noi && viec !== 'mung') tay = -1.3 + Math.sin(t * 6 + s) * 0.2
    if (cam !== null && s === -1) tay = cam
    if (run) tay += Math.sin(t * 43 + s) * run
    chi(0.24 * s, 0.68, 0.68, 0.3, nv.quan, chan)
    chi(0.6 * s, 1.36, 0.68, 0.27, nv.dang === 'robot' ? nv.phu : nv.than, tay)
    if (s === 1 && viec === 'dao') {
      const a = [0.6, 1.36 - Math.cos(tay) * 0.7, -Math.sin(tay) * 0.7]
      q(a, [0.12, 0.12, 1.2], '#8a5a3c', 0.06, -tay * 0.4)
      q([a[0], a[1] - 0.1, a[2] + 0.65], [0.46, 0.14, 0.4], '#d5dee6', 0.07, -tay * 0.4)
    }
  }
  if (viec === 'xay') q([0, 1.6 + Math.sin(t * 12) * 0.15, 0.9], [0.6, 0.6, 0.6], nv.phu, 0.12)

  q([0, 1.03, 0], [0.92, 0.9, 0.62], nv.ao, 0.28)
  q([0, 0.94, 0.32], [0.36, 0.3, 0.08], nv.phu, 0.04)
  if (nv.deo === 'balo') q([0, 1.05, -0.48], [0.7, 0.72, 0.36], nv.phu, 0.17)
  if (nv.deo === 'khan') {
    q([0, 1.44, 0], [0.98, 0.24, 0.72], nv.phu, 0.12)
    q([0.25, 1.2, -0.44], [0.24, 0.55, 0.12], nv.phu, 0.06, Math.sin(t * 6) * 0.3 + 0.3)
  }

  laDau = true
  const n = viec === 'nhin' ? Math.sin(t * 3) * 0.16 : 0
  const m = viec === 'nhay' || viec === 'nga' || viec === 'mung'
  const chop = t % 2.3 < 0.12
  const mat = nv.dang === 'robot' ? nv.phu : nv.dang === 'vien' ? '#ffffff' : '#241c2c'
  q([n, 2.03, 0], [1.16, nv.dang === 'vien' ? 1.15 : 0.96, 0.92], nv.than, 0.44)
  if (nv.dang === 'thu') {
    for (const s of [-1, 1]) q([n + 0.36 * s, 1.83, 0.44], [0.34, 0.4, 0.1], nv.mat, 0.05)
    q([n, 1.84, 0.56], [0.4, 0.28, 0.3], nv.mat, 0.12)
    q([n, 1.96, 0.72], [0.2, 0.13, 0.08], '#241c2c', 0.04)
    q([0, 0.85, -0.6], [0.3, 0.3, 0.75], nv.than, 0.15, 0.5)
    q([0, 1.07, -0.96], [0.24, 0.24, 0.28], nv.mat, 0.12, 0.5)
  } else if (nv.dang === 'robot' || nv.dang === 'vien') {
    q([n, 2.04, 0.43], [0.92, 0.56, 0.16], nv.mat, 0.08)
  } else if (nv.dang === 'nguoi') {
    if (!['trum', 'non-la'].includes(nv.mu)) q([n, 2.44, -0.14], [1.2, 0.36, 0.74], nv.mat, 0.16)
    q([n, 1.97, 0.5], [0.16, 0.22, 0.18], nv.than, 0.07)
  } else {
    for (const s of [-1, 1]) q([n + 0.46 * s, 2.72, 0], [0.18, 0.62, 0.18], nv.phu, 0.09, -0.35)
    q([n, 2.16, 0.46], [0.56, 0.5, 0.12], nv.mat, 0.06, 0, 0.8)
    q([n + Math.sin(t * 2) * 0.1, 2.16, 0.54], [0.17, 0.3, 0.06], '#15101c', 0.03)
    for (let k = -1; k <= 1; k++) q([0.3 * k, 1.45, -0.4], [0.16, 0.4, 0.3], nv.phu, 0.08, -0.5)
  }
  const ez = ['thu', 'nguoi'].includes(nv.dang) ? 0.48 : 0.53
  if (nv.dang !== 'quai') for (const s of [-1, 1]) q([n + 0.24 * s, 2.15, ez], [0.17, chop ? 0.04 : m ? 0.3 : 0.22, 0.06], mat, 0.03, 0, nv.dang === 'robot' ? 1 : 0)
  if (m || noi || nv.dang === 'nguoi' || nv.dang === 'quai') {
    const [my, mz] = nv.dang === 'thu' ? [1.67, 0.62] : nv.dang === 'nguoi' || nv.dang === 'quai' ? [1.77, 0.48] : [1.86, 0.54]
    const mo = noi ? 0.05 + Math.abs(Math.sin(t * 13) * Math.sin(t * 4.3 + 1)) * 0.17 : m ? 0.15 : 0.05
    q([n, my, mz], [nv.dang === 'quai' ? 0.5 : 0.22, mo, 0.06], nv.dang === 'robot' || nv.dang === 'vien' ? nv.phu : '#6a2532', 0.03)
  }

  if (nv.mu === 'tai') for (const s of [-1, 1]) {
    q([n + 0.4 * s, 2.66, -0.05], [0.3, 0.36, 0.22], nv.than, 0.11)
    q([n + 0.4 * s, 2.62, 0.07], [0.14, 0.2, 0.06], nv.mat, 0.03)
  }
  if (nv.mu === 'non') {
    q([n, 2.63, 0], [1.08, 0.34, 0.9], nv.phu, 0.17)
    q([n, 2.52, 0.55], [0.8, 0.12, 0.4], nv.phu, 0.06)
  }
  if (nv.mu === 'vanh') {
    q([n, 2.54, 0], [1.65, 0.13, 1.4], nv.phu, 0.06)
    q([n, 2.78, 0], [0.82, 0.4, 0.72], nv.phu, 0.2)
  }
  if (nv.mu === 'trum') {
    q([n, 2.58, -0.06], [1.3, 0.36, 1], nv.ao, 0.17)
    for (const s of [-1, 1]) q([n + 0.63 * s, 2.06, -0.1], [0.2, 1, 0.86], nv.ao, 0.09)
    q([n, 2.06, -0.5], [1.2, 1, 0.2], nv.ao, 0.09)
  }
  if (nv.mu === 'khan-dau') {
    q([n, 2.4, 0], [1.22, 0.2, 0.98], nv.phu, 0.06)
    q([n + 0.2, 2.3, -0.64], [0.2, 0.14, 0.5], nv.phu, 0.05, Math.sin(t * 7) * 0.3)
  }
  if (nv.mu === 'non-la') {
    q([n, 2.52, 0], [1.7, 0.13, 1.4], nv.phu, 0.06)
    q([n, 2.65, 0], [1.2, 0.14, 1], nv.phu, 0.06)
    q([n, 2.78, 0], [0.6, 0.16, 0.5], nv.phu, 0.07)
  }
  if (nv.mu === 'ang-ten') {
    q([n, 2.7, 0], [0.09, 0.4, 0.09], nv.quan, 0.04)
    q([n, 2.96, 0], [0.24, 0.24, 0.24], nv.phu, 0.12, 0, 1)
  }
}

export function tinhKhung(pc, bc, kb, cho, T) {
  const ds = [], vuong = pc.luoi === 'vuong', canh = kb.canh, mb = kb.mat_bang, ho = coHo(mb)
  // Chất liệu tĩnh vật chỉ giật nhân vật và vật động, máy quay vẫn mượt.
  const TD = pc.giat ? Math.floor(T * pc.giat) / pc.giat : T
  let i = 0
  while (i < canh.length - 1 && T >= canh[i + 1].tu) i++
  const c = canh[i], p = kep((T - c.tu) / (c.den - c.tu)), co = k => canh.findIndex(s => (s.su_kien || []).includes(k))

  const iCau = co('cau')
  const tienCau = iCau < 0 || i < iCau ? 0 : i > iCau ? 1 : p
  // Khối cầu bay từ tay người xây. Đã đào trước đó thì xếp bằng đá.
  const tay = iCau < 0 ? 0 : cho[canh[iCau].tu_cho] + 0.9, cauDa = iCau > 0 && canh.slice(0, iCau).some(s => s.hanh_dong === 'dao')
  if (tienCau > 0) for (let n = 0; n < 8; n++) {
    const u = kep((tienCau - n * 0.09) / 0.2)
    if (!u) continue
    const v = muot(u), y = tron(1.6, -0.5, v) + Math.sin(v * Math.PI) * 1.3, xoay = (1 - u) * 2.5, cx = tron(tay, -3.5 + n, v)
    if (vuong) for (let j = -1; j <= 1; j++) vat(ds, [cx, y, j * v], [1, 1, 1], cauDa ? ['#aab4c0', '#8e99a8', '#bcc3cc'][(n + j + 8) % 3] : (n + j + 8) % 3 ? '#b7794a' : '#a56a40', { chat: cauDa ? CHAT.da : CHAT.go, ry: xoay })
    else if (pc.luoi === 'tron') vat(ds, [cx, y + 0.17, 0], [0.96, 0.66, 2.6], bc.da[n % 4], { bo: 0.2, ry: xoay })
    else vat(ds, [cx, y + 0.3, 0], [0.96, 0.4, 2.6], n % 2 ? bc.than : bc.nhan2, { bo: 0.15, ry: xoay, hat: n / 8 })
  }

  const iSang = co('sang')
  const sang = iSang >= 0 && (i > iSang || (i === iSang && p > 0.15))
  const ly = DEN_Y[kb.moc] + caoDich(mb), cl = (vuong ? 1 : 1.3) * (kb.den_toa && sang ? 1.9 : 1)
  if (!kb.mua) vat(ds, [MOC_X - (kb.moc === 'nha' ? 2.4 : kb.moc === 'cong' ? 0.2 : 0), ly, 0], [cl, cl, cl], sang ? '#ffe9a0' : '#39405a', { sang: sang ? 1 : 0, bo: cl / 2 })
  if (sang) for (let n = 0; n < 24; n++) {
    const a = n / 24 * Math.PI * 2 + T * 0.8, r = 2.6 + Math.sin(T * 3 + n) * 0.3
    vat(ds, [MOC_X + Math.cos(a) * r, ly + Math.sin(a * 3) * 0.5, Math.sin(a) * r], [0.28, 0.28, 0.28], '#ffe9a0', { sang: 1, bo: 0.14, ry: a })
  }

  if (pc.luoi === 'tron') {
    for (const [x, y, z, k] of [[-9, 2.2, -8, 1], [3, 4.6, -9, -1.4], [12, 5, -9, 1.8]]) {
      vat(ds, [x, y, z], [4.6, 0.4, 0.4], bc.da[0], { bo: 0.2, ry: T * k })
      vat(ds, [x, y - 0.7, z], [0.6, 1.6, 0.6], bc.nhan, { bo: 0.3 })
    }
  }
  if (!bc.pho) for (let n = 0; n < 60; n++) {
    const bay = T * (0.5 + rand(n, 4)), roi = vuong ? 12 - (rand(n, 2) * 16 + bay) % 16 : (rand(n, 2) * 16 + bay) % 16 - 4
    const d = vuong ? 0.12 : 0.15
    vat(ds, [rand(n, 1) * 38 - 19 + Math.sin(T + n) * 0.5, roi, rand(n, 3) * 18 - 11], [d, d, d], bc.hat, { ry: T + n, rx: T, sang: 0.6, bo: d / 2 })
  }

  const a = cho[c.tu_cho], b = cho[c.den_cho], viec = c.hanh_dong
  const pd = pc.giat ? kep((TD - c.tu) / (c.den - c.tu)) : p
  let di = ['di', 'chay', 'leo'].includes(viec) ? pd : muot(pd), y = 0, dangLam = viec, doNga = 0
  if (viec === 'nhay') {
    di = muot(kep((pd - 0.12) / 0.7))
    if (a === b) y = Math.abs(Math.sin(pd * Math.PI * 2)) * 1.6
    else y = Math.sin(di * Math.PI) * 2.8
    if (a !== b && (pd < 0.12 || pd > 0.82)) dangLam = 'dung'
  }
  if (viec === 'nga') {
    di = kep(pd / 0.35)
    y = pd > 0.35 ? -(((pd - 0.35) / 0.65) ** 2) * 5 : Math.sin(di * Math.PI) * 0.5
    // Không có hố thì ngã sấp tại chỗ
    if (!ho || Math.abs(b) >= 4) {
      doNga = muot(kep((pd - 0.3) / 0.25)) * 1.35
      y = Math.sin(di * Math.PI) * 0.5 + doNga * 0.2
      if (pd > 0.5) dangLam = 'dung'
    }
  }
  const x = tron(a, b, di)
  y += caoLoi(mb, x)
  let huong = b < a ? -Math.PI / 2 : Math.PI / 2
  const phu = kb.nhan_vat_phu && c.phu && c.phu !== 'vang' ? c.phu : null
  const ai = c.noi || (viec === 'noi' ? 'chinh' : null)
  if (viec === 'mung') huong = 0.35
  else if (phu === 'doi-dien' && a === b) huong = c.phu_sau || (ho && tienCau < 1 && a < 0 && a + 2.3 > -4.6) ? -1.22 : 1.22
  else if (a === b && ['dung', 'nhin', 'noi'].includes(viec)) huong = 1.05
  if (c.huong !== undefined) huong = c.huong
  let cam = null
  // dau: [quay ngang, ngửa] tính theo radian, tới đủ sau 0,45 giây
  const dau = c.dau ? c.dau.map(v => v * muot(kep((T - c.tu) / 0.45))) : [0, 0]
  const m = kb.mua
  if (m && T >= m.bat && !(T >= m.roi)) cam = -2 + 0.7 * (m.nang === undefined ? 0 : muot(kep((T - m.nang) / 0.7)))
  if (!c.an) nhanVat(ds, kb.nhan_vat, vuong, [x, y, 0], huong, dangLam === 'noi' ? 'dung' : dangLam, TD, { noi: ai === 'chinh', do_nga: doNga, cam, dau, run: c.run ? 0.14 : 0 })

  let xp = null, yp = 0
  if (phu) {
    let zp = 0, viecP = 'dung', hp = huong
    if (phu === 'theo') {
      xp = x - 1.7; zp = ho && a !== b && tienCau >= 1 ? -0.6 : c.phu_run ? -0.8 : -1.4; yp = y - caoLoi(mb, x)
      if (['di', 'chay', 'nhay', 'leo', 'mung'].includes(dangLam)) viecP = dangLam
      if (viec === 'nga') { yp = 0; xp = a - 1.7; hp = Math.PI / 2 }
    } else if (phu === 'duoi') {
      xp = x - tron(5.2, 2.5, pd); zp = -0.35; hp = Math.PI / 2
      viecP = viec === 'nhay' ? 'nhay' : 'chay'
    } else {
      const satHo = c.phu_sau || (ho && tienCau < 1 && x < 0 && x + 2.3 > -4.6)
      xp = satHo ? x - 2.3 : x + 2.3; zp = -0.5; hp = satHo ? 1.2 : -1.2
      if (viec === 'mung') viecP = 'mung'
    }
    // Không đứng trên hố khi chưa có cầu: dừng ở mép cùng bờ, hoặc nhảy theo.
    if (ho && tienCau < 1 && Math.abs(xp) < 4.6) {
      if (viec === 'nhay' && a !== b && di > 0 && di < 1) { yp = Math.max(yp, Math.sin(kep((xp + 4.6) / 9.2) * Math.PI) * 2.6); viecP = 'nhay' }
      else { xp = x < 0 ? -4.7 : 4.7; zp = -1.5; yp = 0; if (viecP === 'chay') viecP = 'dung' }
    }
    let ngaP = 0
    if (c.phu_run) { xp += Math.sin(TD * 58) * 0.11; yp -= 0.1; ngaP = (phu === 'doi-dien' ? -0.12 : 0.24) + Math.sin(TD * 47) * 0.09 }
    yp += caoLoi(mb, xp)
    nhanVat(ds, kb.nhan_vat_phu, vuong, [xp, yp, zp], hp, viecP, TD + 0.37, { noi: ai === 'phu', do_nga: ngaP })
  }

  if (viec === 'dao') {
    const con = 1 - 0.45 * pd, rung = Math.sin(TD * 22) * 0.04
    vat(ds, [x + 1.35 + rung, y + con / 2, 0.25], [con, con, con], bc.da[1], { chat: vuong ? CHAT.da : 0, bo: 0.15, ry: 0.2 })
  }
  if (viec === 'dao' || viec === 'xay') for (let n = 0; n < 9; n++) {
    const u = (TD * 1.8 + n / 9) % 1, g = rand(n, 6) * 6.28
    vat(ds, [x + 1.1 + Math.cos(g) * u, y + Math.sin(u * Math.PI) * 1.1, Math.sin(g) * u], [0.16, 0.16, 0.16], bc.dat[n % 2], { ry: T * 5 + n, bo: 0.07 })
  }

  const e = muot(p), H = caoDich(mb), cy = caoLoi(mb, x)
  let mat, nhin, fov
  switch (c.may) {
    case 'toan': {
      const g = ((xp === null ? x : Math.min(x, xp)) + MOC_X) / 2 - 3.6
      mat = [g + tron(-21, -18, e), tron(13, 11, e) + H, tron(27, 23, e)]; nhin = [g, 3.2 + H / 2, 0]; fov = 66; break
    }
    case 'doi': {
      const gx = xp === null ? x : (x + xp) / 2, gy = xp === null ? y : (y + yp) / 2, lech = (ai === 'phu' ? 0.35 : ai === 'chinh' ? -0.35 : 0) * (xp !== null && xp < x ? -1 : 1)
      mat = [gx + lech * 3, gy + 2.9, tron(8, 6.9, e)]; nhin = [gx + lech, gy + 1.8, 0]; fov = 62; break
    }
    case 'can': {
      // Phụ nói thì cận phụ. Người quay lại thì máy sang phía mặt họ.
      const laPhu = xp !== null && (ai === 'phu' || (c.phu_run && !ai)), gx = laPhu ? xp : x, gy = laPhu ? yp : y
      const ben = !laPhu && phu === 'doi-dien' && huong < 0 ? -1 : 1
      mat = laPhu || ben < 0 ? [gx + ben * tron(1.4, 1.1, e), 2.4 + gy, tron(5.1, 4.5, e)] : [gx + ben * tron(4.6, 3.6, e), 2.8 + gy, tron(4.4, 3.5, e)]; nhin = [gx, 1.9 + gy, 0]; fov = 58; break
    }
    case 'ngang': mat = [x + tron(0.5, 2, e), 5.2 + cy + (y - cy) * 0.4, 12.5]; nhin = [x + 1.6, 0.7 + cy + (y - cy) * 0.6, 0]; fov = 62; break
    case 'theo': mat = [x - 5.4, 4.4 + cy + (y - cy) * 0.6, 3.6]; nhin = [x + 3.5, 2 + cy + (y - cy) * 0.6, 0]; fov = 66; break
    case 'vut': mat = [x + tron(1, -7, Math.min(1, e * 1.6)), tron(3, 12, Math.min(1, e * 1.6)) + cy, tron(7, 21, Math.min(1, e * 1.6))]; nhin = [tron(x, 11, Math.min(1, e * 1.6)), tron(2, 8, Math.min(1, e * 1.6)) + cy, 0]; fov = 68; break
    case 'tren': mat = [x - 2, tron(15, 12, e) + cy, 6.5]; nhin = [x + 1.5, y, 0]; fov = 58
  }
  if (xp !== null && c.may === 'ngang') {
    const g = (x + xp) / 2
    mat[0] = g + 0.6; nhin[0] = g + 0.4
  }
  if (xp !== null && c.may === 'theo') {
    // Đi cùng thì lùi máy ra, bị đuổi thì quay ngược lại từ phía trước
    if (phu === 'duoi') { mat = [x + 5.5, mat[1], 4.8]; nhin = [x - 2.2, nhin[1] - 0.3, 0] }
    else { mat = [x - 8.5, mat[1] + 0.5, 3.2]; nhin = [x + 1, nhin[1], -0.7] }
  }
  // Phép chiếu song song: pixel nhìn ngang, sa bàn nhìn chéo. Giữ ý của từng góc máy bằng cỡ khung.
  let cao = 0
  if (pc.chieu) {
    const ngang = pc.chieu === 'ngang'
    cao = ({ toan: 31, can: 9, doi: 12, ngang: 18, theo: 15, vut: tron(14, 27, muot(kep(p * 1.6))), tren: 20 })[c.may] * (ngang ? 1 : 1.15)
    let tx = x + 1, ty = cy + cao * 0.16 + (y - cy) * 0.6
    if (xp !== null && ['ngang', 'theo'].includes(c.may)) tx = (x + xp) / 2
    if (c.may === 'toan') {
      const trai = xp === null ? x : Math.min(x, xp)
      tx = (trai + MOC_X) / 2 + 0.6; ty = 3 + H / 2
      cao = Math.max(34, (MOC_X - trai + 5) * 1.78 * (ngang ? 1 : 0.9)) * tron(1.04, 1, e)
    }
    if (c.may === 'can') tx = x + 0.2
    if (c.may === 'doi' && xp !== null) tx = (x + xp) / 2
    if (c.may === 'vut') { const k = muot(kep(p * 1.6)); tx = tron(x, 11, k); ty = tron(cy + 2.5, H + 7, k) }
    if (!ngang) ty -= cao * 0.06
    const h = ngang ? [0, c.may === 'tren' ? 8 : 2.5, 38] : [17, c.may === 'tren' ? 38 : 25, 30]
    nhin = [tx, ty, 0]; mat = nhin.map((v, k) => v + h[k])
  }
  if (c.may_rieng) {
    const r = c.may_rieng, dau = r.tu, cuoi = r.den || r.tu, v = dau.map((u, k) => tron(u, cuoi[k], e))
    mat = v.slice(0, 3); nhin = v.slice(3); fov = r.fov || 60; cao = 0
  }
  if (bc.pho) muaDong(ds, bc, kb, T, { mat, nhin, xo: O_X })
  return { suong: c.suong, troi: c.troi, ds: new Float32Array(ds), mat, nhin, fov, cao, canh: c, p, sang, toa: kb.den_toa ? [MOC_X, ly, 0, sang ? 2 : 1] : [0, 0, 0, 0], pin: [x + 1.2, y + 2.3, 1.8] }
}
