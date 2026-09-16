"""Blender wardrobe workbench, derived from the frozen deployed AvatarBase.

Outputs are candidates, never automatically approved for the live catalogue.
Run: blender -b --python scripts/build-fitted-wardrobe.py -- WORK_DIRECTORY
"""
import bpy, bmesh, json, sys, math
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree
import numpy as np

OUT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(OUT/'AvatarBase-reference.blend'))
body=bpy.data.objects['Roger_CC_Base_Body']
body_surface=BVHTree.FromPolygons([body.matrix_world@v.co for v in body.data.vertices],[list(p.vertices) for p in body.data.polygons])
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
for obj in bpy.data.objects:
    if obj.type=='MESH' and not obj.name.startswith('Roger_'):obj.hide_render=True
collection=bpy.data.collections.new('WARDROBE_CANDIDATES');bpy.context.scene.collection.children.link(collection)

def material(name,color,roughness):
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness
    # Original neutral weave normal texture: color editing never erases its relief.
    size=256;y,x=np.mgrid[0:size,0:size]
    dx=.13*np.cos(x*math.pi/2)*np.sin(y*math.pi/2)
    dy=.13*np.sin(x*math.pi/2)*np.cos(y*math.pi/2)
    pixels=np.stack((.5+dx,.5+dy,np.full_like(dx,.99),np.ones_like(dx)),axis=-1).astype(np.float32)
    image=bpy.data.images.get('Nexo_weave_normal')
    if not image:
        image=bpy.data.images.new('Nexo_weave_normal',width=size,height=size)
        image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(pixels.ravel());image.update()
        image.filepath_raw=str(OUT/'weave-normal.png');image.file_format='PNG';image.save();image.pack()
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    normal=mat.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.25
    mat.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);mat.node_tree.links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
    return mat

primary=material('Clothing_primary',(.22,.27,.32),.83)
secondary=material('Clothing_secondary',(.075,.085,.105),.9)
detail=material('Clothing_detail',(.35,.38,.41),.65)

def active(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj

def cut(bm,co,no):
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.000001,plane_co=co,plane_no=no,clear_outer=True,clear_inner=False)

def make(name,kind,offset,thickness):
    obj=body.copy();obj.data=body.data.copy();obj.name=name;collection.objects.link(obj)
    obj['wardrobeStatus']='candidate';obj['avatarBaseHash']=json.loads((OUT/'reference-inspection.json').read_text())['sha256']
    obj['clothingSlot']='top' if kind=='tee' else 'bottom'
    for modifier in list(obj.modifiers):obj.modifiers.remove(modifier)
    if obj.data.shape_keys:obj.shape_key_clear()
    # Work in the exact source object's coordinate space, never resize the avatar.
    world=obj.matrix_world.copy();inv=world.inverted()
    obj.data.materials.clear()
    for mat in [primary,secondary,detail]:obj.data.materials.append(mat)
    bm=bmesh.new();bm.from_mesh(obj.data)
    for v in bm.verts:v.co=world@v.co
    if kind=='tee':
        cut(bm,(0,0,.91),(0,0,-1));cut(bm,(0,0,1.505),(0,0,1))
        cut(bm,(.43,0,0),(1,0,0));cut(bm,(-.43,0,0),(-1,0,0))
    else:
        cut(bm,(0,0,.02),(0,0,-1));cut(bm,(0,0,.99),(0,0,1))
        # Remove unrelated fingertips at the same elevation if source pose changes.
        bmesh.ops.delete(bm,geom=[f for f in bm.faces if abs(f.calc_center_median().x)>.27],context='FACES')
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    bmesh.ops.join_triangles(bm,faces=list(bm.faces),angle_face_threshold=.65,angle_shape_threshold=.65)
    bm.normal_update()
    # Smooth anatomical ridges into fabric panels, retaining cuffs and hems.
    interior=[v for v in bm.verts if not v.is_boundary]
    boundaries={v:v.co.copy() for v in bm.verts if v.is_boundary}
    for _ in range(24):bmesh.ops.smooth_vert(bm,verts=interior,factor=.45,use_axis_x=True,use_axis_y=True,use_axis_z=True)
    bm.normal_update()
    for v in bm.verts:
        z=v.co.z
        fold=.0018*math.sin(z*91+v.co.x*23)*math.exp(-((z-(.96 if kind=='tee' else .12))/.085)**2)
        v.co+=v.normal*(offset+fold)
        surface,normal,_,distance=body_surface.find_nearest(v.co)
        if surface is not None and (v.co-surface).dot(normal)<offset:
            v.co=surface+normal*offset
        if kind=='tee' and abs(v.co.x)<.235 and .91<v.co.z<1.43:
            # Tailored fabric envelope bridges pectoral/abdominal valleys instead
            # of reproducing skin anatomy like a rubber body suit.
            z=v.co.z;x=v.co.x
            roomy=.012 if name=='regular-tee' else 0
            width=.20+roomy+.035*math.exp(-((z-1.34)/.16)**2)
            front=.144+roomy+.022*math.exp(-((z-1.3)/.2)**2)
            ellipse=math.sqrt(max(0,1-(x/width)**2))
            ease=max(0,min(1,(1.43-z)/.06))
            if v.co.y<0:v.co.y=min(v.co.y,v.co.y*(1-ease)-front*ellipse*ease)
            else:v.co.y=max(v.co.y,v.co.y*(1-ease)+(.14+roomy)*ellipse*ease)
        original=boundaries.get(v)
        if original is not None:
            for height in ([.91,1.505] if kind=='tee' else [.02,.99]):
                if abs(original.z-height)<.0001:v.co.z=height
            if kind=='tee' and abs(abs(original.x)-.43)<.0001:v.co.x=original.x
    for face in bm.faces:
        # Collar/cuff/hem material regions use the same texture and independent tint.
        face.material_index=1 if any(v.is_boundary for v in face.verts) else 0
        face.smooth=True
    for v in bm.verts:v.co=inv@v.co
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    active(obj)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.015)
    bpy.ops.object.mode_set(mode='OBJECT')
    solid=obj.modifiers.new('Fabric thickness','SOLIDIFY');solid.thickness=thickness/max(world.to_scale());solid.offset=1;solid.use_even_offset=False;solid.material_offset_rim=2
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # Preserve source skin weights; audit and normalize every vertex after trimming.
    deform={g.index:g.name for g in obj.vertex_groups if g.name in rig.data.bones}
    unweighted=0
    for v in obj.data.vertices:
        weights=sorted([(g.group,g.weight) for g in v.groups if g.group in deform and g.weight>0],key=lambda g:-g[1])[:4]
        total=sum(w for _,w in weights)
        if not total:unweighted+=1;continue
        for g in list(v.groups):obj.vertex_groups[g.group].remove([v.index])
        for index,weight in weights:obj.vertex_groups[index].add([v.index],weight/total,'REPLACE')
    arm=obj.modifiers.new('AvatarBase shared skeleton','ARMATURE');arm.object=rig;arm.use_deform_preserve_volume=False
    obj.parent=rig
    return obj,dict(name=name,vertices=len(obj.data.vertices),triangles=sum(len(p.vertices)-2 for p in obj.data.polygons),quads=sum(len(p.vertices)==4 for p in obj.data.polygons),unweighted=unweighted,thickness=thickness,clearance=offset)

