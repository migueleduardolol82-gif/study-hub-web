import * as THREE from 'three';
import {resolveFacial, type Appearance} from './avatar.ts';

/** Common rest-space deformation keeps eyes, eyelids, hair and beard aligned. */
export function faceDeformer(bounds: THREE.Box3, appearance: Appearance) {
  const f=resolveFacial(appearance);
  f.eyeSize*=1+(.75-THREE.MathUtils.clamp(appearance.realism??.75,0,1))*.12;
  const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const h=Math.max(size.y,.001),w=Math.max(size.x,.001),depth=Math.max(size.z,.001);
  const bell=(value:number,at:number,radius:number)=>Math.exp(-(((value-at)/radius)**2));
  return (point:THREE.Vector3) => {
    const result=point.clone();
    const y=(point.y-bounds.min.y)/h,x=(point.x-center.x)/w;
    const face=THREE.MathUtils.smoothstep(y,.18,.4);
    if(!face)return result;
    const front=THREE.MathUtils.smoothstep((point.z-bounds.min.z)/depth,.5,.8);
    const jaw=bell(y,.38,.16),chin=bell(y,.3,.09)*bell(x,0,.22);
    const cheek=bell(y,.57,.13),nose=bell(y,.55,.12)*bell(x,0,.13)*front;
    const mouth=bell(y,.43,.06)*bell(x,0,.21)*front;
    const eyeX=Math.sign(x||1)*.145,eyeY=.645;
    const eye=bell(y,eyeY,.07)*bell(Math.abs(x),.145,.105)*front;
    const brow=bell(y,.72,.04)*bell(Math.abs(x),.145,.13)*front;
    const preset=appearance.face==='arredondado'?.055:appearance.face==='oval'?-.025:0;
    result.x+=(point.x-center.x)*face*((f.faceWidth-1)+(f.jawWidth-1)*jaw+(f.chinWidth-1)*chin+(f.cheekWidth-1+preset)*cheek);
    result.y+=(point.y-(bounds.min.y+h*.3))*(f.faceHeight-1)*face;
    result.x+=(point.x-center.x)*(f.noseWidth-1)*nose;
    result.z+=depth*.23*(f.noseLength-1)*nose;
    result.x+=(point.x-center.x)*(f.mouthWidth-1)*mouth;
    result.z+=depth*.065*(f.lipFullness-1)*mouth;
    result.x+=w*eyeX*(f.eyeSpacing-1)*eye;
    result.x+=w*(x-eyeX)*(f.eyeSize-1)*eye;
    result.y+=h*(y-eyeY)*(f.eyeSize-1)*eye;
    result.y+=h*(y-.72)*(f.browThickness-1)*brow;
    return result;
  };
}

export function applyRogerFaceMorph(root:THREE.Group,appearance:Appearance) {
  root.updateMatrixWorld(true);
  const faceBounds=new THREE.Box3();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const materials=Array.isArray(object.material)?object.material:[object.material];
    if(materials.some(material=>material.name.includes('Skin_Head'))){
      object.geometry.computeBoundingBox();
      faceBounds.union(object.geometry.boundingBox!.clone().applyMatrix4(object.matrixWorld));
    }
  });
  if(faceBounds.isEmpty())return;
  const deform=faceDeformer(faceBounds,appearance);
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const geometry=object.geometry,position=geometry.getAttribute('position');
    if(!position)return;
    const inverse=object.matrixWorld.clone().invert();
    const delta=new Float32Array(position.count*3),normalDelta=new Float32Array(position.count*3);
    const deformed=geometry.clone();
    const deformedPosition=deformed.getAttribute('position');
    let changed=false;
    for(let i=0;i<position.count;i++){
      const base=new THREE.Vector3().fromBufferAttribute(position,i);
      const next=deform(base.clone().applyMatrix4(object.matrixWorld)).applyMatrix4(inverse);
      deformedPosition.setXYZ(i,next.x,next.y,next.z);
      next.sub(base);delta.set(next.toArray(),i*3);
      if(next.lengthSq()>1e-14)changed=true;
    }
    if(changed){
      deformed.computeVertexNormals();
      const normals=geometry.getAttribute('normal'),nextNormals=deformed.getAttribute('normal');
      for(let i=0;i<position.count;i++)for(let axis=0;axis<3;axis++)normalDelta[i*3+axis]=nextNormals.getComponent(i,axis)-normals.getComponent(i,axis);
      const morph=new THREE.Float32BufferAttribute(delta,3);morph.name='AvatarFace';
      geometry.morphTargetsRelative=true;
      geometry.morphAttributes.position=[morph];
      geometry.morphAttributes.normal=[new THREE.Float32BufferAttribute(normalDelta,3)];
      object.updateMorphTargets();object.morphTargetInfluences![0]=1;
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
    }
    deformed.dispose();
  });
}
