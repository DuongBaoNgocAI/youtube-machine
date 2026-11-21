"""Tách ảnh cảnh thành hai lớp cho parallax 2.5D: người / vật chính (rembg) và nền đã vá chỗ trống.

  <python của Blender> tach_lop.py <thư mục canh> <thư mục ra> 3 12 52 98

Ra: NNN-nguoi.png (RGBA, cùng cỡ ảnh gốc) và NNN-nen.png (RGB). Chỗ người đứng ở nền được vá bằng LaMa
(models/lama_fp32.onnx) khi có, không thì bằng kéo-đẩy
nhiều tầng (lấy màu xung quanh lan vào), rồi làm mờ nhẹ, đủ cho máy quay chỉ lộ một dải mép nhỏ.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

sys.stdout.reconfigure(encoding="utf-8")


def va_nen(anh, lo):
    """Lấp vùng lo (True = cần lấp) bằng kéo-đẩy: thu nhỏ có trọng số tới khi kín, rồi phóng ngược lấp dần."""
    tang = [(anh * (~lo)[..., None], (~lo).astype(np.float64))]
    while min(tang[-1][1].shape) > 4:
        x, w = tang[-1]
        h2, w2 = x.shape[0] // 2 * 2, x.shape[1] // 2 * 2
        x, w = x[:h2, :w2], w[:h2, :w2]
        xs = x.reshape(h2 // 2, 2, w2 // 2, 2, 3).sum((1, 3))
        ws = w.reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))
        tang.append((xs, ws))
    mau = tang[-1][0] / np.maximum(tang[-1][1], 1e-6)[..., None]
    for x, w in reversed(tang[:-1]):
        lon = np.asarray(Image.fromarray(np.clip(mau, 0, 255).astype(np.uint8)).resize((x.shape[1], x.shape[0]), Image.BILINEAR), np.float64)
        co = w > 0
        rieng = x / np.maximum(w, 1e-6)[..., None]
        trong = np.clip(w / 4, 0, 1)[..., None]  # ô có ít điểm biết thì pha với tầng thô
        mau = np.where(co[..., None], rieng * trong + lon * (1 - trong), lon)
    return mau


LAMA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "lama_fp32.onnx")  # Carve/LaMa-ONNX, Apache-2.0


def va_lama(phien, anh, lo):
    """Vá bằng LaMa (đầu vào cố định 512x512): co cả ảnh về 512, vá, phóng lại, chỉ lấy phần trong vùng lo."""
    h, w = lo.shape
    x = np.asarray(Image.fromarray(anh.astype(np.uint8)).resize((512, 512), Image.LANCZOS), np.float32) / 255
    m = np.asarray(Image.fromarray((lo * 255).astype(np.uint8)).resize((512, 512), Image.BILINEAR), np.float32) / 255
    m = (m > 0.1).astype(np.float32)
    ra = phien.run(None, {"image": x.transpose(2, 0, 1)[None], "mask": m[None, None]})[0][0].transpose(1, 2, 0)
    return np.asarray(Image.fromarray(np.clip(ra, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS), np.float64)


def main():
    canh, ra, so = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3:]]
    os.makedirs(ra, exist_ok=True)
    phien = new_session("bria-rmbg")
    lama = None
    if os.path.exists(LAMA):
        import onnxruntime
        lama = onnxruntime.InferenceSession(LAMA, providers=["CPUExecutionProvider"])
    for n in so:
        goc = Image.open(os.path.join(canh, f"{n:03d}-anh.jpg")).convert("RGB")
        nguoi = remove(goc, session=phien, post_process_mask=True)
        nguoi.save(os.path.join(ra, f"{n:03d}-nguoi.png"))
        a = np.asarray(nguoi.split()[-1])
        anh = np.asarray(goc, np.float64)
        if lama:
            # LaMa vá ra đúng cảnh nền nên xóa cả viền người (nới 6 px): lớp người trượt đi không để lại nét viền ma.
            lo = np.asarray(Image.fromarray(((a > 20) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 0
            vien = np.asarray(Image.fromarray((lo * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float64)[..., None] / 255
            nen = anh * (1 - vien) + va_lama(lama, anh, lo) * vien
        else:
            # Kéo-đẩy chỉ vá lõi đặc của người; dải viền mềm giữ pixel gốc, để viền lớp người (bán trong suốt)
            # pha đúng với chính nó ở khung đầu, không bị quầng sáng từ màu vá.
            lo = a > 235
            nen = va_nen(anh, lo)
            mo = Image.fromarray(np.clip(nen, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
            nen = np.where(lo[..., None], np.asarray(mo, np.float64), anh)
        Image.fromarray(np.clip(nen, 0, 255).astype(np.uint8)).save(os.path.join(ra, f"{n:03d}-nen.png"))
        print(f"[tach_lop] {n:03d}: người chiếm {lo.mean() * 100:.0f}% khung, vá bằng {'LaMa' if lama else 'kéo-đẩy'}")


main()
