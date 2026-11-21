"""Dựng lớp phủ thời tiết / không khí bằng Blender 3D (EEVEE, nền trong suốt) để đè lên cảnh 2D trong VSE.

Chạy không mở giao diện:
  blender -b --factory-startup --python lop_phu_3d.py -- [--chi mua,tuyet] [--khung 96] [--ra lop-phu]

- Mỗi lớp là một chuỗi PNG RGBA 1920x1080 lặp liền mạch (khung cuối nối khung đầu): lop-phu/<tên>/0001.png...
- Hạt (mưa, tuyết, tàn lửa, bụi) là các mảnh phẳng trong không gian 3D trước máy quay phối cảnh: hạt gần to và nhòe
  (độ sâu trường ảnh), hạt xa nhỏ và rõ. Vị trí tính theo thời gian rồi quấn vòng, nên chạy đúng một chu kỳ là lặp.
- Sương: ba tấm nhiễu 4D ở ba độ sâu, trôi theo vòng tròn trong không gian nhiễu để lặp liền.
- Tia sáng: các dải sáng từ góc trên, đung đưa chậm theo hàm sin cùng chu kỳ.
- Lớp đã có đủ khung thì bỏ qua (xóa thư mục để dựng lại).
"""
import argparse
import math
import os
import sys

import bpy
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
W, H = 1920, 1080
FOV = math.radians(50)
KW = math.tan(FOV / 2)  # nửa bề rộng khung ở độ sâu 1 m (máy quay ngang 16:9)
KH = KW * H / W


def doc_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--chi", default="", help="chỉ dựng các lớp này (phẩy ngăn cách)")
    p.add_argument("--khung", type=int, default=96, help="số khung một vòng lặp (24 khung/giây)")
    p.add_argument("--ra", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "lop-phu"))
    return p.parse_args(argv)


def canh_moi():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'Standard'
    sc.eevee.taa_render_samples = 24
    cam = bpy.data.cameras.new("may")
    cam.angle = FOV
    o = bpy.data.objects.new("may", cam)
    o.rotation_euler = (math.radians(90), 0, 0)  # nhìn theo +Y, trục Z lên trên
    sc.collection.objects.link(o)
    sc.camera = o
    return sc, cam


