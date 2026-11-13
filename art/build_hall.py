"""The hall: a warm wooden bar with three game stations.

    blender -b --python art/build_hall.py

One room, built from primitives and grouped by name. The page maps a material onto each
group: floor, wall, timber, brass, glass, neon, felt, cabinet, screen.

Layout (Blender is Z-up; the customer stands at +Y):

    back wall  y = -8      bar, shelves, neon sign
    left       x = -6.4    pinball cabinet
    centre     x =  0      pool table
    right      x =  6.2    jenga table

Stations are marked with empty-ish "Hot*" boxes, which the page uses as click targets.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "web" / "public" / "models" / "hall"
OUT.mkdir(parents=True, exist_ok=True)

ROOM_W = 20.0
ROOM_D = 17.0
ROOM_H = 5.0


def clear() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def bevel(obj, width: float, segments: int = 2) -> None:
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(45)
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


def cyl(name, radius, depth, loc, rot=(0, 0, 0), vertices=24):
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


def build_room(parts):
    floor = box("Floor", (ROOM_W, ROOM_D, 0.3), (0, 0, -0.15))
    parts.append(floor)

    back = box("WallBack", (ROOM_W, 0.3, ROOM_H), (0, -ROOM_D / 2, ROOM_H / 2))
    left = box("WallLeft", (0.3, ROOM_D, ROOM_H), (-ROOM_W / 2, 0, ROOM_H / 2))
    right = box("WallRight", (0.3, ROOM_D, ROOM_H), (ROOM_W / 2, 0, ROOM_H / 2))
    ceiling = box("Ceiling", (ROOM_W, ROOM_D, 0.25), (0, 0, ROOM_H))
    parts += [back, left, right, ceiling]

    beams = []
    for i in range(5):
        by = -ROOM_D / 2 + 1.5 + i * 3.2
        beams.append(box(f"Beam{i}", (ROOM_W, 0.34, 0.34), (0, by, ROOM_H - 0.4)))
    parts.append(join(beams, "Beams"))


def build_bar(parts):
    bar_y = -ROOM_D / 2 + 1.9
    top = box("BarTop", (9.0, 1.0, 0.12), (0, bar_y, 1.12))
    bevel(top, 0.03, 3)
    body = box("BarBody", (8.7, 0.85, 1.05), (0, bar_y - 0.05, 0.53))
    parts += [top, body]

    back = box("BackBar", (9.0, 0.4, 3.4), (0, -ROOM_D / 2 + 0.35, 1.7))
    parts.append(back)

    shelves = []
    for i, z in enumerate((1.35, 1.95, 2.55)):
        s = box(f"BarShelf{i}", (8.2, 0.42, 0.07), (0, -ROOM_D / 2 + 0.62, z))
        bevel(s, 0.01, 2)
        shelves.append(s)
    parts.append(join(shelves, "BarShelves"))

    bottles = []
    for i in range(16):
        x = -3.8 + i * 0.5
        h = 0.3 + (0.05 if i % 3 == 0 else 0)
        z = 1.42 if i % 2 == 0 else 2.02
        bottles.append(cyl(f"Bottle{i}", 0.05, h, (x, -ROOM_D / 2 + 0.62, z + h / 2), vertices=12))
    parts.append(join(bottles, "BarBottles"))

    rail = cyl("BarRail", 0.035, 8.4, (0, bar_y + 0.6, 0.22), rot=(0, math.pi / 2, 0), vertices=16)
    smooth(rail)
    parts.append(rail)


def build_lamps(parts):
    shades = []
    bulbs = []
    cords = []
    for i, x in enumerate((-4.4, 0.0, 4.4)):
        shades.append(cyl(f"Shade{i}", 0.42, 0.34, (x, -2.4, 3.55), vertices=20))
        bulbs.append(cyl(f"Bulb{i}", 0.16, 0.1, (x, -2.4, 3.36), vertices=16))
        cords.append(box(f"Cord{i}", (0.03, 0.03, 1.25), (x, -2.4, 4.35)))
    parts.append(join(shades, "LampShades"))
    parts.append(join(bulbs, "LampBulbs"))
    parts.append(join(cords, "LampCords"))


def build_pool_table(parts, at):
    x, y = at
    bed = box("PoolBed", (4.4, 2.4, 0.22), (x, y, 0.82))
    felt = box("PoolFelt", (4.1, 2.1, 0.06), (x, y, 0.95))
    parts += [bed, felt]

    rails = []
    rails.append(box("PoolRail0", (4.6, 0.22, 0.18), (x, y + 1.19, 0.98)))
    rails.append(box("PoolRail1", (4.6, 0.22, 0.18), (x, y - 1.19, 0.98)))
    rails.append(box("PoolRail2", (0.22, 2.4, 0.18), (x + 2.2, y, 0.98)))
    rails.append(box("PoolRail3", (0.22, 2.4, 0.18), (x - 2.2, y, 0.98)))
    parts.append(join(rails, "PoolRails"))

    legs = []
    for dx in (-1.9, 1.9):
        for dy in (-0.95, 0.95):
            legs.append(box("PoolLeg", (0.42, 0.42, 0.82), (x + dx, y + dy, 0.41)))
    parts.append(join(legs, "PoolLegs"))

    balls = []
    for i in range(7):
        balls.append(cyl(f"Ball{i}", 0.055, 0.11, (x + 0.6 + (i % 4) * 0.14, y + 0.1 + (i // 4) * 0.14, 1.03), vertices=12))
    parts.append(join(balls, "PoolBalls"))


def build_pinball(parts, at):
    x, y = at
    body = box("PinBody", (1.35, 2.5, 0.55), (x, y, 0.92), rot=(0, 0, 0.25))
    parts.append(body)

    deck = box("PinDeck", (1.2, 2.2, 0.06), (x, y, 1.2), rot=(0, 0, 0.25))
    parts.append(deck)

    back = box("PinBackbox", (1.3, 0.35, 0.95), (x - 0.32, y - 1.5, 1.85), rot=(0, 0, 0.25))
    screen = box("PinScreen", (1.05, 0.05, 0.66), (x - 0.32, y - 1.33, 1.9), rot=(0, 0, 0.25))
    parts += [back, screen]

    legs = []
    for dx, dy in ((-0.55, -0.95), (0.55, -0.95), (-0.55, 1.0), (0.55, 1.0)):
        legs.append(cyl("PinLeg", 0.06, 0.75, (x + dx, y + dy, 0.37), vertices=10))
    parts.append(join(legs, "PinLegs"))


def build_jenga_table(parts, at):
    x, y = at
    top = box("JengaTop", (3.2, 3.2, 0.16), (x, y, 0.86))
    bevel(top, 0.04, 2)
    parts.append(top)

    legs = []
    for dx in (-1.35, 1.35):
        for dy in (-1.35, 1.35):
            legs.append(box("JengaLeg", (0.22, 0.22, 0.86), (x + dx, y + dy, 0.43)))
    parts.append(join(legs, "JengaLegs"))

    # A small tower on the table.
    planks = []
    for layer in range(9):
        for j in range(3):
            along_x = layer % 2 == 0
            w = 0.3 if along_x else 0.1
            d = 0.1 if along_x else 0.3
            px = x + (j - 1) * 0.105 if not along_x else x
            py = y if not along_x else y + (j - 1) * 0.105
            planks.append(box(f"Plank{layer}{j}", (w, d, 0.06), (px, py, 0.98 + layer * 0.062)))
    parts.append(join(planks, "JengaPlanks"))


def build_sign(parts):
    bpy.ops.object.text_add(location=(0, -ROOM_D / 2 + 1.3, 4.15))
    text = bpy.context.active_object
    text.name = "NeonSign"
    text.data.body = "PLAY  DRINK  PLAY"
    text.data.align_x = "CENTER"
    text.data.size = 0.7
    text.data.extrude = 0.03
    bpy.context.view_layer.objects.active = text
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    obj.scale.x = -1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(scale=True)
    parts.append(obj)


def build_hotspots(parts):
    """Invisible click targets, one per station."""
    for name, loc, size in (
        ("HotPinball", (-6.4, -3.2, 1.1), (1.9, 2.9, 2.2)),
        ("HotPool", (0.0, -1.4, 1.0), (5.0, 3.0, 1.6)),
        ("HotJenga", (6.2, -3.2, 1.0), (3.8, 3.8, 1.8)),
    ):
        parts.append(box(name, size, loc))


def main() -> None:
    clear()
    parts = []
    build_room(parts)
    build_bar(parts)
    build_lamps(parts)
    build_pool_table(parts, (0.0, -1.4))
    build_pinball(parts, (-6.4, -3.2))
    build_jenga_table(parts, (6.2, -3.2))
    build_sign(parts)
    build_hotspots(parts)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]

    path = OUT / "hall.glb"
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
