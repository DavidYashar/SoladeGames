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
    """Counter, back bar and everything standing on them, after the reference photo."""
    wall_y = -ROOM_D / 2
    bar_y = wall_y + 3.1
    bar_len = 11.0

    # ---------------------------------------------------------------- counter
    top = box("BarTop", (bar_len, 1.15, 0.14), (0, bar_y, 1.12))
    bevel(top, 0.035, 3)
    parts.append(top)

    # Front made of vertical planks with slim gaps, as in the photo.
    planks = []
    count = 26
    for i in range(count):
        pxx = -bar_len / 2 + 0.12 + i * ((bar_len - 0.24) / (count - 1))
        planks.append(box(f"BarPlank{i}", (0.36, 0.06, 1.02), (pxx, bar_y + 0.52, 0.53)))
    parts.append(join(planks, "BarPlanks"))

    body = box("BarBody", (bar_len, 0.9, 1.02), (0, bar_y + 0.02, 0.53))
    parts.append(body)

    # The strip under the counter lip that washes the planks.
    led = box("BarLed", (bar_len - 0.3, 0.04, 0.04), (0, bar_y + 0.5, 0.99))
    parts.append(led)

    # ---------------------------------------------------------------- back bar
    back = box("BackBar", (bar_len, 0.18, 3.5), (0, wall_y + 0.32, 1.75))
    parts.append(back)

    # The back wall's own vertical planks.
    wall_planks = []
    for i in range(34):
        pxx = -bar_len / 2 + 0.15 + i * ((bar_len - 0.3) / 33)
        wall_planks.append(box(f"WallPlank{i}", (0.3, 0.05, 3.2), (pxx, wall_y + 0.42, 1.75)))
    parts.append(join(wall_planks, "BarWallPlanks"))

    shelf_hi = box("BarShelf0", (bar_len - 1.2, 0.44, 0.09), (0, wall_y + 0.62, 2.34))
    shelf_lo = box("BarShelf1", (bar_len - 1.2, 0.44, 0.09), (0, wall_y + 0.62, 1.76))
    for s in (shelf_hi, shelf_lo):
        bevel(s, 0.012, 2)
        parts.append(s)

    # Lit strips under each shelf.
    strip_hi = box("BarStrip0", (bar_len - 1.6, 0.03, 0.03), (0, wall_y + 0.56, 2.29))
    strip_lo = box("BarStrip1", (bar_len - 1.6, 0.03, 0.03), (0, wall_y + 0.56, 1.71))
    parts.append(join([strip_hi, strip_lo], "BarStrips"))

    # ---------------------------------------------------------------- bottles and glass
    bottles = []
    for i in range(19):
        x = -4.7 + i * 0.52
        h = 0.32 + (0.05 if i % 4 == 0 else 0.0)
        bottles.append(
            join(
                [
                    cyl(f"BottleB{i}", 0.052, h * 0.64, (x, wall_y + 0.62, 2.38 + h * 0.32), vertices=12),
                    cyl(f"BottleN{i}", 0.022, h * 0.3, (x, wall_y + 0.62, 2.38 + h * 0.82), vertices=10),
                ],
                f"Bottle{i}",
            )
        )
    parts.append(join(bottles, "BarBottles"))

    # A few special bottles and tumblers on the lower shelf.
    tumbler = []
    for i in range(12):
        x = -1.9 + i * 0.34
        tumbler.append(cyl(f"Tumbler{i}", 0.05, 0.13, (x, wall_y + 0.62, 1.88), vertices=12))
    parts.append(join(tumbler, "BarGlassware"))

    # A shaker and a small plant on the counter.
    shaker = cyl("BarShaker", 0.075, 0.28, (-3.4, bar_y - 0.1, 1.28), vertices=16)
    parts.append(shaker)
    pot = cyl("BarPlantPot", 0.13, 0.2, (3.1, bar_y - 0.15, 1.24), vertices=14)
    leaves = []
    for i in range(9):
        a = i * 0.7
        leaves.append(
            box(
                f"Leaf{i}",
                (0.05, 0.05, 0.3),
                (3.1 + math.cos(a) * 0.12, bar_y - 0.15 + math.sin(a) * 0.12, 1.45),
                rot=(0.3 * math.sin(a), 0.3 * math.cos(a), 0),
            )
        )
    parts += [pot, join(leaves, "BarPlantLeaves")]


