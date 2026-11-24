// Phong cách "Đất sét diễn xuất" (dat-set-studio), bối cảnh "Bàn đất sét nắng".
//
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
//   - Tư thế, vị trí, hướng mặt, máy quay, sự kiện đều lấy từ dx (dien.js). Mô-đun này chỉ dựng hình.
//   - 1 đơn vị = chiều cao nhân vật, mặt đất y = 0, sân khấu x từ -3,2 tới 3,2, z = 0 là mặt phẳng diễn.
//   - Nhân vật chính lấy màu từ kb.nhan_vat; có kb.nhan_vat_phu thì vẽ thêm nhân vật phụ.
//   - Thứ lạ của phong cách là quái một mắt (dáng quai), hiện ở dx.hienX(T) khi có sự kiện hien.
//   - Hàm thuần theo T: không Math.random, không Date, không mạng, không requestAnimationFrame.
//     Mọi ngẫu nhiên dùng bam(seed). ve(T) gọi lặp hay bỏ khung đều ra cùng một hình.
//
// Nhìn: đất sét nặn, nắng studio ấm, bàn làm việc có đồ nghề; hình nhảy 12 khung/giây
// (lượng tử T cho tư thế và máy), rung hình nhỏ có seed theo bước cho ra chất stop-motion.

// Nhiễu tất định 0..1 (cùng seed luôn cùng số).
export const bam = n => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
const kep = (v, a, b) => (v < a ? a : v > b ? b : v)
// vượt nhẹ rồi trả về 1: dùng cho quái bật lên
const nay = k => { k = kep(k, 0, 1); const c = 1.70158, u = k - 1; return 1 + (c + 1) * u * u * u + c * u * u }

// ---- lưới nhiễu giá trị, đọc mượt bằng nội suy hai chiều ----
function luoiNhieu(seed, n) {
  const a = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) a[i] = bam(i * 1.13 + seed)
  return { a, n }
}
function docNhieu(L, x, y) {
  const n = L.n, xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const x0 = ((xi % n) + n) % n, x1 = (x0 + 1) % n
  const y0 = ((yi % n) + n) % n, y1 = (y0 + 1) % n
  const a = L.a
  const v0 = a[y0 * n + x0] + (a[y0 * n + x1] - a[y0 * n + x0]) * fx
  const v1 = a[y1 * n + x0] + (a[y1 * n + x1] - a[y1 * n + x0]) * fx
  return v0 + (v1 - v0) * fy
}

