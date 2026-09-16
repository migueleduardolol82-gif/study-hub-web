import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {bindWardrobe} from '../lib/avatar-fitted-wardrobe.ts';

test('garments use existing avatar bones and reject an incompatible skeleton',()=>{
 const source=new THREE.Group(),garment=new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());garment.name='tee';
 const sourceBone=new THREE.Bone();sourceBone.name='Arm';source.add(sourceBone,garment);garment.bind(new THREE.Skeleton([sourceBone]));
 const avatar=new THREE.Group(),rig=new THREE.Group(),avatarBone=new THREE.Bone();rig.name='Roger_Rig';avatarBone.name='Arm';rig.add(avatarBone);avatar.add(rig);
 const result=bindWardrobe(source,avatar,'tee') as THREE.SkinnedMesh;
 assert.equal(result.skeleton.bones[0],avatarBone);assert.equal(result.parent,rig);assert.notEqual(result.geometry,garment.geometry);
 avatarBone.rotation.x=.6;assert.equal(result.skeleton.bones[0].rotation.x,.6);
 sourceBone.name='Unknown';assert.throws(()=>bindWardrobe(source,avatar,'tee'));
});