def vat_lieu(ten, mau, manh, kieu="tron"):
    """Phát sáng + trong suốt; độ đậm lấy từ thuộc tính 'a' của từng hạt, nhân dạng hạt theo UV
    (tron: chấm tròn mềm; vet: vệt dài mờ hai đầu)."""
    m = bpy.data.materials.new(ten)
    m.use_nodes = True
    if hasattr(m, "surface_render_method"):
        m.surface_render_method = 'BLENDED'
    nt = m.node_tree
    nt.nodes.clear()
    ra = nt.nodes.new("ShaderNodeOutputMaterial")
    tron = nt.nodes.new("ShaderNodeMixShader")
    trong = nt.nodes.new("ShaderNodeBsdfTransparent")
    phat = nt.nodes.new("ShaderNodeEmission")
    phat.inputs["Color"].default_value = mau
    phat.inputs["Strength"].default_value = manh
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "a"
    uv = nt.nodes.new("ShaderNodeUVMap")
    tach = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(uv.outputs["UV"], tach.inputs[0])
    # hình dạng: tron = 1 - clamp(2*|uv - 0.5|) ^ 2 ; vet = sin(pi*v) * (1 - |2u-1|)
    toan = nt.nodes.new("ShaderNodeMath")
    if kieu == "tron":
        dx = nt.nodes.new("ShaderNodeMath"); dx.operation = 'SUBTRACT'; dx.inputs[1].default_value = 0.5
        dy = nt.nodes.new("ShaderNodeMath"); dy.operation = 'SUBTRACT'; dy.inputs[1].default_value = 0.5
        nt.links.new(tach.outputs["X"], dx.inputs[0]); nt.links.new(tach.outputs["Y"], dy.inputs[0])
        r = nt.nodes.new("ShaderNodeVectorMath"); r.operation = 'LENGTH'
        gop = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(dx.outputs[0], gop.inputs[0]); nt.links.new(dy.outputs[0], gop.inputs[1])
        nt.links.new(gop.outputs[0], r.inputs[0])
        nhan = nt.nodes.new("ShaderNodeMath"); nhan.operation = 'MULTIPLY'; nhan.inputs[1].default_value = 2.0
        nt.links.new(r.outputs["Value"], nhan.inputs[0])
        mu = nt.nodes.new("ShaderNodeMath"); mu.operation = 'POWER'; mu.inputs[1].default_value = 1.6
        kep = nt.nodes.new("ShaderNodeClamp")
        nt.links.new(nhan.outputs[0], kep.inputs[0]); nt.links.new(kep.outputs[0], mu.inputs[0])
        toan.operation = 'SUBTRACT'; toan.inputs[0].default_value = 1.0
        nt.links.new(mu.outputs[0], toan.inputs[1])
    else:
        sv = nt.nodes.new("ShaderNodeMath"); sv.operation = 'MULTIPLY'; sv.inputs[1].default_value = math.pi
        nt.links.new(tach.outputs["Y"], sv.inputs[0])
        sn = nt.nodes.new("ShaderNodeMath"); sn.operation = 'SINE'
        nt.links.new(sv.outputs[0], sn.inputs[0])
        u2 = nt.nodes.new("ShaderNodeMath"); u2.operation = 'MULTIPLY_ADD'; u2.inputs[1].default_value = 2.0; u2.inputs[2].default_value = -1.0
        nt.links.new(tach.outputs["X"], u2.inputs[0])
        ab = nt.nodes.new("ShaderNodeMath"); ab.operation = 'ABSOLUTE'
        nt.links.new(u2.outputs[0], ab.inputs[0])
        mot = nt.nodes.new("ShaderNodeMath"); mot.operation = 'SUBTRACT'; mot.inputs[0].default_value = 1.0
        nt.links.new(ab.outputs[0], mot.inputs[1])
        toan.operation = 'MULTIPLY'
        nt.links.new(sn.outputs[0], toan.inputs[0]); nt.links.new(mot.outputs[0], toan.inputs[1])
    he = nt.nodes.new("ShaderNodeMath"); he.operation = 'MULTIPLY'
    nt.links.new(toan.outputs[0], he.inputs[0]); nt.links.new(attr.outputs["Fac"], he.inputs[1])
    kep2 = nt.nodes.new("ShaderNodeClamp")
    nt.links.new(he.outputs[0], kep2.inputs[0])
    nt.links.new(kep2.outputs[0], tron.inputs["Fac"])
    nt.links.new(trong.outputs[0], tron.inputs[1])
    nt.links.new(phat.outputs[0], tron.inputs[2])
    nt.links.new(tron.outputs[0], ra.inputs["Surface"])
    return m


class Hat:
    """N mảnh phẳng (mỗi hạt 4 đỉnh) trong một mesh; mỗi khung chỉ ghi lại tọa độ đỉnh."""

    def __init__(self, sc, ten, n, mat):
        self.n = n
        me = bpy.data.meshes.new(ten)
        v = np.zeros((n * 4, 3), np.float32)
        f = np.arange(n * 4, dtype=np.int32).reshape(n, 4)
        me.vertices.add(n * 4)
        me.loops.add(n * 4)
        me.polygons.add(n)
        me.vertices.foreach_set("co", v.ravel())
        me.loops.foreach_set("vertex_index", f.ravel())
        me.polygons.foreach_set("loop_start", np.arange(0, n * 4, 4, dtype=np.int32))
        me.polygons.foreach_set("loop_total", np.full(n, 4, np.int32))
        me.update()
        uv = me.uv_layers.new(name="UVMap")
        uv.data.foreach_set("uv", np.tile(np.array([[0, 0], [1, 0], [1, 1], [0, 1]], np.float32), (n, 1)).ravel())
        self.a = me.attributes.new("a", 'FLOAT', 'POINT')
        me.materials.append(mat)
        self.me = me
        o = bpy.data.objects.new(ten, me)
        sc.collection.objects.link(o)

    def dat(self, tam, huong, dai, rong, alpha):
        """tam (n,3); huong (n,3) đơn vị trong mặt XZ; dai, rong, alpha (n,)."""
        vuong = np.stack([huong[:, 2], np.zeros(self.n), -huong[:, 0]], 1)  # vuông góc trong mặt XZ
        d = huong * (dai / 2)[:, None]
        p = vuong * (rong / 2)[:, None]
        v = np.stack([tam - d - p, tam - d + p, tam + d + p, tam + d - p], 1).reshape(-1, 3)
        self.me.vertices.foreach_set("co", v.astype(np.float32).ravel())
        self.a.data.foreach_set("value", np.repeat(alpha, 4).astype(np.float32))
        self.me.update()


