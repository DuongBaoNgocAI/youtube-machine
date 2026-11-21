"""Lớp phủ lửa và khói mô phỏng thật bằng Mantaflow (Cycles, nền trong suốt) để đè lên cảnh 2D trong VSE.

Chạy không mở giao diện:
  blender -b --factory-startup --python mantaflow_lop_phu.py -- [--chi lua-that,khoi-vang] [--khung 96] [--ra lop-phu]

- lua-that: dải lửa cháy dọc mép dưới khung, khói mỏng bốc lên (bình lửa vỡ, tường cháy, đuốc).
- khoi-vang: khói lưu huỳnh vàng đục cuộn từ góc trái dưới sang phải theo gió.
- Mô phỏng chạy qua giai đoạn khởi động rồi lấy (khung + 24) khung; 24 khung cuối được hòa vào 24 khung đầu
  nên chuỗi PNG lop-phu/<tên>/0001.png... lặp liền như các lớp của lop_phu_3d.py.
- Lớp đã có đủ khung thì bỏ qua (xóa thư mục để dựng lại). Bộ nhớ đệm mô phỏng ở lop-phu/_cache/<tên>.
"""
import argparse
import math
import os
import shutil
import sys

import bpy
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
W, H = 1920, 1080
KHOI_DONG = 80  # khung bỏ qua cho lửa / khói kịp lan khắp khung
HOA = 24  # khung hòa để lặp


def doc_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--chi", default="", help="chỉ dựng các lớp này (phẩy ngăn cách)")
    p.add_argument("--khung", type=int, default=96, help="số khung một vòng lặp (24 khung/giây)")
    p.add_argument("--do-phan-giai", type=int, default=128, help="độ phân giải mô phỏng (cạnh dài)")
    p.add_argument("--mau", type=int, default=24, help="số mẫu Cycles")
    p.add_argument("--ti-le", type=int, default=50, help="phần trăm độ phân giải render (lửa khói mềm, phóng lên 1080p khi ghép)")
    p.add_argument("--ra", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "lop-phu"))
    return p.parse_args(argv)


def canh_moi(so_mau, ti_le=50):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = so_mau
    sc.cycles.use_denoising = True
    sc.cycles.volume_step_rate = 2.0
    try:  # GPU nếu có (RTX 3060 Ti)
        pr = bpy.context.preferences.addons["cycles"].preferences
        for loai in ("CUDA",):  # OptiX lỗi biên dịch kernel trên máy này (driver)
            try:
                pr.compute_device_type = loai
                pr.get_devices()
                if any(d.type == loai for d in pr.devices):
                    for d in pr.devices:
                        d.use = d.type == loai
                    sc.cycles.device = 'GPU'
                    print(f"[mantaflow] Cycles dùng {loai}")
                    break
            except TypeError:
                continue
    except KeyError:
        pass
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, ti_le
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    cam = bpy.data.cameras.new("may")
    cam.type = 'ORTHO'
    cam.ortho_scale = 16.0  # khung rộng 16 m, cao 9 m
    o = bpy.data.objects.new("may", cam)
    o.location = (0, -20, 4.5)
    o.rotation_euler = (math.radians(90), 0, 0)
    sc.collection.objects.link(o)
    sc.camera = o
    return sc


def hop(ten, kich, vi_tri):
    bpy.ops.mesh.primitive_cube_add(size=1, location=vi_tri)
    o = bpy.context.active_object
    o.name = ten
    o.scale = kich
    bpy.ops.object.transform_apply(scale=True)
    return o


def mien(ten, kich, vi_tri, do_phan_giai, cache, cuoi):
    d = hop(ten, kich, vi_tri)
    m = d.modifiers.new("fluid", 'FLUID')
    m.fluid_type = 'DOMAIN'
    s = m.domain_settings
    s.domain_type = 'GAS'
    s.resolution_max = do_phan_giai
    s.use_adaptive_domain = False
    s.cache_directory = cache
    s.cache_type = 'ALL'
    s.cache_frame_start, s.cache_frame_end = 1, cuoi
    s.use_noise = True
    s.noise_scale = 2
    s.vorticity = 0.25
    for i in range(6):  # mở biên để khói thoát ra, không dội ngược
        try:
            setattr(s, ("use_collision_border_front", "use_collision_border_back", "use_collision_border_right",
                        "use_collision_border_left", "use_collision_border_top", "use_collision_border_bottom")[i], False)
        except AttributeError:
            pass
    return d, s


def nguon(ten, kich, vi_tri, loai, mau_khoi, nhien_lieu=1.0, nhiet=1.0, khoi=1.0, van_toc=(0, 0, 0)):
    o = hop(ten, kich, vi_tri)
    m = o.modifiers.new("fluid", 'FLUID')
    m.fluid_type = 'FLOW'
    f = m.flow_settings
    f.flow_type = loai
    f.flow_behavior = 'INFLOW'
    f.flow_source = 'MESH'
    f.surface_distance = 0.4
    f.smoke_color = mau_khoi
    f.fuel_amount = nhien_lieu
    f.temperature = nhiet
    f.density = khoi
    if any(van_toc):
        f.use_initial_velocity = True
        f.velocity_coord = van_toc
    o.display_type = 'WIRE'
    o.hide_render = True
    return o


