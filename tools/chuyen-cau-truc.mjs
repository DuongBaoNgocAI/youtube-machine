// Chuyển một kênh từ cấu trúc cũ (scripts, voice, seo, export...) sang cấu trúc mới (videos/NNN-slug/1-kich-ban...).
//   node tools/chuyen-cau-truc.mjs <kenh>              chỉ in kế hoạch ra channels/<kenh>/_ke-hoach-chuyen.md
//   node tools/chuyen-cau-truc.mjs <kenh> --thuc-hien  chuyển file, sửa đường dẫn trong file chữ và file .blend
//   node tools/chuyen-cau-truc.mjs <kenh> --hoan-tac   trả lại như trước khi chuyển
//   node tools/chuyen-cau-truc.mjs --goc [--thuc-hien | --hoan-tac]   gom file lẻ trong channels/ và gốc dự án vào channels/_chua-phan-loai
// Không xóa file nào. File không rõ thuộc đâu vào _chua-phan-loai/, giữ nguyên đường dẫn cũ bên trong.
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const GOC = "channels";
const thucHien = process.argv.includes("--thuc-hien");
const hoanTac = process.argv.includes("--hoan-tac");
const laGoc = process.argv.includes("--goc");
const kenh = process.argv.slice(2).find((a) => !a.startsWith("--"));

const CHUA = "_chua-phan-loai";
const NHAT = "_chuyen-cau-truc";
const CHU = /\.(md|txt|json|html|sh|js|mjs|py|csv|pls)$/i;

function dung(loi) {
  console.error(loi);
  process.exit(1);
}

