#!/usr/bin/env node
// Dựng Shorts khối 3D từ lời đọc. Cần Node 18+, ffmpeg, Chrome hoặc Edge. Không cần npm install.
//   node tools/khoi-vuong/khoi-vuong.mjs danh-sach
//   node tools/khoi-vuong/khoi-vuong.mjs goi-y [--the-loai <mã>] [--do-dai 15|30|45|60] [--ngon-ngu vi|en|...]
//   node tools/khoi-vuong/khoi-vuong.mjs mau --ra <thư mục> [--phong-cach <mã>] [--moi-boi-canh]
//   node tools/khoi-vuong/khoi-vuong.mjs chia-canh (--srt <file> | --chu <file>) --phong-cach <mã> --ra <canh.json>
//        [--boi-canh <mã>] [--moc thap|nha|cong] [--mat-bang vuc|ham|leo|dau-truong] [--nhan-vat <json>] [--nhan-vat-phu <json>|mau]
//        [--the-loai <mã>] [--do-dai <giây>] [--ngon-ngu <mã>] [--mo <mã>] [--ket <mã>] [--phu-de cum|tung-tu|khong] [--mau-nhan #rrggbb]
//        [--stt <stt.json>] [--nhac <không khí>|khong] [--khong-tieng-dong]
//   node tools/khoi-vuong/khoi-vuong.mjs kiem <canh.json>
//   node tools/khoi-vuong/khoi-vuong.mjs dung <canh.json> --ra <mp4> [--co 540|720|1080] [--tieng <mp3>] [--canh <số>] [--khong-chu]
import fs from 'fs'
import os from 'os'
import path from 'path'
import http from 'http'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { spawn, spawnSync } from 'child_process'
import { taoAm, KHONG_KHI } from './am.mjs'
import { kichBanMau } from './mau.mjs'

const DAY = path.dirname(fileURLToPath(import.meta.url))
const WEB = path.join(DAY, 'web')
const BANG = JSON.parse(fs.readFileSync(path.join(DAY, 'phong-cach.json'), 'utf8'))
const docJson = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''))

class Loi extends Error {}

function docThamSo(ds) {
  const co = {}, tron = [], congTac = ['khong-chu', 'moi-boi-canh', 'khong-tieng-dong', 'khong-am']
  for (let i = 0; i < ds.length; i++) {
    if (!ds[i].startsWith('--')) { tron.push(ds[i]); continue }
    const k = ds[i].slice(2)
    if (congTac.includes(k)) { co[k] = true; continue }
    if (ds[i + 1] === undefined || ds[i + 1].startsWith('--')) throw new Loi(`Thiếu giá trị cho --${k}`)
    co[k] = ds[++i]
  }
  return { co, tron }
}

function timPhongCach(ten) {
  if (!ten) throw new Loi('Thiếu --phong-cach. Hỏi người dùng chọn, xem danh sách bằng lệnh danh-sach.')
  const t = ten.toLowerCase()
  const ma = Object.keys(BANG.phong_cach).find(k => k === t || BANG.phong_cach[k].goi.includes(t))
  if (!ma) throw new Loi(`Không có phong cách "${ten}".`)
  return ma
}

