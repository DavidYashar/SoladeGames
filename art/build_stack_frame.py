"""Build the Stack Tower cabinet frame and export it as glTF.

    blender -b --python art/build_stack_frame.py

The frame is an open surround: a 6 x 9 playfield window with rails, a marquee above
and a control deck below. The game itself is rendered live inside that window, so the
opening must stay empty.

Scene units are arbitrary here. The playfield window is exactly 6 wide by 9 tall to
match the game's logical 360 x 540 field divided by 60.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

OPEN_W, OPEN_H = 6.0, 9.0
RAIL = 0.55
DEPTH = 1.1

SHELL = (0.085, 0.095, 0.125, 1.0)
CYAN = (0.13, 0.88, 1.0, 1.0)
VIOLET = (0.55, 0.36, 0.96, 1.0)
CREAM = (0.86, 0.92, 1.0, 1.0)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat(name: str, color, emission: float = 0.0, rough: float = 0.42):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    nodes.clear()
    if emission > 0:
        shader = nodes.new("ShaderNodeEmission")
        shader.inputs["Color"].default_value = color
        shader.inputs["Strength"].default_value = emission
    else:
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = rough
        shader.inputs["Metallic"].default_value = 0.2
    out = nodes.new("ShaderNodeOutputMaterial")
    m.node_tree.links.new(shader.outputs[0], out.inputs["Surface"])
    return m


def box(name, loc, size, material) -> None:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(material)


def build() -> None:
    shell = mat("Shell", SHELL)
    glow = mat("CyanGlow", CYAN, emission=2.4)
    violet = mat("VioletGlow", VIOLET, emission=1.8)
    cream = mat("Cream", CREAM, rough=0.3)

    half_w = OPEN_W / 2
    half_h = OPEN_H / 2

    # Rails around the window.
    box("RailLeft", (-half_w - RAIL / 2, 0, 0), (RAIL, DEPTH, OPEN_H + RAIL * 2), shell)
    box("RailRight", (half_w + RAIL / 2, 0, 0), (RAIL, DEPTH, OPEN_H + RAIL * 2), shell)
    box("RailTop", (0, 0, half_h + RAIL / 2), (OPEN_W + RAIL * 2, DEPTH, RAIL), shell)
    box("RailBottom", (0, 0, -half_h - RAIL / 2), (OPEN_W + RAIL * 2, DEPTH, RAIL), shell)

    # Recessed back wall, sitting behind the playfield.
    box("BackWall", (0, DEPTH / 2 - 0.06, 0), (OPEN_W, 0.1, OPEN_H), shell)

    # Inner lip: a thin bright edge so the window reads as an opening.
    lip_z = half_h + 0.02
    box("LipTop", (0, -DEPTH / 2 + 0.02, lip_z), (OPEN_W, 0.05, 0.05), glow)
    box("LipBottom", (0, -DEPTH / 2 + 0.02, -lip_z), (OPEN_W, 0.05, 0.05), glow)
    box("LipLeft", (-half_w - 0.02, -DEPTH / 2 + 0.02, 0), (0.05, 0.05, OPEN_H), glow)
    box("LipRight", (half_w + 0.02, -DEPTH / 2 + 0.02, 0), (0.05, 0.05, OPEN_H), glow)

    # Marquee: a lit band above the window.
    mw = OPEN_W + RAIL * 2
    box("Marquee", (0, -0.2, half_h + RAIL + 0.55), (mw, 0.9, 0.85), violet)
    box("MarqueeBar", (0, -0.66, half_h + RAIL + 0.1), (mw * 0.9, 0.06, 0.09), glow)

    # Control deck below, tilted toward the player.
    deck_z = -half_h - RAIL - 0.35
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -0.45, deck_z),
                                    rotation=(math.radians(-18), 0, 0))
    deck = bpy.context.active_object
    deck.name = "Deck"
    deck.scale = (mw, 1.25, 0.16)
    deck.data.materials.append(shell)

    # A single drop button on the deck: the game's only control.
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=32, radius=0.34, depth=0.14, location=(0, -0.75, deck_z + 0.14)
    )
    button = bpy.context.active_object
    button.name = "DropButton"
    button.data.materials.append(cream)

    # Side skirts so the cabinet reads as a solid object from an angle.
    for side in (-1, 1):
        box(f"Skirt{side}", (side * (half_w + RAIL + 0.18), 0.15, -0.6),
            (0.36, DEPTH * 0.85, OPEN_H * 0.55), shell)


def camera_and_light() -> None:
    target = bpy.data.objects.new("Target", None)
    target.location = (0, -0.3, 0.2)
    bpy.context.collection.objects.link(target)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 40
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (2.6, -19.0, 1.9)
    bpy.context.collection.objects.link(cam)

    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    bpy.context.scene.camera = cam

    key = bpy.data.lights.new("Key", type="AREA")
    key.energy = 900
    key.size = 6
    key.color = (0.8, 0.92, 1.0)
    obj = bpy.data.objects.new("Key", key)
    obj.location = (-6, -8, 8)
    obj.rotation_euler = (math.radians(50), 0, math.radians(-30))
    bpy.context.collection.objects.link(obj)

    rim = bpy.data.lights.new("Rim", type="AREA")
    rim.energy = 700
    rim.size = 5
    rim.color = (0.65, 0.45, 1.0)
    obj = bpy.data.objects.new("Rim", rim)
    obj.location = (7, 5, 5)
    obj.rotation_euler = (math.radians(60), 0, math.radians(140))
    bpy.context.collection.objects.link(obj)

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.013, 0.02, 1)
    bpy.context.scene.world = world


def main() -> None:
    clear_scene()
    build()

    # Export before the render camera and lights are added: the browser brings its own.
    bpy.ops.export_scene.gltf(
        filepath=str(OUT / "stack_frame.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )
    print(f"GLB {OUT / 'stack_frame.glb'}")

    camera_and_light()
    scene = bpy.context.scene
    engines = {
        item.identifier
        for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    }
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if candidate in engines:
            scene.render.engine = candidate
            break
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1000
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(OUT / "stack_frame.png")
    bpy.ops.render.render(write_still=True)
    print(f"RENDER {OUT / 'stack_frame.png'}")


main()
