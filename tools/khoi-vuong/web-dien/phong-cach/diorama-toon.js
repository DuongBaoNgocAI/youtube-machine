// Phong cách "Diorama low-poly" (mã diorama-toon) cho bộ dựng diễn xuất của khoi-vuong.
// Đảo làng nhỏ low-poly: cỏ, đất, đá, biển, thuyền, mây, nhà, cây; nhân vật toon viền đen,
// hậu kỳ tilt-shift như mô hình. Nhân vật, máy, sự kiện lấy hết từ dx (dien.js).
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
// Mọi thứ trong ve(T) là hàm thuần theo T: không Math.random, không Date, không mạng, không vòng lặp khung.
// Không tải gì từ mạng; texture duy nhất là gradient trời tự vẽ bằng canvas.

import { mergeVertices } from '../lib/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from '../lib/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../lib/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from '../lib/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from '../lib/jsm/postprocessing/OutputPass.js'

const PI = Math.PI
// hash tất định cho mọi thứ ngẫu nhiên lúc dựng cảnh
const bam = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const kep = (v, a, b) => Math.max(a, Math.min(b, v))
const muot = k => { k = kep(k, 0, 1); return k * k * (3 - 2 * k) }
const tron = (a, b, k) => a + (b - a) * k

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const M = Math.min(W, H)                    // cỡ chuẩn cho nét, hạt, cỡ chữ phụ đề
  const ngang = W >= H
  const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
  r.setPixelRatio(1); r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 140)

  // ---- bảng màu: lấy từ bối cảnh nếu có, không thì bảng riêng của phong cách ----
  const B = bc || {}
  const P = {
    troi: B.troi || ['#4fa8dd', '#b9e2f2', '#fde6bd'],
    dat: B.dat || ['#86c64e', '#6fb044'],
    da: B.da || ['#9aa4bc', '#8690a8', '#7d82a0', '#6b7389'],
    la: B.la || ['#2f9a58', '#3aa85e', '#238a50', '#d0953a'],
    nuoc: B.nuoc || '#2f93b6',
    than: B.than || '#8a5a3c',
    nhan: B.nhan || '#f3e4c0',
    nhan2: B.nhan2 || '#c04a34',
  }
  const CO = (h, k = 1) => { const c = new THREE.Color(h); return k === 1 ? c : c.multiplyScalar(k) }
  const toi = (h, k) => '#' + new THREE.Color(h).multiplyScalar(k).getHexString()
  const hoa = ['#ff6f91', '#ffd23f', '#ffffff', '#ff9a4a', '#b98cff']
  const mai = ['#c04a34', '#3f8fa8', '#d0953a', '#8a5a9a', '#b8503c']

  // ---- trời: gradient vẽ bằng canvas, dán làm nền ----
  {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, P.troi[0]); gr.addColorStop(0.58, P.troi[1]); gr.addColorStop(1, P.troi[2])
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; scene.background = t
  }
  scene.fog = new THREE.Fog(CO(P.troi[1]).lerp(CO('#e7f3f2'), 0.35), 10, 46)

  // ---- ánh sáng: nắng ấm chếch trước phải, trời xanh hắt xuống, một đèn phụ phía máy ----
  const hemi = new THREE.HemisphereLight(CO('#dff3ff'), CO('#a08a62'), 1.35)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(CO('#ffe7bd'), 2.5)
  sun.position.set(4.6, 6.4, 5.2); sun.target.position.set(0, 0, -1)
  sun.castShadow = true
  const shadowSize = M >= 900 ? 2048 : 1024
  sun.shadow.mapSize.set(shadowSize, shadowSize)
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5.5, bottom: -4.5, near: 0.5, far: 22 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 2.5
  scene.add(sun, sun.target)
  const phu = new THREE.DirectionalLight(CO('#cfe8ff'), 0.46)
  phu.position.set(-5, 3.4, 6); phu.target.position.set(0, 0.6, 0); scene.add(phu, phu.target)
  const denMat = new THREE.DirectionalLight(CO('#fff2dc'), 0.5) // hắt vào mặt cho đọc được nét mặt
  denMat.position.set(0.5, 2.4, 7); denMat.target.position.set(0, 0.8, 0); scene.add(denMat, denMat.target)

  // ---- vật liệu toon 4 bậc + viền đen kiểu mô hình ----
  const grad = new THREE.DataTexture(new Uint8Array([95, 95, 95, 255, 160, 160, 160, 255, 215, 215, 215, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat)
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true
  const matCache = new Map()
  const toon = (h, e = 0) => {
    const c = CO(h), key = 't' + c.getHexString() + '_' + e
    return matCache.get(key) || matCache.set(key, new THREE.MeshToonMaterial({ color: c, gradientMap: grad, ...(e ? { emissive: c, emissiveIntensity: e } : {}) })).get(key)
  }
  const basic = (h, o = null) => {
    const c = CO(h), key = 'b' + c.getHexString() + (o ? JSON.stringify(o) : '')
    let m = matCache.get(key)
    if (!m) { m = new THREE.MeshBasicMaterial({ color: c, ...(o || {}) }); matCache.set(key, m) }
    return m
  }
  const vienCache = new Map()
  const vien = w => { // viền đen: phóng đỉnh theo pháp tuyến, chỉ vẽ mặt sau
    const key = Math.round(w * 1e5)
    if (vienCache.has(key)) return vienCache.get(key)
    const m = new THREE.ShaderMaterial({
      uniforms: { uW: { value: w } },
      vertexShader: 'uniform float uW; void main(){ vec3 p = position + normal * uW; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = vec4(0.014, 0.011, 0.020, 1.0); }',
      side: THREE.BackSide,
    })
    m.customProgramCacheKey = () => 'vien' + key
    vienCache.set(key, m); return m
  }

  // ---- hình học: jitter/scale/xoay/dời đỉnh, tách bản phẳng (fl) và bản mượt (sm) cho viền ----
  function G(geo, o = {}) {
    const { s = [1, 1, 1], r = [0, 0, 0], p = [0, 0, 0], j = [0, 0, 0], seed = 0 } = o
    geo.deleteAttribute('uv'); geo.deleteAttribute('normal')
    const pa = geo.attributes.position
    if (j.some(v => v)) for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
      const n = Math.round(x * 400) * 12.9898 + Math.round(y * 400) * 78.233 + Math.round(z * 400) * 37.719 + seed * 17.3
      pa.setXYZ(i, x + (bam(n) - 0.5) * 2 * j[0], y + (bam(n + 1.7) - 0.5) * 2 * j[1], z + (bam(n + 3.1) - 0.5) * 2 * j[2])
    }
    geo.scale(...s)
    if (r.some(v => v)) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...r)))
    geo.translate(...p)
    const sm = mergeVertices(geo.clone(), 1e-4); sm.computeVertexNormals()
    const fl = geo.index ? geo.toNonIndexed() : geo.clone(); fl.computeVertexNormals()
    return { fl, sm }
  }
  function part(parent, g, color, o = {}) {
    const { w = 0.006, cast = true, recv = true, bas = false, mat = null } = o
    const m = new THREE.Mesh(g.fl, mat || (bas ? basic(color) : toon(color)))
    m.castShadow = cast; m.receiveShadow = recv
    if (w > 0) { const v = new THREE.Mesh(g.sm, vien(w)); v.castShadow = false; v.receiveShadow = false; m.add(v) }
    parent.add(m); return m
  }
  const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g }
  const BOX = (x, y, z) => new THREE.BoxGeometry(x, y, z)
  const CYL = (rt, rb, h, n = 6) => new THREE.CylinderGeometry(rt, rb, h, n, 1)
  const ICO = (rad, d = 0) => new THREE.IcosahedronGeometry(rad, d)

  // đơn vị: 1 = chiều cao nhân vật, mặt đất y = 0, sân khấu x −3,2..3,2, máy nhìn tới ±3,8
  const RX = 6.4, RZ = 4.6, Z0 = -0.5

  // ===================== ĐẢO =====================
  // cỏ, đất, đá dưới, vành cát; mặt cỏ ở y ≈ 0 để chân nhân vật không lún
  part(scene, G(CYL(1, 1, 0.1, 22), { s: [RX, 1, RZ], p: [0, -0.054, Z0], j: [0.1, 0, 0.09], seed: 1 }), P.dat[0], { w: 0.018, recv: true })
  part(scene, G(CYL(1, 0.94, 0.42, 22), { s: [RX * 0.995, 1, RZ * 0.995], p: [0, -0.32, Z0], j: [0.1, 0.02, 0.09], seed: 2 }), '#9a6540', { w: 0.014 })
  part(scene, G(new THREE.ConeGeometry(1, 2.8, 13, 1), { s: [RX * 0.95, 1, RZ * 0.95], r: [PI, 0, 0], p: [0, -0.52 - 1.4, Z0], j: [0.22, 0.14, 0.18], seed: 3 }), P.da[2], { w: 0.02 })
  part(scene, G(CYL(1, 1, 0.05, 22), { s: [RX * 1.02, 1, RZ * 1.02], p: [0, -0.039, Z0], j: [0.07, 0, 0.06], seed: 4 }), '#e6cd96', { w: 0, cast: false })
  // đường mòn đất chạy ngang sân khấu
  part(scene, G(BOX(11.6, 0.05, 0.95), { p: [0, -0.024, 0.02], j: [0.03, 0, 0.02], seed: 5 }), '#dcbe86', { w: 0, cast: false })
  for (let i = 0; i < 15; i++) {
    const x = -5.4 + i * 0.78 + bam(i) * 0.24, z = (i % 2 ? 0.54 : -0.5) + (bam(i + 9) - 0.5) * 0.1
    part(scene, G(CYL(0.11, 0.13, 0.05, 6), { p: [x, 0.012, z], j: [0.012, 0, 0.012], seed: 10 + i }), P.da[0], { w: 0, cast: false })
  }
  // mấy gò cỏ nhô lên hai bên đường cho đỡ phẳng
  for (const [x, z, s, sd] of [[-5.1, -1.6, 0.55, 31], [4.9, -1.4, 0.5, 32], [-2.3, 1.9, 0.35, 33], [3.3, 1.8, 0.4, 34]]) {
    part(scene, G(ICO(0.5, 1), { s: [1.5, 0.45, 1], p: [x, 0.07, z], j: [0.06, 0.02, 0.05], seed: sd }), P.dat[1], { w: 0.012, cast: false })
  }

  // ===================== BIỂN =====================
  const bien = new THREE.Group(); scene.add(bien)
  {
    const geo = new THREE.PlaneGeometry(90, 66, 26, 18)
    const g = G(geo, { j: [0, 0.075, 0], seed: 40 })
    const m = new THREE.Mesh(g.fl, toon(P.nuoc))
    m.rotation.x = -PI / 2; m.position.set(0, -0.74, -24); m.receiveShadow = true; bien.add(m)
    // dải nước nông quanh đảo
    const sh = new THREE.Mesh(G(new THREE.RingGeometry(5.6, 9.2, 26), { j: [0.05, 0, 0.05], seed: 41 }).fl, toon('#55bdd0'))
    sh.rotation.x = -PI / 2; sh.position.set(0, -0.7, Z0); bien.add(sh)
    // bọt sóng ven đảo
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * PI * 2, rr = 6.1 + bam(i + 50) * 0.12
      part(bien, G(ICO(0.09, 0), { s: [1.6, 0.5, 1], p: [Math.cos(a) * rr * 1.02, -0.69, Z0 + Math.sin(a) * rr * 0.72], seed: 60 + i }), '#eafcff', { w: 0, cast: false, mat: basic('#eafcff') })
    }
  }
  // ánh sáng lấp lánh trên mặt biển xa
  const lap = []
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), basic('#eaffff'))
    m.position.set((bam(i * 3.7) - 0.5) * 22, -0.66, -8 - bam(i * 9.1) * 20)
    bien.add(m); lap.push({ m, ph: bam(i * 5.3) * PI * 2, s: 0.6 + bam(i * 2.5) })
  }
  // thuyền nhỏ trên biển, thấy rõ ở dải nước sau đảo
  const thuyens = []
  function thuyenBe(x, z, s, ph, mauBuom) {
    const g = grp(scene, x, -0.7, z); g.scale.setScalar(s)
    part(g, G(ICO(0.5, 1), { s: [1.7, 0.42, 0.55], p: [0, 0.05, 0], j: [0.02, 0.01, 0.02], seed: 420 }), '#5a3c2e', { w: 0.006, cast: false })
    part(g, G(BOX(1.5, 0.05, 0.42), { p: [0, 0.2, 0] }), '#8a5a3a', { w: 0, cast: false })
    part(g, G(CYL(0.02, 0.026, 1.1, 5), { p: [0.35, 0.75, 0] }), '#4a3226', { w: 0.004, cast: false })
    const sh = new THREE.Shape(); sh.moveTo(0.38, 1.25); sh.lineTo(-0.5, 0.42); sh.lineTo(0.38, 0.35); sh.closePath()
    part(g, G(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), { seed: 421 }), mauBuom, { w: 0.004, cast: false })
    part(g, G(BOX(0.14, 0.06, 0.01), { p: [0.43, 1.22, 0] }), '#d9543a', { w: 0, bas: true, cast: false })
    thuyens.push({ g, y0: -0.7, ph })
  }
  thuyenBe(2.4, -12.6, 0.8, 0.4, '#fff3dc')
  thuyenBe(-2.7, -14.8, 0.7, 1.7, '#f6e8cf')
  thuyenBe(0.6, -17.0, 0.6, 2.9, '#ffe8c8')

  // hai đảo xa làm mốc chân trời
  for (const [x, z, s, sd] of [[-12.5, -30, 3.4, 70], [14, -34, 3.0, 77]]) {
    const g = grp(scene, x, -0.7, z); g.scale.setScalar(s)
    part(g, G(CYL(1, 0.9, 0.22, 9), { j: [0.05, 0, 0.05], seed: sd }), P.dat[0], { w: 0.012, cast: false })
    part(g, G(new THREE.ConeGeometry(0.9, 1.5, 7), { r: [PI, 0, 0], p: [0, -0.85, 0], j: [0.09, 0.05, 0.09], seed: sd + 1 }), P.da[2], { w: 0.012, cast: false })
    part(g, G(new THREE.ConeGeometry(0.32, 0.9, 6), { p: [0.2, 0.55, 0] }), P.la[0], { w: 0.01, cast: false })
  }

  // ===================== LÀNG =====================
  const smoke = [], sway = []
  function nha(x, z, s, tuong, maiMau, seed, xoay = 0) {
    const g = grp(scene, x, 0, z); g.scale.setScalar(s); g.rotation.y = xoay
    part(g, G(BOX(1.0, 0.6, 0.8), { p: [0, 0.3, 0], j: [0.006, 0.006, 0.006], seed }), tuong, { w: 0.006 })
    part(g, G(new THREE.ConeGeometry(0.88, 0.62, 4), { s: [1.16, 1, 0.98], r: [0, PI / 4, 0], p: [0, 0.9, 0], j: [0.008, 0.008, 0.008], seed: seed + 1 }), maiMau, { w: 0.007 })
    part(g, G(BOX(0.2, 0.34, 0.05), { p: [0.16, 0.17, 0.41] }), '#6b4028', { w: 0.004 })
    part(g, G(BOX(0.17, 0.17, 0.05), { p: [-0.28, 0.34, 0.41] }), '#ffd66b', { w: 0, cast: false, bas: true })
    part(g, G(BOX(0.13, 0.34, 0.13), { p: [0.3, 1.02, -0.12] }), P.da[1], { w: 0.005 })
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(G(ICO(0.1, 0), { seed: seed + 40 + i }).fl, new THREE.MeshBasicMaterial({ color: CO('#f6efe2'), transparent: true, opacity: 0.75, depthWrite: false }))
      g.add(m); smoke.push({ m, x: 0.3, y: 1.2, z: -0.12, i, ph: seed * 0.13 })
    }
    return g
  }
  nha(-3.05, -3.55, 1.02, '#f3e4c0', mai[0], 100, 0.05)
  nha(-1.55, -4.35, 0.86, '#e8d5b0', mai[1], 110, -0.04)
  nha(0.25, -4.3, 1.1, '#f6efe0', mai[3], 120, 0.02)
  nha(1.85, -3.85, 0.9, '#f3e4c0', mai[2], 130, -0.05)
  nha(3.0, -4.5, 0.8, '#e8d5b0', mai[0], 140, 0.06)

  // tháp đá nhỏ có đèn (mốc bên trái)
  {
    const g = grp(scene, -3.55, 0, -4.9)
    part(g, G(CYL(0.24, 0.32, 1.5, 8), { p: [0, 0.75, 0], j: [0.01, 0.01, 0.01], seed: 150 }), '#e9e2d2', { w: 0.007 })
    part(g, G(new THREE.ConeGeometry(0.36, 0.5, 8), { p: [0, 1.72, 0] }), mai[0], { w: 0.007 })
    part(g, G(BOX(0.16, 0.18, 0.16), { p: [0, 1.4, 0] }), '#ffd66b', { w: 0, cast: false, bas: true })
    part(g, G(BOX(0.1, 0.26, 0.05), { p: [0, 0.28, 0.3] }), '#6b4028', { w: 0.004 })
  }
  // giếng đá + mái
  {
    const g = grp(scene, -2.35, 0, -3.15); g.scale.setScalar(0.75)
    part(g, G(CYL(0.3, 0.34, 0.3, 9), { p: [0, 0.15, 0], j: [0.01, 0, 0.01], seed: 160 }), P.da[1], { w: 0.006 })
    part(g, G(CYL(0.22, 0.22, 0.04, 9), { p: [0, 0.3, 0] }), '#2f6b7a', { w: 0, bas: true })
    for (const s of [-1, 1]) part(g, G(CYL(0.03, 0.03, 0.5, 5), { p: [s * 0.28, 0.5, 0] }), P.than, { w: 0.004 })
    part(g, G(new THREE.ConeGeometry(0.42, 0.26, 4), { r: [0, PI / 4, 0], p: [0, 0.82, 0] }), mai[2], { w: 0.005 })
  }
  // hàng rào gỗ
  {
    const g = grp(scene, 0, 0, 0)
    for (let i = 0; i < 9; i++) {
      const x = -3.35 + i * 0.22
      part(g, G(BOX(0.06, 0.3, 0.06), { p: [x, 0.15, -2.35] }), P.than, { w: 0.004, cast: false })
    }
    for (const y of [0.12, 0.24]) part(g, G(BOX(1.85, 0.045, 0.04), { p: [-2.47, y, -2.35] }), '#a87a4c', { w: 0.003, cast: false })
  }
  // đụn rơm, thùng gỗ
  for (const [x, z, s, sd] of [[3.4, -2.75, 0.9, 170], [-3.4, -1.95, 0.8, 171]]) {
    const g = grp(scene, x, 0, z); g.scale.setScalar(s)
    part(g, G(BOX(0.62, 0.42, 0.5), { p: [0, 0.21, 0], j: [0.02, 0.02, 0.02], seed: sd }), '#e3bd6a', { w: 0.006 })
    part(g, G(BOX(0.64, 0.06, 0.52), { p: [0, 0.14, 0] }), '#c9a04e', { w: 0 })
    part(g, G(BOX(0.64, 0.06, 0.52), { p: [0, 0.32, 0] }), '#c9a04e', { w: 0 })
  }
  for (const [x, z] of [[2.45, -2.95], [2.62, -2.8]]) {
    part(scene, G(CYL(0.11, 0.12, 0.26, 8), { p: [x, 0.13, z] }), '#8f5a34', { w: 0.004 })
    part(scene, G(CYL(0.115, 0.115, 0.02, 8), { p: [x, 0.28, z] }), '#6b4028', { w: 0 })
  }
  // lửa trại ấm bên đường
  const lua = []
  {
    const g = grp(scene, -2.45, 0, -1.75)
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2
      part(g, G(ICO(0.075, 0), { s: [1, 0.8, 1], p: [Math.cos(a) * 0.21, 0.05, Math.sin(a) * 0.21], j: [0.008, 0.008, 0.008], seed: 180 + i }), P.da[3], { w: 0.005, cast: false })
    }
    part(g, G(CYL(0.028, 0.028, 0.34, 5), { r: [0, 0, PI / 2 - 0.35], p: [0, 0.075, 0] }), '#6b3f22', { w: 0.004 })
    part(g, G(CYL(0.028, 0.028, 0.34, 5), { r: [0.35, 0, PI / 2], p: [0, 0.075, 0] }), '#7a4b2d', { w: 0.004 })
    ;[[0xff7a2a, 0.12, 0.36], [0xffb03a, 0.09, 0.27], [0xffe27a, 0.055, 0.19]].forEach(([c, rr, hh], i) => {
      const gg = grp(g, 0, 0.08, 0)
      const m = new THREE.Mesh(G(new THREE.ConeGeometry(rr, hh, 5), { p: [0, hh / 2, 0], j: [0.008, 0.012, 0.008], seed: 190 + i }).fl, basic(c))
      gg.add(m); lua.push(gg)
    })
  }
  const luaSang = new THREE.PointLight(CO('#ff9a40'), 0.9, 3.4, 2)
  luaSang.position.set(-2.45, 0.5, -1.55); scene.add(luaSang)

  // ===================== CÂY CỐI =====================
  function cay(x, z, s, mau, seed) {
    const g = grp(scene, x, 0, z); g.scale.setScalar(s)
    part(g, G(CYL(0.05, 0.075, 0.34, 6), { p: [0, 0.17, 0] }), '#7a4b2d', { w: 0.007 })
    const cols = [mau, toi(mau, 0.92), toi(mau, 0.82)]
    ;[[0.46, 0.62, 0.62], [0.36, 0.52, 0.95], [0.24, 0.44, 1.27]].forEach(([rr, hh, yy], i) =>
      part(g, G(new THREE.ConeGeometry(rr, hh, 7), { p: [0, yy, 0], j: [0.02, 0.02, 0.02], seed: seed + i }), cols[i], { w: 0.008 }))
    sway.push({ g, ph: seed * 0.37, s: 0.02 })
  }
  ;[[-3.25, -2.85, 0.9, P.la[0]], [-2.55, -3.5, 0.84, P.la[1]], [-1.15, -3.95, 0.78, P.la[2]],
    [0.5, -3.6, 0.93, P.la[0]], [2.95, -3.85, 0.88, P.la[1]], [3.42, -2.5, 0.78, P.la[2]],
    [3.5, -1.25, 0.66, P.la[3]], [-3.5, -1.35, 0.7, P.la[1]], [-0.15, -2.15, 0.54, P.la[3]],
    [-2.0, -2.35, 0.5, P.la[0]], [1.35, -2.9, 0.48, P.la[1]]]
    .forEach(([x, z, s, c], i) => cay(x, z, s, c, 200 + i * 7))
  // cây lá tròn
  for (const [x, z, s, sd] of [[-3.35, -2.15, 0.82, 240], [2.55, -2.2, 0.72, 241], [3.55, -3.15, 0.86, 242]]) {
    const g = grp(scene, x, 0, z); g.scale.setScalar(s)
    part(g, G(CYL(0.06, 0.08, 0.6, 6), { p: [0, 0.3, 0] }), '#7a4b2d', { w: 0.006 })
    part(g, G(ICO(0.42, 1), { s: [1.1, 0.9, 1], p: [0, 0.82, 0], j: [0.05, 0.04, 0.05], seed: sd }), P.la[0], { w: 0.008 })
    part(g, G(ICO(0.3, 1), { s: [1, 0.85, 1], p: [0.26, 1.02, 0.05], j: [0.04, 0.03, 0.04], seed: sd + 1 }), P.la[1], { w: 0.006 })
    sway.push({ g, ph: sd * 0.21, s: 0.015 })
  }
  // bụi, đá, hoa, cỏ
  for (const [x, z, s, sd] of [[-2.9, 1.5, 1.05, 250], [2.6, 1.65, 0.9, 251], [-2.75, 1.1, 0.5, 252], [4.6, 1.0, 1.1, 253], [-4.7, 0.6, 0.95, 254], [2.95, 1.3, 0.45, 255]]) {
    part(scene, G(ICO(0.3, 1), { s: [1.25, 0.8, 1], p: [x, 0.17 * s, z], j: [0.04, 0.03, 0.04], seed: sd }), P.la[2], { w: 0.01, cast: false })
  }
  // mảng cỏ đậm cho đỡ phẳng
  for (const [x, z, s, sd] of [[0.9, -1.1, 1.1, 270], [-2.4, 0.5, 0.9, 271], [2.1, 0.2, 0.8, 272], [-0.3, 1.7, 0.7, 273]]) {
    part(scene, G(CYL(1, 1, 0.02, 12), { s: [s, 1, s * 0.55], p: [x, 0.006, z], j: [0.12, 0, 0.06], seed: sd }), '#78b64a', { w: 0, cast: false })
  }
  for (const [x, z, s, sd] of [[-4.2, 0.5, 0.9, 260], [4.35, 0.35, 1.0, 261], [-0.65, 1.15, 0.45, 262], [3.9, -0.35, 0.8, 263], [-3.0, 0.85, 0.55, 264]]) {
    part(scene, G(ICO(0.3, 0), { s: [1, 0.72, 0.9], p: [x, 0.1 * s, z], j: [0.04, 0.03, 0.04], seed: sd }), P.da[0], { w: 0.01, cast: false })
  }
  for (let i = 0; i < 26; i++) {
    const x = -5.6 + bam(i * 3.1) * 11.2
    const z = bam(i * 7.7) < 0.6 ? 0.85 + bam(i + 4) * 1.6 : -1.2 - bam(i + 5) * 0.9
    part(scene, G(CYL(0.009, 0.011, 0.15, 4), { p: [x, 0.075, z] }), '#3a8a3a', { w: 0, cast: false })
    part(scene, G(ICO(0.045, 0), { p: [x, 0.16, z] }), hoa[i % hoa.length], { w: 0, cast: false, bas: true })
  }
  for (let i = 0; i < 22; i++) {
    const x = -5.2 + bam(i * 2.3) * 10.4, z = (bam(i * 4.9) - 0.5) * 3.2
    part(scene, G(new THREE.ConeGeometry(0.035, 0.16, 4), { p: [x, 0.08, z], r: [0, 0, (bam(i) - 0.5) * 0.5] }), P.la[1], { w: 0, cast: false })
  }

  // ===================== MÂY, CHIM, ĐOM ĐÓM =====================
  const may = []
  for (let i = 0; i < 5; i++) {
    const g = grp(scene, 0, 0, 0), n = 4
    for (let k = 0; k < n; k++) {
      part(g, G(ICO(0.6 + bam(i * 5 + k) * 0.4, 1), { s: [1.4, 0.72, 1], p: [(k - 1.5) * 0.9, (k % 2) * 0.18, bam(k + i) * 0.3], j: [0.04, 0.04, 0.04], seed: 300 + i * 4 + k }), '#ffffff', { w: 0, cast: false })
    }
    g.userData = { x0: -18 + bam(i * 9.1) * 36, y: 0.9 + bam(i * 3.7) * 1.3, z: -19 - bam(i * 2.3) * 10, s: 0.85 + bam(i * 1.9) * 0.75, v: 0.16 + bam(i + 8) * 0.1 }
    may.push(g)
  }
  const chim = []
  for (let i = 0; i < 3; i++) {
    const g = grp(scene, 0, 0, 0)
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(G(BOX(0.22, 0.018, 0.06), { p: [s * 0.11, 0, 0] }).fl, basic('#f8fbff'))
      w.castShadow = false; g.add(w); if (s < 0) g.userData.trai = w; else g.userData.phai = w
    }
    g.userData = { ...g.userData, x0: -10 + bam(i * 4.3) * 20, y: 2.4 + bam(i * 2.7) * 1.6, z: -14 - bam(i * 6.1) * 8, v: 0.35 + bam(i) * 0.25, ph: bam(i * 8.7) * PI * 2 }
    chim.push(g)
  }
  const dom = []
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), basic('#ffe9a0'))
    scene.add(m); dom.push({ m, x: -4 + bam(i * 1.7) * 8, y: 0.3 + bam(i * 2.9) * 1.4, z: -1.2 - bam(i * 4.1) * 3, ph: bam(i * 6.3) * PI * 2, s: 0.6 + bam(i * 5.1) })
  }
  // quầng nắng ấm ở chân trời trái
  {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 2, 64, 64, 64)
    gr.addColorStop(0, 'rgba(255,242,205,0.85)'); gr.addColorStop(0.4, 'rgba(255,226,170,0.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)')
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))
    sp.position.set(-15, 3.4, -34); sp.scale.setScalar(17); scene.add(sp)
  }

  // ===================== CÁNH BUỒM LẠ (thứ lạ bên phải) =====================
  // Cánh buồm ma nổi ngay sau mặt phẳng diễn, neo đúng dx.hienX(T) nên khung nào cũng đọc được.
  // Cột buồm ở chỗ dx.hienX, lá buồm vươn sang trái, con mắt đặt sát cột để không bị nhân vật che.
  const tau = new THREE.Group(); scene.add(tau)
  let matBuom, matMat, tiaSang, haiDen
  const vong = []
  {
    const g = tau
    part(g, G(CYL(0.02, 0.025, 0.85, 5), { p: [0.1, 1.2, 0] }), '#241d2e', { w: 0.004, cast: false })
    part(g, G(CYL(0.016, 0.016, 0.42, 4), { r: [0, 0, 0.45], p: [-0.06, 1.48, 0] }), '#3a2b2e', { w: 0.003, cast: false })
    // lá buồm rách, vươn sang trái
    const sh = new THREE.Shape()
    sh.moveTo(0.1, 1.58)
    sh.quadraticCurveTo(-0.08, 1.54, -0.22, 1.34)
    sh.quadraticCurveTo(-0.19, 1.12, -0.26, 0.98)
    sh.quadraticCurveTo(-0.14, 0.82, 0.1, 0.72)
    sh.closePath()
    const buomG = G(new THREE.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false, curveSegments: 8 }), { seed: 410 })
    matBuom = new THREE.MeshBasicMaterial({ color: CO('#2b2b52') })
    part(g, buomG, 0, { w: 0.006, cast: false, mat: matBuom })
    // con mắt ở sát cột buồm
    const matG = grp(g, 0.03, 1.3, 0.04)
    const rim = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), basic('#0e2430')); matG.add(rim)
    matMat = new THREE.Mesh(new THREE.CircleGeometry(0.092, 16), basic('#6ff0e6')); matMat.position.z = 0.01; matG.add(matMat)
    const conNguoi = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), basic('#122a2e'))
    conNguoi.scale.set(0.42, 1.1, 1); conNguoi.position.z = 0.016; matG.add(conNguoi)
    const loe = new THREE.Mesh(new THREE.CircleGeometry(0.015, 8), basic('#ffffff'))
    loe.position.set(0.018, 0.022, 0.02); matG.add(loe)
    const vienMat2 = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.007, 5, 18), basic('#9ffff4'))
    vienMat2.position.z = 0.012; matG.add(vienMat2)
    // tua rách dưới chân buồm
    for (const [x, y, r] of [[-0.02, 0.68, 0.2], [0.05, 0.72, 0.5], [-0.1, 0.76, -0.15]]) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.1, 4), basic('#2b2b58'))
      m.position.set(x, y, 0.01); m.rotation.z = r; g.add(m)
    }
    haiDen = new THREE.PointLight(CO('#7ff0e0'), 0, 3, 2); haiDen.position.set(0.03, 1.3, 0.2); g.add(haiDen)
    // cột sáng từ con mắt
    tiaSang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.2, 2.1, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: CO('#8ffcf0'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }))
    tiaSang.position.set(0.03, 2.25, 0); g.add(tiaSang)
    // vòng sóng sáng trên mặt đất khi hiện ra
    for (let i = 0; i < 2; i++) {
      const v = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 4, 26),
        new THREE.MeshBasicMaterial({ color: CO('#a8fff4'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
      v.rotation.x = PI / 2; v.position.set(0.02, -0.5, 0); g.add(v); vong.push(v)
    }
    // sương ma dưới chân buồm
    for (const [x, z, s] of [[-0.1, 0.05, 0.15], [0.14, -0.02, 0.11], [0, 0.09, 0.09]]) {
      const m = new THREE.Mesh(G(ICO(s, 1), { j: [0.01, 0.01, 0.01], seed: 430 + s * 100 }).fl,
        new THREE.MeshBasicMaterial({ color: CO('#4f9aa8'), transparent: true, opacity: 0.3, depthWrite: false }))
      m.position.set(x, 0.1, z); g.add(m)
    }
  }
  tau.visible = false

  // ===================== NHÂN VẬT =====================
  // Dựng theo khớp 2D của dx.khung2D; khớp bọc cầu, cổ tay/cổ chân có mesh liền nên không hở khe.
  function taoNguoi(nv, dang) {
    const g = new THREE.Group(); scene.add(g)
    const quai = dang === 'quai'
    const HR = quai ? 0.16 : 0.135
    const C = {
      than: nv.than, mat: nv.mat, ao: nv.ao, quan: nv.quan, phu: nv.phu,
      toc: '#' + CO(nv.mat).lerp(CO('#5b3a26'), 0.62).getHexString(),
      giay: '#5a3a28',
      hong: '#' + CO(nv.than).lerp(CO('#ef8a72'), 0.5).getHexString(),
      mieng: '#4a1720', luoi: '#ff7a8a',
    }
    // kho hình học dùng lại (đơn vị cao 1 cho xương)
    const cache = new Map()
    const tru = (rad, seg = 7, rt = rad) => {
      const key = 't' + rad + '_' + rt + '_' + seg
      if (!cache.has(key)) cache.set(key, G(CYL(rt, rad, 1, seg)))
      return cache.get(key)
    }
    const cau = (rad, sd = 0) => {
      const key = 's' + rad + '_' + sd
      if (!cache.has(key)) cache.set(key, G(ICO(rad, 1), { j: [rad * 0.06, rad * 0.06, rad * 0.06], seed: sd }))
      return cache.get(key)
    }
    const dat = (m, a, b, z, sx = 1, sz = 1) => {
      const ax = b[0] - a[0], ay = b[1] - a[1], L = Math.hypot(ax, ay) || 1e-4
      m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z)
      m.scale.set(sx, L, sz)
      m.rotation.set(0, 0, Math.atan2(ay, ax) - PI / 2)
    }
    // thân
    const than = part(g, tru(0.075, 7, 0.092), C.ao, { w: 0.006 })
    const hong = part(g, cau(0.082, 1), C.quan, { w: 0.005 })
    const vaiAo = part(g, cau(0.078, 2), C.ao, { w: 0.005 })
    const co = part(g, tru(0.03, 6, 0.034), C.than, { w: 0.003 })
    // tay
    const tay = []
    for (let i = 0; i < 2; i++) tay.push({ tren: part(g, tru(0.033, 6), C.ao, { w: 0.004 }), duoi: part(g, tru(0.029, 6), C.than, { w: 0.004 }), khuyu: part(g, cau(0.036, 3 + i), C.than, { w: 0.003 }), vai: part(g, cau(0.052, 5 + i), C.ao, { w: 0.004 }), ban: part(g, cau(0.04, 7 + i), C.than, { w: 0.003 }) })
    // chân
    const chan = []
    for (let i = 0; i < 2; i++) chan.push({ dui: part(g, tru(0.043, 6), C.quan, { w: 0.004 }), cang: part(g, tru(0.037, 6), C.than, { w: 0.004 }), goi: part(g, cau(0.045, 9 + i), C.quan, { w: 0.003 }), hong: part(g, cau(0.05, 11 + i), C.quan, { w: 0.003 }) })
    const giay = []
    for (let i = 0; i < 2; i++) {
      const gm = new THREE.Group(); g.add(gm)
      const thanGiay = part(gm, G(BOX(0.075, 0.048, 0.135), { p: [0, 0, 0.034] }), C.giay, { w: 0.004 })
      const de = part(gm, G(BOX(0.079, 0.015, 0.14), { p: [0, -0.019, 0.036] }), '#3a2418', { w: 0.002 })
      thanGiay.castShadow = de.castShadow = true
      giay.push(gm)
    }
    // đầu, mặt
    const dauCau = part(g, G(new THREE.SphereGeometry(HR, 11, 8), { j: [0.006, 0.006, 0.006], seed: 500 + (quai ? 1 : 0) }), C.than, { w: 0.006 })
    const mat = new THREE.Group(); mat.rotation.order = 'YXZ'; g.add(mat)
    const faceAt = (az, el, rr) => { const hd = new THREE.Group(); hd.rotation.order = 'YXZ'; hd.rotation.y = az; hd.rotation.x = -el; mat.add(hd); const z = new THREE.Group(); z.position.z = rr; hd.add(z); return { hd, z } }
    // tai: giấu hẳn sau tóc (tóc đã che kín hai bên đầu)
    // mũi, má hồng
    {
      const n = faceAt(0, -0.05, HR * 0.99)
      part(n.z, G(ICO(0.022, 0), { s: [1, 0.9, 0.9] }), toi(C.than, 0.9), { w: 0.002, cast: false, bas: true })
    }
    const mauHong = new THREE.MeshBasicMaterial({ color: CO(C.hong), transparent: true, opacity: 0.55, depthWrite: false })
    const hongMat = []
    for (const s of [-1, 1]) {
      const c = faceAt(s * 0.72, -0.14, HR * 1.0)
      const m = new THREE.Mesh(cau(0.034, 15).fl, mauHong)
      m.scale.set(1.25, 0.7, 0.32); c.z.add(m); hongMat.push(m)
    }
    // mắt: lòng trắng dẹt, viền mỏng, con ngươi to; đặt vừa đủ nông để không lồi như mắt ốc
    const eyeGeo = ICO(1, 1)
    const eyes = []
    const soMat = quai ? 1 : 2
    for (let i = 0; i < soMat; i++) {
      const s = soMat === 1 ? 0 : (i ? 1 : -1)
      const az = soMat === 1 ? 0 : s * 0.34, el = soMat === 1 ? 0.06 : 0.12
      const { z } = faceAt(az, el, HR * 0.9)
      const gg = new THREE.Group(); z.add(gg)
      const to = quai ? 1.7 : 1
      const rim = new THREE.Mesh(eyeGeo, basic(C.mat)); rim.scale.set(0.038 * to, 0.046 * to, 0.006); gg.add(rim)
      const white = new THREE.Mesh(eyeGeo, basic('#fffaf0')); white.scale.set(0.034 * to, 0.042 * to, 0.014); white.position.z = 0.006; gg.add(white)
      const pup = new THREE.Group(); pup.position.z = 0.018; gg.add(pup)
      const p = new THREE.Mesh(eyeGeo, basic(C.mat)); p.scale.set(0.021 * to, 0.028 * to, 0.007); pup.add(p)
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.005), basic('#ffffff')); hl.position.set(0.007 * to, 0.011 * to, 0.007); pup.add(hl)
      eyes.push({ gg, pup, s })
    }
    // lông mày
    const brows = []
    for (const s of [-1, 1]) {
      const { hd, z } = faceAt(s * 0.37, 0.55, HR * 1.0)
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.017, 0.016), basic(C.toc))
      z.add(m); brows.push({ hd, m, s })
    }
    // miệng: vài kiểu khối đùn, đủ đọc sợ, vui, đang nói, buồn
    const mBase = faceAt(0, -0.42, HR * 0.93)
    const mouth = new THREE.Group(); mBase.z.add(mouth)
    mouth.scale.set(1.14 * HR / 0.135, 1.14 * HR / 0.135, 1)
    const ext = (shape, d = 0.02) => new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 8 })
    const band = (w, curve, th, n = 8) => {
      const top = [], bot = []
      for (let i = 0; i <= n; i++) { const x = -w + 2 * w * i / n, u = x / w, y = curve * (u * u - 1), t = th * (1 - u * u) + 0.003; top.push([x, y]); bot.push([x, y - t]) }
      const sh = new THREE.Shape(); sh.moveTo(...top[0]); top.forEach(q => sh.lineTo(...q)); bot.reverse().forEach(q => sh.lineTo(...q)); return sh
    }
    const ell = (rx, ry) => { const sh = new THREE.Shape(); sh.absellipse(0, 0, rx, ry, 0, PI * 2, false, 0); return sh }
    const MOUTH = {}
    const themMieng = (key, build) => { const gg = new THREE.Group(); gg.visible = false; mouth.add(gg); build(gg); MOUTH[key] = gg }
    const hopDen = (sh, col, z = 0, d = 0.018) => { const m = new THREE.Mesh(G(ext(sh, d), { seed: 520 }).fl, basic(col)); m.position.z = z; return m }
    themMieng('dong', gg => gg.add(hopDen(band(0.038, 0.014, 0.011), C.mieng)))
    themMieng('noi', gg => { const m = hopDen(ell(0.032, 0.038), C.mieng); gg.add(m); const t = hopDen(ell(0.02, 0.012), C.luoi, 0.006); t.position.y = -0.018; gg.add(t) })
    themMieng('o', gg => gg.add(hopDen(ell(0.024, 0.028), C.mieng)))
    themMieng('het', gg => { gg.add(hopDen(ell(0.048, 0.056), '#5a1020')); const t = hopDen(ell(0.03, 0.018), C.luoi, 0.006); t.position.y = -0.028; gg.add(t) })
    themMieng('run', gg => {
      const sh = new THREE.Shape(); const n = 7, w = 0.05
      sh.moveTo(-w, 0)
      for (let i = 1; i <= n; i++) sh.lineTo(-w + 2 * w * i / n, (i % 2 ? 0.012 : -0.008))
      for (let i = n; i >= 0; i--) sh.lineTo(-w + 2 * w * i / n, (i % 2 ? 0.012 : -0.008) - 0.011)
      gg.add(hopDen(sh, C.mieng))
    })
    themMieng('cuoi-guong', gg => {
      gg.add(hopDen(ell(0.05, 0.024), C.mieng))
      const sh = new THREE.Shape(); sh.moveTo(-0.038, 0.001); sh.lineTo(0.038, 0.001); sh.lineTo(0.034, 0.018); sh.lineTo(-0.034, 0.018)
      gg.add(hopDen(sh, '#fffaf0', 0.005, 0.016))
    })
    themMieng('cuoi', gg => {
      const sh = band(0.05, 0.026, 0.024); gg.add(hopDen(sh, C.mieng))
      const t = hopDen(ell(0.026, 0.012), C.luoi, 0.006); t.position.y = -0.02; gg.add(t)
    })
    themMieng('buon', gg => gg.add(hopDen(band(0.038, -0.02, 0.012), C.mieng)))
    themMieng('gam', gg => {
      const m = new THREE.Mesh(G(BOX(0.075, 0.02, 0.016), { seed: 521 }).fl, basic('#401018'))
      gg.add(m)
      for (let i = -1; i <= 1; i++) {
        const t = new THREE.Mesh(G(BOX(0.009, 0.018, 0.018), { p: [i * 0.023, 0, 0.004] }).fl, basic('#fffaf0'))
        gg.add(t)
      }
    })
    // tóc hoặc mũ
    const toc = new THREE.Group(); mat.add(toc)
    const mu = nv.mu || 'khong'
    if (mu === 'khong' || mu === 'tai') {
      // tóc: mảng đỉnh + mảng sau che gáy, chừa khuôn mặt phía trước
      const dinh = G(new THREE.SphereGeometry(HR * 1.06, 12, 6, 0, PI * 2, 0, PI * 0.3), { j: [0.004, 0.004, 0.004], seed: 530 })
      const sau = G(new THREE.SphereGeometry(HR * 1.05, 12, 8, PI * 0.78, PI * 1.44, PI * 0.16, PI * 0.5), { j: [0.004, 0.004, 0.004], seed: 531 })
      part(toc, dinh, C.toc, { w: 0.004, cast: false })
      part(toc, sau, C.toc, { w: 0.004, cast: false })
    }
    if (mu === 'tai') {
      for (const s of [-1, 1]) part(toc, G(new THREE.ConeGeometry(0.04, 0.14, 5), { p: [s * 0.09, HR * 0.95, -0.02], r: [0, 0, -s * 0.25] }), C.phu, { w: 0.003, cast: false })
    }
    if (mu === 'non') {
      part(toc, G(new THREE.SphereGeometry(HR * 1.03, 10, 6, 0, PI * 2, 0, PI * 0.55), { p: [0, 0.02, 0], j: [0.003, 0.003, 0.003], seed: 531 }), C.phu, { w: 0.004, cast: false })
      part(toc, G(BOX(HR * 2.1, 0.022, 0.14), { p: [0, 0.055, HR * 0.9] }), C.phu, { w: 0.003, cast: false })
    }
    if (mu === 'vanh') {
      part(toc, G(CYL(HR * 1.5, HR * 1.5, 0.02, 14), { p: [0, HR * 0.72, 0] }), C.phu, { w: 0.004, cast: false })
      part(toc, G(new THREE.SphereGeometry(HR * 1.02, 10, 6, 0, PI * 2, 0, PI * 0.52), { p: [0, HR * 0.7, 0] }), C.phu, { w: 0.004, cast: false })
    }
    if (mu === 'non-la') {
      part(toc, G(new THREE.ConeGeometry(HR * 2.1, HR * 1.15, 12), { p: [0, HR * 1.0, 0] }), C.phu, { w: 0.004, cast: false })
    }
    if (mu === 'trum') {
      part(toc, G(new THREE.SphereGeometry(HR * 1.14, 10, 7, 0, PI * 2, 0, PI * 0.72), { r: [-0.25, 0, 0], p: [0, 0.005, -0.015], j: [0.005, 0.005, 0.005], seed: 532 }), C.ao, { w: 0.005, cast: false })
    }
    if (mu === 'khan-dau') {
      part(toc, G(new THREE.TorusGeometry(HR * 0.98, 0.03, 5, 12), { r: [PI / 2, 0, 0], p: [0, HR * 0.55, 0], s: [1, 1, 0.6] }), C.phu, { w: 0.003, cast: false })
    }
    if (mu === 'ang-ten') {
      part(toc, G(CYL(0.012, 0.012, 0.3, 5), { p: [0, HR * 1.25, 0] }), C.phu, { w: 0.002, cast: false })
      part(toc, G(ICO(0.04, 0), { p: [0, HR * 1.25 + 0.16, 0] }), C.phu, { w: 0.003, cast: false })
    }
    if (quai) { // quái: hai sừng nhỏ, mắt to một bên đã dựng ở trên
      for (const s of [-1, 1]) {
        part(toc, G(new THREE.ConeGeometry(0.03, 0.13, 5), { p: [s * HR * 0.55, HR * 0.8, -0.02], r: [0, 0, -s * 0.35] }), C.phu, { w: 0.003, cast: false })
      }
    }
    // khăn quàng / ba lô
    const coAo = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 4, 10), toon(C.phu)); coAo.rotation.x = PI / 2; g.add(coAo)
    const nutAo = new THREE.Group(); g.add(nutAo)
    for (let i = 0; i < 2; i++) {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), basic(C.phu))
      n.position.set(0, 0.06 - i * 0.055, 0.079); nutAo.add(n)
    }
    let khan = null, balo = null
    if (nv.deo === 'khan') {
      khan = new THREE.Group(); g.add(khan)
      part(khan, G(new THREE.TorusGeometry(0.062, 0.022, 5, 11), { r: [PI / 2, 0, 0] }), C.phu, { w: 0.003 })
      part(khan, G(BOX(0.07, 0.16, 0.02), { p: [0.03, -0.1, 0.04], r: [0.1, 0, 0.12] }), C.phu, { w: 0.003, cast: false })
    }
    if (nv.deo === 'balo') {
      balo = new THREE.Group(); g.add(balo)
      part(balo, G(BOX(0.15, 0.18, 0.09), { p: [0, 0, 0], j: [0.004, 0.004, 0.004], seed: 540 }), C.phu, { w: 0.004 })
      part(balo, G(CYL(0.04, 0.04, 0.15, 6), { r: [0, 0, PI / 2], p: [0, 0.1, 0] }), '#6b4a3a', { w: 0.003, cast: false })
    }
    const giot = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), basic('#8fdcff'))
    mat.add(giot); giot.visible = false
    const le = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), basic('#a8e6ff'))
    mat.add(le); le.visible = false

    const MAT_EYE = {
      thuong: { w: 1, h: 1, px: 0, py: 0, pup: 1 }, lieng: { w: 1, h: 1, px: 0.45, py: 0, pup: 1 },
      'mo-to': { w: 1.1, h: 1.16, px: 0, py: 0, pup: 0.85 }, so: { w: 1.16, h: 1.25, px: 0, py: 0.06, pup: 0.6 },
      vui: { w: 1.08, h: 0.6, px: 0, py: 0, pup: 1 }, ngai: { w: 1, h: 0.5, px: 0.55, py: -0.06, pup: 1 },
      buon: { w: 0.98, h: 0.72, px: 0, py: -0.22, pup: 1.1 }, nham: { w: 1, h: 0.1, px: 0, py: 0, pup: 0.02 },
      gian: { w: 1.05, h: 0.55, px: 0, py: 0, pup: 1 },
    }
    const MAT_MAY = {
      thuong: { a: 0, up: 0 }, lieng: { a: 0.05, up: 0.02 }, 'mo-to': { a: 0.1, up: 0.07 }, so: { a: 0.2, up: 0.11 },
      vui: { a: 0.06, up: 0.06 }, ngai: { a: -0.04, up: 0 }, buon: { a: 0.16, up: 0.02 }, nham: { a: 0.03, up: 0 },
      gian: { a: -0.22, up: -0.03 },
    }

    return {
      g,
      capNhat(p, T) {
        const k = dx.khung2D(p)
        const s = k.chinhDien, sx = 0.62 + 0.38 * s
        const zp = 0.046, zt = -0.052
        // thân, cổ, đầu
        dat(than, k.hong, k.coGoc, 0, sx, 0.86)
        hong.position.set(k.hong[0], k.hong[1], 0); hong.scale.set(1.35 * sx, 0.92, 1.1)
        vaiAo.position.set(k.coGoc[0], k.coGoc[1], 0); vaiAo.scale.set(1.15 * sx, 0.62, 0.95)
        const gd = k.gocDau, dir = [Math.sin(gd), Math.cos(gd)]
        dat(co, k.coGoc, [k.coGoc[0] + dir[0] * 0.08, k.coGoc[1] + dir[1] * 0.08], 0)
        dauCau.position.set(k.dau[0], k.dau[1], 0)
        mat.position.set(k.dau[0], k.dau[1], 0)
        mat.rotation.y = PI / 2 - p.yaw - 0.5 * Math.cos(p.yaw) // nghiêng đầu về phía máy khi đi ngang cho đọc mặt
        mat.rotation.x = p.mat === 'buon' ? 0.16 : p.mat === 'so' ? -0.08 : p.mat === 'vui' ? -0.05 : 0.02
        // tay: bên gần máy z dương, bên xa z âm; cầu ở vai/khuỷu/bàn tay bọc khe
        const tayPts = [[k.vaiP, k.khuyuP, k.banP], [k.vaiT, k.khuyuT, k.banT]]
        for (let i = 0; i < 2; i++) {
          const [a, b, c] = tayPts[i], z = i ? zt : zp, A = tay[i]
          dat(A.tren, a, b, z); dat(A.duoi, b, c, z)
          A.vai.position.set(a[0], a[1], z); A.khuyu.position.set(b[0], b[1], z); A.ban.position.set(c[0], c[1], z)
        }
        // chân
        const chanPts = [[k.hongP, k.goiP, k.coChanP], [k.hongT, k.goiT, k.coChanT]]
        for (let i = 0; i < 2; i++) {
          const [a, b, c] = chanPts[i], z = i ? zt : zp, L = chan[i]
          dat(L.dui, a, b, z); dat(L.cang, b, c, z)
          L.hong.position.set(a[0], a[1], z); L.goi.position.set(b[0], b[1], z)
          const gm = giay[i]
          gm.position.set(c[0], c[1] - 0.005, z)
          gm.rotation.y = PI / 2 - p.yaw
        }
        // khăn, ba lô bám theo thân và hướng mặt
        const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw)
        const midT = [(k.hong[0] + k.coGoc[0]) / 2, (k.hong[1] + k.coGoc[1]) / 2]
        if (khan) {
          khan.position.set(k.coGoc[0] + dir[0] * 0.03, k.coGoc[1] + dir[1] * 0.03, 0)
          khan.rotation.y = PI / 2 - p.yaw
          const duoi = khan.children[1]
          if (duoi) duoi.rotation.x = 0.1 + 0.2 * Math.sin(T * 2.1 + 1)
        }
        if (balo) {
          balo.position.set(midT[0] - fx * 0.085, midT[1] + 0.01, -fz * 0.085)
          balo.rotation.y = PI / 2 - p.yaw
        }
        coAo.position.set(k.coGoc[0], k.coGoc[1] - 0.008, 0)
        nutAo.position.set(midT[0], midT[1] + 0.02, 0)
        nutAo.rotation.y = PI / 2 - p.yaw
        // mặt: mắt, lông mày, miệng, má, giọt
        let loai = p.chop ? 'nham' : (p.mat || 'thuong')
        if (!MAT_EYE[loai]) loai = 'thuong'
        const E = MAT_EYE[loai]
        for (const e of eyes) {
          e.gg.scale.set(E.w, E.h, 1)
          e.pup.scale.set(E.pup, E.pup, 1)
          e.pup.position.set(E.px * 0.018, E.py * 0.02, 0.03)
        }
        const B0 = MAT_MAY[loai] || MAT_MAY.thuong
        let aa = B0.a, up = B0.up
        if (p.longMay === 'lo' || p.longMay === 'nhuong') { aa += 0.13; up += 0.05 }
        else if (p.longMay === 'nghi') up += 0.06
        else if (p.longMay === 'buon') aa += 0.06
        else if (p.longMay === 'vui') up += 0.04
        else if (p.longMay === 'gian') aa -= 0.08
        for (const b of brows) {
          b.hd.rotation.x = -(0.55 + up)
          b.m.rotation.z = -b.s * aa
        }
        let mk = p.mieng || 'dong'
        if (!MOUTH[mk]) mk = 'dong'
        for (const key in MOUTH) MOUTH[key].visible = key === mk
        if (mk === 'noi') { const g = MOUTH.noi; g.scale.y = 0.35 + 1.25 * kep(p.mieng_mo ?? 0, 0, 1) }
        const vaiTro = (p.mat === 'vui' || p.mat === 'ngai') ? 0.8 : 0.42
        mauHong.opacity = vaiTro
        hongMat.forEach(m => m.scale.set(1.25, 0.7, 0.32))
        // giọt mồ hôi khi sợ/ngượng, lệ khi buồn
        giot.visible = p.mat === 'so' || p.mat === 'ngai'
        if (giot.visible) { giot.position.set(HR * 0.86, HR * 0.28 - 0.05 * ((T * 1.6) % 1), HR * 0.55) }
        le.visible = p.mat === 'buon'
        if (le.visible) { le.position.set(-HR * 0.46, -HR * 0.34 - 0.03 * ((T * 1.2) % 1), HR * 0.95) }
        return k
      },
    }
  }

  const nv = taoNguoi(kb.nhan_vat, kb.nhan_vat?.dang || 'nguoi')
  const nvPhu = kb.nhan_vat_phu ? taoNguoi(kb.nhan_vat_phu, kb.nhan_vat_phu.dang || 'nguoi') : null
  if (nvPhu) nvPhu.g.visible = false

  // ===================== HẬU KỲ: tilt-shift + chỉnh màu + hạt =====================
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
  const mkTilt = dir => new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, dir: { value: new THREE.Vector2(dir[0], dir[1]) },
      focus: { value: 0.46 }, band: { value: 0.3 }, mx: { value: 0 },
    },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 dir; uniform float focus, band, mx; varying vec2 vUv;
      void main(){
        float d = max(0.0, abs(vUv.y - focus) - band);
        float wTop = vUv.y > focus ? 0.5 : 1.0;
        float bl = smoothstep(0.0, 0.4, d) * mx * wTop;
        vec4 c = vec4(0.0); float ws = 0.0;
        for (int i = -6; i <= 6; i++) { float f = float(i); float w = exp(-f*f/18.0); c += texture2D(tDiffuse, vUv + dir * f * bl / 3.0) * w; ws += w; }
        gl_FragColor = c / ws;
      }`,
  })
  const tiltX = mkTilt([1 / W, 0]), tiltY = mkTilt([0, 1 / H])
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uSang: { value: 0 }, uHat: { value: 0 }, uT: { value: 0 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSang, uHat, uT; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        c.rgb = mix(vec3(l), c.rgb, 1.06);
        c.rgb *= vec3(1.035, 1.0, 0.95);
        c.rgb *= 1.0 + 0.10 * uSang;
        c.rgb += vec3(0.07, 0.043, 0.0) * uSang;
        vec2 q = vUv - 0.5;
        c.rgb *= 1.0 - 0.33 * dot(q, q) * 1.7;
        float day = smoothstep(0.14, 0.0, vUv.y);
        c.rgb *= 1.0 - 0.20 * day * day;
        float g = fract(sin(dot(vUv * vec2(947.0, 613.0) + uT * 47.0, vec2(12.9898, 78.233))) * 43758.5453);
        c.rgb += (g - 0.5) * uHat;
        gl_FragColor = vec4(c.rgb, 1.0);
      }`,
  })
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: M >= 900 ? 4 : 2 })
  const composer = new EffectComposer(r, rt)
  composer.setPixelRatio(1); composer.setSize(W, H)
  composer.addPass(new RenderPass(scene, cam))
  composer.addPass(tiltX); composer.addPass(tiltY); composer.addPass(grade); composer.addPass(new OutputPass())

  // ===================== VẼ =====================
  function ve(T) {
    const p = dx.tuThe(T)
    const m = dx.may(T)
    const sk = dx.suKien(T)
    dx.datMay3D(cam, m, { ngua: 0.16 })
    // rung khung (sự kiện rung hoặc giật mình) — nhỏ, có seed theo T
    if (sk.rung > 0.001) {
      cam.position.x += sk.rung * 0.008 * Math.sin(T * 87 + 1.3)
      cam.position.y += sk.rung * 0.006 * Math.sin(T * 103 + 2.1)
    }
    const k = nv.capNhat(p, T)
    const pp = dx.tuThe(T, 'phu')
    if (nvPhu) { nvPhu.g.visible = !!pp; if (pp) nvPhu.capNhat(pp, T) }

    // cánh buồm lạ: bám đúng dx.hienX(T), nổi ngay sau mặt phẳng diễn phía phải
    const hien = sk.hien
    tau.visible = hien > 0.008
    if (tau.visible) {
      const k2 = muot(kep(hien, 0, 1))
      tau.position.set(dx.hienX(T), 0.32, -0.8)
      tau.scale.setScalar(0.55 + 0.15 * k2)
      tau.rotation.z = 0.025 * Math.sin(T * 0.85 + 1)
      const nhip = Math.exp(-Math.max(0, T - (sk.hienTu ?? T)) / 0.5)
      matBuom.color.copy(CO('#2b2b52')).multiplyScalar(0.82 + 0.22 * k2 + 0.18 * nhip + 0.04 * Math.sin(T * 4.2))
      matMat.material.color.copy(CO('#6ff0e6')).multiplyScalar(0.7 + 0.5 * k2 + 0.25 * Math.sin(T * 5.1))
      haiDen.intensity = (1.0 + 1.8 * k2 + 1.6 * nhip) * 1.2
      tiaSang.material.opacity = 0.03 + 0.1 * k2 + 0.16 * nhip
      tiaSang.scale.x = tiaSang.scale.z = 0.8 + 0.4 * k2
      vong.forEach((v, i) => {
        const q = (T - (sk.hienTu ?? T) - i * 0.45) / 1.3
        const ok = q >= 0 && q <= 1
        v.visible = ok
        if (ok) { v.scale.setScalar(0.16 + 0.75 * (1 - (1 - q) ** 2)); v.material.opacity = 0.7 * (1 - q) }
      })
    }
    // cảnh sống
    for (const s of sway) { s.g.rotation.z = s.s * Math.sin(T * 1.15 + s.ph); s.g.rotation.x = s.s * 0.7 * Math.sin(T * 0.9 + s.ph * 2) }
    for (const c of may) {
      const u = c.userData
      c.position.set(((u.x0 + u.v * T + 40) % 80) - 40, u.y + 0.06 * Math.sin(T * 0.5 + u.x0), u.z)
      c.scale.setScalar(u.s)
    }
    for (const c of chim) {
      const u = c.userData
      c.position.set(((u.x0 + u.v * T + 30) % 60) - 30, u.y + 0.1 * Math.sin(T * 0.7 + u.ph), u.z)
      c.rotation.y = u.v > 0 ? 0 : PI
      if (u.trai) u.trai.rotation.z = 0.3 + 0.45 * Math.sin(T * 5 + u.ph)
      if (u.phai) u.phai.rotation.z = -0.3 - 0.45 * Math.sin(T * 5 + u.ph)
    }
    for (const d of dom) {
      d.m.position.set(d.x + 0.25 * Math.sin(T * 0.7 + d.ph), d.y + 0.15 * Math.sin(T * 0.9 + d.ph * 1.7), d.z + 0.15 * Math.cos(T * 0.6 + d.ph))
      d.m.scale.setScalar(d.s * (0.7 + 0.35 * Math.sin(T * 2.1 + d.ph)))
    }
    for (const q of lap) q.m.scale.setScalar(q.s * (0.5 + 0.6 * Math.abs(Math.sin(T * 1.7 + q.ph))))
    for (const b of thuyens) {
      b.g.position.y = b.y0 + 0.035 * Math.sin(T * 0.85 + b.ph)
      b.g.rotation.z = 0.035 * Math.sin(T * 0.65 + b.ph)
      b.g.rotation.x = 0.02 * Math.sin(T * 0.9 + b.ph * 1.6)
    }
    for (const s of smoke) {
      const q = (T * 0.22 + s.i / 3 + s.ph) % 1
      s.m.position.set(s.x + 0.18 * q + 0.04 * Math.sin(T * 1.7 + s.i), s.y + q * 1.05, s.z)
      s.m.scale.setScalar(0.45 + q * 1.25)
      s.m.material.opacity = 0.5 * (1 - q) * (1 - q)
    }
    const ngon = 1 + 0.25 * Math.sin(T * 13) + 0.14 * Math.sin(T * 21 + 1)
    lua.forEach((g, i) => { g.scale.set(1, ngon * (1 - i * 0.05) + 0.08 * Math.sin(T * 17 + i * 2), 1); g.rotation.y = T * 2 + i })
    luaSang.intensity = 0.8 + 0.25 * Math.sin(T * 13) + 0.1 * Math.sin(T * 21)
    // sáng dần khi kết vui
    const sang = sk.sang || 0
    sun.intensity = 2.5 + 0.55 * sang
    hemi.intensity = 1.35 + 0.2 * sang
    denMat.intensity = 0.5 + 0.1 * sang
    // tiêu điểm tilt-shift đặt đúng nhân vật: giữa mặt và ngực, kẹp trong khung
    const pt = [(k.dau[0] + k.coGoc[0]) / 2, (k.dau[1] + k.coGoc[1]) / 2]
    const man = dx.raMan(pt, m)
    const focus = kep(1 - man[1] / H, 0.34, 0.62)
    tiltX.uniforms.focus.value = tiltY.uniforms.focus.value = focus
    // bản dọc hẹp hơn: dải nét hẹp lại để vẫn giữ cảm giác mô hình mà không mờ mặt
    const band = ngang ? 0.22 : 0.2
    tiltX.uniforms.band.value = tiltY.uniforms.band.value = band
    const mx = (ngang ? 13 : 10) * M / 1080
    tiltX.uniforms.mx.value = tiltY.uniforms.mx.value = mx
    grade.uniforms.uSang.value = sang
    grade.uniforms.uHat.value = 0.012 * M / 1080
    grade.uniforms.uT.value = T
    composer.render()
  }
  return { ve }
}
