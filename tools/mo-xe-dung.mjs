// Mổ xẻ cách dựng một video đối thủ: điểm cắt, nhịp theo đoạn, tờ khung có mốc giờ, lời gắn theo cảnh, nhịp âm thanh.
//   node tools/mo-xe-dung.mjs <link YouTube | file video> --ra <thư mục> [--den 180] [--nguong 0.15] [--loi phu-de.srt] [--giu-video]
// Link: cần yt-dlp. Video tải vào thư mục tạm, xong việc tự xóa, chỉ giữ ảnh khung và lời. Chỉ để phân tích, không đăng lại.
// Ra: so-lieu.md, mo-xe-dung.json, loi.txt, to-khung/to-NN.jpg (30 cảnh mỗi tờ), khung/c_NNNN.jpg (một khung giữa mỗi cảnh)
// Máy chỉ đo được điểm cắt và âm lượng. Phần nhìn (cỡ cảnh, chữ, chuyển cảnh, cấu trúc) trợ lý phải xem tờ khung thật rồi mới viết.
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const GOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vao = process.argv.slice(2);
const nguon = vao[0];
const lay = (k, md) => { const i = vao.indexOf("--" + k); return i >= 0 ? vao[i + 1] : md; };
const co = (k) => vao.includes("--" + k);
const thuMuc = lay("ra");
const den = lay("den") ? Number(lay("den")) : null;
const nguong = Number(lay("nguong", 0.15));
const loiNgoai = lay("loi");
if (!nguon || !thuMuc || nguon.startsWith("--")) {
  console.error("Dùng: node tools/mo-xe-dung.mjs <link | file video> --ra <thư mục> [--den 180] [--nguong 0.15] [--loi phu-de.srt] [--giu-video]");
  process.exit(1);
}

const chay = (lenh, thamSo, them = {}) => spawnSync(lenh, thamSo, { encoding: "utf8", maxBuffer: 1 << 30, cwd: GOC, ...them });
const coLenh = (lenh) => !chay(lenh, ["--version"]).error;
const gio = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const buoc = (s) => console.log(`- ${s}`);
for (const l of ["ffmpeg", "ffprobe"]) if (!chay(l, ["-version"]).stdout) { console.error(`Máy chưa có ${l}. Chạy node tools/do-may.mjs để xem cách cài.`); process.exit(1); }

class Dung extends Error {}
const laLink = /^https?:\/\//i.test(nguon);
const tam = fs.mkdtempSync(path.join(os.tmpdir(), "mo-xe-dung-"));
fs.mkdirSync(path.join(thuMuc, "to-khung"), { recursive: true });
fs.mkdirSync(path.join(thuMuc, "khung"), { recursive: true });

