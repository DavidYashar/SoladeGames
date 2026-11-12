"""The flipper assembly as ONE authored outline.

    blender -b --python art/build_arm_merged2.py

No boolean operations. The silhouette is generated from the arm's centreline:

    pivot (0, 0) -> elbow (0.108, 0.12) -> top (0.30, 0.12)

The lower edge of that band is interrupted and replaced by a smooth lobe, which is
where the amber plate sits. The casing, the dark frame and the plate's face are all
generated from the SAME function at different widths, so the border is a constant
width all the way round instead of being a scaled copy of a blob.

Parts: Casing (cream), Frame (dark), ArmFace (black), PlateFace (amber),
four screws on the arm, one on the plate, and the pivot hinge.
Origin at the pivot.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "pinball"
OUT.mkdir(parents=True, exist_ok=True)

A = (0.0, 0.0)          # pivot
B = (0.108, 0.12)       # elbow
C = (0.30, 0.12)        # top end
ARM_HALF = 0.0115

CASING_HALF = ARM_HALF + 0.008
FRAME_HALF = ARM_HALF + 0.0035
LOBE_DEPTH = 0.048
LOBE_FROM = 0.18        # fraction along the lower edge where the lobe starts
LOBE_TO = 0.62


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


def unit(p, q):
    dx, dy = q[0] - p[0], q[1] - p[1]
    length = math.hypot(dx, dy)
    return (dx / length, dy / length)


def offset_side(pts, half, side: float):
    """Offset a polyline by `half` on one side, mitred at the inner corner."""
    d1 = unit(pts[0], pts[1])
    d2 = unit(pts[1], pts[2])
    n1 = (-d1[1] * side, d1[0] * side)
    n2 = (-d2[1] * side, d2[0] * side)

    start = (pts[0][0] + n1[0] * half, pts[0][1] + n1[1] * half)
    end = (pts[2][0] + n2[0] * half, pts[2][1] + n2[1] * half)

    # Mitre the corner: intersection of the two offset lines.
    a1 = (pts[1][0] + n1[0] * half, pts[1][1] + n1[1] * half)
    a2 = (pts[1][0] + n2[0] * half, pts[1][1] + n2[1] * half)
    # Average is the mitre for equal widths.
    corner = ((a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2)

    return [start, corner, end]


def silhouette(half: float, lobe: float):
    """One closed outline: the arm band with a lobe cut into its lower edge."""
    upper = offset_side([A, B, C], half, +1)
    lower = offset_side([A, B, C], half, -1)

    # Walk the lower edge and swap a span for the lobe.
    a0 = lower[0]
    corner = lower[1]
    c0 = lower[2]

    def lerp(p, q, t):
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

    p_start = lerp(a0, corner, LOBE_FROM)
    p_end = lerp(corner, c0, LOBE_TO)

    chord = (p_end[0] - p_start[0], p_end[1] - p_start[1])
    length = math.hypot(*chord)
    nx, ny = -chord[1] / length, chord[0] / length
    # Point the bulge away from the arm's centreline.
    mid = ((p_start[0] + p_end[0]) / 2, (p_start[1] + p_end[1]) / 2)
    centre_line = (B[0], B[1] - half)
    if (mid[0] - centre_line[0]) * nx + (mid[1] - centre_line[1]) * ny < 0:
        nx, ny = -nx, -ny

    lobe_pts = []
    steps = 26
    for i in range(steps + 1):
        t = i / steps
        x = p_start[0] + chord[0] * t
        y = p_start[1] + chord[1] * t
        bulge = math.sin(math.pi * t) * lobe
        lobe_pts.append((x + nx * bulge, y + ny * bulge))

    outline = []
    outline += upper
    # End cap: around the arm's tip.
    tip = (C[0] + half * 0.0, C[1])
    outline.append((tip[0] + half, tip[1]))
    outline.append((tip[0] + half, tip[1] - half * 2))
    # Lower edge back, with the lobe in place of the middle span.
    outline.append(lerp(c0, corner, 0.0))
    outline += list(reversed(lobe_pts))
    outline.append(lerp(a0, corner, 0.0))
    outline.append((a0[0] - half, a0[1]))
    return outline


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

    casing = extruded("Casing", silhouette(CASING_HALF, LOBE_DEPTH), 0.012, -0.006)
    frame = extruded("Frame", silhouette(FRAME_HALF, LOBE_DEPTH - 0.004), 0.015, -0.003)

    arm_face = bar("ArmFace", A, B, ARM_HALF * 2, 0.016)
    run = bar("RunFace", B, C, ARM_HALF * 2, 0.016)
    bpy.ops.object.select_all(action="DESELECT")
    arm_face.select_set(True)
    run.select_set(True)
    bpy.context.view_layer.objects.active = arm_face
    bpy.ops.object.join()
    arm_face = bpy.context.active_object
    arm_face.name = "ArmFace"

    # The amber plate, sized to the lobe so a border shows all round.
    plate = extruded("PlateFace", silhouette(ARM_HALF + 0.001, LOBE_DEPTH - 0.009), 0.017, 0.001)
    # Cut it back to the lobe region by moving it out along the arm — simplest: the
    # plate face is the lobe itself, drawn at the frame's size.
    bpy.data.objects.remove(plate, do_unlink=True)

    lobe_only = []
    steps = 26
    half = FRAME_HALF - 0.0035
    depth = LOBE_DEPTH - 0.009
    upper = offset_side([A, B, C], half, -1)
    lower = offset_side([A, B, C], half, -1)

    def lerp(p, q, t):
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

    p_start = lerp(lower[0], lower[1], LOBE_FROM)
    p_end = lerp(lower[1], lower[2], LOBE_TO)
    chord = (p_end[0] - p_start[0], p_end[1] - p_start[1])
    length = math.hypot(*chord)
    nx, ny = -chord[1] / length, chord[0] / length
    mid = ((p_start[0] + p_end[0]) / 2, (p_start[1] + p_end[1]) / 2)
    if (mid[0] - B[0]) * nx + (mid[1] - (B[1] - half)) * ny < 0:
        nx, ny = -nx, -ny
    for i in range(steps + 1):
        t = i / steps
        x = p_start[0] + chord[0] * t
        y = p_start[1] + chord[1] * t
        bulge = math.sin(math.pi * t) * depth
        lobe_only.append((x + nx * bulge, y + ny * bulge))
    # Close the lobe with its chord, so it is a filled D-shape rather than a sliver.
    plate = extruded("PlateFace", lobe_only + [p_end, p_start], 0.017, 0.001)

    parts = [casing, frame, arm_face, plate]
    parts += screw("Screw0", 0.045, 0.050, 0.011)
    parts += screw("Screw1", 0.070, 0.078, 0.011)
    parts += screw("Screw2", 0.100, 0.104, 0.011)
    parts += screw("Screw3", 0.130, 0.112, 0.011)
    parts += screw("ScrewPlate", 0.075, 0.055, 0.011, 0.0032)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.0105, minor_radius=0.0028, major_segments=36, minor_segments=12,
        location=(0.0, 0.0, 0.004),
    )
    hinge = bpy.context.active_object
    hinge.name = "Hinge"
    parts.append(hinge)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / "lane_arm.glb"
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

    # Mirrored copy.
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

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mirrored:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mirrored[0]
    path_r = OUT / "lane_arm_right.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path_r),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    print(f"  wrote {path_r.name}  {path_r.stat().st_size / 1024:.1f} KB")


main()