def build_lamps(parts):
    """Three cone pendants over the counter."""
    shades = []
    cords = []
    # One pendant over each machine: pinball, pool table, jenga table.
    for i, (x, y) in enumerate(((-6.4, -3.2), (0.0, -1.4), (6.2, -3.2))):
        bpy.ops.mesh.primitive_cone_add(
            vertices=28, radius1=0.52, radius2=0.16, depth=0.4, location=(x, y, 3.55)
        )
        cone = bpy.context.active_object
        cone.name = f"Shade{i}"
        shades.append(cone)
        cords.append(box(f"Cord{i}", (0.03, 0.03, 1.35), (x, y, 4.5)))
    parts.append(join(shades, "LampShades"))
    parts.append(join(cords, "LampCords"))


def build_stools(parts):
    """Four leather stools at the counter."""
    seats = []
    frames = []
    for i, x in enumerate((-3.2, -1.1, 1.1, 3.2)):
        seats.append(cyl(f"StoolSeat{i}", 0.26, 0.13, (x, -4.05, 0.9), vertices=24))
        legs = []
        for dx, dy in ((-0.18, -0.18), (0.18, -0.18), (-0.18, 0.18), (0.18, 0.18)):
            legs.append(cyl(f"StoolLeg{i}", 0.025, 0.84, (x + dx, -4.05 + dy, 0.42), vertices=8))
        ring = cyl(f"StoolRing{i}", 0.2, 0.02, (x, -4.05, 0.28), vertices=18)
        frames += legs + [ring]
    parts.append(join(seats, "StoolSeats"))
    parts.append(join(frames, "StoolFrames"))


def _tube(obj, depth: float, name: str):
    """Turn a curve or text into a solid round tube and return the mesh."""
    # convert works on the selection, not just the active object.
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="CURVE")
    curve = bpy.context.active_object
    # A 2D curve is filled and ignores the bevel. As a 3D curve it keeps only its
    # outlines, and the bevel follows them, which is what a neon letter is.
    curve.data.dimensions = "3D"
    curve.data.bevel_depth = depth
    curve.data.bevel_resolution = 4
    curve.data.resolution_u = 12
    bpy.ops.object.convert(target="MESH")
    mesh = bpy.context.active_object
    mesh.name = name
    return mesh


def _rounded_rect(width: float, height: float, radius: float, segments: int = 10):
    """Points around a rounded rectangle, counter-clockwise."""
    corners = [
        (width / 2 - radius, -height / 2 + radius, -math.pi / 2),
        (width / 2 - radius, height / 2 - radius, 0.0),
        (-width / 2 + radius, height / 2 - radius, math.pi / 2),
        (-width / 2 + radius, -height / 2 + radius, math.pi),
    ]
    points = []
    for cx, cy, start in corners:
        for i in range(segments + 1):
            a = start + (math.pi / 2) * i / segments
            points.append((cx + radius * math.cos(a), cy + radius * math.sin(a), 0.0))
    return points


def build_sign(parts):
    """Neon lettering on its own, no frame: outlined tube letters, as in the reference."""
    bpy.ops.object.text_add(location=(6.5, -ROOM_D / 2 + 0.5, 3.98), rotation=(math.pi / 2, 0, math.pi))
    text = bpy.context.active_object
    text.data.body = "SOLADE\nGAMES"
    text.data.align_x = "CENTER"
    text.data.size = 0.68
    text.data.extrude = 0.0
    parts.append(_tube(text, 0.02, "NeonSign"))


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
    build_stools(parts)
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
