"""Hand-authored silhouette: arm band with a lobe hanging off its inner edge.

    blender -b --python art/build_arm_hand.py

The outline is written out point by point rather than derived, because the reference
plate is not a bulge of the arm's edge: it hangs below it as its own rounded shape,
and the casing wraps the two together.

Points are counter-clockwise. Origin at the flipper pivot.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)

# The whole assembly, one closed path: pivot end, up the outer edge, along the top,
# back, then out and around the plate lobe, and home.
OUTLINE = [
    (-0.0115, 0.000),
    (0.010, 0.055),
    (0.058, 0.118),
    (0.090, 0.132),
    (0.300, 0.132),
    (0.302, 0.118),
    (0.300, 0.104),
    (0.092, 0.104),
    (0.138, 0.070),
    (0.150, 0.020),
    (0.128, -0.030),
    (0.080, -0.052),
    (0.038, -0.026),
    (0.026, 0.006),
    (0.008, 0.000),
]

PLATE = [
    (0.128, 0.062),
    (0.138, 0.020),
    (0.118, -0.020),
    (0.082, -0.036),
    (0.050, -0.018),
    (0.042, 0.008),
    (0.060, 0.040),
]


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


def offset_outline(points, amount):
    """Push every vertex outward from the polygon's centre by `amount`."""
    cx = sum(p[0] for p in points) / len(points)
    cy = sum(p[1] for p in points) / len(points)
    out = []
    for x, y in points:
        dx, dy = x - cx, y - cy
        length = math.hypot(dx, dy) or 1.0
        out.append((x + dx / length * amount, y + dy / length * amount))
    return out


def extrude(name: str, points, thickness: float, z: float = 0.0):
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
    bevel(obj, thickness * 0.4, 4)
    smooth(obj)
    return obj


def bar(name: str, p, q, width: float, thickness: float):
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (length, width, thickness)
    obj.rotation_euler = (0, 0, math.atan2(dy, dx))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return obj


def screw(name: str, x: float, y: float, z: float, radius: float = 0.0038):
    bpy.ops.mesh.primitive_cylinder_add(vertices=26, radius=radius, depth=0.005, location=(x, y, z))
    head = bpy.context.active_object
    head.name = name
    bevel(head, 0.0008, 3)
    parts = [head]
    for i, rot in enumerate((0.0, math.pi / 2)):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + 0.0026))
        slot = bpy.context.active_object
        slot.name = f"{name}Slot{i}"
        slot.scale = (radius * 1.4, radius * 0.2, 0.0012)
        slot.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.objects.active = slot
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        parts.append(slot)
    return parts


def main() -> None:
    clear()

    casing = extrude("Casing", offset_outline(OUTLINE, 0.009), 0.012, -0.006)
    frame = extrude("Frame", offset_outline(OUTLINE, 0.004), 0.015, -0.003)
    plate = extrude("PlateFace", PLATE, 0.017, 0.001)

    arm_face = bar("ArmFaceA", (0.0, 0.0), (0.108, 0.12), 0.023, 0.016)
    run = bar("ArmFaceB", (0.108, 0.12), (0.30, 0.12), 0.023, 0.016)
    bpy.ops.object.select_all(action="DESELECT")
    arm_face.select_set(True)
    run.select_set(True)
    bpy.context.view_layer.objects.active = arm_face
    bpy.ops.object.join()
    arm_face = bpy.context.active_object
    arm_face.name = "ArmFace"

    parts = [casing, frame, arm_face, plate]
    parts += screw("Screw0", 0.045, 0.060, 0.011)
    parts += screw("Screw1", 0.070, 0.086, 0.011)
    parts += screw("Screw2", 0.100, 0.108, 0.011)
    parts += screw("Screw3", 0.135, 0.112, 0.011)
    parts += screw("ScrewPlate", 0.105, 0.020, 0.011, 0.0032)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0105, minor_radius=0.0028, major_segments=36, minor_segments=12,
        location=(0.0, 0.0, 0.004),
    )
    hinge = bpy.context.active_object
    hinge.name = "Hinge"
    parts.append(hinge)

    def export_as(name: str, objects) -> None:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        path = OUT / f"{name}.glb"
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

    export_as("lane_arm", parts)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.duplicate()
    mirrored = list(bpy.context.selected_objects)
    for obj in mirrored:
        obj.scale = (1.0, -1.0, 1.0)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode="OBJECT")
    export_as("lane_arm_right", mirrored)


main()
