// Phong cách "Khối vuông diễn xuất" cho bộ dựng diễn xuất của yt-07k.
// Nhân vật khối riêng của kênh (đầu to, cạnh vát tròn, mắt và miệng là khối nổi) diễn trong hầm ngục đuốc lửa.
//
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
//   Tư thế  : dx.tuThe(T) cho nhân vật chính, dx.tuThe(T, 'phu') cho nhân vật phụ (null khi vắng)
//   Máy quay: dx.may(T) rồi dx.datMay3D(cam, m) — khung hình luôn khớp m.tam và m.cao
//   Sự kiện : dx.suKien(T) → hien (thứ lạ), sang (kết vui), rung (rung khung); thứ lạ ở dx.hienX(T)
// Màu nhân vật lấy từ kb.nhan_vat (than, mat, ao, quan, phu) và kb.nhan_vat_phu.
//
// Hàm thuần theo T: không Math.random, không Date, không mạng, không requestAnimationFrame.
// Đơn vị thế giới: 1 = chiều cao nhân vật, mặt đất y = 0, sân khấu x từ -3,2 tới 3,2.

const TAU = Math.PI * 2
const kep = (v, a, b) => (v < a ? a : v > b ? b : v)
const tron = (a, b, k) => a + (b - a) * k
const muot = k => { k = kep(k, 0, 1); return k * k * (3 - 2 * k) }
// Nhiễu tất định 0..1, thay cho Math.random: cùng đầu vào luôn ra cùng kết quả.
const bam = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

// ---------------------------------------------------------------------------
// Khối hộp cạnh vát tròn nhẹ: hình chữ nhật bo góc đùn ra, có vát hai mặt trước sau.
// Kích thước đúng bằng (x, y, z) truyền vào. Có kho đệm để không dựng lại hình.
// ---------------------------------------------------------------------------
const KHO_GEO = new Map()
function geoHopTron(THREE, w, h, d, r) {
  const ten = [w, h, d, r].map(v => v.toFixed(3)).join('|')
  const cu = KHO_GEO.get(ten)
  if (cu) return cu
  const rr = Math.min(r, w * 0.42, h * 0.42, d * 0.42)
  const bs = rr * 0.7                                  // nới ngang ra ở giữa khối
  const bt = Math.min(rr, (d - 0.004) * 0.42)          // vát mặt trước sau
  const w2 = Math.max(0.004, w - 2 * bs), h2 = Math.max(0.004, h - 2 * bs)
  const r2 = Math.max(0.001, rr - bs * 0.5)
  const s = new THREE.Shape()
  s.moveTo(-w2 / 2 + r2, -h2 / 2)
  s.lineTo(w2 / 2 - r2, -h2 / 2)
  s.quadraticCurveTo(w2 / 2, -h2 / 2, w2 / 2, -h2 / 2 + r2)
  s.lineTo(w2 / 2, h2 / 2 - r2)
  s.quadraticCurveTo(w2 / 2, h2 / 2, w2 / 2 - r2, h2 / 2)
  s.lineTo(-w2 / 2 + r2, h2 / 2)
  s.quadraticCurveTo(-w2 / 2, h2 / 2, -w2 / 2, h2 / 2 - r2)
  s.lineTo(-w2 / 2, -h2 / 2 + r2)
  s.quadraticCurveTo(-w2 / 2, -h2 / 2, -w2 / 2 + r2, -h2 / 2)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.004, d - 2 * bt), bevelEnabled: true,
    bevelThickness: bt, bevelSize: bs, bevelSegments: 2, curveSegments: 2, steps: 1,
  })
  g.translate(0, 0, -Math.max(0.004, d - 2 * bt) / 2)
  g.computeVertexNormals()
  KHO_GEO.set(ten, g)
  return g
}

// ---------------------------------------------------------------------------
// Texture tự vẽ bằng canvas, không tải gì từ mạng.
// ---------------------------------------------------------------------------
function texCanvas(THREE, w, h, ve) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  ve(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  return t
}

// Đá: nền xám xanh, hạt lấm tấm, vài vệt nứt. Chỉ đá, không cỏ không đất.
function texDa(THREE, seed, nen, hat) {
  return texCanvas(THREE, 64, 64, (g) => {
    g.fillStyle = nen
    g.fillRect(0, 0, 64, 64)
    for (let i = 0; i < 760; i++) {
      const x = Math.floor(bam(i * 1.7 + seed) * 64), y = Math.floor(bam(i * 2.9 + seed + 4) * 64)
      const s = bam(i * 3.3 + seed + 8)
      g.fillStyle = s > 0.55 ? 'rgba(255,255,255,' + (0.04 + s * 0.08).toFixed(3) + ')' : 'rgba(0,0,0,' + (0.10 + s * 0.14).toFixed(3) + ')'
      g.fillRect(x, y, s > 0.86 ? 2 : 1, 1)
    }
    // vệt nứt chéo cho khỏi phẳng
    for (let i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(8,10,16,.34)'
      g.lineWidth = 1
      g.beginPath()
      let x = bam(i * 5.1 + seed) * 64, y = 0
      g.moveTo(x, y)
      for (let k = 0; k < 8; k++) { x += (bam(i * 7.7 + k * 3.1 + seed) - 0.5) * 9; y += 8; g.lineTo(x, y) }
      g.stroke()
    }
    g.fillStyle = hat
    g.fillRect(0, 0, 64, 1)
    g.fillRect(0, 0, 1, 64)
  })
}

