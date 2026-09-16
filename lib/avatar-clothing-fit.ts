import * as THREE from 'three';
import {resolvePhysique} from './avatar-physique.ts';
import type {Appearance} from './avatar.ts';

const originalPositions = new WeakMap<THREE.Mesh, THREE.BufferAttribute>();

/** Fit the existing wardrobe to Roger's grounded hip/neck, in figure space. */
export function fitRogerClothing(clothing: THREE.Group, model: THREE.Group, appearance:Appearance, physicalDays=0) {
  const figure=model.parent;
  if(!figure)return;
  figure.updateWorldMatrix(true,true);
  const landmarks=new Map<string,THREE.Vector3|null>();
  const landmark=(name:string)=>{
    if(landmarks.has(name))return landmarks.get(name)!;
    const bone=model.getObjectByName(name);
    const point=bone?figure.worldToLocal(bone.getWorldPosition(new THREE.Vector3())):null;
    landmarks.set(name,point);return point;
  };
  const hip=landmark('CC_Base_Hip'),neck=landmark('CC_Base_NeckTwist01');
  if(!hip||!neck)return;
  const physique=resolvePhysique(appearance,physicalDays);
  const figureInverse=figure.matrixWorld.clone().invert();
  clothing.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    let original=originalPositions.get(object);
    if(!original){
      // Shoes and other pieces can share primitives: keep their geometry independent.
      object.geometry=object.geometry.clone();
      original=object.geometry.getAttribute('position').clone() as THREE.BufferAttribute;
      originalPositions.set(object,original);
    }
    const toFigure=figureInverse.clone().multiply(object.matrixWorld),toLocal=toFigure.clone().invert();
    const position=object.geometry.getAttribute('position'),point=new THREE.Vector3();
    const leg=/^(trouser|shoe|sole|boot-shaft|sneaker-lace)-/.test(object.name);
    const arm=/^(sleeve|sleeve-hem)-/.test(object.name);
    for(let i=0;i<original.count;i++){
      point.fromBufferAttribute(original,i).applyMatrix4(toFigure);
      const y=point.y;
      const side=point.x>=0?1:-1,boneSide=side===1?'L':'R';
      if(leg){
        const foot=landmark(`CC_Base_${boneSide}_Foot`),thigh=landmark(`CC_Base_${boneSide}_Thigh`);
        if(foot&&thigh){
          const t=THREE.MathUtils.clamp((y-.11)/.835,0,1);
          const centerX=side*(.126-.015*t);
          point.x=centerX+(point.x-centerX)*1.14;
          if(object.name.startsWith('shoe-'))point.y=.067+(point.y-.067)*1.2;
          point.x+=THREE.MathUtils.lerp(foot.x,thigh.x,t)-side*(.126-.015*t);
          point.z+=THREE.MathUtils.lerp(foot.z,thigh.z,t)-.012*(1-t);
        }
      }else if(arm){
        const shoulder=landmark(`CC_Base_${boneSide}_Upperarm`),elbow=landmark(`CC_Base_${boneSide}_Forearm`);
        if(shoulder&&elbow){
          const t=THREE.MathUtils.clamp((y-.875)/.615,0,1),blend=THREE.MathUtils.clamp((t-.5)*2,0,1);
          point.x+=THREE.MathUtils.lerp(elbow.x,shoulder.x,blend)-side*(physique.shoulder+.075-.18*t**4);
          point.z+=THREE.MathUtils.lerp(elbow.z,shoulder.z,blend)-.035*(1-t);
          point.y+=.028*THREE.MathUtils.smoothstep(t,.75,1);
        }
      }else{
        point.z+=THREE.MathUtils.lerp(hip.z,neck.z,THREE.MathUtils.clamp((y-.965)/.593,0,1));
      }
      // Preserve the soles; interpolate through the waist and collar landmarks.
      const shift=y<=.965
        ? (hip.y-.965)*THREE.MathUtils.smoothstep(y,.24,.965)
        : THREE.MathUtils.lerp(hip.y-.965,neck.y-1.558,THREE.MathUtils.clamp((y-.965)/.593,0,1));
      point.y+=shift;
      point.applyMatrix4(toLocal);
      position.setXYZ(i,point.x,point.y,point.z);
    }
    position.needsUpdate=true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();object.geometry.computeBoundingSphere();
  });
}
