"""The flipper assembly as ONE piece: arm and plate share a single outline.

    blender -b --python art/build_assembly_merged.py

The black arm and the amber plate are unioned into one mesh. The cream casing and the
dark frame are scaled copies of that union, so the border runs continuously around
both instead of stopping at each piece.

Parts, back to front:
    Casing   cream, largest, thinnest
    Frame    dark, just inside the casing
    ArmFace  black, the arm only
    PlateFace amber, the plate only
    Screws + Hinge

Origin at the flipper pivot.
"""

from __future__ import annotations

import math
from pathlib import Path

import mathutils

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)

PIVOT = (0.0, 0.0)
ELBOW = (0.108, 0.12)
TOP = (0.30, 0.12)
ARM_W = 0.023


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


def smooth(obj, angle: float = math.radians(50)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def flat_polygon(name: str, points, thickness: float, z: float = 0.0):
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
    return obj


def bar(name: str, a, b, width: float, thickness: float):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    angle = math.atan2(dy, dx)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (length, width, thickness)
    obj.rotation_euler = (0, 0, angle)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return obj


def disc(name: str, at, radius: float, thickness: float):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=40, radius=radius, depth=thickness, location=(at[0], at[1], 0)
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def union(objects):
    """Boolean-union the list into the first object."""
    base = objects[0]
    for other in objects[1:]:
        mod = base.modifiers.new("Bool", "BOOLEAN")
        mod.operation = "UNION"
        mod.object = other
        bpy.context.view_layer.objects.active = base
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(other, do_unlink=True)
    return base


def catmull_rom(points, samples: int = 16):
    out = []
    n = len(points)
    for i in range(n):
        p0, p1 = points[(i - 1) % n], points[i]
        p2, p3 = points[(i + 1) % n], points[(i + 2) % n]
        for s in range(samples):
            t = s / samples
            t2, t3 = t * t, t * t * t
            out.append(
                (
                    0.5
                    * (
                        2 * p1[0]
                        + (-p0[0] + p2[0]) * t
                        + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2
                        + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
                    ),
                    0.5
                    * (
                        2 * p1[1]
                        + (-p0[1] + p2[1]) * t
                        + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2
                        + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
                    ),
                )
            )
    return out


def duplicate_scaled(obj, factor, name, z):
    """A copy of obj grown about its own bounding-box centre, sitting at height z."""
    dup = obj.copy()
    dup.data = obj.data.copy()
    bpy.context.collection.objects.link(dup)
    dup.name = name

    xs = [v.co.x for v in dup.data.vertices]
    ys = [v.co.y for v in dup.data.vertices]
    cx = (min(xs) + max(xs)) / 2
    cy = (min(ys) + max(ys)) / 2
    m = (
        mathutils.Matrix.Translation((cx, cy, 0))
        @ mathutils.Matrix.Scale(factor, 4)
        @ mathutils.Matrix.Translation((-cx, -cy, 0))
    )
    dup.data.transform(m)
    dup.location.z = z
    return dup


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

    def build_arm(prefix: str):
        a = bar(prefix + "A", PIVOT, ELBOW, ARM_W, 0.016)
        b = bar(prefix + "B", ELBOW, TOP, ARM_W, 0.016)
        e = disc(prefix + "E", ELBOW, ARM_W / 2, 0.016)
        return union([a, b, e])

    # The plate is roughly 45% of the arm's length in the reference; these control
    # points are shrunk toward the elbow so it tucks into the bend.
    base = [
        (0.108, 0.085),
        (0.150, 0.030),
        (0.150, -0.030),
        (0.108, -0.062),
        (0.062, -0.040),
        (0.060, 0.030),
    ]
    k = 0.62
    control = [(0.108 + (x - 0.108) * k, 0.12 + (y - 0.12) * k) for x, y in base]
    outline = catmull_rom(control, 16)

    # One union for the casing/frame, and separate faces to sit on top.
    arm_merged = build_arm("M")
    plate_merged = flat_polygon("PlateM", outline, 0.016)
    combined = union([arm_merged, plate_merged])

    arm_face = build_arm("F")
    arm_face.name = "ArmFace"
    plate_face = flat_polygon("PlateF", outline, 0.017)
    plate_face.name = "PlateFace"
    plate_face.location.z = 0.001

    casing = duplicate_scaled(combined, 1.09, "Casing", -0.006)
    frame = duplicate_scaled(combined, 1.045, "Frame", -0.003)

    parts = [casing, frame, arm_face, plate_face]
    parts += screw("Screw0", 0.075, 0.083, 0.011)
    parts += screw("Screw1", 0.098, 0.108, 0.011)
    parts += screw("Screw2", 0.130, 0.112, 0.011)
    parts += screw("Screw3", 0.160, 0.112, 0.011)
    parts += screw("ScrewPlate", 0.118, 0.062, 0.011, 0.0032)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0105, minor_radius=0.0028, major_segments=36, minor_segments=12,
        location=(0.0, 0.0, 0.004),
    )
    hinge = bpy.context.active_object
    hinge.name = "Hinge"
    parts.append(hinge)

    for obj in parts:
        smooth(obj)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

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

    # Mirrored copy for the other side.
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