def vat_lieu_khoi(d, mau, mat_do, lua=0.0):
    m = bpy.data.materials.new("khoi")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    ra = nt.nodes.new("ShaderNodeOutputMaterial")
    v = nt.nodes.new("ShaderNodeVolumePrincipled")
    v.inputs["Color"].default_value = (*mau, 1)
    v.inputs["Density"].default_value = mat_do
    try:  # hấp thụ màu sáng để khói không ngả nâu đen
        v.inputs["Absorption Color"].default_value = (*[min(1, c * 1.1) for c in mau], 1)
    except KeyError:
        pass
    try:
        v.inputs["Density Attribute"].default_value = "density"
        v.inputs["Color Attribute"].default_value = "color"
    except (KeyError, TypeError):
        pass
    if lua:
        v.inputs["Blackbody Intensity"].default_value = lua
        try:
            v.inputs["Temperature Attribute"].default_value = "flame"
        except (KeyError, TypeError):
            pass
        v.inputs["Temperature"].default_value = 1500
    nt.links.new(v.outputs["Volume"], ra.inputs["Volume"])
    d.data.materials.append(m)


def lua_that(sc, ra, nk, a, cache):
    cuoi = KHOI_DONG + nk + HOA
    d, s = mien("mien", (17, 2, 10), (0, 0, 4.4), a.do_phan_giai, cache, cuoi)
    s.flame_vorticity = 0.6
    s.flame_max_temp = 4.0
    s.burning_rate = 0.55
    s.flame_smoke = 0.6
    s.alpha = 1.0
    s.beta = 2.2
    # nhiều cụm nguồn so le dọc mép dưới cho lửa lúc cao lúc thấp
    for i, x in enumerate(np.linspace(-7.2, 7.2, 7)):
        nguon(f"lua{i}", (1.2 + 0.5 * (i % 3), 0.9, 0.6), (x, 0, 0.1 + 0.05 * (i % 2)), 'BOTH', (0.08, 0.07, 0.06),
              nhien_lieu=1.8 + 0.4 * (i % 2), nhiet=1.8)
    vat_lieu_khoi(d, (0.12, 0.1, 0.09), 1.5, lua=8.0)
    sc.render.film_transparent = False  # ghép bằng blend ADD: nền đen không cộng gì
    w = bpy.data.worlds.new("den")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.0
    sc.world = w
    return d, cuoi


def khoi_vang(sc, ra, nk, a, cache):
    cuoi = KHOI_DONG + nk + HOA
    d, s = mien("mien", (18, 3, 10), (0.5, 0, 4.6), a.do_phan_giai, cache, cuoi)
    s.alpha = 0.6
    s.beta = 0.4
    s.vorticity = 0.35
    nguon("khoi1", (1.6, 1.2, 1.2), (-7.4, 0, 0.9), 'SMOKE', (0.86, 0.72, 0.16), khoi=1.6, nhiet=0.6, van_toc=(7.0, 0, 0.8))
    nguon("khoi2", (1.2, 1.0, 1.0), (-7.6, 0, 2.6), 'SMOKE', (0.9, 0.78, 0.2), khoi=1.3, nhiet=0.5, van_toc=(6.0, 0, 0.4))
    vat_lieu_khoi(d, (1.0, 0.86, 0.3), 1.6)
    # ánh trời ấm chiếu khói
    w = bpy.data.worlds.new("troi")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 0.82, 0.55, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 3.0
    sc.world = w
    return d, cuoi


LOP = {"lua-that": lua_that, "khoi-vang": khoi_vang}


def hoa_vong(tam, ra, nk):
    """tam/0001.. (nk + HOA khung) → ra/0001..nk: khung i < HOA hòa với khung nk + i."""
    from PIL import Image
    for i in range(1, nk + 1):
        a = np.asarray(Image.open(os.path.join(tam, f"{i:04d}.png")).convert("RGBA"), np.float32)
        if i <= HOA:
            b = np.asarray(Image.open(os.path.join(tam, f"{nk + i:04d}.png")).convert("RGBA"), np.float32)
            t = (i - 0.5) / HOA  # 0 → 1: đầu chuỗi gần như toàn khung "đuôi", cuối đoạn hòa là khung gốc
            a = a * t + b * (1 - t)
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).save(os.path.join(ra, f"{i:04d}.png"))


def main():
    a = doc_args()
    chon = [x for x in a.chi.split(",") if x] or list(LOP)
    for ten in chon:
        ra = os.path.join(a.ra, ten)
        os.makedirs(ra, exist_ok=True)
        if len([f for f in os.listdir(ra) if f.endswith(".png")]) >= a.khung:
            print(f"[mantaflow] {ten}: đã có, bỏ qua")
            continue
        cache = os.path.join(a.ra, "_cache", ten)
        tam = os.path.join(a.ra, "_cache", ten + "-png")
        shutil.rmtree(cache, ignore_errors=True)
        os.makedirs(tam, exist_ok=True)
        sc = canh_moi(a.mau, a.ti_le)
        d, cuoi = LOP[ten](sc, ra, a.khung, a, cache)
        sc.frame_start, sc.frame_end = 1, cuoi
        print(f"[mantaflow] {ten}: mô phỏng {cuoi} khung...")
        bpy.ops.object.select_all(action='DESELECT')
        d.select_set(True)
        bpy.context.view_layer.objects.active = d
        with bpy.context.temp_override(active_object=d, object=d):
            bpy.ops.fluid.bake_all()
        print(f"[mantaflow] {ten}: render {a.khung + HOA} khung...")
        for k in range(a.khung + HOA):
            sc.frame_set(KHOI_DONG + 1 + k)
            sc.render.filepath = os.path.join(tam, f"{k + 1:04d}.png")
            bpy.ops.render.render(write_still=True)
        hoa_vong(tam, ra, a.khung)
        print(f"[mantaflow] {ten}: xong")


main()
