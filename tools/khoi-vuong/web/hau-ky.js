// Hậu kỳ trên khung 2D: điểm ảnh to, sọc màn hình cũ, quầng sáng, mờ hai mép sa bàn.
export function taoHauKy(W, H, hau = {}) {
  const phu = document.createElement('canvas'), p = phu.getContext('2d')
  phu.width = W; phu.height = H
  if (hau.vien_toi) {
    const g = p.createRadialGradient(W / 2, H * 0.55, W * 0.25, W / 2, H * 0.55, H * 0.65)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(0,0,0,${hau.vien_toi})`)
    p.fillStyle = g; p.fillRect(0, 0, W, H)
  }
  if (hau.soc) {
    p.fillStyle = 'rgba(0,0,0,.16)'
    const buoc = Math.max(3, Math.round(H / 270))
    for (let y = 0; y < H; y += buoc) p.fillRect(0, y, W, Math.ceil(buoc / 3))
  }

  const nho = document.createElement('canvas'), n = nho.getContext('2d')
  nho.width = Math.round(W / 4); nho.height = Math.round(H / 4)
  const lop = document.createElement('canvas'), l = lop.getContext('2d')
  lop.width = W; lop.height = H
  const mat = l.createLinearGradient(0, 0, 0, H)
  for (const [vt, a] of [[0, 1], [0.24, 0.9], [0.4, 0], [0.7, 0], [0.86, 0.95], [1, 1]]) mat.addColorStop(vt, `rgba(0,0,0,${a})`)

  return {
    ap(x, nguon) {
      x.imageSmoothingEnabled = !hau.diem_anh
      x.drawImage(nguon, 0, 0, W, H)
      x.imageSmoothingEnabled = true
      if (hau.mo_mep || hau.quang) { n.clearRect(0, 0, nho.width, nho.height); n.drawImage(x.canvas, 0, 0, nho.width, nho.height) }
      if (hau.mo_mep) {
        l.globalCompositeOperation = 'source-over'
        l.clearRect(0, 0, W, H)
        l.filter = `blur(${W / 270}px)`
        l.drawImage(nho, 0, 0, W, H)
        l.filter = 'none'
        l.globalCompositeOperation = 'destination-in'
        l.fillStyle = mat; l.fillRect(0, 0, W, H)
        x.drawImage(lop, 0, 0)
      }
      if (hau.quang) {
        x.globalCompositeOperation = 'lighter'
        x.globalAlpha = hau.quang
        x.drawImage(nho, 0, 0, W, H)
        x.globalAlpha = 1
        x.globalCompositeOperation = 'source-over'
      }
      if (hau.vien_toi || hau.soc) x.drawImage(phu, 0, 0)
    },
  }
}
