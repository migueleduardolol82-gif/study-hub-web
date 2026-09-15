import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {avatarItemEquivalent,avatarItemName,avatarItems,initialAppearance} from '../lib/avatar.ts';
import {resolvePhysique} from '../lib/avatar-physique.ts';
import {createAvatarBody} from '../lib/avatar-body.ts';
import {limbPoint,torsoPoint} from '../lib/avatar-anatomy.ts';
import {createAvatarHead,disposeAvatarObject} from '../lib/avatar-head.ts';
import {createFaceSurface} from '../lib/avatar-face-surface.ts';

test('physical progress is bounded, monotonic and never mutates saved appearance',()=>{
 const a=structuredClone(initialAppearance), saved=JSON.stringify(a);let last=0;
 for(const days of [0,1,30,60,180,10000]){const p=resolvePhysique(a,days);assert.ok(p.definition>=last&&p.definition<=1);last=p.definition;assert.ok(p.volume<=1);}
 assert.equal(JSON.stringify(a),saved);
 assert.deepEqual(resolvePhysique(a,-5),resolvePhysique(a,0));assert.deepEqual(resolvePhysique(a,NaN),resolvePhysique(a,0));
 assert.ok(resolvePhysique({...a,fat:53},60).definition<resolvePhysique({...a,fat:8},60).definition);
});
test('garment shells clear the anatomy at muscular and soft extremes',()=>{
 for(const muscle of [0,100])for(const fat of [8,53]){
 const p=resolvePhysique({...initialAppearance,muscle,fat},180);
 for(let y=.94;y<=1.55;y+=.01)for(let angle=0;angle<6.28;angle+=.15){const skin=torsoPoint(p,y,angle),cloth=torsoPoint(p,y,angle,true);assert.ok(Math.hypot(cloth.x,cloth.z)>Math.hypot(skin.x,skin.z));}
 for(const limb of ['arm','leg'] as const)for(let t=.5;t<=1;t+=.025){const skin=limbPoint(p,limb,1,t,0),cloth=limbPoint(p,limb,1,t,0,true);assert.ok(cloth.z>skin.z);}
 }
});
test('anatomy view can hide clothing without changing equipment; textures dispose once',()=>{
 const equipment={tronco:'base'},saved=JSON.stringify(equipment),body=createAvatarBody(initialAppearance,equipment);
 body.clothing.visible=false;body.coverage.visible=true;
 assert.ok(body.anatomy.visible);assert.ok(body.anatomy.getObjectByName('torso-skin'));assert.ok(body.coverage.children.length===3);assert.equal(JSON.stringify(equipment),saved);
 const textures=new Set<THREE.Texture>();body.group.traverse(o=>{if(o instanceof THREE.Mesh)for(const value of Object.values(o.material))if(value instanceof THREE.Texture)textures.add(value);});
 let disposed=0;for(const texture of textures)texture.addEventListener('dispose',()=>disposed++);disposeAvatarObject(body.group);assert.ok(textures.size>0);assert.equal(disposed,textures.size);
});
test('one inventory item exposes paired RPG and human identities',()=>{
 for(const item of avatarItems){
  assert.ok(avatarItemName(item,'rpg').length>2);
  assert.ok(avatarItemName(item,'human').length>2);
  assert.equal(avatarItemEquivalent(item,'rpg'),avatarItemName(item,'human'));
  assert.equal(avatarItemEquivalent(item,'human'),avatarItemName(item,'rpg'));
 }
 const command=avatarItems.find(item=>item.id==='command');
 assert.equal(command?.rpgName,'Capa do Comandante');
 assert.match(command?.humanName||'',/alfaiataria/i);
});
test('RPG cape and human suit are separate geometry with soft-shadow support',()=>{
 const equipment={tronco:'command'};
 const rpg=createAvatarBody(initialAppearance,equipment,[],false,60,'rpg');
 const human=createAvatarBody(initialAppearance,equipment,[],false,60,'human');
 assert.ok(rpg.clothing.getObjectByName('rpg-command-cape'));
 assert.ok(rpg.clothing.getObjectByName('rpg-pauldron--1'));
 assert.ok(rpg.clothing.getObjectByName('rpg-pauldron-1'));
 assert.equal(human.clothing.getObjectByName('rpg-command-cape'),undefined);
 assert.ok(human.clothing.getObjectByName('human-lapel-left'));
 assert.ok(human.clothing.getObjectByName('human-lapel-right'));
 assert.ok(human.clothing.getObjectByName('human-tie'));
 for(const model of [rpg,human])model.clothing.traverse(object=>{if(object instanceof THREE.Mesh){assert.equal(object.castShadow,true);assert.equal(object.receiveShadow,true);}});
 disposeAvatarObject(rpg.group);disposeAvatarObject(human.group);
});
test('eyes follow face surface instead of protruding spheres',()=>{
 const a=initialAppearance,surface=createFaceSurface(a),head=createAvatarHead(a);
 for(const name of ['sclera--1','sclera-1','iris--1','iris-1']){const mesh=head.group.getObjectByName(name) as THREE.Mesh;assert.ok(mesh);const positions=mesh.geometry.getAttribute('position');for(let i=0;i<positions.count;i++){const offset=positions.getZ(i)-surface.z(positions.getX(i),positions.getY(i));assert.ok(offset>0&&offset<.0031,`${name}: ${offset}`);}}
 disposeAvatarObject(head.group);
});
