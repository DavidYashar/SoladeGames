"""Table walls that were being drawn in code: divider, head curve, lane exit.

    blender -b --python art/build_table_walls.py

Built in world coordinates, so the asset is placed at the playfield origin with no
offset and cannot drift from the numbers in the game.

Style matches the flipper arms: a black body with a cream cap along the top.

Blender (x, y) = world (x, -z); height runs up Blender z. The glTF exporter's Y-up
conversion then gives three.js (x, height, z) as expected.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)

HALF_W = 0.27
HALF_L = 0.54
LANE_W = 0.055
DIVIDER_Z = -HALF_W + 0.012 + LANE_W - 0.008
CENTER_Z = (HALF_W - 0.012 + DIVIDER_Z + 0.008) / 2
M = lambda dz: CENTER_Z + dz

DIVIDER_FROM = HALF_L - 0.1
DIVIDER_TO = -0.22
TOP_RAMP = (-0.368, -0.2)

WALL_H = 0.04
WALL_W = 0.012
CAP_H = 0.004
CAP_W = 0.0115


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


def smooth(obj, angle: float = math.radians(45)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def segment(name: str, p0, p1, width: float, height: float, z0: float):
    """A box from world point p0 to p1, centred on the segment."""
    x0, y0 = p0
    x1, y1 = p1
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=((x0 + x1) / 2, (y0 + y1) / 2, z0 + height / 2),
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (length, width, height)
    obj.rotation_euler = (0, 0, math.atan2(dy, dx))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return obj


def wall(prefix: str, world_points, height=WALL_H, width=WALL_W):
    """Body plus a cream cap, along a world-space polyline."""
    body_parts = []
    cap_parts = []
    for i in range(len(world_points) - 1):
        (x0, z0), (x1, z1) = world_points[i], world_points[i + 1]
        p0 = (x0, -z0)
        p1 = (x1, -z1)
        body_parts.append(segment(f"{prefix}Body{i}", p0, p1, width, height, 0.0))
        cap_parts.append(
            segment(f"{prefix}Cap{i}", p0, p1, CAP_W, CAP_H, height - CAP_H * 0.5)
        )

    def join(parts, name):
        bpy.ops.object.select_all(action="DESELECT")
        for p in parts:
            p.select_set(True)
        bpy.context.view_layer.objects.active = parts[0]
        bpy.ops.object.join()
        obj = bpy.context.active_object
        obj.name = name
        return obj

    body = join(body_parts, f"{prefix}Body")
    cap = join(cap_parts, f"{prefix}Cap")
    return [body, cap]


def head_arc(steps: int = 22):
    cx, cz = -0.31, M(0)
    r = math.hypot(TOP_RAMP[0] - cx, TOP_RAMP[1] - cz)
    a0 = math.pi / 2
    a1 = math.atan2(TOP_RAMP[1] - cz, TOP_RAMP[0] - cx)
    if a1 < a0:
        a1 += math.pi * 2
    return [
        (cx + r * math.cos(a0 + (i / steps) * (a1 - a0)),
         cz + r * math.sin(a0 + (i / steps) * (a1 - a0)))
        for i in range(steps + 1)
    ]


def main() -> None:
    clear()

    parts = []
    parts += wall("Divider", [(DIVIDER_FROM, DIVIDER_Z), (DIVIDER_TO, DIVIDER_Z)])
    parts += wall("Head", head_arc())
    parts += wall("LaneEnd", [(-0.3, -HALF_W + 0.012), TOP_RAMP])

    for obj in parts:
        bevel(obj, 0.002, 3)
        smooth(obj)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / "table_walls.glb"
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
