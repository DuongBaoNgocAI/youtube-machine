#!/usr/bin/env node
// Cổng YTM: máy chủ MCP (stdio) chạy trên máy người dùng, lấy nội dung skill YouTube Machine từ máy chủ.
// App chỉ là cổng: không chứa nội dung skill, không ghi nội dung xuống đĩa. Chỉ lưu phiên đăng nhập.
//
// Cài vào Claude Code (chạy ở thư mục gốc bộ skill):
//   claude mcp add ytm -- node tools/ytm-cong.mjs
// Thử tay:  node tools/ytm-cong.mjs --thu [--dang-nhap] [--danh-sach] [--doc <đường dẫn> [trang]]
//           node tools/ytm-cong.mjs --phien-ban   in JSON bản được dùng (tools/phien-ban.mjs gọi), không mở trình duyệt
//
// Công cụ: ytm_dang_nhap, ytm_trang_thai, ytm_danh_sach, ytm_doc.
// Node 18 trở lên, không cần cài thêm thư viện.
import crypto from "crypto";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";
import { execFileSync, spawn } from "child_process";

// Địa chỉ và khóa công khai (anon) của dự án Supabase. Khóa anon vốn nằm trong mã trang web, không phải bí mật.
const SUPABASE_URL = process.env.YTM_SUPABASE_URL_CONG || "https://yhiqigmzmfulfsoghuno.supabase.co";
const ANON_KEY = process.env.YTM_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloaXFpZ216bWZ1bGZzb2dodW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MjYyMTIsImV4cCI6MjA5NzAwMjIxMn0.j3V4GlV-PaILKyiJO2BkPRN4QTo1-KuX_eFNXjiHYS4";
const HAM = `${SUPABASE_URL}/functions/v1/ytm-skill`;
const TRANG_BAN = "https://tool.aicong.vn/youtube-machine/";
const PHIEN_BAN_APP = "1.0.0";
const CHO_DANG_NHAP_MS = 150_000; // một lần gọi ytm_dang_nhap chờ tối đa chừng này
const GIU_CONG_MS = 10 * 60_000; // cổng nghe sống tiếp chừng này để gọi lại ytm_dang_nhap vẫn kịp

const log = (...a) => process.stderr.write(`[ytm] ${a.join(" ")}\n`); // stdout dành riêng cho MCP

// ---------------------------------------------------------------------------
// Phiên đăng nhập: %APPDATA%\ytm\phien.json
// ---------------------------------------------------------------------------
const THU_MUC =
  process.platform === "win32"
    ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "ytm")
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "ytm");
const TEP_PHIEN = path.join(THU_MUC, "phien.json");

function docPhien() {
  try {
    const p = JSON.parse(fs.readFileSync(TEP_PHIEN, "utf8"));
    return p?.refresh_token ? p : null;
  } catch {
    return null;
  }
}
function ghiPhien(p) {
  fs.mkdirSync(THU_MUC, { recursive: true });
  const tam = `${TEP_PHIEN}.${process.pid}.tam`;
  fs.writeFileSync(tam, JSON.stringify(p, null, 2), { mode: 0o600 });
  fs.renameSync(tam, TEP_PHIEN);
}
function xoaPhien() {
  fs.rmSync(TEP_PHIEN, { force: true });
}

// ---------------------------------------------------------------------------
// Dấu máy: SHA-256 (hex chữ thường) của MachineGuid + tên máy + tên người dùng HĐH
// ---------------------------------------------------------------------------
function maMay() {
  try {
    if (process.platform === "win32") {
      const ra = execFileSync("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"], {
        encoding: "utf8",
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      const m = ra.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/);
      if (m) return m[1].toLowerCase();
    } else if (process.platform === "darwin") {
      const ra = execFileSync("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { encoding: "utf8" });
      const m = ra.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1].toLowerCase();
    } else {
      for (const f of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
      }
    }
  } catch {
    /* rơi xuống dưới */
  }
  return "khong-co-ma-may";
}
let tenNguoiDung = "";
try {
  tenNguoiDung = os.userInfo().username;
} catch {
  tenNguoiDung = process.env.USERNAME || process.env.USER || "";
}
const TEN_MAY = os.hostname();
const DAU_MAY = crypto.createHash("sha256").update(`${maMay()}|${TEN_MAY}|${tenNguoiDung}`).digest("hex");

// ---------------------------------------------------------------------------
// Supabase Auth: đăng nhập Google theo PKCE, đổi mã, làm mới phiên
// ---------------------------------------------------------------------------
const b64url = (b) => Buffer.from(b).toString("base64url");