def trong_khung(r, n, y0, y1):
    """Vị trí ngẫu nhiên đều trong khối nhìn thấy: u, v theo tỉ lệ khung (-1..1, dư mép), y là độ sâu."""
    y = y0 + (y1 - y0) * r.random(n) ** 1.6  # dồn hạt về gần cho dày
    return r.uniform(-1.25, 1.25, n), r.uniform(-1.25, 1.25, n), y


def chay_hat(sc, ra, so_khung, n, y0, y1, mat, ham, tieu_cu=4.0, khau=2.0):
    """ham(t: 0..1 trong vòng lặp, u0, v0, y, r) -> (u, v, huong, dai, rong, alpha) theo đơn vị khung ở độ sâu y."""
    r = np.random.default_rng(7)
    u0, v0, y = trong_khung(r, n, y0, y1)
    h = Hat(sc, "hat", n, mat)
    cam = sc.camera.data
    cam.dof.use_dof = True
    cam.dof.focus_distance, cam.dof.aperture_fstop = tieu_cu, khau
    tham = {"pha": r.random(n), "le": r.random(n)}
    for k in range(so_khung):
        p = os.path.join(ra, f"{k + 1:04d}.png")
        if os.path.exists(p):
            continue
        u, v, huong, dai, rong, alpha = ham(k / so_khung, u0, v0, y, tham)
        u = (u + 1.25) % 2.5 - 1.25
        v = (v + 1.25) % 2.5 - 1.25
        tam = np.stack([u * y * KW, y, v * y * KH], 1)
        h.dat(tam, huong, dai * y, rong * y, alpha)
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)


def lop_mua(sc, ra, nk):
    mat = vat_lieu("mua", (0.82, 0.88, 0.95, 1), 1.0, "vet")
    goc = math.radians(12)  # gió thổi chéo nhẹ
    huong1 = np.array([math.sin(goc), 0, -math.cos(goc)])

    def ham(t, u0, v0, y, th):
        vong = np.where(th["le"] < 0.5, 3, 4)  # 3 hoặc 4 lượt rơi hết khung mỗi vòng: tốc độ khác nhau, vẫn lặp liền
        s = 2.5 * vong * t
        v = v0 - s
        u = u0  # trôi ngang phải là bội số nguyên của bề rộng khung mới lặp liền; mưa nhanh nên bỏ trôi ngang
        n = len(u0)
        return u, v, np.tile(huong1, (n, 1)), np.full(n, 0.11), np.full(n, 0.0016), 0.14 + 0.18 * th["pha"]
    chay_hat(sc, ra, nk, 2000, 1.2, 14, mat, ham, 6.0, 2.8)


def lop_tuyet(sc, ra, nk):
    mat = vat_lieu("tuyet", (0.95, 0.97, 1.0, 1), 1.2, "tron")
    goc = math.radians(35)

    def ham(t, u0, v0, y, th):
        s = 2.5 * np.where(th["le"] < 0.5, 1, 2) * t
        lac = 0.03 * np.sin(2 * np.pi * (t * 2 + th["pha"]))
        u = u0 + 2.5 * t + lac  # đúng một vòng ngang mỗi vòng lặp
        v = v0 - s
        n = len(u0)
        huong = np.tile(np.array([0.0, 0, 1.0]), (n, 1))
        co = 0.004 + 0.004 * th["pha"]
        return u, v, huong, co, co, 0.35 + 0.5 * th["le"]
    chay_hat(sc, ra, nk, 1800, 1.0, 12, mat, ham, 5.0, 2.0)