try {
  // ---------- 1. Lấy video và lời ----------
  let video = nguon;
  let tt = { nguon };
  let fileLoi = loiNgoai || null;
  if (laLink) {
    if (!coLenh("yt-dlp")) { throw new Dung("Máy chưa có yt-dlp. Cài: winget install yt-dlp.yt-dlp (Windows) hoặc brew install yt-dlp (Mac). Hoặc tải video về rồi đưa đường dẫn file."); }
    buoc("Đọc thông tin video");
    const j = chay("yt-dlp", ["-J", "--no-playlist", nguon]);
    if (j.status !== 0) { throw new Dung("yt-dlp không đọc được link:\n" + (j.stderr || "").split("\n").slice(-4).join("\n")); }
    const info = JSON.parse(j.stdout);
    tt = { nguon, tieu_de: info.title, kenh: info.channel, ngay_dang: info.upload_date, luot_xem: info.view_count, thich: info.like_count, binh_luan: info.comment_count, dai_giay: info.duration, ngon_ngu: info.language || null };
    // Tải hình trước, lời sau, tách riêng: YouTube chặn tải phụ đề (lỗi 429) thì video vẫn về.
    buoc("Tải video tạm (tối đa 720p, đủ để nhìn bố cục)");
    const t = chay("yt-dlp", ["-f", "bv*[height<=720]+ba/b[height<=720]", "--merge-output-format", "mp4", "--no-playlist", "-o", path.join(tam, "video.%(ext)s"), nguon]);
    video = fs.readdirSync(tam).map((f) => path.join(tam, f)).find((f) => /\.(mp4|mkv|webm)$/i.test(f));
    if (!video) { throw new Dung("Không tải được video:\n" + (t.stderr || "").split("\n").slice(-4).join("\n")); }
    if (!fileLoi) {
      const nn = tt.ngon_ngu || "en";
      const tay = Object.keys(info.subtitles || {}).find((k) => k === nn || k.startsWith(nn + "-"));
      const tuDong = Object.keys(info.automatic_captions || {}).find((k) => k === `${nn}-orig`) || Object.keys(info.automatic_captions || {}).find((k) => k === nn);
      const ma = tay || tuDong;
      if (ma) {
        buoc(`Tải lời (${tay ? "phụ đề người làm" : "phụ đề tự động"}, ${ma})`);
        chay("yt-dlp", ["--skip-download", "--no-playlist", tay ? "--write-subs" : "--write-auto-subs", "--sub-langs", ma, "--sub-format", "vtt", "-o", path.join(tam, "loi.%(ext)s"), nguon]);
        fileLoi = fs.readdirSync(tam).map((f) => path.join(tam, f)).find((f) => /\.vtt$/i.test(f)) || null;
        tt.loai_loi = tay ? "phụ đề người làm" : "phụ đề tự động";
        if (!fileLoi) buoc("Không tải được lời, phân tích tiếp không có lời");
      } else buoc("Video không có phụ đề, phân tích tiếp không có lời");
    }
  } else if (!fs.existsSync(nguon)) { throw new Dung(`Không thấy ${nguon}`); }

  const pr = JSON.parse(chay("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", video]).stdout);
  const hinh = pr.streams.find((s) => s.codec_type === "video");
  const coTieng = pr.streams.some((s) => s.codec_type === "audio");
  const daiGoc = Number(pr.format.duration);
  const dai = den ? Math.min(den, daiGoc) : daiGoc;
  const doc = hinh.height > hinh.width;
  const catDoan = den ? ["-t", String(dai)] : [];
  Object.assign(tt, { rong: hinh.width, cao: hinh.height, dai_giay: Math.round(daiGoc), phan_tich_toi_giay: Math.round(dai) });

  // ---------- 2. Điểm cắt: một lượt giải mã, lấy điểm khác biệt của mọi khung ----------
  buoc("Dò điểm cắt");
  const d = chay("ffmpeg", ["-hide_banner", "-nostats", ...catDoan, "-i", video, "-an", "-vf", "scale=320:-2,select='gte(scene\\,0)',metadata=mode=print:file=-", "-f", "null", "-"]);
  const khungTg = [];
  const diem = [];
  for (const dong of (d.stdout || "").split(/\r?\n/)) {
    const a = dong.match(/^frame:(\d+)\s+pts:\S+\s+pts_time:([\d.]+)/);
    if (a) { khungTg[Number(a[1])] = Number(a[2]); continue; }
    const b = dong.match(/lavfi\.scene_score=([\d.]+)/);
    if (b) diem[khungTg.length - 1] = Number(b[1]);
  }
  if (!khungTg.length) { throw new Dung("ffmpeg không đọc được khung hình:\n" + (d.stderr || "").split("\n").slice(-5).join("\n")); }
  // Nháy sáng hay chớp trắng tạo hai điểm sát nhau: cách nhau dưới 0,2 giây thì tính một.
  const catTai = (ng) => {
    const ds = [0];
    for (let i = 1; i < khungTg.length; i++) if ((diem[i] ?? 0) > ng && khungTg[i] - khungTg[ds[ds.length - 1]] >= 0.2) ds.push(i);
    return ds;
  };
  const soSanh = [0.1, 0.15, 0.28].map((ng) => { const n = catTai(ng).length; return { nguong: ng, so_canh: n, cat_moi_phut: +(n / dai * 60).toFixed(1), trung_binh_giay: +(dai / n).toFixed(2) }; });
  const dau = catTai(nguong);
  const canh = dau.map((k, i) => {
    const kSau = i + 1 < dau.length ? dau[i + 1] : khungTg.length;
    const tu = khungTg[k];
    const toi = i + 1 < dau.length ? khungTg[kSau] : dai;
    return { so: i + 1, tu: +tu.toFixed(2), dai: +(toi - tu).toFixed(2), khung_giua: Math.floor((k + kSau - 1) / 2), loi: "" };
  });
  const dais = canh.map((c) => c.dai).sort((a, b) => a - b);
  const trungVi = dais[Math.floor(dais.length / 2)];

  // ---------- 3. Nhịp theo đoạn ----------
  const moc = [0, 15, 30, 60];
  for (let m = 120; m < dai; m += 60) moc.push(m);
  moc.push(dai);
  const nhip = [];
  for (let i = 0; i + 1 < moc.length; i++) {
    const [a, b] = [moc[i], moc[i + 1]];
    if (b - a < 5) continue;
    const n = canh.filter((c) => c.tu >= a && c.tu < b).length;
    nhip.push({ tu: a, den: +b.toFixed(1), so_canh: n, cat_moi_phut: +(n / (b - a) * 60).toFixed(1) });
  }

  // ---------- 4. Tờ khung và khung lẻ: một lượt, chọn đúng khung giữa mỗi cảnh ----------
  buoc(`Xuất ${canh.length} khung và tờ khung`);
  // ffmpeg không nhận biểu thức chọn quá dài, nên mỗi tờ một lượt, chỉ giải mã đoạn thời gian của tờ đó.
  // Giữ mốc giờ gốc (-copyts) để chọn đúng khung theo thời điểm đã đo ở bước 2.
  const [o, cot, hang] = doc ? [[180, 320], 10, 3] : [[320, 180], 6, 5];
  const moiTo = cot * hang;
  for (let p = 0; p * moiTo < canh.length; p++) {
    const nhom = canh.slice(p * moiTo, (p + 1) * moiTo);
    const tg = nhom.map((c) => khungTg[c.khung_giua]);
    const batDau = Math.max(0, tg[0] - 2);
    const chon = tg.map((t) => `lt(abs(t-${t.toFixed(4)})\\,0.004)`).join("+");
    const chu = `drawtext=fontfile=tools/blender/fonts/Anton-Regular.ttf:text='#%{eif\\:n+${p * moiTo + 1}\\:d}  %{pts\\:hms}':fontsize=20:fontcolor=yellow:box=1:boxcolor=black@0.75:boxborderw=4:x=4:y=4`;
    const do_thi = `[0:v]select='${chon}',split[k][s];[k]scale=${doc ? -2 : 640}:${doc ? 640 : -2}[ko];[s]scale=${o[0]}:${o[1]}:force_original_aspect_ratio=decrease,pad=${o[0]}:${o[1]}:(ow-iw)/2:(oh-ih)/2,${chu},tile=${cot}x${hang}[t]`;
    const x = chay("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-copyts", "-ss", batDau.toFixed(3), "-to", (tg[tg.length - 1] + 0.5).toFixed(3), "-i", path.resolve(video),
      "-filter_complex", do_thi,
      "-map", "[ko]", "-fps_mode", "passthrough", "-q:v", "4", "-start_number", String(p * moiTo + 1), path.resolve(thuMuc, "khung", "c_%04d.jpg"),
      "-map", "[t]", "-fps_mode", "passthrough", "-q:v", "4", "-frames:v", "1", path.resolve(thuMuc, "to-khung", `to-${String(p + 1).padStart(2, "0")}.jpg`)]);
    if (x.status !== 0) { throw new Dung(`Lỗi xuất tờ khung ${p + 1}:\n` + x.stderr); }
  }

  // ---------- 5. Lời: bỏ dòng lặp của phụ đề tự động, gắn vào cảnh ----------
  const doanLoi = [];
  if (fileLoi) {
    const vb = fs.readFileSync(fileLoi, "utf8").replace(/\r/g, "");
    const giay = (s) => { const p = s.replace(",", ".").split(":").map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };
    let truoc = "";
    for (const khoi of vb.split(/\n\n+/)) {
      const m = khoi.match(/([\d:.,]+)\s*-->\s*([\d:.,]+)[^\n]*\n([\s\S]*)/);
      if (!m) continue;
      for (const dong of m[3].split("\n")) {
        const sach = dong.replace(/<[^>]+>/g, "").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
        if (!sach || sach === truoc) continue;
        truoc = sach;
        doanLoi.push({ tu: +giay(m[1]).toFixed(2), chu: sach });
      }
    }
    // Phụ đề tự động lặp dòng cũ ở đầu khối sau: bỏ những dòng đã có.
    const daCo = new Set();
    for (let i = doanLoi.length - 1; i >= 0; i--) { if (daCo.has(doanLoi[i].chu)) doanLoi.splice(i, 1); else daCo.add(doanLoi[i].chu); }
    doanLoi.sort((a, b) => a.tu - b.tu);
    while (doanLoi.length && doanLoi[doanLoi.length - 1].tu > dai) doanLoi.pop();
    for (const dl of doanLoi) {
      const c = [...canh].reverse().find((k) => k.tu <= dl.tu + 0.05);
      if (c) c.loi = (c.loi + " " + dl.chu).trim();
    }
    fs.writeFileSync(path.join(thuMuc, "loi.txt"), doanLoi.map((l) => `${gio(l.tu)}  ${l.chu}`).join("\n") + "\n");
  }

  // ---------- 6. Âm thanh: âm lượng, khoảng lặng, cú dội ----------
  let am = null;
  if (coTieng) {
    buoc("Đo âm lượng, khoảng lặng, cú dội");
    // Âm lượng tức thời (M, 10 lần mỗi giây) đọc qua metadata ra stdout; khoảng lặng và tổng LUFS ra stderr.
    const a = chay("ffmpeg", ["-hide_banner", "-nostats", ...catDoan, "-i", video, "-vn", "-af", "silencedetect=n=-40dB:d=0.3,ebur128=metadata=1,ametadata=mode=print:key=lavfi.r128.M:file=-", "-f", "null", "-"]);
    const e = a.stderr || "";
    const M = [...(a.stdout || "").matchAll(/pts_time:([\d.]+)\s+lavfi\.r128\.M=(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    const I = Number((e.match(/I:\s*(-?[\d.]+) LUFS\s*\n\s*Threshold/) || e.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+)/) || [])[1]);
    const lang = [...e.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map((m) => ({ tu: +Number(m[1]).toFixed(2), den: +Number(m[2]).toFixed(2) }));
    // Cú dội: to hơn trung vị 2 giây trước đó từ 6 LU và to hơn mức chung cả bài 3 LU.
    // So với trung vị chứ không so với mức thấp nhất, để chỗ ngắt giữa hai từ của lời đọc không bị tính.
    // M đo cửa sổ 0,4 giây kết thúc ở t, nên lùi 0,2 giây cho gần lúc tiếng bắt đầu.
    const chung = isNaN(I) ? -16 : I;
    const doi = [];
    for (let i = 20; i < M.length; i++) {
      const truoc = M.slice(i - 20, i).map((m) => m[1]).sort((p, q) => p - q);
      const trungViTruoc = truoc[10];
      const t = Math.max(0, M[i][0] - 0.2);
      if (M[i][1] >= trungViTruoc + 6 && M[i][1] >= chung + 3 && (!doi.length || t - doi[doi.length - 1] > 1)) doi.push(+t.toFixed(2));
    }
    const gan = (t, ds, r) => ds.some((x) => Math.abs(x - t) <= r);
    const catKhongTinhDau = canh.slice(1).map((c) => c.tu);
    const trungDoi = doi.filter((t) => gan(t, catKhongTinhDau, 0.3)).length;
    // Trùng ngẫu nhiên: phần thời lượng nằm trong ±0,3 giây quanh một điểm cắt.
    const ngauNhien = Math.min(1, catKhongTinhDau.length * 0.6 / dai);
    const trungLang = catKhongTinhDau.filter((t) => lang.some((l) => t >= l.tu - 0.3 && t <= l.den + 0.3)).length;
    const theo5 = [];
    for (let s = 0; s < dai; s += 5) { const v = M.filter((m) => m[0] > s && m[0] <= s + 5 && m[1] > -70).map((m) => m[1]); theo5.push(v.length ? +(v.reduce((p, q) => p + q, 0) / v.length).toFixed(1) : null); }
    am = { lufs_ca_bai: isNaN(I) ? null : I, khoang_lang: lang, cu_doi: doi, cu_doi_trung_cat: trungDoi, trung_ngau_nhien: +ngauNhien.toFixed(3), cat_trung_khoang_lang: trungLang, so_cat: catKhongTinhDau.length, am_luong_moi_5_giay: theo5 };
  }

  // ---------- 7. Ghi kết quả ----------
  const dl = { thong_tin: tt, nguong, so_sanh_nguong: soSanh, trung_vi_giay: trungVi, nhip, canh: canh.map(({ khung_giua, ...c }) => c), am_thanh: am, so_to_khung: Math.ceil(canh.length / (cot * hang)) };
  fs.writeFileSync(path.join(thuMuc, "mo-xe-dung.json"), JSON.stringify(dl, null, 2));

  const pt = (a, b) => (b ? `${Math.round(a / b * 100)}%` : "-");
  const dai10 = [...canh].sort((a, b) => b.dai - a.dai).slice(0, 10);
  const md = [];
  md.push(`# Số liệu dựng: ${tt.tieu_de || path.basename(nguon)}`, "");
  if (tt.kenh) md.push(`- Kênh: ${tt.kenh}`, `- Link: ${nguon}`, `- Ngày đăng: ${tt.ngay_dang || "?"}, lượt xem lúc đo: ${tt.luot_xem ?? "?"}, thích: ${tt.thich ?? "?"}, bình luận: ${tt.binh_luan ?? "?"}`);
  md.push(`- Khung: ${tt.rong}x${tt.cao}${doc ? " (dọc)" : ""}, dài ${gio(daiGoc)}${den ? `, chỉ phân tích tới ${gio(dai)}` : ""}`);
  md.push(`- Lời: ${doanLoi.length ? `${tt.loai_loi || "file " + path.basename(fileLoi)}, xem loi.txt` : "không có"}`);
  md.push(`- Máy đo ngày ${new Date().toISOString().slice(0, 10)} bằng tools/mo-xe-dung.mjs. Phần nhìn chưa có: trợ lý phải xem to-khung/ rồi mới viết.`, "");
  md.push("## Nhịp cắt", "", "| Ngưỡng | Số cảnh | Cắt mỗi phút | Trung bình một cảnh |", "|---|---|---|---|");
  for (const s of soSanh) md.push(`| ${s.nguong}${s.nguong === nguong ? " (dùng)" : ""} | ${s.so_canh} | ${s.cat_moi_phut} | ${s.trung_binh_giay} giây |`);
  md.push("", `Trung vị một cảnh: ${trungVi} giây. Ngưỡng 0.28 thường bỏ sót chuyển cảnh mềm và cảnh tối; 0.10 có thể đếm cả chuyển động trong khung. Số thật thường gần 0.15.`, "");
  md.push("| Đoạn | Số cảnh | Cắt mỗi phút |", "|---|---|---|");
  for (const n of nhip) md.push(`| ${gio(n.tu)} – ${gio(n.den)} | ${n.so_canh} | ${n.cat_moi_phut} |`);
  md.push("", "## 10 cảnh dài nhất", "", "Cảnh dài có thể là cảnh giữ yên có chủ ý, hoặc có chuyển động máy, chuyển cảnh mềm mà máy không bắt. Xem khung trước khi kết luận.", "");
  md.push("| # | Từ | Dài |", "|---|---|---|");
  for (const c of dai10) md.push(`| ${c.so} | ${gio(c.tu)} | ${c.dai} giây |`);
  if (am) {
    md.push("", "## Âm thanh (máy đo, không phải nghe)", "");
    md.push(`- Âm lượng cả bài: ${am.lufs_ca_bai ?? "?"} LUFS`);
    md.push(`- Khoảng lặng dưới -40 dB từ 0,3 giây: ${am.khoang_lang.length} lần${am.khoang_lang.length ? ": " + am.khoang_lang.slice(0, 15).map((l) => gio(l.tu)).join(", ") + (am.khoang_lang.length > 15 ? "…" : "") : ""}`);
    md.push(`- Cú dội (to hơn 2 giây trước từ 6 LU và to hơn mức chung 3 LU): ${am.cu_doi.length} lần${am.cu_doi.length ? ": " + am.cu_doi.slice(0, 25).map(gio).join(", ") + (am.cu_doi.length > 25 ? "…" : "") : ""}`);
    md.push(`- Cú dội rơi đúng điểm cắt (±0,3 giây): ${am.cu_doi_trung_cat}/${am.cu_doi.length} (${pt(am.cu_doi_trung_cat, am.cu_doi.length)}). Nếu ngẫu nhiên chỉ khoảng ${Math.round(am.trung_ngau_nhien * 100)}%. Cao hơn hẳn mức ngẫu nhiên nghĩa là kênh cố ý đặt tiếng động mạnh vào chỗ cắt.`);
    md.push(`- Điểm cắt nằm trong khoảng lặng: ${am.cat_trung_khoang_lang}/${am.so_cat}`);
    md.push("- Máy không phân biệt nhạc, lời hay tiếng động. Cú dội và khoảng lặng chỉ là chỗ nên xem lại hình.");
  }
  md.push("", "## Bảng cảnh", "", `Tờ khung: to-khung/to-01.jpg … to-${String(dl.so_to_khung).padStart(2, "0")}.jpg, mỗi ô ghi số cảnh và mốc giờ. Khung rõ hơn ở khung/c_NNNN.jpg.`, "");
  md.push("| # | Từ | Dài | Lời trong cảnh |", "|---|---|---|---|");
  for (const c of canh) md.push(`| ${c.so} | ${gio(c.tu)} | ${c.dai} | ${(c.loi.length > 110 ? c.loi.slice(0, 107) + "…" : c.loi).replace(/\|/g, "/")} |`);
  fs.writeFileSync(path.join(thuMuc, "so-lieu.md"), md.join("\n") + "\n");

  if (co("giu-video") && laLink) fs.copyFileSync(video, path.join(thuMuc, "video" + path.extname(video)));
  const s15 = soSanh.find((s) => s.nguong === nguong) || soSanh[1];
  console.log(`\nXong: ${canh.length} cảnh, ${s15.cat_moi_phut} lần cắt mỗi phút, ${dl.so_to_khung} tờ khung, ${doanLoi.length} dòng lời.`);
  console.log(`Kết quả ở ${thuMuc}. Đọc so-lieu.md rồi xem to-khung/ theo .claude/skills/yt-02-competitor-research/references/mo-xe-dung.md.`);
} catch (e) {
  if (!(e instanceof Dung)) throw e;
  console.error(e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(tam, { recursive: true, force: true });
}
