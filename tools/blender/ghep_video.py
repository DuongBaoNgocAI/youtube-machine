"""Ghép cảnh (ảnh + clip), giọng đọc và phụ đề SRT thành video MP4 bằng Blender VSE.

Chạy không mở giao diện:
  blender -b --factory-startup --python ghep_video.py -- \
      --canh <thư mục canh> --scenes <scenes.srt> --srt <phụ đề.srt> --audio <giọng.mp3> \
      --out <video.mp4> [--den-canh 9] [--hieu-ung <NNN.hieu-ung.json>] [--nhac <nhạc.wav|mp3>]
      [--tu-canh 66 --den-canh 79 --doc --tieu-de "..." --manh]   # một đoạn, khung dọc 9:16 cho Shorts
      [--tu-canh 1 --den-canh 24 --manh | --doan-cuoi]          # dựng từng đoạn để duyệt, ghép bằng ghep_doan.py

- Cảnh N trong thư mục canh (NNN-anh.jpg / NNN-clip.mp4) khớp dòng N của scenes.srt.
- Cảnh kéo dài tới lúc cảnh sau bắt đầu, nên hình luôn khớp giọng.
- Ảnh tĩnh có chuyển động nhẹ (phóng to, thu nhỏ, trượt ngang luân phiên).
- Clip ngắn hơn cảnh được làm chậm (tối đa 2 lần) bằng RIFE nếu có tools/rife/ (không thì trộn khung), còn thiếu thì giữ khung cuối.
- File hiệu ứng (JSON) thêm: chuyển cảnh, cú đập zoom, thẻ chương gõ máy chữ, chữ nổi,
  con dấu, SFX, gió nền, nhạc nền gốc tự nhỏ khi có giọng. Không có file này thì chỉ ghép thô.
- File .blend được lưu cạnh video để mở ra chỉnh tay trong Blender.
- Khung dọc (--doc): tiêu đề ở dải trên, hình 16:9 phóng to ở dải giữa, phụ đề lớn ở dải dưới;
  chữ nổi, con dấu, thẻ chương được dời vào dải hình.
"""
import argparse
import hashlib
import json
import math
import os
import random
import re
import shutil
import subprocess
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import am_thanh  # noqa: E402
import rife_cham  # noqa: E402

FPS = 24
W, H = 1920, 1080
XF = 6  # số khung hòa cảnh giữa hai cảnh (0,25 giây)
XF_WIPE = 10
CHAM_TOI_DA = 0.5  # clip chậm nhất bằng nửa tốc độ gốc
T0 = 0.0  # giây của video gốc ứng với khung 1 (khi chỉ dựng một đoạn)
DOC = False  # khung dọc 9:16
DAI_CAO, DAI_TREN = 1000, 420  # khung dọc: chiều cao dải hình và mép trên của nó (px)
FONTS = {"win32": r"C:\Windows\Fonts", "darwin": "/System/Library/Fonts/Supplemental"}.get(sys.platform, "/usr/share/fonts/truetype")
FONTS_KENH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")  # font tải về (Anton, Special Elite)


TAI_NGUYEN = None  # tai-nguyen/ của kênh chứa video đang dựng, thấy thì dùng trước tools/blender


def tim_tai_nguyen(out):
    """Đi ngược từ thư mục video ra tới thư mục kênh (có progress.md và tai-nguyen/)."""
    p = os.path.dirname(os.path.abspath(out))
    while True:
        if os.path.exists(os.path.join(p, "progress.md")) and os.path.isdir(os.path.join(p, "tai-nguyen")):
            return os.path.join(p, "tai-nguyen")
        cha = os.path.dirname(p)
        if cha == p:
            return None
        p = cha


def tim_font(ten):
    """Đường dẫn font: tai-nguyen/font của kênh, rồi fonts/ cạnh script, rồi font hệ điều hành."""
    for thu_muc in (os.path.join(TAI_NGUYEN, "font") if TAI_NGUYEN else None, FONTS_KENH, FONTS):
        if not thu_muc:
            continue
        p = os.path.join(thu_muc, ten)
        if os.path.exists(p):
            return p
    # Máy không có font mặc định của Windows (macOS, Linux): dùng font đi kèm thay vì dừng.
    du_phong = os.path.join(FONTS_KENH, "Anton-Regular.ttf")
    if os.path.exists(du_phong):
        print(f"[ghep_video] Không thấy font {ten}, dùng Anton-Regular.ttf", flush=True)
        return du_phong
    sys.exit(f"Không thấy font {ten}")

MAU = {
    "parchment": "#F3E9D8", "bronze": "#B87333", "verdigris": "#3FB8A5",
    "amber": "#E3A33B", "rust": "#C2452D", "graphite": "#1B1F24",
}

# Kênh hình (số lớn nằm trên) và kênh tiếng
CH_HOA, CH_MAU, CH_VIGNETTE = 3, 4, 5
CH_KHUNG, CH_TOI = range(6, 12), 12
CH_DO = (CH_TOI, 80)  # lớp đỏ cảnh báo của HUD, tràn sang kênh 80 khi trùng lớp tối
CH_CHU = range(13, 24)
CH_DAU, CH_RUNG = range(24, 26), 26
CH_PHU_DE = range(27, 29)
CH_LOE = range(29, 31)
CH_GIONG, CH_NHAC = 32, 33
CH_GIO = range(34, 37)
CH_SFX = range(37, 80)
CH_HUD = range(81, 127)  # lớp HUD game (đồng hồ, cấp, HP, thẻ lên cấp) nằm trên mọi lớp hình
CH_DEN = 127

# Âm lượng mặc định
AM = {"whoosh": 0.45, "swish": 0.35, "tick": 0.3, "tick-muc": 0.2, "go": 0.5, "chuong": 0.22,
      "thud": 0.9, "boom": 0.4, "gio": 0.18, "nuoc": 0.16, "lua": 0.3, "cuoc": 0.13,
      "len-cap": 0.6, "exp": 0.45, "tim": 0.75, "canh-bao": 0.3, "mua": 0.14,
      "sam": 0.7, "vut": 0.4, "ngua": 0.3, "dam-dong": 0.32, "tu-va": 0.4, "hanh-quan": 0.22,
      "khien-trung-1": 0.55, "khien-trung-2": 0.55, "khien-trung-3": 0.55, "kiem-va-1": 0.45, "kiem-va-2": 0.45,
      "kiem-va-3": 0.45, "rut-kiem": 0.5, "dap-thung": 0.6, "ren-sat": 0.5, "giap": 0.4, "dam-trung": 0.55, "bun": 0.45}
AM_NEN = ("gio", "nuoc", "lua", "cuoc", "mua", "hanh-quan", "ngua")  # âm nền nối vòng theo danh sách cảnh
THU_MUC_SFX_CC0 = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sfx-cc0", "tron")  # tạo bằng sfx_cc0.py
THU_MUC_LOP_PHU = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lop-phu")  # tạo bằng lop_phu_3d.py  # âm nền nối vòng, khai trong file hiệu ứng theo số cảnh
NHAC_DUOI_GIONG, NHAC_KHI_NGHI = 0.28, 0.6


def hex_mau(h, a=1.0):
    h = MAU.get(h, h).lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)


