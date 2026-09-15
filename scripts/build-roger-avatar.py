"""Optimize the user-supplied Roger Blender character for the web avatar.

Usage:
  blender --background --python scripts/build-roger-avatar.py -- SOURCE.blend OUTPUT.glb PREVIEW.png
"""

import sys
from pathlib import Path

import bpy
from mathutils import Vector


KEEP = {
    "Roger",
    "Boxers",
    "CC_Base_Body",
    "CC_Base_Eye",
    "CC_Base_EyeOcclusion",
    "CC_Base_TearLine",
    "CC_Base_Teeth",
    "CC_Base_Tongue",
    "Short_blowback",
    "Chin_Curtain_Sparse",
    "Mustache_Horseshoe",
    "Soul_Path_Thick",
    "Stubble_Neck",
}

IMAGE_PREFIX = {
    "Boxers": "Boxers",
    "Std_Skin_Head": "Std_Skin_Head",
    "Std_Skin_Body": "Std_Skin_Body",
    "Std_Skin_Arm": "Std_Skin_Arm",
    "Std_Skin_Leg": "Std_Skin_Leg",
    "Std_Nails": "Std_Nails",
    "Std_Eyelash": "Std_Eyelash",
    "Std_Eye_R": "Std_Eye_R",
    "Std_Cornea_R": "Std_Cornea_R",
    "Std_Eye_L": "Std_Eye_L",
    "Std_Cornea_L": "Std_Cornea_L",
    "Std_Eye_Occlusion_R": "Std_Eye_Occlusion_R",
    "Std_Eye_Occlusion_L": "Std_Eye_Occlusion_L",
    "Std_Tearline_R": "Std_Tearline_R",
    "Std_Tearline_L": "Std_Tearline_L",
    "Std_Upper_Teeth": "Std_Upper_Teeth",
    "Std_Lower_Teeth": "Std_Lower_Teeth",
    "Std_Tongue": "Std_Tongue",
    "Hair": "Hair",
    "Scalp": "Scalp",
    "Beard": "Beard",
}


def image(prefix, suffix):
    candidates = (
        f"{prefix}_{suffix}",
        f"{prefix}_{suffix}.001",
        f"{prefix}_{suffix}_0001",
        f"{prefix}_{suffix}_0002",
        f"{prefix}_{suffix}_0003",
    )
    for name in candidates:
        found = bpy.data.images.get(name)
        if found and found.size[0]:
            limit = 1024 if prefix == "Std_Skin_Head" else 768 if prefix.startswith("Std_Skin") else 512
            if max(found.size) > limit:
                ratio = limit / max(found.size)
                found.scale(max(1, round(found.size[0] * ratio)), max(1, round(found.size[1] * ratio)))
            return found
    return None


def link_image(nodes, links, principled, source, socket, non_color=False):
    if not source:
        return None
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = source
    if non_color:
        source.colorspace_settings.name = "Non-Color"
    links.new(texture.outputs["Color"], principled.inputs[socket])
    return texture


