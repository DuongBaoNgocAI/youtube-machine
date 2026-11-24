// Phụ đề: cụm từ, từng từ nhảy theo giọng, hoặc không chữ.
// Cảnh có tu_moc (mốc từ STT) thì theo đúng mốc, không có thì chia theo số chữ cái.
const KHONG_CACH = /[぀-ヿ㐀-鿿฀-๿]/

function tachTu(chu) {
  if (!KHONG_CACH.test(chu)) return { tu: chu.trim().split(/\s+/).filter(Boolean), noi: ' ' }
  const ra = []
  for (const { segment, isWordLike } of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(chu)) {
    if (isWordLike || !ra.length) ra.push(segment)
    else ra[ra.length - 1] += segment
  }
  return { tu: ra, noi: '' }
}

function mocTu(c) {
  if (c.tu_moc && c.tu_moc.length) return { ds: c.tu_moc, noi: KHONG_CACH.test(c.chu || '') ? '' : ' ' }
  const { tu, noi } = tachTu(c.chu || '')
  const tong = tu.reduce((s, t) => s + t.length + 1, 0)
  let dem = 0
  const ds = tu.map(chu => {
    const moc = c.tu + (dem / tong) * (c.den - c.tu) * 0.95
    dem += chu.length + 1
    return { chu, tu: moc }
  })
  return { ds, noi }
}

// Cụm không vắt qua dấu hết câu
function chiaCum(ds, moi) {
  const ra = []
  let dau = 0
  ds.forEach((t, i) => {
    if (i < ds.length - 1 && !t.ngat && !/[.!?…。！？]$/.test(t.chu)) return
    const n = i + 1 - dau, so = Math.ceil(n / moi)
    for (let k = 0; k < so; k++) ra.push([dau + Math.round(k * n / so), dau + Math.round((k + 1) * n / so)])
    dau = i + 1
  })
  return ra
}

export function inPhuDe(x, W, H, c, T, cd, phong) {
  if (cd.kieu === 'khong') return
  const { ds, noi } = mocTu(c)
  if (!ds.length) return
  let dang = 0
  while (dang < ds.length - 1 && T >= ds[dang + 1].tu) dang++

  const moi = cd.moi || (cd.kieu === 'tung-tu' ? 4 : 7)
  const [dau, cuoi] = chiaCum(ds, moi).find(([a, b]) => dang >= a && dang < b)
  const tu = ds.slice(dau, cuoi).map(t => t.chu)
  // Khung dọc: chữ ở 1/6 trên. Khung ngang (bộ diễn xuất): chữ ở dưới, tối đa 2 dòng.
  const ngang = W > H, soDong = ngang ? 2 : 3
  let px = Math.round(ngang ? H * (cd.kieu === 'tung-tu' ? 0.064 : 0.056) : W * (cd.kieu === 'tung-tu' ? 0.074 : 0.066)), dong, cach
  const rong = W * (ngang ? 0.66 : 0.76)
  for (;;) {
    x.font = `800 ${px}px ${phong}`
    cach = noi ? x.measureText(' ').width * (cd.kieu === 'tung-tu' ? 1.4 : 1) : 0
    dong = xep(rong)
    if ((dong.length <= soDong && dong.every(d => d.w <= rong)) || px < 14) break
    px -= 2
  }
  // Thu hẹp dần mà không thêm dòng để khỏi rơi một chữ lẻ
  if (dong.length > 1) for (let r = rong - W * 0.02; r > rong * 0.5; r -= W * 0.02) {
    const thu = xep(r)
    if (thu.length > dong.length || thu.some(d => d.w > r)) break
    dong = thu
  }
  function xep(toiDa) {
    const ra = [{ w: 0, ds: [] }]
    tu.forEach((t, i) => {
      const w = x.measureText(t).width
      let d = ra[ra.length - 1]
      if (d.ds.length && d.w + cach + w > toiDa) { d = { w: 0, ds: [] }; ra.push(d) }
      d.w += (d.ds.length ? cach : 0) + w
      d.ds.push({ t, w, i: i + dau })
    })
    return ra
  }

  x.textAlign = 'center'; x.lineJoin = 'round'; x.lineWidth = px * 0.26; x.strokeStyle = '#17182c'
  dong.forEach((d, k) => {
    let vt = W / 2 - d.w / 2
    const y = ngang ? H * 0.86 - (dong.length - 1 - k) * px * 1.25 : H * 0.17 + k * px * 1.25
    for (const o of d.ds) {
      const sang = cd.kieu === 'tung-tu' && o.i === dang
      const to = sang ? 1 + 0.07 * Math.max(0, 1 - (T - ds[o.i].tu) / 0.14) : 1
      x.save()
      x.translate(vt + o.w / 2, y)
      x.scale(to, to)
      x.fillStyle = sang ? cd.mau || '#ffd84d' : '#fff'
      x.strokeText(o.t, 0, 0); x.fillText(o.t, 0, 0)
      x.restore()
      vt += o.w + cach
    }
  })
}