garments=[];report=[]
for spec in [('fitted-tee','tee',.014,.0015),('regular-tee','tee',.024,.002),('jogger','pants',.018,.0025)]:
    obj,stats=make(*spec);garments.append(obj);report.append(stats)
for obj in garments:
    active(obj);rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{obj.name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_extras=True,export_apply=False)
    obj.hide_render=obj.name=='regular-tee'

# Named pose actions remain in the .blend for review, without changing the base pose.
poses=['runtime-idle','arms-open','arms-up','arms-forward','arms-crossed','elbows-bent','torso-rotation','torso-lean','torso-extension','walk','run','squat','knee-raised','body-maximum','body-minimum']
def clear_pose():
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4);bone.rotation_mode='QUATERNION'
    bpy.context.view_layer.update()
def point(name):return rig.matrix_world@rig.pose.bones['CC_Base_'+name].matrix.translation
def rotate_world(name,rotation):
    bone=rig.pose.bones['CC_Base_'+name];pivot=point(name)
    transform=Matrix.Translation(pivot)@rotation.to_matrix().to_4x4()@Matrix.Translation(-pivot)
    bone.matrix=rig.matrix_world.inverted()@transform@rig.matrix_world@bone.matrix
    bpy.context.view_layer.update()
def align(name,child,direction):
    rotate_world(name,(point(child)-point(name)).normalized().rotation_difference(Vector(direction).normalized()))
rig.animation_data_create()
for name in poses:
    clear_pose()
    for side,sign in [('L',1),('R',-1)]:
        direction=(sign*.08,-.025,-1)
        if name=='arms-open':direction=(sign,0,0)
        if name=='arms-up':direction=(sign*.18,0,1)
        if name=='arms-forward':direction=(sign*.08,-1,.04)
        if name=='arms-crossed':direction=(sign*.2,-.9,-.15)
        align(side+'_Upperarm',side+'_Forearm',direction)
        if name=='arms-crossed':align(side+'_Forearm',side+'_Hand',(-sign*.95,-.15,.15))
        if name=='elbows-bent':align(side+'_Forearm',side+'_Hand',(sign*.03,-1,.2))
        if name in ['walk','run']:
            align(side+'_Thigh',side+'_Calf',(0,-sign*(.5 if name=='walk' else .8),-.8))
            if name=='run':align(side+'_Calf',side+'_Foot',(0,.7,-.7))
        if name=='squat':
            align(side+'_Thigh',side+'_Calf',(sign*.1,-.6,-.8));align(side+'_Calf',side+'_Foot',(0,.5,-.85))
        if name=='knee-raised' and side=='L':
            align(side+'_Thigh',side+'_Calf',(0,-1,-.1));align(side+'_Calf',side+'_Foot',(0,.05,-1))
    if name.startswith('torso-'):
        rotate_world('Spine02',Quaternion((0,0,1) if name=='torso-rotation' else (1,0,0),.4 if name!='torso-extension' else -.3))
    if name.startswith('body-'):
        volume=1 if name=='body-maximum' else 0
        for side in ['L','R']:
            for part in ['Upperarm','Forearm','Thigh','Calf']:rig.pose.bones['CC_Base_'+side+'_'+part].scale=(.9+volume*.2,1,.9+volume*.2)
        rig.pose.bones['CC_Base_Spine02'].scale=(.96+volume*.1,1,.96+volume*.08)
    action=bpy.data.actions.new('QA_'+name);action.use_fake_user=True;rig.animation_data.action=action
    for bone in rig.pose.bones:
        for channel in ['location','rotation_quaternion','scale']:bone.keyframe_insert(data_path=channel,frame=1)
clear_pose()
(OUT/'garment-candidates.json').write_text(json.dumps(dict(status='NOT_RELEASED',reason='Pose/clipping/UV review required before catalogue integration',garments=report,poses=list(poses)),indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Nexo-wardrobe-workbench.blend'))
print('WARDROBE_CANDIDATES',json.dumps(report))