def rebuild_material(original):
    base_name = original.name.split(".")[0]
    prefix = IMAGE_PREFIX.get(base_name, "Beard" if base_name.startswith("Beard") else base_name)
    material = bpy.data.materials.new(f"Roger_{base_name}")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    principled = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(principled.outputs["BSDF"], output.inputs["Surface"])
    diffuse = image(prefix, "Diffuse")
    texture = link_image(nodes, links, principled, diffuse, "Base Color")
    normal_image = image(prefix, "Normal")
    if normal_image:
        normal_texture = nodes.new("ShaderNodeTexImage")
        normal_texture.image = normal_image
        normal_image.colorspace_settings.name = "Non-Color"
        normal = nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = 0.48
        links.new(normal_texture.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], principled.inputs["Normal"])
    principled.inputs["Roughness"].default_value = 0.48
    principled.inputs["Metallic"].default_value = 0.0
    if prefix.startswith("Std_Skin"):
        principled.inputs["Roughness"].default_value = 0.52
        principled.inputs["Subsurface Weight"].default_value = 0.055
    elif prefix.startswith("Std_Cornea") or prefix.startswith("Std_Tearline"):
        principled.inputs["Roughness"].default_value = 0.12
        principled.inputs["Coat Weight"].default_value = 0.3
    elif prefix in {"Hair", "Scalp", "Beard", "Std_Eyelash", "Boxers"}:
        opacity = image(prefix, "Opacity")
        if opacity:
            alpha_texture = nodes.new("ShaderNodeTexImage")
            alpha_texture.image = opacity
            opacity.colorspace_settings.name = "Non-Color"
            links.new(alpha_texture.outputs["Color"], principled.inputs["Alpha"])
            material.surface_render_method = "DITHERED"
        elif texture:
            links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
            material.surface_render_method = "DITHERED"
        material.use_transparency_overlap = False
        principled.inputs["Roughness"].default_value = 0.58
    return material


def main():
    args = sys.argv[sys.argv.index("--") + 1 :]
    source, output = map(lambda value: Path(value).resolve(), args[:2])
    preview = None if args[2] == "-" else Path(args[2]).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source))

    for obj in list(bpy.data.objects):
        if obj.name not in KEEP:
            bpy.data.objects.remove(obj, do_unlink=True)

    armature = bpy.data.objects["Roger"]

    material_cache = {}
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            continue
        obj.name = f"Roger_{obj.name}"
        obj.data.name = obj.name
        if obj.data.shape_keys:
            obj.shape_key_clear()
        for index, slot in enumerate(obj.material_slots):
            if not slot.material:
                continue
            key = slot.material.name.split(".")[0]
            material_cache.setdefault(key, rebuild_material(slot.material))
            obj.material_slots[index].material = material_cache[key]
        obj.select_set(True)
        obj["avatarPart"] = (
            "underwear" if "Boxers" in obj.name else
            "hair" if "blowback" in obj.name else
            "facialHair" if any(part in obj.name for part in ("Curtain", "Mustache", "Soul", "Stubble")) else
            "body"
        )
        if any(part in obj.name for part in ("blowback", "Curtain", "Mustache", "Soul", "Stubble")):
            modifier = obj.modifiers.new("Web optimization", "DECIMATE")
            modifier.ratio = 0.46 if "blowback" in obj.name else 0.58
            bpy.context.view_layer.objects.active = obj
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except RuntimeError:
                obj.modifiers.remove(modifier)

    armature.name = "Roger_Rig"
    armature.data.name = "Roger_Rig"
    armature["avatarModel"] = "roger-male-v1"
    for obj in list(bpy.data.objects):
        obj.select_set(obj.name.startswith("Roger_"))
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_animations=False,
        export_morph=False,
        export_lights=False,
        export_cameras=False,
        export_attributes=True,
        export_image_format="JPEG",
        export_jpeg_quality=76,
    )

    if preview is None:
        return
    # Studio preview of the optimized model.
    bpy.ops.object.camera_add(location=(0, -4.7, 1.02))
    camera = bpy.context.object
    target = Vector((0, 0, 0.96))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 58
    bpy.context.scene.camera = camera
    for location, energy, size in (((2.2, -3.0, 3.4), 850, 3.0), ((-2.3, -2.0, 2.1), 500, 2.5), ((0, 1.5, 2.7), 700, 2.0)):
        bpy.ops.object.light_add(type="AREA", location=location)
        bpy.context.object.data.energy = energy
        bpy.context.object.data.shape = "DISK"
        bpy.context.object.data.size = size
        bpy.context.object.rotation_euler = ((target - bpy.context.object.location).to_track_quat("-Z", "Y").to_euler())
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 540
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = True
    scene.render.filepath = str(preview)
    scene.view_settings.look = "Medium High Contrast"
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()