// ---- mép hơi méo: đẩy đỉnh theo hướng tâm một chút, tất định theo toạ độ đỉnh ----
function lamMeo(g, bien, seed) {
  const vt = g.attributes.position
  for (let i = 0; i < vt.count; i++) {
    const x = vt.getX(i), y = vt.getY(i), z = vt.getZ(i)
    const d = Math.hypot(x, y, z) || 1
    const n = bam(Math.round(x * 137 + y * 271 + z * 419 + seed) * 0.013) - 0.5
    const k = 1 + (n * bien) / d
    vt.setXYZ(i, x * k, y * k, z * k)
  }
  vt.needsUpdate = true
  g.computeVertexNormals()
}

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const FPS = 12 // nhịp stop-motion của phong cách
  const nv = kb.nhan_vat || {}
  const nvPhu = kb.nhan_vat_phu || null
  const mQuaiMac = pc.phu_mau || { than: '#8a4fc9', mat: '#ffffff', phu: '#ffd84d' }
  const toiHon = (h, k) => '#' + new THREE.Color(h || '#888888').multiplyScalar(k).getHexString()

  // ---------- 1. Bộ vẽ, cảnh, máy ----------
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace
  r.toneMapping = THREE.ACESFilmicToneMapping
  r.toneMappingExposure = 1.02
  r.shadowMap.enabled = true
  r.shadowMap.type = THREE.PCFSoftShadowMap

  const sc = new THREE.Scene()
  sc.background = new THREE.Color('#a9d0de')
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 60)

  const troi = new THREE.HemisphereLight('#fff2dd', '#8a6f5e', 1.1)
  sc.add(troi)
  const key = new THREE.DirectionalLight('#ffe9cf', 2.7)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 3.2, bottom: -2.2, near: 0.5, far: 14 })
  key.shadow.bias = -0.0006
  key.shadow.normalBias = 0.025
  key.shadow.radius = 5
  sc.add(key, key.target)
  const fill = new THREE.DirectionalLight('#a9ccff', 0.85)
  fill.position.set(4, 2.2, 4)
  sc.add(fill)

  // ---------- 2. Vân đất sét tự vẽ bằng canvas (không tải gì) ----------
  // Trả về bản đồ độ cao: hạt sần nhiều tầng, vết lõm, vân tay đồng tâm.
  function taoBump(seed, co, coVanTay) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = co
    const g = cv.getContext('2d')
    const L1 = luoiNhieu(seed, 26), L2 = luoiNhieu(seed + 5.3, 80)
    const im = g.createImageData(co, co), d = im.data
    for (let y = 0; y < co; y++) {
      const fy = y / co
      for (let x = 0; x < co; x++) {
        const fx = x / co
        const m = docNhieu(L1, fx * 5.5, fy * 5.5)
        const v = docNhieu(L2, fx * 26, fy * 26)
        const h = bam(x * 0.37 + y * 11.3 + seed)
        const val = kep(128 + (m - 0.5) * 42 + (v - 0.5) * 26 + (h - 0.5) * 18, 8, 248)
        const i = (y * co + x) * 4
        d[i] = d[i + 1] = d[i + 2] = val
        d[i + 3] = 255
      }
    }
    g.putImageData(im, 0, 0)
    // vết ấn ngón tay / đầu ngón ấn lõm
    const so = Math.round(co * 0.12)
    for (let i = 0; i < so; i++) {
      const x = bam(i * 3.1 + seed) * co, y = bam(i * 5.7 + seed * 1.7) * co
      const rad = 2 + bam(i * 2.3 + seed) * co * 0.05
      const gr = g.createRadialGradient(x, y, 0, x, y, rad)
      const sang = bam(i + seed * 9) > 0.5 ? 255 : 0
      gr.addColorStop(0, `rgba(${sang},${sang},${sang},0.2)`)
      gr.addColorStop(1, 'rgba(128,128,128,0)')
      g.fillStyle = gr
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    // vân tay: vài vòng elip đứt, nông; giữ mờ để không thành vân gỗ
    if (coVanTay) {
      for (let f = 0; f < 3; f++) {
        const cx = bam(f * 4.4 + seed) * co, cy = bam(f * 8.8 + seed) * co
        const rot = bam(f * 1.9 + seed) * 3.14
        g.save()
        g.translate(cx, cy)
        g.rotate(rot)
        const he = co / 256
        for (let k = 6 * he; k < co * 0.12; k += 4.4 * he) {
          g.strokeStyle = 'rgba(255,255,255,0.13)'
          g.lineWidth = 1 * he
          g.beginPath()
          g.ellipse(0, 0, k * 1.12, k, 0, 0.55, Math.PI * 2 - 0.55)
          g.stroke()
          g.strokeStyle = 'rgba(0,0,0,0.1)'
          g.beginPath()
          g.ellipse(0, 0, k * 1.12 + 1.2 * he, k + 1.2 * he, 0, 0.55, Math.PI * 2 - 0.55)
          g.stroke()
        }
        g.restore()
      }
      // vết lăn dài, nông: dấu cây cán đất
      for (let i = 0; i < 4; i++) {
        const y0 = bam(i * 7.1 + seed) * co
        g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'
        g.lineWidth = (2 + bam(i + seed) * 3) * (co / 256)
        g.beginPath()
        g.moveTo(0, y0)
        g.bezierCurveTo(co * 0.3, y0 + co * 0.05, co * 0.7, y0 - co * 0.04, co, y0 + co * 0.01)
        g.stroke()
      }
    }
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  }
  const bumpGoc = taoBump(3.7, 256, true)
  const texNho = bumpGoc // thân nhân vật: hạt mịn, có vân tay
  texNho.repeat.set(1.8, 1.8)
  const texVat = bumpGoc.clone() // đồ vật
  texVat.needsUpdate = true
  texVat.repeat.set(1.4, 1.4)
  const texSan = taoBump(11.3, 512, false) // mặt bàn
  texSan.repeat.set(9, 6)
  const texTuong = taoBump(21.7, 512, false) // tường
  texTuong.repeat.set(7, 4)

  // Màu tường: nắng ấm loang quanh mặt trời, tối dần về chân tường.
  function taoMapTuong() {
    const cv = document.createElement('canvas')
    cv.width = 512
    cv.height = 256
    const g = cv.getContext('2d')
    g.fillStyle = '#7fbcd8'
    g.fillRect(0, 0, 512, 256)
    const gr = g.createRadialGradient(512 * 0.45, 256 * 0.76, 6, 512 * 0.45, 256 * 0.76, 512 * 0.14)
    gr.addColorStop(0, 'rgba(255,232,180,0.5)')
    gr.addColorStop(0.4, 'rgba(255,226,170,0.2)')
    gr.addColorStop(1, 'rgba(255,226,170,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 512, 256)
    const lg = g.createLinearGradient(0, 0, 0, 256)
    lg.addColorStop(0, 'rgba(255,255,255,0.06)')
    lg.addColorStop(1, 'rgba(58,48,38,0.12)')
    g.fillStyle = lg
    g.fillRect(0, 0, 512, 256)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
  const mapTuong = taoMapTuong()

  // Hạt phim: tấm phủ trước máy, texel to nhỏ theo cạnh ngắn của khung.
  function taoHat(co) {
    const cv = document.createElement('canvas')
    cv.width = cv.height = co
    const g = cv.getContext('2d')
    const im = g.createImageData(co, co), d = im.data
    for (let i = 0; i < co * co; i++) {
      const v = bam(i * 0.731 + 4.2)
      const a = Math.pow(Math.abs(v - 0.5) * 2, 0.6) * 58
      const sang = v > 0.5
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = sang ? 255 : 0
      d[i * 4 + 3] = a
    }
    g.putImageData(im, 0, 0)
    const t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2, 2)
    return t
  }
  const texHat = taoHat(256)
  const hat = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texHat, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, toneMapped: false }),
  )
  hat.frustumCulled = false
  hat.renderOrder = 999
  hat.position.set(0, 0, -0.55)
  {
    // tấm phủ sát máy: texel hạt to nhỏ theo cạnh ngắn của khung, ít hao
    const hh = 2 * 0.55 * Math.tan((cam.fov * Math.PI) / 360) * 1.06
    hat.scale.set(hh * (W / H), hh, 1)
  }
  cam.add(hat)

  // ---------- 3. Vật liệu đất sét ----------
  const kho = new Map()
  function chat(mau, o = {}) {
    const khoa = [mau, o.bump === false ? 0 : 1, o.tex === texSan ? 's' : o.tex === texTuong ? 'w' : o.tex === texVat ? 'v' : 'n',
      o.bumpScale ?? 1, o.tho ?? 0.62].join('|')
    let m = kho.get(khoa)
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: mau, roughness: o.tho ?? 0.62, metalness: 0,
        bumpMap: o.bump === false ? null : o.tex || texNho,
        bumpScale: o.bumpScale ?? 1,
      })
      kho.set(khoa, m)
    }
    return m
  }

  // ---------- 4. Hình cơ bản (dùng lại, không tạo mới mỗi khung) ----------
  const gCau = new THREE.SphereGeometry(1, 22, 16)
  lamMeo(gCau, 0.03, 4.7)
  const gTru = new THREE.CylinderGeometry(1, 1, 1, 16, 1)
  lamMeo(gTru, 0.02, 8.1)
  const gHop = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2)
  lamMeo(gHop, 0.012, 2.2)
  const gNon = new THREE.ConeGeometry(1, 1, 14)
  lamMeo(gNon, 0.02, 6.4)
  const gTorus = new THREE.TorusGeometry(1, 0.22, 8, 20)
  const gCung = new THREE.TorusGeometry(1, 0.3, 6, 12, Math.PI)

  // them(cha, geo, mat, x, y, z, sx, sy, sz, bong)
  function them(cha, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, bong = true) {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, y, z)
    m.scale.set(sx, sy, sz)
    m.castShadow = bong
    m.receiveShadow = true
    cha.add(m)
    return m
  }

  // ---------- 5. Sân khấu: bàn đất sét, tường, nắng ----------
  const san = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), chat('#e7cb97', { tex: texSan, bumpScale: 1.8, tho: 0.86 }))
  san.rotation.x = -Math.PI / 2
  san.position.set(0, 0, -3.5)
  san.receiveShadow = true
  sc.add(san)

  const tuong = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 9),
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: mapTuong, roughness: 0.92, metalness: 0, bumpMap: texTuong, bumpScale: 0.7 }),
  )
  tuong.position.set(0, 4.5, -3.6)
  tuong.receiveShadow = true
  sc.add(tuong)
  them(sc, gHop, chat('#c9e2ea', { tex: texTuong, bumpScale: 0.5 }), 0, 0.09, -3.55, 30, 0.18, 0.08)

  // mặt trời đất sét
  const matTroi = new THREE.Group()
  matTroi.position.set(-2.2, 2.35, -3.5)
  sc.add(matTroi)
  const dia = them(matTroi, gTru, chat('#ffd35e', { tex: texVat, bumpScale: 0.7, tho: 0.55 }), 0, 0, 0, 0.22, 0.06, 0.22)
  dia.rotation.x = Math.PI / 2
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    them(matTroi, gHop, chat('#ffe08c', { tex: texVat, bumpScale: 0.5 }), Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.02, 0.12, 0.03, 0.025).rotation.z = a
  }

  // mây đất sét
  const dam = (x, y, s) => {
    const g = new THREE.Group()
    g.position.set(x, y, -3.55)
    sc.add(g)
    for (const [ox, oy, r] of [[-0.17, -0.02, 0.14], [0.04, 0.03, 0.18], [0.26, -0.03, 0.12], [0.02, -0.09, 0.13]])
      them(g, gCau, chat('#eaf6fb', { tex: texVat, bumpScale: 0.5, tho: 0.9 }), ox * s, oy * s, 0, r * 1.5 * s, r * s, 0.09)
  }
  dam(2.45, 2.72, 1)
  dam(-3.15, 2.6, 0.9)

  // tranh treo tường (điền cho nền đỡ trống)
  function tranh(x, y, w, h, kieu) {
    const g = new THREE.Group()
    g.position.set(x, y, -3.55)
    sc.add(g)
    them(g, gHop, chat('#f0e1c0', { tex: texVat, bumpScale: 0.6 }), 0, 0, 0, w, h, 0.06)
    them(g, gHop, chat('#fff6e2', { tex: texVat, bumpScale: 0.4 }), 0, 0, 0.04, w * 0.8, h * 0.78, 0.02)
    if (kieu === 'mat') {
      them(g, gCau, chat('#2b2020', { bump: false, tho: 0.4 }), -w * 0.12, h * 0.1, 0.06, 0.022, 0.022, 0.012, false)
      them(g, gCau, chat('#2b2020', { bump: false, tho: 0.4 }), w * 0.12, h * 0.1, 0.06, 0.022, 0.022, 0.012, false)
      them(g, gCung, chat('#2b2020', { bump: false, tho: 0.5 }), 0, -h * 0.04, 0.06, 0.09, 0.09, 0.09, false).rotation.z = Math.PI
    } else {
      them(g, gHop, chat('#2f9e8f', { tex: texVat, bumpScale: 0.4 }), 0, h * 0.14, 0.06, w * 0.5, 0.022, 0.012, false)
      them(g, gHop, chat('#e84a3a', { tex: texVat, bumpScale: 0.4 }), -w * 0.08, h * 0.02, 0.06, w * 0.36, 0.02, 0.012, false).rotation.z = 0.12
      them(g, gHop, chat('#8a4fc9', { tex: texVat, bumpScale: 0.4 }), w * 0.06, -h * 0.1, 0.06, w * 0.44, 0.02, 0.012, false).rotation.z = -0.08
    }
  }
  tranh(-2.95, 2.06, 0.52, 0.4, 'net')
  tranh(2.85, 2.02, 0.46, 0.36, 'mat')

  // kệ ngắn rải dọc tường: luôn có thứ trong khung dù máy bám chỗ nào
  const keDai = new THREE.Group()
  sc.add(keDai)
  const mauKe = ['#e84a3a', '#2f9e8f', '#ffd84d', '#8a4fc9', '#f0b98e', '#8fbbd0']
  for (let m = 0; m < 5; m++) {
    const x0 = -6.2 + m * 2.45
    const y0 = 1.14 + (m % 2) * 0.09
    // gờ đất sét dán sát tường, không phải cái bàn con
    them(keDai, gHop, chat('#dcb98a', { tex: texSan, bumpScale: 0.8 }), x0, y0, -3.56, 1.45, 0.07, 0.22)
    for (let i = 0; i < 3; i++) {
      const x = x0 - 0.42 + i * 0.42
      const mau = mauKe[(m * 3 + i) % mauKe.length]
      const loai = (m + i) % 3
      if (loai === 0) {
        const h = 0.14 + bam(m * 7.1 + i) * 0.09
        them(keDai, gTru, chat(mau, { tex: texVat, bumpScale: 0.7, tho: 0.52 }), x, y0 + 0.035 + h / 2, -3.51, 0.06, h, 0.06)
        them(keDai, gTorus, chat('#f6e6c8', { tex: texVat, bumpScale: 0.4 }), x, y0 + 0.035 + h, -3.51, 0.06, 0.06, 0.06).rotation.x = Math.PI / 2
      } else if (loai === 1) {
        them(keDai, gCau, chat(mau, { tex: texVat, bumpScale: 0.8 }), x, y0 + 0.085, -3.51, 0.095, 0.062, 0.09)
        them(keDai, gCau, chat('#6fbf63', { tex: texVat, bumpScale: 0.7 }), x + 0.055, y0 + 0.155, -3.49, 0.05, 0.045, 0.05)
      } else {
        for (let k = 0; k < 3; k++) them(keDai, gTru, chat(k % 2 ? '#f6e6c8' : mau, { tex: texVat, bumpScale: 0.5 }), x, y0 + 0.035 + k * 0.026, -3.51, 0.075 - k * 0.008, 0.024, 0.075 - k * 0.008)
      }
    }
  }
  // kệ là gờ dán tường: không đổ bóng lên tường cho sạch nền
  keDai.traverse(o => { if (o.isMesh) o.castShadow = false })

  // ---------- 6. Đồ nghề đất sét trên bàn ----------
  const cauDat = (x, z, r, mau, y) => them(sc, gCau, chat(mau, { tex: texVat, bumpScale: 1.1 }), x, y === undefined ? r * 0.9 : y, z, r, r * 0.94, r)

  // viên đất rải hai bên (phủ sân khấu, không chắn chỗ diễn)
  cauDat(1.98, -0.78, 0.13, '#e84a3a')
  cauDat(2.2, -0.6, 0.09, '#2f9e8f')
  cauDat(2.33, -0.87, 0.11, '#ffd84d')
  cauDat(2.05, -1.02, 0.08, '#8a4fc9')
  cauDat(1.8, -0.95, 0.07, '#f0b98e')
  cauDat(-1.62, 0.52, 0.062, '#e84a3a')
  cauDat(0.93, 0.6, 0.047, '#2f9e8f')
  cauDat(-0.42, -0.92, 0.055, '#8a4fc9')
  cauDat(-2.02, -0.42, 0.05, '#ffd84d')

  // đồ nhỏ sát chân nhân vật, phía sau mặt phẳng diễn: giữ khung cận có chi tiết
  cauDat(-0.28, -0.4, 0.05, '#e84a3a', 0.045)
  cauDat(0.44, -0.36, 0.038, '#ffd84d', 0.035)
  them(sc, gTru, chat('#c97a52', { tex: texVat, bumpScale: 0.9 }), 0.72, 0.06, -0.33, 0.055, 0.12, 0.055)
  them(sc, gCau, chat('#6fbf63', { tex: texVat, bumpScale: 0.8 }), 0.72, 0.14, -0.33, 0.06, 0.045, 0.06)
  them(sc, gCau, chat('#a9a5b0', { tex: texVat, bumpScale: 0.9 }), -1.05, 0.06, -0.3, 0.09, 0.055, 0.08)
  for (let k = 0; k < 3; k++) them(sc, gTru, chat(k % 2 ? '#f6e6c8' : '#e84a3a', { tex: texVat, bumpScale: 0.6 }), 1.5, 0.025 + k * 0.026, -0.3, 0.07 - k * 0.008, 0.024, 0.07 - k * 0.008)

  // chậu cây
  const cay = new THREE.Group()
  cay.position.set(-3.32, 0, -1.5)
  sc.add(cay)
  them(cay, gTru, chat('#c97a52', { tex: texVat, bumpScale: 1 }), 0, 0.12, 0, 0.15, 0.24, 0.15)
  them(cay, gTorus, chat('#d98a62', { tex: texVat, bumpScale: 0.6 }), 0, 0.235, 0, 0.15, 0.15, 0.15).rotation.x = Math.PI / 2
  them(cay, gCau, chat('#5a3a28', { tex: texSan, bumpScale: 0.6 }), 0, 0.24, 0, 0.13, 0.02, 0.13)
  for (let i = 0; i < 5; i++) {
    const a = i * 1.256 + 0.4
    const la = them(cay, gCau, chat(i % 2 ? '#5fae5a' : '#6fbf63', { tex: texVat, bumpScale: 1 }), Math.cos(a) * 0.16, 0.35 + (i % 3) * 0.05, Math.sin(a) * 0.11, 0.14, 0.07, 0.11)
    la.rotation.z = Math.cos(a) * 0.45
    la.rotation.y = -a
  }
  them(cay, gCau, chat('#ffd84d', { tex: texVat, bumpScale: 0.8 }), 0.02, 0.5, 0, 0.05, 0.03, 0.05)
  for (let i = 0; i < 6; i++) {
    const a = i * 1.047
    them(cay, gCau, chat('#ff8fb3', { tex: texVat, bumpScale: 0.7 }), 0.02 + Math.cos(a) * 0.06, 0.5, Math.sin(a) * 0.06, 0.028, 0.014, 0.028)
  }

  // nấm
  const nam = new THREE.Group()
  nam.position.set(-1.92, 0, -0.95)
  sc.add(nam)
  them(nam, gTru, chat('#f6ecd8', { tex: texVat, bumpScale: 0.8 }), 0, 0.09, 0, 0.05, 0.18, 0.05)
  them(nam, gCau, chat('#d9453a', { tex: texVat, bumpScale: 1 }), 0, 0.195, 0, 0.17, 0.09, 0.17)
  for (const [x, z] of [[0.06, 0.05], [-0.07, 0.04], [0, -0.09]]) them(nam, gCau, chat('#fff4e0'), x, 0.24, z, 0.026, 0.012, 0.026, false)
  them(nam, gTru, chat('#f6ecd8', { tex: texVat, bumpScale: 0.8 }), 0.19, 0.05, 0.06, 0.032, 0.1, 0.032)
  them(nam, gCau, chat('#e0574a', { tex: texVat, bumpScale: 1 }), 0.19, 0.11, 0.06, 0.1, 0.055, 0.1)

  // tờ giấy + bút
  const giay = new THREE.Group()
  giay.position.set(-0.78, 0, -0.56)
  giay.rotation.y = 0.16
  sc.add(giay)
  them(giay, gHop, chat('#f2e6cc', { tex: texVat, bumpScale: 0.35, tho: 0.8 }), 0, 0.006, 0, 0.66, 0.012, 0.46)
  for (let i = 0; i < 4; i++)
    them(giay, gHop, chat('#b7a380', { bump: false, tho: 0.8 }), -0.04, 0.014, -0.12 + i * 0.08, 0.34 - i * 0.03, 0.003, 0.012, false)
  them(giay, gCung, chat('#2f9e8f', { bump: false, tho: 0.6 }), 0.16, 0.016, 0.1, 0.05, 0.05, 0.05, false).rotation.z = Math.PI

  const but = new THREE.Group()
  but.position.set(-0.72, 0.032, -0.44)
  but.rotation.y = 0.62
  sc.add(but)
  them(but, gTru, chat('#2f9e8f', { tex: texVat, bumpScale: 0.5, tho: 0.45 }), 0, 0, 0, 0.019, 0.34, 0.019).rotation.z = Math.PI / 2
  them(but, gTru, chat('#e84a3a', { tex: texVat, bumpScale: 0.5, tho: 0.45 }), -0.15, 0, 0, 0.022, 0.06, 0.022).rotation.z = Math.PI / 2
  them(but, gNon, chat('#f6e6c8', { tex: texVat, bumpScale: 0.4, tho: 0.4 }), 0.185, 0, 0, 0.019, 0.055, 0.019).rotation.z = -Math.PI / 2
  them(but, gHop, chat('#e84a3a', { tex: texVat, bumpScale: 0.3, tho: 0.5 }), -0.15, 0.02, 0, 0.07, 0.012, 0.012, false)

  // cốc đất sét có bút chì
  const coc = new THREE.Group()
  coc.position.set(1.05, 0, -0.78)
  sc.add(coc)
  them(coc, gTru, chat('#f3e3c4', { tex: texVat, bumpScale: 0.8, tho: 0.68 }), 0, 0.12, 0, 0.13, 0.24, 0.13)
  them(coc, gCau, chat('#6b4a3a', { tex: texVat, bumpScale: 0.5 }), 0, 0.225, 0, 0.108, 0.02, 0.108)
  them(coc, gTorus, chat('#f3e3c4', { tex: texVat, bumpScale: 0.6 }), 0, 0.24, 0, 0.13, 0.13, 0.13).rotation.x = Math.PI / 2
  them(coc, gTorus, chat('#f3e3c4', { tex: texVat, bumpScale: 0.6 }), 0.135, 0.13, 0, 0.06, 0.075, 0.06)
  them(coc, gHop, chat('#e84a3a', { tex: texVat, bumpScale: 0.5 }), 0, 0.15, 0.13, 0.15, 0.05, 0.02)
  them(coc, gTru, chat('#e8b048', { tex: texVat, bumpScale: 0.5 }), 0.03, 0.3, 0.01, 0.012, 0.26, 0.012).rotation.z = 0.26
  them(coc, gNon, chat('#3a2a26', { bump: false, tho: 0.4 }), 0.062, 0.425, 0.01, 0.012, 0.04, 0.012).rotation.z = 0.26

  // khay đất + dụng cụ nặn
  const khay = new THREE.Group()
  khay.position.set(-1.28, 0, -1.34)
  sc.add(khay)
  them(khay, gHop, chat('#c9a06f', { tex: texVat, bumpScale: 0.8 }), 0, 0.035, 0, 0.44, 0.07, 0.32)
  for (const [x, mau] of [[-0.13, '#e84a3a'], [0, '#ffd84d'], [0.13, '#2f9e8f']])
    them(khay, gCau, chat(mau, { tex: texVat, bumpScale: 0.7 }), x, 0.085, 0, 0.055, 0.04, 0.055)
  them(khay, gTru, chat('#a87a4f', { tex: texVat, bumpScale: 0.6 }), 0.26, 0.05, 0.04, 0.014, 0.24, 0.014).rotation.z = -0.5
  them(khay, gHop, chat('#8a6a46', { tex: texVat, bumpScale: 0.4 }), 0.32, 0.1, 0.04, 0.07, 0.02, 0.02).rotation.z = -0.5

  // lọ đựng cọ
  const lo = new THREE.Group()
  lo.position.set(2.62, 0, -1.2)
  sc.add(lo)
  them(lo, gTru, chat('#8fb9cf', { tex: texVat, bumpScale: 0.8, tho: 0.55 }), 0, 0.1, 0, 0.1, 0.2, 0.1)
  them(lo, gTorus, chat('#8fb9cf', { tex: texVat, bumpScale: 0.5 }), 0, 0.2, 0, 0.1, 0.1, 0.1).rotation.x = Math.PI / 2
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.3
    them(lo, gTru, chat(i % 2 ? '#e8b048' : '#c9a06f', { tex: texVat, bumpScale: 0.5 }), Math.cos(a) * 0.03, 0.3, Math.sin(a) * 0.03, 0.009, 0.3, 0.009).rotation.set(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.12)
  }

  // hoa nhỏ + sỏi
  for (const [x, z, c] of [[-2.24, -0.58, '#ff8fb3'], [-2.09, -0.72, '#ffc54a'], [2.05, -0.36, '#ff8fb3'], [-2.42, -0.35, '#ffc54a']]) {
    const g = new THREE.Group()
    g.position.set(x, 0, z)
    sc.add(g)
    them(g, gTru, chat('#4f9a4a', { tex: texVat, bumpScale: 0.5 }), 0, 0.11, 0, 0.012, 0.22, 0.012)
    them(g, gCau, chat(c, { tex: texVat, bumpScale: 0.6 }), 0, 0.23, 0, 0.06, 0.04, 0.06)
    them(g, gCau, chat('#fff0a0', { tex: texVat, bumpScale: 0.5 }), 0, 0.25, 0.02, 0.028, 0.02, 0.028)
  }
  const soi = [[-1.15, -0.32, 0.045, '#a9a5b0'], [1.45, -0.34, 0.04, '#9a96a2'], [-0.05, -1.15, 0.05, '#a9a5b0'],
    [0.35, -1.25, 0.04, '#b6b0a6'], [-2.55, -0.5, 0.045, '#9a96a2'], [2.75, -0.55, 0.05, '#a9a5b0'], [1.62, 0.42, 0.035, '#b6b0a6']]
  for (const [x, z, r, mau] of soi) them(sc, gCau, chat(mau, { tex: texVat, bumpScale: 1 }), x, r * 0.8, z, r, r * 0.7, r * 0.9)

  // ---------- 7. Nhân vật người (dùng cho chính và phụ dáng người) ----------
  // Mọi toạ độ khớp là toạ độ cục bộ quanh gốc chân (đã trừ p.x), nhóm nhân vật đặt tại p.x.
  function taoNguoi(nvN, tiLe) {
    const C = {
      than: nvN.than || '#f0b98e', mat: nvN.mat || '#ffffff', ao: nvN.ao || '#2f9e8f',
      quan: nvN.quan || '#283a8c', phu: nvN.phu || '#e84a3a',
    }
    const mThan = chat(C.than, { bumpScale: 1.6, tho: 0.6 })
    const mAo = chat(C.ao, { bumpScale: 1.4, tho: 0.66 })
    const mQuan = chat(C.quan, { bumpScale: 1.4, tho: 0.7 })
    const mPhu = chat(C.phu, { bumpScale: 1.1, tho: 0.55 })
    const mMat = chat(C.mat, { bump: false, tho: 0.4 })
    const mToi = chat('#2b1a1c', { bump: false, tho: 0.32 })
    const mMieng = chat('#5a1e24', { bump: false, tho: 0.5 })
    const mLuoi = chat('#ef7d86', { bump: false, tho: 0.5 })
    const mToiDa = chat(toiHon(C.than, 0.62), { bumpScale: 0.9, tho: 0.6 })
    const mToc = chat(toiHon(C.than, 0.42), { bumpScale: 1.2, tho: 0.62 })

    const g = new THREE.Group()
    g.scale.setScalar(tiLe)

    // thân, mông, cổ áo
    const than = them(g, gCau, mAo, 0, 0.15, 0, 0.104, 0.185, 0.092)
    const hong = them(g, gCau, mQuan, 0, 0, 0, 0.102, 0.075, 0.09)
    const khan = them(g, gTorus, mPhu, 0, 0.3, 0, 0.07, 0.07, 0.07)
    khan.rotation.x = Math.PI / 2

    // đầu: nhóm nghiêng (z) lồng nhóm xoay yaw (y)
    const dauG = new THREE.Group()
    const dauX = new THREE.Group()
    dauG.add(dauX)
    g.add(dauG)
    const R = 0.135
    them(dauX, gCau, mThan, 0, 0, 0, R, R * 0.96, R * 0.97)
    for (const s of [-1, 1]) them(dauX, gCau, mThan, s * R * 0.95, -0.005, 0, 0.024, 0.036, 0.019)
    them(dauX, gCau, mThan, 0, -0.012, R * 0.93, 0.024, 0.018, 0.017, false)
    // tóc: mấy nắm đất cùng màu, đậm hơn da, ôm sát đỉnh đầu
    for (const [x, y, z, s] of [[0, 0.121, -0.012, 0.044], [0.052, 0.114, -0.02, 0.033], [-0.052, 0.114, -0.02, 0.033], [0, 0.092, -0.082, 0.044], [0.028, 0.132, 0.028, 0.022]])
      them(dauX, gCau, mToc, x, y, z, s, s * 0.8, s)

    // mắt, tròng, lông mày, miệng
    const mat = { trang: [], trong: [], may: [] }
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1
      const eg = new THREE.Group()
      eg.position.set(s * 0.045, 0.016, 0.108)
      dauX.add(eg)
      mat.trang.push(them(eg, gCau, mMat, 0, 0, 0, 0.035, 0.042, 0.026, false))
      mat.trong.push(them(eg, gCau, mToi, 0, 0, 0.018, 0.023, 0.027, 0.013, false))
      const mg = new THREE.Group()
      mg.position.set(s * 0.047, 0.076, 0.098)
      dauX.add(mg)
      mat.may.push({ g: mg, m: them(mg, gCau, mToc, 0, 0, 0, 0.025, 0.0065, 0.01, false) })
    }
    const miengG = new THREE.Group()
    miengG.position.set(0, -0.055, 0.118)
    dauX.add(miengG)
    const mieng = them(miengG, gCau, mMieng, 0, 0, 0, 0.032, 0.008, 0.014, false)
    const luoi = them(miengG, gCau, mLuoi, 0, -0.006, 0.013, 0.018, 0.01, 0.009, false)
    const cung = them(miengG, gCung, mMieng, 0, 0.012, 0.002, 0.026, 0.02, 0.026, false)
    cung.rotation.z = Math.PI
    cung.visible = false

    // tay: vai, bắp tay, khuỷu, cẳng tay, bàn có ngón
    const tay = {}
    for (const [ten, s] of [['P', 1], ['T', -1]]) {
      const o = {}
      o.vai = them(g, gCau, mAo, 0, 0, 0, 0.045, 0.045, 0.045)
      o.tren = them(g, gTru, mAo, 0, 0, 0)
      o.khuyu = them(g, gCau, mThan, 0, 0, 0, 0.035, 0.035, 0.035)
      o.duoi = them(g, gTru, mThan, 0, 0, 0)
      o.ban = them(g, gCau, mThan, 0, 0, 0, 0.049, 0.056, 0.042)
      o.ngon = []
      for (let k = 0; k < 3; k++) o.ngon.push(them(g, gCau, mThan, 0, 0, 0, 0.015, 0.026, 0.015, false))
      o.s = s
      tay[ten] = o
    }
    // chân
    const chan = {}
    for (const [ten, s] of [['P', 1], ['T', -1]]) {
      const o = {}
      o.hong = them(g, gCau, mQuan, 0, 0, 0, 0.053, 0.053, 0.053)
      o.dui = them(g, gTru, mQuan, 0, 0, 0)
      o.goi = them(g, gCau, mQuan, 0, 0, 0, 0.045, 0.045, 0.045)
      o.cang = them(g, gTru, mThan, 0, 0, 0)
      o.co = them(g, gCau, mThan, 0, 0, 0, 0.04, 0.04, 0.04)
      o.giay = them(g, gCau, mPhu, 0, 0, 0, 0.06, 0.035, 0.095)
      o.s = s
      chan[ten] = o
    }

    const doan = (m, a, b, r, z) => {
      const dxa = b[0] - a[0], dya = b[1] - a[1]
      const L = Math.hypot(dxa, dya) || 1e-4
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z)
      m.scale.set(r, L, r)
      m.rotation.set(0, 0, Math.atan2(dya, dxa) - Math.PI / 2)
    }

    // Bảng biểu cảm mắt: mx,my = cỡ mắt; px,py = cỡ tròng; nx,ny = lệch tròng.
    const BIEU = {
      thuong: { mx: 0.035, my: 0.042, px: 0.022, py: 0.026, nx: 0.006, ny: 0 },
      lieng: { mx: 0.033, my: 0.037, px: 0.021, py: 0.024, nx: 0.013, ny: 0 },
      'mo-to': { mx: 0.043, my: 0.05, px: 0.021, py: 0.025, nx: 0.01, ny: 0.002 },
      so: { mx: 0.049, my: 0.057, px: 0.017, py: 0.021, nx: 0.01, ny: 0.007 },
      vui: { mx: 0.038, my: 0.02, px: 0.023, py: 0.018, nx: 0.008, ny: 0.005 },
      ngai: { mx: 0.035, my: 0.037, px: 0.022, py: 0.024, nx: 0.014, ny: -0.005 },
      buon: { mx: 0.035, my: 0.027, px: 0.022, py: 0.02, nx: 0.009, ny: -0.008 },
      nham: { mx: 0.035, my: 0.005, px: 0.019, py: 0.016, nx: 0.008, ny: 0 },
      gian: { mx: 0.039, my: 0.027, px: 0.022, py: 0.022, nx: 0.01, ny: 0.002 },
    }
    // Cấu hình miệng: mo = bề dày mở, rong = bề ngang.
    const MIENG = {
      dong: [0.006, 0.03], noi: [0.012, 0.03], o: [0.02, 0.022], het: [0.044, 0.032],
      run: [0.011, 0.028], cuoi: [0.018, 0.04], 'cuoi-guong': [0.012, 0.036], buon: [0.007, 0.026], gam: [0.014, 0.04],
    }

    function dat(k, p, buoc, xGoc) {
      const J = (pt, id) => [
        pt[0] - xGoc + (bam(buoc * 2.7 + id * 9.1) - 0.5) * 0.005,
        pt[1] + (bam(buoc * 4.3 + id * 5.7) - 0.5) * 0.005,
      ]
      const K = {
        hong: J(k.hong, 1), coGoc: J(k.coGoc, 2), dau: J(k.dau, 3),
        vaiP: J(k.vaiP, 4), vaiT: J(k.vaiT, 5), khuyuP: J(k.khuyuP, 6), khuyuT: J(k.khuyuT, 7),
        banP: J(k.banP, 8), banT: J(k.banT, 9), hongP: J(k.hongP, 10), hongT: J(k.hongT, 11),
        goiP: J(k.goiP, 12), goiT: J(k.goiT, 13), coChanP: J(k.coChanP, 14), coChanT: J(k.coChanT, 15),
      }
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw)
      // bề rộng 3D: vai và hông tách theo trục ngang của thân, không chỉ theo màn hình
      const zVaiP = 0.1 * c, zVaiT = -0.1 * c
      const zHongP = 0.05 * c, zHongT = -0.05 * c
      K.vaiP[0] += 0.025 * s
      K.vaiT[0] -= 0.025 * s

      g.position.set(p.x + (bam(buoc * 3.1 + 7) - 0.5) * 0.003, (bam(buoc * 5.9 + 8) - 0.5) * 0.002, 0)
      g.rotation.z = (bam(buoc * 4.3 + 9) - 0.5) * 0.01

      // thân nghiêng theo p.lean; đầu nghiêng + xoay yaw thật
      const mx = (K.hong[0] + K.coGoc[0]) / 2, my = (K.hong[1] + K.coGoc[1]) / 2
      than.position.set(mx, my, 0)
      than.rotation.z = -p.lean
      than.scale.set(0.104, 0.185, 0.092)
      hong.position.set(K.hong[0], K.hong[1], 0)
      khan.position.set(K.coGoc[0], K.coGoc[1] - 0.022, 0)
      dauG.position.set(K.dau[0], K.dau[1], 0)
      dauG.rotation.z = -(p.lean + p.dauNghieng)
      // quay đầu chếch về máy một chút như rối đất sét: nhìn nghiêng vẫn đọc được mặt
      dauX.rotation.y = Math.PI / 2 - p.yaw - 0.55 * Math.cos(p.yaw)

      // tay
      for (const ten of ['P', 'T']) {
        const o = tay[ten]
        const z = ten === 'P' ? zVaiP : zVaiT
        const vaiP = ten === 'P' ? K.vaiP : K.vaiT
        const khuyu = ten === 'P' ? K.khuyuP : K.khuyuT
        const ban = ten === 'P' ? K.banP : K.banT
        o.vai.position.set(vaiP[0], vaiP[1], z)
        doan(o.tren, vaiP, khuyu, 0.04, z)
        o.khuyu.position.set(khuyu[0], khuyu[1], z)
        doan(o.duoi, khuyu, ban, 0.033, z)
        o.ban.position.set(ban[0], ban[1], z)
        const gocTay = Math.atan2(ban[1] - khuyu[1], ban[0] - khuyu[0])
        o.ban.rotation.z = gocTay
        // ba ngón đất sét nhỏ ở đầu bàn tay
        for (let k = 0; k < 3; k++) {
          const l = 0.03 + k * 0.002
          o.ngon[k].position.set(ban[0] + Math.cos(gocTay) * l + o.s * (k - 1) * 0.012, ban[1] + Math.sin(gocTay) * l, z + 0.01)
          o.ngon[k].rotation.z = gocTay
        }
      }
      // chân
      for (const ten of ['P', 'T']) {
        const o = chan[ten]
        const z = ten === 'P' ? zHongP : zHongT
        const hp = ten === 'P' ? K.hongP : K.hongT
        const goi = ten === 'P' ? K.goiP : K.goiT
        const co = ten === 'P' ? K.coChanP : K.coChanT
        // hai chân hơi mở cho khỏi dính thành một ở góc nhìn nghiêng
        const moX = ten === 'P' ? 0.012 : -0.012
        hp[0] += moX; goi[0] += moX; co[0] += moX
        o.hong.position.set(hp[0], hp[1], z)
        doan(o.dui, hp, goi, 0.052, z)
        o.goi.position.set(goi[0], goi[1], z)
        doan(o.cang, goi, co, 0.042, z)
        o.co.position.set(co[0], co[1], z)
        o.giay.position.set(co[0] + 0.004, co[1], z + 0.028)
        o.giay.rotation.set(0, 0, p.nga > 0.01 ? (k.gocNga || 0) : 0)
      }

      // mặt: mắt, lông mày, miệng
      const m = BIEU[p.chop ? 'chop' : p.mat] || BIEU.thuong
      const chop = p.chop && p.mat !== 'nham'
      const matY = chop ? 0.004 : m.my
      const matX = m.mx
      const pupilY = (chop ? 0 : m.ny) * (p.mat === 'so' ? 1.2 : 1)
      for (let i = 0; i < 2; i++) {
        const sgn = i ? 1 : -1
        mat.trang[i].scale.set(matX, matY, 0.026)
        mat.trong[i].scale.set(m.px, chop ? 0.006 : m.py, 0.013)
        mat.trong[i].position.set(sgn * 0.002 + m.nx * s * 0.9, pupilY, 0.018)
        // lông mày: dáng theo p.longMay
        let cao = 0, nghieng = 0
        const lm = p.longMay || 'thuong'
        if (lm === 'vui') cao = 0.01
        else if (lm === 'nhuong') cao = 0.012
        else if (lm === 'lo') { cao = 0.009; nghieng = 0.16 }
        else if (lm === 'nghi') cao = 0.006
        else if (lm === 'buon') { cao = -0.004; nghieng = 0.18 }
        else if (lm === 'gian') { cao = -0.007; nghieng = -0.24 }
        if (p.mat === 'gian') nghieng = Math.min(nghieng, -0.2)
        mat.may[i].g.position.y = 0.076 + cao
        mat.may[i].m.rotation.z = mat.may[i].g.position.x < 0 ? nghieng : -nghieng
      }

      const mm = MIENG[p.mieng] || MIENG.dong
      let mo = mm[0]
      if (p.mieng === 'noi') mo = 0.006 + 0.034 * (p.mieng_mo || 0)
      else if (p.mieng === 'run') mo = 0.011 + 0.004 * Math.sin(buoc * 1.6)
      const rong = mm[1]
      mieng.scale.set(rong, Math.max(0.004, mo), 0.014)
      mieng.position.y = -mo * 0.25
      luoi.visible = mo > 0.022
      luoi.scale.set(rong * 0.5, Math.max(0.006, mo * 0.45), 0.01)
      luoi.position.y = -mo * 0.55
      const coCung = p.mieng === 'cuoi' || p.mieng === 'cuoi-guong' || p.mieng === 'buon' || p.mieng === 'gam'
      cung.visible = coCung
      cung.rotation.z = p.mieng === 'buon' ? 0 : Math.PI
      cung.position.y = p.mieng === 'buon' ? -0.004 : 0.016
      cung.scale.set(rong * 0.82, Math.min(0.03, mo * 0.9 + 0.012), 0.026)
    }

    return { nhom: g, dat, m: { than, dauG, dauX, mat, mieng, cung } }
  }

  const nguoi = taoNguoi(nv, 1)
  sc.add(nguoi.nhom)
  const nguoiPhu = nvPhu && (nvPhu.dang === 'nguoi' || nvPhu.dang === 'vien') ? taoNguoi(nvPhu, 0.84) : null
  if (nguoiPhu) { nguoiPhu.nhom.visible = false; sc.add(nguoiPhu.nhom) }

  // ---------- 8. Quái một mắt bằng đất sét ----------
  function taoQuai(nvQ) {
    const mThan = chat(nvQ.than || '#8a4fc9', { bumpScale: 1.2, tho: 0.6 })
    const mVung = chat(toiHon(nvQ.than || '#8a4fc9', 0.78), { bumpScale: 1, tho: 0.65 })
    const mTrang = chat(nvQ.mat || '#ffffff', { bump: false, tho: 0.36 })
    const mPhu = chat(nvQ.phu || '#ffd84d', { bumpScale: 0.8, tho: 0.5 })
    const mToi = chat('#2b1a1c', { bump: false, tho: 0.26 })
    const mMieng = chat('#5a1e24', { bump: false, tho: 0.5 })

    const g = new THREE.Group()
    const xoay = new THREE.Group()
    g.add(xoay)
    them(xoay, gCau, mThan, 0, 0.3, 0, 0.26, 0.3, 0.22)
    them(xoay, gCau, mVung, 0, 0.26, 0.1, 0.19, 0.2, 0.13)
    for (const s of [-1, 1]) them(xoay, gCau, mThan, s * 0.1, 0.05, 0.03, 0.075, 0.05, 0.11)
    // một mắt to
    const matG = new THREE.Group()
    matG.position.set(0, 0.37, 0.16)
    xoay.add(matG)
    them(matG, gCau, mTrang, 0, 0, 0, 0.12, 0.13, 0.07)
    them(matG, gCau, mPhu, 0, 0, 0.05, 0.075, 0.085, 0.04)
    const trong = them(matG, gCau, mToi, 0, 0, 0.075, 0.045, 0.05, 0.028)
    them(matG, gCau, mTrang, 0.016, 0.02, 0.094, 0.015, 0.015, 0.008, false)
    const mieng = them(xoay, gCau, mMieng, 0, 0.13, 0.185, 0.06, 0.03, 0.03)
    const rang = them(xoay, gHop, mTrang, 0, 0.155, 0.198, 0.02, 0.014, 0.008, false)
    // sừng
    for (const s of [-1, 1]) {
      const sung = them(xoay, gNon, mPhu, s * 0.115, 0.55, 0.01, 0.05, 0.16, 0.05)
      sung.rotation.z = s * 0.36
    }
    // tay có khớp để vẫy
    const tay = {}
    for (const [ten, s] of [['P', 1], ['T', -1]]) {
      const goc = new THREE.Group()
      goc.position.set(s * 0.2, 0.34, 0.04)
      xoay.add(goc)
      them(goc, gTru, mThan, 0, -0.09, 0, 0.035, 0.18, 0.035)
      them(goc, gCau, mThan, 0, -0.19, 0, 0.052, 0.052, 0.048)
      tay[ten] = goc
    }

    return {
      nhom: g,
      // đứng ở chỗ thứ lạ hiện ra: hơi nhấc lên khỏi bàn cho khung cận vẫn thấy mắt
      datHien(x, p, buoc, sk, mainX) {
        g.visible = true
        let s
        if (sk.hienTu === null) {
          // đang mờ dần vì có su_kien "an": nhỏ lại theo hien
          s = Math.max(0.001, sk.hien)
        } else {
          const k = kep((buoc / FPS - sk.hienTu) / 0.45, 0, 1)
          s = Math.max(0.001, nay(k))
        }
        const bay = 0.3 + 0.03 * Math.sin(buoc * 0.55)
        g.position.set(x, bay + (1 - s) * 0.12, -0.12)
        g.scale.set(s * 1.0, s * 0.95, s * 0.96)
        // mắt vẫn hướng về máy một phần, tròng nhìn nhân vật chính
        xoay.rotation.y = x < mainX ? 0.55 : -0.55
        xoay.rotation.z = 0.04 * Math.sin(buoc * 0.9)
        trong.position.x = kep((mainX - x) * 0.06, -0.024, 0.024)
        mieng.scale.set(0.065, 0.032 + 0.008 * Math.abs(Math.sin(buoc * 1.7)), 0.03)
        // vẫy tay đáp lại khi nhân vật chính vẫy
        const vay = p.viec === 'vay'
        tay.P.rotation.z = vay ? -1.9 - 0.4 * Math.sin(buoc * 1.4) : -0.3 + 0.08 * Math.sin(buoc)
        tay.T.rotation.z = -tay.P.rotation.z * 0.55
      },
      // nhân vật phụ dáng quái: đứng trên bàn (p.yGoc là độ cao hông của dáng người, không dùng ở đây)
      datPhu(p, buoc, mainX) {
        g.visible = true
        g.position.set(p.x, 0.012 + 0.012 * Math.sin(buoc * 0.52), -0.06)
        g.scale.set(0.9, 0.9, 0.9)
        xoay.rotation.y = kep((Math.PI / 2 - p.yaw) * 0.5, -0.7, 0.7)
        const nhip = Math.sin(buoc * 0.52)
        xoay.rotation.z = 0.03 * nhip
        trong.position.x = kep((mainX - p.x) * 0.055, -0.022, 0.022)
        trong.position.y = 0.004 * Math.sin(buoc * 0.4)
        const mo = p.mieng === 'gam' ? 0.05 : p.mieng === 'het' || p.mieng === 'o' ? 0.055 : 0.03
        mieng.scale.set(mo > 0.04 ? 0.075 : 0.06, mo, 0.03)
        rang.visible = mo > 0.04
        tay.P.rotation.z = -(p.tayP ? p.tayP.vai : 0) * 0.9 - 0.25
        tay.T.rotation.z = (p.tayT ? p.tayT.vai : 0) * 0.9 + 0.25
        if (p.viec === 'chay') {
          tay.P.rotation.z += 0.5 * Math.abs(Math.sin(buoc * 1.1))
          tay.T.rotation.z -= 0.5 * Math.abs(Math.sin(buoc * 1.1 + 1))
        }
      },
    }
  }
  const quai = taoQuai(nvPhu && nvPhu.dang !== 'nguoi' && nvPhu.dang !== 'vien' ? nvPhu : mQuaiMac)
  quai.nhom.visible = false
  sc.add(quai.nhom)

  // ---------- 9. Vẽ một khung ----------
  return {
    ve(T) {
      // lượng tử 12 khung/giây: tư thế, máy, sự kiện đều nhảy cùng nhịp
      const buoc = Math.floor(T * FPS + 1e-6)
      const Tq = buoc / FPS

      // vân đất sét trượt rất nhẹ theo bước: cảm giác khối đất được nặn lại
      texNho.offset.set(bam(buoc * 0.37) * 0.09, bam(buoc * 0.71) * 0.09)
      texVat.offset.set(bam(buoc * 0.53) * 0.12, bam(buoc * 0.29) * 0.12)
      texHat.offset.set(bam(buoc * 1.7) * 0.5, bam(buoc * 2.3) * 0.5)

      const m = dx.may(Tq)
      const p = dx.tuThe(Tq)
      const k = dx.khung2D(p)
      const sk = dx.suKien(Tq)

      // máy: đặt đúng khung theo dx rồi thêm rung tay nhỏ theo bước
      dx.datMay3D(cam, m)
      const rung = sk.rung || 0
      cam.position.x += (bam(buoc * 3.1 + 1) - 0.5) * 0.006 + rung * 0.022 * Math.sin(Tq * 90)
      cam.position.y += (bam(buoc * 5.7 + 2) - 0.5) * 0.004 + rung * 0.016 * Math.sin(Tq * 77 + 1.3)
      cam.rotateZ((bam(buoc * 7.3 + 3) - 0.5) * 0.008)

      // đèn chính theo nhân vật để bóng luôn có chỗ đổ; cảnh kết vui thì bừng sáng
      const sang = sk.sang || 0
      key.intensity = 2.7 + 2.0 * sang
      troi.intensity = 1.1 + 0.75 * sang
      fill.intensity = 0.75 + 0.35 * sang
      r.toneMappingExposure = 1.02 + 0.2 * sang
      key.position.set(p.x - 2.2, 4.2, 3.2)
      key.target.position.set(p.x, 0.3, 0)
      key.target.updateMatrixWorld()

      nguoi.dat(k, p, buoc, p.x)

      // nhân vật phụ (nếu có) hoặc quái một mắt (thứ lạ) ở dx.hienX
      const pp = nvPhu ? dx.tuThe(Tq, 'phu') : null
      if (pp) {
        nguoi.nhom.visible = true
        if (nguoiPhu) {
          quai.nhom.visible = false
          nguoiPhu.nhom.visible = true
          nguoiPhu.dat(dx.khung2D(pp), pp, buoc, pp.x)
        } else { nguoiPhu && (nguoiPhu.nhom.visible = false); quai.datPhu(pp, buoc, p.x) }
      } else {
        if (nguoiPhu) nguoiPhu.nhom.visible = false
        if (sk.hien > 0.004) {
          // bộ dựng đã đặt chỗ thứ lạ ở mép phải khung: chỉ việc dựng hình ở đó
          quai.datHien(dx.hienX(Tq), p, buoc, sk, p.x)
        } else quai.nhom.visible = false
      }

      r.render(sc, cam)
    },
  }
}
