import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setClothingBodyMask} from '../lib/avatar-body-mask.ts';

test('covered body triangles are restored after unequipping without changing vertices',()=>{
 const avatar=new THREE.Group(),material=new THREE.MeshStandardMaterial();material.name='Roger_Std_Skin_Body';
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,1.2,0,.1,1.2,0,0,1.3,0,0,1.6,0,.1,1.6,0,0,1.7,0],3));geometry.setIndex([0,1,2,3,4,5]);
 const mesh=new THREE.SkinnedMesh(geometry,material);avatar.add(mesh);const before=Array.from(geometry.getAttribute('position').array);
 setClothingBodyMask(avatar,true,false);assert.deepEqual(Array.from(geometry.index!.array),[3,4,5]);
 setClothingBodyMask(avatar,false,false);assert.deepEqual(Array.from(geometry.index!.array),[0,1,2,3,4,5]);
 assert.deepEqual(Array.from(geometry.getAttribute('position').array),before);
});