def doc_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--canh", required=True)
    p.add_argument("--scenes", required=True)
    p.add_argument("--srt", required=True)
    p.add_argument("--audio", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--den-canh", type=int, default=0, help="dừng ở cảnh này (0 = cả video)")
    p.add_argument("--tu-canh", type=int, default=1, help="bắt đầu từ cảnh này")
    p.add_argument("--doc", action="store_true", help="khung dọc 9:16 cho Shorts")
    p.add_argument("--doc-tran", action="store_true", help="khung dọc 9:16 cho hình dọc tràn khung, phụ đề lớn tránh vùng nút Shorts")
    p.add_argument("--tieu-de", default="", help="câu mở đầu ở dải trên của khung dọc (\\n để xuống dòng)")
    p.add_argument("--tieu-de-tinh", action="store_true", help="câu mở đầu đứng yên (mảnh thứ hai trở đi của một Short)")
    p.add_argument("--manh", action="store_true", help="dựng một mảnh để ghép tiếp: không tối dần cuối, không chuẩn hóa âm")
    p.add_argument("--doan-cuoi", action="store_true", help="đoạn cuối của bản dựng từng đoạn: có tối dần cuối, không chuẩn hóa âm (ghep_doan.py làm)")
    p.add_argument("--hieu-ung", help="file JSON bản đồ hiệu ứng")
    p.add_argument("--nhac", help="nhạc nền có sẵn (bỏ trống thì tự tạo nhạc gốc)")
    p.add_argument("--thay", action="append", default=[], help="thư mục cảnh thay thế (ví dụ canh-3d), file NNN-*.mp4 thay cảnh cùng số")
    p.add_argument("--ffmpeg", default=shutil.which("ffmpeg") or "ffmpeg")
    p.add_argument("--khong-render", action="store_true", help="chỉ lưu .blend")
    p.add_argument("--khong-rife", action="store_true", help="làm chậm clip bằng trộn khung ffmpeg thay cho RIFE")
    p.add_argument("--khong-phu-de", action="store_true", help="không in phụ đề vào hình (tải .srt lên YouTube)")
    a = p.parse_args(argv)
    for k in ("canh", "scenes", "srt", "audio", "out", "hieu_ung", "nhac"):
        if getattr(a, k):
            setattr(a, k, os.path.abspath(getattr(a, k)))
    a.thay = [os.path.abspath(t) for t in a.thay]
    return a


def doc_srt(path):
    def giay(s):
        h, m, rest = s.split(":")
        sec, ms = rest.replace(".", ",").split(",")
        return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000

    with open(path, encoding="utf-8-sig") as f:
        khoi = re.split(r"\n\s*\n", f.read().strip())
    dong = []
    for k in khoi:
        lines = k.strip().splitlines()
        if len(lines) < 2 or "-->" not in lines[1]:
            continue
        a, b = [x.strip() for x in lines[1].split("-->")]
        dong.append((giay(a), giay(b), "\n".join(lines[2:]).strip()))
    return dong


def khung(t):
    return 1 + round((t - T0) * FPS)


def vt(x, y, neo_x="CENTER"):
    """Đổi vị trí tính theo khung ngang 16:9 sang khung dọc (dải hình ở giữa). Khung ngang giữ nguyên."""
    if not DOC:
        return (x, y)
    x2 = 0.5 + (x - 0.5) * DAI_CAO * 16 / 9 / W
    if neo_x == "LEFT":
        x2 = max(0.05, x2)
    elif neo_x == "RIGHT":
        x2 = min(0.95, x2)
    return (x2, (H - DAI_TREN - DAI_CAO) / H + y * DAI_CAO / H)


def dat_khung(s):
    """Tỉ lệ và độ dời gốc của một cảnh: phủ kín khung ngang, hoặc nằm vừa dải hình của khung dọc."""
    goc, y0 = s.transform.scale_x, 0.0
    if DOC:
        goc *= DAI_CAO / (W * 9 / 16)  # fit_method FIT làm hình rộng bằng khung; phóng tới chiều cao dải
        y0 = H / 2 - (DAI_TREN + DAI_CAO / 2)
    s.transform.scale_x = s.transform.scale_y = goc
    s.transform.offset_y = y0
    return goc, y0


def ds_canh(thu_muc):
    files = {}
    for f in os.listdir(thu_muc):
        m = re.match(r"(\d+)-(anh|clip)\.(jpg|jpeg|png|webp|mp4|mov)$", f, re.I)
        if m:
            files[int(m.group(1))] = os.path.join(thu_muc, f)
    return files


def keyframe(strip, path, frame, value):
    obj, attr = (strip.transform, path.split(".")[1]) if path.startswith("transform.") else (strip, path)
    setattr(obj, attr, value)
    obj.keyframe_insert(attr, frame=frame)


class Kenh:
    """Cấp kênh trống cho strip để các strip cùng kênh không chồng nhau."""

    def __init__(self):
        self.dung = {}

    def lay(self, ds, a, b):
        for ch in ds:
            if all(b <= x or a >= y for x, y in self.dung.get(ch, [])):
                self.dung.setdefault(ch, []).append((a, b))
                return ch
        raise RuntimeError(f"Hết kênh trống trong {ds} cho khung {a}-{b}")


class Moc:
    """Đổi mốc trong file hiệu ứng ra giây: số, cụm chữ trong SRT, hoặc {khi, lan, lech} / {canh, lech}."""

    def __init__(self, srt, bat_dau_canh):
        self.dong = [(a, b, " ".join(t.split())) for a, b, t in srt]
        self.bat_dau_canh = bat_dau_canh
        self.loi = []
        self.da_bao = set()

    def cum(self, cum, lan=1):
        k, c, kq = 0, cum.lower(), None
        for t0, t1, s in self.dong:
            i = s.lower().find(c)
            while i >= 0:
                k += 1
                if k == lan:
                    kq = t0 + (t1 - t0) * i / max(len(s), 1)
                i = s.lower().find(c, i + 1)
        if kq is None:
            raise KeyError(cum)
        if k > 1 and f"{cum}|{lan}" not in self.da_bao:
            self.da_bao.add(f"{cum}|{lan}")
            self.loi.append(f"câu '{cum}' xuất hiện {k} lần trong SRT, đang dùng lần {lan}")
        return kq

    def __call__(self, spec, lan=1, lech=0.0):
        try:
            if spec is None:
                return None
            if isinstance(spec, (int, float)):
                return float(spec) + lech
            if isinstance(spec, str):
                return self.cum(spec, lan) + lech
            if "canh" in spec:
                return self.bat_dau_canh[spec["canh"]] + spec.get("lech", 0) + lech
            return self.cum(spec["khi"], spec.get("lan", 1)) + spec.get("lech", 0) + lech
        except KeyError as e:
            self.loi.append(f"không thấy câu {e} trong SRT")
            return None

    def cua(self, d, key="khi"):
        return self(d.get(key), d.get("lan", 1), d.get("lech", 0))


# Năm kiểu chuyển động cho ảnh tĩnh: (scale đầu, scale cuối, offset x đầu, cuối, offset y đầu, cuối)
CHUYEN_DONG = [
    (1.00, 1.10, 0, 0, 0, 0),        # phóng to vào giữa
    (1.12, 1.02, 0, 0, 0, 0),        # thu nhỏ ra
    (1.10, 1.10, -80, 80, 0, 0),     # trượt trái sang phải
    (1.10, 1.10, 80, -80, 0, 0),     # trượt phải sang trái
    (1.02, 1.12, 0, 0, 0, -40),      # phóng to về phía trên
]
DAP = 1.18  # cú đập zoom: bắt đầu to hơn rồi thu về trong 6 khung


def them_anh(strips, path, ch, dau, cuoi, kieu, dap=False):
    s = strips.new_image(name=os.path.basename(path), filepath=path, channel=ch, frame_start=dau, fit_method='FIT' if DOC else 'FILL')
    s.right_handle = cuoi
    goc, nen_y = dat_khung(s)
    s0, s1, x0, x1, y0, y1 = CHUYEN_DONG[kieu % len(CHUYEN_DONG)]
    moc = [(dau, s0, x0, y0), (cuoi, s1, x1, y1)]
    if dap:
        k = 6 / (cuoi - dau)
        moc = [(dau, s0 * DAP, x0, y0), (dau + 6, s0 + (s1 - s0) * k, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k), moc[1]]
    for frame, sc, x, y in moc:
        keyframe(s, "transform.scale_x", frame, goc * sc)
        keyframe(s, "transform.scale_y", frame, goc * sc)
        keyframe(s, "transform.offset_x", frame, x)
        keyframe(s, "transform.offset_y", frame, nen_y + y)
    return s


def them_clip(strips, path, ch, dau, cuoi, dap=False, lam_cham=None):
    vua = 'FIT' if DOC else 'FILL'
    s = strips.new_movie(name=os.path.basename(path), filepath=path, channel=ch, frame_start=dau, fit_method=vua)
    can, co = cuoi - dau, s.duration
    if co < can and lam_cham:
        # Clip ngắn hơn cảnh: dùng bản đã làm chậm (retiming của Blender 5.2 lỗi với clip không bắt đầu ở khung 1).
        strips.remove(s)
        s = strips.new_movie(name=os.path.basename(path), filepath=lam_cham(path, co, min(can, int(co / CHAM_TOI_DA))),
                             channel=ch, frame_start=dau, fit_method=vua)
    s.right_handle = cuoi  # còn thiếu thì giữ khung cuối
    goc, _ = dat_khung(s)
    if dap:
        for frame, sc in ((dau, goc * DAP), (dau + 6, goc)):
            keyframe(s, "transform.scale_x", frame, sc)
            keyframe(s, "transform.scale_y", frame, sc)
    return s


class Dung:
    """Gom các bước dựng dùng chung trạng thái (strips, kênh, mốc, thư mục tài nguyên)."""

    def __init__(self, a, sc, het, hu=None):
        self.a, self.sc, self.het = a, sc, het
        self.strips = sc.sequence_editor.strips
        self.kenh = Kenh()
        self.thu_muc = os.path.join(os.path.dirname(a.out), "tai-nguyen")
        os.makedirs(self.thu_muc, exist_ok=True)
        self.sfx = am_thanh.tao_sfx(os.path.join(self.thu_muc, "sfx"))
        for thu_muc in (os.path.join(TAI_NGUYEN, "sfx") if TAI_NGUYEN else None, THU_MUC_SFX_CC0):  # SFX của kênh trước, rồi mẫu CC0; gọi bằng tên file
            if thu_muc and os.path.isdir(thu_muc):
                for f in os.listdir(thu_muc):
                    if f.endswith(".wav"):
                        self.sfx.setdefault(f[:-4], os.path.join(thu_muc, f))
        # Font mặc định như 001; file hiệu ứng có thể đổi bằng khóa "font", ví dụ {"dam": "Anton-Regular.ttf"}.
        ten_font = {"phu-de": "arialbd.ttf", "dam": "impact.ttf", "may-chu": "courbd.ttf", "dau": "impact.ttf",
                    "hud": "bahnschrift.ttf", "so": "consolab.ttf"}
        ten_font.update((hu or {}).get("font", {}))
        self.font_path = {k: tim_font(f) for k, f in ten_font.items()}
        self.fonts = {k: bpy.data.fonts.load(p) for k, p in self.font_path.items()}
        self.ten_kenh = (hu or {}).get("ten_kenh", "")
        self.nhan_file = (hu or {}).get("nhan_file", "")
        self.dem = 0

    def ten(self, goc):
        self.dem += 1
        return f"{goc}-{self.dem}"

    # --- âm thanh ---
    def am(self, ten, t, am=None, ket_thuc=False):
        if t is None:
            return
        path = self.sfx.get(ten, ten)
        dai = am_thanh.do_dai(path)
        if ket_thuc:
            t -= dai
        f0 = khung(t)
        if f0 < -2 or f0 >= self.het:  # âm thuộc phần trước đoạn đang dựng
            return
        f0 = max(1, f0)
        f1 = min(self.het, f0 + math.ceil(dai * FPS))
        ch = self.kenh.lay(CH_SFX, f0, f1)
        s = self.strips.new_sound(name=self.ten("sfx-" + os.path.splitext(os.path.basename(path))[0]), filepath=path, channel=ch, frame_start=f0)
        s.volume = AM.get(ten, 0.5) if am is None else am
        s.right_handle = f1

    # --- chữ ---
    def chu(self, text, f0, f1, font="dam", co=80, mau="parchment", vi_tri=(0.5, 0.5), neo=("CENTER", "CENTER"),
            vien=0.08, bong=True, hop=None, kenh=None, tho=False):
        """Một strip chữ; vi_tri tính theo khung ngang (tự đổi sang khung dọc), tho=True thì dùng nguyên."""
        f0, f1 = max(f0, 1), min(f1, self.het)
        if f1 <= f0:
            return None
        if not tho:
            vi_tri = vt(*vi_tri, neo[0])
        ch = self.kenh.lay(kenh or CH_CHU, f0, f1)
        t = self.strips.new_effect(name=self.ten("chu"), type='TEXT', channel=ch, frame_start=f0, length=f1 - f0)
        t.text, t.font, t.font_size = text, self.fonts[font], co
        t.color = hex_mau(mau)
        t.location = vi_tri
        t.anchor_x, t.anchor_y = neo
        t.alignment_x = neo[0] if neo[0] != "CENTER" else "CENTER"
        t.wrap_width = 0.9
        if vien:
            t.use_outline, t.outline_color, t.outline_width = True, (0, 0, 0, 1), vien
        if bong:
            t.use_shadow, t.shadow_color = True, (0, 0, 0, 0.55)
        if hop:
            t.use_box, t.box_color, t.box_margin = True, hex_mau("graphite", hop), 0.012
        t.transform.origin = vi_tri
        return t

    def hien(self, t, f0, f1, kieu="mo", ra=5):
        """Hoạt ảnh vào/ra cho strip chữ: 'bat' nảy to rồi về, 'truot' trượt từ trái, 'mo' hiện dần."""
        if t is None:
            return
        f1 = min(f1, self.het)
        keyframe(t, "blend_alpha", f0, 0.0)
        keyframe(t, "blend_alpha", f0 + (2 if kieu == "bat" else 5), 1.0)
        keyframe(t, "blend_alpha", max(f0 + 6, f1 - ra), 1.0)
        keyframe(t, "blend_alpha", f1, 0.0)
        if kieu == "bat":
            for f, s in ((f0, 1.4), (f0 + 5, 1.0)):
                keyframe(t, "transform.scale_x", f, s)
                keyframe(t, "transform.scale_y", f, s)
        elif kieu == "truot":
            keyframe(t, "transform.offset_x", f0, -60)
            keyframe(t, "transform.offset_x", f0 + 7, 0)

    def thanh(self, mau, x, y, rong, cao, f0, f1, kenh=None, tho=False):
        """Một vạch màu (COLOR strip thu nhỏ): x, y là tâm tính theo tỉ lệ khung, y đo từ dưới lên."""
        f0, f1 = max(f0, 1), min(f1, self.het)
        if f1 <= f0:
            return None
        if not tho:
            x, y = vt(x, y)
        ch = self.kenh.lay(kenh or CH_CHU, f0, f1)
        s = self.strips.new_effect(name=self.ten("vach"), type='COLOR', channel=ch, frame_start=f0, length=f1 - f0)
        s.color = hex_mau(mau)[:3]
        s.transform.scale_x, s.transform.scale_y = rong, cao
        s.transform.offset_x, s.transform.offset_y = (x - 0.5) * W, (y - 0.5) * H
        self.hien(s, f0, f1, "mo", 4)
        return s

    def phu_mau(self, mau, f0, f1, alpha, kenh):
        """Một lớp màu phủ cả khung, alpha là [(khung, độ đậm)]."""
        ch = self.kenh.lay(kenh, f0, f1)
        s = self.strips.new_effect(name=self.ten("phu"), type='COLOR', channel=ch, frame_start=f0, length=f1 - f0)
        s.color = hex_mau(mau)[:3]
        for f, v in alpha:
            keyframe(s, "blend_alpha", f, v)
        return s

    def lam_cham(self, path, co, dai_moi):
        """Bản clip chậm lại từ `co` khung thành `dai_moi` khung, bỏ tiếng.
        Có RIFE (tools/rife/) thì vẽ khung giữa bằng AI, không có hoặc --khong-rife thì trộn khung ffmpeg."""
        thu_muc = os.path.join(self.thu_muc, "clip-cham")
        os.makedirs(thu_muc, exist_ok=True)
        cach = "tron" if self.a.khong_rife else "rife"
        # khóa theo cả giờ sửa file nguồn: thay clip cùng tên (ví dụ bản đã xóa logo) thì tạo lại
        ra = os.path.join(thu_muc, f"{os.path.splitext(os.path.basename(path))[0]}-{int(os.path.getmtime(path))}-{dai_moi}f-{cach}.mp4")
        if not os.path.exists(ra):
            tam = ra + ".tam.mp4"
            rife_cham.lam_cham(path, dai_moi, tam, self.a.ffmpeg, FPS, co=co, rife=not self.a.khong_rife,
                               bao=lambda m: print("[ghep_video]", m))
            os.replace(tam, ra)
        return ra

    # --- đồ họa tạo bằng ffmpeg ---
    def ffmpeg_png(self, path, nguon, loc):
        if not os.path.exists(path):
            subprocess.run([self.a.ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i", nguon, "-vf", loc,
                            "-frames:v", "1", "-update", "1", path], check=True)
        return path

    def vignette(self):
        return self.ffmpeg_png(os.path.join(self.thu_muc, f"vignette-{W}x{H}.png"), f"color=c=black:s={W}x{H},format=rgba",
                               "geq=r=0:g=0:b=0:a='255*0.5*min(1,pow(hypot((X-W/2)/(W/2),(Y-H/2)/(H/2))/1.3,2.6))'")

    def con_dau(self, chu, mau):
        h = MAU.get(mau, mau).lstrip("#")
        ten = re.sub(r"\W+", "-", chu.lower())
        fs = min(230, int(980 / (0.5 * len(chu))))
        font = self.font_path["dau"].replace("\\", "/").replace(":", "\\:")
        ten += "-" + os.path.splitext(os.path.basename(self.font_path["dau"]))[0].lower()
        loc = (f"drawbox=x=12:y=12:w=1076:h=376:color=0x{h}@1:t=16:replace=1,"
               f"drawbox=x=40:y=40:w=1020:h=320:color=0x{h}@1:t=6:replace=1,"
               f"drawtext=fontfile='{font}':text='{chu}':fontsize={fs}:fontcolor=0x{h}:x=(w-text_w)/2:y=(h-text_h)/2,"
               "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*if(lt(random(1),0.08),0.1,0.78+0.22*random(2))'")
        return self.ffmpeg_png(os.path.join(self.thu_muc, f"dau-{ten}-{h}.png"),
                               "color=c=black:s=1100x400,format=rgba,colorchannelmixer=aa=0", loc)


def dung_canh(d, files, mc, hu):
    """Đặt cảnh lên kênh 1-2, kèm chuyển cảnh và cú đập zoom. mc: {số cảnh: (khung đầu, khung cuối)}."""
    strips = d.strips
    chuyen = {int(k): v for k, v in hu.get("chuyen_canh", {}).items()}
    dap = set(hu.get("dap_vao", []))

    def kieu_vao(so):
        return "cut" if so in dap else chuyen.get(so, "xfade")

    ds = sorted(mc)
    # đếm cả ảnh trước đoạn: dựng một đoạn (--tu-canh) giữ đúng chuyển động như bản cả video
    truoc, so_anh = None, sum(1 for so in files if so < ds[0] and not files[so].lower().endswith((".mp4", ".mov")))
    for i, so in enumerate(ds):
        dau, cuoi = mc[so]
        if i < len(ds) - 1:
            ra = kieu_vao(so + 1)
            cuoi += 0 if ra == "cut" else XF_WIPE if ra == "wipe" else XF  # chồng sang cảnh sau để hòa
        path = files[so]
        ch = 1 + i % 2
        if path.lower().endswith((".mp4", ".mov")):
            s = them_clip(strips, path, ch, dau, cuoi, so in dap, d.lam_cham)
        else:
            s = them_anh(strips, path, ch, dau, cuoi, so_anh, so in dap)
            so_anh += 1
        if truoc is not None:
            k = kieu_vao(so)
            if k == "wipe":
                w = strips.new_effect(name=f"wipe-{so}", type='WIPE', channel=CH_HOA, frame_start=dau,
                                      length=XF_WIPE, input1=truoc, input2=s)
                w.transition_type, w.blur_width, w.angle = 'SINGLE', 0.35, math.radians(-10)
                d.am("swish", (dau - 1) / FPS - 0.05)
            elif k != "cut":
                strips.new_effect(name=f"hoa-{so}", type='GAMMA_CROSS', channel=CH_HOA, frame_start=dau,
                                  length=XF, input1=truoc, input2=s)
            if k == "flash":
                d.phu_mau("#FFFFFF", dau - 3, dau + 7, [(dau - 3, 0), (dau, 0.85), (dau + 7, 0)], CH_LOE)
                d.am("whoosh", (dau - 1) / FPS - 0.4)
            elif k == "dip":
                d.phu_mau("#000000", dau - 12, dau + 10, [(dau - 12, 0), (dau - 2, 1), (dau + 1, 1), (dau + 10, 0)], CH_LOE)
                d.am("whoosh", (dau - 1) / FPS - 0.5, 0.3)
        truoc = s


def dung_the_chuong(d, hu, mc, M):
    """Thẻ chương: nhãn nhỏ màu đồng hiện dần, tên chương gõ từng chữ kèm tiếng máy chữ và chuông."""
    for c in hu.get("the_chuong", []):
        so = c["canh"]
        if so not in mc:
            continue
        dau, cuoi = mc[so]
        t_go = M(c["go_khi"]) if c.get("go_khi") else None
        f_go = khung(t_go) if t_go is not None else dau + 4
        ten = c["ten"]
        con = (cuoi - f_go) / FPS
        cps = max(14.0, len(ten) / max(con * 0.55, 0.3))
        # the_chuong_giu: giữ thẻ tối thiểu N giây, vượt qua cảnh ngắn; tốc độ gõ vẫn tính theo cảnh
        giu = c.get("giu", hu.get("the_chuong_giu"))
        if giu:
            cuoi = min(max(cuoi, dau + round(giu * FPS)), d.het)
        # the_chuong_thap: thẻ ở dải dưới có nền tối, không chồng thẻ thoại và đọc được trên ảnh sáng
        thap = hu.get("the_chuong_thap")
        y_nhan, y_vach, y_ten = (0.315, 0.285, 0.205) if thap else (0.64, 0.605, 0.52)
        if thap:
            nen = d.phu_mau("graphite", dau, cuoi, [(dau, 0.0), (dau + 5, 0.8), (cuoi - 4, 0.8), (cuoi, 0.0)], CH_CHU)
            nen.transform.scale_y, nen.transform.offset_y = 0.27, (0.25 - 0.5) * H
        nhan = d.chu(c["nhan"], dau, cuoi, "may-chu", 40, "bronze", (0.08, y_nhan), ("LEFT", "CENTER"), 0, False)
        d.hien(nhan, dau, cuoi, "mo", 4)
        d.thanh("bronze", 0.08 + 0.06, y_vach, 0.12, 0.004, dau, cuoi)
        ch = d.kenh.lay(CH_CHU, f_go, cuoi)
        for i in range(1, len(ten) + 1):
            f0 = f_go + round((i - 1) * FPS / cps)
            f1 = cuoi if i == len(ten) else f_go + round(i * FPS / cps)
            if f1 <= f0:
                continue
            t = d.strips.new_effect(name=d.ten("go"), type='TEXT', channel=ch, frame_start=f0, length=f1 - f0)
            t.text, t.font, t.font_size = ten[:i], d.fonts["may-chu"], 92
            t.color, t.location = hex_mau(hu.get("mau_go", "graphite")), vt(0.08, y_ten, "LEFT")
            if hu.get("mau_go"):  # chữ sáng trên nền tối: viền và bóng cho dễ đọc
                t.use_outline, t.outline_color, t.outline_width = True, (0, 0, 0, 1), 0.08
                t.use_shadow, t.shadow_color = True, (0, 0, 0, 0.6)
            t.anchor_x, t.anchor_y, t.alignment_x, t.wrap_width = "LEFT", "CENTER", "LEFT", 0.9 if DOC else 0.8
            if i == len(ten):
                keyframe(t, "blend_alpha", max(f0, f1 - 4), 1.0)
                keyframe(t, "blend_alpha", f1, 0.0)
        go = am_thanh.tao_go_phim(os.path.join(d.thu_muc, f"go-{so}.wav"), len(ten), cps,
                                  [i for i, x in enumerate(ten) if x == " "])
        d.am(go, (f_go - 1) / FPS, AM["go"])
        d.am("chuong", (f_go - 1) / FPS + len(ten) / cps + 0.05)


def dung_chu(d, hu, M):
    """Chữ nổi trên hình: lon (giữa khung), ben (góc trái trên), dia_danh (góc trái dưới), danh_sach."""
    for c in hu.get("chu", []):
        kieu = c["kieu"]
        mau = c.get("mau", "parchment")
        if kieu == "danh_sach":
            moc_muc = [M(cum) for _, cum in c["muc"]]
            if any(t is None for t in moc_muc):
                continue
            het = M.cua(c["den"]) if isinstance(c.get("den"), dict) else M(c.get("den")) if c.get("den") else moc_muc[-1] + c.get("dai_sau", 2.0)
            f_het = khung(het)
            for j, ((text, _), t) in enumerate(zip(c["muc"], moc_muc)):
                f0 = khung(t)
                m = c.get("mau_muc", [mau] * len(c["muc"]))[j]
                x = d.chu(text, f0, f_het, "dam", 66, m, (0.055, 0.88 - 0.082 * j), ("LEFT", "TOP"), 0.07)
                d.hien(x, f0, f_het, "truot")
                d.am("tick", t, AM["tick-muc"])
            continue
        t = M.cua(c)
        if t is None:
            continue
        f0 = khung(t)
        mac_dinh = {"lon": 2.2, "ben": 3.0, "dia_danh": 3.5}[kieu]
        f1 = khung(M(c["den"])) if c.get("den") else khung(t + c.get("dai", mac_dinh))
        text, phu = c["chu"], c.get("phu")
        if kieu == "lon":
            co = 150 if len(text) <= 10 else 120 if len(text) <= 16 else 96
            co = min(co, int(W * 0.9 / (0.5 * len(text))))  # chữ Impact rộng khoảng nửa cỡ chữ mỗi ký tự
            y_lon = hu.get("chu_lon_y", 0.64)
            x = d.chu(text, f0, f1, "dam", co, mau, (0.5, y_lon), ("CENTER", "CENTER"), 0.06)
            d.hien(x, f0, f1, "bat")
            if phu:
                cx, cy = vt(0.5, y_lon)
                y = d.chu(phu, f0 + 3, f1, "dam", min(56, int(W * 0.9 / (0.5 * len(phu)))), "bronze",
                          (cx, cy - co / H * 0.62), ("CENTER", "TOP"), 0.15, tho=True)
                d.hien(y, f0 + 3, f1, "mo")
            d.am("boom" if c.get("nhan") else "tick", t)
        elif kieu == "ben":
            x = d.chu(text, f0, f1, "dam", 86, mau, (0.055, 0.88), ("LEFT", "TOP"), 0, False, hop=0.78)
            d.hien(x, f0, f1, "truot")
            if phu:
                y = d.chu(phu, f0 + 4, f1, "dam", 40, "bronze", (0.055, 0.88 - 0.112), ("LEFT", "TOP"), 0, False, hop=0.78)
                d.hien(y, f0 + 4, f1, "truot")
            d.am("tick", t)
        elif kieu == "dia_danh":
            d.thanh("bronze", 0.045, 0.29, 0.004, 0.11 if phu else 0.07, f0, f1)
            x = d.chu(text, f0, f1, "dam", 60, mau, (0.055, 0.29 if phu else 0.27), ("LEFT", "BOTTOM"), 0.07)
            d.hien(x, f0, f1, "truot")
            if phu:
                y = d.chu(phu, f0 + 4, f1, "dam", 34, "bronze", (0.055, 0.285), ("LEFT", "TOP"), 0.12)
                d.hien(y, f0 + 4, f1, "truot")
            d.am("swish", t - 0.05, 0.25)


def rung_may(d, f, manh=16, dai=10):
    """Rung máy: lớp điều chỉnh phóng nhẹ rồi lắc ngẫu nhiên tắt dần (HUD nằm trên nên không rung)."""
    if f < 1 or f >= d.het:
        return
    dai = min(dai, d.het - f)
    try:
        ch = d.kenh.lay([CH_RUNG], f, f + dai)
    except RuntimeError:  # đang có cú rung khác
        return
    rung = d.strips.new_effect(name=d.ten("rung"), type='ADJUSTMENT', channel=ch, frame_start=f, length=dai)
    rung.transform.scale_x = rung.transform.scale_y = 1 + manh / 500
    r = random.Random(f)
    for k in range(dai + 1):
        bien = manh * (1 - k / dai)
        keyframe(rung, "transform.offset_x", f + k, r.uniform(-bien, bien))
        keyframe(rung, "transform.offset_y", f + k, r.uniform(-bien, bien))


def dung_rung_set(d, hu, M):
    """Rung máy theo nhịp va chạm ("rung") và sét chớp kèm sấm đến trễ ("set")."""
    for c in hu.get("rung", []):
        t = M.cua(c)
        if t is not None:
            rung_may(d, khung(t), c.get("manh", 14), round(c.get("dai", 0.45) * FPS))
            if c.get("am"):
                d.am(c["am"], t - 0.02, c.get("to"))
    for c in hu.get("bung_sang", []):  # bừng sáng ấm (blend ADD) ở khoảnh khắc lên cấp, dưới lớp HUD
        t = M.cua(c)
        if t is None:
            continue
        f, dai, m = khung(t), round(c.get("dai", 0.9) * FPS), c.get("manh", 0.45)
        if f >= d.het or f + dai <= 1:
            continue
        s = d.phu_mau(c.get("mau", "#FFC65A"), max(f, 1), f + dai, [(max(f, 1), 0.0), (f + 3, m), (f + 8, m * 0.5), (f + dai, 0.0)], CH_LOE)
        s.blend_type = 'ADD'
    for c in hu.get("set", []):
        t = M.cua(c)
        if t is None:
            continue
        f = khung(t)
        if f >= d.het or f + 10 <= 1:
            continue
        d.phu_mau("#DCE6FF", max(f, 1), f + 10, [(max(f, 1), 0.0), (f + 1, 0.75), (f + 3, 0.08), (f + 5, 0.55), (f + 10, 0.0)], CH_LOE)
        d.am("sam", t + c.get("tre", 0.5), c.get("to"))


def chuoi_anh(d, thu_muc, f0, f1, alpha, blend='ALPHA_OVER', mo=12):
    """Phủ một chuỗi PNG lặp (lop-phu/<tên>) từ khung f0 tới f1, nối vòng liền; hiện / tắt dần ở hai đầu."""
    files = sorted(os.path.join(thu_muc, f) for f in os.listdir(thu_muc) if f.endswith(".png"))
    if not files:
        print("[ghep_video] Thiếu lớp phủ", thu_muc)
        return
    n = len(files)
    f0, f1 = max(f0, 1), min(f1, d.het)
    f = f0
    while f < f1:
        g = min(f + n, f1)
        s = d.strips.new_image(name=d.ten("phu-" + os.path.basename(thu_muc)), filepath=files[0],
                               channel=d.kenh.lay(CH_KHUNG, f, g), frame_start=f, fit_method='FILL')
        for p in files[1:]:
            s.elements.append(os.path.basename(p))
        s.right_handle = g
        s.blend_type = blend
        a = [(f, alpha), (g, alpha)]
        if f == f0:
            a[0] = (f, 0.0)
            a.insert(1, (min(f + mo, g), alpha))
        if g == f1:
            a[-1] = (g, 0.0)
            a.insert(-1, (max(g - mo, f), alpha))
        for k, v in a:
            keyframe(s, "blend_alpha", k, v)
        f = g


def dung_lop_phu(d, hu, M):
    """Lớp phủ 3D dựng sẵn (mưa, tuyết, tàn lửa, bụi, sương, tia sáng) theo dải cảnh, và hạt phim cả video."""
    for c in hu.get("lop_phu", []):
        thu_muc = os.path.join(TAI_NGUYEN or "", "lop-phu", c["ten"])
        if not (TAI_NGUYEN and os.path.isdir(thu_muc) and os.listdir(thu_muc)):
            thu_muc = os.path.join(THU_MUC_LOP_PHU, c["ten"])
        ds = sorted(c.get("canh", [])) or list(range(c["tu_canh"], c["den_canh"] + 1))
        doan = []
        for so in ds:
            if doan and doan[-1][1] == so - 1:
                doan[-1][1] = so
            else:
                doan.append([so, so])
        for a, b in doan:
            t0 = M.bat_dau_canh.get(a)
            t1 = M.bat_dau_canh.get(b + 1, (d.het - 1) / FPS + T0)
            if t0 is None:
                continue
            chuoi_anh(d, thu_muc, khung(t0), khung(t1), c.get("do_dam", 0.7), c.get("blend", 'ALPHA_OVER'))
    hp = hu.get("hat_phim")
    if hp:
        thu_muc = os.path.join(d.thu_muc, "hat-phim")
        if not os.path.isdir(thu_muc) or len(os.listdir(thu_muc)) < 48:
            os.makedirs(thu_muc, exist_ok=True)
            subprocess.run([d.a.ffmpeg, "-v", "error", "-y", "-f", "lavfi", "-i", f"color=c=0x808080:s={W}x{H}:r={FPS}",
                            "-vf", "noise=alls=28:allf=t+u,boxblur=1:1", "-frames:v", "48", os.path.join(thu_muc, "%04d.png")], check=True)
        chuoi_anh(d, thu_muc, 1, d.het, hp.get("do_dam", 0.35), 'OVERLAY', 1)


def dung_mau_chuong(d, ds, M):
    """Chỉnh màu theo chương: mỗi mục {tu_canh, lift, gamma, gain, tuong_phan, bao_hoa} giữ tới mục sau."""
    ds = sorted(ds, key=lambda c: c["tu_canh"])
    for i, c in enumerate(ds):
        t0 = M.bat_dau_canh.get(c["tu_canh"], 0.0)
        f0 = max(khung(t0), 1)
        f1 = min(khung(M.bat_dau_canh[ds[i + 1]["tu_canh"]]) if i + 1 < len(ds) else d.het, d.het)
        if f1 <= f0:
            continue
        s = d.strips.new_effect(name=d.ten("mau-chuong"), type='ADJUSTMENT', channel=d.kenh.lay([CH_MAU], f0, f1), frame_start=f0, length=f1 - f0)
        cb = s.modifiers.new(name="can-mau", type='COLOR_BALANCE').color_balance
        cb.lift, cb.gamma, cb.gain = tuple(c.get("lift", (1, 1, 1))), tuple(c.get("gamma", (1, 1, 1))), tuple(c.get("gain", (1, 1, 1)))
        bc = s.modifiers.new(name="tuong-phan", type='BRIGHT_CONTRAST')
        bc.contrast = c.get("tuong_phan", 6)
        bc.bright = c.get("sang", 0)
        try:
            s.color_saturation = c.get("bao_hoa", 1.0)
        except AttributeError:
            pass


def dung_con_dau(d, hu, M):
    """Con dấu đập xuống: phóng to rồi nện vào khung, rung máy, nền tối đi, tiếng thịch."""
    for c in hu.get("con_dau", []):
        t = M.cua(c)
        if t is None:
            continue
        f = khung(t)
        f_het = min(d.het, khung(M(c["den"])) if c.get("den") else f + 60)
        if f < 4 or f_het <= f:
            continue
        x, y = vt(*c.get("vi_tri", [0.5, 0.5]))
        co = c.get("co", 1.0) * (0.8 if DOC else 1.0)
        png = d.con_dau(c["chu"], c["mau"])
        ch = d.kenh.lay(CH_DAU, f - 3, f_het)
        s = d.strips.new_image(name=d.ten("dau"), filepath=png, channel=ch, frame_start=f - 3, fit_method='ORIGINAL')
        s.right_handle = f_het
        s.blend_type = 'ALPHA_OVER'
        s.transform.rotation = math.radians(-8)
        s.transform.offset_x, s.transform.offset_y = (x - 0.5) * W, (y - 0.5) * H
        for k, v in ((f - 3, 2.4), (f, 0.93), (f + 4, 1.0)):
            keyframe(s, "transform.scale_x", k, co * v)
            keyframe(s, "transform.scale_y", k, co * v)
        for k, v in ((f - 3, 0.0), (f - 1, 1.0), (f_het - 4, 1.0), (f_het, 0.0)):
            keyframe(s, "blend_alpha", k, v)
        if c.get("lam_mo", True):
            d.phu_mau("#000000", f - 4, f_het, [(f - 4, 0), (f, 0.45), (f_het - 4, 0.45), (f_het, 0)], [CH_TOI])
        rung_may(d, f, 16, 10)
        d.am("thud", t - 0.03, AM["thud"] * (0.8 if c.get("co", 1.0) < 1 else 1))


VANG, DO, XANH = "#F2C14E", "#E04434", "#5BC85B"  # màu HUD: vàng kim, đỏ báo động, xanh máu đầy


def giay_dh(s):
    h, m, x = (int(v) for v in s.split(":"))
    return h * 3600 + m * 60 + x


def chu_dh(v):
    v = max(0, int(v))
    return f"{v // 3600:02d}:{v % 3600 // 60:02d}:{v % 60:02d}"


def dung_hud(d, hud, M):
    """Lớp HUD game (khóa "hud" trong file hiệu ứng): đồng hồ đếm ngược góc phải trên, huy hiệu cấp
    góc trái trên, thanh HP, điểm kinh nghiệm, thẻ LEVEL UP và thông báo nhiệm vụ. Mốc neo theo cụm chữ SRT."""
    if not hud:
        return

    def bat(t, f0, s=1.35):
        for f, v in ((f0, s), (f0 + 5, 1.0)):
            keyframe(t, "transform.scale_x", f, v)
            keyframe(t, "transform.scale_y", f, v)

    def mau_hp(v):
        return XANH if v > 50 else VANG if v > 20 else DO

    def khoi(mau, x, y, rong, cao, f0, f1, alpha=1.0, ra=4):
        """Một khối màu (COLOR strip thu nhỏ) trên lớp HUD, tâm (x, y) theo tỉ lệ khung."""
        f0, f1 = max(f0, 1), min(f1, d.het)
        if f1 <= f0:
            return None
        s = d.strips.new_effect(name=d.ten("hud"), type='COLOR', channel=d.kenh.lay(CH_HUD, f0, f1), frame_start=f0, length=f1 - f0)
        s.color = hex_mau(mau)[:3]
        s.transform.scale_x, s.transform.scale_y = rong, cao
        s.transform.offset_x, s.transform.offset_y = (x - 0.5) * W, (y - 0.5) * H
        for f, v in ((f0, 0.0), (f0 + min(ra, (f1 - f0) // 2), alpha), (f1 - min(ra, (f1 - f0) // 2), alpha), (f1, 0.0)):
            keyframe(s, "blend_alpha", f, v)
        return s

    # --- đồng hồ đếm ngược: chạy theo giây thật, nhảy mốc khi lời đọc nhắc giờ ---
    dh = hud.get("dong_ho")
    if dh:
        t_bat = M(dh.get("tu", 0.5))
        moc = [(t_bat, giay_dh(dh["bat_dau"]), dh.get("mau", "parchment"))]
        for m in dh.get("moc", []):
            t = M.cua(m)
            if t is not None:
                moc.append((t, giay_dh(m["con"]), m.get("mau", moc[-1][2])))
        t_ve0 = M.cua(dh["het"]) if dh.get("het") else None
        t_tat = (t_ve0 + dh.get("giu", 3.5)) if t_ve0 is not None else d.het / FPS + T0
        f_tat = khung(t_tat)
        nhan = d.chu(dh.get("nhan", "TIME LEFT"), khung(t_bat), f_tat, "hud", 30, VANG, (0.972, 0.862), ("RIGHT", "TOP"), 0.1, True, kenh=CH_HUD)
        d.hien(nhan, khung(t_bat), f_tat, "mo", 8)
        ch_dh = None
        for i, (t0, v0, mau) in enumerate(moc):
            t1 = moc[i + 1][0] if i + 1 < len(moc) else (t_ve0 if t_ve0 is not None else t_tat)
            t = t0
            while t < t1:
                tn = min(t + 1.0, t1)
                f0, f1 = khung(t), khung(tn)
                if f1 > 1 and f0 < d.het and f1 > f0:
                    a, b = max(f0, 1), min(f1, d.het)
                    ch_dh = ch_dh or d.kenh.lay(CH_HUD, 1, d.het)
                    s = d.strips.new_effect(name=d.ten("dh"), type='TEXT', channel=ch_dh, frame_start=a, length=b - a)
                    s.text, s.font, s.font_size = chu_dh(v0 - (t - t0)), d.fonts["so"], 64
                    s.color, s.location = hex_mau(mau), (0.972, 0.955)
                    s.anchor_x, s.anchor_y, s.alignment_x = "RIGHT", "TOP", "RIGHT"
                    s.use_outline, s.outline_color, s.outline_width = True, (0, 0, 0, 1), 0.06
                    s.use_box, s.box_color, s.box_margin = True, (0.06, 0.07, 0.08, 0.72), 0.012
                    s.transform.origin = (0.972, 0.955)
                    if t == t0 and i > 0:  # vừa nhảy mốc: nảy chữ, tiếng báo
                        bat(s, a, 1.25)
                        d.am("canh-bao" if mau in (DO, "rust") else "tick", t0, 0.35)
                    if t == t0 and i == 0:
                        keyframe(s, "blend_alpha", a, 0.0)
                        keyframe(s, "blend_alpha", min(a + 8, b), 1.0)
                t = tn
        if t_ve0 is not None:  # về 0: chớp vàng rồi tắt
            f0 = khung(t_ve0)
            for k in range(int(dh.get("giu", 3.5) * 2)):
                a, b = f0 + k * 12, f0 + k * 12 + 12
                if b <= 1 or a >= d.het:
                    continue
                s = d.chu("00:00:00", a, b, "so", 64, VANG if k % 2 == 0 else "parchment", (0.972, 0.955), ("RIGHT", "TOP"), 0.06, False, hop=0.72, kenh=CH_HUD)
                if s and k == 0:
                    bat(s, max(a, 1), 1.3)

    # --- huy hiệu cấp góc trái trên ---
    cap = list(hud.get("cap_dau", []))
    for c in hud.get("len_cap", []):
        cap.append({"khi": c["khi"], "lan": c.get("lan", 1), "lech": c.get("lech", 0), "chu": c.get("huy_hieu", f"{c['cap']}  ·  {c['ten']}")})
    moc_cap = [(M.cua(c), c["chu"]) for c in cap]
    moc_cap = sorted((t, x) for t, x in moc_cap if t is not None)
    t_an = M(hud.get("an_tu")) if hud.get("an_tu") else None  # tắt huy hiệu từ câu này (vd. đoạn lịch sử thật)
    f_an = khung(t_an) if t_an is not None else d.het
    for i, (t, x) in enumerate(moc_cap):
        f0 = khung(t)
        f1 = min(khung(moc_cap[i + 1][0]) if i + 1 < len(moc_cap) else d.het, f_an)
        if f1 <= f0:
            continue
        s = d.chu(x, f0, f1, "hud", 44, VANG, (0.028, 0.955), ("LEFT", "TOP"), 0.08, True, hop=0.72, kenh=CH_HUD)
        if s:
            bat(s, max(f0, 1), 1.3 if i else 1.0)
            if i == 0:
                keyframe(s, "blend_alpha", max(f0, 1), 0.0)
                keyframe(s, "blend_alpha", max(f0, 1) + 8, 1.0)

    # --- thanh HP: từng cửa sổ hiện, máu tụt / hồi theo mốc ---
    X0, RONG, Y = 0.062, 0.16, 0.862
    for o in hud.get("hp", []):
        ta, tb = M.cua(o, "tu"), M.cua(o, "den")
        if ta is None or tb is None:
            continue
        fa, fb = khung(ta), khung(tb)
        if fb <= 1 or fa >= d.het:
            continue
        diem = [(ta, o.get("dau", 100))] + [(M(k), v) for k, v in o.get("moc", []) if M(k) is not None]
        nguoc = o.get("nguoc", False)  # thanh rủi ro: cao là xấu (đỏ), tăng là tụt máu
        mau_v = (lambda v: mau_hp(100 - v)) if nguoc else mau_hp
        d.chu(o.get("nhan", "HP"), fa, fb, "hud", 30, "parchment", (0.028, Y), ("LEFT", "CENTER"), 0.1, True, kenh=CH_HUD)
        khoi("#15181C", X0 + RONG / 2, Y, RONG + 0.004, 0.024, fa, fb, 0.85)
        nen = khoi("#3A1512", X0 + RONG / 2, Y, RONG, 0.016, fa, fb, 1.0)
        day = khoi(mau_v(diem[0][1]), X0 + RONG * diem[0][1] / 200, Y, RONG * diem[0][1] / 100, 0.016, fa, fb, 1.0)
        if not (nen and day):
            continue
        for j, (t, v) in enumerate(diem):
            f = max(khung(t), fa)
            f_sau = khung(diem[j + 1][0]) if j + 1 < len(diem) else fb
            so = d.chu(f"{v}%" if nguoc else f"{v}/100", f, f_sau, "so", 30, mau_v(v), (X0 + RONG + 0.008, Y), ("LEFT", "CENTER"), 0.08, True, kenh=CH_HUD)
            if j == 0:
                continue
            v_truoc = diem[j - 1][1]
            for k, (x, sc_, mau) in enumerate(((v_truoc, v_truoc, mau_v(v_truoc)), (v, v, mau_v(v)))):
                fk = f + k * 8
                keyframe(day, "transform.scale_x", fk, RONG * x / 100)
                keyframe(day, "transform.offset_x", fk, (X0 + RONG * x / 200 - 0.5) * W)
                keyframe(day, "color", fk, hex_mau(mau)[:3])
            if so:
                bat(so, max(f, 1), 1.4)
            hieu = v - v_truoc
            xau = hieu > 0 if nguoc else hieu < 0
            tx = d.chu(f"{hieu:+d}{'%' if nguoc else ''} {o.get('nhan', 'HP')}", f, f + 30, "hud", 40, DO if xau else XANH, (X0 + RONG * 0.6, Y - 0.05), ("CENTER", "CENTER"), 0.1, True, kenh=CH_HUD)
            if tx:
                keyframe(tx, "transform.offset_y", max(f, 1), 0)
                keyframe(tx, "transform.offset_y", f + 30, -50)
                d.hien(tx, max(f, 1), f + 30, "bat", 10)
            if xau:
                d.phu_mau(DO, max(f, 1), f + 14, [(max(f, 1), 0.0), (f + 2, 0.22), (f + 14, 0.0)], CH_DO)
                d.am("tim", t, AM["tim"])
                d.am("canh-bao", t + 0.05, 0.22)
            else:
                d.am("exp", t, AM["exp"])
            if (v > 80 if nguoc else v < 20):  # nguy kịch: viền đỏ đập theo nhịp tim tới mốc sau
                g = f
                while g + 20 < f_sau:
                    d.phu_mau(DO, g, g + 20, [(g, 0.0), (g + 4, 0.18), (g + 20, 0.0)], CH_DO)
                    d.am("tim", (g - 1) / FPS + T0, 0.55)
                    g += 22

    # --- điểm kinh nghiệm: chữ +EXP và thanh EXP chạy đầy dưới đồng hồ ---
    for e in hud.get("exp", []):
        t = M.cua(e)
        if t is None:
            continue
        f0 = khung(t)
        f1 = khung(M.cua(e, "den")) if e.get("den") else f0 + round(e.get("dai", 3.0) * FPS)
        x1, y = 0.972, 0.775
        s = d.chu(e["chu"], f0, f1, "hud", 40, VANG, (x1, y + 0.012), ("RIGHT", "BOTTOM"), 0.1, True, kenh=CH_HUD)
        if s:
            d.hien(s, max(f0, 1), f1, "bat", 6)
        khoi("#15181C", x1 - 0.08, y - 0.006, 0.164, 0.016, f0, f1, 0.85)
        day = khoi(VANG, x1 - 0.16, y - 0.006, 0.001, 0.01, f0, f1, 1.0)
        if day:
            keyframe(day, "transform.scale_x", max(f0, 1), 0.001)
            keyframe(day, "transform.offset_x", max(f0, 1), (x1 - 0.16 - 0.5) * W)
            keyframe(day, "transform.scale_x", f0 + 20, 0.16)
            keyframe(day, "transform.offset_x", f0 + 20, (x1 - 0.08 - 0.5) * W)
        d.am("exp", t, AM["exp"])

    # --- thẻ LEVEL UP: dải tối viền vàng, chữ nảy, chớp vàng, hạt sáng bay lên, chuông lên cấp ---
    for c in hud.get("len_cap", []):
        t = M.cua(c)
        if t is None:
            continue
        f0 = khung(t)
        f1 = f0 + round(c.get("dai", 3.0) * FPS)
        if f1 <= 1 or f0 >= d.het:
            continue
        y = 0.74
        khoi("#0E1013", 0.5, y, 0.46, 0.2, f0, f1, 0.78, 6)
        for dy in (0.1, -0.1):
            khoi(VANG, 0.5, y + dy, 0.46, 0.004, f0, f1, 1.0, 6)
        a = d.chu(c.get("tieu_de", "LEVEL UP!"), f0, f1, "dam", 104, VANG, (0.5, y + 0.03), ("CENTER", "CENTER"), 0.05, True, kenh=CH_HUD)
        d.hien(a, max(f0, 1), f1, "bat", 8)
        b = d.chu(f"{c['cap']}  ·  {c['ten']}", f0 + 4, f1, "hud", 46, "parchment", (0.5, y - 0.052), ("CENTER", "CENTER"), 0.08, True, kenh=CH_HUD)
        d.hien(b, max(f0 + 4, 1), f1, "mo", 8)
        d.phu_mau(VANG, max(f0, 1), f0 + 16, [(max(f0, 1), 0.0), (f0 + 3, 0.28), (f0 + 16, 0.0)], CH_LOE)
        r = random.Random(f0)
        for _ in range(12):
            g0 = f0 + r.randint(0, 14)
            g1 = g0 + r.randint(22, 34)
            sp = khoi(VANG, r.uniform(0.3, 0.7), y + r.uniform(-0.09, 0.05), 0.006, 0.006 * W / H, g0, g1, 1.0, 3)
            if sp:
                sp.transform.rotation = math.radians(45)
                keyframe(sp, "transform.offset_y", max(g0, 1), sp.transform.offset_y)
                keyframe(sp, "transform.offset_y", g1, sp.transform.offset_y + r.uniform(90, 170))
        d.am("len-cap", t - 0.05, AM["len-cap"])

    # --- thông báo nhiệm vụ (AMBUSH INITIATED, QUEST COMPLETED...) ---
    for c in hud.get("thong_bao", []):
        t = M.cua(c)
        if t is None:
            continue
        f0 = khung(t)
        f1 = f0 + round(c.get("dai", 2.4) * FPS)
        if f1 <= 1 or f0 >= d.het:
            continue
        mau = c.get("mau", VANG)
        y = c.get("y", 0.78)
        cao = 0.13 if c.get("phu") else 0.1
        khoi("#0E1013", 0.5, y, 0.44, cao, f0, f1, 0.75, 5)
        khoi(mau, 0.5 - 0.22, y, 0.005, cao, f0, f1, 1.0, 5)
        khoi(mau, 0.5 + 0.22, y, 0.005, cao, f0, f1, 1.0, 5)
        a = d.chu(c["chu"], f0, f1, "hud", 54, mau, (0.5, y + (0.018 if c.get("phu") else 0)), ("CENTER", "CENTER"), 0.08, True, kenh=CH_HUD)
        d.hien(a, max(f0, 1), f1, "bat", 6)
        if c.get("phu"):
            b = d.chu(c["phu"], f0 + 3, f1, "hud", 30, "parchment", (0.5, y - 0.034), ("CENTER", "CENTER"), 0.08, True, kenh=CH_HUD)
            d.hien(b, max(f0 + 3, 1), f1, "mo", 6)
        if mau == DO:
            d.phu_mau(DO, max(f0, 1), f0 + 12, [(max(f0, 1), 0.0), (f0 + 2, 0.2), (f0 + 12, 0.0)], CH_DO)
        d.am(c.get("am", "canh-bao" if mau == DO else "exp"), t, None)


def dung_gio(d, hu, mc, loai="gio"):
    """Âm nền (gió sa mạc, nước chảy, lửa đèn, cuốc đất) cho các cảnh liền nhau, nối vòng file âm."""
    ds = sorted(s for s in hu.get(loai, []) if s in mc)
    doan = []
    for so in ds:
        if doan and doan[-1][1] == so - 1:
            doan[-1][1] = so
        else:
            doan.append([so, so])
    gio = d.sfx[loai]
    dai = int(am_thanh.do_dai(gio) * FPS)
    for a, b in doan:
        f0, f1 = mc[a][0], mc[b][1]
        f = f0
        while f < f1:
            g = min(f + dai, f1)
            ch = d.kenh.lay(CH_GIO, f, g)
            s = d.strips.new_sound(name=d.ten(loai), filepath=gio, channel=ch, frame_start=f)
            s.right_handle = g
            v = AM[loai]
            for k, val in ((f, 0 if f == f0 else v), (min(f + 14, g), v), (max(g - 14, f), v), (g, 0 if g == f1 else v)):
                keyframe(s, "volume", k, val)
            f = g


def dung_nhac(d, hu, srt, M, tong, t_het):
    """Nhạc nền: tự tạo nhạc gốc theo từng chương (hoặc dùng file --nhac), tự nhỏ khi có giọng.
    tong: độ dài cả video (nhạc luôn tạo cho cả video để dùng lại); t_het: giây kết thúc đoạn đang dựng."""
    cfg = hu.get("nhac", {})
    if d.a.nhac:
        path = d.a.nhac
    else:
        doan_raw = cfg.get("doan", [[0, "meo1"]])
        mocs = [M(x[0]) for x in doan_raw]
        doan = []
        for i, x in enumerate(doan_raw):
            t0 = mocs[i]
            if t0 is None or t0 >= tong:
                continue
            t1 = M(x[2]) if len(x) > 2 else next((m for m in mocs[i + 1:] if m is not None), tong)
            doan.append((round(t0, 3), round(min(t1, tong), 3), x[1]))
        lang = [(M(a), M(b)) for a, b in cfg.get("lang", [])]
        lang = [(round(a, 3), round(b, 3)) for a, b in lang if a is not None and b is not None and a < tong]
        khoa = hashlib.md5(json.dumps([doan, lang, round(tong, 2)]).encode()).hexdigest()[:8]
        path = os.path.join(d.thu_muc, f"nhac-{khoa}.wav")
        if not os.path.exists(path):
            print("[ghep_video] Đang tạo nhạc nền gốc...")
            am_thanh.tao_nhac(path, tong, doan, lang)
    s = d.strips.new_sound(name="nhac", filepath=path, channel=CH_NHAC, frame_start=khung(0.0))
    s.left_handle, s.right_handle = 1, d.het

    # Mức nhạc: nhỏ dưới giọng, to lên ở khoảng nghỉ, tắt hẳn ở các câu đùa.
    giong = []
    for a, b, _ in srt:
        if a >= tong:
            break
        if giong and a - giong[-1][1] < 0.5:
            giong[-1][1] = max(giong[-1][1], b)
        else:
            giong.append([a, b])
    nghi = [(giong[i][1], giong[i + 1][0]) for i in range(len(giong) - 1)]
    if giong:
        nghi = [(0, giong[0][0])] + nghi + [(giong[-1][1], tong + 5)]
    tat = [(M(c), M(c) + dai) for c, dai in cfg.get("tat_khi_dua", []) if M(c) is not None]
    if d.a.nhac:
        # nhạc có sẵn không tự lặng được như nhạc gốc: chỗ "lặng" thành chỗ tắt mức nhạc
        tat += [(M(a), M(b)) for a, b in cfg.get("lang", []) if M(a) is not None and M(b) is not None]

    def muc(t):
        v = NHAC_DUOI_GIONG
        for a, b in nghi:
            if a <= t <= b:
                len_ = 1.0 if a == 0 else (t - a) / 0.25
                xuong = 1.0 if b > tong else (b - t) / 0.25
                v += (NHAC_KHI_NGHI - NHAC_DUOI_GIONG) * max(0.0, min(1.0, len_, xuong))
                break
        for a, b in tat:
            if a - 0.06 <= t < a:
                v *= (a - t) / 0.06
            elif a <= t <= b:
                v = 0.0
            elif b < t <= b + 0.5:
                v *= (t - b) / 0.5
        return v

    diem = {0.0}
    for a, b in nghi:
        diem |= {a, a + 0.25, b - 0.25, b}
    for a, b in tat:
        diem |= {a - 0.06, a, b, b + 0.5}
    da = set()
    keyframe(s, "volume", 1, muc(T0))
    for t in sorted(x for x in diem if T0 < x < t_het - 0.5):
        f = round(1 + (t - T0) * FPS, 1)
        if f not in da:
            da.add(f)
            keyframe(s, "volume", f, muc(t))
    keyframe(s, "volume", d.het - FPS // 2, muc(t_het - 0.5))
    keyframe(s, "volume", d.het, 0.0)


def lam_muot(sc):
    """Đổi nội suy: chữ nảy kiểu 'BACK', chữ trượt kiểu 'EXPO' (các chuyển động khác giữ tuyến tính)."""
    try:
        from bpy_extras import anim_utils
        ad = sc.animation_data
        cb = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot)
        for fc in cb.fcurves:
            p = fc.data_path
            if '"chu-' not in p:
                continue
            kieu = "BACK" if "transform.scale" in p else "EXPO" if "transform.offset" in p else None
            if kieu:
                for k in fc.keyframe_points:
                    k.interpolation, k.easing = kieu, 'EASE_OUT'
    except Exception as e:  # chỉ là làm đẹp, không chặn việc dựng
        print("[ghep_video] Bỏ qua làm mượt:", e)


def khung_doc(d, het, tieu_de):
    """Khung dọc: hai dải than chì che phần hình tràn ra ngoài dải giữa, vạch đồng ở mép, câu mở đầu ở trên."""
    tren, duoi = DAI_TREN / H, (H - DAI_TREN - DAI_CAO) / H
    tren_cung = CH_KHUNG[::-1]  # dải khung nằm trên lớp phủ, chừa các kênh dưới cho hat_phim và lop_phu
    for cao, tam in ((tren, 1 - tren / 2), (duoi, duoi / 2)):
        s = d.strips.new_effect(name=d.ten("khung"), type='COLOR', channel=d.kenh.lay(tren_cung, 1, het), frame_start=1, length=het - 1)
        s.color = hex_mau("graphite")[:3]
        s.transform.scale_y, s.transform.offset_y = cao, (tam - 0.5) * H
    d.thanh("bronze", 0.5, 1 - tren, 1.0, 4 / H, 1, het, tren_cung, tho=True)
    d.thanh("bronze", 0.5, duoi, 1.0, 4 / H, 1, het, tren_cung, tho=True)
    if tieu_de:
        t = d.chu(tieu_de.replace("\\n", "\n"), 1, het, "dam", 92, "parchment", (0.5, 1 - tren / 2 + 0.012), ("CENTER", "CENTER"), 0.05, tho=True)
        t.wrap_width = 0.92
        if not d.a.tieu_de_tinh:  # chỉ nảy ra ở mảnh đầu; không mờ dần ở cuối để khung giữ cuối và chỗ nối vẫn còn chữ
            keyframe(t, "blend_alpha", 1, 0.0)
            keyframe(t, "blend_alpha", 3, 1.0)
            for f, s in ((1, 1.4), (6, 1.0)):
                keyframe(t, "transform.scale_x", f, s)
                keyframe(t, "transform.scale_y", f, s)
    nhan = "  ·  ".join(x for x in (d.ten_kenh, d.nhan_file) if x)  # khóa ten_kenh, nhan_file trong file hiệu ứng
    if nhan:
        d.chu(nhan, 1, het, "dam", 30, "bronze", (0.5, 1 - tren + 0.018), ("CENTER", "CENTER"), 0, False, tho=True)


def main():
    global T0, DOC, W, H
    a = doc_args()
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    hu = {}
    if a.hieu_ung:
        with open(a.hieu_ung, encoding="utf-8") as f:
            hu = json.load(f)

    if a.doc:
        DOC, W, H = True, 1080, 1920
    elif a.doc_tran:
        W, H = 1080, 1920
    sc = bpy.context.scene
    sc.render.fps, sc.render.fps_base = FPS, 1
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.view_settings.view_transform = 'Standard'  # giữ đúng màu ảnh gốc
    sc.sequence_editor_create()

    scenes = doc_srt(a.scenes)
    srt = doc_srt(a.srt)
    n = min(a.den_canh, len(scenes)) if a.den_canh else len(scenes)
    dau_canh = max(1, a.tu_canh)
    ds_so = list(range(dau_canh, n + 1))
    files = ds_canh(a.canh)
    for t in a.thay:
        moi = ds_canh(t)
        files.update(moi)
        print(f"[ghep_video] Thay {len(moi)} cảnh từ {t}: {sorted(moi)}")
    thieu = [i for i in ds_so if i not in files]
    if thieu:
        sys.exit(f"Thiếu file cảnh: {thieu}")

    # Mốc từng cảnh (giây của video gốc): cảnh 1 bắt đầu từ 0, mỗi cảnh kéo tới đầu cảnh sau.
    bat_dau = {so: 0.0 if so == 1 else scenes[so - 1][0] for so in range(1, len(scenes) + 1)}
    T0 = bat_dau[dau_canh]
    t_het = scenes[n][0] if n < len(scenes) else round(scenes[-1][1] * FPS) / FPS + 1
    tong_ca = round(scenes[-1][1] * FPS) / FPS + 1  # độ dài cả video, dùng cho nhạc nền
    het = khung(t_het)
    mc = {so: (khung(bat_dau[so]), khung(scenes[so][0]) if so < n else het) for so in ds_so}
    tong = (het - 1) / FPS
    M = Moc(srt, bat_dau)
    global TAI_NGUYEN
    TAI_NGUYEN = tim_tai_nguyen(a.out)
    MAU.update((hu or {}).get("mau", {}))  # màu riêng của kênh
    d = Dung(a, sc, het, hu)

    dung_canh(d, files, mc, hu)

    if hu:
        # Chỉnh màu nhẹ (bóng hơi xanh gỉ đồng, sáng hơi ấm), thêm tương phản và viền tối.
        if hu.get("mau_chuong"):
            dung_mau_chuong(d, hu["mau_chuong"], M)
        else:
            mau = d.strips.new_effect(name="chinh-mau", type='ADJUSTMENT', channel=CH_MAU, frame_start=1, length=het - 1)
            cb = mau.modifiers.new(name="can-mau", type='COLOR_BALANCE').color_balance
            cb.lift, cb.gamma, cb.gain = (0.98, 1.0, 1.02), (1.0, 0.99, 0.97), (1.04, 1.0, 0.95)
            bc = mau.modifiers.new(name="tuong-phan", type='BRIGHT_CONTRAST')
            bc.contrast = 6
        v = d.strips.new_image(name="vignette", filepath=d.vignette(), channel=CH_VIGNETTE, frame_start=1)
        v.right_handle = het
        v.blend_type = 'ALPHA_OVER'
        if DOC:
            khung_doc(d, het, a.tieu_de)
        dung_the_chuong(d, hu, mc, M)
        dung_chu(d, hu, M)
        dung_con_dau(d, hu, M)
        dung_lop_phu(d, hu, M)
        dung_rung_set(d, hu, M)
        dung_hud(d, hu.get("hud", {}), M)
        for c in hu.get("sfx", []):
            if c.get("ket_thuc_luc"):
                d.am(c["file"], M(c["ket_thuc_luc"]), c.get("am"), ket_thuc=True)
            else:
                d.am(c["file"], M.cua(c), c.get("am"))
        for loai in AM_NEN:
            dung_gio(d, hu, mc, loai)
        dung_nhac(d, hu, srt, M, tong_ca, t_het)

    # Phụ đề
    for j, (t0, t1, text) in enumerate([] if a.khong_phu_de else srt):
        f0, f1 = khung(t0), min(khung(t1), het)
        if f0 >= het:
            break
        if DOC:  # phụ đề lớn giữa dải dưới; nối dòng SRT để Blender tự xuống dòng theo bề rộng
            t = d.chu(" ".join(text.split()), f0, f1, "phu-de", 60, "parchment", (0.5, (H - DAI_TREN - DAI_CAO) / H / 2), ("CENTER", "CENTER"),
                      0.12, kenh=CH_PHU_DE, tho=True)
        else:
            co, y = (58, 0.24) if a.doc_tran else (54, 0.07)  # Shorts: tránh dải nút và tiêu đề ở đáy khung
            t = d.chu(text, f0, f1, "phu-de", co, "parchment", (0.5, y), ("CENTER", "BOTTOM"), 0.12, kenh=CH_PHU_DE)
        if t:
            t.name, t.wrap_width = f"pd-{j + 1}", 0.9 if DOC else 0.85

    # Giọng đọc, nhỏ dần ở 0,5 giây cuối
    g = d.strips.new_sound(name="giong", filepath=a.audio, channel=CH_GIONG, frame_start=khung(0.0))
    g.left_handle, g.right_handle = 1, het
    if not a.manh or a.doan_cuoi:
        keyframe(g, "volume", het - FPS // 2, 1.0)
        keyframe(g, "volume", het, 0.0)
        # Tối dần ở cuối
        d.phu_mau("#000000", het - FPS // 2, het, [(het - FPS // 2, 0.0), (het, 1.0)], [CH_DEN])

    lam_muot(sc)
    for loi in M.loi:
        print("[ghep_video] CẢNH BÁO:", loi)

    sc.frame_start, sc.frame_end = 1, het - 1
    out = a.out
    os.makedirs(os.path.dirname(out), exist_ok=True)
    r = sc.render
    if hasattr(r.image_settings, "media_type"):
        r.image_settings.media_type = 'VIDEO'
    r.image_settings.file_format = 'FFMPEG'
    r.ffmpeg.format, r.ffmpeg.codec = 'MPEG4', 'H264'
    r.ffmpeg.constant_rate_factor, r.ffmpeg.ffmpeg_preset = 'HIGH', 'GOOD'
    r.ffmpeg.audio_codec, r.ffmpeg.audio_bitrate = 'AAC', 192
    r.ffmpeg.audio_channels, r.ffmpeg.audio_mixrate = 'STEREO', 48000
    r.filepath = out
    r.use_file_extension = False

    bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(out)[0] + ".blend")
    print(f"[ghep_video] {len(ds_so)} cảnh, {tong:.1f} giây, {len(d.strips)} strip -> {out}")
    if not a.khong_render:
        bpy.ops.render.render(animation=True)
        if not (a.manh or a.doan_cuoi):
            chuan_hoa_am(a.ffmpeg, out)
        print("[ghep_video] Xong.")


def chuan_hoa_am(ffmpeg, out):
    """Đưa độ lớn về chuẩn YouTube (-14 LUFS, đỉnh -1 dBTP), giữ nguyên hình (không nén lại)."""
    tam = os.path.splitext(out)[0] + ".tam.mp4"
    try:
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", out, "-c:v", "copy",
                        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.7:attack=1:release=60:level=false", "-c:a", "aac", "-b:a", "192k", tam], check=True)
        os.replace(tam, out)
        print("[ghep_video] Đã chuẩn hóa âm lượng về -14 LUFS.")
    except (OSError, subprocess.CalledProcessError) as e:
        print("[ghep_video] Bỏ qua chuẩn hóa âm lượng:", e)


main()