def lop_tan_lua(sc, ra, nk):
    mat = vat_lieu("tan-lua", (1.0, 0.42, 0.06, 1), 1.6, "tron")

    def ham(t, u0, v0, y, th):
        s = 2.5 * np.where(th["le"] < 0.6, 1, 2) * t
        lac = 0.05 * np.sin(2 * np.pi * (t * 3 + th["pha"] * 5))
        u = u0 + lac
        v = v0 + s
        n = len(u0)
        nhap = 0.5 + 0.5 * np.sin(2 * np.pi * (t * 6 + th["pha"] * 7)) ** 2  # lập lòe
        co = 0.006 + 0.007 * th["pha"]
        return u, v, np.tile(np.array([0.0, 0, 1.0]), (n, 1)), co, co, (0.3 + 0.7 * th["le"]) * nhap
    chay_hat(sc, ra, nk, 420, 1.0, 10, mat, ham, 4.0, 1.8)


def lop_mua_ten(sc, ra, nk):
    """Mưa tên che trời: tên tối, nét sắc, bay ngang chếch xuống ở nửa trên khung (bầu trời), không phát sáng."""
    mat = vat_lieu("mua-ten", (0.04, 0.035, 0.03, 1), 1.0, "vet")
    huong1 = np.array([1.0, 0, -0.22]) / math.hypot(1.0, 0.22)

    def ham(t, u0, v0, y, th):
        k = np.where(th["le"] < 0.6, 2, 3)  # 2 hoặc 3 lượt ngang mỗi vòng: số nguyên nên lặp liền
        u = u0 + 2.5 * k * t
        v = 0.05 + (v0 + 1.25) / 2.5 * 1.15  # chỉ nửa trên khung, không trôi dọc
        n = len(u0)
        return u, v, np.tile(huong1, (n, 1)), np.full(n, 0.045), np.full(n, 0.0045), 0.7 + 0.3 * th["pha"]
    chay_hat(sc, ra, nk, 1100, 5.0, 18, mat, ham, 10.0, 22.0)  # f/22: gần như không nhòe


def lop_bui(sc, ra, nk):
    mat = vat_lieu("bui", (1.0, 0.9, 0.68, 1), 1.3, "tron")

    def ham(t, u0, v0, y, th):
        u = u0 + 0.06 * np.sin(2 * np.pi * (t + th["pha"]))
        v = v0 + 0.05 * np.sin(2 * np.pi * (t + th["le"])) + 2.5 * t * np.where(th["le"] < 0.3, 1, 0)
        n = len(u0)
        co = 0.004 + 0.006 * th["pha"]
        return u, v, np.tile(np.array([0.0, 0, 1.0]), (n, 1)), co, co, 0.3 + 0.45 * th["le"]
    chay_hat(sc, ra, nk, 500, 1.0, 9, mat, ham, 3.5, 1.6)


