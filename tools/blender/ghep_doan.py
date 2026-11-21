"""Ghép các đoạn đã duyệt (dựng bằng ghep_video.py --manh / --doan-cuoi) thành một video.

  python ghep_doan.py --ra 5-xuat/NNN-slug.mp4 4-dung/doan/doan-01.mp4 4-dung/doan/doan-02.mp4 ...

- Hình nối thẳng, không nén lại (các đoạn cùng một máy dựng nên cùng codec, cỡ khung, fps).
- Tiếng giải mã từng đoạn rồi nối liền, chuẩn hóa -14 LUFS (đỉnh -1,5 dBTP) một lần cho cả video.
- Đoạn cuối nên dựng bằng --doan-cuoi để có tối dần cuối; nếu không, nhỏ dần tiếng 0,5 giây cuối ở đây.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile


def thong_so(ffprobe, f):
    r = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=codec_name,width,height,r_frame_rate:format=duration", "-of", "json", f],
                       capture_output=True, text=True, check=True)
    j = json.loads(r.stdout)
    s = j["streams"][0]
    return (s["codec_name"], s["width"], s["height"], s["r_frame_rate"]), float(j["format"]["duration"])


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser()
    p.add_argument("doan", nargs="+", help="các file đoạn theo đúng thứ tự")
    p.add_argument("--ra", required=True)
    p.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    p.add_argument("--ffprobe", default=shutil.which("ffprobe") or "ffprobe")
    p.add_argument("--nho-dan-cuoi", action="store_true", help="nhỏ dần tiếng 0,5 giây cuối (khi đoạn cuối không dựng bằng --doan-cuoi)")
    a = p.parse_args()

    thieu = [f for f in a.doan if not os.path.exists(f)]
    if thieu:
        sys.exit(f"Thiếu file đoạn: {thieu}")
    ts = [thong_so(a.ffprobe, f) for f in a.doan]
    goc = ts[0][0]
    lech = [(f, t[0]) for f, t in zip(a.doan, ts) if t[0] != goc]
    if lech:
        sys.exit(f"Đoạn khác thông số với {a.doan[0]} {goc}: {lech}. Dựng lại bằng cùng lệnh rồi ghép.")
    tong = sum(t[1] for t in ts)

    os.makedirs(os.path.dirname(os.path.abspath(a.ra)), exist_ok=True)
    tam = tempfile.mkdtemp(prefix="ghep_doan_")
    try:
        ds = os.path.join(tam, "ds.txt")
        with open(ds, "w", encoding="utf-8") as f:
            for d in a.doan:
                f.write("file '" + os.path.abspath(d).replace("\\", "/").replace("'", "'\\''") + "'\n")
        hinh = os.path.join(tam, "hinh.mp4")
        subprocess.run([a.ffmpeg, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", ds,
                        "-map", "0:v", "-c", "copy", hinh], check=True)

        vao = []
        for d in a.doan:
            vao += ["-i", d]
        n = len(a.doan)
        loc = "".join(f"[{i}:a]" for i in range(n)) + f"concat=n={n}:v=0:a=1"
        if a.nho_dan_cuoi:
            loc += f",afade=t=out:st={max(tong - 0.5, 0):.3f}:d=0.5"
        loc += ",loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.7:attack=1:release=60:level=false[ao]"
        tieng = os.path.join(tam, "tieng.m4a")
        subprocess.run([a.ffmpeg, "-v", "error", "-y", *vao, "-filter_complex", loc, "-map", "[ao]",
                        "-c:a", "aac", "-b:a", "192k", tieng], check=True)

        subprocess.run([a.ffmpeg, "-v", "error", "-y", "-i", hinh, "-i", tieng, "-map", "0:v", "-map", "1:a",
                        "-c", "copy", "-shortest", "-movflags", "+faststart", a.ra], check=True)
    finally:
        shutil.rmtree(tam, ignore_errors=True)

    _, dai = thong_so(a.ffprobe, a.ra)
    print(f"[ghep_doan] {n} đoạn, tổng {tong:.2f} giây, file ra {dai:.2f} giây -> {a.ra}")
    if abs(dai - tong) > 0.5:
        print("[ghep_doan] CẢNH BÁO: độ dài file ra lệch tổng các đoạn quá 0,5 giây, xem lại các điểm nối.")


if __name__ == "__main__":
    main()
