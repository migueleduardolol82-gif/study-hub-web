"""Render and measure candidate garments in each QA action. Never auto-release."""
import bpy,json,sys,math
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
OUT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Nexo-wardrobe-workbench.blend'))
scene=bpy.context.scene;rig=bpy.data.objects['Roger_Rig'];body=bpy.data.objects['Roger_CC_Base_Body']
garments=[bpy.data.objects[n] for n in ['fitted-tee','regular-tee','jogger']]
scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=480;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
if not scene.world:scene.world=bpy.data.worlds.new('Review studio')
scene.world.color=(.13,.13,.13)
for obj in bpy.data.objects:
    if obj.type=='MESH' and not (obj.name.startswith('Roger_') or obj in garments):obj.hide_render=True
for obj in bpy.data.objects:
    if obj.type=='MESH' and any(x in obj.name for x in ['Curtain','Stubble','Mustache','Soul','Boxers']):obj.hide_render=True
bpy.ops.object.camera_add(location=(2.1,-4.8,2.1));camera=bpy.context.object;target=Vector((0,0,.85))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=2.25;scene.camera=camera
for loc,energy,size in [((1,-3,4),550,4),((-3,-1,2),350,3),((0,3,3),650,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=energy;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
def collision():
    deps=bpy.context.evaluated_depsgraph_get();evaluated=body.evaluated_get(deps);mesh=evaluated.to_mesh()
    verts=[evaluated.matrix_world@v.co for v in mesh.vertices];faces=[list(p.vertices) for p in mesh.polygons]
    tree=BVHTree.FromPolygons(verts,faces);evaluated.to_mesh_clear();result={}
    for garment in garments:
        ev=garment.evaluated_get(deps);m=ev.to_mesh();inside=0;worst=0
        for v in m.vertices:
            p=ev.matrix_world@v.co;hit=tree.find_nearest(p)
            if hit[0] is not None:
                distance=(p-hit[0]).dot(hit[1])
                if distance<-.001:inside+=1;worst=min(worst,distance)
        result[garment.name]={'inside_vertices':inside,'max_penetration_m':round(-worst,6)};ev.to_mesh_clear()
    return result
reports={}
for action in [None]+[a for a in bpy.data.actions if a.name.startswith('QA_')]:
    rig.animation_data.action=action
    if action:scene.frame_set(1)
    else:
        for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    bpy.context.view_layer.update();name=action.name if action else 'base'
    for garment in garments:
        if garment.data.shape_keys:
            for key in garment.data.shape_keys.key_blocks:
                key.value=1 if key.name=='Corrective_'+name.removeprefix('QA_') else 0
    bpy.context.view_layer.update()
    print('CHECKING',name,flush=True);reports[name]=collision();print('CHECKED',name,reports[name],flush=True)
    if '--metrics-only' not in sys.argv and name in ['base','QA_arms-up','QA_squat','QA_arms-forward']:
        scene.render.filepath=str(OUT/f'review-{name}.png');bpy.ops.render.render(write_still=True)
(OUT/'pose-review.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print('POSE_REVIEW',json.dumps(reports))
