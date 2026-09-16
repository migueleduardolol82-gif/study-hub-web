import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {faceDeformer,applyRogerFaceMorph} from '../lib/avatar-face-morph.ts';
import {initialAppearance,facialControls} from '../lib/avatar.ts';
const bounds=new THREE.Box3(new THREE.Vector3(-.11,1.4,-.12),new THREE.Vector3(.11,1.75,.11));

test('neutral face preserves the existing mesh and proportions do not affect feet',()=>{
  const point=new THREE.Vector3(.03,1.63,.08);
  assert.deepEqual(faceDeformer(bounds,initialAppearance)(point),point);
  const foot=new THREE.Vector3(.1,.05,.1);
  assert.deepEqual(faceDeformer(bounds,{...initialAppearance,facial:{faceWidth:1.15,faceHeight:1.15}})(foot),foot);
});

test('every facial control produces finite, bounded and measurable deformation',()=>{
  for(const [key,,min,max] of facialControls){
    let displacement=0;
    for(const value of [min,max]){
      const deform=faceDeformer(bounds,{...initialAppearance,facial:{[key]:value}});
      for(let yi=0;yi<=10;yi++)for(let xi=-5;xi<=5;xi++){
        const point=new THREE.Vector3(xi*.02,1.4+yi*.035,.1),next=deform(point);
        assert.ok(next.toArray().every(Number.isFinite));
        assert.ok(next.distanceTo(point)<.15);
        displacement+=next.distanceTo(point);
      }
    }
    assert.ok(displacement>1e-5,`${key} must deform geometry`);
  }
});

test('morph targets keep the base positions and topology unchanged',()=>{
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(.22,.35,.23,3,3,3);
  geometry.translate(0,1.575,0);
  const material=new THREE.MeshStandardMaterial();material.name='Roger_Std_Skin_Head';
  const mesh=new THREE.Mesh(geometry,material);root.add(mesh);
  const base=Array.from(geometry.getAttribute('position').array);
  applyRogerFaceMorph(root,{...initialAppearance,facial:{faceWidth:1.15}});
  assert.deepEqual(Array.from(geometry.getAttribute('position').array),base);
  assert.equal(geometry.morphAttributes.position?.[0].count,base.length/3);
  assert.equal(mesh.morphTargetInfluences?.[0],1);
  geometry.dispose();material.dispose();
});
