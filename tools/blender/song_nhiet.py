"""Sóng nhiệt (heat haze): không khí méo nhẹ, trôi lên, mạnh ở dưới yếu dần lên trên, cho cảnh suối nóng, lửa.
Lấy bản tốt nhất đang có của cảnh (thứ tự thư mục truyền vào, clip trước ảnh) và ra clip NNN-clip.mp4.
Ảnh tĩnh được làm thành clip có đẩy máy nhẹ 1.00 → 1.08 để vẫn có chuyển động như Ken Burns.

  <python của Blender> song_nhiet.py <thư mục ra> <scenes.srt> <thư mục nguồn 1> [nguồn 2 ...] -- 2 84 85 246:1.6

Mỗi số cảnh có thể kèm :độ mạnh (mặc định 1.0, khoảng 4 px dịch chuyển ở mép dưới).
"""
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
FPS, W, H = 24, 1920, 1080


def doc_khe(srt):
    t = open(srt, encoding="utf-8").read().replace("\r", "")
    moc = re.findall(r"(\d+):(\d+):(\d+)[,.](\d+) --> (\d+):(\d+):(\d+)[,.](\d+)", t)
    giay = [int(a) * 3600 + int(b) * 60 + int(c) + int(d) / 1000 for a, b, c, d, *_ in moc]
    return {i + 1: (giay[i + 1] - giay[i]) if i + 1 < len(giay) else 8.0 for i in range(len(giay))}


def tim_nguon(so, nguon):
    for d in nguon:
        for ten in (f"{so:03d}-clip.mp4", f"{so:03d}-anh.jpg"):
            p = os.path.join(d, ten)
            if os.path.exists(p):
                return p
    raise FileNotFoundError(f"không có nguồn cho cảnh {so}")


def main():
    i = sys.argv.index("--")
    ra, srt, nguon = sys.argv[1], sys.argv[2], sys.argv[3:i]
    muc = sys.argv[i + 1:]
    khe = doc_khe(srt)
    os.makedirs(ra, exist_ok=True)
    for m in muc:
        so, manh = (m.split(":") + ["1.0"])[:2]
        so, manh = int(so), float(manh)
        vao = tim_nguon(so, nguon)
        dai = khe[so] + 0.6
        n = round(dai * FPS)
        if vao.endswith(".jpg"):
            dau = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dai:.3f}", "-i", vao]
            hinh = (f"[0:v]scale={W * 2}:{H * 2},zoompan=z='1+0.08*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                    f":d=1:s={W}x{H}:fps={FPS},format=gbrp[v]")
        else:
            dau = ["-i", vao]
            hinh = f"[0:v]fps={FPS},scale={W}:{H},format=gbrp[v]"
        bien = 4.0 * manh
        # bản đồ dịch chuyển: nhiễu mịn, cao gấp đôi khung, trượt lên trên; nhân dốc dọc để dưới mạnh trên yếu
        ban_do = (f"color=c=gray:s={W}x{H * 2}:r={FPS},noise=alls=90:allf=u,gblur=sigma=14,"
                  f"lutyuv=y='128+(val-128)*{bien / 6:.3f}',format=gray,"
                  f"crop={W}:{H}:0:'mod(t*140,{H})',"
                  f"geq=lum='128+(lum(X,Y)-128)*(0.25+0.75*Y/{H})',format=gbrp")
        f = (f"{hinh};{ban_do},split[x][y];[v][x][y]displace=edge=smear,format=yuv420p,trim=0:{dai:.3f}[o]")
        out = os.path.join(ra, f"{so:03d}-clip.mp4")
        tam = out + ".tam.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *dau, "-filter_complex", f, "-map", "[o]", "-t", f"{dai:.3f}",
                        "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-an", tam], check=True)
        os.replace(tam, out)
        print(f"[song_nhiet] {so:03d}: từ {os.path.basename(os.path.dirname(vao))}/{os.path.basename(vao)}, {dai:.1f} giây, mạnh {manh}")


main()