async function goiAuth(duong, body) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/${duong}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error_description || j.msg || j.message || `auth ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

function luuTuTraLoi(j) {
  const p = {
    refresh_token: j.refresh_token,
    access_token: j.access_token,
    het_han: Date.now() + (Number(j.expires_in) || 3600) * 1000,
    email: j.user?.email ?? phien?.email ?? null,
    luc_dang_nhap: phien?.luc_dang_nhap ?? new Date().toISOString(),
  };
  ghiPhien(p);
  return p;
}

let phien = docPhien();
let dangLamMoi = null;

// Refresh token của Supabase đổi sau mỗi lần dùng, nên chỉ một lần làm mới chạy tại một thời điểm.
async function lamMoi() {
  dangLamMoi ??= (async () => {
    try {
      const j = await goiAuth("token?grant_type=refresh_token", { refresh_token: phien.refresh_token });
      phien = luuTuTraLoi(j);
      return true;
    } catch (e) {
      log("làm mới phiên lỗi:", e.message);
      if (e.status === 400 || e.status === 401 || e.status === 403) {
        // Token đã bị thu hồi (đăng xuất, bị khóa, dùng ở chỗ khác). Bỏ phiên để lần sau đăng nhập lại.
        phien = null;
        xoaPhien();
      }
      return false;
    } finally {
      dangLamMoi = null;
    }
  })();
  return dangLamMoi;
}

async function maTruyCap() {
  if (!phien) return null;
  if (!phien.access_token || Date.now() > phien.het_han - 60_000) {
    if (!(await lamMoi())) return null;
  }
  return phien.access_token;
}

// ---------------------------------------------------------------------------
// Gọi máy chủ ytm-skill
// ---------------------------------------------------------------------------
async function goiHam(hanhDong, them = {}) {
  let ma = await maTruyCap();
  if (!ma) return { status: 401, j: { loi: "chua-dang-nhap", thong_bao: "Chưa đăng nhập. Gọi ytm_dang_nhap." } };
  for (let lan = 0; lan < 2; lan++) {
    let r;
    try {
      r = await fetch(HAM, {
        method: "POST",
        headers: { authorization: `Bearer ${ma}`, apikey: ANON_KEY, "content-type": "application/json" },
        body: JSON.stringify({ hanh_dong: hanhDong, dau_may: DAU_MAY, ...them }),
      });
    } catch (e) {
      return {
        status: 0,
        j: { loi: "mat-mang", thong_bao: `Không kết nối được máy chủ YouTube Machine (${e.message}). Bộ skill cần mạng để dùng.` },
      };
    }
    const j = await r.json().catch(() => ({ loi: "loi-may-chu", thong_bao: `Máy chủ trả lỗi ${r.status}. Thử lại sau.` }));
    // Access token hết hạn sớm hơn dự kiến: làm mới một lần rồi gọi lại.
    if (r.status === 401 && lan === 0 && phien && (await lamMoi())) {
      ma = phien.access_token;
      continue;
    }
    return { status: r.status, j };
  }
}

// ---------------------------------------------------------------------------
// Đăng nhập: cổng nghe tạm http://127.0.0.1:<cổng>/xong (Supabase cho phép http://127.0.0.1:*/xong)
// ---------------------------------------------------------------------------
let dangNhapDo = null; // { url, xong: Promise<string>, dong() }

function moTrinhDuyet(url) {
  try {
    const [lenh, thamSo] =
      process.platform === "win32"
        ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
        : process.platform === "darwin"
          ? ["open", [url]]
          : ["xdg-open", [url]];
    const c = spawn(lenh, thamSo, { detached: true, stdio: "ignore", windowsHide: true });
    c.on("error", (e) => log("không mở được trình duyệt:", e.message));
    c.unref();
    return true;
  } catch (e) {
    log("không mở được trình duyệt:", e.message);
    return false;
  }
}

const trangHtml = (tieuDe, loiNhan, tot) => `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Cổng YTM</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8e8e8;display:grid;place-items:center;min-height:100vh;margin:0}
main{max-width:460px;padding:32px;border-radius:14px;background:#181b22;text-align:center}
h1{font-size:20px;color:${tot ? "#5bd18b" : "#ff8a7a"}}p{line-height:1.6;color:#c9c9c9}</style></head>
<body><main><h1>${tieuDe}</h1><p>${loiNhan}</p></main></body></html>`;
const thoatHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Gọi gan-may sau khi có phiên. Trả câu cho AI và câu cho trang trình duyệt.
async function ganMay() {
  const { status, j } = await goiHam("gan-may", { ten_may: TEN_MAY });
  const email = phien?.email ?? "";
  if (status === 200) {
    const han = j.han_cap_nhat ? `, hạn cập nhật tới ${ngayVN(j.han_cap_nhat)}` : "";
    return {
      tot: true,
      ai: `Đã đăng nhập bằng ${email} và gắn máy "${TEN_MAY}". Được dùng YouTube Machine bản ${j.phien_ban}${han}. Làm tiếp việc người dùng đang hỏi.`,
      web: `Đã đăng nhập bằng <b>${thoatHtml(email)}</b>. Quay lại cửa sổ AI để làm tiếp.`,
    };
  }
  if (j.loi === "chua-mua") {
    return {
      tot: false,
      ai: `Gmail ${email} chưa mua YouTube Machine. Mua tại ${TRANG_BAN}. Nếu đã mua bằng Gmail khác, gọi lại ytm_dang_nhap và chọn đúng Gmail đó.`,
      web: `Gmail <b>${thoatHtml(email)}</b> chưa mua YouTube Machine. Quay lại cửa sổ AI để đăng nhập bằng Gmail khác.`,
    };
  }
  if (j.loi === "du-may") {
    return {
      tot: false,
      ai: `Gmail ${email} đã gắn đủ 2 máy: ${(j.cac_may ?? []).join(", ")}. Gỡ một máy ở ${TRANG_BAN}#tai-ve rồi gọi lại ytm_dang_nhap.`,
      web: `Tài khoản đã gắn đủ 2 máy. Gỡ một máy trên trang YouTube Machine (mục Tải về) rồi thử lại.`,
    };
  }
  return { tot: false, ai: j.thong_bao || `Không gắn được máy (lỗi ${status}).`, web: thoatHtml(j.thong_bao || "Không gắn được máy.") };
}

