// Bốn mặt bằng dùng chung cho mọi phong cách. Lối đi luôn dọc trục x.
//   vuc: khoảng trống ở giữa | ham: đường hầm cắt mở | leo: bậc lên cao 4 | dau-truong: sàn đấu có khán đài
import { vat, rand, kep, muot, CHAT, HINH } from './chung.js'

export const coHo = mb => mb === 'vuc'
export const caoDich = mb => (mb === 'leo' ? 4 : 0)

export function caoLoi(mb, x) {
  if (mb !== 'leo') return 0
  const u = (x + 4) / 2 + 0.2
  if (u <= 0) return 0
  if (u >= 4) return 4
  return Math.floor(u) + muot(kep((u - Math.floor(u)) / 0.25))
}

// Trả về hàm đặt hộp: lưới vuông thì rải khối 1x1, còn lại một hộp liền.
function hop(ds, vuong) {
  return (x0, x1, y0, y1, z0, z1, c, chat = CHAT.da, sang = 0) => {
    if (!vuong) return vat(ds, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [x1 - x0, y1 - y0, z1 - z0], c, { bo: 0.18, sang, chat })
    for (let x = x0 + 0.5; x < x1; x++) for (let y = y0 + 0.5; y < y1; y++) for (let z = z0 + 0.5; z < z1; z++) {
      const trong = x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1 && z > z0 + 1 && z < z1 - 1
      if (!trong) vat(ds, [x, y, z], [1, 1, 1], c, { chat, sang, hat: rand(x * 3 + y, z * 7) })
    }
  }
}

export function themMatBang(ds, pc, bc, mb) {
  if (coHo(mb)) return
  const vuong = pc.luoi === 'vuong', h = hop(ds, vuong)
  // Lưới vuông tự lấp đất bằng caoDat, các phong cách khác cần tấm sàn.
  if (!vuong && mb !== 'leo') h(-4.3, 4.3, -1.2, -0.01, -5, 5, bc.dat[0], CHAT.dat)

  if (mb === 'leo') {
    if (vuong) return
    for (let n = 0; n < 4; n++) {
      const x = -4 + n * 2
      h(x - 0.02, x + 2.02, -1.2, n + 1, -2.6, 2.6, bc.da[n % 4])
      h(x, x + 2, n + 0.85, n + 1.02, -2.7, 2.7, bc.dat[n % 2], CHAT.dat)
    }
  }

  if (mb === 'ham') {
    h(-10, 10, 0, 7, vuong ? -6.5 : -6, vuong ? -4.5 : -4.4, bc.da[0])
    h(-10, 10, 6, 8, vuong ? -5.5 : -5.4, vuong ? -1.5 : -1.6, bc.da[3])
    for (let x = -9; x <= 8; x += 4) {
      h(x, x + 1, 0, 6, vuong ? -4.5 : -4.4, vuong ? -3.5 : -3.6, bc.than, CHAT.go)
      h(x, x + 1, 5, 6, vuong ? -3.5 : -3.6, vuong ? -0.5 : -0.8, bc.than, CHAT.go)
      vat(ds, [x + 2.4, 3.3, -4.1], [0.14, 0.7, 0.14], bc.than, { bo: 0.06 })
      vat(ds, [x + 2.4, 3.85, -4.1], [0.4, 0.45, 0.4], '#ffd67a', { sang: 1, bo: 0.2 })
    }
  }

  if (mb === 'dau-truong') {
    for (let t = 0; t < 3; t++) {
      const z = (vuong ? -5.5 : -5.3) - t
      h(-10, 10, 0, t + 1, z - 1, z, bc.da[t % 4])
      for (let i = 0; i < 12; i++) {
        const x = -9.2 + i * 1.66 + rand(i, t) * 0.4
        vat(ds, [x, t + 1.35, z - 0.5], [0.5, 0.7, 0.4], bc.la[(i + t) % 3], { bo: 0.18 })
        vat(ds, [x, t + 1.92, z - 0.5], [0.42, 0.42, 0.42], bc.nhan, { bo: 0.21 })
      }
    }
    for (let a = 0; a < 20; a++) {
      const g = a / 20 * Math.PI * 2
      vat(ds, [Math.cos(g) * 5.2, 0.03, Math.sin(g) * 3.4], [0.9, 0.1, 0.35], bc.nhan2, { ry: Math.atan2(-Math.cos(g) * 3.4, -Math.sin(g) * 5.2), bo: 0.05 })
    }
    for (const x of [-7, 7]) {
      vat(ds, [x, 2, -4], [0.35, 4, 0.35], bc.than, { bo: 0.12, hinh: HINH.tru })
      vat(ds, [x + 0.65, 3.5, -4], [1, 0.8, 0.08], bc.nhan2, { bo: 0.03 })
    }
  }
}
