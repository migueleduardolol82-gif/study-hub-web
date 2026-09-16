import * as THREE from 'three';
const originalIndices=new WeakMap<THREE.Mesh,THREE.BufferAttribute|null>();

/** Reversible index masking. Original body positions and source asset are untouched. */
export function setClothingBodyMask(avatar:THREE.Group,top:boolean,bottom:boolean){
 avatar.updateMatrixWorld(true);const inverse=avatar.matrixWorld.clone().invert();
 avatar.traverse(object=>{
  if(object.userData.avatarPart==='underwear'||object.name==='Roger_Boxers')object.visible=!bottom;
  if(!(object instanceof THREE.SkinnedMesh))return;
  const materials=Array.isArray(object.material)?object.material:[object.material];
  if(!materials.some(material=>/Skin_(Body|Arm|Leg)/.test(material.name)))return;
  if(!originalIndices.has(object))originalIndices.set(object,object.geometry.index?.clone()??null);
  const original=originalIndices.get(object)!;
  if(!top&&!bottom){object.geometry.setIndex(original?.clone()??null);return;}
  const position=object.geometry.getAttribute('position'),matrix=inverse.clone().multiply(object.matrixWorld),point=new THREE.Vector3();
  const covered=Array.from({length:position.count},(_,i)=>{
   point.fromBufferAttribute(position,i).applyMatrix4(matrix);
   return (top&&point.y>.94&&point.y<1.475&&Math.abs(point.x)<.395)
    ||(bottom&&point.y>.055&&point.y<.965&&Math.abs(point.x)<.24);
  });
  const count=original?.count??position.count,indices:number[]=[];
  for(let i=0;i<count;i+=3){const a=original?.getX(i)??i,b=original?.getX(i+1)??i+1,c=original?.getX(i+2)??i+2;if(!(covered[a]&&covered[b]&&covered[c]))indices.push(a,b,c);}
  object.geometry.setIndex(indices);
 });
}