function mb(b) {
  return b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1024 ** 2))} MB`;
}

function dungLuong(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((t, m) => t + dungLuong(path.join(p, m)), 0);
}

const noi = (...p) => p.join("/").replace(/\/+/g, "/");

function lapKeHoach(d, ten) {
  const dsGoc = fs.readdirSync(d);
  const ds = (m) => (fs.existsSync(path.join(d, m)) ? fs.readdirSync(path.join(d, m), { withFileTypes: true }) : []);

  // Tên video lấy từ kịch bản, thiếu thì từ giọng, thiếu nữa thì từ thư mục export.
  const ten3 = {};
  const ghi = (so, s) => {
    if (!ten3[so] || s.length < ten3[so].length) ten3[so] = s;
  };
  for (const f of ds("scripts")) {
    const m = f.isFile() && f.name.match(/^(\d{3}-[a-z0-9-]+)\.md$/);
    if (m && !/-(shots|edit|ke-hoach-dung)$/.test(m[1])) ghi(m[1].slice(0, 3), m[1]);
  }
  for (const f of ds("voice")) {
    const m = f.name.match(/^(\d{3}-[a-z0-9-]+?)\./);
    if (m && !ten3[m[1].slice(0, 3)]) ten3[m[1].slice(0, 3)] = m[1];
  }
  for (const f of ds("export")) {
    const m = f.isDirectory() && f.name.match(/^(\d{3})(-[a-z0-9-]+)?$/);
    if (m && !ten3[m[1]]) ten3[m[1]] = m[1] + (m[2] || "-video");
  }
  const video = (so) => (ten3[so] ? `videos/${ten3[so]}` : null);

  const chuyen = [];
  const them = (tu, den) => chuyen.push({ tu, den });
  const chua = (tu) => them(tu, noi(CHUA, tu));

  for (const m of dsGoc) {
    const p = path.join(d, m);
    const laDir = fs.statSync(p).isDirectory();
    if (["progress.md", "learnings.md", CHUA, NHAT, "_thung-rac", "_ke-hoach-chuyen.md", "kenh", "nhan-dien", "tai-nguyen", "videos", "bao-cao"].includes(m)) continue;
    if (!laDir) {
      if (/^0\d[a-z]?-.*\.md$/.test(m) || m === "README.md") them(m, noi("kenh", m));
      else chua(m);
      continue;
    }
    const canh = m.match(/^canh-(\d{3})$/);
    if (canh && video(canh[1])) { them(m, noi(video(canh[1]), "3-hinh/canh")); continue; }
    if (m === "assets") { them(m, "nhan-dien"); continue; }
    if (m === "reports") { them(m, "bao-cao"); continue; }
    if (m === "research") { them(m, "kenh/nghien-cuu"); continue; }
    if (m === "style") continue; // xử lý sau assets vì nằm trong nhan-dien
    if (["scripts", "voice", "seo", "export"].includes(m)) continue;
    chua(m);
  }
  if (dsGoc.includes("style")) them("style", "nhan-dien/phong-cach");

  for (const f of ds("scripts")) {
    const m = f.isFile() && f.name.match(/^(\d{3})-/);
    if (m && video(m[1]) && /\.(md|txt)$/.test(f.name)) them(`scripts/${f.name}`, noi(video(m[1]), "1-kich-ban", f.name));
    else chua(`scripts/${f.name}`);
  }
  for (const f of ds("voice")) {
    const so = f.name.match(/^(\d{3})(-|$)/);
    if (!so || !video(so[1])) { chua(`voice/${f.name}`); continue; }
    if (f.isDirectory() && f.name === so[1]) {
      for (const c of ds(`voice/${f.name}`)) them(`voice/${f.name}/${c.name}`, noi(video(so[1]), "2-giong", c.name));
    } else if (f.isDirectory()) {
      them(`voice/${f.name}`, noi(video(so[1]), "2-giong", f.name.slice(4)));
    } else {
      them(`voice/${f.name}`, noi(video(so[1]), "2-giong", f.name));
    }
  }
  for (const f of ds("seo")) {
    const so = f.name.match(/^(\d{3})-/);
    if (!so || !video(so[1])) { chua(`seo/${f.name}`); continue; }
    if (f.name.endsWith("-thumb")) them(`seo/${f.name}`, noi(video(so[1]), "5-xuat/thumbnail"));
    else if (/-nhu-cau\.md$/.test(f.name)) them(`seo/${f.name}`, noi(video(so[1]), "1-kich-ban", f.name));
    else them(`seo/${f.name}`, noi(video(so[1]), "6-dang", f.name));
  }
  for (const f of ds("export")) {
    const so = f.name.match(/^(\d{3})(-|$)/);
    if (f.isDirectory() && so && video(so[1])) {
      const g = `export/${f.name}`;
      const uu = [];
      const xem = (rel) => {
        for (const c of ds(rel)) {
          if (c.isFile() && c.name.endsWith(".mp4") && c.name.startsWith(so[1]) && !/thu|xem|preview|so-sanh|-tho\.|\.ban\d/.test(c.name)) {
            uu.push({ rel: `${rel}/${c.name}`, ten: c.name, luc: fs.statSync(path.join(d, rel, c.name)).mtimeMs });
          }
        }
      };
      xem(g);
      xem(`${g}/blender`);
      uu.sort((a, b) => b.luc - a.luc);
      const cuoi = uu[0];
      if (cuoi) them(cuoi.rel, noi(video(so[1]), "5-xuat", cuoi.ten));
      for (const c of ds(g)) {
        const rel = `${g}/${c.name}`;
        if (cuoi && rel === cuoi.rel) continue;
        if (c.isDirectory() && ["canh", "canh-sach", "tho"].includes(c.name)) them(rel, noi(video(so[1]), "3-hinh", c.name));
        else if (c.isDirectory() && ["shorts", "thumbnail"].includes(c.name)) them(rel, noi(video(so[1]), "5-xuat", c.name));
        else if (c.isDirectory() && c.name === "blender" && cuoi?.rel.startsWith(`${rel}/`)) {
          for (const k of ds(rel)) if (`${rel}/${k.name}` !== cuoi.rel) them(`${rel}/${k.name}`, noi(video(so[1]), "4-dung/blender", k.name));
        } else them(rel, noi(video(so[1]), "4-dung", c.name));
      }
      continue;
    }
    // Bản dựng cũ để lẻ ở gốc export: tên bắt đầu bằng số video, hoặc có "-001-" như xem-thu-001.
    const le = !f.isDirectory() && (f.name.match(/^(\d{3})-/) || f.name.match(/^(?:xem-thu|preview)-(\d{3})-/));
    if (le && video(le[1])) them(`export/${f.name}`, noi(video(le[1]), "4-dung/ban-cu", f.name));
    else chua(`export/${f.name}`);
  }
  // Tránh hai file cùng đích.
  const daDung = new Set();
  for (const c of chuyen) {
    let den = c.den, i = 2;
    while (daDung.has(den)) {
      const e = path.posix.extname(c.den);
      den = `${c.den.slice(0, c.den.length - e.length)}-${i++}${e}`;
    }
    c.den = den;
    daDung.add(den);
  }
  return { chuyen, ten3 };
}

function inKeHoach(d, ten, { chuyen, ten3 }) {
  const dong = [`# Kế hoạch chuyển cấu trúc kênh ${ten}`, "", `Tổng ${chuyen.length} mục. Chưa có gì được chuyển.`, ""];
  const nhom = {};
  for (const c of chuyen) {
    const k = c.den.startsWith("videos/") ? c.den.split("/").slice(0, 2).join("/") : c.den.split("/")[0];
    (nhom[k] ||= []).push(c);
  }
  const bang = [];
  for (const k of Object.keys(nhom).sort()) {
    const t = nhom[k].reduce((s, c) => s + dungLuong(path.join(d, c.tu)), 0);
    bang.push(`| ${k} | ${nhom[k].length} | ${mb(t)} |`);
  }
  dong.push("| Đích | Số mục | Dung lượng |", "|---|---:|---:|", ...bang, "");
  dong.push(`Video nhận diện được: ${Object.values(ten3).sort().join(", ") || "không có"}.`, "");
  for (const k of Object.keys(nhom).sort()) {
    dong.push(`## ${k}`, "");
    for (const c of nhom[k]) dong.push(`- ${c.tu} → ${c.den}`);
    dong.push("");
  }
  const p = path.join(d, "_ke-hoach-chuyen.md");
  fs.writeFileSync(p, dong.join("\n"));
  console.log(`Kế hoạch: ${p}`);
  bang.forEach((b) => console.log(b));
}

