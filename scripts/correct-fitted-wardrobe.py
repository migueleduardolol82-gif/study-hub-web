"""Generate pose correction candidates; requires visual approval before release."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
OUT=Path(sys.argv[sys.argv.index('--')+1]).resolve()
bpy.ops.wm.open_mainfile(filepath=str(OUT/'Nexo-wardrobe-workbench.blend'))
rig=bpy.data.objects['Roger_Rig'];body=bpy.data.objects['Roger_CC_Base_Body']
garments=[bpy.data.objects[n] for n in ['fitted-tee','regular-tee','jogger']]
def reset():
    rig.animation_data.action=None
    for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
    for garment in garments:
        if garment.data.shape_keys:
            for key in garment.data.shape_keys.key_blocks:key.value=0
    bpy.context.view_layer.update()
def correct(garment,key):
    deps=bpy.context.evaluated_depsgraph_get();body_eval=body.evaluated_get(deps);m=body_eval.to_mesh()
    tree=BVHTree.FromPolygons([body_eval.matrix_world@v.co for v in m.vertices],[list(f.vertices) for f in m.polygons]);body_eval.to_mesh_clear()
    mesh_eval=garment.evaluated_get(deps);mesh=mesh_eval.to_mesh()
    matrices={g.index:rig.pose.bones[g.name].matrix@rig.data.bones[g.name].matrix_local.inverted() for g in garment.vertex_groups if g.name in rig.data.bones}
    world=rig.matrix_world;inv=world.inverted();count=0
    for vertex in mesh.vertices:
        point=mesh_eval.matrix_world@vertex.co;surface,normal,_,_=tree.find_nearest(point)
        if surface is None:continue
        signed=(point-surface).dot(normal)
        if signed>=.003:continue
        weights=[(g.group,g.weight) for g in garment.data.vertices[vertex.index].groups if g.group in matrices]
        skin=Matrix(tuple(tuple(sum(matrices[i][r][c]*w for i,w in weights) for c in range(4)) for r in range(4)))
        delta=(inv.to_3x3()@(normal*(.004-signed)))
        key.data[vertex.index].co+=skin.to_3x3().inverted_safe()@delta;count+=1
    mesh_eval.to_mesh_clear();return count
reset()
report={}
for garment in garments:
    # Base correction edits only clothing, never the reference body.
    if garment.data.shape_keys:garment.shape_key_clear()
    base=garment.shape_key_add(name='Basis')
    for _ in range(3):
        correct(garment,base);bpy.context.view_layer.update()
for action in [a for a in bpy.data.actions if a.name.startswith('QA_')]:
    reset();rig.animation_data.action=action;bpy.context.scene.frame_set(1);bpy.context.view_layer.update()
    report[action.name]={}
    for garment in garments:
        key=garment.shape_key_add(name='Corrective_'+action.name.removeprefix('QA_'));key.value=1
        total=0
        for _ in range(10):
            total+=correct(garment,key);bpy.context.view_layer.update()
        report[action.name][garment.name]=total
reset()
for obj in garments:
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{obj.name}.glb'),export_format='GLB',use_selection=True,export_animations=False,export_morph=True,export_extras=True,export_apply=False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'Nexo-wardrobe-workbench.blend'))
(OUT/'corrective-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('CORRECTIVE_CANDIDATES',json.dumps(report),flush=True)
