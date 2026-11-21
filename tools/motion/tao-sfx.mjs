// Tạo bộ tiếng ngắn cho motion bằng ffmpeg, tự sinh từ nhiễu và sóng sin nên không vướng giấy phép.
// Dùng: node tools/motion/tao-sfx.mjs <thư mục ra>
// Ra: whoosh, whoosh-nho, tick, pop, thud, stamp, riser, tape-tua, tape-dung, tape-chay (.wav 48 kHz stereo).
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ra = path.resolve(process.argv[2] || ".");
fs.mkdirSync(ra, { recursive: true });

// Mỗi tiếng: nguồn lavfi và chuỗi lọc.
const BO = {
  whoosh: {
    nguon: "anoisesrc=d=0.55:c=pink:r=48000:a=0.9",
    loc: "bandpass=f=900:width_type=o:w=2.2,afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.28:d=0.27:curve=exp,volume=1.6",
  },
  "whoosh-nho": {
    nguon: "anoisesrc=d=0.28:c=pink:r=48000:a=0.9",
    loc: "highpass=f=700,lowpass=f=5200,afade=t=in:d=0.12:curve=exp,afade=t=out:st=0.12:d=0.16:curve=exp",
  },
  tick: {
    nguon: "sine=f=2400:r=48000:d=0.05",
    loc: "afade=t=out:d=0.05:curve=exp,highpass=f=900,volume=0.9",
  },
  pop: {
    nguon: "aevalsrc='0.9*sin(2*PI*(520-1500*t)*t)*exp(-22*t)':s=48000:d=0.18",
    loc: "volume=1.1",
  },
  thud: {
    nguon: "aevalsrc='0.95*sin(2*PI*(92-70*t)*t)*exp(-7*t)':s=48000:d=0.65",
    loc: "lowpass=f=320,volume=1.6",
  },
  stamp: {
    nguon: "anoisesrc=d=0.16:c=brown:r=48000:a=1",
    loc: "lowpass=f=1500,afade=t=out:d=0.16:curve=exp,volume=2.2",
  },
  riser: {
    nguon: "aevalsrc='0.5*sin(2*PI*(180+520*t*t)*t)':s=48000:d=1.2",
    loc: "afade=t=in:d=1.0:curve=exp,afade=t=out:st=1.12:d=0.08",
  },
  // Tiếng băng từ của kênh kể chuyện: tua nhanh, dừng băng, băng chạy lại.
  "tape-tua": {
    nguon: "aevalsrc='0.42*sin(2*PI*(760+260*sin(2*PI*17*t))*t)+0.2*sin(2*PI*(1900+420*sin(2*PI*23*t))*t)':s=48000:d=1.1",
    loc: "highpass=f=320,lowpass=f=6000,tremolo=f=34:d=0.55,afade=t=in:d=0.05,afade=t=out:st=0.95:d=0.15",
  },
  "tape-dung": {
    nguon: "aevalsrc='0.8*sin(2*PI*(1500-3800*t)*t)*exp(-13*t)':s=48000:d=0.26",
    loc: "highpass=f=180,volume=0.9",
  },
  "tape-chay": {
    nguon: "anoisesrc=d=0.4:c=white:r=48000:a=0.22",
    loc: "bandpass=f=3100:width_type=o:w=1.4,tremolo=f=48:d=0.4,afade=t=out:st=0.3:d=0.1",
  },
};

let loi = 0;
for (const [ten, { nguon, loc }] of Object.entries(BO)) {
  const f = path.join(ra, ten + ".wav");
  const r = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", nguon, "-af", `${loc},aformat=sample_rates=48000:channel_layouts=stereo`, f], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error("Lỗi khi tạo " + ten);
    loi++;
  }
}
console.log(`Xong ${Object.keys(BO).length - loi} tiếng ở ${ra}`);
process.exit(loi ? 1 : 0);
