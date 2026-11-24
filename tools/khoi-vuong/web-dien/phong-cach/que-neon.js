// Phong cách "Người que neon" (que-neon), bối cảnh phố lưới neon.
// Nhân vật que vẽ bằng nét phát quang: thân xanh, phía xa hồng, đầu là vòng neon,
// mặt nét trắng; nền đêm có lưới sàn phối cảnh, chân trời hồng, nhà xa, hạt bụi;
// thứ lạ bên phải là con mắt neon khổng lồ; biểu tượng tâm lý bật quanh đầu theo động tác.
// Hậu kỳ: bloom (EffectComposer + UnrealBloomPass + OutputPass) cho nét phát sáng.
//
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
// Mọi thứ lái theo dx: tư thế dx.tuThe, khớp 2D dx.khung2D, máy dx.may + đổi toạ độ dx.raMan,
// sự kiện dx.suKien, chỗ thứ lạ dx.hienX. Không tự đặt mốc giờ cho động tác.
// Hàm thuần theo T: không Math.random, không Date, không mạng, không vòng lặp khung hình.
// Cỡ nét, chữ, hạt đều tính theo Math.min(W, H) nên chạy đúng ở mọi khung.
import { EffectComposer } from '../lib/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../lib/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from '../lib/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from '../lib/jsm/postprocessing/OutputPass.js'

