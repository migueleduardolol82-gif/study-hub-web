import * as THREE from 'three';
import { resolveFacial, type Appearance } from './avatar.ts';
import { createFaceGeometry, createFaceSurface } from './avatar-face-surface.ts';
import { createHairGeometry, createScalpGeometry } from './avatar-hair.ts';
import { createSkinMaterial } from './avatar-materials.ts';
export { createFaceGeometry } from './avatar-face-surface.ts';
export { createHairGeometry } from './avatar-hair.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const bump = (n: number, center: number, spread: number) => Math.exp(-(((n - center) / spread) ** 2));

export function disposeAvatarObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => {Object.values(m).forEach(value => {if(value instanceof THREE.Texture)textures.add(value);});m.dispose();}); textures.forEach(t=>t.dispose());
}

export function createAvatarHead(a: Appearance, headColor?: string, low = false, headStyle:'band'|'crown'='band') {
  const f = resolveFacial(a), realism = a.realism ?? 0.75;
  const group = new THREE.Group();
  group.name = 'avatar-head'; group.position.y = 1.635;
  group.scale.set(f.faceWidth, f.faceHeight, 1);
  const skin = createSkinMaterial(a.skin);
  const shade = new THREE.MeshStandardMaterial({color: new THREE.Color(a.skin).multiplyScalar(0.78), roughness: 0.8});
  const lip = new THREE.MeshStandardMaterial({color: new THREE.Color(a.skin).lerp(new THREE.Color('#a45459'), 0.25), roughness: 0.8});
  const white = new THREE.MeshStandardMaterial({color: '#cdd0c8', roughness: 0.45});
  const iris = new THREE.MeshPhysicalMaterial({color: a.eyeColor ?? '#647d91', roughness: 0.3, clearcoat: 0.3});
  const hair = new THREE.MeshStandardMaterial({color: a.hairColor, roughness: 0.54, side: THREE.DoubleSide});
  iris.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 irisUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nirisUv = uv;');
    shader.fragmentShader = 'varying vec2 irisUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 eye = irisUv * 2.0 - 1.0;
      float radius = length(eye);
      float angle = atan(eye.y, eye.x);
      float fiber = sin(angle * 53.0 + radius * 18.0) * 0.13;
      diffuseColor.rgb *= 0.73 + fiber + 0.2 * sin(radius * 19.0);
      diffuseColor.rgb *= 1.0 - smoothstep(0.8, 1.0, radius) * 0.75;
      diffuseColor.rgb = mix(vec3(0.008), diffuseColor.rgb, smoothstep(0.34, 0.4, radius));`);
  };
  iris.customProgramCacheKey = () => 'inset-iris-v1';
  const time = {value: 0}, motion = {value: 0};
  hair.onBeforeCompile = shader => {
    shader.uniforms.hairTime = time; shader.uniforms.hairMotion = motion;
    shader.vertexShader = 'attribute float lockPhase; varying vec2 fiberUv; uniform float hairTime; uniform float hairMotion;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      fiberUv = uv;
      float sway = hairMotion * uv.y * uv.y * uv.y;
      transformed.x += sin(hairTime * 1.6 + lockPhase) * sway;
      transformed.z += cos(hairTime * 1.3 + lockPhase) * sway * 0.45;`);
    shader.fragmentShader = 'varying vec2 fiberUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float strand = sin(fiberUv.x * 160.0 + sin(fiberUv.y * 5.0) * 0.8);
      float broad = pow(max(0.0, sin(fiberUv.x * 3.14159)), 7.0);
      diffuseColor.rgb *= 0.93 + strand * 0.035 + broad * 0.07;`);
  };
  hair.customProgramCacheKey = () => 'avatar-fibers-v1';
  const browMaterial = new THREE.MeshStandardMaterial({color: a.hairColor, roughness: 0.82});
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh); return mesh;
  };
  const ellipsoid = (p: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material) => {
    const mesh = add(new THREE.SphereGeometry(1, low ? 16 : 24, 16), material);
    mesh.position.copy(p); mesh.scale.copy(scale); return mesh;
  };
  const stroke = (points: THREE.Vector3[], radius: number, material: THREE.Material) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), low ? 12 : 22, radius, 6, false), material);
  const surface = createFaceSurface(a);
  const face = add(createFaceGeometry(a, low), skin); face.name = 'face-surface';
  const faceWidth = a.face === 'arredondado' ? 0.134 : a.face === 'angular' ? 0.12 : 0.127;
  for (const side of [-1, 1]) {
    const ear = ellipsoid(v(side * (faceWidth + 0.006), 0.187, -0.008), v(0.022, 0.041, 0.018), skin);
    ear.rotation.z = side * -0.15;
    stroke([v(side * (faceWidth + 0.005), 0.163, 0.006), v(side * (faceWidth + 0.015), 0.178, 0.009), v(side * (faceWidth + 0.014), 0.21, 0.007), v(side * (faceWidth + 0.004), 0.216, 0.004)], 0.003, shade);
    const eyeX = side * 0.051 * f.eyeSpacing, eyeY = 0.217;
    const w = (0.029 - realism * 0.005) * f.eyeSize, h = (0.011 - realism * 0.003) * f.eyeSize;
    const seatedZ = (x: number,y: number) => surface.z(x,y) + 0.0006 + 0.0018 * Math.max(0,1-((x-eyeX)/w)**2-((y-eyeY)/h)**2);
    const patch = (rx: number,ry: number,offset: number,material: THREE.Material,name: string) => {
      const positions: number[]=[],uvs: number[]=[],indices: number[]=[];
      for(let row=0;row<=5;row++)for(let i=0;i<=40;i++){
        const theta=i/40*Math.PI*2,r=row/5;
        const dx=Math.cos(theta)*rx*r,dy=Math.sin(theta)*ry*r;
        const x=eyeX+dx,y=eyeY+dy+side*dx/w*0.0015;
        positions.push(x,y,seatedZ(x,y)+offset);uvs.push(0.5+Math.cos(theta)*r*0.5,0.5+Math.sin(theta)*r*0.5);
        if(row<5&&i<40){const j=row*41+i;indices.push(j,j+41,j+1,j+1,j+41,j+42);}
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();const mesh=add(g,material);mesh.name=name;
    };
    patch(w,h,0,white,`sclera-${side}`);
    patch(h*0.8,h*0.85,0.0004,iris,`iris-${side}`);
    const eyePoints: THREE.Vector3[]=[];
    for(let i=0;i<=40;i++){const angle=i/40*Math.PI*2,x=eyeX+Math.cos(angle)*w,y=eyeY+Math.sin(angle)*h+Math.cos(angle)*side*0.0015;eyePoints.push(v(x,y,surface.z(x,y)+0.0011));}
    stroke(eyePoints.slice(0,21),0.0014,skin);
    stroke(eyePoints.slice(20),0.0011,skin);
    stroke(eyePoints.slice(1,20).map(p=>v(p.x,p.y+0.0003,p.z+0.0007)),0.00045,browMaterial);
    stroke(eyePoints.slice(2,19).map(p=>v(p.x,p.y+0.004,surface.z(p.x,p.y+0.004)+0.0008)),0.00045,shade);
    const brows=[v(eyeX-side*0.023,0.245,0),v(eyeX,0.253,0),v(eyeX+side*0.027,0.247,0)].map(p=>v(p.x,p.y,surface.z(p.x,p.y)+0.0017));
    stroke(brows,0.0017*f.browThickness,browMaterial);
    const noseY=0.17-(f.noseLength-1)*0.04,noseX=side*0.014*f.noseWidth;
    ellipsoid(v(noseX,noseY-0.011,surface.z(noseX,noseY-0.011)+0.0002),v(0.002*f.noseWidth,0.001,0.0005),shade);
  }
  const mw = 0.032 * f.mouthWidth, fullness = f.lipFullness;
  for (const side of [-1, 1]) {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const x = i / 16 - 1, taper = Math.max(0, 1 - x * x);
      for (let row = 0; row <= 4; row++) {
        const t = row / 4;
        const cupid = side === 1 ? 0.65 + 0.35 * bump(Math.abs(x), 0.33, 0.23) : 1;
        const lipY=0.11+side*0.006*fullness*taper*t*cupid;
        positions.push(x*mw,lipY,surface.z(x*mw,lipY)+0.0004+taper*(0.002+0.0015*Math.sin(t*Math.PI))*(1-t));
        if (i < 32 && row < 4) {const j = i * 5 + row; if(side === 1) indices.push(j,j+5,j+1,j+1,j+5,j+6); else indices.push(j,j+1,j+5,j+1,j+6,j+5);}
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,lip);
  }
  stroke([-mw,0,mw].map(x=>v(x,0.11,surface.z(x,0.11)+0.0025*(1-(x/mw)**2)+0.0004)),0.0005,shade);
  const scalp = add(createScalpGeometry(a,low),new THREE.MeshStandardMaterial({color:a.hairColor,roughness:0.8}));scalp.name='hair-scalp';
  const hairMesh = add(createHairGeometry(a, low), hair); hairMesh.name = 'hair-ribbons'; hairMesh.frustumCulled = false;
  const beardStyle = a.beardStyle ?? (a.beard ? 'barba curta' : 'sem barba');
  if (a.beard && beardStyle !== 'sem barba') {
    // Short curved strokes follow the lower facial surface; one merged draw call.
    const strokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 80; i++) {
      const x = (i % 20 / 19 - 0.5) * (beardStyle === 'cavanhaque' ? 0.047 : 0.14);
      const y = 0.025 + Math.floor(i / 20) * 0.014 + Math.abs(x) * 0.28;
      const z = surface.z(x,y)+0.0008;
      strokes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(x, y + 0.01, z), v(x * 0.99, y, z + 0.001), v(x * 0.96, y - (beardStyle === 'barba marcada' ? 0.018 : 0.006), z)]), 3, 0.0009, 3));
    }
    const positions: number[] = [], indices: number[] = [];
    strokes.forEach(g => {const offset = positions.length / 3; positions.push(...g.getAttribute('position').array); if (g.index) indices.push(...Array.from(g.index.array, i => i + offset)); g.dispose();});
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); add(g, browMaterial);
  }
  if (headColor) {
    const band = add(new THREE.TorusGeometry(faceWidth * 1.04, 0.009, 8, 48), new THREE.MeshStandardMaterial({color: headColor, metalness: 0.35, roughness: 0.46}));
    band.rotation.x = Math.PI / 2; band.position.y = 0.317; band.scale.y = 0.85;
    if(headStyle==='crown'){
      const metal=new THREE.MeshPhysicalMaterial({color:headColor,metalness:.72,roughness:.22,clearcoat:.3});
      for(const side of [-1,0,1]){const point=add(new THREE.ConeGeometry(.015,.055,5),metal);point.position.set(side*.052,.345,.01);}
      const gem=add(new THREE.OctahedronGeometry(.018),new THREE.MeshPhysicalMaterial({color:'#bff5ff',metalness:.1,roughness:.12,transmission:.2}));gem.position.set(0,.335,.13);
    }
  }
  // All facial details, hair and head equipment inherit the same pivot transform.
  const update = (seconds: number, reduced: boolean) => {
    group.rotation.z = reduced ? 0 : Math.sin(seconds / 2.2) * 0.006;
    time.value = seconds; motion.value = reduced || a.hair === 'raspado' ? 0 : 0.001 * (a.hairLength ?? 1);
  };
  return {group, update};
}