// Gỗ: thớ dọc, dùng cho cán đuốc và thùng.
function texGo(THREE) {
  return texCanvas(THREE, 32, 32, (g) => {
    g.fillStyle = 'rgb(92,62,38)'
    g.fillRect(0, 0, 32, 32)
    for (let x = 0; x < 32; x++) {
      const k = 0.5 + bam(x * 3.1 + 2) * 0.5
      g.fillStyle = 'rgba(0,0,0,' + (0.30 - k * 0.2).toFixed(3) + ')'
      g.fillRect(x, 0, 1, 32)
      if (bam(x * 7.3 + 5) > 0.7) { g.fillStyle = 'rgba(255,220,170,.06)'; g.fillRect(x, 0, 1, 32) }
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(10,6,4,.35)'
      g.fillRect(Math.floor(bam(i * 2.3) * 32), Math.floor(bam(i * 5.7 + 3) * 32), 1, 2 + Math.floor(bam(i * 3.9) * 4))
    }
  })
}

// Quầng sáng tròn (cho đuốc, mắt đỏ) và chấm mờ (cho bụi, tàn lửa).
function texQuang(THREE, mau) {
  return texCanvas(THREE, 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, mau)
    gr.addColorStop(0.45, mau.replace(/[\d.]+\)$/, '0.35)'))
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 64)
  })
}

// ---------------------------------------------------------------------------
// Bảng dáng mắt và dáng miệng: đọc p.mat, p.mieng, p.mieng_mo, p.chop, p.longMay
// ---------------------------------------------------------------------------
// mo: độ mở mắt, nguoi: cỡ con ngươi, lx/ly: con ngươi lệch ngang/dọc, may: góc lông mày
const DANG_MAT = {
  thuong: { mo: 1.00, nguoi: 1.00, lx: 0.00, ly: 0.00, may: 0.00 },
  lieng: { mo: 0.88, nguoi: 0.92, lx: 0.70, ly: 0.06, may: 0.04 },
  'mo-to': { mo: 1.26, nguoi: 0.68, lx: 0.00, ly: 0.04, may: -0.10 },
  so: { mo: 1.28, nguoi: 0.52, lx: 0.00, ly: -0.06, may: 0.20 },
  vui: { mo: 0.56, nguoi: 0.96, lx: 0.00, ly: 0.08, may: 0.00 },
  ngai: { mo: 0.62, nguoi: 0.86, lx: 0.50, ly: 0.14, may: 0.06 },
  buon: { mo: 0.80, nguoi: 0.94, lx: 0.00, ly: -0.20, may: 0.28 },
  nham: { mo: 0.10, nguoi: 0.10, lx: 0.00, ly: 0.00, may: 0.06 },
  gian: { mo: 0.72, nguoi: 0.64, lx: 0.00, ly: -0.04, may: -0.34 },
}
const LONG_MAY = { thuong: 0, nghi: 0.05, lo: 0.18, nhuong: 0.26, vui: 0, buon: 0.28 }
// mo: chiều cao miệng, rong: bề ngang, cong: nhếch mép (dương là cười)
const DANG_MIENG = {
  dong: { mo: 0.012, rong: 1.00, cong: 0.000 },
  noi: { mo: 0.040, rong: 1.02, cong: 0.002 },
  o: { mo: 0.062, rong: 0.56, cong: 0.000 },
  het: { mo: 0.115, rong: 0.66, cong: -0.006 },
  run: { mo: 0.020, rong: 0.94, cong: 0.000 },
  cuoi: { mo: 0.052, rong: 1.22, cong: 0.012 },
  'cuoi-guong': { mo: 0.046, rong: 1.14, cong: 0.010 },
  buon: { mo: 0.018, rong: 1.02, cong: -0.014 },
  gam: { mo: 0.026, rong: 1.12, cong: -0.004 },
}

