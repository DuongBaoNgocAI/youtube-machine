// Quản lý thư mục kênh và video theo cấu trúc chuẩn. Không cần cài gì thêm ngoài Node.
//   node tools/kenh.mjs tao <kenh>                 tạo kênh từ channels/_template, nạp tài nguyên
//   node tools/kenh.mjs video <kenh> <NNN-slug>    tạo thư mục một video
//   node tools/kenh.mjs nap-tai-nguyen <kenh>      nạp font, SFX, lớp phủ có sẵn vào kênh
//   node tools/kenh.mjs kiem-tra <kenh>            video tới đâu, file nào nằm sai chỗ
//   node tools/kenh.mjs dung-luong <kenh>          dung lượng theo thư mục và theo video
//   node tools/kenh.mjs don <kenh> <NNN> [--thuc-hien]   liệt kê file trung gian, có cờ thì chuyển vào _thung-rac
// Cấu trúc chi tiết: .claude/skills/yt-00-folders/references/cau-truc.md
import fs from "fs";
import path from "path";

const GOC = "channels";
const MUC_VIDEO = ["1-kich-ban", "2-giong", "3-hinh/tho", "3-hinh/canh", "4-dung", "5-xuat/thumbnail", "5-xuat/shorts", "6-dang"];
const MUC_KENH = ["kenh/nghien-cuu", "nhan-dien/phong-cach", "tai-nguyen/nhac", "tai-nguyen/sfx", "tai-nguyen/lop-phu", "tai-nguyen/font", "videos", "bao-cao/img"];
const DUOC_O_GOC = new Set(["progress.md", "learnings.md", "kenh", "nhan-dien", "tai-nguyen", "videos", "bao-cao", "_chua-phan-loai", "_thung-rac", "_chuyen-cau-truc", "_ke-hoach-chuyen.md"]);
const KIEU_CU = ["scripts", "voice", "seo", "export", "reports", "research", "style", "assets"];
const TEN_VIDEO = /^\d{3}-[a-z0-9-]+$/;
// File trung gian tạo lại được, nằm trong 4-dung. Không có file dự án, ảnh, clip đã chọn, MP4 cuối.
const THU_MUC_TAM = /^(lop-25d.*|tai-nguyen|tam|clip-cham|nen-net-tho)$/;
const FILE_TAM = /(\.blend1|\.log)$|^(thu-|xem-thu-|preview-|so-sanh-)/;

const [lenh, kenh, doiSo3, ...con] = process.argv.slice(2);
const thucHien = process.argv.includes("--thuc-hien");

function dung(loi) {
  console.error(loi);
  process.exit(1);
}

