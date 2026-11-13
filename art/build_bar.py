"""The arcade's front room: a wooden bar, back bar, bottles, glass and a neon sign.

    blender -b --python art/build_bar.py

Built from primitives so it stays editable, with the detail carried by the names: the
game maps a material onto each group (wood, brass, glass, neon) when it loads the file.

Blender is Z-up. The bar runs along X, the customer stands at +Y, the back bar is at -Y.
One unit is one metre.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "hall"
OUT.mkdir(parents=True, exist_ok=True)

BAR_W = 7.6  # along X
BAR_D = 0.95  # counter depth
BAR_H = 1.12  # counter height


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def bevel(obj, width: float, segments: int = 3) -> None:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(40)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth(obj, angle: float = math.radians(45)) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        bpy.ops.object.shade_smooth()
    obj.select_set(False)


def box(name, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = rot
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return obj


def cylinder(name, radius, depth, loc, rot=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rot
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(rotation=True)
    return obj


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = name
    return joined


def bottle(name: str, x: float, z: float, y: float, height: float, radius: float):
    """A stubby bottle: body, shoulder, neck. Kept as one mesh."""
    body = cylinder(f"{name}Body", radius, height * 0.62, (x, y, z + height * 0.31))
    shoulder = cylinder(f"{name}Shoulder", radius * 0.62, height * 0.16, (x, y, z + height * 0.7))
    neck = cylinder(f"{name}Neck", radius * 0.32, height * 0.26, (x, y, z + height * 0.86))
    return join([body, shoulder, neck], name)


def main() -> None:
    clear()

    parts = []

    # ---------------------------------------------------------------- counter
    counter_top = box("CounterTop", (BAR_W, BAR_D, 0.09), (0, 0, BAR_H - 0.045))
    bevel(counter_top, 0.03, 4)
    parts.append(counter_top)

    # Front face, split into panels by inset grooves.
    body = box("CounterBody", (BAR_W - 0.12, BAR_D - 0.16, BAR_H - 0.09), (0, -0.05, (BAR_H - 0.09) / 2))
    parts.append(body)

    grooves = []
    for i in range(7):
        gx = -BAR_W / 2 + 0.55 + i * ((BAR_W - 1.1) / 6)
        grooves.append(box(f"Groove{i}", (0.035, 0.05, BAR_H - 0.3), (gx, BAR_D / 2 - 0.1, (BAR_H - 0.2) / 2)))
    parts.append(join(grooves, "Grooves"))

    # Brass foot rail and its brackets.
    rail = cylinder("Rail", 0.032, BAR_W - 0.5, (0, BAR_D / 2 + 0.06, 0.22), rot=(0, math.pi / 2, 0), vertices=20)
    smooth(rail)
    parts.append(rail)

    brackets = []
    for i in range(5):
        bx = -BAR_W / 2 + 0.8 + i * ((BAR_W - 1.6) / 4)
        b = box(f"Bracket{i}", (0.05, 0.16, 0.05), (bx, BAR_D / 2 - 0.02, 0.22))
        brackets.append(b)
    parts.append(join(brackets, "RailBrackets"))

    # ---------------------------------------------------------------- back bar
    wall = box("BackBar", (BAR_W, 0.3, 3.4), (0, -1.85, 1.7))
    parts.append(wall)

    shelf_lo = box("ShelfLow", (BAR_W - 0.5, 0.42, 0.06), (0, -1.6, 1.42))
    shelf_mid = box("ShelfMid", (BAR_W - 0.5, 0.42, 0.06), (0, -1.6, 2.05))
    shelf_hi = box("ShelfHigh", (BAR_W - 0.5, 0.32, 0.06), (0, -1.63, 2.66))
    for s in (shelf_lo, shelf_mid, shelf_hi):
        bevel(s, 0.012, 2)
        parts.append(s)

    # Uprights that divide the shelves.
    uprights = []
    for i in range(5):
        ux = -BAR_W / 2 + 0.5 + i * ((BAR_W - 1.0) / 4)
        uprights.append(box(f"Upright{i}", (0.06, 0.4, 1.3), (ux, -1.6, 2.02)))
    parts.append(join(uprights, "Uprights"))

    # ---------------------------------------------------------------- bottles
    bottles = []
    glasses = []
    for shelf, y, count in (("Low", 1.47, 9), ("Mid", 2.1, 9), ("High", 2.7, 7)):
        for i in range(count):
            x = -BAR_W / 2 + 0.7 + i * ((BAR_W - 1.4) / max(1, count - 1))
            h = 0.30 + (0.06 if shelf == "Mid" else 0.0) + (0.04 if i % 3 == 0 else 0.0)
            r = 0.045 + (0.01 if i % 4 == 0 else 0.0)
            bottles.append(bottle(f"Bottle{shelf}{i}", x, y, y, h, r))

    for i in range(6):
        gx = -BAR_W / 2 + 0.9 + i * 0.52
        glasses.append(cylinder(f"Glass{i}", 0.04, 0.11, (gx, -1.35, 1.5), vertices=18))
    parts.append(join(bottles, "Bottles"))
    parts.append(join(glasses, "Glasses"))

    # ---------------------------------------------------------------- neon
    bpy.ops.object.text_add(location=(0, -1.66, 4.72))
    text = bpy.context.active_object
    text.name = "NeonText"
    text.data.body = "ARCADE"
    text.data.align_x = "CENTER"
    text.data.size = 0.62
    text.data.extrude = 0.02
    bpy.context.view_layer.objects.active = text
    bpy.ops.object.convert(target="MESH")
    text = bpy.context.active_object
    text.scale.x = -1
    bpy.context.view_layer.objects.active = text
    bpy.ops.object.transform_apply(scale=True)
    parts.append(text)

    # A second, smaller line under it.
    bpy.ops.object.text_add(location=(0, -1.66, 4.16))
    sub_text = bpy.context.active_object
    sub_text.name = "NeonSub"
    sub_text.data.body = "SKILL"
    sub_text.data.align_x = "CENTER"
    sub_text.data.size = 0.2
    sub_text.data.extrude = 0.012
    bpy.context.view_layer.objects.active = sub_text
    bpy.ops.object.convert(target="MESH")
    sub_obj = bpy.context.active_object
    # The export flips the text about X, so the glyphs come out mirrored; flip it back.
    sub_obj.scale.x = -1
    bpy.context.view_layer.objects.active = sub_obj
    bpy.ops.object.transform_apply(scale=True)
    parts.append(sub_obj)

    # ---------------------------------------------------------------- export
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / "bar.glb"
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
