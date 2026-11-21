"""Sửa đường dẫn ảnh, clip, âm thanh, font trong một file .blend sau khi đổi chỗ thư mục.

  blender -b <file.blend> --factory-startup --python sua_duong_dan_blend.py -- --ban-do <map.json> [--thu-muc-cu <dir>]

map.json là {"đường dẫn cũ": "đường dẫn mới"}, khớp theo tiền tố dài nhất, có thể là file hoặc thư mục.
--thu-muc-cu: nơi file .blend nằm trước khi chuyển, để tính đường dẫn dạng // (tương đối).
"""
import argparse
import json
import os
import sys

import bpy


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--ban-do", required=True)
    p.add_argument("--thu-muc-cu", default=None)
    a = p.parse_args(argv)
    with open(a.ban_do, encoding="utf-8") as f:
        ban_do = sorted(((os.path.normcase(os.path.normpath(k)), os.path.normpath(v)) for k, v in json.load(f).items()),
                        key=lambda kv: -len(kv[0]))
    goc = a.thu_muc_cu or os.path.dirname(bpy.data.filepath)

    def doi(duong):
        if not duong:
            return duong
        tuyet = os.path.normpath(os.path.join(goc, duong[2:]) if duong.startswith("//") else duong)
        so = os.path.normcase(tuyet)
        for cu, moi in ban_do:
            if so == cu or so.startswith(cu + os.sep):
                return moi + tuyet[len(cu):]
        return tuyet

    dem = 0
    for kho in (bpy.data.images, bpy.data.sounds, bpy.data.movieclips, bpy.data.fonts):
        for vat in kho:
            if not vat.filepath or vat.filepath == "<builtin>":
                continue
            moi = doi(vat.filepath)
            if moi != vat.filepath:
                vat.filepath = moi
                dem += 1
    for sc in bpy.data.scenes:
        if not sc.sequence_editor:
            continue
        for s in sc.sequence_editor.strips_all:
            if s.type == "MOVIE":
                moi = doi(s.filepath)
                if moi != s.filepath:
                    s.filepath = moi
                    dem += 1
            elif s.type == "IMAGE":
                moi = doi(s.directory.rstrip("/\\"))
                if moi != s.directory.rstrip("/\\"):
                    s.directory = moi + os.sep
                    dem += 1
        if sc.render.filepath:
            moi = doi(sc.render.filepath)
            if moi != sc.render.filepath:
                sc.render.filepath = moi
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_mainfile()
    print(f"[sua_duong_dan] {bpy.data.filepath}: đổi {dem} đường dẫn")


main()