// ---------------------------------------------------------------------------
// Tỉ lệ nhân vật riêng của kênh.
// nguoi: đầu 0,40 rộng gấp 1,33 lần thân (0,30), thân 0,235, chân 0,30 ngắn mập, tay có bàn tay khối.
// quai: cao gầy, tay dài quá gối, đầu dài, mắt đỏ.
// ---------------------------------------------------------------------------
const KD = {
  nguoi: {
    dui: 0.200, cang: 0.200, chanCao: 0.062, chanDai: 0.165, chanRong: 0.158,
    duiRong: 0.150, cangRong: 0.138, hongRong: 0.075,
    thanCao: 0.235, thanRong: 0.290, thanSau: 0.190, vaiRong: 0.168,
    coCao: 0.022, dauRong: 0.380, dauCao: 0.390, dauSau: 0.350,
    tayTren: 0.120, tayDuoi: 0.110, tayRong: 0.098, banTay: 0.078,
  },
  quai: {
    dui: 0.200, cang: 0.190, chanCao: 0.050, chanDai: 0.175, chanRong: 0.140,
    duiRong: 0.110, cangRong: 0.095, hongRong: 0.058,
    thanCao: 0.330, thanRong: 0.260, thanSau: 0.175, vaiRong: 0.128,
    coCao: 0.030, dauRong: 0.300, dauCao: 0.440, dauSau: 0.300,
    tayTren: 0.200, tayDuoi: 0.185, tayRong: 0.080, banTay: 0.086,
  },
}

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace
  r.shadowMap.enabled = true
  r.shadowMap.type = THREE.PCFSoftShadowMap
  r.toneMapping = THREE.ACESFilmicToneMapping
  r.toneMappingExposure = 1.16

  const co = Math.min(W, H) / 540        // hệ số cỡ cho hạt, nét, điểm ảnh (mọi cỡ khung)
  const nv = kb.nhan_vat || {}
  const nvp = kb.nhan_vat_phu

  // Bảng màu hầm ngục của kênh: đá xám lạnh, lửa cam, bóng tím đen.
  const MAU = { nen: '#0a0d14', da: '#6b7382', daToi: '#4a5262', lua: '#ff9a45', son: '#2a2330' }
  const nen0 = new THREE.Color(MAU.nen)
  const nenSang = new THREE.Color('#4a3222')

  const scene = new THREE.Scene()
  scene.background = nen0.clone()
  scene.fog = new THREE.FogExp2(nen0.getHex(), 0.072)

  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 70)
  scene.add(cam)

  // ---- ánh sáng ----
  const dem = new THREE.AmbientLight('#45557f', 0.62)
  scene.add(dem)
  const hemi = new THREE.HemisphereLight('#93a8d8', '#1c1410', 0.58)
  scene.add(hemi)
  const trang = new THREE.DirectionalLight('#a9bcf5', 1.25)   // ánh lạnh từ trên, đổ bóng theo nhân vật
  trang.castShadow = true
  trang.shadow.mapSize.set(1024, 1024)
  trang.shadow.camera.left = -1.7
  trang.shadow.camera.right = 1.7
  trang.shadow.camera.top = 1.9
  trang.shadow.camera.bottom = -0.5
  trang.shadow.camera.near = 0.4
  trang.shadow.camera.far = 12
  trang.shadow.camera.updateProjectionMatrix()
  trang.shadow.bias = -0.0007
  trang.shadow.normalBias = 0.02
  trang.shadow.radius = 3
  scene.add(trang)
  scene.add(trang.target)
  // đèn phụ phía máy: giữ nhân vật đọc được cả khi quay lưng vào lửa
  const denPhu = new THREE.DirectionalLight('#7d90c4', 0.5)
  denPhu.position.set(1.6, 3.2, 6)
  scene.add(denPhu)
  scene.add(denPhu.target)

  // ---- vật liệu cảnh ----
  const matDa = new THREE.MeshLambertMaterial({ map: texDa(THREE, 1, 'rgb(104,112,128)', 'rgba(190,200,220,.12)') })
  const matDaToi = new THREE.MeshLambertMaterial({ map: texDa(THREE, 7, 'rgb(78,85,100)', 'rgba(160,175,200,.10)') })
  const matGo = new THREE.MeshLambertMaterial({ map: texGo(THREE) })
  const matSat = new THREE.MeshStandardMaterial({ color: '#33383f', roughness: 0.62, metalness: 0.55 })
  const matHong = new THREE.MeshLambertMaterial({ color: '#151822' })   // hốc tối: đá tối, không phải lỗ đen
  const matBong = new THREE.MeshLambertMaterial({ color: '#0e0c16' })

  // ---- khối tĩnh: sàn cờ, tường đá, hốc tối ----
  const Z_TUONG = -1.8
  const HOC = [-2.45, 1.75, 3.9]   // hốc tối khoét trong tường

  const geoKhoi = new THREE.BoxGeometry(1, 1, 1)
  function dungKhoi(ds, mat, cast) {
    const im = new THREE.InstancedMesh(geoKhoi, mat, ds.length)
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    const vt = new THREE.Vector3(), sc = new THREE.Vector3(), cl = new THREE.Color()
    ds.forEach((b, i) => {
      e.set(0, b.ry || 0, 0); q.setFromEuler(e)
      vt.set(b.x, b.y, b.z); sc.set(b.w, b.h, b.d)
      m4.compose(vt, q, sc)
      im.setMatrixAt(i, m4)
      cl.setRGB(b.r, b.g, b.b)
      im.setColorAt(i, cl)
    })
    im.castShadow = !!cast
    im.receiveShadow = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    scene.add(im)
    return im
  }

  const dsSan = []
  for (let i = -13; i <= 13; i++) for (let j = -7; j <= 5; j++) {
    const w = 0.58 + 0.30 * bam(i * 3.7 + j * 7.1)
    const d = 0.56 + 0.34 * bam(i * 9.3 + j * 1.9 + 4)
    const x = i * 0.80 + (bam(i * 2.1 + j * 5.3) - 0.5) * 0.07
    const z = j * 0.82 + (bam(j * 4.7 + i * 1.3 + 2) - 0.5) * 0.07
    if (Math.abs(x) > 9.6 || z > 4.2 || z < -2.4) continue
    const h = 0.11 + 0.07 * bam(i * 5.9 + j * 3.1 + 8)
    const k = 0.62 + 0.46 * bam(i * 7.7 + j * 2.3 + 1)
    dsSan.push({ x, y: 0.002 - h / 2, z, w, h, d, ry: (bam(i * 1.7 + j * 8.9) - 0.5) * 0.06, r: k * 1.03, g: k, b: k * 1.10 })
  }
  dungKhoi(dsSan, matDa, false)

  const dsTuong = []
  for (let hang = 0; hang < 14; hang++) {
    const y = 0.16 + hang * 0.30
    const lech = (hang % 2) * 0.30
    for (let cot = -16; cot <= 16; cot++) {
      const w = 0.42 + 0.30 * bam(cot * 3.3 + hang * 11.1)
      const x = cot * 0.62 + lech + (bam(cot * 5.5 + hang * 2.7) - 0.5) * 0.09
      if (Math.abs(x) > 9.4) continue
      const h = 0.23 + 0.09 * bam(cot * 1.3 + hang * 6.7 + 3)
      const d = 0.30 + 0.06 * bam(cot * 7.9 + hang * 4.1)
      if (HOC.some(xc => Math.abs(x - xc) < 0.48 + w * 0.16 && y < 1.66)) continue
      const k = 0.44 + 0.36 * bam(cot * 9.1 + hang * 3.7 + 5)
      dsTuong.push({ x, y, z: Z_TUONG - d / 2, w, h, d, r: k, g: k * 0.97, b: k * 1.07 })
    }
  }
  dungKhoi(dsTuong, matDaToi, false)

  // nền tối sau các hốc + nền tối dưới khe sàn
  for (const xc of HOC) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(1.30, 1.95), matHong)
    v.position.set(xc, 0.97, Z_TUONG - 0.03)
    scene.add(v)
  }
  const duoiSan = new THREE.Mesh(new THREE.PlaneGeometry(26, 12), matHong)
  duoiSan.rotation.x = -Math.PI / 2
  duoiSan.position.set(0, -0.22, 0.5)
  scene.add(duoiSan)

  // ---- đồ vật: cột đá, đống đá vụn, thùng gỗ, xích ----
  const khoi = (cha, w, h, d, rr, mat, x, y, z, rx) => {
    const m = new THREE.Mesh(geoHopTron(THREE, w, h, d, rr), mat)
    m.position.set(x, y, z)
    if (rx) m.rotation.x = rx
    m.castShadow = true
    m.receiveShadow = true
    cha.add(m)
    return m
  }
  khoi(scene, 0.34, 1.9, 0.34, 0.05, matDa, -3.55, 0.95, -1.05)        // cột
  khoi(scene, 0.46, 0.13, 0.46, 0.05, matDa, -3.55, 1.93, -1.05)       // đầu cột
  khoi(scene, 0.30, 0.55, 0.30, 0.04, matDaToi, -3.55, 0.27, -1.05)    // chân cột
  const daVun = [[2.55, -1.15, 0.30], [2.86, -1.02, 0.24], [2.55, -0.86, 0.18], [-1.55, -1.28, 0.26], [-1.24, -1.2, 0.2]]
  daVun.forEach(([x, z, s], i) => khoi(scene, s, s * 0.8, s, 0.04, matDaToi, x, s * 0.4, z, (bam(i * 3.3) - 0.5) * 0.3))
  khoi(scene, 0.40, 0.40, 0.40, 0.03, matGo, 4.5, 0.20, -1.15)          // thùng
  khoi(scene, 0.34, 0.34, 0.34, 0.03, matGo, 4.5, 0.57, -1.18)
  for (const [x, y] of [[-2.15, 2.05], [0.2, 1.95], [3.35, 2.1]]) {     // xích treo
    const xich = new THREE.Mesh(geoHopTron(THREE, 0.035, 0.62, 0.035, 0.014), matSat)
    xich.position.set(x, y, Z_TUONG + 0.1)
    scene.add(xich)
  }

  // ---- đuốc: giá sắt, cán gỗ, lửa nón xếp lớp, quầng sáng, đèn điểm ----
  const texQuangCam = texQuang(THREE, 'rgba(255,196,112,1)')
  const matLuaTrong = new THREE.MeshBasicMaterial({ color: '#ffe9b8', fog: false })
  const matLuaNgoai = new THREE.MeshBasicMaterial({
    color: '#ff7a26', transparent: true, opacity: 0.6, fog: false,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const geoLuaTrong = new THREE.ConeGeometry(0.042, 0.17, 6, 1, true)
  const geoLuaNgoai = new THREE.ConeGeometry(0.062, 0.26, 7, 1, true)
  const duoc = []
  ;[-2.75, 0.5, 3.15].forEach((x, i) => {
    const y = 1.24, z = Z_TUONG + 0.17
    khoi(scene, 0.11, 0.14, 0.08, 0.02, matSat, x, y - 0.24, z - 0.04)   // ổ gắn tường
    khoi(scene, 0.07, 0.20, 0.07, 0.02, matSat, x, y - 0.14, z - 0.01)
    const can = khoi(scene, 0.056, 0.44, 0.056, 0.02, matGo, x, y - 0.02, z, 0.14)
    can.castShadow = false
    const trong = new THREE.Mesh(geoLuaTrong, matLuaTrong)
    trong.position.set(x, y + 0.245, z)
    scene.add(trong)
    const ngoai = new THREE.Mesh(geoLuaNgoai, matLuaNgoai)
    ngoai.position.set(x, y + 0.265, z)
    scene.add(ngoai)
    const quang = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texQuangCam, color: '#ff9a45', transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }))
    quang.position.set(x, y + 0.26, z)
    quang.scale.setScalar(1.15)
    scene.add(quang)
    const den = new THREE.PointLight(MAU.lua, 6.5, 8, 1.9)
    den.position.set(x, y + 0.27, z + 0.08)
    scene.add(den)
    duoc.push({ x, y, z, trong, ngoai, quang, den, i })
  })
  const denSang = new THREE.PointLight('#ffd9a0', 0, 14, 1.5)   // đèn ấm bật khi kết vui
  denSang.position.set(0, 2.4, 0.6)
  scene.add(denSang)

  // -------------------------------------------------------------------------
  // Nhân vật: một bộ khung dùng chung, tỉ lệ và màu theo kb.nhan_vat
  // -------------------------------------------------------------------------
  function taoNhanVat(mau, kieu) {
    const K = KD[kieu] || KD.nguoi
    const C = {
      than: mau.than || '#e8b48a', mat: mau.mat || '#2a1f1a',
      ao: mau.ao || '#e2672e', quan: mau.quan || '#2f3f5c', phu: mau.phu || '#1d2b3a',
    }
    const lam = (c, e, rghi) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: rghi ?? 0.86, metalness: 0 })
      if (e) { m.emissive = new THREE.Color(c); m.emissiveIntensity = e }
      return m
    }
    const mThan = lam(C.than, kieu === 'quai' ? 0.16 : 0), mAo = lam(C.ao, kieu === 'quai' ? 0.16 : 0)
    const mQuan = lam(C.quan, kieu === 'quai' ? 0.14 : 0), mPhu = lam(C.phu)
    const mMat = lam(C.mat), mMatSang = lam(C.mat, 0.55)
    // Quái: tóc và lông mày tối, chỉ hai mắt đỏ là phát sáng. Người: tóc màu phụ, mắt có lòng trắng.
    const mToc = kieu === 'quai' ? mQuan : mPhu
    const mLongMat = kieu === 'quai' ? mMatSang : lam(new THREE.Color(C.than).lerp(new THREE.Color('#ffffff'), 0.55).getStyle(), 0.22)
    const mConNguoi = kieu === 'quai' ? lam('#0b0810') : mMat
    const mMieng = kieu === 'quai' ? mQuan : mMat

    const goc = new THREE.Group()
    const coG = new THREE.Group(); goc.add(coG)
    const ngaG = new THREE.Group(); coG.add(ngaG)
    const hipG = new THREE.Group(); ngaG.add(hipG)
    const thanG = new THREE.Group(); hipG.add(thanG)

    const hop = (cha, w, h, d, rr, mat, x, y, z) => {
      const m = new THREE.Mesh(geoHopTron(THREE, w, h, d, rr), mat)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      cha.add(m)
      return m
    }

    // thân ngắn, hơi thuôn
    hop(thanG, K.thanSau, K.thanCao, K.thanRong, 0.045, mAo, 0, K.thanCao / 2, 0)
    hop(thanG, K.thanSau * 1.03, 0.055, K.thanRong * 1.03, 0.02, mToc, 0, 0.030, 0)    // lai áo
    hop(thanG, 0.090, 0.060, 0.110, 0.02, mThan, 0, K.thanCao + 0.020, 0)               // cổ

    // đầu to
    const dauG = new THREE.Group()
    dauG.position.set(0, K.thanCao + K.coCao + K.dauCao / 2, 0)
    thanG.add(dauG)
    hop(dauG, K.dauSau, K.dauCao, K.dauRong, 0.052, mThan, 0, 0, 0)
    // tóc: mũ khối phủ đỉnh, mảng trước trán, mảng sau gáy
    hop(dauG, K.dauSau * 1.03, 0.085, K.dauRong * 1.04, 0.03, mToc, -0.006, K.dauCao * 0.40, 0)
    hop(dauG, K.dauSau * 0.22, 0.070, K.dauRong * 1.04, 0.02, mToc, K.dauSau * 0.30, K.dauCao * 0.36, 0)
    hop(dauG, K.dauSau * 0.52, K.dauCao * 0.86, K.dauRong * 1.03, 0.035, mToc, -K.dauSau * 0.26, K.dauCao * 0.015, 0)
    for (const s of [-1, 1])   // tóc mai hai bên cho đỡ phẳng
      hop(dauG, K.dauSau * 0.60, K.dauCao * 0.36, 0.026, 0.012, mToc,
        -K.dauSau * 0.14, K.dauCao * 0.15, s * K.dauRong * 0.495)

    // mặt: mắt, con ngươi, lông mày, miệng đều là khối nổi trên mặt trước (+x)
    const mg = K.dauSau / 2
    const conMat = []
    for (const s of [-1, 1]) {
      const o = new THREE.Group()
      // quái: mắt đặt ở góc đầu để nhìn nghiêng vẫn thấy hai mắt đỏ
      if (kieu === 'quai') o.position.set(mg + 0.012, K.dauCao * 0.10, s * K.dauRong * 0.40)
      else o.position.set(mg - 0.004, K.dauCao * 0.055, s * K.dauRong * 0.225)
      dauG.add(o)
      const trang = hop(o, 0.038, K.dauCao * 0.23, K.dauRong * 0.21, 0.016, mLongMat, 0, 0, 0)
      trang.castShadow = false
      const con = hop(o, 0.024, K.dauCao * 0.115, K.dauRong * 0.105, 0.010, mConNguoi, 0.019, 0, 0)
      con.castShadow = false
      const may = hop(o, 0.034, K.dauCao * 0.062, K.dauRong * 0.245, 0.014, mToc, 0.002, K.dauCao * 0.16, 0)
      may.castShadow = false
      conMat.push({ o, trang, con, may, s })
    }
    // miệng: ba khối ghép, cong lên xuống theo cảm xúc
    const miengG = new THREE.Group()
    miengG.position.set(mg + 0.002, -K.dauCao * 0.205, 0)
    dauG.add(miengG)
    const mieng = []
    for (let i = 0; i < 3; i++) {
      const m = hop(miengG, 0.030, 0.030, K.dauRong * 0.145, 0.012, mMieng, 0.004, 0, 0)
      m.castShadow = false
      mieng.push(m)
    }
    // mũi: một khối nhỏ nhô ra cho mặt có chiều sâu
    const mui = hop(dauG, 0.040, 0.045, 0.055, 0.014, mThan, mg - 0.008, -K.dauCao * 0.075, 0)
    mui.castShadow = false

    // tay: vai, khuỷu, bàn tay khối nhỏ
    const tay = []
    for (const s of [-1, 1]) {
      const vai = new THREE.Group()
      vai.position.set(0, K.thanCao - 0.036, s * K.vaiRong)
      thanG.add(vai)
      // nhóm dang tay nằm ngoài nhóm vung tay: dang ra ngang trước rồi mới vung tới trước
      const dang = new THREE.Group()
      vai.add(dang)
      hop(dang, K.tayRong, K.tayTren + 0.014, K.tayRong, 0.026, mAo, 0, -K.tayTren / 2, 0)
      const khuyu = new THREE.Group()
      khuyu.position.y = -K.tayTren
      dang.add(khuyu)
      hop(khuyu, K.tayRong * 0.94, K.tayDuoi + 0.012, K.tayRong * 0.94, 0.024, mThan, 0, -K.tayDuoi / 2, 0)
      const coTay = new THREE.Group()
      coTay.position.y = -K.tayDuoi
      khuyu.add(coTay)
      hop(coTay, K.banTay * 0.86, K.banTay, K.banTay, 0.022, mThan, 0.004, -K.banTay * 0.42, 0)
      tay.push({ vai, dang, khuyu, s })
    }

    // chân: đùi, cẳng, giày to
    const chan = []
    for (const s of [-1, 1]) {
      const hp = new THREE.Group()
      hp.position.set(0, 0, s * K.hongRong)
      hipG.add(hp)
      hop(hp, K.duiRong, K.dui + 0.025, K.duiRong, 0.032, mQuan, 0, -K.dui / 2 + 0.0125, 0)
      const kn = new THREE.Group()
      kn.position.y = -K.dui
      hp.add(kn)
      hop(kn, K.cangRong, K.cang + 0.024, K.cangRong, 0.03, mQuan, 0, -K.cang / 2 + 0.012, 0)
      const ft = new THREE.Group()
      ft.position.y = -K.cang
      kn.add(ft)
      hop(ft, K.chanDai, K.chanCao, K.chanRong, 0.022, mToc, K.chanDai * 0.22, -K.chanCao / 2 + 0.004, 0)
      chan.push({ hp, kn, ft, s })
    }

    // quái: ánh đỏ hắt phía sau lưng để hằn viền, thân tối vẫn đọc được
    if (kieu === 'quai') {
      const vien = new THREE.PointLight('#ff3b3b', 1.8, 0.62, 2)
      vien.position.set(-0.26, 0.42, 0)
      thanG.add(vien)
    }

    // giải chuỗi chân để đặt bàn chân đúng mặt đất
    function giai(cc) {
      const a1 = cc.hong, a2 = a1 - cc.goi
      const kx = Math.sin(a1) * K.dui, ky = -Math.cos(a1) * K.dui
      const ax = kx + Math.sin(a2) * K.cang, ay = ky - Math.cos(a2) * K.cang
      const tf = 0.15 * a2
      const bx = K.chanDai * 0.22, by = -K.chanCao + 0.004
      const day = [-1, 1].map(s => {
        const px = bx + s * K.chanDai / 2
        return [ax + px * Math.cos(tf) - by * Math.sin(tf), ay + px * Math.sin(tf) + by * Math.cos(tf)]
      })
      return { a1, a2, kx, ky, ax, ay, day }
    }

    // đặt dáng theo tư thế p của bộ diễn xuất
    function capNhat(p, T) {
      const coS = p.co ?? 1
      const leanThem = kieu === 'quai' ? 0.14 : 0
      const L = p.lean + leanThem
      const g = (p.nga ?? 0) > 0.001 ? -p.nga * 1.45 : 0     // ngã về phía trước mặt, xoay quanh cổ chân phải

      goc.position.x = p.x
      goc.rotation.y = -p.yaw                     // xoay người thật, không lật hình
      coG.scale.set(1 / Math.sqrt(coS), coS, 1 / Math.sqrt(coS))

      const cP = giai(p.chanP), cT = giai(p.chanT)
      const diem = [[cP.ax, cP.ay], [cT.ax, cT.ay], [cP.kx, cP.ky], [cT.kx, cT.ky], cP.day[0], cP.day[1], cT.day[0], cT.day[1]]
      if ((p.nga ?? 0) > 0.01) {
        const th = K.thanCao
        diem.push([0, 0], [Math.sin(L) * th, Math.cos(L) * th],
          [Math.sin(L) * th + Math.sin(L + p.dauNghieng) * (K.coCao + K.dauCao * 0.5),
            Math.cos(L) * th + Math.cos(L + p.dauNghieng) * (K.coCao + K.dauCao * 0.5)])
      }
      const px = cP.ax, py = cP.ay, cg = Math.cos(g), sg = Math.sin(g)
      let thap = Infinity
      for (const [x, y] of diem) {
        const dxq = x - px, dyq = y - py
        const yq = py + dxq * sg + dyq * cg
        if (yq < thap) thap = yq
      }
      goc.position.y = -thap * coS + (p.bay || 0)

      ngaG.position.set(px, py, 0)
      ngaG.rotation.z = g
      hipG.position.set(-px, -py, 0)

      thanG.rotation.z = -L
      // đầu và tay: góc tuyệt đối = p.lean + góc riêng, nên bù lại phần thân đã xoay
      const bu = 2 * L - leanThem
      dauG.rotation.z = bu + p.dauNghieng
      // quay đầu về phía máy: theo p.nhin và thêm chút khi thân đang nghiêng hẳn.
      // Quái quay hẳn về phía máy như đang nhìn thẳng vào người xem.
      dauG.rotation.y = -(p.nhin - 0.2) * 0.7 - (kieu === 'quai' ? 0.5 : 0.22) * Math.cos(p.yaw)

      // tay
      for (const t of tay) {
        const tt = t.s > 0 ? p.tayP : p.tayT
        // tay giơ cao thì dang thêm ra để bàn tay không lướt qua mặt
        const them = tt.vai > 1.0 ? Math.min(0.5, (tt.vai - 1.0) * 0.5) : 0
        t.vai.rotation.z = bu + tt.vai
        t.dang.rotation.x = -t.s * ((tt.ab ?? 0) + them)
        t.khuyu.rotation.z = tt.khuyu * (them > 0 ? 0.9 : 1)
      }
      // chân
      for (const c of chan) {
        const cc = c.s > 0 ? p.chanP : p.chanT
        c.hp.rotation.z = cc.hong
        c.kn.rotation.z = -cc.goi
        c.ft.rotation.z = -0.85 * (cc.hong - cc.goi)
      }
      // mặt
      const dm = DANG_MAT[p.mat] || DANG_MAT.thuong
      let mo = dm.mo
      if (p.chop) mo = Math.min(mo, 0.08)
      if (kieu === 'quai') mo *= 0.62
      const mayGoc = dm.may + (LONG_MAY[p.longMay] || 0)
      for (const e of conMat) {
        const ty = kieu === 'quai' ? 0.78 : 1
        e.trang.scale.y = Math.max(0.06, mo) * ty
        e.con.scale.set(1, Math.max(0.06, Math.min(1, mo)) * Math.max(0.3, dm.nguoi) * ty, 1)
        e.con.position.y = dm.ly * K.dauCao * 0.18
        e.con.position.z = dm.lx * K.dauRong * 0.06 * e.s
        e.may.rotation.x = mayGoc * e.s
        e.may.position.y = K.dauCao * (0.155 + (p.chop ? -0.01 : 0))
      }
      // miệng
      const mm = DANG_MIENG[p.mieng] || DANG_MIENG.dong
      let moM = mm.mo, rong = mm.rong, cong = mm.cong
      if (p.mieng === 'noi') {
        const m2 = kep(p.mieng_mo || 0, 0, 1)
        moM += 0.075 * m2
        rong += 0.10 * m2
        cong += 0.004 * m2
      }
      if (kieu === 'quai') rong *= 0.85
      for (let i = 0; i < 3; i++) {
        const s = i - 1
        const run = p.mieng === 'run' ? 0.007 * Math.sin(T * 26 + i * 2.1) : 0
        const k = mieng[i]
        k.position.set(0.004, cong * s * s + run, s * K.dauRong * 0.145 * rong * 0.92)
        k.scale.set(1, Math.max(0.25, moM / 0.030) * (1 - 0.26 * s * s), rong)
        k.rotation.x = -cong * 2.6 * s
      }
      return goc.position.y
    }

    return { goc, capNhat }
  }

  // ---- nhân vật chính, nhân vật phụ ----
  const chinh = taoNhanVat(nv, 'nguoi')
  scene.add(chinh.goc)
  const tenPhu = nvp ? (nvp.dang === 'quai' ? 'quai' : 'nguoi') : null
  const phu = nvp ? taoNhanVat(nvp, tenPhu) : null
  if (phu) { phu.goc.visible = false; scene.add(phu.goc) }

  // ---- thứ lạ của phong cách: kẻ trùm đầu đứng trong tối, hai mắt đỏ ----
  const thuLa = new THREE.Group()
  scene.add(thuLa)
  khoi(thuLa, 0.36, 0.72, 0.26, 0.05, matBong, 0, 0.38, 0)
  khoi(thuLa, 0.34, 0.30, 0.40, 0.05, matBong, 0, 0.86, 0)
  khoi(thuLa, 0.26, 0.36, 0.28, 0.05, matBong, 0.01, 1.10, 0)
  khoi(thuLa, 0.36, 0.08, 0.34, 0.04, matBong, -0.02, 1.26, 0)
  khoi(thuLa, 0.07, 0.66, 0.07, 0.03, matBong, 0.01, 0.60, 0.22)
  khoi(thuLa, 0.07, 0.66, 0.07, 0.03, matBong, 0.01, 0.60, -0.22)
  const matDo = new THREE.MeshBasicMaterial({ color: '#ff3a2c', fog: false })
  const matMat = []
  const texQuangDo = texQuang(THREE, 'rgba(255,70,55,1)')
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geoHopTron(THREE, 0.045, 0.048, 0.085, 0.012), matDo)
    m.position.set(0.135, 1.10, s * 0.068)
    thuLa.add(m)
    matMat.push(m)
    const q = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texQuangDo, color: '#ff3a2c', transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }))
    q.position.set(0.17, 1.10, s * 0.068)
    q.scale.setScalar(0.44)
    thuLa.add(q)
    matMat.push(q)
  }
  const denDo = new THREE.PointLight('#ff2f22', 0, 4.5, 1.7)
  denDo.position.set(0.26, 1.05, 0)
  thuLa.add(denDo)

  // ---- bụi lơ lửng và tàn lửa: chấm sáng, cỡ điểm ảnh theo Math.min(W, H) ----
  const texCham = texQuang(THREE, 'rgba(226,238,255,1)')
  const N_BUI = 46, N_TAN = 30
  const geomBui = new THREE.BufferGeometry()
  const vtBui = new Float32Array(N_BUI * 3)
  geomBui.setAttribute('position', new THREE.BufferAttribute(vtBui, 3))
  const matBui = new THREE.PointsMaterial({
    size: Math.max(1, Math.round(2.4 * co)), map: texCham, color: '#9fb4d8',
    transparent: true, opacity: 0.5, sizeAttenuation: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const bui = new THREE.Points(geomBui, matBui)
  bui.frustumCulled = false
  scene.add(bui)

  const geomTan = new THREE.BufferGeometry()
  const vtTan = new Float32Array(N_TAN * 3)
  geomTan.setAttribute('position', new THREE.BufferAttribute(vtTan, 3))
  const matTan = new THREE.PointsMaterial({
    size: Math.max(1, Math.round(3.0 * co)), map: texQuangCam, color: '#ffb257',
    transparent: true, opacity: 0.9, sizeAttenuation: false, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  })
  const tan = new THREE.Points(geomTan, matTan)
  tan.frustumCulled = false
  scene.add(tan)

  // ---- hậu kỳ: tối bốn mép và hạt phim (dán lên máy, phủ toàn khung) ----
  const fov = cam.fov * Math.PI / 180
  const caoQ = 2 * 0.5 * Math.tan(fov / 2)
  const matVien = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec2 vUv;',
      'void main(){',
      '  vec2 p = (vUv - 0.5) * 2.0;',
      '  float r = length(p);',
      '  float v = smoothstep(0.52, 1.42, r);',
      '  float a = v * 0.80 + smoothstep(0.55, 1.0, abs(p.y)) * 0.14;',
      '  gl_FragColor = vec4(0.0, 0.0, 0.0, clamp(a, 0.0, 0.90));',
      '}',
    ].join('\n'),
    transparent: true, depthTest: false, depthWrite: false,
  })
  const matHat = new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) },
      uHat: { value: Math.max(1, co * 1.25) }, uManh: { value: 0.075 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'varying vec2 vUv; uniform float uT, uHat, uManh; uniform vec2 uRes;',
      'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
      'void main(){',
      '  vec2 o = floor(uT * 30.0) * vec2(37.0, 17.0);',
      '  float n = h(floor(vUv * uRes / uHat) + o);',
      '  float g = smoothstep(0.58, 1.0, n) * uManh;',
      '  gl_FragColor = vec4(vec3(0.62, 0.68, 0.80) * g, 1.0);',
      '}',
    ].join('\n'),
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (const [mat, zz, q] of [[matVien, -0.5, 1], [matHat, -0.4995, 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    m.position.z = zz
    m.scale.set(caoQ * W / H, caoQ, 1)
    m.renderOrder = 900 + q
    m.frustumCulled = false
    cam.add(m)
  }

  // ---- vẽ một khung ----
  function ve(T) {
    const m = dx.may(T)
    const p = dx.tuThe(T)
    const ph = dx.tuThe(T, 'phu')
    const sk = dx.suKien(T)

    // nhân vật
    chinh.capNhat(p, T)
    if (phu) {
      phu.goc.visible = !!ph
      if (ph) phu.capNhat(ph, T)
    }

    // máy quay do bộ diễn xuất lo: đặt đúng m.tam, m.cao rồi mới thêm rung tay rất nhẹ
    dx.datMay3D(cam, m)
    const rg = sk.rung || 0
    cam.position.x += 0.016 * rg * Math.sin(T * 91) + 0.004 * Math.sin(T * 0.63)
    cam.position.y += 0.012 * rg * Math.sin(T * 77 + 1) + 0.003 * Math.sin(T * 0.47 + 2)
    cam.rotation.z += 0.007 * rg * Math.sin(T * 63 + 0.7)

    // ánh sáng bám nhân vật
    trang.position.set(p.x - 1.5, 3.2, 2.3)
    trang.target.position.set(p.x, 0.35, 0)
    trang.target.updateMatrixWorld()

    // đuốc chập chờn (tất định theo T)
    for (const d of duoc) {
      const fl = 0.86 + 0.13 * Math.sin(T * 13 + d.i * 2.1) + 0.07 * Math.sin(T * 29.7 + d.i * 5.3) + 0.05 * Math.sin(T * 7.1 + d.i)
      d.den.intensity = 6.5 * fl
      d.trong.scale.set(1 + 0.2 * (fl - 1), 0.82 + 0.3 * fl, 1 + 0.2 * (fl - 1))
      d.trong.position.y = d.y + 0.235 + 0.012 * Math.sin(T * 17 + d.i)
      d.trong.rotation.z = 0.16 * Math.sin(T * 11 + d.i * 1.7)
      d.ngoai.scale.set(1 + 0.24 * (fl - 1), 0.86 + 0.26 * fl, 1 + 0.24 * (fl - 1))
      d.ngoai.position.y = d.y + 0.26 + 0.014 * Math.sin(T * 7.3 + d.i)
      d.ngoai.rotation.z = 0.22 * Math.sin(T * 8.7 + d.i * 2.3)
      d.quang.scale.setScalar(1.0 + 0.24 * fl)
      d.quang.material.opacity = 0.36 + 0.18 * fl
    }

    // tàn lửa: vọt lên từ chậu đuốc
    for (let i = 0; i < N_TAN; i++) {
      const d = duoc[i % duoc.length]
      const ph1 = bam(i * 2.37), toc = 0.34 + ph1 * 0.22
      const life = (T * toc + ph1) % 1
      vtTan[i * 3] = d.x + (bam(i * 5.71) - 0.5) * 0.16 + Math.sin(T * 2.3 + i) * 0.03 * life
      vtTan[i * 3 + 1] = d.y + 0.29 + life * 0.75
      vtTan[i * 3 + 2] = d.z + 0.02 + (bam(i * 9.13) - 0.5) * 0.10
    }
    geomTan.attributes.position.needsUpdate = true
    matTan.opacity = 0.45 + 0.30 * (0.5 + 0.5 * Math.sin(T * 9))

    // bụi lơ lửng khắp sân khấu
    for (let i = 0; i < N_BUI; i++) {
      const px = (bam(i * 1.31) - 0.5) * 7.2
      const pz = (bam(i * 2.73) - 0.5) * 3.6 - 0.2
      const py = 0.12 + bam(i * 4.07) * 2.3
      vtBui[i * 3] = px + 0.14 * Math.sin(T * 0.31 + i * 1.7)
      vtBui[i * 3 + 1] = py + 0.10 * Math.sin(T * 0.24 + i * 2.3)
      vtBui[i * 3 + 2] = pz + 0.10 * Math.cos(T * 0.27 + i * 1.1)
    }
    geomBui.attributes.position.needsUpdate = true

    // thứ lạ: đứng đúng chỗ bộ diễn xuất chỉ (dx.hienX) ở phía sau mặt phẳng diễn
    const hien = sk.hien || 0
    thuLa.position.set(dx.hienX(T), 0, -0.8)
    thuLa.rotation.y = -Math.PI / 2 + 0.22      // hướng mặt về phía máy
    const sc = 0.02 + 0.98 * hien
    thuLa.scale.set(sc, sc, sc)
    thuLa.visible = hien > 0.004
    let nhay = 1
    if (sk.hienTu !== null && sk.hienTu !== undefined && T - sk.hienTu < 0.4) nhay = Math.sin(T * 80) > -0.35 ? 1 : 0.18
    const chop = 0.85 + 0.15 * Math.sin(T * 3.1)
    denDo.intensity = 3.4 * hien * nhay * chop
    for (const o of matMat) if (o.material) o.material.opacity = 0.75 * nhay * hien
    matDo.color.setRGB(1, 0.22 + 0.06 * Math.sin(T * 5.3), 0.17)

    // kết vui: bừng sáng
    const sang = sk.sang || 0
    dem.intensity = 0.62 + 1.45 * sang
    hemi.intensity = 0.58 + 0.55 * sang
    trang.intensity = 1.25 + 0.9 * sang
    denSang.intensity = 9 * sang
    scene.background.copy(nen0).lerp(nenSang, sang * 0.75)
    scene.fog.color.copy(nen0).lerp(nenSang, sang * 0.75)
    scene.fog.density = 0.072 - 0.03 * sang

    // hậu kỳ
    matHat.uniforms.uT.value = T
    r.render(scene, cam)
  }

  return { ve }
}
