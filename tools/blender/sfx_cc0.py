"""Trộn mẫu âm thanh CC0 của Kenney (sfx-cc0/rpg-audio, sfx-cc0/impact-sounds) thành bộ SFX trận đánh cổ đại.

  python sfx_cc0.py        # ghi sfx-cc0/tron/<tên>.wav (bỏ qua file đã có)

Mỗi tiếng là nhiều lớp mẫu chồng nhau (gỗ + ván + tiếng trầm cho giáo cắm khiên, kim loại nặng + lá thép
cho kiếm chạm...), thêm vang, để nghe dày hơn mẫu gốc. ghep_video.py nạp cả thư mục tron/ vào bộ SFX,
gọi bằng tên file (không đuôi) trong khóa "sfx" của file hiệu ứng.
Giấy phép: Creative Commons CC0 (sfx-cc0/*/License.txt), dùng thương mại không cần ghi công.
"""
import glob
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from am_thanh import SR, ghi_wav, loc, noi_vong, stereo, vang  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")
GOC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sfx-cc0")
RA = os.path.join(GOC, "tron")


def doc(ten):
    """Đọc một mẫu .ogg (tìm theo tên trong cả hai gói) thành mảng mono SR Hz."""
    p = glob.glob(os.path.join(GOC, "**", ten + ".ogg"), recursive=True)
    if not p:
        sys.exit(f"Không thấy mẫu {ten}")
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p[0], "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def chong(*lop, dai=None):
    """Chồng các lớp (mảng, độ trễ giây, độ lớn)."""
    n = dai or max(int(tre * SR) + len(x) for x, tre, _ in lop)
    y = np.zeros(n)
    for x, tre, g in lop:
        i = int(tre * SR)
        k = min(len(x), n - i)
        if k > 0:
            y[i:i + k] += x[:k] * g
    return y


def tram(dur=0.5, f=60, r=None):
    """Tiếng thịch trầm đỡ dưới cho cú va."""
    t = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * np.cumsum(f + 60 * np.exp(-t * 25)) / SR) * np.exp(-t * 12)


def chuan(st, muc=0.9):
    return st / (np.max(np.abs(st)) or 1) * muc


def tao():
    r = np.random.default_rng(11)
    ds = {}
    for k in range(3):  # giáo cắm vào khiên gỗ
        ds[f"khien-trung-{k + 1}"] = chuan(vang(stereo(chong(
            (doc(f"impactWood_heavy_00{k}"), 0, 1.0), (doc(f"impactPlank_medium_00{k + 1}"), 0.005, 0.6),
            (tram(0.4, 55), 0, 0.7), (doc(f"impactGeneric_light_00{k}"), 0.01, 0.3)), r.uniform(-0.4, 0.4)), 0.2, 0.7, 6))
    for k in range(3):  # kiếm, giáo sắt chạm nhau
        ds[f"kiem-va-{k + 1}"] = chuan(vang(stereo(chong(
            (doc(f"impactMetal_heavy_00{k}"), 0, 1.0), (doc(f"impactPlate_medium_00{k + 2}"), 0.004, 0.6),
            (doc("knifeSlice" if k % 2 == 0 else "knifeSlice2"), 0, 0.35)), r.uniform(-0.3, 0.3)), 0.25, 1.0, 5))
    ds["rut-kiem"] = chuan(vang(stereo(chong((doc("drawKnife2"), 0, 1.0), (doc("clothBelt"), 0, 0.4))), 0.15, 0.6, 8), 0.8)
    ds["dap-thung"] = chuan(vang(stereo(chong(
        (doc("impactWood_heavy_003"), 0, 1.0), (doc("impactPlank_medium_000"), 0.03, 0.8),
        (doc("creak2"), 0.05, 0.5), (tram(0.5, 50), 0, 0.6))), 0.25, 0.8, 5))
    ds["ren-sat"] = chuan(vang(stereo(chong(
        (doc("impactMetal_heavy_003"), 0, 1.0), (doc("impactBell_heavy_001"), 0, 0.35), (doc("impactMining_002"), 0.01, 0.4))), 0.3, 1.2, 4))
    ds["giap"] = chuan(stereo(chong((doc("clothBelt2"), 0, 1.0), (doc("beltHandle1"), 0.08, 0.7), (doc("cloth3"), 0.02, 0.5))), 0.7)
    ds["dam-trung"] = chuan(vang(stereo(chong((doc("impactPunch_heavy_002"), 0, 1.0), (tram(0.35, 45), 0, 0.8))), 0.15, 0.5, 8))
    ds["bun"] = chuan(stereo(loc(chong((doc("footstep_snow_002"), 0, 1.0), (doc("footstep_grass_001"), 0.02, 0.7)), 0, 2500)), 0.7)

    # Đoàn quân hành quân trong bùn: hàng chục người bước lệch nhịp + tiếng giáp lách cách, nối vòng 10 giây.
    dur = 10.0
    n = int((dur + 1) * SR)
    nen = np.zeros(n)
    buoc = [loc(doc(f"footstep_grass_00{k}"), 0, 3000) for k in range(5)] + [loc(doc(f"footstep_snow_00{k}"), 0, 2500) for k in range(5)]
    leng = [doc(x) for x in ("beltHandle1", "beltHandle2", "clothBelt", "metalClick", "handleSmallLeather")]
    for _ in range(26):  # mỗi người một nhịp bước
        chu_ky, moc, g = r.uniform(0.52, 0.6), r.uniform(0, 0.6), r.uniform(0.15, 0.5)
        while moc < dur + 1:
            x = buoc[r.integers(len(buoc))]
            i = int(moc * SR)
            k = min(len(x), n - i)
            if k > 0:
                nen[i:i + k] += x[:k] * g
            moc += chu_ky * r.uniform(0.96, 1.04)
    for _ in range(int(dur * 3)):
        x = leng[r.integers(len(leng))]
        i = r.integers(0, n - len(x))
        nen[i:i + len(x)] += x * r.uniform(0.05, 0.18)
    st = noi_vong(vang(np.stack([nen, np.roll(nen, 2300)], 1), 0.3, 1.2, 3, 3000))
    ds["hanh-quan"] = chuan(st, 0.7)

    os.makedirs(RA, exist_ok=True)
    for ten, x in ds.items():
        p = os.path.join(RA, ten + ".wav")
        if not os.path.exists(p):
            ghi_wav(p, x)
    print(f"[sfx_cc0] {len(ds)} tiếng trong {RA}")


if __name__ == "__main__":
    tao()
