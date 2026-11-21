"""Vẽ nét động lên ảnh cảnh (mũi tên chiến thuật trên sa bàn, nét phấn trên bảng doodle) bằng Blender.

  blender -b --factory-startup --python ve_net.py -- --canh <thư mục canh> --ra <thư mục ra> --net <file JSON>

File JSON: {"013": {"giay": 4.4, "net": [ {nét}, ... ], "chu": [ {chữ}, ... ]}, ...}
- nét: {"diem": [[x, y], ...] (0..1, gốc trái trên), "kieu": "but" | "phan" | "dut", "mau": "#E04434",
        "day": 0.012 (theo bề rộng khung), "tu": 0.2, "dai": 0.5 (giây), "mui": true, "vong": false}
  but = nét bút dạ có viền tối, phan = nét phấn lấm tấm, dut = nét đứt (từng gạch hiện lần lượt).
  vong = đường khép kín (vòng tròn / vòng vây). Nét hiện dần dọc theo chiều dài; mũi tên bật ra ở cuối.
- chữ: {"chu": "60°", "x": .., "y": .., "co": 0.05, "mau": "#FFFFFF", "tu": 1.0}
Ra <ra>/NNN-clip.mp4 dài "giay" + 0,5 giây; ghép vào ghep_video.py bằng --thay <ra>.
Máy quay trực giao đẩy vào rất nhẹ (3%) cho khung không đứng im; nét nằm cùng mặt phẳng nên luôn khớp hình.
"""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

sys.stdout.reconfigure(encoding="utf-8")
W, H, FPS = 1920, 1080, 24
RONG, CAO = 16.0, 9.0
FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts", "SpecialElite-Regular.ttf")


def doc_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--canh", required=True)
    p.add_argument("--ra", required=True)
    p.add_argument("--net", required=True)
    p.add_argument("--chi", default="", help="chỉ dựng các cảnh này (phẩy ngăn cách)")
    return p.parse_args(argv)


def hex3(h):
    h = h.lstrip("#")
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))  # sRGB -> tuyến tính


def vi_tri(x, y, z=0.0):
    return Vector(((x - 0.5) * RONG, (0.5 - y) * CAO, z))


def vat_lieu(ten, mau, phan=False):
    m = bpy.data.materials.new(ten)
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hex3(mau) + (1,)
    if not phan:
        nt.links.new(em.outputs[0], out.inputs["Surface"])
        return m
    # phấn: lỗ chỗ theo nhiễu mịn, chỗ trống để lộ bảng
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = 'BLENDED'
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 160
    nz.inputs["Detail"].default_value = 2
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.38, 0.55
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return m


def duong(ten, diem, day, mat, z, vong=False):
    """Đường cong Bezier tự làm mượt qua các điểm, độ dày = day * RONG."""
    cu = bpy.data.curves.new(ten, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = day * RONG / 2
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(diem) - 1)
    for bp, (x, y) in zip(sp.bezier_points, diem):
        bp.co = vi_tri(x, y, z)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    sp.use_cyclic_u = vong
    o = bpy.data.objects.new(ten, cu)
    o.scale = (1, 1, 0.002)  # ép dẹt ống: nét màu (z cao hơn) luôn nằm trên viền tối dày hơn
    o.location.z = z * (1 - 0.002)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def hien_dan(o, f0, f1):
    cu = o.data
    cu.bevel_factor_end = 0.0
    cu.keyframe_insert("bevel_factor_end", frame=f0)
    cu.bevel_factor_end = 1.0
    cu.keyframe_insert("bevel_factor_end", frame=max(f1, f0 + 1))
    o.hide_render = True
    o.keyframe_insert("hide_render", frame=1)
    o.hide_render = False
    o.keyframe_insert("hide_render", frame=f0)