function tepTheoDuoi(thuMuc, loc, bo) {
  const kq = [];
  const di = (p) => {
    for (const m of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, m.name);
      if (m.isDirectory()) {
        if (!bo.has(m.name)) di(q);
      } else if (loc.test(m.name)) kq.push(q);
    }
  };
  di(thuMuc);
  return kq;
}

function suaShorts(d, chuyen, cacFile) {
  const dichCua = (tuyetDoi) => {
    const rel = path.relative(d, tuyetDoi).split(path.sep).join("/");
    const c = [...chuyen].sort((a, b) => b.tu.length - a.tu.length).find((x) => rel === x.tu || rel.startsWith(x.tu + "/"));
    return c ? path.join(d, c.den + rel.slice(c.tu.length)) : tuyetDoi;
  };
  for (const c of chuyen.filter((x) => x.tu.endsWith(".shorts.json"))) {
    const moi = path.join(d, c.den);
    if (!fs.existsSync(moi)) continue;
    const spec = JSON.parse(fs.readFileSync(moi, "utf8"));
    const cuDir = path.join(d, path.dirname(c.tu));
    const doi = (v) => path.relative(path.dirname(moi), dichCua(path.resolve(cuDir, v))).split(path.sep).join("/");
    for (const k of Object.keys(spec.chung || {})) {
      spec.chung[k] = Array.isArray(spec.chung[k]) ? spec.chung[k].map(doi) : doi(spec.chung[k]);
    }
    spec.ra = doi(spec.ra || "shorts");
    fs.writeFileSync(moi, JSON.stringify(spec, null, 2) + "\n");
    cacFile.add(moi);
  }
}

