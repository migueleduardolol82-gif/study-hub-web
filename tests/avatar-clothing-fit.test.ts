import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {fitRogerClothing} from '../lib/avatar-clothing-fit.ts';
import {initialAppearance} from '../lib/avatar.ts';

test('wardrobe fitting follows landmarks without accumulating or moving the floor',()=>{
  const figure=new THREE.Group(),model=new THREE.Group(),clothing=new THREE.Group();
  figure.add(model,clothing);figure.rotation.y=.8;figure.scale.setScalar(1.2);
  for(const [name,y] of [['Hip',1.08],['NeckTwist01',1.65]] as const){
    const bone=new THREE.Bone();bone.name=`CC_Base_${name}`;bone.position.y=y;model.add(bone);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,.965,0,0,1.558,0],3));
  const mesh=new THREE.Mesh(geometry);clothing.add(mesh);
  fitRogerClothing(clothing,model,initialAppearance);
  const points=Array.from(mesh.geometry.getAttribute('position').array);
  assert.ok(Math.abs(points[1])<1e-6);
  assert.ok(Math.abs(points[4]-1.08)<1e-6);
  assert.ok(Math.abs(points[7]-1.65)<1e-6);
  fitRogerClothing(clothing,model,initialAppearance);
  assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),points);
  assert.equal(geometry.getAttribute('position').getY(1),Math.fround(.965));
});