// ---- Chia cảnh ----
function docSrt(f) {
  const giay = s => { const [h, m, x] = s.replace(',', '.').split(':'); return +h * 3600 + +m * 60 + +x }
  const ra = []
  for (const khoi of fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r/g, '').trim().split(/\n\s*\n/)) {
    const d = khoi.split('\n'), i = d.findIndex(x => x.includes('-->'))
    if (i < 0) continue
    const [a, b] = d[i].split('-->').map(x => giay(x.trim().split(' ')[0]))
    ra.push({ tu: a, den: b, chu: d.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').trim() })
  }
  return ra
}

function docChu(f, ngonNgu) {
  const chu = fs.readFileSync(f, 'utf8').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim()
  const ra = []
  let t = 0
  for (const cau of chu ? chu.split(/(?<=[.!?…])\s+/) : []) {
    const dai = Math.max(1.8, cau.split(' ').length / (BANG.toc_do[ngonNgu] || BANG.toc_do.khac))
    ra.push({ tu: +t.toFixed(2), den: +(t + dai).toFixed(2), chu: cau })
    t += dai
  }
  return ra
}

const TU_KHOA = [
  ['noi', 'nói|hỏi|đáp|bảo(?! vệ| bối| tàng)|thì thầm|says?|said|asks?|asked|tells?|told|whispers?|whispered'],
  ['leo', 'leo|trèo|climbs?|climbed|climbing'],
  ['nga', 'ngã|rơi xuống|rơi|trượt chân|falls?|fell|falling|slips?|slipped'],
  ['xay', 'xây|xếp|bắc|dựng|chế tạo|builds?|built|building|crafts?|crafted|places?|placed'],
  ['dao', 'đào|khai thác|cuốc|digs?|dug|digging|mines?|mined|mining'],
  ['nhay', 'nhảy|vượt qua|phóng qua|jumps?|jumped|jumping|leaps?|leapt'],
  ['chay', 'chạy|lao|trốn|đuổi|runs?|ran|running|races?|raced|escapes?|escaped'],
  ['mung', 'thắng|thành công|reo|sống sót|cứu được|sáng trở lại|wins?|won|survived|finally|cheers?'],
  ['di', 'đi|bước|tới gần|walks?|walked|walking|heads?|headed'],
  ['nhin', 'nhìn|thấy|phát hiện|tìm|looks?|looked|sees?|saw|finds?|found|notices?|noticed'],
].map(([k, r]) => [k, new RegExp(`(?<![\\p{L}])(?:${r})(?![\\p{L}])`, 'iu')])
const PHU_DINH = /(?<![\p{L}])(?:không|chưa|đừng|chẳng|not|never|don't|didn't|can't)\s+(?:thể\s+|được\s+)?$/iu

function doanViec(chu) {
  let hay = null
  for (const [viec, re] of TU_KHOA) {
    const m = re.exec(chu)
    if (!m || PHU_DINH.test(chu.slice(0, m.index))) continue
    if (!hay || m.index < hay.vt) hay = { viec, vt: m.index }
  }
  return hay ? hay.viec : 'dung'
}

// Chỉ là bản phân cảnh nháp. Trợ lý đọc lại từng câu và sửa theo nghĩa.
const DOI_THU = /(?<![\p{L}])(?:đuổi|bám theo|rượt|chases?|chased|chasing|follows?|followed)(?![\p{L}])/iu

function phanCanh(dong, kb) {
  const thu = ['xuat-phat', 'mep', 'ben-kia', 'dich']
  const may = { dung: ['can', 'toan', 'vut'], noi: ['can', 'doi'], leo: ['ngang', 'theo', 'tren'], nhin: ['can', 'theo', 'tren'], di: ['theo', 'ngang', 'toan'], chay: ['theo', 'ngang', 'vut'], nhay: ['ngang', 'theo'], xay: ['ngang', 'tren', 'can'], dao: ['can', 'tren'], nga: ['tren', 'ngang'], mung: ['vut', 'can'] }
  const ho = kb.mat_bang === 'vuc', vp = kb.nhan_vat_phu
  let o = 'mep', cau = false, truoc = ''
  return dong.map((d, i) => {
    let viec = doanViec(d.chu)
    const su_kien = []
    if (i === dong.length - 1 && i > 0 && viec !== 'nga') { viec = 'mung'; su_kien.push('sang') }
    let toi = o
    if (viec === 'leo' && kb.mat_bang !== 'leo') viec = 'di'
    if (viec === 'xay' && ho && !cau && o === 'mep') { su_kien.push('cau'); cau = true }
    if (['di', 'chay', 'nhay', 'leo'].includes(viec)) {
      const j = thu.indexOf(o)
      toi = thu[(j + 1) % thu.length]
      if (o === 'dich') toi = 'ben-kia'
      if (o === 'giua') toi = 'ben-kia' // ngã sấp giữa đường rồi đi tiếp
      if (o === 'mep' && ho && !cau) viec = 'nhay'
      if (o === 'mep' && kb.mat_bang === 'leo' && viec !== 'nhay') viec = 'leo'
    }
    if (viec === 'nga' && o === 'mep') toi = 'giua'
    else if (viec === 'nga' && ho) viec = 'nhin'
    let phu, noi
    if (vp) {
      phu = DOI_THU.test(d.chu) ? 'duoi' : viec === 'noi' ? 'doi-dien' : vp.dang === 'quai' ? 'vang' : 'theo'
      if (viec === 'noi') noi = d.chu.toLowerCase().startsWith((vp.ten || '\u0000').toLowerCase()) ? 'phu' : 'chinh'
    }
    const gocMay = phu === 'doi-dien' ? ['doi', 'can'] : may[viec]
    const ds = i === 0 ? ['toan', ...gocMay] : gocMay
    const m = ds.find(x => x !== truoc)
    truoc = m
    const c = { ...d, hanh_dong: viec, tu_cho: o, den_cho: toi, may: m, su_kien, ...(phu && { phu }), ...(noi && { noi }) }
    o = toi === 'giua' && ho ? 'mep' : toi
    return c
  })
}

function chuanGio(canh) {
  return canh.map((c, i) => ({ ...c, tu: i ? c.tu : 0, den: i < canh.length - 1 ? canh[i + 1].tu : c.den }))
}

// ---- Kiểm ----
function kiem(kb) {
  const loi = [], nhac = []
  const pc = BANG.phong_cach[kb.phong_cach]
  if (!pc) return { loi: [`phong_cach không hợp lệ: ${kb.phong_cach}`], nhac }
  if (!pc.boi_canh[kb.boi_canh]) loi.push(`boi_canh phải là một trong: ${Object.keys(pc.boi_canh).join(', ')}`)
  if (kb.mua && !pc.boi_canh[kb.boi_canh]?.pho) loi.push('mua chỉ dùng với bối cảnh đô thị mưa (do-thi-mua)')
  if (!BANG.moc.includes(kb.moc)) loi.push(`moc phải là một trong: ${BANG.moc.join(', ')}`)
  if (!Number.isInteger(kb.fps) || kb.fps < 12 || kb.fps > 60) loi.push('fps phải từ 12 tới 60')
  const MAU = /^#[0-9a-f]{6}$/i
  for (const ten of kb.nhan_vat_phu ? ['nhan_vat', 'nhan_vat_phu'] : ['nhan_vat']) {
    const nv = kb[ten] || {}
    for (const k of ['dang', 'mu', 'deo']) if (!BANG[k].includes(nv[k])) loi.push(`${ten}.${k} phải là một trong: ${BANG[k].join(', ')}`)
    for (const k of ['than', 'mat', 'ao', 'quan', 'phu']) if (!MAU.test(nv[k] || '')) loi.push(`${ten}.${k} phải là màu #rrggbb`)
  }
  const mb = kb.mat_bang || 'vuc', ho = mb === 'vuc'
  if (!BANG.mat_bang[mb]) loi.push(`mat_bang phải là một trong: ${Object.keys(BANG.mat_bang).join(', ')}`)
  const pd = kb.phu_de || { kieu: 'cum' }
  if (!BANG.phu_de[pd.kieu]) loi.push(`phu_de.kieu phải là một trong: ${Object.keys(BANG.phu_de).join(', ')}`)
  if (pd.mau && !MAU.test(pd.mau)) loi.push('phu_de.mau phải là màu #rrggbb')
  if (pd.moi !== undefined && !(Number.isInteger(pd.moi) && pd.moi >= 2 && pd.moi <= 9)) loi.push('phu_de.moi phải là số chữ mỗi cụm, từ 2 tới 9')
  const nh = kb.am?.nhac || 'khong'
  if (nh !== 'khong' && !KHONG_KHI[nh]) loi.push(`am.nhac phải là một trong: khong, ${Object.keys(KHONG_KHI).join(', ')}`)
  for (const k of ['the_loai', 'mo', 'ket']) if (kb[k] && !BANG[k][kb[k]]) loi.push(`${k} phải là một trong: ${Object.keys(BANG[k]).join(', ')}`)
  if (pc.khong_tre_em) nhac.push(`${pc.ten} không hợp video dành cho trẻ em`)
  if (!Array.isArray(kb.canh) || !kb.canh.length) return { loi: [...loi, 'Chưa có cảnh nào'], nhac }

  let cau = false, truoc = null
  kb.canh.forEach((c, i) => {
    const o = `Cảnh ${i + 1}`
    if (!(c.den > c.tu)) loi.push(`${o}: den phải lớn hơn tu`)
    if (truoc && c.tu < truoc.tu) loi.push(`${o}: thời gian lùi so với cảnh trước`)
    if (truoc && Math.abs(c.tu - truoc.den) > 0.05) nhac.push(`${o}: hở hoặc đè ${Math.abs(c.tu - truoc.den).toFixed(2)} giây với cảnh trước`)
    for (const [k, ds] of [['hanh_dong', BANG.hanh_dong], ['may', BANG.may], ['tu_cho', Object.keys(BANG.cho)], ['den_cho', Object.keys(BANG.cho)]])
      if (!ds.includes(c[k])) loi.push(`${o}: ${k} phải là một trong: ${ds.join(', ')}`)
    for (const s of c.su_kien || []) if (!BANG.su_kien.includes(s)) loi.push(`${o}: su_kien không hợp lệ: ${s}`)

    const a = BANG.cho[c.tu_cho], b = BANG.cho[c.den_cho]
    const trenHo = ho && !['nhay', 'nga'].includes(c.hanh_dong) && Math.min(a, b) < 4 && Math.max(a, b) > -4
    if (trenHo && !cau) loi.push(`${o}: nhân vật ở trên khoảng trống khi chưa có cầu (dùng nhay, hoặc thêm su_kien cau ở cảnh trước)`)
    if (a !== b && !['di', 'chay', 'nhay', 'nga', 'leo'].includes(c.hanh_dong)) loi.push(`${o}: ${c.hanh_dong} mà đổi chỗ, sẽ bị trượt chân`)
    if (truoc && truoc.den_cho !== c.tu_cho && truoc.hanh_dong !== 'nga') loi.push(`${o}: cảnh trước kết ở ${truoc.den_cho}, cảnh này lại bắt đầu ở ${c.tu_cho}`)
    if (truoc && truoc.may === c.may && !c.may_rieng && !truoc.may_rieng) nhac.push(`${o}: trùng góc máy với cảnh trước`)
    if (c.den - c.tu > 6) nhac.push(`${o}: dài trên 6 giây, nên tách cho Shorts`)
    if ((c.su_kien || []).includes('cau')) {
      if (!ho) loi.push(`${o}: sự kiện cau chỉ dùng ở mặt bằng vuc`)
      cau = true
    }
    if (c.hanh_dong === 'leo' && mb !== 'leo') loi.push(`${o}: động tác leo chỉ dùng ở mặt bằng leo`)
    if (c.phu !== undefined && !BANG.phu[c.phu]) loi.push(`${o}: phu phải là một trong: ${Object.keys(BANG.phu).join(', ')}`)
    if (c.noi !== undefined && !BANG.noi.includes(c.noi)) loi.push(`${o}: noi phải là chinh hoặc phu`)
    const coPhu = c.phu && c.phu !== 'vang'
    if (coPhu && !kb.nhan_vat_phu) loi.push(`${o}: có phu nhưng file chưa có nhan_vat_phu`)
    if (c.noi === 'phu' && !coPhu) loi.push(`${o}: nhân vật phụ nói mà không có mặt`)
    const soDay = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite)
    if (c.may_rieng && !(soDay(c.may_rieng.tu, 6) && (!c.may_rieng.den || soDay(c.may_rieng.den, 6)))) loi.push(`${o}: may_rieng.tu và den phải là 6 số (chỗ máy, chỗ nhìn)`)
    if (c.troi && !(Array.isArray(c.troi) && c.troi.length === 2 && c.troi.every(v => MAU.test(v)))) loi.push(`${o}: troi phải là 2 màu #rrggbb`)
    if (c.dau && !soDay(c.dau, 2)) loi.push(`${o}: dau phải là 2 số (quay, ngửa)`)
    if (c.suong && !soDay(c.suong, 2)) loi.push(`${o}: suong phải là 2 số`)
    if (c.huong !== undefined && !Number.isFinite(c.huong)) loi.push(`${o}: huong phải là số (radian)`)
    if (c.tu_moc && c.tu_moc.some(t => typeof t.chu !== 'string' || !(t.tu >= c.tu - 1 && t.tu <= c.den + 1))) loi.push(`${o}: tu_moc nằm ngoài cảnh`)
    truoc = c
  })
  if (kb.do_dai && Math.abs(kb.canh.at(-1).den - kb.do_dai) > kb.do_dai * 0.2) nhac.push(`Dài ${kb.canh.at(-1).den.toFixed(1)} giây, lệch mục tiêu ${kb.do_dai} giây`)
  if (pd.kieu === 'tung-tu' && !kb.canh.some(c => c.tu_moc?.length)) nhac.push('Chữ từng từ đang chia đều theo chữ cái, chưa khớp giọng. Thêm --stt khi chia-canh')
  if (kb.canh.at(-1).den > 180) nhac.push('Dài trên 3 phút, kiểm tra lại giới hạn Shorts hiện hành')
  return { loi, nhac }
}

// ---- Dựng ----
function timTrinhDuyet() {
  const w = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
  const ung = [
    process.env.YTM_CHROME,
    ...w.map(d => path.join(d, 'Google/Chrome/Application/chrome.exe')),
    ...w.map(d => path.join(d, 'Microsoft/Edge/Application/msedge.exe')),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].filter(Boolean)
  const thay = ung.find(f => fs.existsSync(f))
  if (!thay) throw new Loi('Không thấy Chrome hay Edge. Cài một trong hai, hoặc đặt biến YTM_CHROME trỏ tới file chạy.')
  return thay
}

function lenh(ten, ds) {
  const r = spawnSync(ten, ds, { encoding: 'utf8', maxBuffer: 1 << 26 })
  if (r.error) throw new Loi(`Không chạy được ${ten}. Cần cài ffmpeg (có cả ffprobe).`)
  if (r.status !== 0) throw new Loi(`${ten} lỗi: ${r.stderr.slice(-1500)}`)
  return r.stdout
}

function veBangTrinhDuyet(viec) {
  const exe = timTrinhDuyet(), ma = '/' + crypto.randomBytes(12).toString('hex') + '/'
  const hoSo = fs.mkdtempSync(path.join(os.tmpdir(), 'ytm-khoi-'))
  const LOAI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }
  return new Promise((xong, hong) => {
    let con, hen, het = false
    const ket = (loi, kq) => {
      if (het) return
      het = true
      clearTimeout(hen)
      may.close()
      may.closeAllConnections?.()
      // Tắt cả cây tiến trình, rồi chờ trình duyệt nhả hồ sơ mới xóa.
      if (con && con.pid && con.exitCode === null) {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(con.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true })
        else con.kill()
      }
      let lan = 0
      const don = () => {
        try {
          fs.rmSync(hoSo, { recursive: true, force: true })
        } catch {
          if (++lan < 50) return setTimeout(don, 200)
          console.error('Chưa dọn được hồ sơ tạm: ' + hoSo)
        }
        loi ? hong(loi) : xong(kq)
      }
      setTimeout(don, 150)
    }
    // Chỉ nghe trên 127.0.0.1, có mã ngẫu nhiên, đóng ngay khi dựng xong.
    const may = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1')
      if (!u.pathname.startsWith(ma)) return res.writeHead(404).end()
      const ten = u.pathname.slice(ma.length) || 'index.html'
      if (req.method === 'POST' && (ten === 'xong' || ten === 'loi')) {
        const manh = []
        req.on('data', d => manh.push(d))
        req.on('end', () => {
          res.writeHead(204).end()
          const than = Buffer.concat(manh)
          if (ten === 'loi') ket(new Loi(`Lỗi khi vẽ: ${than}`))
          else ket(null, { h264: than, ...Object.fromEntries(u.searchParams) })
        })
        return
      }
      if (ten === 'viec') return res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(viec))
      if (!/^[a-z-]+\.(js|html)$/.test(ten) || !fs.existsSync(path.join(WEB, ten))) return res.writeHead(404).end()
      res.writeHead(200, { 'content-type': LOAI[path.extname(ten)], 'cache-control': 'no-store' }).end(fs.readFileSync(path.join(WEB, ten)))
    })
    may.listen(0, '127.0.0.1', () => {
      const ds = ['--headless=new', `--user-data-dir=${hoSo}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--edge-skip-compat-layer-relaunch', '--disable-background-mode', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--enable-gpu', '--ignore-gpu-blocklist']
      if (process.platform === 'win32') ds.push('--use-angle=d3d11')
      ds.push(`http://127.0.0.1:${may.address().port}${ma}`)
      con = spawn(exe, ds, { stdio: 'ignore', windowsHide: true })
      con.on('error', e => ket(new Loi(`Không mở được trình duyệt: ${e.message}`)))
      hen = setTimeout(() => ket(new Loi('Quá giờ mà chưa dựng xong. Cập nhật Chrome, hoặc thử --co 540.')), Math.max(120, (viec.den - viec.tu) * 40) * 1000)
    })
  })
}

