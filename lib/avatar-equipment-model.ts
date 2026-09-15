import * as THREE from 'three';
import type { AvatarStyleMode } from './avatar.ts';

function cloneTextureInputs(material:THREE.Material){
  const record=material as unknown as Record<string,unknown>;
  for(const key of ['map','normalMap','alphaMap','aoMap','roughnessMap','metalnessMap','emissiveMap']){
    const texture=record[key];if(texture instanceof THREE.Texture)record[key]=texture.clone();
  }
}

let library: Promise<THREE.Group> | undefined;

function loadLibrary() {
  library ??= import('three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader})=>new Promise<THREE.Group>((resolve,reject)=>{
    new GLTFLoader().load('/avatar/equipment-library.glb',gltf=>resolve(gltf.scene),undefined,reject);
  })).catch(error=>{library=undefined;throw error;});
  return library;
}

export async function createEquipmentDetail(mode:AvatarStyleMode,style:string,color:string){
  const source=(await loadLibrary()).getObjectByName(`detail-${mode}-${style}`);
  if(!source)return null;
  const clone=source.clone(true);
  clone.name=`blender-${mode}-${style}`;
  clone.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    object.geometry=object.geometry.clone();
    const materials=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{
      const next=material.clone();
      cloneTextureInputs(next);
      if(next.name.startsWith('Tint_')&&'color' in next){const tinted=next as THREE.MeshStandardMaterial;tinted.color.set(color);tinted.map=null;tinted.needsUpdate=true;}
      return next;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
    object.castShadow=true;object.receiveShadow=true;
  });
  return clone;
}

