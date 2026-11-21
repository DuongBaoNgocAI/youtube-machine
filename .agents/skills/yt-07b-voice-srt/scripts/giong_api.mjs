#!/usr/bin/env node
// Tạo giọng đọc và SRT qua API cho bước 7b. Hỗ trợ ElevenLabs gốc và aicong.pro (API kiểu ElevenLabs). Chỉ cần Node 18+.
//
//   GIONG_KHOA=... node giong_api.mjs luu-khoa --nen elevenlabs|aicong
//   node giong_api.mjs kiem-tra [--nen ...]
//   node giong_api.mjs quet     [--nen ...] [--ngon-ngu en] [--gioi female] [--tuoi middle_aged] [--giong american]
//                               [--dung narrative_story] [--tim "deep calm"] [--so 30] [--json]
//   node giong_api.mjs them     --chu <public_owner_id> --id <voice_id> --ten "Tên giọng"
//   node giong_api.mjs uoc-tinh voice.txt [--toi-da 3000]
//   node giong_api.mjs tao      voice.txt --giong <voice_id> --out NNN-slug.mp3 [--model eleven_v3] [--ngon-ngu en]
//                               [--on-dinh 0.5] [--toc-do 1] [--toi-da 3000] [--lam-lai]
//   node giong_api.mjs srt      NNN-slug.mp3 --out NNN-slug.raw.srt [--ngon-ngu en] [--stt scribe_v1]
//
// luu-khoa : kiểm tra khóa rồi lưu vào .youtube-machine/khoa-giong.json ở gốc dự án (không đóng gói, không lên kho mã).
//            Khóa đọc từ biến GIONG_KHOA để không nằm trong lịch sử lệnh. Lưu nhiều nền tảng, nền lưu sau cùng là mặc định.
// kiem-tra : nền tảng đang dùng, khóa còn chạy không, ký tự còn lại trong tháng.
// quet     : giọng trong tài khoản và thư viện chung, kèm link mẫu nghe có sẵn (không tốn ký tự).
// them     : thêm giọng từ thư viện chung vào tài khoản (cần trước khi tạo giọng nếu API báo không thấy giọng).
// uoc-tinh : số ký tự sẽ tính tiền và số phần sẽ gửi.
// tao      : tạo MP3 cả video. Văn bản dài chia theo đoạn rồi nối lại thành một file. Đã có file thì bỏ qua.
// srt      : Speech to Text lấy mốc từng từ, ghi .raw.srt và .stt.json cạnh đó. Bước 4 của skill sửa chữ tiếp.
// Mỗi lần tạo giọng hoặc SRT ghi một dòng vào nhat-ky.jsonl cạnh file ra.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const NEN = {
  elevenlabs: { goc: 'https://api.elevenlabs.io/v1', ten: 'ElevenLabs' },
  aicong: { goc: 'https://api.aicong.pro/v1', ten: 'aicong.pro' },
};

const argv = process.argv.slice(2);
const lenh = argv[0];
const opt = (ten, mac) => { const i = argv.indexOf('--' + ten); return i > 0 ? argv[i + 1] : mac; };
const co = (ten) => argv.includes('--' + ten);
const thoat = (s) => { console.error(s); process.exit(1); };
const ngu = (ms) => new Promise((r) => setTimeout(r, ms));

// Gốc dự án là thư mục đầu tiên đi ngược lên từ chỗ chạy lệnh có AGENTS.md.
function gocDuAn() {
  let d = process.cwd();
  while (!fs.existsSync(path.join(d, 'AGENTS.md'))) {
    const tren = path.dirname(d);
    if (tren === d) return process.cwd();
    d = tren;
  }
  return d;
}
const FILE_KHOA = path.join(gocDuAn(), '.youtube-machine', 'khoa-giong.json');
const docKho = () => (fs.existsSync(FILE_KHOA) ? JSON.parse(fs.readFileSync(FILE_KHOA, 'utf8')) : {});
const che = (k) => (k.length > 8 ? k.slice(0, 4) + '…' + k.slice(-4) : '…');