function suaChu(d, chuyen, nhatDir) {
  const cap = chuyen
    .filter((c) => c.tu.includes("/") ? !c.tu.includes(".gitkeep") : /\.md$/.test(c.tu) || /^(assets|reports|research|style|canh-\d{3}|canh-v2)$/.test(c.tu))
    .map((c) => ({ tu: c.tu + (fs.existsSync(path.join(d, c.den)) && fs.statSync(path.join(d, c.den)).isDirectory() ? "/" : ""), den: c.den + (fs.existsSync(path.join(d, c.den)) && fs.statSync(path.join(d, c.den)).isDirectory() ? "/" : "") }));
  // Thư mục video trong export còn được nhắc nguyên cụm, như export/003/.
  const tiep = new Map();
  for (const c of chuyen) {
    const m = c.tu.match(/^export\/(\d{3}[^/]*)\//);
    if (m && c.den.includes("/4-dung/") && !tiep.has(m[1])) tiep.set(m[1], c.den.slice(0, c.den.indexOf("/4-dung/") + 8));
  }
  for (const [g, den] of tiep) cap.push({ tu: `export/${g}/`, den });
  cap.sort((a, b) => b.tu.length - a.tu.length);
  const bang = new Map(cap.map((c) => [c.tu, c.den]));
  const thoat = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "[/\\\\\\\\]+");
  const re = new RegExp(`(?<![\\w-])(?:${cap.map((c) => thoat(c.tu)).join("|")})(?!report-template)`, "g");

  const doi = [];
  for (const f of tepTheoDuoi(d, CHU, new Set([NHAT, "_thung-rac", "tai-nguyen", "node_modules"]))) {
    if (fs.statSync(f).size > 8 * 1024 * 1024) continue;
    const goc = fs.readFileSync(f, "utf8");
    const moi = goc.replace(re, (m) => bang.get(m.replace(/[/\\]+/g, "/")) ?? m);
    if (moi === goc) continue;
    const luu = path.join(nhatDir, "ban-goc", path.relative(d, f));
    fs.mkdirSync(path.dirname(luu), { recursive: true });
    fs.writeFileSync(luu, goc);
    fs.writeFileSync(f, moi);
    doi.push(path.relative(d, f));
  }
  return doi;
}

function timBlender() {
  const co = [process.env.BLENDER, "D:\\Blender\\blender.exe", "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe"].filter(Boolean);
  const thay = co.find((p) => fs.existsSync(p));
  if (thay) return thay;
  const kq = spawnSync("blender", ["--version"], { encoding: "utf8" });
  return kq.status === 0 ? "blender" : null;
}

function suaBlend(d, chuyen, nhatDir) {
  const cacBlend = tepTheoDuoi(d, /\.blend$/, new Set([NHAT, "_thung-rac", "tai-nguyen"]));
  if (!cacBlend.length) return 0;
  const blender = timBlender();
  if (!blender) {
    console.log(`Không thấy Blender: ${cacBlend.length} file .blend chưa sửa đường dẫn. Chạy lại sau bằng tools/blender/sua_duong_dan_blend.py.`);
    return 0;
  }
  const tuyet = path.resolve(d);
  const banDo = {};
  for (const c of chuyen) banDo[path.join(tuyet, ...c.tu.split("/"))] = path.join(tuyet, ...c.den.split("/"));
  const fileMap = path.join(nhatDir, "ban-do-duong-dan.json");
  fs.writeFileSync(fileMap, JSON.stringify(banDo));
  const dao = Object.fromEntries(Object.entries(banDo).map(([a, b]) => [b, a]));
  let xong = 0;
  for (const f of cacBlend) {
    const luu = path.join(nhatDir, "ban-goc", path.relative(d, f));
    fs.mkdirSync(path.dirname(luu), { recursive: true });
    fs.copyFileSync(f, luu);
    const tuyetFile = path.resolve(f);
    // Đường dẫn tương đối trong .blend tính theo chỗ cũ của file.
    const khop = Object.keys(dao).sort((a, b) => b.length - a.length).find((k) => tuyetFile === k || tuyetFile.startsWith(k + path.sep));
    const cu = khop ? dao[khop] + tuyetFile.slice(khop.length) : tuyetFile;
    const kq = spawnSync(blender, ["-b", tuyetFile, "--factory-startup", "--python", path.resolve("tools/blender/sua_duong_dan_blend.py"), "--", "--ban-do", path.resolve(fileMap), "--thu-muc-cu", path.dirname(cu)], { encoding: "utf8" });
    if (kq.status === 0 && /\[sua_duong_dan\]/.test(kq.stdout)) xong++;
    else console.log(`Không sửa được ${f}`);
  }
  return xong;
}

