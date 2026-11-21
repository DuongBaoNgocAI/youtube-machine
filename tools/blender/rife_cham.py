"""Làm chậm clip bằng RIFE (vẽ khung giữa bằng AI), thiếu RIFE thì trộn khung bằng ffmpeg như cũ.

Dùng trong mã:   import rife_cham; rife_cham.lam_cham(nguon, so_khung_moi, ra, ffmpeg="ffmpeg", fps=24)
Dòng lệnh:       python rife_cham.py <nguồn.mp4> <ra.mp4> --lan 2        (chậm 2 lần)
                 python rife_cham.py <nguồn.mp4> <ra.mp4> --khung 300    (đủ 300 khung)

RIFE là rife-ncnn-vulkan (chạy bằng card đồ họa qua Vulkan), tìm theo thứ tự:
biến môi trường RIFE_NCNN, rồi tools/rife/*/rife-ncnn-vulkan(.exe). Model mặc định rife-v4.6.
Bỏ tiếng. Ra H.264 yuv420p, đúng `so_khung_moi` khung ở `fps`.
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys
import tempfile

GOC = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
MODEL = "rife-v4.6"


def tim_rife():
    exe = os.environ.get("RIFE_NCNN")
    if exe and os.path.isfile(exe):
        return exe
    for ten in ("rife-ncnn-vulkan.exe", "rife-ncnn-vulkan"):
        ds = sorted(glob.glob(os.path.join(GOC, "tools", "rife", "*", ten)))
        if ds:
            return ds[-1]
    return None


def dem_khung(ffprobe, path):
    r = subprocess.run([ffprobe, "-v", "error", "-count_frames", "-select_streams", "v:0",
                        "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", path],
                       capture_output=True, text=True, check=True)
    return int(r.stdout.strip().split(",")[0])


def _tron_khung(ffmpeg, nguon, co, so_khung_moi, ra, fps):
    subprocess.run([ffmpeg, "-v", "error", "-y", "-i", nguon, "-an",
                    "-vf", f"setpts=PTS*{so_khung_moi / co:.5f},minterpolate=fps={fps}:mi_mode=blend,tpad=stop_mode=clone:stop_duration=1",
                    "-frames:v", str(so_khung_moi),
                    "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", ra], check=True)


def lam_cham(nguon, so_khung_moi, ra, ffmpeg="ffmpeg", fps=24, co=None, rife=True, model=MODEL, bao=print):
    """Trả về 'rife' hoặc 'tron' (cách đã dùng). `co` là số khung nguồn, bỏ trống thì tự đếm."""
    ffprobe = os.path.join(os.path.dirname(ffmpeg), "ffprobe" + (".exe" if ffmpeg.lower().endswith(".exe") else "")) \
        if os.path.dirname(ffmpeg) else "ffprobe"
    if co is None:
        co = dem_khung(ffprobe if shutil.which(ffprobe) or os.path.isfile(ffprobe) else "ffprobe", nguon)
    os.makedirs(os.path.dirname(os.path.abspath(ra)), exist_ok=True)
    exe = tim_rife() if rife else None
    if exe and so_khung_moi > co:
        tam = tempfile.mkdtemp(prefix="rife_")
        try:
            vao, ket = os.path.join(tam, "vao"), os.path.join(tam, "ra")
            os.makedirs(vao)
            os.makedirs(ket)
            subprocess.run([ffmpeg, "-v", "error", "-y", "-i", nguon, "-frames:v", str(co),
                            os.path.join(vao, "%08d.png")], check=True)
            thuc = len(os.listdir(vao))
            md = os.path.join(os.path.dirname(exe), model)
            kq = subprocess.run([exe, "-i", vao, "-o", ket, "-m", md, "-n", str(so_khung_moi)],
                                capture_output=True, text=True, cwd=os.path.dirname(exe))
            if kq.returncode == 0 and len(os.listdir(ket)) >= so_khung_moi:
                subprocess.run([ffmpeg, "-v", "error", "-y", "-framerate", str(fps), "-i", os.path.join(ket, "%08d.png"),
                                "-frames:v", str(so_khung_moi),
                                "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-pix_fmt", "yuv420p", ra], check=True)
                bao(f"[rife_cham] RIFE {thuc} -> {so_khung_moi} khung: {os.path.basename(ra)}")
                return "rife"
            bao(f"[rife_cham] RIFE lỗi (mã {kq.returncode}), dùng trộn khung: {kq.stderr[-300:]}")
        finally:
            shutil.rmtree(tam, ignore_errors=True)
    elif rife and not exe:
        bao("[rife_cham] Chưa có RIFE (tools/rife/), dùng trộn khung ffmpeg.")
    _tron_khung(ffmpeg, nguon, co, so_khung_moi, ra, fps)
    return "tron"


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser()
    p.add_argument("nguon")
    p.add_argument("ra")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--lan", type=float, help="chậm bao nhiêu lần (2 = dài gấp đôi)")
    g.add_argument("--khung", type=int, help="số khung muốn có")
    p.add_argument("--fps", type=int, default=24)
    p.add_argument("--model", default=MODEL)
    p.add_argument("--khong-rife", action="store_true", help="chỉ trộn khung ffmpeg")
    p.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    a = p.parse_args()
    co = dem_khung(shutil.which("ffprobe") or "ffprobe", a.nguon)
    moi = a.khung or round(co * a.lan)
    cach = lam_cham(a.nguon, moi, a.ra, a.ffmpeg, a.fps, co=co, rife=not a.khong_rife, model=a.model)
    print(f"[rife_cham] Xong ({cach}): {co} -> {moi} khung, {moi / a.fps:.2f} giây -> {a.ra}")


if __name__ == "__main__":
    main()
