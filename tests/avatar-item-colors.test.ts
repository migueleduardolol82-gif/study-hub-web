import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {newAvatar,setAvatarItemMaterialColors,avatarItems} from '../lib/avatar.ts';
import {defaultItemColors} from '../lib/avatar-item-colors.ts';
import {tintClothing} from '../lib/avatar-clothing-materials.ts';

test('material colors survive serialization without changing ownership, rarity or wallet',()=>{
 const account=newAvatar('2026-09-15T00:00:00Z'),inventory=[...account.inventory],rarity=avatarItems.find(i=>i.id==='base')!.rarity;
 setAvatarItemMaterialColors(account,'base',{primaryColor:'#AABBCC',secondaryColor:'#17191D',detailColor:'#AA9161'});
 const restored=JSON.parse(JSON.stringify(account));
 assert.equal(restored.itemMaterialColors.base.primaryColor,'#aabbcc');assert.equal(restored.itemColors.base,'#aabbcc');
 assert.deepEqual(restored.inventory,inventory);assert.equal(account.balance,0);assert.equal(avatarItems.find(i=>i.id==='base')!.rarity,rarity);
 assert.throws(()=>setAvatarItemMaterialColors(account,'slate',defaultItemColors('#ffffff')));
 assert.throws(()=>setAvatarItemMaterialColors(account,'base',{primaryColor:'red',secondaryColor:'#000000',detailColor:'#000000'}));
});
test('tinting preserves relief and shader properties',()=>{
 const material=new THREE.MeshStandardMaterial({roughness:.83,metalness:0});material.name='Clothing_secondary';
 const normal=new THREE.Texture();material.normalMap=normal;
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.userData.clothingSlot='top';
 tintClothing(mesh,defaultItemColors('#ffffff'),'top');
 assert.equal(mesh.material.color.getHexString(),'323640');assert.equal(mesh.material.normalMap,normal);assert.equal(mesh.material.roughness,.83);assert.equal(mesh.material.metalness,0);
 assert.equal(material.color.getHexString(),'ffffff');
});
