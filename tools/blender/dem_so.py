"""Số đếm nhảy và đồ họa chấm người, ra clip NNN-clip.mp4 để ghep_video.py dùng qua --thay.

  <python của Blender> dem_so.py <file JSON> <thư mục ra> <scenes.srt> <thư mục canh>

File JSON: {"115": {"kieu": "dem", "tu": 0, "den": 31, "nhan": "RATS CAUGHT", "mau": "#E3A33B", "bat_dau": 0.3, "dai": 1.6},
            "129": {"kieu": "cham", "so": 60, "nhom": 11, "nhan": "YOUR STREET  ·  60 PEOPLE", "mau": "#E3A33B"}}
- dem: ảnh cảnh đẩy máy nhẹ (1.00 → 1.06), con số chạy từ "tu" tới "den" (chậm dần về cuối) giữa khung,
  nền tối mờ phía sau chữ, nhãn nhỏ bên dưới. "hau_to" thêm sau số (ví dụ " YEARS").
- cham: nền giấy tối, "so" chấm chia thành "nhom" cụm (mỗi nhà một cụm) hiện dần theo sóng, nhãn dưới cùng.
Clip dài bằng khe cảnh + 0,6 giây như các công cụ --thay khác.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.stdout.reconfigure(encoding="utf-8")
FPS, W, H = 24, 1920, 1080
NEN = (28, 24, 22)
THU_MUC = os.path.dirname(os.path.abspath(__file__))
F_SO = os.path.join(THU_MUC, "fonts", "Anton-Regular.ttf")
F_NHAN = os.path.join(THU_MUC, "fonts", "SpecialElite-Regular.ttf")


def doc_khe(srt):
    t = open(srt, encoding="utf-8").read().replace("\r", "")
    moc = re.findall(r"(\d+):(\d+):(\d+)[,.](\d+) -->", t)
    g = [int(a) * 3600 + int(b) * 60 + int(c) + int(d) / 1000 for a, b, c, d in moc]
    return {i + 1: (g[i + 1] - g[i] if i + 1 < len(g) else 5.0) for i in range(len(g))}


def hex3(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ghi(khung, ra):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                          "-i", "-", "-vf", "format=yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", "medium", ra], stdin=subprocess.PIPE)
    for k in khung:
        p.stdin.write(k.tobytes())
    p.stdin.close()
    p.wait()


def chu_vien(d, xy, s, f, mau, vien=6):
    d.text(xy, s, font=f, fill=mau, anchor="mm", stroke_width=vien, stroke_fill=(15, 13, 12))


def dem(o, anh_goc, n):
    goc = Image.open(anh_goc).convert("RGB")
    goc = goc.resize((W, int(goc.height * W / goc.width))) if goc.width / goc.height < W / H else goc.resize((int(goc.width * H / goc.height), H))
    goc = goc.crop(((goc.width - W) // 2, (goc.height - H) // 2, (goc.width - W) // 2 + W, (goc.height - H) // 2 + H))
    f_so = ImageFont.truetype(F_SO, o.get("co", 260))
    f_nhan = ImageFont.truetype(F_NHAN, 54)
    mau = hex3(o.get("mau", "#E3A33B"))
    t0, dai = o.get("bat_dau", 0.3), o.get("dai", 1.6)
    a, b = o["tu"], o["den"]
    toi = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    yy = o.get("y", 0.46) - 0.46
    xx = o.get("x", 0.5) - 0.5
    ImageDraw.Draw(toi).ellipse((W * (0.18 + xx), H * (0.2 + yy), W * (0.82 + xx), H * (0.8 + yy)), fill=(0, 0, 0, 150))
    toi = toi.filter(ImageFilter.GaussianBlur(90))
    ds, truoc = [], None
    for k in range(n):
        t = k / FPS
        s = 1.0 + 0.06 * k / max(n - 1, 1)
        nen = goc.resize((int(W * s), int(H * s)))
        x0, y0 = (nen.width - W) // 2, (nen.height - H) // 2
        nen = nen.crop((x0, y0, x0 + W, y0 + H))
        hien = min(1.0, max(0.0, (t - t0 + 0.25) / 0.25))
        if hien <= 0:
            ds.append(nen)
            continue
        p = min(1.0, max(0.0, (t - t0) / dai))
        v = round(a + (b - a) * (1 - (1 - p) ** 3))
        lop = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        lop.alpha_composite(toi)
        d = ImageDraw.Draw(lop)
        nay = v != truoc and 0 < p < 1
        truoc = v
        y = o.get("y", 0.46)
        so_chu = f"{v:,}" if o.get("phay", True) else str(v)
        chu_vien(d, (W * o.get("x", 0.5), H * y - (6 if nay else 0)), f"{o.get('tien_to', '')}{so_chu}{o.get('hau_to', '')}", f_so, mau)
        if o.get("nhan"):
            chu_vien(d, (W * o.get("x", 0.5), H * (y + 0.2)), o["nhan"], f_nhan, (236, 226, 204), 4)
        r, g, bb, al = lop.split()
        lop.putalpha(al.point(lambda x: int(x * hien)))
        nen = nen.convert("RGBA")
        nen.alpha_composite(lop)
        ds.append(nen.convert("RGB"))
    return ds


def cham(o, n):
    r = np.random.default_rng(7)
    so, nhom = o["so"], o.get("nhom", 1)
    mau = hex3(o.get("mau", "#E3A33B"))
    f_nhan = ImageFont.truetype(F_NHAN, 52)
    # mỗi nhóm một cụm dọc hai bên "con phố"
    cot = (nhom + 1) // 2
    tam = []
    for i in range(nhom):
        hang = i % 2
        x = W * (0.12 + 0.76 * (i // 2) / max(cot - 1, 1))
        y = H * (0.34 if hang == 0 else 0.66)
        tam.append((x, y))
    chia = np.array_split(np.arange(so), nhom)
    diem = []
    for i, idx in enumerate(chia):
        for j, _ in enumerate(idx):
            g = 2 * np.pi * j / max(len(idx), 1)
            rr = 34 + 10 * (j % 2)
            diem.append((tam[i][0] + rr * np.cos(g) + r.uniform(-5, 5), tam[i][1] + rr * np.sin(g) + r.uniform(-5, 5), i))
    vao = np.array([x / W for x, _, _ in diem]) * 0.7
    ds = []
    for k in range(n):
        t = k / max(n - 1, 1)
        anh = Image.new("RGB", (W, H), NEN)
        d = ImageDraw.Draw(anh)
        d.line((W * 0.06, H / 2, W * 0.94, H / 2), fill=(70, 62, 56), width=6)
        for (cx, cy) in tam:
            d.rounded_rectangle((cx - 66, cy - 66, cx + 66, cy + 66), 14, outline=(80, 70, 62), width=3)
        for (x, y, i), v in zip(diem, vao):
            a = min(1.0, max(0.0, (t / 0.5 - v) * 4))
            if a <= 0:
                continue
            rr = 11 * (0.6 + 0.4 * a)
            c = tuple(int(NEN[q] + (mau[q] - NEN[q]) * a) for q in range(3))
            d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=c)
        if t > 0.2 and o.get("nhan"):
            chu_vien(d, (W / 2, H - 70), o["nhan"], f_nhan, (236, 226, 204), 3)
        ds.append(anh)
    return ds


def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    ra, khe, canh = sys.argv[2], doc_khe(sys.argv[3]), sys.argv[4]
    os.makedirs(ra, exist_ok=True)
    for so, o in cfg.items():
        if so.startswith("_"):
            continue
        n = round((khe[int(so)] + 0.6) * FPS)
        ds = dem(o, os.path.join(canh, f"{int(so):03d}-anh.jpg"), n) if o["kieu"] == "dem" else cham(o, n)
        ghi(ds, os.path.join(ra, f"{int(so):03d}-clip.mp4"))
        print(f"[dem_so] {int(so):03d}: {o['kieu']}, {n} khung")


main()
