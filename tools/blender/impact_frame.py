"""Impact frame kiểu anime cho clip: tới khoảnh khắc va chạm thì đóng băng vài khung, zoom đập, tách màu,
vệt tốc độ tỏa từ tâm và chớp trắng, rồi chạy tiếp. Ra clip mới cùng tên để ghep_video.py dùng qua --thay.

  <python của Blender> impact_frame.py <thư mục canh> <thư mục ra> 134:2.0 137:0.9 144:1.2 213:0.8 246:1.4

Mỗi mục là số cảnh:giây va chạm trong clip NNN-clip.mp4. Clip ra dài hơn clip gốc đúng phần đóng băng.
"""
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.stdout.reconfigure(encoding="utf-8")
FPS = 24
DONG_BANG = 5  # số khung đóng băng (~0,2 giây)


def vet_toc_do(w, h, ra, so_vet=90, seed=7):
    """PNG RGBA các vệt trắng nhọn tỏa từ mép vào, chừa vùng giữa trống."""
    r = np.random.default_rng(seed)
    anh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ve = ImageDraw.Draw(anh)
    cx, cy, R = w / 2, h / 2, math.hypot(w, h) / 2
    for _ in range(so_vet):
        g = r.uniform(0, 2 * math.pi)
        trong = r.uniform(0.42, 0.62) * R
        rong = r.uniform(0.004, 0.012)
        a = r.integers(110, 220)
        p = [(cx + math.cos(g) * trong, cy + math.sin(g) * trong),
             (cx + math.cos(g - rong) * R * 1.1, cy + math.sin(g - rong) * R * 1.1),
             (cx + math.cos(g + rong) * R * 1.1, cy + math.sin(g + rong) * R * 1.1)]
        ve.polygon(p, fill=(255, 255, 255, int(a)))
    anh.filter(ImageFilter.GaussianBlur(1.2)).save(ra)


def do(f):
    kq = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height",
                         "-of", "csv=p=0", f], capture_output=True, text=True, check=True).stdout.strip().split(",")
    return int(kq[0]), int(kq[1])


def main():
    canh, ra, muc = sys.argv[1], sys.argv[2], sys.argv[3:]
    os.makedirs(ra, exist_ok=True)
    for m in muc:
        so, t = m.split(":")
        so, t = int(so), float(t)
        vao = os.path.join(canh, f"{so:03d}-clip.mp4")
        w, h = do(vao)
        vet = os.path.join(ra, f"_vet-{w}x{h}.png")
        if not os.path.exists(vet):
            vet_toc_do(w, h, vet)
        dai = DONG_BANG / FPS
        f = (f"[0:v]fps={FPS},split=3[a][b][c];"
             f"[a]trim=0:{t},setpts=PTS-STARTPTS[p1];"
             f"[b]trim=start={t}:duration={1 / FPS:.4f},setpts=PTS-STARTPTS,loop={DONG_BANG - 1}:1:0,"
             f"scale={int(w * 1.14)}:{int(h * 1.14)},crop={w}:{h},rgbashift=rh=-9:bh=9:gv=3,eq=contrast=1.25:saturation=1.3[fz];"
             f"[fz][1:v]overlay=0:0:format=auto,fade=t=in:st=0:d={1.5 / FPS:.4f}:color=white,"
             f"trim=0:{dai:.4f},setpts=PTS-STARTPTS[p2];"
             f"[c]trim=start={t + 1 / FPS:.4f},setpts=PTS-STARTPTS,"
             f"scale={int(w * 1.06)}:{int(h * 1.06)},crop={w}:{h}[p3];"
             f"[p1][p2][p3]concat=n=3:v=1:a=0,format=yuv420p[o]")
        out = os.path.join(ra, f"{so:03d}-clip.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vao, "-loop", "1", "-i", vet, "-filter_complex", f,
                        "-map", "[o]", "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-an", out], check=True)
        print(f"[impact] {so:03d}: va chạm ở {t:.2f} giây, đóng băng {DONG_BANG} khung -> {out}")


main()