async function dung(kb, co) {
  const kq = kiem(kb)
  if (kq.loi.length) throw new Loi(kq.loi.join('\n'))
  if (!co.ra) throw new Loi('Thiếu --ra <file.mp4>')
  const W = { 540: 540, 720: 720, 1080: 1080 }[co.co || 540]
  if (!W) throw new Loi('--co chỉ nhận 540, 720 hoặc 1080')
  const H = W * 16 / 9
  const canh = chuanGio(kb.canh), batDau = Date.now()

  let tu = 0, den = canh.at(-1).den
  if (co.tieng) {
    const daiTieng = +lenh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', co.tieng])
    if (daiTieng > den) den = canh.at(-1).den = daiTieng
  }
  if (co.canh) {
    const c = canh[+co.canh - 1]
    if (!c) throw new Loi(`Không có cảnh ${co.canh}`)
    tu = c.tu; den = c.den
  }
  // Nháp giữ dưới 30 MB để gửi được sang điện thoại.
  const bitrate = W === 1080 ? 14e6 : Math.round(Math.min(W * H * 8, 22e6 * 8 / (den - tu)))
  const day = { ...kb, canh, mat_bang: kb.mat_bang || 'vuc', phu_de: kb.phu_de || { kieu: 'cum' } }
  const r = await veBangTrinhDuyet({ bang: BANG, kb: day, W, H, tu, den, bitrate, inChu: !co['khong-chu'] })

  fs.mkdirSync(path.dirname(path.resolve(co.ra)), { recursive: true })
  const tho = `${co.ra}.${process.pid}.h264`, wav = `${co.ra}.${process.pid}.wav`
  fs.writeFileSync(tho, r.h264)
  try {
    const nen = co['khong-am'] ? null : taoAm(kb, canh, canh.at(-1).den)
    const ds = ['-loglevel', 'error', '-y', '-r', String(kb.fps), '-i', tho]
    if (co.tieng) ds.push('-ss', String(tu), '-i', co.tieng)
    if (nen) { fs.writeFileSync(wav, nen); ds.push('-ss', String(tu), '-i', wav) }
    const CHUAN = 'loudnorm=I=-14:TP=-1.5:LRA=11,apad'
    if (co.tieng && nen) {
      // Nhạc và tiếng động tự hạ xuống khi có lời.
      ds.push('-filter_complex',
        '[1:a]aresample=48000,aformat=channel_layouts=mono,loudnorm=I=-16:TP=-2,aresample=48000,apad,asplit=2[loi][khoa];' +
        '[2:a]volume=0.5[nen];[nen][khoa]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=280[ha];' +
        `[loi][ha]amix=inputs=2:duration=shortest:normalize=0,${CHUAN}[ra]`, '-map', '0:v', '-map', '[ra]')
    } else if (co.tieng || nen) {
      ds.push('-map', '0:v', '-map', '1:a', '-af', CHUAN)
    }
    if (co.tieng || nen) ds.push('-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', String(den - tu))
    ds.push('-c:v', 'copy', '-movflags', '+faststart', co.ra)
    lenh('ffmpeg', ds)
  } finally {
    fs.rmSync(tho, { force: true })
    fs.rmSync(wav, { force: true })
  }

  const anh = co.ra.replace(/\.mp4$/i, '') + '-to-khung.jpg'
  const cach = Math.max(1, Math.floor(+r.khung / 10))
  lenh('ffmpeg', ['-loglevel', 'error', '-y', '-i', co.ra, '-vf', `select='not(mod(n\\,${cach}))',scale=270:480,tile=5x2`, '-frames:v', '1', '-update', '1', anh])
  const giay = ((Date.now() - batDau) / 1000).toFixed(1)
  console.log(`Xong ${co.ra}: ${W}x${H}, ${(den - tu).toFixed(1)} giây video, dựng hết ${giay} giây, ${(fs.statSync(co.ra).size / 1048576).toFixed(1)} MB`)
  console.log(`Tờ khung: ${anh}`)
  console.log(`Vẽ bằng: ${r.gpu}; nén bằng GPU: ${r.nen_gpu === 'true' ? 'có' : 'không'}`)
  kq.nhac.forEach(x => console.log(`Nhắc: ${x}`))
}

