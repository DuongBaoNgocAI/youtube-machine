"""Dựng clip parallax 2.5D từ hai lớp của tach_lop.py: nền ở xa, người ở gần, máy quay 3D di chuyển giữa chúng.

  blender -b --factory-startup --python parallax_25d.py -- --lop <thư mục lớp> --ra <thư mục ra> \
      --canh 3:3.6:day 12:4.5:truot 52:3.9:day 98:5.9:lui

Mỗi mục là số cảnh:giây:kiểu chuyển động (day = đẩy vào + trượt nhẹ, truot = trượt ngang, lui = kéo ra).
Ra <thư mục ra>/NNN-clip.mp4 (1920x1080, 24 khung/giây, dài hơn khe 0,5 giây cho phần hòa cảnh).
Dùng trong ghep_video.py bằng --thay <thư mục ra>: clip thay ảnh tĩnh của cảnh cùng số.

Ở khung đầu, hai lớp khớp đúng bố cục ảnh gốc. Khi máy quay đi, lớp gần trượt nhiều hơn lớp xa
(thị sai), cùng độ sâu trường ảnh lấy nét vào người nên nền nhòe nhẹ như ống kính thật.
"""
import argparse
import math
import os
import sys

import bpy

sys.stdout.reconfigure(encoding="utf-8")
W, H, FPS = 1920, 1080, 24
FOV = math.radians(40)
KW = math.tan(FOV / 2)
KH = KW * H / W
D_NEN, D_NGUOI = 12.0, 5.0
LE = 1.1  # lớp to hơn khung 10% để máy quay đi không lộ mép
# kiểu: (trượt ngang đầu, cuối; tiến vào đầu, cuối) theo mét
KIEU = {
    "day": (-0.08, 0.10, 0.0, 0.65),
    "truot": (-0.2, 0.2, 0.15, 0.25),
    "lui": (0.05, -0.08, 0.65, 0.0),
}


def doc_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--lop", required=True)
    p.add_argument("--ra", required=True)
    p.add_argument("--canh", nargs="+", required=True)
    p.add_argument("--khau", type=float, default=5.6, help="khẩu độ (f-stop): nhỏ hơn thì nền nhòe hơn")
    return p.parse_args(argv)


def tam(ten, anh, sau):
    """Một tấm phẳng mang ảnh (phát sáng đúng màu ảnh, trong suốt theo kênh alpha), phủ vừa khung ở độ sâu `sau`."""
    me = bpy.data.meshes.new(ten)
    rong, cao = sau * KW * LE, sau * KH * LE
    me.from_pydata([(-rong, sau, -cao), (rong, sau, -cao), (rong, sau, cao), (-rong, sau, cao)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, c in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[i].uv = c
    m = bpy.data.materials.new(ten)
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = 'BLENDED'
    nt = m.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(anh)
    tex.extension = 'EXTEND'
    em = nt.nodes.new("ShaderNodeEmission")
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(tex.outputs["Alpha"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    me.materials.append(m)
    o = bpy.data.objects.new(ten, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def dung(lop, ra, so, giay, kieu, khau):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 32
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.render.fps = FPS
    sc.view_settings.view_transform = 'Standard'
    n = math.ceil((giay + 0.5) * FPS)
    sc.frame_start, sc.frame_end = 1, n
    tam("nen", os.path.join(lop, f"{so:03d}-nen.png"), D_NEN)
    tam("nguoi", os.path.join(lop, f"{so:03d}-nguoi.png"), D_NGUOI)
    cam = bpy.data.cameras.new("may")
    cam.angle = FOV
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = khau
    o = bpy.data.objects.new("may", cam)
    o.rotation_euler = (math.radians(90), 0, 0)
    sc.collection.objects.link(o)
    sc.camera = o
    x0, x1, y0, y1 = KIEU[kieu]
    for f, x, y in ((1, x0, y0), (n, x1, y1)):
        o.location = (x, y, 0)
        o.keyframe_insert("location", frame=f)
        cam.dof.focus_distance = D_NGUOI - y  # luôn nét ở lớp người
        cam.dof.keyframe_insert("focus_distance", frame=f)
    # đi chậm dần hai đầu (bezier mặc định), không giật
    r = sc.render
    if hasattr(r.image_settings, "media_type"):
        r.image_settings.media_type = 'VIDEO'
    r.image_settings.file_format = 'FFMPEG'
    r.ffmpeg.format, r.ffmpeg.codec = 'MPEG4', 'H264'
    r.ffmpeg.constant_rate_factor = 'PERC_LOSSLESS'
    r.ffmpeg.audio_codec = 'NONE'
    r.filepath = os.path.join(ra, f"{so:03d}-clip.mp4")
    r.use_file_extension = False
    bpy.ops.render.render(animation=True)
    print(f"[parallax] {so:03d}: {n} khung, kiểu {kieu}")


def main():
    a = doc_args()
    os.makedirs(a.ra, exist_ok=True)
    for muc in a.canh:
        so, giay, kieu = muc.split(":")
        dung(os.path.abspath(a.lop), os.path.abspath(a.ra), int(so), float(giay), kieu, a.khau)


main()
