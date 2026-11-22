// Chạy trong trình duyệt ẩn: nhận việc, vẽ, in chữ, nén H.264, trả dòng hình về Node.
import { theGioi } from './the-gioi.js'
import { tinhKhung } from './khung.js'
import { taoBoVe } from './ve.js'
import { taoHauKy } from './hau-ky.js'
import { inPhuDe } from './phu-de.js'

async function chay() {
  const { bang, kb, W, H, tu, den, bitrate, inChu } = await (await fetch('viec')).json()
  const pc = bang.phong_cach[kb.phong_cach], bc = pc.boi_canh[kb.boi_canh]
  const gl = document.createElement('canvas'), ra = document.createElement('canvas')
  ra.width = W; ra.height = H
  // Cỡ điểm ảnh cố định theo tỉ lệ, để nháp 540 và bản 1080 trông như nhau.
  gl.width = pc.phan_giai ? Math.round(540 * pc.phan_giai) : W
  gl.height = pc.phan_giai ? Math.round(960 * pc.phan_giai) : H
  const x = ra.getContext('2d'), hau = taoHauKy(W, H, pc.hau)
  const phong = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif'
  const may = taoBoVe(gl, pc, bc, theGioi(pc, bc, kb), kb.boi_canh === 'rung-nam')

  const chung = { codec: W > 720 ? 'avc1.640033' : 'avc1.64002a', width: W, height: H, bitrate, framerate: kb.fps, avc: { format: 'annexb' } }
  let cauHinh = { ...chung, hardwareAcceleration: 'prefer-hardware' }, nenGpu = true
  if (!(await VideoEncoder.isConfigSupported(cauHinh)).supported) {
    nenGpu = false; cauHinh = chung
    if (!(await VideoEncoder.isConfigSupported(cauHinh)).supported) throw new Error('Trình duyệt này không nén được H.264. Cài Google Chrome hoặc Microsoft Edge bản mới.')
  }
  const phan = []
  let loi
  const nen = new VideoEncoder({
    error: e => { loi = e },
    output: c => { const b = new Uint8Array(c.byteLength); c.copyTo(b); phan.push(b) },
  })
  nen.configure(cauHinh)

  const N = Math.max(1, Math.round((den - tu) * kb.fps)), batDau = performance.now()
  for (let i = 0; i < N; i++) {
    const T = tu + i / kb.fps, k = tinhKhung(pc, bc, kb, bang.cho, T)
    may.ve(k, T)
    hau.ap(x, gl)
    if (inChu) inPhuDe(x, W, H, k.canh, T, kb.phu_de, phong)
    const vf = new VideoFrame(ra, { timestamp: Math.round(i * 1e6 / kb.fps) })
    nen.encode(vf, { keyFrame: i % (kb.fps * 2) === 0 })
    vf.close()
    while (nen.encodeQueueSize > 6 && !loi) await new Promise(r => setTimeout(r, 0))
    if (loi) throw loi
  }
  await nen.flush()
  const giay = (performance.now() - batDau) / 1000
  const tin = new URLSearchParams({ khung: N, giay: giay.toFixed(2), gpu: may.gpu, nen_gpu: nenGpu })
  await fetch('xong?' + tin, { method: 'POST', body: new Blob(phan) })
}

chay().catch(e => fetch('loi', { method: 'POST', body: String((e && e.stack) || e) }))