function mb(b) {
  return b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`;
}

function dungLuong(p) {
  if (!fs.existsSync(p)) return 0;
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((tong, m) => tong + dungLuong(path.join(p, m)), 0);
}

function thuMucKenh(ten) {
  if (!ten) dung("Thiếu tên kênh.");
  if (!fs.existsSync(GOC)) dung("Chạy lệnh này ở thư mục gốc dự án (nơi có channels/).");
  return path.join(GOC, ten);
}

function canKenh(ten) {
  const d = thuMucKenh(ten);
  if (!fs.existsSync(path.join(d, "progress.md"))) dung(`Không thấy kênh ${ten} (thiếu progress.md).`);
  return d;
}

function danhSachVideo(d) {
  const v = path.join(d, "videos");
  if (!fs.existsSync(v)) return [];
  return fs.readdirSync(v, { withFileTypes: true }).filter((m) => m.isDirectory()).map((m) => m.name).sort();
}

function napTaiNguyen(d) {
  const tn = path.join(d, "tai-nguyen");
  for (const m of ["nhac", "sfx", "lop-phu", "font"]) fs.mkdirSync(path.join(tn, m), { recursive: true });
  let chep = 0;
  const chepFile = (vao, ra) => {
    if (fs.existsSync(ra)) return;
    fs.copyFileSync(vao, ra);
    chep++;
  };
  const nguonFont = path.join("tools", "blender", "fonts");
  if (fs.existsSync(nguonFont)) for (const f of fs.readdirSync(nguonFont)) chepFile(path.join(nguonFont, f), path.join(tn, "font", f));
  const nguonSfx = path.join("tools", "blender", "sfx-cc0", "tron");
  if (fs.existsSync(nguonSfx)) for (const f of fs.readdirSync(nguonSfx)) chepFile(path.join(nguonSfx, f), path.join(tn, "sfx", f));

  // Lớp phủ nặng khoảng 4 GB. Dùng liên kết cứng: kênh thấy đủ file, ổ đĩa không tốn thêm, chép sang máy khác vẫn ra file thật.
  const nguonPhu = path.join("tools", "blender", "lop-phu");
  let lienKet = 0, loi = 0;
  if (fs.existsSync(nguonPhu)) {
    for (const lop of fs.readdirSync(nguonPhu)) {
      if (lop.startsWith("_")) continue;
      const ra = path.join(tn, "lop-phu", lop);
      fs.mkdirSync(ra, { recursive: true });
      for (const f of fs.readdirSync(path.join(nguonPhu, lop))) {
        if (fs.existsSync(path.join(ra, f))) continue;
        try {
          fs.linkSync(path.join(nguonPhu, lop, f), path.join(ra, f));
          lienKet++;
        } catch {
          loi++;
        }
      }
    }
  }
  console.log(`Tài nguyên: chép ${chep} file font và SFX, liên kết ${lienKet} khung lớp phủ.`);
  if (loi) console.log(`Không liên kết được ${loi} khung (kênh khác ổ đĩa với tools?). Blender sẽ lấy lớp phủ từ tools/blender/lop-phu.`);
}

function tao(ten) {
  const d = thuMucKenh(ten);
  if (!/^[a-z0-9-]+$/.test(ten)) dung("Tên thư mục kênh chỉ dùng chữ thường không dấu, số và dấu gạch, ví dụ bi-an-the-gioi.");
  if (fs.existsSync(d)) dung(`Đã có ${d}. Không ghi đè.`);
  fs.mkdirSync(d, { recursive: true });
  fs.copyFileSync(path.join(GOC, "_template", "progress.md"), path.join(d, "progress.md"));
  for (const m of MUC_KENH) fs.mkdirSync(path.join(d, m), { recursive: true });
  napTaiNguyen(d);
  console.log(`Đã tạo ${d}`);
}

function taoVideo(ten, tenVideo) {
  const d = canKenh(ten);
  if (!tenVideo || !TEN_VIDEO.test(tenVideo)) dung("Tên video dạng NNN-slug, không dấu, ví dụ 005-mary-celeste.");
  const so = tenVideo.slice(0, 3);
  const trung = danhSachVideo(d).find((v) => v.startsWith(so + "-"));
  if (trung === tenVideo) {
    console.log(`Đã có ${path.join(d, "videos", tenVideo)}`);
    return;
  }
  if (trung) dung(`Số ${so} đã dùng cho ${trung}.`);
  for (const m of MUC_VIDEO) fs.mkdirSync(path.join(d, "videos", tenVideo, m), { recursive: true });
  console.log(`Đã tạo ${path.join(d, "videos", tenVideo)}`);
}

function coFile(p, loc = () => true) {
  if (!fs.existsSync(p)) return false;
  return fs.readdirSync(p, { withFileTypes: true }).some((m) => (m.isDirectory() ? coFile(path.join(p, m.name), loc) : loc(m.name)));
}

function kiemTra(ten) {
  const d = canKenh(ten);
  const canSua = [];
  const cu = KIEU_CU.filter((m) => fs.existsSync(path.join(d, m)));
  if (cu.length) canSua.push(`Còn cấu trúc cũ (${cu.join(", ")}). Chuyển bằng: node tools/chuyen-cau-truc.mjs ${ten}`);
  for (const m of fs.readdirSync(d)) {
    if (!DUOC_O_GOC.has(m) && !KIEU_CU.includes(m)) canSua.push(`Nằm sai chỗ ở gốc kênh: ${m}`);
  }
  for (const m of MUC_KENH) if (!fs.existsSync(path.join(d, m))) canSua.push(`Thiếu thư mục: ${m}`);

  const hang = danhSachVideo(d).map((v) => {
    const g = path.join(d, "videos", v);
    if (!TEN_VIDEO.test(v)) canSua.push(`Tên video sai mẫu NNN-slug: ${v}`);
    for (const m of fs.readdirSync(g)) if (!/^[1-6]-/.test(m)) canSua.push(`${v}: "${m}" không thuộc công đoạn nào`);
    const so = v.slice(0, 3);
    for (const m of ["1-kich-ban", "2-giong"]) {
      const p = path.join(g, m);
      if (!fs.existsSync(p)) continue;
      for (const f of fs.readdirSync(p, { withFileTypes: true })) {
        if (f.isFile() && !f.name.startsWith(so)) canSua.push(`${v}/${m}: tên file không bắt đầu bằng ${so}: ${f.name}`);
      }
    }
    const co = [
      coFile(path.join(g, "1-kich-ban"), (f) => f.endsWith("-voice.txt")),
      coFile(path.join(g, "2-giong"), (f) => f.endsWith(".mp3")) && coFile(path.join(g, "2-giong"), (f) => f.endsWith(".scenes.srt")),
      coFile(path.join(g, "3-hinh", "canh")),
      coFile(path.join(g, "4-dung")),
      coFile(path.join(g, "5-xuat"), (f) => f.endsWith(".mp4")),
      coFile(path.join(g, "6-dang"), (f) => f.endsWith(".md")),
    ];
    return `${v.padEnd(44)} ${co.map((c) => (c ? "x" : ".")).join("  ")}   ${mb(dungLuong(g))}`;
  });
  console.log(`Kênh ${ten}: ${hang.length} video trong videos/`);
  if (hang.length) {
    console.log(`${"".padEnd(44)} 1  2  3  4  5  6   (1 kịch bản, 2 giọng, 3 hình, 4 dựng, 5 file xuất, 6 gói đăng)`);
    hang.forEach((h) => console.log(h));
  }
  if (canSua.length) {
    console.log(`\nCần xem (${canSua.length}):`);
    canSua.slice(0, 40).forEach((c) => console.log(`- ${c}`));
    if (canSua.length > 40) console.log(`- ... và ${canSua.length - 40} mục nữa`);
  } else {
    console.log("\nĐúng cấu trúc.");
  }
}

function inDungLuong(ten) {
  const d = canKenh(ten);
  console.log(`Kênh ${ten}: ${mb(dungLuong(d))}`);
  for (const m of fs.readdirSync(d)) {
    if (m === "videos") continue;
    const p = path.join(d, m);
    if (fs.statSync(p).isDirectory()) console.log(`  ${m.padEnd(22)} ${mb(dungLuong(p))}`);
  }
  for (const v of danhSachVideo(d)) {
    const g = path.join(d, "videos", v);
    const chiTiet = fs.readdirSync(g).map((m) => `${m.split("-")[0]}: ${mb(dungLuong(path.join(g, m)))}`).join(" | ");
    console.log(`  ${v.padEnd(44)} ${mb(dungLuong(g)).padStart(8)}   ${chiTiet}`);
  }
  console.log("Lớp phủ trong tai-nguyen/ là liên kết cứng: số trên có tính, nhưng ổ đĩa chỉ tốn một lần dù nhiều kênh cùng dùng.");
}

function don(ten, so) {
  const d = canKenh(ten);
  if (!/^\d{3}$/.test(so || "")) dung("Dùng: node tools/kenh.mjs don <kenh> <NNN> [--thuc-hien]");
  const v = danhSachVideo(d).find((x) => x.startsWith(so + "-"));
  if (!v) dung(`Không có video ${so} trong videos/.`);
  const g = path.join(d, "videos", v);
  if (!coFile(path.join(g, "5-xuat"), (f) => f.endsWith(".mp4"))) dung(`${v} chưa có MP4 trong 5-xuat. Chưa dọn.`);

  const ds = [];
  const dung4 = path.join(g, "4-dung");
  const quet = (p) => {
    if (!fs.existsSync(p)) return;
    for (const m of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, m.name);
      if (m.isDirectory()) {
        if (THU_MUC_TAM.test(m.name)) ds.push(q);
        else quet(q);
      } else if (FILE_TAM.test(m.name)) ds.push(q);
    }
  };
  quet(dung4);
  // Bản thô còn dấu sao: đã có bản sạch trong 3-hinh/canh, bản gốc vẫn ở thư mục xuất của Flow.
  if (coFile(path.join(g, "3-hinh", "tho")) && coFile(path.join(g, "3-hinh", "canh"))) ds.push(path.join(g, "3-hinh", "tho"));

  const tong = ds.reduce((t, p) => t + dungLuong(p), 0);
  console.log(`${v}: ${ds.length} mục, được ${mb(tong)}`);
  ds.forEach((p) => console.log(`  ${mb(dungLuong(p)).padStart(8)}  ${path.relative(g, p)}`));
  console.log("Giữ lại: kịch bản, giọng, ảnh và clip đã chọn, file hiệu ứng, file dự án, cảnh đã xử lý, file xuất, gói đăng.");
  if (!thucHien) {
    console.log("Chưa làm gì. Duyệt xong thì thêm --thuc-hien để chuyển vào _thung-rac.");
    return;
  }
  for (const p of ds) {
    const dich = path.join(d, "_thung-rac", v, path.relative(g, p));
    fs.mkdirSync(path.dirname(dich), { recursive: true });
    fs.renameSync(p, dich);
  }
  console.log(`Đã chuyển vào ${path.join(d, "_thung-rac", v)}. Xem lại video vẫn ổn thì tự xóa thư mục đó để lấy lại ổ đĩa.`);
}

switch (lenh) {
  case "tao": tao(kenh); break;
  case "video": taoVideo(kenh, doiSo3); break;
  case "nap-tai-nguyen": napTaiNguyen(canKenh(kenh)); break;
  case "kiem-tra": kiemTra(kenh); break;
  case "dung-luong": inDungLuong(kenh); break;
  case "don": don(kenh, doiSo3); break;
  default:
    dung("Lệnh: tao, video, nap-tai-nguyen, kiem-tra, dung-luong, don. Xem đầu file tools/kenh.mjs.");
}