def mui_ten(ten, dau, cuoi, co, mat, z, f):
    """Đầu mũi tên tam giác ở điểm cuối, hướng theo đoạn cuối, bật to lên ở khung f."""
    me = bpy.data.meshes.new(ten)
    me.from_pydata([(co * 1.1, 0, 0), (-co * 0.6, co * 0.75, 0), (-co * 0.6, -co * 0.75, 0)], [], [(0, 1, 2)])
    o = bpy.data.objects.new(ten, me)
    bpy.context.scene.collection.objects.link(o)
    me.materials.append(mat)
    a, b = vi_tri(*dau), vi_tri(*cuoi)
    o.location = (b.x, b.y, z + 0.002)
    o.rotation_euler = (0, 0, math.atan2(b.y - a.y, b.x - a.x))
    for k, s in ((f - 1, 0.0), (f + 3, 1.3), (f + 6, 1.0)):
        o.scale = (s, s, s)
        o.keyframe_insert("scale", frame=max(k, 1))
    return o


def chia_dut(diem, so=9):
    """Chia đường gấp khúc thành `so` gạch (mỗi gạch 60% một phần) cho nét đứt."""
    dai = [0.0]
    for (x0, y0), (x1, y1) in zip(diem, diem[1:]):
        dai.append(dai[-1] + math.hypot(x1 - x0, y1 - y0))

    def tai(s):
        for i in range(len(diem) - 1):
            if dai[i + 1] >= s:
                k = (s - dai[i]) / max(dai[i + 1] - dai[i], 1e-9)
                return [diem[i][0] + (diem[i + 1][0] - diem[i][0]) * k, diem[i][1] + (diem[i + 1][1] - diem[i][1]) * k]
        return diem[-1]
    L = dai[-1]
    return [[tai(L * j / so), tai(L * (j + 0.6) / so)] for j in range(so)]