function batDauDangNhap() {
  const verifier = b64url(crypto.randomBytes(48));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  let xongRoi, hongRoi;
  const xong = new Promise((a, b) => ((xongRoi = a), (hongRoi = b)));
  let daNhan = false;

  const may = http.createServer(async (req, res) => {
    const u = new URL(req.url, "http://127.0.0.1");
    if (u.pathname !== "/xong") {
      res.writeHead(404).end();
      return;
    }
    const traTrang = (tieuDe, loiNhan, tot) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(trangHtml(tieuDe, loiNhan, tot));
    };
    const code = u.searchParams.get("code");
    const loiQ = u.searchParams.get("error_description") || u.searchParams.get("error");
    if (daNhan) return traTrang("Đã xử lý", "Lần đăng nhập này đã xong. Quay lại cửa sổ AI.", true);
    if (!code) {
      traTrang("Chưa đăng nhập được", thoatHtml(loiQ || "Không nhận được mã đăng nhập."), false);
      if (loiQ) {
        daNhan = true;
        hongRoi(new Error(`Google/Supabase báo lỗi: ${loiQ}`));
      }
      return;
    }
    daNhan = true;
    try {
      const j = await goiAuth("token?grant_type=pkce", { auth_code: code, code_verifier: verifier });
      phien = null;
      phien = luuTuTraLoi({ ...j, user: j.user });
      const kq = await ganMay();
      traTrang(kq.tot ? "Đã đăng nhập" : "Chưa dùng được", kq.web, kq.tot);
      xongRoi(kq.ai);
    } catch (e) {
      traTrang("Chưa đăng nhập được", thoatHtml(e.message), false);
      hongRoi(e);
    }
  });

  return new Promise((sanSang, loiMo) => {
    may.on("error", loiMo);
    may.listen(0, "127.0.0.1", () => {
      const cong = may.address().port;
      const veVe = `http://127.0.0.1:${cong}/xong`;
      const url =
        `${SUPABASE_URL}/auth/v1/authorize?provider=google` +
        `&redirect_to=${encodeURIComponent(veVe)}` +
        `&code_challenge=${challenge}&code_challenge_method=s256` +
        `&prompt=select_account`;
      const henGio = setTimeout(() => hongRoi(new Error("het-gio")), GIU_CONG_MS);
      const dong = () => {
        clearTimeout(henGio);
        may.close();
        may.closeAllConnections?.();
      };
      const lan = { url, xong, dong, daXong: false };
      xong.then(dong, dong).finally(() => (lan.daXong = true));
      xong.catch(() => {}); // lỗi được báo qua lần gọi ytm_dang_nhap đang chờ hoặc lần gọi sau
      sanSang(lan);
    });
  });
}

