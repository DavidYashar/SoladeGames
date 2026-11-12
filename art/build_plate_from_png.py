"""Build the plate from traced PNG layers.

    blender -b --python art/build_plate_from_png.py

Reads art/out/plate_contours.json (metres, origin at the silhouette centre) and
extrudes each traced outline into its own layer. Shapes come from the artwork, so the
casing, frame and face all follow the drawing exactly.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
import sys

# usage: blender -b --python build_plate_from_png.py -- [stem] [output-name]
# Blender keeps its own flags in sys.argv, so only read what follows "--".
_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
STEM = _args[0] if len(_args) > 0 else "plate_contours"
NAME = _args[1] if len(_args) > 1 else "slingshot"
# A third argument scales the layer thickness, for chunkier objects.
THICKNESS = float(_args[2]) if len(_args) > 2 else 1.0
DATA = HERE / "out" / f"{STEM}.json"

LAYERS = {
    "cream": ("Casing", 0.012, -0.006),
    "dark": ("Frame", 0.015, -0.003),
    "face": ("Face", 0.018, 0.001),
}


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def bevel(obj, width: float, segments: int = 3) -> None:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth(obj, angle: float = math.radians(60)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def build(name: str, points, thickness: float, z: float):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata([(x, y, 0) for x, y in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    solid = obj.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)
    obj.location.z = z
    bevel(obj, thickness * 0.35, 3)
    smooth(obj)
    return obj


def screw(name: str, x: float, y: float, z: float, radius: float = 0.0042):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=radius, depth=0.005, location=(x, y, z))
    head = bpy.context.active_object
    head.name = name
    bevel(head, 0.0009, 3)
    parts = [head]
    for i, rot in enumerate((0.0, math.pi / 2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + 0.0026))
        slot = bpy.context.active_object
        slot.name = f"{name}Slot{i}"
        slot.scale = (radius * 1.4, radius * 0.22, 0.0012)
        slot.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.objects.active = slot
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        parts.append(slot)
    return parts


def main() -> None:
    clear()
    data = json.loads(DATA.read_text(encoding="utf-8"))

    parts = []
    for key, (name, thickness, z) in LAYERS.items():
        points = data.get(key) or []
        if len(points) < 3:
            continue
        parts.append(build(name, points, thickness * THICKNESS, z * THICKNESS))
        print(f"  {name}: {len(points)} points")

    colour = data.get("faceColor")
    if colour:
        print(f"  face colour {colour}")

    for i, (x, y) in enumerate(data.get("screws", [])[:2]):
        parts += screw(f"Screw{i}", x, y, 0.011)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / f"{NAME}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    print(f"  wrote {path.name}  {path.stat().st_size / 1024:.1f} KB")


main()