const PI = Math.PI, TAU = PI * 2
const kep = (v, a, b) => Math.max(a, Math.min(b, v))
// ngẫu nhiên tất định (cùng hạt luôn ra cùng số)
const bam = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
// bật ra có đàn hồi nhẹ
const bat = k => { k = kep(k, 0, 1); const u = k - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u }

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const S = Math.min(W, H)          // đơn vị cỡ chung: nét, hạt, biểu tượng
  const doc = H > W                 // khung dọc
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  r.setPixelRatio(1)
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  // Máy trực giao theo điểm ảnh: gốc trên trái, y hướng xuống (đặt mesh ở -y).
  // dx.raMan lo phần đổi toạ độ thế giới → điểm ảnh theo m.tam / m.cao của từng góc máy.
  const cam = new THREE.OrthographicCamera(0, W, 0, -H, 0.1, 100)
  cam.position.set(0, 0, 10)

  const comp = new EffectComposer(r)
  comp.setPixelRatio(1)
  comp.setSize(W, H)
  comp.addPass(new RenderPass(scene, cam))
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.62, 0.55, 0.2)
  comp.addPass(bloom)
  comp.addPass(new OutputPass())

  // ---- Bảng màu ----
  // Nền của phong cách (phố neon), còn màu nhân vật lấy từ kb.nhan_vat.
  const NEN = {
    vien: '#6a3cff', hong: '#ff2e7e', tim: '#3a2470', vang: '#ffd84d', cy: '#34e7ff',
  }
  const pal = hex => ({ c: new THREE.Color(hex), w: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.5) })
  const P = {
    vien: pal(NEN.vien), hong: pal(NEN.hong), tim: pal(NEN.tim),
    vang: pal(NEN.vang), cy: pal(NEN.cy), trang: pal('#e8f2ff'),
  }

  // Màu nhân vật: gần = áo, xa = quần, da = thân, mặt = màu mặt, nhấn = phụ.
  const layMau = nv => ({
    gan: pal(nv.ao || '#34e7ff'), xa: pal(nv.quan || '#ff4fd8'),
    da: pal(nv.than || '#34e7ff'), mat: pal(nv.mat || '#ffffff'), nhan: pal(nv.phu || '#ffd84d'),
  })
  const MAU = layMau(kb.nhan_vat || pc.nhan_vat || {})
  const MAU_PHU = kb.nhan_vat_phu ? layMau(kb.nhan_vat_phu) : null

  // ---- Hồ sơ vẽ: gom mọi nét vào hai lưới, mỗi khung chỉ hai lần vẽ ----
  const MAX_NET = 2200, MAX_CHAM = 520
  const attrVitriN = new THREE.BufferAttribute(new Float32Array(MAX_NET * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const attrMauN = new THREE.BufferAttribute(new Float32Array(MAX_NET * 6 * 4), 4).setUsage(THREE.DynamicDrawUsage)
  const attrVitriC = new THREE.BufferAttribute(new Float32Array(MAX_CHAM * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage)
  const attrMauC = new THREE.BufferAttribute(new Float32Array(MAX_CHAM * 6 * 4), 4).setUsage(THREE.DynamicDrawUsage)
  let soNet = 0, soCham = 0

  const geoTroi = new THREE.PlaneGeometry(W, H)
  const skyTex = taoNenTroi(THREE)
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthWrite: false, depthTest: false })
  const troi = new THREE.Mesh(geoTroi, skyMat)
  troi.position.set(W / 2, -H / 2, -2)
  scene.add(troi)

  const geoNet = new THREE.BufferGeometry()
  geoNet.setAttribute('position', attrVitriN)
  geoNet.setAttribute('color', attrMauN)
  geoNet.setDrawRange(0, 0)
  geoNet.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5)
  const luoiNet = new THREE.Mesh(geoNet, new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }))
  luoiNet.frustumCulled = false
  scene.add(luoiNet)

  const geoCham = new THREE.BufferGeometry()
  geoCham.setAttribute('position', attrVitriC)
  geoCham.setAttribute('color', attrMauC)
  // texture chấm mềm cần uv; mọi ô chấm dùng chung một uv 0..1
  const uvCham = new Float32Array(MAX_CHAM * 12)
  for (let i = 0; i < MAX_CHAM; i++) {
    const o = i * 12
    uvCham[o] = 0; uvCham[o + 1] = 0; uvCham[o + 2] = 1; uvCham[o + 3] = 0; uvCham[o + 4] = 1; uvCham[o + 5] = 1
    uvCham[o + 6] = 1; uvCham[o + 7] = 1; uvCham[o + 8] = 0; uvCham[o + 9] = 1; uvCham[o + 10] = 0; uvCham[o + 11] = 0
  }
  geoCham.setAttribute('uv', new THREE.BufferAttribute(uvCham, 2))
  geoCham.setDrawRange(0, 0)
  geoCham.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e5)
  const luoiCham = new THREE.Mesh(geoCham, new THREE.MeshBasicMaterial({
    map: taoChamMem(THREE), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, side: THREE.DoubleSide,
  }))
  luoiCham.frustumCulled = false
  scene.add(luoiCham)

  // ---- Ghi hình học ----
  let m = null                       // máy của khung đang vẽ
  let matLon = null                  // chỗ con mắt neon trong khung đang vẽ
  const P2 = pt => dx.raMan(pt, m)   // thế giới → điểm ảnh

  function ghi6(attrV, attrC, o, x1, y1, x2, y2, x3, y3, x4, y4, x5, y5, x6, y6, c, a) {
    const v = attrV.array, w = attrC.array
    v[o] = x1; v[o + 1] = -y1; v[o + 2] = 0
    v[o + 3] = x2; v[o + 4] = -y2; v[o + 5] = 0
    v[o + 6] = x3; v[o + 7] = -y3; v[o + 8] = 0
    v[o + 9] = x4; v[o + 10] = -y4; v[o + 11] = 0
    v[o + 12] = x5; v[o + 13] = -y5; v[o + 14] = 0
    v[o + 15] = x6; v[o + 16] = -y6; v[o + 17] = 0
    const q = o / 3 * 4
    for (let i = 0; i < 6; i++) {
      const j = q + i * 4
      w[j] = c.r; w[j + 1] = c.g; w[j + 2] = c.b; w[j + 3] = a
    }
  }

  // một đoạn thẳng neon: thân màu + lõi trắng mảnh
  function net(a, b, w, p, al = 1, core = true) {
    if (al <= 0.004 || soNet >= MAX_NET) return
    const vx = b[0] - a[0], vy = b[1] - a[1]
    const L = Math.hypot(vx, vy)
    if (L < 1e-4) return
    const ux = vx / L, uy = vy / L, e = w * 0.5
    const x0 = a[0] - ux * e, y0 = a[1] - uy * e, x1 = b[0] + ux * e, y1 = b[1] + uy * e
    const nx = -uy * e, ny = ux * e
    ghi6(attrVitriN, attrMauN, soNet * 18,
      x0 + nx, y0 + ny, x0 - nx, y0 - ny, x1 + nx, y1 + ny,
      x1 + nx, y1 + ny, x0 - nx, y0 - ny, x1 - nx, y1 - ny, p.c, al)
    soNet++
    if (core) {
      if (soNet >= MAX_NET) return
      const ec = w * 0.2
      const cx0 = a[0] - ux * e, cy0 = a[1] - uy * e, cx1 = b[0] + ux * e, cy1 = b[1] + uy * e
      const mx = -uy * ec, my = ux * ec
      ghi6(attrVitriN, attrMauN, soNet * 18,
        cx0 + mx, cy0 + my, cx0 - mx, cy0 - my, cx1 + mx, cy1 + my,
        cx1 + mx, cy1 + my, cx0 - mx, cy0 - my, cx1 - mx, cy1 - my, p.w, Math.min(1, al * 0.95))
      soNet++
    }
  }

  // một chấm sáng (dùng texture mềm)
  function cham(x, y, rad, p, al = 1, core = true) {
    if (al <= 0.004 || soCham >= MAX_CHAM || rad <= 0.05) return
    ghi6(attrVitriC, attrMauC, soCham * 18,
      x - rad, y - rad, x + rad, y - rad, x + rad, y + rad,
      x + rad, y + rad, x - rad, y + rad, x - rad, y - rad, p.c, al)
    soCham++
    if (core && soCham < MAX_CHAM) {
      const rr = rad * 0.45
      ghi6(attrVitriC, attrMauC, soCham * 18,
        x - rr, y - rr, x + rr, y - rr, x + rr, y + rr,
        x + rr, y + rr, x - rr, y + rr, x - rr, y - rr, p.w, Math.min(1, al))
      soCham++
    }
  }

  const cungPts = (cx, cy, rx, ry, a0, a1, n) => {
    const o = []
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n
      o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
    }
    return o
  }
  function vong(cx, cy, rx, ry, p, al = 1, w = 3, n = 26, core = true) {
    const pts = cungPts(cx, cy, rx, ry, 0, TAU, n)
    for (let i = 0; i < n; i++) net(pts[i], pts[i + 1], w, p, al, core)
  }
  function duong(pts, w, p, al = 1, core = true) {
    for (let i = 0; i < pts.length - 1; i++) net(pts[i], pts[i + 1], w, p, al, core)
  }

  function moDau() {
    soNet = 0; soCham = 0
  }
  function dongLai() {
    geoNet.setDrawRange(0, soNet * 6)
    if (soNet) {
      attrVitriN.clearUpdateRanges(); attrVitriN.addUpdateRange(0, soNet * 18); attrVitriN.needsUpdate = true
      attrMauN.clearUpdateRanges(); attrMauN.addUpdateRange(0, soNet * 24); attrMauN.needsUpdate = true
    }
    geoCham.setDrawRange(0, soCham * 6)
    if (soCham) {
      attrVitriC.clearUpdateRanges(); attrVitriC.addUpdateRange(0, soCham * 18); attrVitriC.needsUpdate = true
      attrMauC.clearUpdateRanges(); attrMauC.addUpdateRange(0, soCham * 24); attrMauC.needsUpdate = true
    }
  }

  // ---- Nền: trời, chân trời, lưới sàn, nhà, hạt bụi ----
  function veNen(T, sk) {
    const sang = 1 + 0.55 * (sk.sang || 0)
    // chân trời bám theo đường đất chiếu ra, kẹp lại để bố cục luôn đẹp
    const groundPx = P2([0, 0])[1]
    const HY = kep(groundPx - H * 0.235, H * 0.42, H * 0.80)
    const VX = W / 2 - kep(m.tam[0] * 0.02 * S, -W * 0.06, W * 0.06)

    // lưới sàn: đường dọc toả từ điểm tụ, đường ngang thưa dần
    for (let i = -10; i <= 10; i++) {
      const a = 0.16 + 0.18 * Math.abs(i) / 10
      net([VX + i * W * 0.010, HY], [VX + i * W * 0.150, H * 1.02], Math.max(1, S * 0.0025), P.vien, a * sang, false)
    }
    const ph = (T * 0.11) % 1
    for (let k = 0; k < 9; k++) {
      const u = (k + ph) / 9
      const y = HY + (H - HY) * u * u
      net([0, y], [W, y], Math.max(1, S * 0.0024), P.vien, (0.06 + 0.26 * u) * sang, false)
    }
    // đường chân trời phát sáng
    net([0, HY], [W, HY], Math.max(2, S * 0.0042), P.hong, 0.55 * sang, true)
    cham(VX, HY, W * 0.30, P.hong, 0.05 * sang, false)

    // nhà xa: khung nét tím, vài cửa sổ sáng, biển neon
    const nha = [[0.06, 0.10, 0.52], [0.13, 0.12, 0.34], [0.19, 0.09, 0.60], [0.70, 0.09, 0.44],
      [0.77, 0.12, 0.66], [0.86, 0.10, 0.38], [0.93, 0.07, 0.55]]
    const truot = -kep(m.tam[0] * 0.008 * S, -W * 0.03, W * 0.03)
    for (let i = 0; i < nha.length; i++) {
      const [fx, fw, fh] = nha[i]
      const x0 = fx * W + truot + Math.sin(T * 0.2 + i) * 1.5
      const x1 = x0 + fw * W, y0 = HY, y1 = HY - fh * H
      duong([[x0, y0], [x0, y1], [x1, y1], [x1, y0]], Math.max(1, S * 0.0022), P.tim, 0.55 * sang, false)
      for (let k = 0; k < 3; k++) {
        const wy = y1 + (k + 1) * (y0 - y1) / 4
        net([x0 + fw * W * 0.18, wy], [x0 + fw * W * 0.82, wy], Math.max(1, S * 0.0018),
          k === 1 ? P.cy : P.vang, (0.14 + 0.10 * Math.sin(T * 0.7 + i + k)) * sang, false)
      }
      if (i % 3 === 0) {
        const sx = x0 + fw * W * 0.2, sy = y1 + (y0 - y1) * 0.18
        net([sx, sy], [sx + fw * W * 0.6, sy], Math.max(1.4, S * 0.0032), i === 0 ? P.cy : P.hong, 0.7 * sang, true)
        net([sx, sy], [sx, sy + H * 0.05], Math.max(1.4, S * 0.0032), i === 0 ? P.cy : P.hong, 0.7 * sang, true)
      }
    }

    // hạt bụi sáng trôi lên
    for (let i = 0; i < 64; i++) {
      const sp = 8 + bam(i * 3.1) * 18
      const y = H - ((bam(i * 1.7) * H + T * sp) % H)
      const x = bam(i * 5.3) * W + Math.sin(T * 0.3 + i) * S * 0.03
      const tw = 0.5 + 0.5 * Math.sin(T * (1 + bam(i) * 2) + i)
      cham(x, y, S * (0.0018 + bam(i * 9.1) * 0.0022),
        i % 3 === 0 ? P.hong : i % 3 === 1 ? P.cy : P.vien, (0.10 + 0.26 * tw) * sang, false)
    }

    // kết vui: bừng sáng ở chân trời
    if (sk.sang > 0.01) cham(VX, HY, W * 0.36, P.vang, 0.07 * sk.sang, false)
  }

  // ---- Nhân vật que ----
  // p: tư thế của dx. o: màu, bề dày, độ mờ, phản chiếu, có lõi sáng hay không.
  function veNguoi(p, o) {
    const k = dx.khung2D(p)
    const h = k.huong, s = k.chinhDien
    const w = o.w, al = o.al ?? 1, core = o.core !== false
    // Tay buông dạt ra khỏi thân: nhìn nghiêng tách hẳn hai bên, nhìn chính diện hơi rộng ra.
    const day = 0.054 * (1 - s) + 0.014 * s
    const coreChi = core && w >= 6   // nét mảnh thì bỏ lõi trắng cho tay chân khỏi dính vào thân
    const chieu = o.refl ? (pt => [pt[0], -pt[1] * 0.5]) : (pt => pt)
    const mo = o.refl ? (a, b) => Math.max(0, 1 - Math.max(a[1], b[1]) / 0.55) : () => 1
    const doan = (a, b, ww, pl, aa = al, cc = core) => net(P2(chieu(a)), P2(chieu(b)), ww, pl, aa * mo(a, b), cc)
    const diem = (pt, rad, pl, aa = al) => {
      const q = P2(chieu(pt))
      cham(q[0], q[1], rad, pl, aa * mo(pt, pt) * (o.refl ? 0.8 : 1), !o.refl && core)
    }
    const dayP = pt => [pt[0] + day, pt[1]]
    const dayT = pt => [pt[0] - day, pt[1]]
    const R = dx.XUONG.banKinhDau * (H / m.cao) * 1.06

    // phía xa (màu quần) vẽ trước
    doan(k.vai, dayT(k.khuyuT), w * 0.88, o.xa, al * 0.85, coreChi)
    doan(dayT(k.khuyuT), dayT(k.banT), w * 0.82, o.xa, al * 0.85, coreChi)
    diem(dayT(k.banT), w * 0.62, o.da, al * 0.9)
    doan(k.hong, k.goiT, w * 0.9, o.xa, al * 0.85, coreChi)
    doan(k.goiT, k.coChanT, w * 0.84, o.xa, al * 0.85, coreChi)
    net(P2(chieu(k.coChanT)), P2(chieu([k.coChanT[0] + h * 0.06, k.coChanT[1] + 0.012])), w * 0.8, o.xa, al * 0.85 * mo(k.coChanT, k.coChanT), coreChi)

    // thân + cổ
    const ang = k.gocDau
    const u = [Math.sin(ang) * h, Math.cos(ang)]
    const coDau = [k.dau[0] - u[0] * R * (1 / (H / m.cao)), k.dau[1] - u[1] * R * (1 / (H / m.cao))]
    doan(k.hong, k.coGoc, w * 1.1, o.gan)
    doan(k.coGoc, coDau, w * 0.78, o.gan)
    diem(k.coGoc, w * 0.5, o.gan, al * 0.85)

    // phía gần (màu áo)
    doan(k.vai, dayP(k.khuyuP), w * 0.9, o.gan, al, coreChi)
    doan(dayP(k.khuyuP), dayP(k.banP), w * 0.84, o.gan, al, coreChi)
    diem(dayP(k.banP), w * 0.66, o.da)
    doan(k.hong, k.goiP, w * 0.92, o.gan, al, coreChi)
    doan(k.goiP, k.coChanP, w * 0.86, o.gan, al, coreChi)
    net(P2(chieu(k.coChanP)), P2(chieu([k.coChanP[0] + h * 0.06, k.coChanP[1] + 0.012])), w * 0.82, o.gan, al * mo(k.coChanP, k.coChanP), coreChi)

    // đầu: vòng neon + quầng mờ bên trong cho mặt dễ đọc
    const D = P2(chieu(k.dau))
    if (!o.khongDau) {
      cham(D[0], D[1], R * 1.02, o.gan, 0.055 * al * (o.refl ? 0.5 : 1), false)
      vong(D[0], D[1], R, R, o.gan, al * (o.refl ? 0.55 : 1), w * 0.95, 44, core)
      if (o.quai) {
        // quái: hai tai nhọn trên vòng đầu
        net([D[0] - R * 0.62, D[1] - R * 0.72], [D[0] - R * 0.9, D[1] - R * 1.55], w * 0.8, o.gan, al, core)
        net([D[0] + R * 0.62, D[1] - R * 0.72], [D[0] + R * 0.9, D[1] - R * 1.55], w * 0.8, o.gan, al, core)
      }
    }
    if (o.quai) {
      // móng tay
      for (const q of [dayP(k.banP), dayT(k.banT)]) {
        const qq = P2(chieu(q))
        for (let i = 0; i < 3; i++) net([qq[0], qq[1]], [qq[0] + (i - 1) * w * 1.2, qq[1] + w * 1.5], w * 0.5, o.nhan, al * 0.9, false)
      }
    }
    return { k, D, R }
  }

  // Phản chiếu sàn: gương quanh mặt đất, ép mỏng, mờ dần theo độ cao nên không bị cắt cụt.
  function veBong(p, o) {
    veNguoi(p, { ...o, refl: true, al: 0.42, core: false })
    const q = P2(dx.khung2D(p).coChanP)
    cham(q[0], q[1], S * 0.055, o.gan, 0.14, false)
  }

  // Vệt chuyển động: vẽ lại vài tư thế trước, chỉ hiện khi khớp dịch đủ nhiều.
  function veVet(T, p, o) {
    const k0 = dx.khung2D(p)
    const g0 = [k0.banP, k0.banT, k0.coChanP, k0.coChanT, k0.dau].map(q => P2(q))
    const ds = []
    // động tác vung tay rất nhanh (mừng, vẫy) thì ít vệt hơn cho khỏi rối
    const buoc = (p.viec === 'mung' || p.viec === 'vay') ? 2 : 4
    for (let i = buoc; i >= 1; i--) {
      const tt = T - i * 0.032
      if (tt < 0) continue
      const pk = dx.tuThe(tt)
      if (!pk) continue
      const kk = dx.khung2D(pk)
      const gk = [kk.banP, kk.banT, kk.coChanP, kk.coChanT, kk.dau].map(q => P2(q))
      let mx = 0
      for (let n = 0; n < 5; n++) mx = Math.max(mx, Math.hypot(gk[n][0] - g0[n][0], gk[n][1] - g0[n][1]))
      if (mx < S * 0.012) continue
      // không vẽ lại vòng đầu: chuỗi vòng lệch nhau trông như quầng lạ
      ds.push({ pk, al: 0.26 * (1 - i / (buoc + 1)) * Math.min(1, mx / (S * 0.07)) })
    }
    for (const d of ds) veNguoi(d.pk, { ...o, al: d.al, core: false, khongDau: true })
  }

  // ---- Mặt: mắt, lông mày, miệng theo p.mat / p.mieng / p.mieng_mo / p.chop ----
  function veMat(p, k, D, R, mau) {
    const h = k.huong
    const ang = k.gocDau
    const u = [Math.sin(ang) * h, Math.cos(ang)]
    const f = [Math.cos(ang) * h, -Math.sin(ang)]
    // điểm trên mặt: fx = ngang theo hướng mặt, fy = lên
    const at = (fx, fy) => [D[0] + (f[0] * fx + u[0] * fy) * R, D[1] - (f[1] * fx + u[1] * fy) * R]
    const F = mau.mat, wl = Math.max(1.5, R * 0.075)
    // độ quay mặt về phía máy: mắt càng tách ra khi nhìn thẳng
    const nh = 0.75 + 0.5 * kep(p.nhin ?? 0.4, 0, 1)
    const e1 = at(-0.26 * nh, 0.13), e2 = at(0.26 * nh, 0.13)
    const md = at(0.0, -0.44)
    const re = Math.max(2.0, R * 0.16)            // mắt to hơn hẳn bản cũ
    const mat = p.mat || 'thuong'

    // mắt
    if (p.chop && mat !== 'nham') {
      for (const e of [e1, e2]) net([e[0] - re * 1.15, e[1]], [e[0] + re * 1.15, e[1]], wl, F, 1, false)
    } else if (mat === 'so' || mat === 'mo-to') {
      const rr = mat === 'so' ? re * 1.14 : re * 1.05
      for (const e of [e1, e2]) {
        vong(e[0], e[1], rr, rr, F, 1, wl, 14, false)
        cham(e[0], e[1], rr * 0.42, F, 1, false)
      }
    } else if (mat === 'vui') {
      // mắt cong hình chữ V ngược
      for (const e of [e1, e2]) {
        duong([[e[0] - re, e[1] + re * 0.55], [e[0], e[1] - re * 0.5], [e[0] + re, e[1] + re * 0.55]], wl, F, 1, false)
      }
    } else if (mat === 'ngai') {
      for (const e of [e1, e2]) {
        net([e[0] - re * 0.9, e[1] - re * 0.8], [e[0] + re * 0.9, e[1] + re * 0.8], wl, F, 1, false)
        net([e[0] - re * 0.9, e[1] + re * 0.8], [e[0] + re * 0.9, e[1] - re * 0.8], wl, F, 1, false)
      }
    } else if (mat === 'nham') {
      for (const e of [e1, e2]) duong([[e[0] - re, e[1] + re * 0.25], [e[0], e[1] - re * 0.15], [e[0] + re, e[1] + re * 0.25]], wl, F, 1, false)
    } else if (mat === 'buon') {
      for (const e of [e1, e2]) {
        cham(e[0], e[1] + re * 0.12, re * 0.78, F, 1, false)
        // mí trên sụp xuống cho buồn
        net([e[0] - re * 1.05, e[1] - re * 0.5], [e[0] + re * 1.05, e[1] - re * 0.28], wl, F, 1, false)
      }
    } else if (mat === 'gian') {
      for (const e of [e1, e2]) cham(e[0], e[1], re * 0.85, F, 1, false)
    } else {
      const sh = mat === 'lieng' ? R * 0.10 * h : 0
      for (const e of [e1, e2]) cham(e[0] + sh, e[1], re * 0.9, F, 1, false)
    }

    // lông mày (đặt cao hơn mắt để không dính vào mắt)
    const lm = p.longMay || 'thuong'
    const brow = (e, fy, fy2) => net([e[0] - re * 0.95, e[1] - R * 0.42 + (fy || 0)], [e[0] + re * 0.95, e[1] - R * 0.42 + (fy2 || 0)], Math.max(1.1, wl * 0.72), F, 0.75, false)
    if (lm === 'nhuong') { brow(e1, -R * 0.02, R * 0.02); brow(e2, -R * 0.02, R * 0.02) }
    else if (lm === 'lo') { brow(e1, R * 0.04, -R * 0.04); brow(e2, -R * 0.04, R * 0.04) }
    else if (lm === 'vui') { brow(e1, 0, -R * 0.05); brow(e2, -R * 0.05, 0) }
    else if (lm === 'nghi') { brow(e1, -R * 0.06, 0); brow(e2, 0, -R * 0.06) }
    else if (lm === 'buon') { brow(e1, -R * 0.05, R * 0.03); brow(e2, R * 0.03, -R * 0.05) }
    else if (mat === 'gian') { brow(e1, -R * 0.08, R * 0.05); brow(e2, R * 0.05, -R * 0.08) }

    // miệng
    const mw = R * 0.34
    const mieng = p.mieng || 'dong'
    const mo = p.mieng_mo || 0
    if (mieng === 'o') {
      vong(md[0], md[1], mw * 0.45, mw * 0.55, F, 1, wl, 12, false)
    } else if (mieng === 'het') {
      const ryy = mw * (0.55 + 0.16 * Math.sin((p.t || 0) * 50))
      vong(md[0], md[1] - mw * 0.15, mw * 0.72, ryy, F, 1, wl, 16, false)
    } else if (mieng === 'noi') {
      const ry = mw * (0.12 + 0.62 * mo)
      vong(md[0], md[1], mw * 0.66, ry, F, 1, wl, 16, false)
    } else if (mieng === 'run') {
      const pts = []
      for (let i = 0; i <= 6; i++) pts.push([md[0] - mw * 0.8 + i * mw * 0.27, md[1] + (i % 2 ? -mw * 0.22 : mw * 0.18)])
      duong(pts, wl, F, 1, false)
    } else if (mieng === 'cuoi' || mieng === 'cuoi-guong') {
      const pts = cungPts(md[0], md[1] - mw * 0.34, mw * 0.86, mw * 0.62, PI * 0.18, PI * 0.82, 12)
      duong(pts, wl, F, 1, false)
      if (mieng === 'cuoi-guong') for (let i = 0; i < 3; i++) {
        const x = md[0] - mw * 0.42 + i * mw * 0.42
        net([x, md[1] + mw * 0.02], [x, md[1] + mw * 0.38], wl * 0.7, F, 0.85, false)
      }
    } else if (mieng === 'buon') {
      const pts = cungPts(md[0], md[1] + mw * 0.34, mw * 0.8, mw * 0.5, PI * 1.18, PI * 1.82, 12)
      duong(pts, wl, F, 1, false)
    } else if (mieng === 'gam') {
      net([md[0] - mw * 0.8, md[1]], [md[0] + mw * 0.8, md[1]], wl, F, 1, false)
      for (let i = 0; i < 3; i++) {
        const x = md[0] - mw * 0.5 + i * mw * 0.5
        net([x, md[1] - mw * 0.2], [x, md[1] + mw * 0.2], wl * 0.7, F, 0.9, false)
      }
    } else {
      net([md[0] - mw * 0.6, md[1]], [md[0] + mw * 0.6, md[1]], wl, F, 1, false)
    }
  }

  // ---- Biểu tượng tâm lý quanh đầu ----
  function viTriBieuTuong(k, R, s) {
    const D = P2(k.dau)
    // ba chỗ đặt: trái đầu, trên đầu, phải đầu; tránh con mắt và vùng chữ phụ đề
    const ung = [
      { x: D[0] - (R + s * 1.12), y: D[1] + s * 0.10, uu: 0 },
      { x: D[0], y: D[1] - R - s * 0.78, uu: 1 },
      { x: D[0] + (R + s * 1.12), y: D[1] + s * 0.10, uu: 2 },
    ]
    let hay = null, diem = -1e9
    for (const c of ung) {
      const lo = c.uu === 1 ? s * 0.6 : s * 0.95
      if (c.x - lo < W * 0.07 || c.x + lo > W * 0.93) continue
      if (c.y - s * 0.7 < H * (doc ? 0.32 : 0.10) || c.y + s * 0.7 > H * (doc ? 0.68 : 0.66)) continue
      let d = 1e9
      // chỉ né con mắt khi nó đang nằm trong khung
      if (matLon && matLon.x > -matLon.A && matLon.x < W + matLon.A && matLon.y > -matLon.A && matLon.y < H + matLon.A)
        d = Math.hypot(c.x - matLon.x, c.y - matLon.y)
      const sc = Math.min(d, 1e4) - c.uu * S * 0.06
      if (sc > diem) { diem = sc; hay = c }
    }
    if (!hay) hay = { x: D[0] - (R + s * 1.12), y: D[1] + s * 0.10 }
    return [kep(hay.x, W * 0.1, W * 0.9), kep(hay.y, H * (doc ? 0.34 : 0.13), H * (doc ? 0.66 : 0.60))]
  }

  function veBieuTuong(T, p, k, R) {
    const viec = p.viec
    let loai = null
    if (viec === 'giat-minh') loai = 'than'
    else if (viec === 'nghi') loai = 'bong'
    else if (viec === 'run') loai = 'vong'
    else if (viec === 'vay' || viec === 'mung') loai = 'tim'
    else if (viec === 'buon') loai = 'giot'
    if (!loai) return
    const c = dx.canh[p.canh]
    if (!c) return
    // nhân vật ra khỏi khung (máy lùi, chạy xa) thì không để biểu tượng trôi một mình
    const D0 = P2(k.dau)
    if (D0[0] < -R || D0[0] > W + R || D0[1] < -R || D0[1] > H + R) return
    const tc = T - c.tu, d = Math.max(0.1, c.den - c.tu)
    const al = Math.min(1, tc / 0.10) * Math.min(1, (d - tc) / 0.20)
    if (al <= 0.01) return
    const pop = bat(tc / 0.26)
    const s = kep(R * 1.7, S * 0.035, S * 0.078) * (0.55 + 0.45 * pop)
    const [cx, cy] = viTriBieuTuong(k, R, s)
    const w = Math.max(1.5, s * 0.09)

    if (loai === 'than') {
      // chấm than
      const rung = 1 + 0.06 * Math.sin(T * 55) * kep((tc - 0.3) / 0.2, 0, 1)
      net([cx, cy - s * 0.86], [cx, cy + s * 0.12], w * 2.0 * rung, MAU.nhan, al)
      cham(cx, cy + s * 0.52, s * 0.19, MAU.nhan, al)
    } else if (loai === 'bong') {
      // bong bóng nghĩ "…"
      const ry = s * 0.5, rx = s * 0.78
      vong(cx, cy - s * 0.22, rx, ry, P.cy, al * 0.9, w * 0.8, 24, true)
      // đuôi bong bóng về phía đầu
      cham(cx + rx * 0.55, cy + s * 0.36, s * 0.10, P.cy, al * 0.8, false)
      cham(cx + rx * 0.78, cy + s * 0.52, s * 0.06, P.cy, al * 0.7, false)
      for (let i = 0; i < 3; i++) {
        const pu = 0.5 + 0.5 * Math.sin(T * 5 - i * 1.1)
        cham(cx - rx * 0.34 + i * rx * 0.34, cy - s * 0.22 + s * 0.04 * pu, s * 0.09, MAU.nhan, al * 0.9, false)
      }
    } else if (loai === 'vong') {
      // vòng lo âu: ba vòng nét đứt nở ra + gai run
      for (let i = 0; i < 3; i++) {
        const q = ((T - c.tu) * 0.85 + i / 3) % 1
        const rad = s * (0.55 + q * 1.15)
        const a = al * (1 - q) * 0.9
        const n = 12
        for (let j = 0; j < n; j++) {
          const a0 = j * TAU / n + T * (i % 2 ? -1.4 : 1.4), a1 = a0 + TAU / n * 0.55
          duong(cungPts(cx, cy, rad, rad, a0, a1, 4), w * 0.8, i === 1 ? MAU.xa : MAU.nhan, a, false)
        }
      }
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + 0.4, j = s * 0.12 * Math.sin(T * 48 + i * 2.3)
        net([cx + Math.cos(a) * s * 0.62, cy + Math.sin(a) * s * 0.62],
          [cx + Math.cos(a) * (s * 0.92 + j), cy + Math.sin(a) * (s * 0.92 + j)], w * 0.7, MAU.xa, al * 0.85, false)
      }
    } else if (loai === 'tim') {
      // tim bay lên nhẹ
      const bay = -s * 0.18 * Math.min(1, tc / 1.2)
      const pts = []
      for (let i = 0; i <= 26; i++) {
        const a = i / 26 * TAU
        const hx = 16 * Math.pow(Math.sin(a), 3)
        const hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)
        pts.push([cx + hx / 17 * s * 0.8, cy + bay - hy / 17 * s * 0.8])
      }
      duong(pts, w * 0.9, MAU.nhan, al)
      for (let i = 1; i < 3; i++) {
        const pu = 0.5 + 0.5 * Math.sin(T * 4 + i * 1.4)
        cham(cx + (i === 1 ? -1 : 1) * s * 0.55, cy + bay - s * (0.15 + 0.2 * pu), s * 0.07, MAU.nhan, al * 0.6, false)
      }
    } else if (loai === 'giot') {
      // giọt nước mắt
      const r = s * 0.32
      const pts = cungPts(cx, cy + s * 0.26, r, r, -PI * 0.22, PI * 1.22, 14)
      pts.push([cx, cy - s * 0.72])
      pts.push(pts[0])
      duong(pts, w * 0.85, P.cy, al)
      cham(cx - r * 0.25, cy + s * 0.22, r * 0.3, P.trang, al * 0.8, false)
    }
  }

  // ---- Thứ lạ bên phải: con mắt neon khổng lồ ----
  // Chỗ đặt tính một lần mỗi khung (dùng chung cho cả biểu tượng để khỏi đè lên nhau).
  function viTriMatLon(T, sk) {
    if ((sk.hien || 0) <= 0.02) return null
    const A = S * 0.105
    const q = P2([dx.hienX(T), 1.02])
    // chỉ kẹp dọc: khung dọc có chữ phụ đề ở nửa trên, không để con mắt chui vào đó
    return { x: q[0], y: kep(q[1], H * (doc ? 0.34 : 0.14), H * 0.62), A }
  }

  function veMatLon(T, sk, kMain) {
    const hien = sk.hien || 0
    if (hien <= 0.02 || !matLon) return
    const q = [matLon.x, matLon.y], A = matLon.A
    // con mắt đã trôi ra khỏi khung (máy đi xa chỗ nó hiện) thì thôi
    if (q[0] < -A * 1.4 || q[0] > W + A * 1.4 || q[1] < -A * 1.4 || q[1] > H + A * 1.4) return
    const mo = Math.min(1, 0.15 + hien * 1.5)
    // nhấp nháy lúc mới bật
    let sang = 1
    if (sk.hienTu !== null && sk.hienTu !== undefined && T - sk.hienTu < 0.55)
      sang = bam(Math.floor((T - sk.hienTu) * 26) + 3) < 0.35 ? 0.25 : 1
    // chớp mắt định kỳ
    let chop = 1
    if (sk.hienTu !== null && sk.hienTu !== undefined) {
      const chu = (T - sk.hienTu) % 4.1
      if (chu > 3.96 && chu < 4.06) chop = 0.12
    }
    const al = Math.min(1, hien * 2.0) * sang
    const B = A * 0.5 * mo * chop * (1 + 0.03 * Math.sin(T * 6))
    // hai mí mắt
    const tren = [], duoi = []
    for (let i = 0; i <= 26; i++) {
      const s = -1 + i / 13
      tren.push([q[0] + A * s, q[1] - B * Math.cos(s * PI / 2)])
      duoi.push([q[0] + A * s, q[1] + B * 0.92 * Math.cos(s * PI / 2)])
    }
    duong(tren, Math.max(2, S * 0.0055), P.hong, al)
    duong(duoi, Math.max(2, S * 0.005), P.hong, al)
    if (mo > 0.35 && chop > 0.5) {
      const look = kep(((kMain ? kMain[0] : W / 2) - q[0]) / A, -1, 1) * A * 0.28
      const ix = q[0] + look, iy = q[1]
      vong(ix, iy, A * 0.3, A * 0.34, P.vang, al * 0.95, Math.max(1.6, S * 0.0045), 20, true)
      cham(ix, iy, A * 0.11 * (1 + 0.12 * Math.sin(T * 7)), P.trang, al)
    }
    // tia sáng quanh mắt
    for (let i = 0; i < 9; i++) {
      const a = -PI * (0.12 + 0.76 * i / 8), pu = 0.5 + 0.5 * Math.sin(T * 5 - i * 0.7)
      const r0 = A * 0.9, r1 = A * (1.05 + 0.18 * pu)
      net([q[0] + Math.cos(a) * r0 * 1.25, q[1] + Math.sin(a) * r0 * 0.9],
        [q[0] + Math.cos(a) * r1 * 1.25, q[1] + Math.sin(a) * r1 * 0.9],
        Math.max(1.2, S * 0.0028), P.hong, al * (0.35 + 0.45 * pu), false)
    }
    cham(q[0], q[1], A * 1.6, P.hong, 0.05 * al, false)
  }

  // ---- Một khung ----
  return {
    ve(T) {
      m = dx.may(T)
      const sk = dx.suKien(T)
      matLon = viTriMatLon(T, sk)
      const p = dx.tuThe(T, 'chinh')
      moDau()

      veNen(T, sk)

      // nhân vật phụ vẽ trước để nhân vật chính không bị che
      const ph = dx.tuThe(T, 'phu')
      if (ph && MAU_PHU) {
        const dangPhu = (kb.nhan_vat_phu && kb.nhan_vat_phu.dang) || 'nguoi'
        const vePhu = veNguoi(ph, {
          ...MAU_PHU, w: Math.max(2.2, S * 0.008), al: 1, quai: dangPhu === 'quai',
        })
        veMat(ph, vePhu.k, vePhu.D, vePhu.R, MAU_PHU)
      }

      if (p) {
        const o = { ...MAU, w: Math.max(2.6, S * 0.0095), al: 1, core: true }
        veBong(p, o)
        veVet(T, p, o)
        const { k, D, R } = veNguoi(p, o)
        veMat(p, k, D, R, MAU)
        veBieuTuong(T, p, k, R)
        veMatLon(T, sk, D)
      } else {
        veMatLon(T, sk, null)
      }

      dongLai()

      // máy: rung nhẹ khi sự kiện, luôn tất định
      const rg = sk.rung || 0
      cam.position.x = Math.sin(T * 97) * rg * S * 0.008
      cam.position.y = Math.sin(T * 83 + 1.3) * rg * S * 0.008
      bloom.strength = 0.62 + 0.26 * (sk.sang || 0)
      skyMat.color.setScalar(1 + 0.5 * (sk.sang || 0))
      comp.render()
    },
  }
}

// Nền trời: dải màu dọc, tối trên, ám tím ở chân trời, tối dưới.
function taoNenTroi(THREE) {
  const c = document.createElement('canvas')
  c.width = 8; c.height = 256
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, '#03040a')
  g.addColorStop(0.40, '#080a1c')
  g.addColorStop(0.68, '#1b0b33')
  g.addColorStop(0.80, '#0a0616')
  g.addColorStop(1, '#04030a')
  x.fillStyle = g; x.fillRect(0, 0, 8, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Chấm mềm: lõi sáng, rìa tan dần.
function taoChamMem(THREE) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.30, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g; x.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