async function congCuDangNhap(thamSo) {
  let moi = false;
  if (!dangNhapDo || thamSo?.lam_lai) {
    dangNhapDo?.dong();
    dangNhapDo = await batDauDangNhap();
    moi = true;
    log("link đăng nhập:", dangNhapDo.url);
  }
  const lan = dangNhapDo;
  const { url, xong } = lan;
  const daMo = moi ? moTrinhDuyet(url) : true;
  const cho = new Promise((a) => setTimeout(() => a(null), CHO_DANG_NHAP_MS));
  try {
    const kq = await Promise.race([xong, cho]);
    if (kq && dangNhapDo === lan) dangNhapDo = null;
    if (kq) return { text: kq, loi: !/^Đã đăng nhập/.test(kq) };
    return {
      text:
        `Chưa thấy người dùng chọn Gmail. ${daMo ? "Trình duyệt đã được mở tới trang chọn tài khoản Google." : "Không mở được trình duyệt."} ` +
        `Đưa người dùng link này nếu họ không thấy trang: ${url}\n` +
        `Khi họ báo đã chọn xong, gọi lại ytm_dang_nhap (không cần tham số) để nhận kết quả. Link còn dùng được 10 phút.`,
      loi: true,
    };
  } catch (e) {
    if (dangNhapDo === lan) dangNhapDo = null;
    if (e.message === "het-gio") return { text: "Lần đăng nhập đã quá 10 phút. Gọi lại ytm_dang_nhap để mở trang mới.", loi: true };
    return { text: `Đăng nhập không thành công: ${e.message}. Gọi lại ytm_dang_nhap để thử lần nữa.`, loi: true };
  }
}