function xoaThuMucRong(d, cacThuMuc) {
  for (const m of cacThuMuc) {
    const p = path.join(d, m);
    const di = (q) => {
      if (!fs.existsSync(q) || !fs.statSync(q).isDirectory()) return;
      for (const c of fs.readdirSync(q)) di(path.join(q, c));
      if (!fs.readdirSync(q).length) fs.rmdirSync(q);
    };
    di(p);
  }
}

function lam(d, ten) {
  const ke = lapKeHoach(d, ten);
  if (!ke.chuyen.length) dung(`${ten} không còn gì để chuyển.`);
  if (!thucHien) {
    inKeHoach(d, ten, ke);
    console.log("Chưa chuyển gì. Duyệt xong thì chạy lại với --thuc-hien.");
    return;
  }
  const nhatDir = path.join(d, NHAT);
  if (fs.existsSync(path.join(nhatDir, "nhat-ky.json"))) dung("Kênh đã chuyển một lần. Hoàn tác trước nếu muốn chuyển lại.");
  fs.mkdirSync(nhatDir, { recursive: true });
  for (const c of ke.chuyen) {
    if (fs.existsSync(path.join(d, c.den))) dung(`Đích đã có: ${c.den}. Chưa chuyển gì thêm.`);
  }
  const daChuyen = [];
  fs.writeFileSync(path.join(nhatDir, "nhat-ky.json"), JSON.stringify(ke.chuyen, null, 1));
  for (const c of ke.chuyen) {
    fs.mkdirSync(path.dirname(path.join(d, c.den)), { recursive: true });
    fs.renameSync(path.join(d, c.tu), path.join(d, c.den));
    daChuyen.push(c);
  }
  xoaThuMucRong(d, ["scripts", "voice", "seo", "export", "reports", "research", "style", "assets"]);
  const banGoc = path.join(nhatDir, "ban-goc");
  // Giữ bản shorts.json gốc trước khi sửa.
  for (const c of ke.chuyen.filter((x) => x.tu.endsWith(".shorts.json"))) {
    const luu = path.join(banGoc, c.den);
    fs.mkdirSync(path.dirname(luu), { recursive: true });
    fs.copyFileSync(path.join(d, c.den), luu);
  }
  suaShorts(d, ke.chuyen, new Set());
  const doi = suaChu(d, ke.chuyen, nhatDir);
  const blend = suaBlend(d, ke.chuyen, nhatDir);
  for (const m of ["nhac", "sfx", "lop-phu", "font"]) fs.mkdirSync(path.join(d, "tai-nguyen", m), { recursive: true });
  fs.mkdirSync(path.join(d, "bao-cao", "img"), { recursive: true });
  if (fs.existsSync(path.join(d, "_ke-hoach-chuyen.md"))) fs.renameSync(path.join(d, "_ke-hoach-chuyen.md"), path.join(nhatDir, "ke-hoach.md"));
  console.log(`Đã chuyển ${daChuyen.length} mục, sửa đường dẫn trong ${doi.length} file chữ và ${blend} file .blend.`);
  console.log(`Hoàn tác: node tools/chuyen-cau-truc.mjs ${ten} --hoan-tac`);
}