function ganMocTu(canh, f) {
  const j = docJson(f), tu = (j.words || []).filter(w => (w.type || 'word') === 'word')
  if (!tu.length) throw new Loi('File STT không có mảng words')
  for (const w of tu) {
    const c = canh.find(c => w.start < c.den - 0.02) || canh.at(-1)
    ;(c.tu_moc ||= []).push({ chu: String(w.text ?? w.word).trim(), tu: +(+w.start).toFixed(3) })
  }
}

function goiY(co) {
  const ds = co['the-loai'] ? [co['the-loai']] : Object.keys(BANG.the_loai)
  for (const ma of ds) {
    const t = BANG.the_loai[ma]
    if (!t) throw new Loi(`--the-loai phải là một trong: ${Object.keys(BANG.the_loai).join(', ')}`)
    console.log(`${ma}: ${t.ten}`)
    t.phong_cach.forEach((p, i) => console.log(`  ${i + 1}. ${BANG.phong_cach[p].ten} (${p}): ${BANG.phong_cach[p].mo_ta}`))
    console.log(`  mặt bằng: ${t.mat_bang.join(', ')} | mở: ${t.mo} | kết: ${t.ket}`)
  }
  if (co['do-dai']) {
    const s = +co['do-dai'], nn = co['ngon-ngu'] || 'vi'
    if (!BANG.do_dai.includes(s)) throw new Loi(`--do-dai phải là một trong: ${BANG.do_dai.join(', ')}`)
    const v = BANG.toc_do[nn] || BANG.toc_do.khac
    console.log(`${s} giây (${nn}): khoảng ${Math.round(s * v * 0.9)}-${Math.round(s * v)} ${nn === 'vi' ? 'tiếng' : 'từ'}, ${Math.round(s / 4)}-${Math.round(s / 2.5)} cảnh. Đây là ước lượng.`)
  }
}