// ---------------------------------------------------------------------------
// Các công cụ khác
// ---------------------------------------------------------------------------
function ngayVN(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
const NGUON = {
  admin: "quản trị",
  mua: "đã mua",
  mbs: "thành viên MBS",
  "mua-het-han": "đã mua, hết hạn cập nhật",
  khong: "chưa mua",
};

async function congCuTrangThai() {
  if (!phien) return { text: "Chưa đăng nhập. Nói với người dùng: \"Trình duyệt sẽ mở, bạn chọn Gmail đã mua YouTube Machine.\" rồi gọi ytm_dang_nhap.", loi: true };
  const { status, j } = await goiHam("trang-thai");
  if (status !== 200) return { text: j.thong_bao || `Lỗi ${status}.`, loi: true };
  const q = j.quyen ?? {};
  const mayNay = (j.may ?? []).some((m) => m.la_may_nay);
  const dong = [
    `Tài khoản: ${j.email}`,
    `Quyền: ${NGUON[q.nguon] ?? q.nguon}${q.khoa ? " (ĐANG BỊ KHÓA)" : ""}`,
    `Bản được dùng: ${q.phien_ban ?? "chưa có"}${q.ban_moi_nhat && q.ban_moi_nhat !== q.phien_ban ? ` (bản mới nhất: ${q.ban_moi_nhat})` : ""}`,
    `Hạn cập nhật: ${q.han_cap_nhat ? ngayVN(q.han_cap_nhat) : q.nguon === "admin" ? "không giới hạn" : q.nguon === "mbs" ? "theo thành viên MBS" : "không có"}`,
    `Máy đã gắn (${(j.may ?? []).length}/2): ${(j.may ?? []).map((m) => `${m.ten_may}${m.la_may_nay ? " (máy này)" : ""}`).join(", ") || "chưa có"}`,
    `Cổng YTM ${PHIEN_BAN_APP}`,
  ];
  let sanSang = q.co_quyen && !q.khoa && q.phien_ban && mayNay;
  if (!q.co_quyen) dong.push(`Gmail này chưa mua YouTube Machine. Mua tại ${TRANG_BAN}, hoặc gọi ytm_dang_nhap để đổi sang Gmail đã mua.`);
  else if (q.khoa) dong.push("Tài khoản đang bị khóa. Liên hệ nhóm hỗ trợ: https://zalo.me/g/yenkqg494");
  else if (!q.phien_ban) dong.push(`Hạn cập nhật đã hết trước khi có bản 1.0. Gia hạn tại ${TRANG_BAN}.`);
  else if (!mayNay) dong.push("Máy này chưa gắn hoặc đã bị gỡ. Gọi ytm_dang_nhap để gắn máy.");
  dong.push(sanSang ? "Sẵn sàng: đọc skill bằng ytm_doc." : "Chưa đọc được skill.");
  return { text: dong.join("\n"), loi: false };
}

async function congCuDanhSach() {
  const { status, j } = await goiHam("danh-sach");
  if (status !== 200) return { text: j.thong_bao || `Lỗi ${status}.`, loi: true };
  const ds = (j.skills ?? []).map((s) => `- ${s.ten}: ${s.mo_ta}`).join("\n");
  return {
    text: `YouTube Machine bản ${j.phien_ban} (${(j.skills ?? []).length} skill). Đọc một skill bằng ytm_doc("<tên>/SKILL.md").\n\n${ds}`,
    loi: false,
  };
}

const boNho = new Map(); // chỉ trong RAM, mất khi tắt phiên MCP
async function congCuDoc(thamSo) {
  const duong = String(thamSo?.duong_dan ?? "").trim();
  if (!duong) return { text: 'Thiếu duong_dan, ví dụ "yt-07-script/SKILL.md".', loi: true };
  const trang = Math.max(1, Number(thamSo?.trang ?? 1) | 0);
  const khoa = `${phien?.email}|${duong.replace(/\\/g, "/")}|${trang}`;
  let j = boNho.get(khoa);
  if (!j) {
    const r = await goiHam("doc", { duong_dan: duong, trang });
    if (r.status !== 200) return { text: r.j.thong_bao || `Lỗi ${r.status}.`, loi: true };
    j = r.j;
    boNho.set(khoa, j);
  }
  const dau =
    j.tong_trang > 1
      ? `[${j.duong_dan} · trang ${j.trang}/${j.tong_trang}${j.trang < j.tong_trang ? ` · đọc tiếp bằng ytm_doc với trang: ${j.trang + 1}` : " · trang cuối"}]\n\n`
      : "";
  return { text: dau + j.noi_dung, loi: false };
}

// ---------------------------------------------------------------------------
// MCP qua stdio (JSON-RPC 2.0, mỗi dòng một thông điệp)
// ---------------------------------------------------------------------------
const CONG_CU = [
  {
    name: "ytm_dang_nhap",
    description:
      "Đăng nhập YouTube Machine bằng Gmail đã mua: mở trình duyệt tới trang chọn tài khoản Google, chờ người dùng chọn, rồi gắn máy này. " +
      "Trước khi gọi, nói với người dùng: \"Trình duyệt sẽ mở, bạn chọn Gmail đã mua YouTube Machine.\" " +
      "Nếu trả về là chưa chọn xong, gọi lại khi người dùng báo đã chọn.",
    inputSchema: {
      type: "object",
      properties: { lam_lai: { type: "boolean", description: "true để bỏ lần đăng nhập đang chờ và mở trang mới" } },
    },
  },
  {
    name: "ytm_trang_thai",
    description: "Kiểm tra đăng nhập YouTube Machine: tài khoản, quyền, bản được dùng, hạn cập nhật, các máy đã gắn. Gọi đầu tiên mỗi phiên.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ytm_danh_sach",
    description: "Liệt kê tên và mô tả các skill YouTube Machine của bản được dùng.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ytm_doc",
    description:
      "Đọc nội dung một file skill YouTube Machine từ máy chủ, ví dụ \"youtube-machine/SKILL.md\", \"yt-07-script/SKILL.md\", " +
      "\"youtube-machine/references/cong-hoi-dau-buoc.md\". Mọi đường dẫn .claude/skills/... trong skill đều đọc bằng công cụ này. " +
      "File dài được chia trang: đọc tiếp bằng tham số trang.",
    inputSchema: {
      type: "object",
      properties: {
        duong_dan: { type: "string", description: "Đường dẫn trong thư mục skills, ví dụ yt-07-script/SKILL.md" },
        trang: { type: "integer", minimum: 1, description: "Trang cần đọc khi file dài (mặc định 1)" },
      },
      required: ["duong_dan"],
    },
  },
];
const XU_LY = {
  ytm_dang_nhap: congCuDangNhap,
  ytm_trang_thai: congCuTrangThai,
  ytm_danh_sach: congCuDanhSach,
  ytm_doc: congCuDoc,
};
const PHIEN_BAN_GIAO_THUC = ["2025-06-18", "2025-03-26", "2024-11-05"];

const gui = (m) => process.stdout.write(JSON.stringify(m) + "\n");

async function xuLyThongDiep(m) {
  const { id, method, params } = m;
  const coId = id !== undefined && id !== null;
  try {
    if (method === "initialize") {
      const v = PHIEN_BAN_GIAO_THUC.includes(params?.protocolVersion) ? params.protocolVersion : PHIEN_BAN_GIAO_THUC[0];
      return gui({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: v,
          capabilities: { tools: {} },
          serverInfo: { name: "ytm-cong", version: PHIEN_BAN_APP },
          instructions:
            "Cổng YTM phát nội dung skill YouTube Machine. Đầu mỗi phiên gọi ytm_trang_thai; chưa đăng nhập thì gọi ytm_dang_nhap. Đọc skill bằng ytm_doc.",
        },
      });
    }
    if (method === "ping") return coId && gui({ jsonrpc: "2.0", id, result: {} });
    if (method === "tools/list") return gui({ jsonrpc: "2.0", id, result: { tools: CONG_CU } });
    if (method === "tools/call") {
      const fn = XU_LY[params?.name];
      if (!fn) return gui({ jsonrpc: "2.0", id, error: { code: -32602, message: `Không có công cụ ${params?.name}` } });
      const kq = await fn(params.arguments ?? {});
      return gui({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: kq.text }], isError: !!kq.loi } });
    }
    if (method?.startsWith("notifications/")) return;
    if (coId) gui({ jsonrpc: "2.0", id, error: { code: -32601, message: `Không hỗ trợ ${method}` } });
  } catch (e) {
    log("lỗi:", e.stack || e.message);
    if (coId) {
      if (method === "tools/call") {
        gui({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Cổng YTM gặp lỗi: ${e.message}` }], isError: true } });
      } else gui({ jsonrpc: "2.0", id, error: { code: -32603, message: e.message } });
    }
  }
}

async function chayThu() {
  console.log(`Cổng YTM ${PHIEN_BAN_APP}`);
  console.log(`Tên máy: ${TEN_MAY} · người dùng: ${tenNguoiDung}`);
  console.log(`Dấu máy: ${DAU_MAY}`);
  console.log(`Phiên: ${TEP_PHIEN} ${phien ? `(có, ${phien.email})` : "(chưa có)"}`);
  if (process.argv.includes("--dang-nhap")) console.log((await congCuDangNhap({})).text);
  if (phien) console.log("\n" + (await congCuTrangThai()).text);
  if (process.argv.includes("--danh-sach")) console.log("\n" + (await congCuDanhSach()).text);
  const i = process.argv.indexOf("--doc");
  if (i > 0) console.log("\n" + (await congCuDoc({ duong_dan: process.argv[i + 1], trang: process.argv[i + 2] })).text);
  process.exit(0);
}

if (process.argv.includes("--phien-ban")) {
  // Cho tools/phien-ban.mjs: chỉ đọc, không đăng nhập, không gắn máy.
  let ra = { dang_nhap: false };
  if (phien) {
    const { status, j } = await goiHam("trang-thai");
    if (status === 200) {
      const q = j.quyen ?? {};
      ra = { dang_nhap: true, email: j.email, nguon: q.nguon, phien_ban: q.phien_ban, ban_moi_nhat: q.ban_moi_nhat, han_cap_nhat: q.han_cap_nhat };
    } else ra = { dang_nhap: status !== 401, loi: j.loi };
  }
  process.stdout.write(JSON.stringify(ra) + "\n");
  process.exit(0);
} else if (process.argv.includes("--thu")) {
  await chayThu();
} else {
  let dangChay = 0;
  let hetVao = false;
  const xongHet = () => hetVao && dangChay === 0 && process.exit(0);
  let dem = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (c) => {
    dem += c;
    let i;
    while ((i = dem.indexOf("\n")) >= 0) {
      const dong = dem.slice(0, i).trim();
      dem = dem.slice(i + 1);
      if (!dong) continue;
      let m;
      try {
        m = JSON.parse(dong);
      } catch {
        gui({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
        continue;
      }
      for (const x of Array.isArray(m) ? m : [m]) {
        dangChay++;
        xuLyThongDiep(x).finally(() => {
          dangChay--;
          xongHet();
        });
      }
    }
  });
  process.stdin.on("end", () => {
    hetVao = true;
    xongHet();
  });
  log(`Cổng YTM ${PHIEN_BAN_APP} sẵn sàng (${phien ? phien.email : "chưa đăng nhập"}).`);
}
