import * as THREE from 'three';
import type { Appearance } from './avatar.ts';
import { resolvePhysique } from './avatar-physique.ts';
import { applyRogerFaceMorph } from './avatar-face-morph.ts';

export const ROGER_MALE_PART_COUNT = 21;
let library: Promise<THREE.Group> | undefined;

async function loadLibrary() {
  library ??= Promise.all(Array.from({length:ROGER_MALE_PART_COUNT},(_,index)=>fetch(`/avatar/roger-male/part-${String(index).padStart(2,'0')}.bin`).then(response=>{
    if(!response.ok)throw new Error(`Falha ao carregar a parte ${index} do avatar masculino.`);
    return response.arrayBuffer();
  }))).then(async parts=>{
    const total=parts.reduce((sum,part)=>sum+part.byteLength,0),joined=new Uint8Array(total);
    let offset=0;for(const part of parts){joined.set(new Uint8Array(part),offset);offset+=part.byteLength;}
    const {GLTFLoader}=await import('three/examples/jsm/loaders/GLTFLoader.js');
    return new Promise<THREE.Group>((resolve,reject)=>new GLTFLoader().parse(joined.buffer,'',gltf=>resolve(gltf.scene),reject));
  }).catch(error=>{library=undefined;throw error;});
  return library;
}

export type RogerMaleAvatar={group:THREE.Group;underwear:THREE.Object3D[]};

function cloneTextureInputs(material:THREE.Material){
  const record=material as unknown as Record<string,unknown>;
  for(const key of ['map','normalMap','alphaMap','aoMap','roughnessMap','metalnessMap','emissiveMap']){
    const texture=record[key];if(texture instanceof THREE.Texture)record[key]=texture.clone();
  }
}

function lowerArm(group:THREE.Group,side:'L'|'R'){
  group.updateMatrixWorld(true);
  const upper=group.getObjectByName(`CC_Base_${side}_Upperarm`),forearm=group.getObjectByName(`CC_Base_${side}_Forearm`);
  if(!upper||!forearm||!upper.parent)return;
  const shoulder=upper.getWorldPosition(new THREE.Vector3()),elbow=forearm.getWorldPosition(new THREE.Vector3());
  const current=elbow.sub(shoulder).normalize();
  const target=new THREE.Vector3(side==='L'?.08:-.08,-1,.025).normalize();
  const worldCorrection=new THREE.Quaternion().setFromUnitVectors(current,target);
  const parentWorld=upper.parent.getWorldQuaternion(new THREE.Quaternion());
  const localCorrection=parentWorld.clone().invert().multiply(worldCorrection).multiply(parentWorld);
  upper.quaternion.premultiply(localCorrection);
  upper.updateMatrixWorld(true);
}

function addForwardIrises(group:THREE.Group,color:string){
  group.updateMatrixWorld(true);
  const irisMaterial=new THREE.MeshPhysicalMaterial({color,roughness:.34,clearcoat:.3});
  const pupilMaterial=new THREE.MeshStandardMaterial({color:'#08090b',roughness:.4});
  const ringMaterial=new THREE.MeshStandardMaterial({color:new THREE.Color(color).multiplyScalar(.45),roughness:.5});
  const highlightMaterial=new THREE.MeshBasicMaterial({color:'#ffffff'});
  for(const side of ['L','R']){
    const bone=group.getObjectByName(`CC_Base_${side}_Eye`);if(!bone)continue;
    const center=group.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
    const eye=new THREE.Group();eye.name=`roger-${side.toLowerCase()}-iris`;eye.position.copy(center);eye.position.z+=.0175;
    const iris=new THREE.Mesh(new THREE.CircleGeometry(.0082,32),irisMaterial.clone());
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.00815,.00075,8,32),ringMaterial.clone());ring.position.z=.00025;
    const pupil=new THREE.Mesh(new THREE.CircleGeometry(.00345,24),pupilMaterial.clone());pupil.position.z=.00055;
    const highlight=new THREE.Mesh(new THREE.CircleGeometry(.00125,16),highlightMaterial.clone());highlight.position.set(-.0021,.0023,.00085);
    eye.add(iris,ring,pupil,highlight);group.add(eye);
  }
  irisMaterial.dispose();pupilMaterial.dispose();ringMaterial.dispose();highlightMaterial.dispose();
}

