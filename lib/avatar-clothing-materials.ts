import * as THREE from 'three';
import type {ItemMaterialColors} from './avatar-item-colors.ts';
const independentMaterials=new WeakSet<THREE.Mesh>();

/** Change only material color; leave texture, normal, roughness and rarity intact. */
export function tintClothing(root:THREE.Object3D,colors:ItemMaterialColors,slot:'top'|'shoes'){
 root.traverse(object=>{
  if(!(object instanceof THREE.Mesh))return;
  const shoe=/^(shoe|sole|boot-shaft|sneaker-lace)-/.test(object.name);
  if((slot==='shoes')!==shoe&&!object.userData.clothingSlot)return;
  if(!independentMaterials.has(object)){
   object.material=Array.isArray(object.material)?object.material.map(material=>material.clone()):object.material.clone();
   independentMaterials.add(object);
  }
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof THREE.MeshStandardMaterial))continue;
   const name=material.name;
   const region=name.includes('_secondary')||/^(collar|sole)-?/.test(object.name)?'secondaryColor'
    :name.includes('_detail')||/zipper|lace|button|buckle|insignia|hem|trim/i.test(object.name)?'detailColor':'primaryColor';
   // Pants retain their own neutral color; unrelated aura/platform meshes are excluded by caller.
   if(slot==='top'&&/^(trouser|pants)-/.test(object.name))continue;
   material.color.set(colors[region]);
  }
 });
}
