import * as THREE from 'three';
import {resolveFacial, type Appearance} from './avatar.ts';

const bump = (n: number, center: number, spread: number) => Math.exp(-(((n-center)/spread)**2));
export function createFaceSurface(a: Appearance) {
  const f=resolveFacial(a), width=a.face==='angular'?0.12:a.face==='arredondado'?0.134:0.127;
  const jaw=a.face==='angular'?0.84:a.face==='arredondado'?0.91:0.8;
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0.03),new THREE.Vector3(0.045*f.chinWidth,0.014,0.067),
    new THREE.Vector3(width*jaw*f.jawWidth,0.063,0.083),new THREE.Vector3(width*f.cheekWidth,0.155,0.103),
    new THREE.Vector3(width*0.94,0.225,0.10),new THREE.Vector3(width*0.88,0.29,0.091),
    new THREE.Vector3(width*0.62,0.333,0.06),new THREE.Vector3(0,0.352,0),
  ]);
  const samples=curve.getPoints(180);
  const section=(y: number)=>{
    const index=Math.max(0,samples.findIndex((p,i)=>i<samples.length-1&&samples[i+1].y>=y));
    const start=samples[index],end=samples[index+1];
    return start.clone().lerp(end,THREE.MathUtils.clamp((y-start.y)/(end.y-start.y),0,1));
  };
  const z=(x: number,y: number,back=false)=>{
    const p=section(y),front=Math.sqrt(Math.max(0,1-(x/Math.max(p.x,0.00001))**2));
    if(back)return -front*p.z;
    const noseY=0.17-(f.noseLength-1)*0.04;
    const bridge=0.022*bump(y,noseY+0.032,0.045)*bump(x,0,0.015*f.noseWidth);
    const tip=0.022*bump(y,noseY,0.016)*bump(x,0,0.018*f.noseWidth);
    const alae=0.008*bump(y,noseY-0.006,0.012)*bump(Math.abs(x),0.018*f.noseWidth,0.009);
    const sockets=-0.004*bump(y,0.217,0.018)*bump(Math.abs(x),0.051*f.eyeSpacing,0.026);
    const browRidge=0.004*bump(y,0.247,0.014)*bump(Math.abs(x),0.05,0.04);
    const cheeks=0.008*bump(y,0.172,0.03)*bump(Math.abs(x),0.077,0.028);
    const chin=0.009*bump(y,0.039,0.025)*bump(x,0,0.04*f.chinWidth);
    const mouth=0.008*bump(y,0.109,0.029)*bump(x,0,0.036*f.mouthWidth);
    const philtrum=-0.0018*bump(y,0.135,0.012)*bump(x,0,0.004);
    return Math.pow(front,0.67)*p.z+(bridge+tip+alae+sockets+browRidge+cheeks+chin+mouth+philtrum)*front;
  };
  return {section,z};
}

export function createFaceGeometry(a: Appearance,low=false) {
  const face=createFaceSurface(a),rows=low?64:96,columns=low?72:104;
  const positions: number[]=[],uvs: number[]=[],indices: number[]=[];
  for(let row=0;row<=rows;row++){
    const y=row/rows*0.352,p=face.section(y);
    for(let col=0;col<=columns;col++){
      const angle=col/columns*Math.PI*2,x=Math.sin(angle)*p.x;
      positions.push(x,y,face.z(x,y,Math.cos(angle)<0));uvs.push(col/columns,row/rows);
      if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+1,i+columns+1,i+1,i+columns+2,i+columns+1);}
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();
  const normals=g.getAttribute('normal');
  for(let row=0;row<=rows;row++){const first=row*(columns+1),last=first+columns;const n=new THREE.Vector3().fromBufferAttribute(normals,first).add(new THREE.Vector3().fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,n.x,n.y,n.z);normals.setXYZ(last,n.x,n.y,n.z);}
  return g;
}
