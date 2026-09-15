"""Build the editable Blender equipment library and browser GLB.

Run with Blender 4.5+: blender --background --python scripts/build-avatar-equipment.py
Coordinates are authored against the procedural avatar (Y-up in the web scene).
"""
from pathlib import Path
import math
import bpy

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "assets" / "avatar" / "textures"
OUTPUT = ROOT / "public" / "avatar"
SOURCE = ROOT / "assets" / "avatar" / "equipment-library.blend"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for material in tuple(bpy.data.materials):
    bpy.data.materials.remove(material)

def pbr(name, color, roughness=.65, metallic=0.0, color_map=None, normal_map=None):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if color_map:
        image = nodes.new("ShaderNodeTexImage")
        image.image = bpy.data.images.load(str(TEXTURES / color_map), check_existing=True)
        links.new(image.outputs["Color"], bsdf.inputs["Base Color"])
    if normal_map:
        image = nodes.new("ShaderNodeTexImage")
        image.image = bpy.data.images.load(str(TEXTURES / normal_map), check_existing=True)
        image.image.colorspace_settings.name = "Non-Color"
        normal = nodes.new("ShaderNodeNormalMap")
        normal.inputs["Strength"].default_value = .28
        links.new(image.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
    return material

FABRIC = pbr("Tint_Fabric_PolyHaven", (.46,.51,.57), .83, color_map="fabric_color.jpg", normal_map="fabric_normal.jpg")
LEATHER = pbr("Tint_Leather_PolyHaven", (.22,.25,.3), .48, color_map="leather_color.jpg", normal_map="leather_normal.jpg")
METAL = pbr("Metal_Detail", (.48,.52,.58), .23, .78)
DARK_METAL = pbr("Dark_Metal_Detail", (.07,.08,.11), .3, .72)
THREAD = pbr("Thread_Detail", (.76,.79,.82), .86)
WHITE = pbr("Shirt_Detail", (.82,.83,.81), .72)
GOLD = pbr("Gold_Detail", (.65,.43,.13), .2, .82)

def web_location(x, y, z): return (x, -z, y)
def web_dimensions(x, y, z): return (x, z, y)

def parent(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj

def smooth_bevel(obj, amount=.006, segments=2):
    bevel = obj.modifiers.new("Edge bevel", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

def cube(root, name, loc, scale, material, rotation=(0,0,0), bevel=.006):
    bpy.ops.mesh.primitive_cube_add(location=web_location(*loc), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = web_dimensions(*scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel: smooth_bevel(obj, bevel)
    obj.data.materials.append(material)
    obj.parent = root
    return obj

def sphere(root, name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, location=web_location(*loc))
    obj = bpy.context.object
    obj.name = name
    obj.scale = web_dimensions(*scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons: polygon.use_smooth = True
    obj.data.materials.append(material)
    obj.parent = root
    return obj

def cylinder(root, name, loc, radius, depth, material, vertices=24, rotation=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=web_location(*loc), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = root
    smooth_bevel(obj, min(.004, depth/4))
    return obj

def curve(root, name, points, radius, material, cyclic=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 2
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = web_location(*coordinate)
        point.handle_left_type = point.handle_right_type = "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = root
    return obj

def panel(root, name, points, depth, material):
    # A shallow solid in the XY plane of the web avatar.
    front = [(x,-z,y) for x,y,z in points]
    back = [(x,-(z-depth),y) for x,y,z in points]
    vertices = front + back
    count = len(points)
    faces = [tuple(range(count)), tuple(range(count,2*count))[::-1]]
    for index in range(count):
        nxt = (index+1)%count
        faces.append((index,nxt,count+nxt,count+index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = root
    smooth_bevel(obj, min(depth*.35,.004), 2)
    return obj

def button(root, name, x, y, material=METAL):
    cylinder(root,name,(x,y,.143),.011,.007,material,20)

# RPG: each style has a different silhouette and relief language.
r = parent("detail-rpg-tunic")
curve(r,"Tunic_Stitched_Neck",[(-.09,1.50,.132),(0,1.43,.145),(.09,1.50,.132)],.004,THREAD)
curve(r,"Tunic_Diagonal_Binding",[(-.12,1.43,.139),(.03,1.23,.148),(.12,1.05,.135)],.007,LEATHER)
panel(r,"Tunic_Hem_Relief",[(-.15,1.01,.13),(.15,1.01,.13),(.14,.94,.12),(-.14,.94,.12)],.009,FABRIC)

r = parent("detail-rpg-leather")
for side in (-1,1):
    panel(r,f"Leather_Chest_Panel_{side}",[(0,1.48,.139),(side*.145,1.42,.125),(side*.13,1.08,.13),(0,1.16,.151)],.014,LEATHER)
    curve(r,f"Leather_Shoulder_Strap_{side}",[(side*.08,1.51,.13),(side*.16,1.45,.11),(side*.205,1.35,.08)],.013,LEATHER)
curve(r,"Leather_Cross_Seam",[(-.13,1.19,.145),(0,1.15,.157),(.13,1.19,.145)],.004,THREAD)
for x in (-.095,.095): button(r,f"Leather_Rivet_{x}",x,1.34,DARK_METAL)

r = parent("detail-rpg-scholar")
panel(r,"Scholar_Sash",[(-.135,1.5,.135),(-.075,1.52,.145),(.13,1.03,.14),(.075,.99,.13)],.012,FABRIC)
panel(r,"Scholar_Mantle",[(-.2,1.51,.08),(0,1.43,.155),(.2,1.51,.08),(.15,1.37,.12),(0,1.34,.16),(-.15,1.37,.12)],.012,FABRIC)
for y,size in ((1.31,.032),(1.21,.025),(1.12,.019)):
    curve(r,f"Scholar_Rune_{y}",[(-size,y,.158),(0,y+size,.165),(size,y,.158),(0,y-size,.165)],.004,GOLD,True)

r = parent("detail-rpg-armor")
panel(r,"Armor_Breastplate",[(-.14,1.47,.145),(0,1.53,.16),(.14,1.47,.145),(.125,1.1,.145),(0,1.02,.165),(-.125,1.1,.145)],.018,METAL)
for y,width in ((1.38,.12),(1.28,.125),(1.18,.12),(1.09,.1)):
    cube(r,f"Armor_Rib_{y}",(0,y,.174),(width*2,.026,.018),DARK_METAL,bevel=.008)
for side in (-1,1):
    sphere(r,f"Armor_Pauldron_{side}",(side*.205,1.48,.025),(.125,.07,.13),METAL)
    curve(r,f"Armor_Edge_{side}",[(side*.09,1.48,.17),(side*.13,1.28,.17),(side*.11,1.08,.16)],.005,GOLD)

r = parent("detail-rpg-cape")
panel(r,"Command_Cape",[(-.235,1.52,-.08),(.235,1.52,-.08),(.34,.63,-.12),(.19,.52,-.15),(0,.47,-.17),(-.19,.52,-.15),(-.34,.63,-.12)],.018,FABRIC)
for x in (-.17,0,.17): curve(r,f"Cape_Fold_{x}",[(x*.7,1.45,-.101),(x,.95,-.14),(x*1.2,.56,-.16)],.006,THREAD)
for side in (-1,1):
    sphere(r,f"Command_Clasp_{side}",(side*.16,1.48,.14),(.031,.031,.014),GOLD)
curve(r,"Command_Chain",[(-.15,1.47,.155),(0,1.42,.17),(.15,1.47,.155)],.006,GOLD)

# Human wardrobe: casual, jacket, blazer, sport and suit do not share the same front geometry.
r = parent("detail-human-casual")
panel(r,"Casual_Chest_Pocket",[(.045,1.36,.143),(.125,1.36,.133),(.12,1.23,.139),(.05,1.23,.148)],.008,FABRIC)
curve(r,"Casual_Pocket_Stitch",[(.05,1.35,.151),(.12,1.35,.141),(.115,1.24,.147),(.055,1.24,.155)],.003,THREAD,True)
curve(r,"Casual_Collar",[(-.09,1.5,.132),(0,1.44,.145),(.09,1.5,.132)],.004,THREAD)

r = parent("detail-human-jacket")
for side in (-1,1):
    panel(r,f"Jacket_Lapel_{side}",[(side*.025,1.44,.158),(side*.09,1.5,.14),(side*.155,1.39,.126),(side*.075,1.18,.151)],.014,LEATHER)
    curve(r,f"Jacket_Pocket_Zip_{side}",[(side*.055,1.13,.159),(side*.135,1.17,.149)],.006,METAL)
curve(r,"Jacket_Main_Zip",[(0,1.45,.166),(0,1.02,.167)],.006,METAL)
for y in (1.37,1.27,1.17): button(r,f"Jacket_Snap_{y}",-.11,y,DARK_METAL)

r = parent("detail-human-blazer")
panel(r,"Blazer_Shirt",[(-.075,1.48,.143),(.075,1.48,.143),(.08,1.08,.15),(-.08,1.08,.15)],.009,WHITE)
for side in (-1,1):
    panel(r,f"Blazer_Lapel_{side}",[(side*.02,1.4,.161),(side*.09,1.5,.143),(side*.15,1.38,.132),(side*.075,1.15,.157)],.012,FABRIC)
    cube(r,f"Blazer_Pocket_{side}",(side*.1,1.12,.16),(.09,.022,.018),FABRIC,bevel=.004)
for y in (1.17,1.09): button(r,f"Blazer_Button_{y}",.025,y,DARK_METAL)

r = parent("detail-human-sport")
for side in (-1,1):
    curve(r,f"Sport_Shoulder_Stripe_{side}",[(side*.08,1.5,.14),(side*.19,1.43,.1),(side*.25,1.2,.075),(side*.29,.96,.06)],.009,WHITE)
panel(r,"Sport_Chevron",[(-.12,1.31,.146),(0,1.2,.165),(.12,1.31,.146),(.1,1.35,.145),(0,1.27,.164),(-.1,1.35,.145)],.008,WHITE)
curve(r,"Sport_Zip",[(0,1.49,.165),(0,1.31,.17)],.006,METAL)

r = parent("detail-human-suit")
panel(r,"Suit_Shirt",[(-.08,1.49,.14),(.08,1.49,.14),(.085,1.05,.15),(-.085,1.05,.15)],.009,WHITE)
for side in (-1,1):
    panel(r,f"Suit_Peak_Lapel_{side}",[(side*.015,1.38,.164),(side*.09,1.51,.143),(side*.16,1.38,.131),(side*.105,1.31,.148),(side*.065,1.12,.16)],.013,FABRIC)
    cube(r,f"Suit_Welt_Pocket_{side}",(side*.105,1.1,.164),(.092,.018,.016),FABRIC,bevel=.003)
panel(r,"Suit_Tie",[(-.018,1.44,.169),(.018,1.44,.169),(.028,1.18,.171),(0,1.09,.174),(-.028,1.18,.171)],.009,DARK_METAL)
panel(r,"Suit_Pocket_Square",[(.075,1.34,.161),(.135,1.34,.151),(.12,1.39,.151),(.1,1.36,.157)],.008,WHITE)
for y in (1.17,1.09): button(r,f"Suit_Button_{y}",.035,y,DARK_METAL)

# Apply modifiers before export, pack source textures, save the editable source and GLB.
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), compress=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / "equipment-library.glb"),
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print(f"Saved {SOURCE}")
print(f"Exported {OUTPUT / 'equipment-library.glb'}")