def lop_suong(sc, ra, nk):
    """Ba tấm nhiễu 4D ở ba độ sâu; tọa độ nhiễu đi trên một vòng tròn nên khung cuối nối khung đầu."""
    tam_ = []
    for i, (y, cao, dam) in enumerate(((3.0, -0.25, 0.42), (6.0, -0.1, 0.36), (11.0, 0.05, 0.3))):
        bpy.ops.mesh.primitive_plane_add(size=1)
        o = bpy.context.active_object
        o.rotation_euler = (math.radians(90), 0, 0)
        o.location = (0, y, cao * y * KH * 2)
        o.scale = (y * KW * 2.6, y * KH * 1.6, 1)
        m = bpy.data.materials.new(f"suong{i}")
        m.use_nodes = True
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = 'BLENDED'
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        mix = nt.nodes.new("ShaderNodeMixShader")
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (0.78, 0.82, 0.86, 1)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (2.2, 3.5, 1)
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.noise_dimensions = '4D'
        nz.inputs["Scale"].default_value = 1.6
        nz.inputs["Detail"].default_value = 3.0
        nz.inputs["Roughness"].default_value = 0.55
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[1].position = 0.42, 0.78
        # mép trên / dưới mờ dần để không lộ viền tấm
        tach = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["UV"], tach.inputs[0])
        mepv = nt.nodes.new("ShaderNodeMath"); mepv.operation = 'SINE'
        pv = nt.nodes.new("ShaderNodeMath"); pv.operation = 'MULTIPLY'; pv.inputs[1].default_value = math.pi
        nt.links.new(tach.outputs["Y"], pv.inputs[0]); nt.links.new(pv.outputs[0], mepv.inputs[0])
        nhan = nt.nodes.new("ShaderNodeMath"); nhan.operation = 'MULTIPLY'
        nhan2 = nt.nodes.new("ShaderNodeMath"); nhan2.operation = 'MULTIPLY'; nhan2.inputs[1].default_value = dam
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])
        nt.links.new(mp.outputs[0], nz.inputs["Vector"])
        nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], nhan.inputs[0])
        nt.links.new(mepv.outputs[0], nhan.inputs[1])
        nt.links.new(nhan.outputs[0], nhan2.inputs[0])
        nt.links.new(nhan2.outputs[0], mix.inputs["Fac"])
        nt.links.new(tr.outputs[0], mix.inputs[1]); nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs["Surface"])
        o.data.materials.append(m)
        tam_.append((mp, nz, 0.6 + 0.25 * i))
    sc.camera.data.dof.use_dof = False
    for k in range(nk):
        p = os.path.join(ra, f"{k + 1:04d}.png")
        if os.path.exists(p):
            continue
        g = 2 * math.pi * k / nk
        for mp, nz, r in tam_:
            mp.inputs["Location"].default_value = (r * math.cos(g), 0, 0)
            nz.inputs["W"].default_value = r * math.sin(g)
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)


def lop_tia_sang(sc, ra, nk):
    """Dải sáng vàng ấm xiên từ góc trên trái, mỗi dải đung đưa và nhấp nháy chậm theo sin cùng chu kỳ."""
    mat = vat_lieu("tia", (1.0, 0.84, 0.5, 1), 1.4, "vet")
    n = 9
    r = np.random.default_rng(3)
    goc0 = np.radians(r.uniform(18, 48, n))
    pha = r.random(n)
    h = Hat(sc, "tia", n, mat)
    sc.camera.data.dof.use_dof = False
    y = 6.0
    goc_tren = np.array([-0.55 * y * KW * 2, y, 0.62 * y * KH * 2])
    for k in range(nk):
        p = os.path.join(ra, f"{k + 1:04d}.png")
        if os.path.exists(p):
            continue
        t = k / nk
        g = goc0 + np.radians(3) * np.sin(2 * np.pi * (t + pha))
        huong = np.stack([np.sin(g), np.zeros(n), -np.cos(g)], 1)
        dai = np.full(n, 2.6 * y * KH)
        tam = goc_tren + huong * (dai / 2)[:, None]
        rong = (0.08 + 0.12 * pha) * y
        alpha = 0.22 + 0.14 * (0.5 + 0.5 * np.sin(2 * np.pi * (t + pha * 2)))
        h.dat(tam, huong, dai, rong, alpha)
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)


LOP = {"mua": lop_mua, "tuyet": lop_tuyet, "tan-lua": lop_tan_lua, "bui": lop_bui, "suong": lop_suong, "tia-sang": lop_tia_sang,
       "mua-ten": lop_mua_ten}


def main():
    a = doc_args()
    chon = [x for x in a.chi.split(",") if x] or list(LOP)
    for ten in chon:
        ra = os.path.join(a.ra, ten)
        os.makedirs(ra, exist_ok=True)
        if len([f for f in os.listdir(ra) if f.endswith(".png")]) >= a.khung:
            print(f"[lop_phu] {ten}: đã có, bỏ qua")
            continue
        sc, _ = canh_moi()
        sc.frame_start, sc.frame_end = 1, a.khung
        print(f"[lop_phu] Đang dựng {ten}...")
        LOP[ten](sc, ra, a.khung)
        print(f"[lop_phu] {ten}: xong")


main()