function hoan(d) {
  const nhatDir = path.join(d, NHAT);
  const fNhat = path.join(nhatDir, "nhat-ky.json");
  if (!fs.existsSync(fNhat)) dung("Không có nhật ký chuyển.");
  const nk = JSON.parse(fs.readFileSync(fNhat, "utf8"));
  const banGoc = path.join(nhatDir, "ban-goc");
  if (fs.existsSync(banGoc)) {
    for (const f of tepTheoDuoi(banGoc, /./, new Set())) fs.copyFileSync(f, path.join(d, path.relative(banGoc, f)));
  }
  for (const c of [...nk].reverse()) {
    if (!fs.existsSync(path.join(d, c.den))) continue; // lần chuyển dừng giữa chừng, mục này chưa đi
    fs.mkdirSync(path.dirname(path.join(d, c.tu)), { recursive: true });
    fs.renameSync(path.join(d, c.den), path.join(d, c.tu));
  }
  xoaThuMucRong(d, ["videos", "kenh", "nhan-dien", "tai-nguyen", CHUA]);
  fs.renameSync(fNhat, path.join(nhatDir, `nhat-ky-da-hoan-tac-${Date.now()}.json`));
  console.log(`Đã trả lại ${nk.length} mục.`);
}

function gomLe() {
  const dich = path.join(GOC, CHUA);
  const fNhat = path.join(dich, "nhat-ky.json");
  if (hoanTac) {
    if (!fs.existsSync(fNhat)) dung("Không có nhật ký.");
    const nk = JSON.parse(fs.readFileSync(fNhat, "utf8"));
    for (const c of nk) fs.renameSync(c.den, c.tu);
    fs.unlinkSync(fNhat);
    console.log(`Đã trả lại ${nk.length} mục.`);
    return;
  }
  const ds = [];
  for (const m of fs.readdirSync(GOC, { withFileTypes: true })) {
    if (m.name === "_template" || m.name === CHUA || m.name === "README.md") continue;
    if (m.isDirectory() && fs.existsSync(path.join(GOC, m.name, "progress.md"))) continue;
    ds.push(path.join(GOC, m.name));
  }
  for (const f of ["test.jpg", "test_draw.png"]) if (fs.existsSync(f)) ds.push(f);
  let tong = 0;
  for (const p of ds) {
    const b = dungLuong(p);
    tong += b;
    console.log(`  ${mb(b).padStart(8)}  ${p}`);
  }
  console.log(`${ds.length} mục, ${mb(tong)} → ${dich}`);
  if (!thucHien) {
    console.log("Chưa chuyển gì. Duyệt xong thì chạy lại với --thuc-hien.");
    return;
  }
  fs.mkdirSync(dich, { recursive: true });
  const nk = ds.map((tu) => ({ tu, den: path.join(dich, path.basename(tu)) }));
  fs.writeFileSync(fNhat, JSON.stringify(nk, null, 1));
  for (const c of nk) fs.renameSync(c.tu, c.den);
  console.log("Đã chuyển. Không xóa gì.");
}

if (!fs.existsSync(GOC)) dung("Chạy lệnh này ở thư mục gốc dự án (nơi có channels/).");
if (laGoc) {
  gomLe();
} else {
  if (!kenh) dung("Dùng: node tools/chuyen-cau-truc.mjs <kenh> [--thuc-hien | --hoan-tac]");
  const d = path.join(GOC, kenh);
  if (!fs.existsSync(path.join(d, "progress.md"))) dung(`Không thấy kênh ${kenh}.`);
  if (hoanTac) hoan(d);
  else lam(d, kenh);
}
