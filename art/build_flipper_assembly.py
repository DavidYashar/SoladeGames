"""The flipper assembly, built to the reference drawing.

    blender -b --python art/build_flipper_assembly.py

Two assets, both with their origin at the pivot:

    flipper.glb    red tapered capsule with a cream border and a pivot screw
    lane_arm.glb   black bent arm with a silver border, four screws and a white hinge

The arm is an obtuse bend: a long run, a 120 degree bend, then a short diagonal into
the pivot. It is assembled from overlapping primitives rather than one swept polygon,
so it cannot self-intersect.
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


def smooth(obj, angle: float = math.radians(40)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def capsule(name: str, length: float, r_base: float, r_tip: float, height: float):
    """A tapered pill lying along +X, centred on the X axis."""
    bpy.ops.mesh.primitive_cone_add(
        vertices=40, radius1=r_base, radius2=r_tip, depth=length, location=(length / 2, 0, 0)
    )
    body = bpy.context.active_object
    body.name = name
    body.rotation_euler = (0, math.radians(90), 0)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    parts = [body]
    for label, x, r in (("Base", 0.0, r_base), ("Tip", length, r_tip)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=r, location=(x, 0, 0))
        cap = bpy.context.active_object
        cap.name = f"{name}{label}"
        parts.append(cap)

    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name

    # Flatten to a plate and round the rim.
    joined.scale = (1.0, 1.0, height / (2 * max(r_base, r_tip)))
    bpy.context.view_layer.objects.active = joined
    bpy.ops.object.transform_apply(scale=True)
    return joined


def bar(name: str, x0, y0, x1, y1, width: float, height: float):
    """A flat bar from (x0,y0) to (x1,y1), thickness `height` in Z."""
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    angle = math.atan2(dy, dx)
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (length, width, height)
    obj.rotation_euler = (0, 0, angle)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    bevel(obj, min(width, height) * 0.35, 3)
    return obj


def screw(name: str, x: float, y: float, radius: float, z: float):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=radius, depth=0.004, location=(x, y, z))
    head = bpy.context.active_object
    head.name = name
    bevel(head, radius * 0.18, 2)

    slots = []
    for rot in (0, math.pi / 2):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + 0.0022))
        slot = bpy.context.active_object
        slot.name = f"{name}Slot{rot}"
        slot.scale = (radius * 1.5, radius * 0.18, 0.0012)
        slot.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.objects.active = slot
        bpy.ops.object.transform_apply(scale=True, rotation=True)
        slots.append(slot)
    return [head] + slots


def export(name: str, objects: list) -> None:
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


# ---------------------------------------------------------------- flipper
def build_flipper() -> None:
    clear()

    body = capsule("Flipper", 0.082, 0.0135, 0.0105, 0.016)
    bevel(body, 0.003, 4)
    smooth(body)

    border = capsule("FlipperBorder", 0.088, 0.0158, 0.0128, 0.009)
    border.location = (0, 0, -0.003)
    bevel(border, 0.0025, 4)
    smooth(border)

    pivot = screw("PivotScrew", 0.0, 0.0, 0.0072, 0.009)
    for obj in pivot:
        smooth(obj)

    export("flipper", [body, border] + pivot)


# ---------------------------------------------------------------- lane arm
def build_arm() -> None:
    clear()

    # 120 degree bend: long vertical run, then a short diagonal into the pivot.
    bend = (0.108, 0.12)
    top = (0.30, 0.12)

    arm = bar("Arm", 0.0, 0.0, bend[0], bend[1], 0.023, 0.016)
    run = bar("ArmRun", top[0], top[1], bend[0], bend[1], 0.023, 0.016)

    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.0115, depth=0.016, location=(bend[0], bend[1], 0)
    )
    elbow = bpy.context.active_object
    elbow.name = "ArmElbow"

    # Silver border: the same shapes, slightly larger and thinner, sitting under.
    border_arm = bar("Border", -0.0015, -0.0025, bend[0] + 0.0015, bend[1] + 0.0025, 0.028, 0.009)
    border_arm.location.z = -0.004
    border_run = bar("BorderRun", top[0], top[1], bend[0], bend[1], 0.028, 0.009)
    border_run.location.z = -0.004
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.0142, depth=0.009, location=(bend[0], bend[1], -0.004)
    )
    border_elbow = bpy.context.active_object
    border_elbow.name = "BorderElbow"

    # White hinge ring at the pivot.
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0105, minor_radius=0.0028, major_segments=36, minor_segments=12,
        location=(0.0, 0.0, 0.004),
    )
    hinge = bpy.context.active_object
    hinge.name = "Hinge"

    # Four screws along the diagonal section.
    screws = []
    for i in range(4):
        t = 0.22 + i * 0.19
        x = bend[0] * (1 - t)
        y = bend[1] * (1 - t)
        screws += screw(f"Screw{i}", x, y, 0.0042, 0.009)

    for obj in [arm, run, elbow, border_arm, border_run, border_elbow, hinge] + screws:
        smooth(obj)

    parts = [arm, run, elbow, border_arm, border_run, border_elbow, hinge] + screws
    export("lane_arm", parts)

    # Mirror across the table centreline for the other side.
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
    export("lane_arm_right", mirrored)


build_flipper()
build_arm()
print("assembly built")
