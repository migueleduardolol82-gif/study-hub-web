import * as THREE from 'three';
import type {ItemMaterialColors} from './avatar-item-colors.ts';
import {tintClothing} from './avatar-clothing-materials.ts';

/** Bind exported clothing to the existing skeleton. No duplicate animated rig. */
export function bindWardrobe(source:THREE.Group,avatar:THREE.Group,name:string){
 const garment=source.getObjectByName(name);
 const rig=avatar.getObjectByName('Roger_Rig');
 if(!garment||!rig)throw new Error('Roupa incompatível com o AvatarBase.');
 const result=garment.clone(true);
 result.traverse(object=>{
  if(!(object instanceof THREE.SkinnedMesh))return;
  const bones=object.skeleton.bones.map(bone=>avatar.getObjectByName(bone.name));
  if(bones.some(bone=>!(bone instanceof THREE.Bone)))throw new Error('Skeleton incompatível.');
  const skeleton=new THREE.Skeleton(bones as THREE.Bone[],object.skeleton.boneInverses.map(matrix=>matrix.clone()));
  object.geometry=object.geometry.clone();
  object.material=Array.isArray(object.material)?object.material.map(material=>material.clone()):object.material.clone();
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   const inputs=material as unknown as Record<string,unknown>;
   for(const [key,value] of Object.entries(inputs))if(value instanceof THREE.Texture)inputs[key]=value.clone();
  }
  object.bind(skeleton,object.bindMatrix.clone());object.castShadow=true;object.receiveShadow=true;
  const idle=object.morphTargetDictionary?.['Corrective_runtime-idle'];
  if(idle!==undefined&&object.morphTargetInfluences)object.morphTargetInfluences[idle]=1;
  object.frustumCulled=false;
 });
 rig.add(result);return result;
}

const sources=new Map<string,Promise<THREE.Group>>();
export async function loadWardrobeCandidate(avatar:THREE.Group,name:'fitted-tee'|'regular-tee'|'jogger',colors:ItemMaterialColors){
 let source=sources.get(name);
 if(!source){
  source=import('three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader})=>new GLTFLoader().loadAsync(`/api/dev/wardrobe?piece=${name}`)).then(gltf=>gltf.scene).catch(error=>{sources.delete(name);throw error;});
  sources.set(name,source);
 }
 const group=bindWardrobe(await source,avatar,name);
 if(name!=='jogger')tintClothing(group,colors,'top');
 return group;
}
