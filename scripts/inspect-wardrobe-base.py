"""Measure the exact deployed GLB without modifying the canonical avatar."""
import bpy, json, sys, hashlib
from pathlib import Path
from mathutils import Vector

root=Path(__file__).resolve().parents[1]
out=Path(sys.argv[sys.argv.index('--')+1]).resolve()
out.mkdir(parents=True,exist_ok=True)
data=b''.join((root/'public/avatar/roger-male'/f'part-{i:02}.bin').read_bytes() for i in range(21))
source=out/'AvatarBase-reference.glb';source.write_bytes(data)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
objects=[]
for obj in bpy.data.objects:
    if obj.type!='MESH':continue
    points=[obj.matrix_world@v.co for v in obj.data.vertices]
    objects.append(dict(name=obj.name,vertices=len(points),faces=len(obj.data.polygons),
        materials=[m.name for m in obj.data.materials],
        bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]],
        groups=[g.name for g in obj.vertex_groups]))
report=dict(sha256=hashlib.sha256(data).hexdigest(),units='meters',blender_up='Z',gltf_up='Y',
    rig=rig.name,rig_matrix=[list(row) for row in rig.matrix_world],
    bones={b.name:dict(head=list(rig.matrix_world@b.head_local),tail=list(rig.matrix_world@b.tail_local),parent=b.parent.name if b.parent else None) for b in rig.data.bones},objects=objects)
skin=bpy.data.objects['Roger_CC_Base_Body'];points=[skin.matrix_world@v.co for v in skin.data.vertices]
def section(z):
    band=[p for p in points if abs(p.z-z)<.012 and abs(p.x)<.26]
    return dict(height=z,width=max(p.x for p in band)-min(p.x for p in band),depth=max(p.y for p in band)-min(p.y for p in band))
bone=report['bones'];head=lambda name:Vector(bone['CC_Base_'+name]['head'])
report['measurements']={
    'body_height':max(p.z for p in points)-min(p.z for p in points),
    'shoulder_joint_width':(head('L_Upperarm')-head('R_Upperarm')).length,
    'torso_joint_length':(head('NeckTwist01')-head('Hip')).length,
    'chest':section(1.32),'waist':section(1.09),'hip':section(.88),
    'arm_joint_length':sum((head('L_'+a)-head('L_'+b)).length for a,b in [('Upperarm','Forearm'),('Forearm','Hand')]),
    'leg_joint_length':sum((head('L_'+a)-head('L_'+b)).length for a,b in [('Thigh','Calf'),('Calf','Foot')]),
}
(out/'reference-inspection.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'AvatarBase-reference.blend'))
print('REFERENCE',report['sha256'],rig.name,len(rig.data.bones))
for o in objects:print(o['name'],o['vertices'],o['materials'],o['bounds'])
