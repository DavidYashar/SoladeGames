"""Rebuild the flipper and lane wall to match the reference drawing.

    blender -b --python art/build_flipper_assembly.py

The wall runs straight down from the side rail, then bends through a quarter turn and
ends exactly at the flipper's pivot. The flipper's origin is that pivot.
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


def apply_bevel(obj, width: float, segments: int = 4) -> None:
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


def solid_from_outline(name: str, points, thickness: float):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata([(x, y, 0) for x, y in points], [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mod = obj.modifiers.new("Solidify", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = 0.0
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


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
def bat_outline(scale: float) -> list[tuple[float, float]]:
    """Smooth tapered bat: pivot at the origin, rounded tip, widening at the base."""
    length = 0.104 * scale
    tip = 0.096 * scale
    pts: list[tuple[float, float]] = []

    def half_width(x: float) -> float:
        t = max(0.0, min(1.0, x / length))
        return (0.0145 - 0.0062 * t) * scale

    # Base, rounded around the pivot.
    pts.append((0.0, -0.009 * scale))
    steps = 14
    for i in range(steps + 1):
        x = 0.006 * scale + (tip - 0.006 * scale) * (i / steps)
        pts.append((x, half_width(x)))
    # Rounded tip.
    cap_r = half_width(tip)
    for i in range(1, 12):
        a = math.pi / 2 - (i / 12) * math.pi
        pts.append((tip + math.cos(a) * cap_r, math.sin(a) * cap_r))
    for i in range(steps, -1, -1):
        x = 0.006 * scale + (tip - 0.006 * scale) * (i / steps)
        pts.append((x, -half_width(x)))
    pts.append((0.0, 0.009 * scale))
    return pts


def build_flipper() -> None:
    clear()

    bat = solid_from_outline("Bat", bat_outline(1.0), 0.013)
    apply_bevel(bat, 0.0045, 5)

    outline = bat_outline(1.075)
    rubber = solid_from_outline("Rubber", outline, 0.0075)
    apply_bevel(rubber, 0.0035, 4)

    # Pivot screw.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0072, depth=0.02, location=(0, 0, 0))
    screw = bpy.context.active_object
    screw.name = "Screw"
    apply_bevel(screw, 0.0012, 3)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0092, minor_radius=0.0016, major_segments=32, minor_segments=10,
        location=(0, 0, 0),
    )
    rim = bpy.context.active_object
    rim.name = "Rim"

    for obj in (bat, rubber, screw, rim):
        smooth(obj)

    for obj in (screw, rim):
        obj.rotation_euler = (math.radians(90), 0, 0)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    export("flipper", [bat, rubber, screw, rim])


# ---------------------------------------------------------------- lane wall
def wall_path() -> list[tuple[float, float, float]]:
    """Centreline of the wall: straight run, quarter turn, short run to the pivot.

    Returns (x, y, normal angle) samples, from the top of the wall down to its end.
    """
    pts: list[tuple[float, float, float]] = []
    # Straight section, going down the table.
    for i in range(12):
        t = i / 11
        pts.append((0.0, 0.2 - 0.12 * t, math.pi / 2))
    # Quarter turn: centre at (0.075, 0.08), radius 0.075.
    for i in range(1, 15):
        a = math.pi - (i / 14) * (math.pi / 2)
        pts.append((0.075 + math.cos(a) * 0.075, 0.08 + math.sin(a) * 0.075, a - math.pi / 2))
    # Short run into the pivot.
    for i in range(1, 6):
        t = i / 5
        pts.append((0.075 + 0.055 * t, 0.005 - 0.005 * t, 0.0))
    return pts


def build_lane_wall() -> None:
    clear()

    thickness = 0.011
    height = 0.026
    pts = wall_path()

    verts: list[tuple[float, float, float]] = []
    for x, y, normal in pts:
        nx = math.cos(normal) * thickness
        ny = math.sin(normal) * thickness
        verts.extend(
            [
                (x - nx, y - ny, 0),
                (x + nx, y + ny, 0),
                (x - nx, y - ny, height),
                (x + nx, y + ny, height),
            ]
        )

    faces = []
    for i in range(len(pts) - 1):
        b = i * 4
        n = (i + 1) * 4
        faces += [
            (b + 0, b + 1, n + 1, n + 0),
            (b + 2, n + 2, n + 3, b + 3),
            (b + 0, n + 0, n + 2, b + 2),
            (b + 1, b + 3, n + 3, n + 1),
        ]
    faces.append((0, 2, 3, 1))
    last = (len(pts) - 1) * 4
    faces.append((last + 0, last + 1, last + 3, last + 2))

    mesh = bpy.data.meshes.new("WallMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    wall = bpy.data.objects.new("LaneWall", mesh)
    bpy.context.collection.objects.link(wall)
    apply_bevel(wall, 0.002, 3)

    # Cream lip along the inner edge (the side the ball runs on).
    lip_verts = []
    for x, y, normal in pts:
        nx = math.cos(normal) * (thickness + 0.0012)
        ny = math.sin(normal) * (thickness + 0.0012)
        lip_verts.extend(
            [
                (x - nx, y - ny, height),
                (x + nx, y + ny, height),
                (x - nx, y - ny, height + 0.004),
                (x + nx, y + ny, height + 0.004),
            ]
        )
    lip_faces = []
    for i in range(len(pts) - 1):
        b = i * 4
        n = (i + 1) * 4
        lip_faces.append((b + 2, n + 2, n + 3, b + 3))
    lip = bpy.data.meshes.new("LipMesh")
    lip.from_pydata(lip_verts, [], lip_faces)
    lip.update()
    lip_obj = bpy.data.objects.new("Lip", lip)
    bpy.context.collection.objects.link(lip_obj)

    # Screws down the straight section.
    screws = []
    for i in range(4):
        y = 0.175 - i * 0.026
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20, radius=0.0042, depth=0.006, location=(0.0, y, height * 0.55)
        )
        s = bpy.context.active_object
        s.name = f"Screw{i}"
        s.rotation_euler = (0, math.radians(90), 0)
        bpy.context.view_layer.objects.active = s
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
        apply_bevel(s, 0.0008, 2)
        screws.append(s)

    for obj in [wall, lip_obj] + screws:
        smooth(obj)

    export("lane_wall", [wall, lip_obj] + screws)


build_flipper()
build_lane_wall()
print("assembly rebuilt")
