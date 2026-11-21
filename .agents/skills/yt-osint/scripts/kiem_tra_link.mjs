// Kiểm tra từng link trong danh mục công cụ của skill yt-osint.
// Dùng: node .claude/skills/yt-osint/scripts/kiem_tra_link.mjs        chỉ báo kết quả
//       node .claude/skills/yt-osint/scripts/kiem_tra_link.mjs --ghi  báo kết quả và ghi ngày kiểm tra vào danh mục
// Không tự xóa dòng nào. Link chết do người chạy quyết định bỏ hay thay.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DANH_MUC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "references", "danh-muc.md");
const GHI = process.argv.includes("--ghi");
const SONG_SONG = 8;
const HET_GIO = 20000;
const TRANG_CHAN_BOT = /just a moment|human verification|attention required|are you a robot|please wait a moment/i;
const CHU_BAN_TEN_MIEN = /domain (is )?for sale|buy this domain|domain has expired|parked free|this domain is parked/i;

const noiDung = fs.readFileSync(DANH_MUC, "utf8");
const dong = [...noiDung.matchAll(/^\| ([^|]+?) \| (https?:\/\/\S+) \|/gm)].map((m) => ({ ten: m[1], url: m[2] }));

async function kiemTra({ ten, url }) {
  try {
    const dk = new AbortController();
    const hen = setTimeout(() => dk.abort(), HET_GIO);
    const r = await fetch(url, {
      redirect: "follow",
      signal: dk.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        accept: "text/html,*/*",
      },
    });
    const than = await r.text().catch(() => "");
    clearTimeout(hen);
    const tieuDe = (than.match(/<title[^>]*>([^<]*)/i)?.[1] ?? "").trim().replace(/\s+/g, " ").slice(0, 70);
    const doiMien = new URL(r.url).hostname.replace(/^www\./, "") !== new URL(url).hostname.replace(/^www\./, "");
    let loai = "song";
    if (CHU_BAN_TEN_MIEN.test(than.slice(0, 20000))) loai = "chet";
    else if (doiMien) loai = "doi";
    else if ([401, 403, 406, 429, 503].includes(r.status) || TRANG_CHAN_BOT.test(tieuDe)) loai = "chan";
    else if (r.status >= 400) loai = "chet";
    return { ten, url, loai, ma: r.status, cuoi: r.url, tieuDe };
  } catch (e) {
    return { ten, url, loai: "chet", ma: e.cause?.code ?? e.name, cuoi: "", tieuDe: "" };
  }
}

const ketQua = [];
let i = 0;
await Promise.all(Array.from({ length: SONG_SONG }, async () => {
  while (i < dong.length) ketQua.push(await kiemTra(dong[i++]));
}));

const NHOM = { chet: "Link chết", doi: "Chuyển sang tên miền khác, xem còn đúng công cụ không", chan: "Chặn kiểm tra tự động, cần mở bằng trình duyệt" };
for (const [loai, nhan] of Object.entries(NHOM)) {
  const ds = ketQua.filter((k) => k.loai === loai);
  if (!ds.length) continue;
  console.log(`\n${nhan} (${ds.length}):`);
  for (const k of ds) console.log(`- ${k.ten} [${k.ma}] ${k.url}${k.cuoi && k.cuoi !== k.url ? ` -> ${k.cuoi}` : ""}${k.tieuDe ? ` | ${k.tieuDe}` : ""}`);
}
const song = ketQua.filter((k) => k.loai === "song").length;
console.log(`\nTổng ${ketQua.length} link: ${song} sống, ${ketQua.length - song} cần xem lại.`);

if (GHI) {
  const ngay = new Date().toLocaleDateString("sv-SE");
  fs.writeFileSync(DANH_MUC, noiDung.replace(/Kiểm tra link lần cuối: [^.\n]*\./, `Kiểm tra link lần cuối: ${ngay}.`));
  console.log(`Đã ghi ngày ${ngay} vào danh mục.`);
}
