"""Build and render a low-poly arcade cabinet, then export it as glTF.

    blender -b --python art/build_cabinet.py

Outputs to art/out/: cabinet.png (EEVEE render) and cabinet.glb (web-ready glTF).
This is the pipeline proof for the Blender idea: geometry, materials, lighting,
camera and export, all from one headless script with no .blend file.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

CYAN = (0.13, 0.88, 1.0, 1.0)
VIOLET = (0.55, 0.36, 0.96, 1.0)
SHELL = (0.05, 0.06, 0.08, 1.0)
STEEL = (0.36, 0.62, 0.85, 1.0)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def material(name: str, color, emission: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()

    if emission > 0:
        shader = nodes.new("ShaderNodeEmission")
        shader.inputs["Color"].default_value = color
        shader.inputs["Strength"].default_value = emission
    else:
        shader = nodes.new("ShaderNodeBsdfPrincipled")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.45
        shader.inputs["Metallic"].default_value = 0.15

    output = nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(shader.outputs[0], output.inputs["Surface"])
    return mat


def box(name, location, size, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.data.materials.append(mat)
    return obj


def cylinder(name, location, radius, depth, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=24, radius=radius, depth=depth, location=location, rotation=rotation
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def sphere(name, location, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=12, radius=radius, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    shade_smooth(obj)
    return obj


def shade_smooth(obj) -> None:
    for poly in obj.data.polygons:
        poly.use_smooth = True


def build_cabinet() -> None:
    shell = material("Shell", SHELL)
    screen = material("Screen", CYAN, emission=2.2)
    marquee = material("Marquee", VIOLET, emission=1.6)
    steel = material("Steel", STEEL)

    # Body sits on the plinth and runs to the marquee: z 0.12 to 1.60.
    box("Body", (0, 0, 0.86), (0.92, 0.60, 1.48), shell)
    box("BackPanel", (0, 0.30, 1.0), (0.84, 0.02, 0.8), shell)
    box("Plinth", (0, -0.02, 0.06), (1.00, 0.68, 0.12), shell)

    # Screen, recessed behind a bezel.
    box("Bezel", (0, -0.305, 1.06), (0.36, 0.015, 0.27), shell)
    box("Screen", (0, -0.315, 1.06), (0.30, 0.004, 0.21), screen)

    # Marquee and its lit underline.
    box("Marquee", (0, -0.305, 1.45), (0.30, 0.012, 0.09), marquee)
    box("MarqueeBar", (0, -0.318, 1.36), (0.34, 0.004, 0.012), screen)

    # Control deck, tilted toward the player.
    box("Deck", (0, -0.30, 0.70), (0.92, 0.14, 0.035), shell, rotation=(math.radians(12), 0, 0))
    cylinder("StickBase", (-0.13, -0.30, 0.735), 0.028, 0.02, steel)
    cylinder("StickShaft", (-0.13, -0.30, 0.78), 0.012, 0.08, steel)
    sphere("StickTop", (-0.13, -0.30, 0.825), 0.028, marquee)
    for i, x in enumerate((0.02, 0.10, 0.18)):
        cylinder(f"Button{i}", (x, -0.295, 0.742), 0.028, 0.016, screen)

    # Side accent stripes, tied to the hall's cyan/violet pairing.
    for side, mat in ((-1, screen), (1, marquee)):
        box(f"Stripe{side}", (side * 0.465, -0.06, 0.95), (0.006, 0.02, 0.55), mat)


def build_stage() -> None:
    floor = material("Floor", (0.02, 0.02, 0.03, 1.0))
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    bpy.context.active_object.data.materials.append(floor)

    # Backdrop to catch the rim light.
    box("Backdrop", (0, 2.2, 1.6), (3.0, 0.02, 1.6), material("Wall", (0.03, 0.03, 0.04, 1.0)))

    key = bpy.data.lights.new("Key", type="AREA")
    key.energy = 260
    key.size = 2.2
    key.color = (0.75, 0.9, 1.0)
    key_obj = bpy.data.objects.new("Key", key)
    key_obj.location = (-2.2, -2.6, 2.8)
    bpy.context.collection.objects.link(key_obj)

    rim = bpy.data.lights.new("Rim", type="AREA")
    rim.energy = 180
    rim.size = 1.6
    rim.color = (0.6, 0.4, 1.0)
    rim_obj = bpy.data.objects.new("Rim", rim)
    rim_obj.location = (2.0, 1.6, 2.2)
    bpy.context.collection.objects.link(rim_obj)

    world = bpy.data.worlds.new("World")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.01, 0.015, 1)
    bpy.context.scene.world = world


def build_camera() -> None:
    target = bpy.data.objects.new("Target", None)
    target.location = (0, 0, 0.95)
    bpy.context.collection.objects.link(target)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 55
    cam = bpy.data.objects.new("Camera", cam_data)
    cam.location = (1.55, -3.35, 1.75)
    bpy.context.collection.objects.link(cam)

    track = cam.constraints.new("TRACK_TO")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    bpy.context.scene.camera = cam


def configure_render() -> None:
    scene = bpy.context.scene
    engines = {
        item.identifier
        for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    }
    for candidate in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        if candidate in engines:
            scene.render.engine = candidate
            break

    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"

    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 48


def main() -> None:
    clear_scene()
    build_cabinet()
    build_stage()
    build_camera()
    configure_render()

    bpy.context.scene.render.filepath = str(OUT / "cabinet.png")
    bpy.ops.render.render(write_still=True)

    bpy.ops.export_scene.gltf(
        filepath=str(OUT / "cabinet.glb"),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )

    print(f"RENDER {OUT / 'cabinet.png'}")
    print(f"GLB    {OUT / 'cabinet.glb'}")


main()
