// Dò cấu hình máy và công cụ, rồi đề xuất đường dựng video (Blender hay CapCut).
// Dùng: node tools/do-may.mjs [--json]
// Chỉ đọc, không cài gì, không ghi file. Chạy được trên Windows, macOS, Linux.
// Ngưỡng là ước lượng từ kinh nghiệm dựng trên RTX 3060 Ti 8 GB, 32 GB RAM; người dùng là người chốt.
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const CHO = 20000;
const nen = process.platform;

function chay(lenh, ...thamSo) {
  try {
    return execFileSync(lenh, thamSo, { encoding: "utf8", timeout: CHO, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function tim(lenh) {
  const dong = chay(nen === "win32" ? "where" : "which", lenh).split(/\r?\n/)[0];
  return dong || null;
}

function dauTienCo(...duongDan) {
  return duongDan.filter(Boolean).find((p) => fs.existsSync(p)) || null;
}

function gpus() {
  const nv = chay("nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits");
  if (nv) {
    return nv.split(/\r?\n/).map((d) => {
      const [ten, mb] = d.split(",").map((s) => s.trim());
      return { ten, vram_gb: Math.round(Number(mb) / 1024), roi: true };
    });
  }
  if (nen === "win32") {
    const r = chay("powershell", "-NoProfile", "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress");
    if (!r) return [];
    return [].concat(JSON.parse(r)).map((g) => ({
      ten: g.Name,
      vram_gb: g.AdapterRAM ? Math.round(g.AdapterRAM / 1024 ** 3) : null,
      roi: /nvidia|geforce|radeon|\barc\b/i.test(g.Name || ""),
    }));
  }
  if (nen === "darwin") {
    const r = chay("system_profiler", "SPDisplaysDataType");
    const ten = r.match(/Chipset Model:\s*(.+)/)?.[1];
    // Apple Silicon dùng chung RAM với GPU nên không có số VRAM riêng.
    return ten ? [{ ten, vram_gb: null, roi: /apple m\d/i.test(ten) }] : [];
  }
  return chay("lspci").split(/\r?\n/).filter((d) => /vga|3d controller/i.test(d)).map((d) => ({
    ten: d.replace(/^.*?:\s*/, ""),
    vram_gb: null,
    roi: /nvidia|radeon/i.test(d),
  }));
}

function ocTrong(thuMuc) {
  try {
    const s = fs.statfsSync(thuMuc);
    return Math.round((s.bavail * s.bsize) / 1024 ** 3);
  } catch {
    return null;
  }
}

function timBlender() {
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  let cacBan = [];
  try {
    cacBan = fs.readdirSync(path.join(pf, "Blender Foundation")).sort().reverse()
      .map((d) => path.join(pf, "Blender Foundation", d, "blender.exe"));
  } catch {}
  return dauTienCo(process.env.BLENDER, tim("blender"), "D:\\Blender\\blender.exe", ...cacBan,
    "/Applications/Blender.app/Contents/MacOS/Blender", "/usr/bin/blender", "/snap/bin/blender");
}

function timCapCut() {
  const local = process.env.LOCALAPPDATA;
  return dauTienCo(
    local && path.join(local, "CapCut", "Apps", "CapCut.exe"),
    "/Applications/CapCut.app",
    path.join(os.homedir(), "Applications", "CapCut.app"),
  );
}

// Tách lớp parallax cần rembg trong Python của Blender.
function coTachLop(blender) {
  if (!blender) return false;
  const goc = path.dirname(blender);
  let thuMucBan = [];
  try {
    thuMucBan = fs.readdirSync(goc).filter((d) => /^\d+\.\d+$/.test(d));
  } catch {}
  for (const ban of thuMucBan) {
    const py = dauTienCo(path.join(goc, ban, "python", "bin", "python.exe"), path.join(goc, ban, "python", "bin", "python3.11"));
    if (py && chay(py, "-c", "import rembg;print('ok')") === "ok") return true;
  }
  return false;
}

// RIFE (rife-ncnn-vulkan) làm chậm clip mượt hơn; không bắt buộc.
function coRife() {
  const goc = path.join(path.dirname(fileURLToPath(import.meta.url)), "rife");
  try {
    for (const d of fs.readdirSync(goc)) {
      for (const ten of ["rife-ncnn-vulkan.exe", "rife-ncnn-vulkan"]) {
        if (fs.existsSync(path.join(goc, d, ten))) return path.join(goc, d, ten);
      }
    }
  } catch {}
  return null;
}

const blender = timBlender();
const banBlender = blender ? chay(blender, "--version").split(/\r?\n/)[0] : "";
const dsGpu = gpus();
const gpuRoi = dsGpu.filter((g) => g.roi);
const vram = Math.max(0, ...gpuRoi.map((g) => g.vram_gb ?? 0));
const appleSilicon = dsGpu.some((g) => /apple m\d/i.test(g.ten));
const ramGb = Math.round(os.totalmem() / 1024 ** 3);
const trong = ocTrong(process.cwd());
const ffmpeg = tim("ffmpeg");
const capcut = timCapCut();

const may = {
  he_dieu_hanh: `${nen} ${os.release()}`,
  cpu: `${os.cpus()[0]?.model?.trim() ?? "?"} (${os.cpus().length} luồng)`,
  ram_gb: ramGb,
  gpu: dsGpu,
  o_trong_gb: trong,
  blender,
  ban_blender: banBlender,
  blender_tach_lop_parallax: coTachLop(blender),
  capcut,
  ffmpeg,
  node: process.version,
  bash: tim("bash"),
  flow_aic: fs.existsSync(path.join(os.homedir(), "FlowStudio", "control.json")),
  rife: coRife(),
};

const lyDo = [];
const canhBao = [];
const manh = (vram >= 6 || (appleSilicon && ramGb >= 24)) && ramGb >= 16;
const vua = (vram >= 4 || appleSilicon || gpuRoi.length > 0) && ramGb >= 16;
const duO = trong === null || trong >= 30;

let duong;
if (blender && ffmpeg && manh && duO) {
  duong = "blender-day-du";
  lyDo.push(`GPU ${vram ? vram + " GB VRAM" : "Apple Silicon"} và ${ramGb} GB RAM đủ cho toàn bộ quy trình Blender`);
} else if (blender && ffmpeg && vua && duO) {
  duong = "blender-co-ban";
  lyDo.push("Blender chạy được nhưng máy không dư sức: bỏ lớp phủ nặng, ít parallax, render lâu hơn");
} else if (capcut) {
  duong = "capcut";
  lyDo.push("CapCut nhẹ, không phải render trước từng hiệu ứng");
  if (!blender) lyDo.push("máy chưa có Blender");
  else if (!ffmpeg) lyDo.push("máy chưa có ffmpeg nên công cụ Blender không chạy được");
  else if (!vua) lyDo.push(`máy (${ramGb} GB RAM, ${vram || "không rõ"} GB VRAM) yếu cho Blender`);
  else if (!duO) lyDo.push(`ổ đĩa chỉ còn ${trong} GB, Blender cần từ 30 GB`);
} else {
  duong = nen === "linux" ? "cai-blender" : "cai-capcut";
  lyDo.push(nen === "linux"
    ? "CapCut không có bản Linux, cần cài Blender và ffmpeg"
    : "chưa có công cụ dựng; CapCut dễ bắt đầu nhất, hoặc xuất thẳng MP4 từ Flow AIC nếu đủ dùng");
}

if (blender && !/Blender 5\./.test(banBlender)) canhBao.push("Công cụ Blender mới chỉ chạy thử trên bản 5.2, bản khác có thể lỗi API");
if (blender && !may.blender_tach_lop_parallax) canhBao.push("Python của Blender chưa có rembg, chưa tách lớp parallax được");
if (nen !== "win32" && nen !== "darwin") canhBao.push("CapCut không có bản cho hệ điều hành này");
if (trong !== null && trong < 30) canhBao.push(`Ổ đĩa còn ${trong} GB, mỗi video Blender có thể chiếm 2-4 GB và lớp phủ thêm khoảng 4 GB`);
if (!may.flow_aic) canhBao.push("Chưa thấy Flow AIC trên máy này; bước tạo hình sẽ đưa prompt để bạn dùng công cụ khác. Tải tại https://github.com/DuongBaoNgocAI/flow-aic-releases/releases/latest");

const ketQua = { may, de_xuat: duong, ly_do: lyDo, canh_bao: canhBao };

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(ketQua, null, 2));
} else {
  console.log(`Hệ điều hành : ${may.he_dieu_hanh}`);
  console.log(`CPU          : ${may.cpu}`);
  console.log(`RAM          : ${ramGb} GB`);
  console.log(`GPU          : ${dsGpu.map((g) => g.ten + (g.vram_gb ? ` (${g.vram_gb} GB)` : "")).join(", ") || "không rõ"}`);
  console.log(`Ổ trống      : ${trong ?? "?"} GB (ổ đang đứng)`);
  console.log(`Blender      : ${blender ? `${banBlender} tại ${blender}` : "chưa có"}`);
  console.log(`Tách lớp     : ${may.blender_tach_lop_parallax ? "có rembg" : "chưa có"}`);
  console.log(`CapCut       : ${capcut ?? "chưa có"}`);
  console.log(`ffmpeg       : ${ffmpeg ?? "chưa có"}`);
  console.log(`Flow AIC     : ${may.flow_aic ? "có" : "chưa thấy"}`);
  console.log(`RIFE         : ${may.rife ? "có (làm chậm clip mượt)" : "chưa có (không bắt buộc)"}`);
  console.log(`\nĐề xuất: ${duong}`);
  lyDo.forEach((d) => console.log(`  - ${d}`));
  if (canhBao.length) console.log("Lưu ý:");
  canhBao.forEach((d) => console.log(`  - ${d}`));
}