export async function createRogerMaleAvatar(appearance:Appearance,physicalDays=0):Promise<RogerMaleAvatar>{
  const [{clone},source]=await Promise.all([
    import('three/examples/jsm/utils/SkeletonUtils.js'),
    loadLibrary(),
  ]);
  const group=clone(source) as THREE.Group;
  group.name='roger-male-avatar';
  const physique=resolvePhysique(appearance,physicalDays);
  const bodyTint=new THREE.Color(appearance.skin).multiplyScalar(1.18);
  const hairTint=new THREE.Color(appearance.hairColor).lerp(new THREE.Color('#ffffff'),.34);
  const underwear:THREE.Object3D[]=[];
  group.traverse(object=>{
    if(object.userData.avatarPart==='underwear')underwear.push(object);
    if(object.userData.avatarPart==='hair'){
      object.visible=appearance.hair!=='raspado';
    }
    if(object.userData.avatarPart==='facialHair'){
      const style=appearance.beardStyle??(appearance.beard?'barba curta':'sem barba');
      object.visible=appearance.beard&&style!=='sem barba'&&(style!=='cavanhaque'||!/Curtain|Stubble/.test(object.name));
    }
    if(!(object instanceof THREE.Mesh))return;
    object.geometry=object.geometry.clone();
    if(object.userData.avatarPart==='hair'||object.parent?.userData.avatarPart==='hair'){
      // Deform the tips around the scalp; never scale a skinned mesh around its origin.
      object.geometry.computeBoundingBox();
      const bounds=object.geometry.boundingBox!;
      const position=object.geometry.getAttribute('position');
      const length=THREE.MathUtils.clamp(appearance.hairLength??1,.82,1.22);
      const height=Math.max(bounds.max.y-bounds.min.y,.001);
      for(let i=0;i<position.count;i++){
        const y=position.getY(i),t=THREE.MathUtils.smoothstep(y,bounds.min.y+height*.65,bounds.max.y);
        position.setY(i,y+(length-1)*height*t*.5);
      }
      position.needsUpdate=true;object.geometry.computeVertexNormals();object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();
    }
    object.castShadow=true;object.receiveShadow=true;
    const originals=Array.isArray(object.material)?object.material:[object.material];
    const materials=originals.map(original=>{
      const material=original.clone() as THREE.MeshStandardMaterial;
      cloneTextureInputs(material);
      if(material.name.includes('Skin_')){material.color.copy(bodyTint);material.roughness=Math.max(material.roughness,.68);material.metalness=0;}
      if(material.name.includes('Hair')||material.name.includes('Scalp')||material.name.includes('Beard'))material.color.copy(hairTint);
      if(material.name.includes('Cornea')){material.transparent=true;material.opacity=.16;material.depthWrite=false;}
      if(material.name.includes('Tearline')){material.transparent=true;material.opacity=.22;material.depthWrite=false;}
      if(material.name.includes('Eye_')&&!material.name.includes('Occlusion')&&!material.name.includes('Cornea')){
        material.color.lerp(new THREE.Color(appearance.eyeColor??'#647d91'),.16);
      }
      material.needsUpdate=true;
      return material;
    });
    object.material=Array.isArray(object.material)?materials:materials[0];
  });
  lowerArm(group,'L');lowerArm(group,'R');
  addForwardIrises(group,appearance.eyeColor??'#647d91');
  applyRogerFaceMorph(group,appearance);
  const muscleScale=.9+physique.volume*.2;
  for(const side of ['L','R']){
    for(const part of ['Upperarm','Forearm','Thigh','Calf']){
      const bone=group.getObjectByName(`CC_Base_${side}_${part}`);
      if(bone)bone.scale.set(muscleScale,1,muscleScale);
    }
  }
  const chest=group.getObjectByName('CC_Base_Spine02');
  if(chest)chest.scale.set(.96+physique.volume*.1,1,.96+physique.volume*.08);
  const width=.96+physique.softness*.09+physique.volume*.025;
  group.scale.set(width,1,.98+physique.softness*.05);
  group.updateMatrixWorld(true);
  const groundedBounds=new THREE.Box3().setFromObject(group,true);
  if(!groundedBounds.isEmpty())group.position.y-=groundedBounds.min.y;
  return {group,underwear};
}
