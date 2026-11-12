"""Slingshot plate: a smooth teardrop wedge, matched to the reference.

    blender -b --python art/build_slingshot.py

The silhouette is one closed smooth curve, not a filleted triangle: a fat rounded
lobe at the bottom, a tapered rounded point at the top, convex on both sides. Cream
casing outside, black frame, amber face, two cross-head screws.

Apex toward +Y, lobe toward -Y, centred on the centroid.
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


def catmull_rom(points, samples: int = 14):
    """Closed Catmull-Rom spline through the control points."""
    out: list[tuple[float, float]] = []
    n = len(points)
    for i in range(n):
        p0 = points[(i - 1) % n]
        p1 = points[i]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n]
        for s in range(samples):
            t = s / samples
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * (
                2 * p1[0]
                + (-p0[0] + p2[0]) * t
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
            )
            y = 0.5 * (
                2 * p1[1]
                + (-p0[1] + p2[1]) * t
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
            )
            out.append((x, y))
    return out


def extruded(name: str, outline, thickness: float, z: float = 0.0):
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
    bevel(obj, thickness * 0.45, 4)
    smooth(obj)
    return obj


def scaled(outline, factor):
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    return [(cx + (x - cx) * factor, cy + (y - cy) * factor) for x, y in outline]


def screw(name: str, x: float, y: float, z: float):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=0.0036, depth=0.005, location=(x, y, z))
    head = bpy.context.active_object
    head.name = name
    bevel(head, 0.0008, 3)
    parts = [head]
    for i, rot in enumerate((0.0, math.pi / 2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + 0.0026))
        slot = bpy.context.active_object
        slot.name = f"{name}Slot{i}"
        slot.scale = (0.005, 0.0007, 0.0012)
        slot.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.objects.active = slot
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        parts.append(slot)
    return parts


def main() -> None:
    clear()

    # Silhouette control points: tapered point at the top, fat lobe at the bottom,
    # slightly asymmetric so it leans like the reference.
    control = [
        (0.000, 0.085),    # apex
        (0.040, 0.020),    # right shoulder
        (0.048, -0.035),   # right side of the lobe
        (0.010, -0.072),   # bottom of the lobe
        (-0.040, -0.048),  # left side of the lobe
        (-0.030, 0.015),   # left shoulder
    ]
    outline = catmull_rom(control, 16)

    rim = extruded("Rim", scaled(outline, 1.18), 0.012, 0.0)
    stripe = extruded("Stripe", scaled(outline, 1.06), 0.015, 0.0)
    face = extruded("Face", outline, 0.018, 0.001)

    parts = [rim, stripe, face]
    parts += screw("ScrewTop", 0.0, 0.052, 0.011)
    parts += screw("ScrewLow", 0.008, -0.040, 0.011)

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