async function chinh() {
  const [viec, ...con] = process.argv.slice(2)
  const { co, tron } = docThamSo(con)

  if (viec === 'danh-sach') {
    for (const [ma, p] of Object.entries(BANG.phong_cach)) {
      console.log(`${ma}: ${p.ten} [${p.nhom}] (gọi bằng: ${p.goi.join(', ')})\n  ${p.mo_ta}`)
      for (const [k, b] of Object.entries(p.boi_canh)) console.log(`  - ${k}: ${b.ten}`)
    }
    for (const k of ['moc', 'hanh_dong', 'may', 'su_kien', 'dang', 'mu', 'deo']) console.log(`${k}: ${BANG[k].join(', ')}`)
    for (const k of ['cho', 'mat_bang', 'phu', 'phu_de', 'the_loai', 'mo', 'ket']) console.log(`${k}: ${Object.keys(BANG[k]).join(', ')}`)
    console.log(`nhac: khong, ${Object.keys(KHONG_KHI).join(', ')}`)
  } else if (viec === 'goi-y') {
    goiY(co)
  } else if (viec === 'mau') {
    if (!co.ra) throw new Loi('Thiếu --ra <thư mục>')
    const ds = co['phong-cach'] ? co['phong-cach'].split(',').map(x => timPhongCach(x.trim())) : Object.keys(BANG.phong_cach)
    for (const ma of ds) {
      const bc = Object.keys(BANG.phong_cach[ma].boi_canh)
      for (const b of co['moi-boi-canh'] ? bc : bc.slice(0, 1)) await dung(kichBanMau(BANG, ma, b, co['mat-bang']), { co: co.co, ra: path.join(co.ra, `mau-${ma}-${b}.mp4`) })
    }
  } else if (viec === 'chia-canh') {
    if (!co.ra || !!co.srt === !!co.chu) throw new Loi('Cần --ra và đúng một trong --srt hoặc --chu')
    if (fs.existsSync(co.ra)) throw new Loi(`${co.ra} đã có, không ghi đè bản đã sửa. Đặt tên khác hoặc chuyển file cũ đi.`)
    const ma = timPhongCach(co['phong-cach']), pc = BANG.phong_cach[ma]
    const dong = co.srt ? docSrt(co.srt) : docChu(co.chu, co['ngon-ngu'] || 'vi')
    if (!dong.length) throw new Loi('File lời đọc trống hoặc sai định dạng')
    const kb = {
      phong_cach: ma, boi_canh: co['boi-canh'] || Object.keys(pc.boi_canh)[0], moc: co.moc || 'thap', fps: 30,
      nhan_vat: co['nhan-vat'] ? docJson(co['nhan-vat']) : pc.nhan_vat,
      mat_bang: co['mat-bang'] || 'vuc',
      phu_de: { kieu: co['phu-de'] || 'cum', mau: co['mau-nhan'] || '#ffd84d' },
      am: { nhac: co.nhac || pc.nhac, tieng_dong: !co['khong-tieng-dong'] },
    }
    if (co['nhan-vat-phu']) kb.nhan_vat_phu = co['nhan-vat-phu'] === 'mau' ? pc.phu_mau : docJson(co['nhan-vat-phu'])
    for (const [k, t] of [['the_loai', 'the-loai'], ['ngon_ngu', 'ngon-ngu'], ['mo', 'mo'], ['ket', 'ket']]) if (co[t]) kb[k] = co[t]
    if (co['do-dai']) kb.do_dai = +co['do-dai']
    kb.canh = phanCanh(chuanGio(dong), kb)
    if (co.stt) ganMocTu(kb.canh, co.stt)
    const kq = kiem(kb)
    fs.mkdirSync(path.dirname(path.resolve(co.ra)), { recursive: true })
    fs.writeFileSync(co.ra, JSON.stringify(kb, null, 2) + '\n')
    console.log(`Đã ghi ${co.ra}: ${kb.canh.length} cảnh nháp. Đọc lại từng câu và sửa cho đúng nghĩa trước khi dựng.`)
    if (co.chu) console.log('Nhắc: thời gian đang là ước lượng theo ngôn ngữ, chưa khớp giọng.')
    if (!co['nhan-vat']) console.log('Nhắc: đang dùng nhân vật mẫu. Kênh thật phải có nhân vật riêng.')
    kq.loi.forEach(x => console.log(`Cần sửa: ${x}`))
    kq.nhac.forEach(x => console.log(`Nhắc: ${x}`))
  } else if (viec === 'kiem') {
    if (!tron[0]) throw new Loi('Thiếu file cảnh')
    const kq = kiem(docJson(tron[0]))
    kq.nhac.forEach(x => console.log(`Nhắc: ${x}`))
    if (kq.loi.length) throw new Loi(kq.loi.join('\n'))
    console.log('File cảnh hợp lệ.')
  } else if (viec === 'dung') {
    if (!tron[0]) throw new Loi('Thiếu file cảnh')
    await dung(docJson(tron[0]), co)
  } else {
    throw new Loi('Lệnh: danh-sach | goi-y | mau | chia-canh | kiem | dung. Xem đầu file để biết tham số.')
  }
}

chinh().catch(e => {
  console.error(e instanceof Loi ? e.message : e.stack || e)
  process.exitCode = 1
})
