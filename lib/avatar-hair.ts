import * as THREE from 'three';
import type {Appearance} from './avatar.ts';

function scalpPoint(a: Appearance,theta: number,polar: number,lift=0) {
  const rx=a.face==='arredondado'?0.139:a.face==='angular'?0.127:0.133;
  return new THREE.Vector3(Math.sin(theta)*(rx+lift)*Math.sin(polar),0.254+(0.106+lift)*Math.cos(polar),Math.cos(theta)*(0.11+lift)*Math.sin(polar)-0.006);
}

/** A fixed scalp closes the roots: no disconnected clumps above the skull. */
export function createScalpGeometry(a: Appearance,low=false) {
  const positions: number[]=[],uvs: number[]=[],indices: number[]=[],rows=low?16:24,columns=low?40:64;
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const theta=col/columns*Math.PI*2,front=Math.cos(theta);
    const edge=front>0?1.04+0.84*(1-front):1.88+0.22*(-front);
    const point=scalpPoint(a,theta,edge*row/rows);
    positions.push(...point.toArray());uvs.push(col/columns,row/rows);
    if(row<rows&&col<columns){const i=row*(columns+1)+col;indices.push(i,i+columns+1,i+1,i+1,i+columns+1,i+columns+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function createHairGeometry(a: Appearance,low=false) {
  const style=a.hair==='curto'?'moderno':a.hair,length=a.hairLength??1;
  const positions: number[]=[],uvs: number[]=[],phases: number[]=[],indices: number[]=[];
  const layers=style==='raspado'?1:3,count=low?28:38,segments=low?12:18,across=2;
  for(let layer=0;layer<layers;layer++)for(let lock=0;lock<count;lock++){
    const theta=(lock+layer*0.38)/count*Math.PI*2,front=Math.cos(theta),fringe=front>0.35;
    const rootPolar=0.11+layer*0.14;
    const endPolar=fringe?1.32+(length-1)*0.28+0.08*Math.sin(lock*1.8):2.04+(length-1)*0.16;
    const longDrop=!fringe&&(style==='longo'||style==='ondulado')?(style==='longo'?0.22:0.044)*length:0;
    const wave=style==='ondulado'?0.006:style==='bagunçado'?0.003:0.0006;
    const base=positions.length/3;
    for(let step=0;step<=segments;step++){
      const t=step/segments,polar=THREE.MathUtils.lerp(rootPolar,endPolar,t);
      const sweep=(style==='social'?0.43:style==='moderno'?0.29:0.08)*Math.sin(t*Math.PI*0.8);
      const angle=theta+(fringe?sweep:0);
      // Roots lie on the scalp. Only the length after the crown gains volume or movement.
      const lift=(0.0015+layer*0.002+(style==='heroico'?0.014:0))*Math.sin(t*Math.PI);
      const point=scalpPoint(a,angle,polar,lift);
      const falling=THREE.MathUtils.smoothstep(t,0.55,1);
      point.y-=longDrop*falling;
      point.x+=Math.sin(t*9+theta)*wave*t*t;
      const tangent=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
      const width=(style==='raspado'?0.011:0.012)*Math.pow(1-t,0.65)*Math.sin(Math.min(1,polar)*Math.PI/2);
      for(let c=0;c<=across;c++){
        const u=c/across,edge=u*2-1;
        const pos=point.clone().addScaledVector(tangent,edge*width);
        const ridge=(1-edge*edge)*0.0007*Math.sin(Math.PI*t);
        pos.x+=Math.sin(angle)*ridge;pos.z+=Math.cos(angle)*ridge;
        positions.push(...pos.toArray());uvs.push(u,t);phases.push(theta+layer*1.4);
        if(step<segments&&c<across){const i=base+step*(across+1)+c;indices.push(i,i+across+1,i+1,i+1,i+across+1,i+across+2);}
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('lockPhase',new THREE.Float32BufferAttribute(phases,1));g.setIndex(indices);g.computeVertexNormals();return g;
}
