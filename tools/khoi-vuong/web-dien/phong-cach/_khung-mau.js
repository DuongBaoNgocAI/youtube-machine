// Khung mẫu cho một phong cách diễn xuất. Chép file này thành <mã phong cách>.js rồi thay phần vẽ.
// Hợp đồng: export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) → { ve(T) }
//   canvas: canvas WebGL2 cỡ W×H (ngang hoặc dọc). Vẽ xong mỗi khung, chay.js chép sang canvas 2D rồi in chữ.
//   pc, bc: phong cách và bối cảnh trong phong-cach.json. kb: file cảnh. dx: bộ diễn xuất (dien.js):
//     dx.tuThe(T, 'chinh'|'phu') → tư thế (null nếu nhân vật phụ vắng); dx.khung2D(p) → tọa độ khớp thế giới
//     dx.may(T) → { tam:[x,y], cao, kieu, tren }; dx.datMay3D(camera, m) đặt máy phối cảnh khớp khung
//     dx.raMan([x,y], m) → điểm ảnh; dx.suKien(T) → { hien, hienTu, sang, rung }; dx.hienX(T) → chỗ thứ lạ hiện ra
//   Đơn vị: 1 = chiều cao nhân vật, mặt đất y = 0, sân khấu x từ -3.2 tới 3.2, z = 0 là mặt phẳng diễn.
// Luật: hàm thuần theo T (không Math.random, không Date, không mạng). Ngẫu nhiên dùng bam(seed).
// Không tải gì từ mạng; texture tự vẽ bằng canvas hoặc shader.
export const bam = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

export async function taoCanh({ THREE, canvas, W, H, pc, bc, kb, dx }) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
  r.setSize(W, H, false)
  r.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(bc.troi?.[0] || '#203040')
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100)
  scene.add(new THREE.HemisphereLight('#ffffff', '#445566', 1.2))
  const den = new THREE.DirectionalLight('#ffffff', 1.5); den.position.set(2, 4, 3); scene.add(den)

  const san = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshStandardMaterial({ color: '#556' }))
  san.rotation.x = -Math.PI / 2; scene.add(san)

  // Nhân vật bằng các khúc trụ nối khớp 2D (đủ để thử bộ diễn xuất)
  const nv = kb.nhan_vat
  const vl = new THREE.MeshStandardMaterial({ color: nv.ao })
  const da = new THREE.MeshStandardMaterial({ color: nv.than })
  const khuc = (m, rk) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rk, rk, 1, 10), m); scene.add(o); return o }
  const noi = (o, a, b, z = 0) => {
    const dxa = b[0] - a[0], dya = b[1] - a[1], L = Math.hypot(dxa, dya) || 1e-4
    o.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z); o.scale.set(1, L, 1)
    o.rotation.set(0, 0, Math.atan2(dya, dxa) - Math.PI / 2)
  }
  const than = khuc(vl, 0.06), dau = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 14), da); scene.add(dau)
  const tay = [khuc(da, 0.025), khuc(da, 0.022), khuc(da, 0.025), khuc(da, 0.022)]
  const chan = [khuc(vl, 0.032), khuc(vl, 0.028), khuc(vl, 0.032), khuc(vl, 0.028)]
  const la = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff3030' }))
  scene.add(la)

  return {
    ve(T) {
      const m = dx.may(T), p = dx.tuThe(T), k = dx.khung2D(p), sk = dx.suKien(T)
      dx.datMay3D(cam, m)
      // bên gần máy vẽ trước mặt một chút (z dương)
      const zp = 0.04 * k.huong, zt = -zp
      noi(than, k.hong, k.coGoc)
      dau.position.set(k.dau[0], k.dau[1], 0)
      noi(tay[0], k.vaiP, k.khuyuP, zp); noi(tay[1], k.khuyuP, k.banP, zp)
      noi(tay[2], k.vaiT, k.khuyuT, zt); noi(tay[3], k.khuyuT, k.banT, zt)
      noi(chan[0], k.hongP, k.goiP, zp); noi(chan[1], k.goiP, k.coChanP, zp)
      noi(chan[2], k.hongT, k.goiT, zt); noi(chan[3], k.goiT, k.coChanT, zt)
      la.visible = sk.hien > 0.01
      la.position.set(dx.hienX(T), 1, -0.3); la.scale.setScalar(Math.max(0.01, sk.hien))
      cam.position.x += sk.rung * 0.02 * Math.sin(T * 90)
      r.render(scene, cam)
    },
  }
}
