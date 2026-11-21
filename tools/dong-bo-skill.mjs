// Chép skill từ bản gốc .claude/skills sang chỗ các trợ lý AI khác tìm, và gói thành một file cho chatbot web.
// Dùng: node tools/dong-bo-skill.mjs   (chạy ở thư mục gốc dự án, sau mỗi lần sửa skill)
// Ra: .agents/skills, .agent/skills, dist/youtube-machine-goi.md, dist/huong-dan-chatbot.txt
// Bản sao bị ghi đè mỗi lần chạy, chỉ sửa ở .claude/skills.
import fs from "fs";
import path from "path";

const GOC = path.join(".claude", "skills");
const DICH = [path.join(".agents", "skills"), path.join(".agent", "skills")];
const THU_TU = (a, b) => (a === "youtube-machine" ? -1 : b === "youtube-machine" ? 1 : a.localeCompare(b));

if (!fs.existsSync(GOC)) {
  console.error("Chạy lệnh này ở thư mục gốc dự án (nơi có .claude/skills).");
  process.exit(1);
}
const skills = fs.readdirSync(GOC).filter((d) => fs.existsSync(path.join(GOC, d, "SKILL.md"))).sort(THU_TU);

for (const dich of DICH) {
  fs.rmSync(dich, { recursive: true, force: true });
  for (const s of skills) fs.cpSync(path.join(GOC, s), path.join(dich, s), { recursive: true });
  fs.writeFileSync(path.join(dich, "..", "DOC-TOI.txt"),
    "Thư mục này do tools/dong-bo-skill.mjs tạo. Đừng sửa ở đây, sửa ở .claude/skills rồi chạy lại lệnh.\n");
}

function tepVanBan(thuMuc) {
  return fs.readdirSync(thuMuc, { withFileTypes: true }).flatMap((m) => {
    const p = path.join(thuMuc, m.name);
    if (m.isDirectory()) return tepVanBan(p);
    return /\.(md|txt|html|json)$/.test(m.name) ? [p] : [];
  }).sort();
}

const goiTin = JSON.parse(fs.readFileSync("PHIEN-BAN.json", "utf8"));
const THONG_BAO = `${goiTin.ten} phiên bản ${goiTin.phien_ban} (${goiTin.ngay}), phát hành bởi ${goiTin.ban_hanh}. Hỗ trợ: nhóm Zalo ${goiTin.ho_tro}`;
const phan = [
  `# Gói ${THONG_BAO}`,
  "Bản cho chatbot không đọc được thư mục.",
  "Tự động tạo từ .claude/skills. Mỗi mục `## FILE:` là một file. Khi skill nói đọc một đường dẫn, tìm mục có đường dẫn đó.",
];
for (const s of skills) {
  for (const p of tepVanBan(path.join(GOC, s))) {
    phan.push(`\n\n## FILE: ${p.split(path.sep).join("/")}\n\n${fs.readFileSync(p, "utf8")}`);
  }
}
const mauTienDo = path.join("channels", "_template", "progress.md");
if (fs.existsSync(mauTienDo)) phan.push(`\n\n## FILE: channels/_template/progress.md\n\n${fs.readFileSync(mauTienDo, "utf8")}`);
fs.mkdirSync("dist", { recursive: true });
const goi = path.join("dist", "youtube-machine-goi.md");
fs.writeFileSync(goi, phan.join("\n"));

fs.writeFileSync(path.join("dist", "huong-dan-chatbot.txt"), `Bạn là người dẫn đường xây kênh YouTube theo quy trình YouTube Machine, trò chuyện bằng tiếng Việt.
Toàn bộ quy trình nằm trong tài liệu đính kèm youtube-machine-goi.md. Mỗi mục "## FILE:" là một file.

Ở tin nhắn đầu tiên của cuộc trò chuyện, báo cho người dùng: "${THONG_BAO}".

Khi bắt đầu:
1. Đọc mục FILE .claude/skills/youtube-machine/SKILL.md và làm theo, kèm mục references/tuong-thich-ai.md để biết làm gì khi thiếu công cụ.
2. Bạn không có thư mục kênh. Hỏi người dùng có file progress.md chưa. Có thì nhờ dán vào. Chưa có thì dùng mục FILE channels/_template/progress.md trong gói và tạo mới. Đưa người dùng cây thư mục trong mục FILE .claude/skills/yt-00-folders/references/cau-truc.md để họ tự tạo.
3. Trước mỗi bước, chạy cổng hỏi trong references/cong-hoi-dau-buoc.md rồi đọc mục SKILL.md của bước đó.
4. Kết thúc mỗi bước, trình bày nội dung file trong khối code kèm đường dẫn để người dùng tự lưu, và đưa lại progress.md đã cập nhật. Báo cáo HTML viết theo mục FILE .claude/skills/youtube-machine/assets/report-template.html.

Không bịa số liệu. Không báo đã làm việc mà bạn không làm được (chạy lệnh, dựng video, mở trang web). Những việc đó đưa hướng dẫn để người dùng tự làm.
`);

const kb = Math.round(fs.statSync(goi).size / 1024);
console.log(`Đã chép ${skills.length} skill sang ${DICH.join(", ")}`);
console.log(`Gói chatbot: ${goi} (${kb} KB), dist/huong-dan-chatbot.txt`);