function layNen() {
  const kho = docKho();
  const ten = opt('nen', kho.mac_dinh);
  if (!ten) thoat('Chưa có khóa API. Chạy: GIONG_KHOA=... node giong_api.mjs luu-khoa --nen elevenlabs|aicong');
  if (!NEN[ten]) thoat(`Nền tảng "${ten}" chưa hỗ trợ. Có: ${Object.keys(NEN).join(', ')}`);
  const khoa = process.env.GIONG_KHOA || kho[ten]?.khoa;
  if (!khoa) thoat(`Chưa có khóa cho ${NEN[ten].ten}. Chạy luu-khoa --nen ${ten}`);
  return { ten, ...NEN[ten], khoa };
}

async function goi(nen, duong, tuy = {}) {
  const res = await fetch(nen.goc + duong, { ...tuy, redirect: 'manual', headers: { 'xi-api-key': nen.khoa, ...(tuy.headers || {}) } });
  const loai = res.headers.get('content-type') || '';
  // aicong.pro chuyển hướng mục nó không có về trang chủ, coi như 404.
  if ((res.status >= 300 && res.status < 400) || loai.includes('text/html')) {
    const e = new Error(`${duong}: ${nen.ten} không có mục này`);
    e.status = 404;
    throw e;
  }
  if (!res.ok) {
    const chu = await res.text();
    const e = new Error(`${duong}: HTTP ${res.status} ${chu.slice(0, 300)}`);
    e.status = res.status;
    throw e;
  }
  if (loai.startsWith('audio/') || loai.includes('octet-stream')) return Buffer.from(await res.arrayBuffer());
  return res.json();
}

// aicong.pro chạy bất đồng bộ: trả id rồi phải hỏi lại tới khi xong. ElevenLabs gốc trả kết quả ngay.
async function choXong(nen, duong) {
  for (let i = 0; i < 300; i++) {
    const t = await goi(nen, duong);
    if (t.status === 'completed') return t;
    if (t.status === 'failed') throw new Error(`${duong}: ${t.error || t.detail_error}`);
    await ngu(3000);
  }
  throw new Error(`${duong}: quá 15 phút chưa xong`);
}

async function hanMuc(nen) {
  try {
    const s = await goi(nen, '/user/subscription');
    return { goi: s.tier, da_dung: s.character_count, toi_da: s.character_limit, con: s.character_limit - s.character_count,
      dat_lai: s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : null };
  } catch (e) {
    if (e.status === 401) throw e;
    return null;
  }
}

// aicong.pro không có danh sách giọng riêng của tài khoản, chỉ có thư viện chung.
async function giongTaiKhoan(nen) {
  try { return (await goi(nen, '/voices')).voices; } catch (e) {
    if (e.status === 401) throw e;
    return null;
  }
}

function ghiNhatKy(fileRa, dong) {
  fs.appendFileSync(path.join(path.dirname(fileRa), 'nhat-ky.jsonl'), JSON.stringify({ luc: new Date().toISOString(), ...dong }) + '\n');
}

// Chia văn bản theo đoạn (dòng trống), gộp đoạn cho tới gần giới hạn ký tự. Đoạn quá dài thì chia theo câu.
function chiaPhan(chu, toiDa) {
  const doan = chu.split(/\n\s*\n/).map((d) => d.trim()).filter(Boolean)
    .flatMap((d) => (d.length <= toiDa ? [d] : d.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g).map((c) => c.trim())));
  const phan = [];
  let hien = '';
  for (const d of doan) {
    if (d.length > toiDa) thoat(`Có một câu dài ${d.length} ký tự, vượt giới hạn ${toiDa}. Ngắt câu ở bước 7 rồi chạy lại.`);
    if (hien && hien.length + 2 + d.length > toiDa) { phan.push(hien); hien = ''; }
    hien = hien ? hien + '\n\n' + d : d;
  }
  if (hien) phan.push(hien);
  return phan;
}

const docLoi = (f) => fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, '').trim();