def dung(a, so, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.eevee.taa_render_samples = 16
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.render.fps = FPS
    sc.view_settings.view_transform = 'Standard'
    n = math.ceil((cfg["giay"] + 0.5) * FPS)
    sc.frame_start, sc.frame_end = 1, n
    # ảnh nền phủ kín khung
    me = bpy.data.meshes.new("nen")
    me.from_pydata([(-RONG / 2, -CAO / 2, 0), (RONG / 2, -CAO / 2, 0), (RONG / 2, CAO / 2, 0), (-RONG / 2, CAO / 2, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new()
    for i, c in enumerate(((0, 0), (1, 0), (1, 1), (0, 1))):
        uv.data[i].uv = c
    m = bpy.data.materials.new("nen")
    nt = m.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(a.canh, f"{so}-anh.jpg"))
    em = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(tex.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    me.materials.append(m)
    sc.collection.objects.link(bpy.data.objects.new("nen", me))
    cam = bpy.data.cameras.new("may")
    cam.type = 'ORTHO'
    co = bpy.data.objects.new("may", cam)
    co.location = (0, 0, 10)
    sc.collection.objects.link(co)
    sc.camera = co
    for f, s in ((1, RONG), (n, RONG * 0.97)):
        cam.ortho_scale = s
        cam.keyframe_insert("ortho_scale", frame=f)

    vien = vat_lieu("vien", "#15181C")
    z = 0.01
    for i, net in enumerate(cfg.get("net", [])):
        kieu = net.get("kieu", "but")
        mat = vat_lieu(f"m{i}", net.get("mau", "#E04434"), kieu == "phan")
        day = net.get("day", 0.012 if kieu != "phan" else 0.008)
        f0 = 1 + round(net.get("tu", 0.0) * FPS)
        f1 = f0 + max(2, round(net.get("dai", 0.6) * FPS))
        diem = net["diem"]
        z += 0.01
        if kieu == "dut":
            gach = chia_dut(diem, net.get("so_gach", 9))
            for j, g in enumerate(gach):
                ga = f0 + round((f1 - f0) * j / len(gach))
                gb = f0 + round((f1 - f0) * (j + 1) / len(gach))
                duong(f"vd{i}-{j}", g, day * 1.6, vien, z)
                hien_dan(bpy.data.objects[f"vd{i}-{j}"], ga, gb)
                hien_dan(duong(f"d{i}-{j}", g, day, mat, z + 0.004), ga, gb)
        else:
            if kieu == "but":
                hien_dan(duong(f"v{i}", diem, day * 1.6, vien, z, net.get("vong", False)), f0, f1)
            hien_dan(duong(f"n{i}", diem, day, mat, z + 0.004, net.get("vong", False)), f0, f1)
        if net.get("mui", False):
            if kieu == "but" or kieu == "dut":
                mui_ten(f"mv{i}", diem[-2], diem[-1], day * RONG * 2.6, vien, z + 0.005, f1)
            mui_ten(f"m{i}", diem[-2], diem[-1], day * RONG * 2.0, mat, z + 0.008, f1)
        if net.get("nhap_nhay"):  # vùng nhấn: sau khi vẽ xong thì nhấp nháy độ dày
            o = bpy.data.objects[f"n{i}"]
            for k in range(f1, n, 12):
                o.data.bevel_depth = day * RONG / 2
                o.data.keyframe_insert("bevel_depth", frame=k)
                o.data.bevel_depth = day * RONG * 0.9
                o.data.keyframe_insert("bevel_depth", frame=min(k + 6, n))
    for i, c in enumerate(cfg.get("chu", [])):
        cu = bpy.data.curves.new(f"c{i}", 'FONT')
        cu.body = c["chu"]
        cu.font = bpy.data.fonts.load(FONT)
        cu.size = c.get("co", 0.05) * RONG
        cu.align_x, cu.align_y = {'phai': 'RIGHT', 'trai': 'LEFT'}.get(c.get('canh'), 'CENTER'), 'CENTER'
        o = bpy.data.objects.new(f"c{i}", cu)
        o.location = vi_tri(c["x"], c["y"], 0.3)
        sc.collection.objects.link(o)
        cu.materials.append(vat_lieu(f"mc{i}", c.get("mau", "#FFFFFF"), c.get("phan", False)))
        ds_o = [o]
        if c.get("vien", True):  # viền tối sau chữ cho đọc được trên nền sáng: 8 bản tối lệch quanh chữ
            cv = cu.copy()
            cv.materials.clear()
            cv.materials.append(vat_lieu(f"mv{i}", "#120F0D", False))
            lech = cu.size * 0.06
            for j in range(8):
                g = 2 * math.pi * j / 8
                ov = bpy.data.objects.new(f"cv{i}_{j}", cv)
                x, y, _ = vi_tri(c["x"], c["y"], 0.29)
                ov.location = (x + lech * math.cos(g), y + lech * math.sin(g), 0.29)
                sc.collection.objects.link(ov)
                ds_o.append(ov)
        f = 1 + round(c.get("tu", 0.0) * FPS)
        for k, s in ((f - 1, 0.0), (f + 3, 1.25), (f + 6, 1.0)):
            for oo in ds_o:
                oo.scale = (s, s, s)
                oo.keyframe_insert("scale", frame=max(k, 1))
    r = sc.render
    if hasattr(r.image_settings, "media_type"):
        r.image_settings.media_type = 'VIDEO'
    r.image_settings.file_format = 'FFMPEG'
    r.ffmpeg.format, r.ffmpeg.codec = 'MPEG4', 'H264'
    r.ffmpeg.constant_rate_factor = 'PERC_LOSSLESS'
    r.ffmpeg.audio_codec = 'NONE'
    r.filepath = os.path.join(a.ra, f"{so}-clip.mp4")
    r.use_file_extension = False
    bpy.ops.render.render(animation=True)
    print(f"[ve_net] {so}: {n} khung, {len(cfg.get('net', []))} nét")


def main():
    a = doc_args()
    a.canh, a.ra = os.path.abspath(a.canh), os.path.abspath(a.ra)
    os.makedirs(a.ra, exist_ok=True)
    ds = json.load(open(a.net, encoding="utf-8"))
    chon = [x for x in a.chi.split(",") if x]
    for so, cfg in ds.items():
        if so.startswith("_") or (chon and so not in chon):
            continue
        dung(a, so, cfg)


main()
