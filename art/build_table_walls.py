"""Table walls, modelled properly, with the collider data exported alongside.

    blender -b --python art/build_table_walls.py

Writes two files from ONE set of numbers:

    web/public/models/pinball/table_walls.glb   the mesh
    web/lib/pinball/table-walls.json            the segments the colliders are built from

So the wall the ball hits and the wall you see cannot disagree: re-shape the paths
below, rebuild, and both change together.

Profile, matching the flipper arms: a cream plinth, a dark body on top of it, and a
bevelled cap. Blender (x, y) = world (x, -z); height runs up Blender z.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
DATA = HERE.parent / "web" / "lib" / "pinball" / "table-walls.json"
OUT.mkdir(parents=True, exist_ok=True)
DATA.parent.mkdir(parents=True, exist_ok=True)

HALF_W = 0.27
HALF_L = 0.54
LANE_W = 0.055
DIVIDER_Z = -HALF_W + 0.012 + LANE_W - 0.008
CENTER_Z = (HALF_W - 0.012 + DIVIDER_Z + 0.008) / 2
M = lambda dz: CENTER_Z + dz

# ---------------------------------------------------------------------------
# Junctions. Every corner and meeting point of the wall run has a name.
# ---------------------------------------------------------------------------
NEAR_LEFT = (HALF_L, HALF_W)      # near end of the left rail
NEAR_RIGHT = (HALF_L, -HALF_W)    # near end of the corridor rail
FAR = (-0.378, -0.2)              # the tip where the head arc meets the lane exit
DIVIDER_NEAR = (HALF_L - 0.1, DIVIDER_Z)   # divider's near end
DIVIDER_FAR = (-0.22, DIVIDER_Z)           # divider's far end
LANE_RAIL_END = (-0.31, -HALF_W)   # corridor rail -> lane exit

# The head arc runs from the left rail round to FAR. Its centre is solved so that the
# circle passes through both: fixed in x, with z chosen to make the two ends equidistant.
HEAD_CX = -0.31
_a = HALF_W
_fx, _fz = FAR
HEAD_CZ = (_a ** 2 - (_fx - HEAD_CX) ** 2 - _fz ** 2) / (2 * (_a - _fz))
HEAD_C = (HEAD_CX, HEAD_CZ)
HEAD_R = _a - HEAD_CZ
HEAD_START = (HEAD_CX, HALF_W)  # where the arc meets the left rail

WALL_H = 0.042
WALL_W = 0.012
PLINTH_H = 0.018
PLINTH_W = WALL_W + 0.008
CAP_H = 0.006
CAP_W = WALL_W + 0.003


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


def smooth(obj, angle: float = math.radians(40)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def segment(name: str, p0, p1, width: float, height: float, z0: float):
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


def join(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def corner_post(prefix: str, world_point, i: int, width: float, height: float, z0: float):
    """A square block filling the corner where two walls meet."""
    x, z = world_point
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=(x, -z, z0 + height / 2)
    )
    obj = bpy.context.active_object
    obj.name = f"{prefix}{i}"
    obj.scale = (width, width, height)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True)
    return obj


def build_wall(prefix: str, world_points):
    """Dark body, cream plinth under it, and a bevelled cap."""
    bodies, plinths, caps = [], [], []
    for i in range(len(world_points) - 1):
        (x0, z0), (x1, z1) = world_points[i], world_points[i + 1]
        p0, p1 = (x0, -z0), (x1, -z1)
        plinths.append(segment(f"{prefix}P{i}", p0, p1, PLINTH_W, PLINTH_H, 0.0))
        bodies.append(segment(f"{prefix}B{i}", p0, p1, WALL_W, WALL_H, 0.0))
        caps.append(
            segment(f"{prefix}C{i}", p0, p1, CAP_W, CAP_H, WALL_H - CAP_H * 0.6)
        )

    body = join(bodies, f"{prefix}Body")
    plinth = join(plinths, f"{prefix}Plinth")
    cap = join(caps, f"{prefix}Cap")

    bevel(body, 0.0022, 4)
    bevel(plinth, 0.0018, 4)
    bevel(cap, 0.0015, 4)
    for obj in (body, plinth, cap):
        smooth(obj)
    return [plinth, body, cap]


def head_arc(steps: int = 48):
    """Arc from HEAD_START round to FAR, on the circle those two points define."""
    cx, cz = HEAD_C
    a0 = math.atan2(HEAD_START[1] - cz, HEAD_START[0] - cx)
    a1 = math.atan2(FAR[1] - cz, FAR[0] - cx)
    if a1 < a0:
        a1 += math.pi * 2
    return [
        (cx + HEAD_R * math.cos(a0 + (i / steps) * (a1 - a0)),
         cz + HEAD_R * math.sin(a0 + (i / steps) * (a1 - a0)))
        for i in range(steps + 1)
    ]


def main() -> None:
    clear()

    walls = {
        # Perimeter, each wall a pair of named junctions.
        "outerLeft": [NEAR_LEFT, HEAD_START],
        "outerLane": [NEAR_RIGHT, LANE_RAIL_END],
        "outerNear": [NEAR_LEFT, NEAR_RIGHT],
        # Internal.
        "divider": [DIVIDER_NEAR, DIVIDER_FAR],
        "head": head_arc(),
        "laneEnd": [LANE_RAIL_END, FAR],
    }

    parts = []
    for name, points in walls.items():
        prefix = name[0].upper() + name[1:]
        parts += build_wall(prefix, points)

    # Corner posts, one per junction.
    junctions = [NEAR_LEFT, NEAR_RIGHT, HEAD_START, LANE_RAIL_END, FAR]
    post_plinth = [corner_post("PostP", pt, i, PLINTH_W, PLINTH_H, 0.0) for i, pt in enumerate(junctions)]
    post_body = [corner_post("PostB", pt, i, WALL_W, WALL_H, 0.0) for i, pt in enumerate(junctions)]
    post_cap = [
        corner_post("PostC", pt, i, CAP_W, CAP_H, WALL_H - CAP_H * 0.6)
        for i, pt in enumerate(junctions)
    ]
    for group, name in ((post_plinth, "JointsPlinth"), (post_body, "JointsBody"), (post_cap, "JointsCap")):
        joined = join(group, name)
        bevel(joined, 0.002, 4)
        smooth(joined)
        parts.append(joined)

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

    # The collider source: the same paths, at the body's footprint.
    segments = []
    for name, points in walls.items():
        for i in range(len(points) - 1):
            (x0, z0), (x1, z1) = points[i], points[i + 1]
            segments.append(
                {
                    "x0": round(x0, 5),
                    "z0": round(z0, 5),
                    "x1": round(x1, 5),
                    "z1": round(z1, 5),
                    "halfWidth": round(WALL_W / 2, 5),
                    "halfHeight": round(WALL_H / 2, 5),
                }
            )
    DATA.write_text(
        json.dumps({"height": WALL_H, "segments": segments}, indent=2),
        encoding="utf-8",
    )
    print(f"  wrote {DATA.name}  {len(segments)} segments")


main()