const moc = (giay) => {
  const ms = Math.round(giay * 1000);
  const p = (n, d = 2) => String(n).padStart(d, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

// Mỗi dòng SRT kết thúc ở dấu câu, dòng quá dài thì ngắt ở dấu phẩy hoặc ở chữ thứ 16. normalize ở bước 4 chỉnh tiếp.
function taoSrt(tu) {
  const dong = [];
  let hien = [];
  const xong = () => { if (hien.length) dong.push(hien); hien = []; };
  for (const w of tu.filter((x) => x.type === 'word')) {
    hien.push(w);
    if (/[.?!…]$/.test(w.text) || (/,$/.test(w.text) && hien.length >= 10) || hien.length >= 16) xong();
  }
  xong();
  return dong.map((d, i) => `${i + 1}\n${moc(d[0].start)} --> ${moc(d[d.length - 1].end)}\n${d.map((w) => w.text).join(' ')}\n`).join('\n');
}

function noiMp3(cacFile, ra) {
  const ds = ra + '.ds.txt';
  fs.writeFileSync(ds, cacFile.map((f) => `file '${path.resolve(f).replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', ds, '-c', 'copy', ra], { encoding: 'utf8' });
  fs.rmSync(ds, { force: true });
  // Không có ffmpeg thì nối thẳng các khung MP3, vẫn phát được vì cùng định dạng.
  if (r.status !== 0) fs.writeFileSync(ra, Buffer.concat(cacFile.map((f) => fs.readFileSync(f))));
}

const lam = {
  async 'luu-khoa'() {
    const ten = opt('nen');
    const khoa = (process.env.GIONG_KHOA || '').trim();
    if (!NEN[ten]) thoat(`Cần --nen ${Object.keys(NEN).join('|')}`);
    if (!khoa) thoat('Đặt khóa vào biến GIONG_KHOA trước khi chạy.');
    const nen = { ten, ...NEN[ten], khoa };
    try { await goi(nen, '/models'); } catch (e) {
      thoat(e.status === 401 ? `${nen.ten} từ chối khóa này (401). Kiểm tra lại đã chép đủ khóa và đúng nền tảng chưa.` : `Không gọi được ${nen.ten}: ${e.message}`);
    }
    const kho = docKho();
    kho[ten] = { khoa, luu_luc: new Date().toISOString().slice(0, 10) };
    kho.mac_dinh = ten;
    fs.mkdirSync(path.dirname(FILE_KHOA), { recursive: true });
    fs.writeFileSync(FILE_KHOA, JSON.stringify(kho, null, 2));
    console.log(`Đã lưu khóa ${nen.ten} (${che(khoa)}) vào ${path.relative(gocDuAn(), FILE_KHOA)}. Mặc định: ${ten}.`);
    const h = await hanMuc(nen);
    if (h) console.log(`Gói ${h.goi}: còn ${h.con.toLocaleString('vi')} / ${h.toi_da.toLocaleString('vi')} ký tự${h.dat_lai ? `, đặt lại ngày ${h.dat_lai}` : ''}.`);
  },

  async 'kiem-tra'() {
    const nen = layNen();
    const h = await hanMuc(nen);
    await goi(nen, '/models');
    const voices = await giongTaiKhoan(nen);
    console.log(`Nền tảng: ${nen.ten} | Khóa: ${che(nen.khoa)} | Khóa còn chạy${voices ? ` | Giọng trong tài khoản: ${voices.length}` : ''}`);
    console.log(h ? `Gói ${h.goi}: còn ${h.con.toLocaleString('vi')} / ${h.toi_da.toLocaleString('vi')} ký tự${h.dat_lai ? `, đặt lại ngày ${h.dat_lai}` : ''}`
      : 'Không đọc được hạn mức qua API, xem số dư trên trang của nền tảng.');
  },

  async quet() {
    const nen = layNen();
    const so = +opt('so', 30);
    const loc = { language: opt('ngon-ngu'), gender: opt('gioi'), age: opt('tuoi'), accent: opt('giong'), use_cases: opt('dung'), search: opt('tim') };
    const ketQua = [];
    for (const v of (await giongTaiKhoan(nen)) || []) {
      const l = v.labels || {};
      if (loc.gender && l.gender && l.gender !== loc.gender) continue;
      if (loc.accent && l.accent && !l.accent.includes(loc.accent)) continue;
      ketQua.push({ nguon: 'tai-khoan', voice_id: v.voice_id, ten: v.name, gioi: l.gender, tuoi: l.age, giong: l.accent,
        dung: l.use_case || l.use_cases, mo_ta: l.description || v.description, mau: v.preview_url });
    }
    const q = new URLSearchParams({ page_size: String(Math.min(so, 100)), sort: 'usage_character_count_1y' });
    for (const [k, v] of Object.entries(loc)) if (v) q.set(k, v);
    try {
      const { voices: chung } = await goi(nen, '/shared-voices?' + q);
      for (const v of chung) {
        // Mẫu nghe đúng ngôn ngữ kênh nếu giọng có, không thì mẫu chung.
        const mauNgu = (v.verified_languages || []).find((x) => x.language === loc.language && x.preview_url);
        ketQua.push({ nguon: 'thu-vien', voice_id: v.voice_id, chu: v.public_owner_id, ten: v.name, gioi: v.gender, tuoi: v.age,
          giong: v.accent, dung: v.use_case, mo_ta: (v.description || '').slice(0, 160), mau: mauNgu?.preview_url || v.preview_url,
          luot_dung_1nam: v.usage_character_count_1y, mien_phi: v.free_users_allowed });
      }
    } catch (e) {
      if (e.status === 401) throw e;
      console.error(`(${nen.ten} không cho tìm thư viện chung: ${e.message.slice(0, 120)}. Chỉ có giọng trong tài khoản.)`);
    }
    if (co('json')) return console.log(JSON.stringify(ketQua, null, 1));
    console.log(`${ketQua.length} giọng (${nen.ten})`);
    for (const g of ketQua) {
      console.log(`- [${g.nguon}] ${g.ten} | ${[g.gioi, g.tuoi, g.giong, g.dung].filter(Boolean).join(', ')} | id ${g.voice_id}${g.chu ? ` | chủ ${g.chu}` : ''}`);
      if (g.mo_ta) console.log(`    ${g.mo_ta.replace(/\s+/g, ' ')}`);
      if (g.mau) console.log(`    nghe: ${g.mau}`);
    }
  },

  async them() {
    const nen = layNen();
    const chu = opt('chu'), id = opt('id'), ten = opt('ten');
    if (!chu || !id || !ten) thoat('Cần --chu <public_owner_id> --id <voice_id> --ten "Tên"');
    const r = await goi(nen, `/voices/add/${chu}/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ new_name: ten }) });
    console.log(`Đã thêm "${ten}" vào tài khoản. voice_id dùng để tạo giọng: ${r.voice_id}`);
  },

  async 'uoc-tinh'() {
    const f = argv[1];
    if (!f) thoat('Cần file voice.txt');
    const chu = docLoi(f);
    const phan = chiaPhan(chu, +opt('toi-da', 3000));
    console.log(`Ký tự tính tiền: ${chu.length.toLocaleString('vi')} | Số phần gửi: ${phan.length}`);
    const nen = opt('nen') || docKho().mac_dinh ? layNen() : null;
    const h = nen && (await hanMuc(nen));
    if (h) console.log(`${nen.ten} còn ${h.con.toLocaleString('vi')} ký tự${h.con < chu.length ? ' — KHÔNG ĐỦ cho video này' : ''}.`);
  },

  async tao() {
    const nen = layNen();
    const f = argv[1], ra = opt('out'), giong = opt('giong');
    if (!f || !ra || !giong) thoat('Cần voice.txt --giong <voice_id> --out file.mp3');
    if (fs.existsSync(ra) && !co('lam-lai')) return console.log(`${ra} đã có, bỏ qua (thêm --lam-lai để tạo lại, sẽ tốn ký tự).`);
    const model = opt('model', 'eleven_v3');
    const phan = chiaPhan(docLoi(f), +opt('toi-da', 3000));
    const caiDat = { stability: +opt('on-dinh', 0.5), similarity_boost: 0.75, speed: +opt('toc-do', 1) };
    const tam = ra + '.phan';
    fs.mkdirSync(tam, { recursive: true });
    const cacFile = [];
    let kyTu = 0;
    for (let i = 0; i < phan.length; i++) {
      const fp = path.join(tam, `${String(i + 1).padStart(3, '0')}.mp3`);
      cacFile.push(fp);
      // Phần đã tạo ở lần chạy trước bị ngắt thì giữ lại, không tốn ký tự lần nữa.
      if (fs.existsSync(fp) && !co('lam-lai')) continue;
      const than = { text: phan[i], model_id: model, voice_settings: caiDat };
      if (opt('ngon-ngu')) than.language_code = opt('ngon-ngu');
      let r = await goi(nen, `/text-to-speech/${giong}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(than),
      }).catch((e) => {
        if (e.status === 404 || /voice_not_found/.test(e.message)) thoat(`Không thấy giọng ${giong} trong tài khoản. Thêm bằng lệnh "them" rồi chạy lại.`);
        throw e;
      });
      if (!Buffer.isBuffer(r)) {
        const id = r.id;
        const t = await choXong(nen, `/history/${id}`);
        const res = await fetch(t.result.audio_url, { headers: { 'xi-api-key': nen.khoa } });
        if (!res.ok) throw new Error(`Tải MP3: HTTP ${res.status}`);
        r = Buffer.from(await res.arrayBuffer());
        ghiNhatKy(ra, { buoc: 'giong-phan', phan: i + 1, id, tin_dung: t.credits_deducted });
      }
      fs.writeFileSync(fp, r);
      kyTu += phan[i].length;
      console.log(`Phần ${i + 1}/${phan.length} xong (${phan[i].length} ký tự)`);
    }
    if (cacFile.length === 1) fs.copyFileSync(cacFile[0], ra);
    else noiMp3(cacFile, ra);
    fs.rmSync(tam, { recursive: true, force: true });
    ghiNhatKy(ra, { buoc: 'giong', nen: nen.ten, voice_id: giong, model, cai_dat: caiDat, phan: phan.length, ky_tu: kyTu });
    console.log(`Xong: ${ra} (${phan.length} phần, ${kyTu.toLocaleString('vi')} ký tự lần này)`);
  },

  async srt() {
    const nen = layNen();
    const f = argv[1], ra = opt('out');
    if (!f || !ra) thoat('Cần file.mp3 --out file.raw.srt');
    if (fs.existsSync(ra) && !co('lam-lai')) return console.log(`${ra} đã có, bỏ qua.`);
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(f)], { type: 'audio/mpeg' }), path.basename(f));
    form.append('model_id', opt('stt', 'scribe_v1'));
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');
    if (opt('ngon-ngu')) form.append('language_code', opt('ngon-ngu'));
    let kq = await goi(nen, '/speech-to-text', { method: 'POST', body: form });
    let tinDung;
    if (kq.task_id) {
      const t = await choXong(nen, `/speech-to-text/${kq.task_id}`);
      kq = t.result;
      tinDung = t.credits_deducted;
    }
    fs.writeFileSync(ra.replace(/(\.raw)?\.srt$/, '') + '.stt.json', JSON.stringify(kq, null, 1));
    fs.writeFileSync(ra, taoSrt(kq.words));
    const giay = kq.words.length ? kq.words[kq.words.length - 1].end : 0;
    ghiNhatKy(ra, { buoc: 'srt', nen: nen.ten, giay, tin_dung: tinDung });
    console.log(`Xong: ${ra} (${Math.round(giay)} giây âm thanh)`);
  },
};

if (!lam[lenh]) thoat('Cách dùng: node giong_api.mjs <luu-khoa|kiem-tra|quet|them|uoc-tinh|tao|srt> ... (xem đầu file)');
lam[lenh]().catch((e) => thoat(e.status === 401 ? 'Khóa API bị từ chối (401). Lưu lại khóa bằng luu-khoa.' : e.message));
