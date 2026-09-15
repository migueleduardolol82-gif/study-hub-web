"""Print a compact inventory of the user-provided Roger Blender scene."""

import json
import sys
from pathlib import Path

import bpy


def rounded(values):
    return [round(float(value), 4) for value in values]


def main():
    source = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    objects = []
    for obj in bpy.data.objects:
        entry = {
            "name": obj.name,
            "type": obj.type,
            "dimensions": rounded(obj.dimensions),
            "location": rounded(obj.location),
            "parent": obj.parent.name if obj.parent else None,
            "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        }
        if obj.type == "MESH":
            entry.update(
                vertices=len(obj.data.vertices),
                polygons=len(obj.data.polygons),
                shape_keys=(
                    [key.name for key in obj.data.shape_keys.key_blocks]
                    if obj.data.shape_keys
                    else []
                ),
                armature=next(
                    (modifier.object.name for modifier in obj.modifiers if modifier.type == "ARMATURE" and modifier.object),
                    None,
                ),
            )
        if obj.type == "ARMATURE":
            entry["bones"] = [bone.name for bone in obj.data.bones]
        objects.append(entry)

    images = [
        {
            "name": image.name,
            "path": bpy.path.abspath(image.filepath),
            "size": list(image.size),
            "packed": image.packed_file is not None,
        }
        for image in bpy.data.images
        if image.source == "FILE"
    ]
    payload = {
        "blender": bpy.app.version_string,
        "source": str(source),
        "objects": objects,
        "images": images,
        "collections": [collection.name for collection in bpy.data.collections],
    }
    print("ROGER_INSPECTION_BEGIN")
    print(json.dumps(payload, ensure_ascii=False))
    print("ROGER_INSPECTION_END")


if __name__ == "__main__":
    main()

