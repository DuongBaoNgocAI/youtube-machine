"""Dựng Shorts dọc 9:16 từ các đoạn cảnh của một video.

Với mỗi Short: gọi ghep_video.py dựng từng đoạn ở khung dọc, rồi ffmpeg ghép các đoạn
(hòa nối 0,3 giây), giữ khung cuối 1,2 giây cho kịp đọc, tối dần, chuẩn hóa âm -14 LUFS.

  python cat_shorts.py <NNN.shorts.json> [--chi 2] [--blender D:\\Blender\\blender.exe]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

HOA = 0.3  # giây hòa nối giữa các đoạn
GIU = 1.2  # giây giữ khung cuối


def do_dai(ffprobe, path):
    out = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # console Windows mặc định cp1252
    p = argparse.ArgumentParser()
    p.add_argument("spec")
    p.add_argument("--chi", type=int, default=0, help="chỉ dựng Short thứ mấy (1, 2, 3...)")
    p.add_argument("--blender", default=os.environ.get("BLENDER") or shutil.which("blender") or r"D:\Blender\blender.exe")
    p.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    a = p.parse_args()
    ffprobe = shutil.which("ffprobe") or "ffprobe"

    goc = os.path.dirname(os.path.abspath(a.spec))
    with open(a.spec, encoding="utf-8") as f:
        spec = json.load(f)
    tuyet = lambda v: os.path.normpath(os.path.join(goc, v))  # Blender cần đường dẫn tuyệt đối, không có ".."
    ch = {k: (tuyet(v) if isinstance(v, str) else [tuyet(x) for x in v]) for k, v in spec["chung"].items()}
    ra = tuyet(spec.get("ra", "shorts"))
    tam = os.path.join(ra, "tam")
    os.makedirs(tam, exist_ok=True)
    ghep = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ghep_video.py")

    for i, sh in enumerate(spec["shorts"], 1):
        if a.chi and a.chi != i:
            continue
        manh = []
        for k, (tu, den) in enumerate(sh["doan"]):
            out = os.path.join(tam, f"{sh['ten']}-{k + 1}.mp4")
            cmd = [a.blender, "-b", "--factory-startup", "--python", ghep, "--",
                   "--canh", ch["canh"], "--scenes", ch["scenes"], "--srt", ch["srt"], "--audio", ch["audio"],
                   "--hieu-ung", ch["hieu_ung"], "--tu-canh", str(tu), "--den-canh", str(den),
                   "--doc", "--tieu-de", sh["tieu_de"].replace("\n", "\\n"), "--manh", "--out", out]
            for t in ch.get("thay", []):
                cmd += ["--thay", t]
            if ch.get("nhac"):  # nhạc nền có sẵn của video dài (không khai thì tự tạo nhạc gốc như cũ)
                cmd += ["--nhac", ch["nhac"]]
            if k > 0:
                cmd.append("--tieu-de-tinh")
            print(f"[cat_shorts] {sh['ten']}: dựng cảnh {tu}-{den}", flush=True)
            kq = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
            if kq.returncode != 0 or not os.path.exists(out):
                print(kq.stdout[-3000:], kq.stderr[-3000:])
                sys.exit(f"Lỗi khi dựng {sh['ten']} cảnh {tu}-{den}")
            manh.append(out)

        dai = [do_dai(ffprobe, m) for m in manh]
        tong = sum(dai) - HOA * (len(dai) - 1)
        loc, v, am = [], "[0:v]", "[0:a]"
        moc = 0.0
        for k in range(1, len(manh)):
            moc += dai[k - 1] - HOA
            loc.append(f"{v}[{k}:v]xfade=transition=fade:duration={HOA}:offset={moc:.3f}[v{k}]")
            loc.append(f"{am}[{k}:a]acrossfade=d={HOA}[a{k}]")
            v, am = f"[v{k}]", f"[a{k}]"
        ket = tong + GIU
        loc.append(f"{v}tpad=stop_mode=clone:stop_duration={GIU},fade=t=out:st={ket - 0.6:.3f}:d=0.6[vo]")
        loc.append(f"{am}apad=pad_dur={GIU},afade=t=out:st={ket - 0.9:.3f}:d=0.9,"
                   "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.7:attack=1:release=60:level=false[ao]")
        out = os.path.join(ra, f"{sh['ten']}.mp4")
        cmd = [a.ffmpeg, "-v", "error", "-y"]
        for m in manh:
            cmd += ["-i", m]
        cmd += ["-filter_complex", ";".join(loc), "-map", "[vo]", "-map", "[ao]", "-t", f"{ket:.3f}",
                "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
        subprocess.run(cmd, check=True)
        print(f"[cat_shorts] Xong {out} ({ket:.1f} giây)", flush=True)
    shutil.rmtree(tam, ignore_errors=True)


if __name__ == "__main__":
    main()
