"""The wooden frame around the playfield, as one mitered ring.

    blender -b --python art/build_cabinet_frame.py

Four rails drawn as four boxes meet at corners that are really two overlapping ends.
Built as a single ring, the corners mitre and the bevel runs continuously around.

Sizes match the rails it replaces, so nothing about the playfield moves.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)

# Half-extents, from the game's rail layout.
OUTER_X = 0.62
OUTER_Z = 0.35
INNER_X = 0.57
INNER_Z = 0.30
HEIGHT = 0.055
BEVEL = 0.006


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def ring():
    """Rectangular ring: 8 corners, two heights, 16 quads."""
    ox, oz = OUTER_X, OUTER_Z
    ix, iz = INNER_X, INNER_Z

    corners_outer = [(-ox, -oz), (ox, -oz), (ox, oz), (-ox, oz)]
    corners_inner = [(-ix, -iz), (ix, -iz), (ix, iz), (-ix, iz)]

    # Blender is Z-up: the ring lies in X-Y and the wall rises along Z. Building it
    # the other way round exports a frame standing on edge.
    verts = []
    for h in (0.0, HEIGHT):
        verts += [(x, z, h) for x, z in corners_outer]
        verts += [(x, z, h) for x, z in corners_inner]

    faces = []
    for i in range(4):
        j = (i + 1) % 4
        o0, o1 = i, j
        i0, i1 = i + 4, j + 4
        o0t, o1t = o0 + 8, o1 + 8
        i0t, i1t = i0 + 8, i1 + 8
        faces.append([o0t, o1t, i1t, i0t])   # top ring
        faces.append([o0, i0, i1, o1])       # bottom ring
        faces.append([o0, o1, o1t, o0t])     # outer wall
        faces.append([i0, i0t, i1t, i1])     # inner wall

    return verts, faces


def main() -> None:
    clear()

    verts, faces = ring()
    mesh = bpy.data.meshes.new("CabinetFrameMesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new("CabinetFrame", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj

    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = BEVEL
    mod.segments = 4
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    bpy.ops.object.modifier_apply(modifier=mod.name)

    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    path = OUT / "cabinet_frame.glb"
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
