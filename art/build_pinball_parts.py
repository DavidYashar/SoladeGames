"""Build the pinball furniture in Blender and export GLB.

    blender -b --python art/build_pinball_parts.py

Everything is modelled at real scale in metres, with the origin at the logical
anchor point the physics uses:

    bumper.glb    origin at the base centre on the playfield
    flipper.glb   origin at the pivot
    ball.glb      origin at the centre
    post.glb      origin at the base centre
    target.glb    origin at the base centre

Parts are named so the renderer can give each one its own material.
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
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def smooth(obj, angle: float = math.radians(35)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def apply_bevel(obj, width: float, segments: int = 3) -> None:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cylinder(name: str, radius: float, depth: float, z: float, verts: int = 64):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=(0, 0, z)
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def torus(name: str, major: float, minor: float, z: float, maj_seg: int = 64, min_seg: int = 20):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=maj_seg,
        minor_segments=min_seg,
        location=(0, 0, z),
    )
    obj = bpy.context.active_object
    obj.name = name
    return obj


def dome(name: str, radius: float, z: float, scale_z: float = 0.62):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=64, ring_count=32, radius=radius, location=(0, 0, z)
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (1.0, 1.0, scale_z)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Cut the bottom half away so it sits on the skirt.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(
        plane_co=(0, 0, z - radius * 0.05),
        plane_no=(0, 0, 1),
        clear_inner=True,
        use_fill=True,
    )
    bpy.ops.object.mode_set(mode="OBJECT")
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
        export_texcoords=True,
        export_materials="EXPORT",
    )
    size = path.stat().st_size / 1024
    print(f"  wrote {path.name}  {size:.1f} KB  ({len(objects)} parts)")


# ---------------------------------------------------------------- bumper
def build_bumper() -> None:
    clear()

    skirt = cylinder("Skirt", 0.033, 0.024, 0.012, verts=72)
    apply_bevel(skirt, 0.0035, 4)

    collar = torus("Collar", 0.0295, 0.0045, 0.0245, 72, 18)

    cap = dome("Cap", 0.0285, 0.026, 0.55)
    apply_bevel(cap, 0.0012, 2)

    crown = torus("Crown", 0.0205, 0.0022, 0.0375, 56, 14)

    core = cylinder("Core", 0.012, 0.006, 0.0415, verts=40)
    apply_bevel(core, 0.0015, 3)

    for obj in (skirt, collar, cap, crown, core):
        smooth(obj)

    export("bumper", [skirt, collar, cap, crown, core])


# ---------------------------------------------------------------- flipper
def build_flipper() -> None:
    clear()

    profile = [
        (0.010, -0.015),
        (0.070, -0.0135),
        (0.094, -0.0105),
        (0.1035, -0.004),
        (0.104, 0.0),
        (0.1035, 0.004),
        (0.094, 0.0105),
        (0.070, 0.0135),
        (0.010, 0.015),
        (0.002, 0.007),
        (0.002, -0.007),
    ]

    mesh = bpy.data.meshes.new("BatProfile")
    mesh.from_pydata([(x, y, 0) for x, y in profile], [], [list(range(len(profile)))])
    mesh.update()
    bat = bpy.data.objects.new("Bat", mesh)
    bpy.context.collection.objects.link(bat)

    solid = bat.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = 0.014
    solid.offset = 0.0
    bpy.context.view_layer.objects.active = bat
    bpy.ops.object.modifier_apply(modifier=solid.name)

    apply_bevel(bat, 0.004, 4)

    # Rubber: a slightly larger shell with the same outline, thinner.
    rubber_mesh = bpy.data.meshes.new("RubberProfile")
    rubber_mesh.from_pydata(
        [(x * 1.06, y * 1.12, 0) for x, y in profile], [], [list(range(len(profile)))]
    )
    rubber_mesh.update()
    rubber = bpy.data.objects.new("Rubber", rubber_mesh)
    bpy.context.collection.objects.link(rubber)
    rs = rubber.modifiers.new("Solidify", "SOLIDIFY")
    rs.thickness = 0.009
    rs.offset = 0.0
    bpy.context.view_layer.objects.active = rubber
    bpy.ops.object.modifier_apply(modifier=rs.name)
    apply_bevel(rubber, 0.0035, 3)

    hub = cylinder("Hub", 0.0165, 0.020, 0.0, verts=48)
    apply_bevel(hub, 0.0022, 3)

    collar = torus("HubRing", 0.0125, 0.0022, 0.0105, 40, 12)

    for obj in (bat, rubber, hub, collar):
        smooth(obj)

    # Hub sits in the bat's plane: rotate the cylinders to lie flat.
    for obj in (hub, collar):
        obj.rotation_euler = (math.radians(90), 0, 0)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)

    export("flipper", [bat, rubber, hub, collar])


# ---------------------------------------------------------------- ball
def build_ball() -> None:
    clear()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=0.0135)
    ball = bpy.context.active_object
    ball.name = "Ball"
    smooth(ball)
    export("ball", [ball])


# ---------------------------------------------------------------- post
def build_post() -> None:
    clear()
    shaft = cylinder("Shaft", 0.0085, 0.026, 0.013, verts=40)
    apply_bevel(shaft, 0.002, 3)
    head = dome("Head", 0.0095, 0.026, 0.85)
    apply_bevel(head, 0.001, 2)
    for obj in (shaft, head):
        smooth(obj)
    export("post", [shaft, head])


# ---------------------------------------------------------------- drop target
def build_target() -> None:
    clear()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.012))
    plate = bpy.context.active_object
    plate.name = "Plate"
    plate.scale = (0.010, 0.020, 0.024)
    bpy.ops.object.transform_apply(scale=True)
    apply_bevel(plate, 0.0025, 3)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.024))
    face = bpy.context.active_object
    face.name = "Face"
    face.scale = (0.0105, 0.016, 0.006)
    bpy.ops.object.transform_apply(scale=True)
    apply_bevel(face, 0.0012, 2)

    export("target", [plate, face])




# ---------------------------------------------------------------- slingshot
def build_slingshot() -> None:
    """The big red triangle from the icon set: plate, cream border, three screws."""
    clear()

    tri = [(0.0, 0.0), (0.115, 0.015), (0.03, 0.075)]

    mesh = bpy.data.meshes.new("TriangleProfile")
    mesh.from_pydata([(x, y, 0) for x, y in tri], [], [[0, 1, 2]])
    mesh.update()
    plate = bpy.data.objects.new("Slingshot", mesh)
    bpy.context.collection.objects.link(plate)
    solid = plate.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = 0.018
    solid.offset = 0.0
    bpy.context.view_layer.objects.active = plate
    bpy.ops.object.modifier_apply(modifier=solid.name)
    apply_bevel(plate, 0.004, 4)

    border_mesh = bpy.data.meshes.new("BorderProfile")
    border_mesh.from_pydata(
        [(x * 1.05 - 0.002, y * 1.05 - 0.002, 0) for x, y in tri], [], [[0, 1, 2]]
    )
    border_mesh.update()
    border = bpy.data.objects.new("Border", border_mesh)
    bpy.context.collection.objects.link(border)
    bs = border.modifiers.new("Solidify", "SOLIDIFY")
    bs.thickness = 0.011
    bs.offset = 0.0
    bpy.context.view_layer.objects.active = border
    bpy.ops.object.modifier_apply(modifier=bs.name)
    apply_bevel(border, 0.005, 3)

    screws = []
    for i, (sx, sy) in enumerate([(0.012, 0.010), (0.1, 0.02), (0.035, 0.066)]):
        screw = cylinder(f"Screw{i}", 0.0055, 0.026, 0.0, verts=24)
        screw.location = (sx, sy, 0.0)
        bpy.context.view_layer.objects.active = screw
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
        apply_bevel(screw, 0.0012, 2)
        screws.append(screw)

    for obj in [plate, border] + screws:
        smooth(obj)

    export("slingshot", [plate, border] + screws)


if __name__ == "__main__":
    print("building pinball parts")
    build_bumper()
    build_flipper()
    build_ball()
    build_post()
    build_target()
    build_slingshot()
    print("done")
