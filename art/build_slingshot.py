"""Slingshot plate in the reference style: rounded triangle, amber face, cream rim.

    blender -b --python art/build_slingshot.py

Centred on its own centroid, wide edge toward -Y, apex toward +Y.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def bevel(obj, width: float, segments: int = 4) -> None:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth(obj, angle: float = math.radians(45)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def rounded_triangle(points, radius: float, steps: int = 10):
    """Round the three corners of a triangle and return the closed outline."""
    out: list[tuple[float, float]] = []
    for i in range(3):
        px, py = points[i]
        ax, ay = points[(i - 1) % 3]
        bx, by = points[(i + 1) % 3]

        v1 = (ax - px, ay - py)
        v2 = (bx - px, by - py)
        l1 = math.hypot(*v1)
        l2 = math.hypot(*v2)
        v1 = (v1[0] / l1, v1[1] / l1)
        v2 = (v2[0] / l2, v2[1] / l2)

        r = min(radius, l1 * 0.45, l2 * 0.45)
        start = (px + v1[0] * r, py + v1[1] * r)
        end = (px + v2[0] * r, py + v2[1] * r)

        a1 = math.atan2(start[1] - py, start[0] - px)
        a2 = math.atan2(end[1] - py, end[0] - px)
        while a2 - a1 > math.pi:
            a2 -= math.pi * 2
        while a1 - a2 > math.pi:
            a2 += math.pi * 2

        for s in range(steps + 1):
            a = a1 + (a2 - a1) * (s / steps)
            out.append((px + math.cos(a) * r, py + math.sin(a) * r))
    return out


def plate(name: str, outline, thickness: float, z: float):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata([(x, y, 0) for x, y in outline], [], [list(range(len(outline)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    solid = obj.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=solid.name)
    obj.location.z = z
    bevel(obj, thickness * 0.4, 4)
    smooth(obj)
    return obj


def scale_about_centroid(outline, factor):
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in outline]


def screw(name: str, x: float, y: float, z: float):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.0038, depth=0.004, location=(x, y, z))
    head = bpy.context.active_object
    head.name = name
    bevel(head, 0.0008, 2)
    parts = [head]
    for i, rot in enumerate((0, math.pi / 2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + 0.0022))
        slot = bpy.context.active_object
        slot.name = f"{name}Slot{i}"
        slot.scale = (0.0052, 0.0007, 0.001)
        slot.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.objects.active = slot
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        parts.append(slot)
    return parts


def main() -> None:
    clear()

    # Wide edge at the bottom, apex at the top, roughly 80 x 95 mm.
    tri = [(-0.04, -0.03), (0.04, -0.03), (0.0, 0.065)]
    face_outline = rounded_triangle(tri, 0.022)

    rim = plate("Rim", scale_about_centroid(face_outline, 1.16), 0.010, -0.005)
    stripe = plate("Stripe", scale_about_centroid(face_outline, 1.05), 0.013, -0.002)
    face = plate("Face", face_outline, 0.016, 0.000)

    parts = [rim, stripe, face]
    parts += screw("ScrewTop", 0.0, 0.035, 0.008)
    parts += screw("ScrewLeft", -0.021, -0.016, 0.008)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / "slingshot.glb"
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
