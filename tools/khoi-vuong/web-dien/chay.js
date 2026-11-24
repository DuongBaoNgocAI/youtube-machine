// Chạy trong trình duyệt ẩn: nhận việc, vẽ bằng phong cách đã chọn, in chữ, nén H.264, trả dòng hình về Node.
// Bộ dựng diễn xuất (nhóm dien-xuat). Bộ khối nằm ở ../web/.
import * as THREE from 'three'
import { taoDien } from './dien.js'
import { inPhuDe } from '../web/phu-de.js'

async function chay() {
  const { bang, kb, W, H, tu, den, bitrate, inChu } = await (await fetch('viec')).json()
  const pc = bang.phong_cach[kb.phong_cach], bc = pc.boi_canh[kb.boi_canh]
  const gl = document.createElement('canvas'), ra = document.createElement('canvas')
  gl.width = ra.width = W; gl.height = ra.height = H
  const x = ra.getContext('2d')
  const phong = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif'
  const dx = taoDien(kb, bang, { W, H })
  const mod = await import(`./phong-cach/${kb.phong_cach}.js`)
  const canh = await mod.taoCanh({ THREE, canvas: gl, W, H, pc, bc, kb, dx })

  let gpu = 'không rõ'
  try {
    const c = gl.getContext('webgl2'), d = c && c.getExtension('WEBGL_debug_renderer_info')
    if (d) gpu = c.getParameter(d.UNMASKED_RENDERER_WEBGL)
  } catch {}

  const chung = { codec: W * H > 720 * 1280 ? 'avc1.640033' : 'avc1.64002a', width: W, height: H, bitrate, framerate: kb.fps, avc: { format: 'annexb' } }
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
    const T = tu + i / kb.fps
    await canh.ve(T)
    x.drawImage(gl, 0, 0)
    if (inChu) inPhuDe(x, W, H, dx.timCanh(T), T, kb.phu_de, phong)
    const vf = new VideoFrame(ra, { timestamp: Math.round(i * 1e6 / kb.fps) })
    nen.encode(vf, { keyFrame: i % (kb.fps * 2) === 0 })
    vf.close()
    while (nen.encodeQueueSize > 6 && !loi) await new Promise(r => setTimeout(r, 0))
    if (loi) throw loi
  }
  await nen.flush()
  const giay = (performance.now() - batDau) / 1000
  const tin = new URLSearchParams({ khung: N, giay: giay.toFixed(2), gpu, nen_gpu: nenGpu })
  await fetch('xong?' + tin, { method: 'POST', body: new Blob(phan) })
}

chay().catch(e => fetch('loi', { method: 'POST', body: String((e && e.stack) || e) }))
