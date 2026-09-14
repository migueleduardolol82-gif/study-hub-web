import * as THREE from 'three';
import { resolveFacial, type Appearance } from './avatar.ts';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const bump = (n: number, center: number, spread: number) => Math.exp(-(((n - center) / spread) ** 2));

/** Smooth, closed head surface with a front-specific jaw, cheeks, sockets and nasal bridge. */
export function createFaceGeometry(a: Appearance, low = false) {
  const f = resolveFacial(a);
  const width = a.face === 'angular' ? 0.12 : a.face === 'arredondado' ? 0.134 : 0.127;
  const jaw = a.face === 'angular' ? 0.84 : a.face === 'arredondado' ? 0.91 : 0.8;
  const profile = new THREE.CatmullRomCurve3([
    v(0, 0, 0.015), v(0.044 * f.chinWidth, 0.012, 0.066),
    v(width * jaw * f.jawWidth, 0.06, 0.082), v(width * f.cheekWidth, 0.151, 0.102),
    v(width * 0.96, 0.225, 0.101), v(width * 0.9, 0.287, 0.094),
    v(width * 0.64, 0.33, 0.066), v(0, 0.352, 0),
  ]);
  const rows = low ? 48 : 72, columns = low ? 64 : 96;
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const p = profile.getPoint(row / rows);
    for (let col = 0; col <= columns; col++) {
      const angle = col / columns * Math.PI * 2;
      const x = Math.sin(angle) * Math.max(0, p.x), front = Math.cos(angle);
      let z = Math.sign(front) * Math.pow(Math.abs(front), front > 0 ? 0.55 : 1) * p.z;
      if (front > 0) {
        const noseY = 0.169 - (f.noseLength - 1) * 0.04;
        const bridge = 0.018 * bump(p.y, noseY + 0.032, 0.043) * bump(x, 0, 0.016 * f.noseWidth);
        const tip = 0.026 * bump(p.y, noseY, 0.021) * bump(x, 0, 0.019 * f.noseWidth);
        const alae = 0.008 * bump(p.y, noseY - 0.004, 0.014) * bump(Math.abs(x), 0.018 * f.noseWidth, 0.01);
        const sockets = -0.007 * bump(p.y, 0.219, 0.019) * bump(Math.abs(x), 0.051 * f.eyeSpacing, 0.031);
        const cheeks = 0.006 * bump(p.y, 0.162, 0.028) * bump(Math.abs(x), 0.074, 0.028);
        const chin = 0.016 * bump(p.y, 0.033, 0.023) * bump(x, 0, 0.04 * f.chinWidth);
        const muzzle = 0.016 * bump(p.y, 0.106, 0.023) * bump(x, 0, 0.037 * f.mouthWidth);
        z += (bridge + tip + alae + sockets + cheeks + chin + muzzle) * front;
      }
      positions.push(x, p.y, z);
      if (row < rows && col < columns) {
        const i = row * (columns + 1) + col;
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // The UV seam duplicates vertices; average its normals to avoid a line down the face.
  const normals = geometry.getAttribute('normal');
  for (let row = 0; row <= rows; row++) {
    const first = row * (columns + 1), last = first + columns;
    const normal = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

/** One indexed ribbon mesh: curved layers with tapered ends and longitudinal fiber shading. */
export function createHairGeometry(a: Appearance, low = false) {
  const style = a.hair === 'curto' ? 'moderno' : a.hair;
  const length = a.hairLength ?? 1;
  const positions: number[] = [], uvs: number[] = [], phases: number[] = [], indices: number[] = [];
  const layers = style === 'raspado' ? 1 : 3;
  const count = low ? 22 : 30, segments = low ? 10 : 16, across = 4;
  const width = a.face === 'arredondado' ? 0.143 : 0.136;
  for (let layer = 0; layer < layers; layer++) {
    for (let lock = 0; lock < count; lock++) {
      const theta = (lock + layer * 0.37) / count * Math.PI * 2;
      const front = Math.cos(theta), side = Math.sin(theta);
      const fringe = front > 0.35;
      const wave = style === 'ondulado' ? 0.012 : style === 'bagunçado' ? 0.007 : 0.002;
      const sweep = style === 'social' ? 0.056 : style === 'moderno' ? 0.042 : 0.008;
      const lift = style === 'heroico' ? 0.025 + 0.018 * Math.sin(lock * 2.3) : 0;
      let endY = fringe ? 0.248 + 0.034 * Math.abs(side) : 0.17;
      endY -= (length - 1) * (fringe ? 0.045 : 0.14);
      if (style === 'longo' && !fringe) endY -= 0.22 * length;
      if (style === 'ondulado' && !fringe) endY -= 0.06 * length;
      endY += layer * 0.012 + Math.sin(lock * 3.7) * 0.009;
      const root = v(side * 0.018, 0.35 + layer * 0.004, front * 0.02 - 0.012);
      const path = new THREE.CubicBezierCurve3(root,
        v(side * width * 0.85 + sweep * 0.3, 0.418 + layer * 0.009 + lift + Math.sin(theta * 1.2) * 0.016, front * 0.103),
        v(side * width * 1.14 + sweep, 0.318 + lift, front * 0.142),
        v(side * width * (fringe ? 0.83 : 1.04) + (fringe ? sweep : 0), endY, front * (fringe ? 0.116 : 0.099) - 0.009));
      const base = positions.length / 3;
      for (let step = 0; step <= segments; step++) {
        const t = step / segments;
        let p = path.getPoint(t);
        if (style === 'raspado') {
          const polar = t * (fringe ? 1.12 : 1.9);
          p = v(side * width * Math.sin(polar), 0.265 + 0.091 * Math.cos(polar), front * 0.103 * Math.sin(polar));
        }
        p.x += Math.sin(t * Math.PI * 3 + theta) * wave * t;
        const normal = v(side, 0.35 * (1 - t), front).normalize();
        const lateral = v(front, 0, -side);
        const halfWidth = (style === 'raspado' ? 0.020 : 0.022 + layer * 0.001) * (0.65 + 0.35 * Math.sin(t * Math.PI)) * Math.pow(Math.max(0.006, 1 - t), 0.45);
        for (let column = 0; column <= across; column++) {
          const u = column / across, edge = u * 2 - 1;
          const pos = p.clone().addScaledVector(lateral, edge * halfWidth).addScaledVector(normal, 0.003 * (1 - edge * edge));
          positions.push(pos.x, pos.y, pos.z);
          uvs.push(u, t); phases.push(theta + layer * 1.7);
          if (step < segments && column < across) {
            const i = base + step * (across + 1) + column;
            indices.push(i, i + across + 1, i + 1, i + 1, i + across + 1, i + across + 2);
          }
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('lockPhase', new THREE.Float32BufferAttribute(phases, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function disposeAvatarObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
  });
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
}

export function createAvatarHead(a: Appearance, headColor?: string, low = false) {
  const f = resolveFacial(a), realism = a.realism ?? 0.3;
  const group = new THREE.Group();
  group.name = 'avatar-head'; group.position.y = 1.635;
  group.scale.set(f.faceWidth, f.faceHeight, 1);
  const skin = new THREE.MeshPhysicalMaterial({color: a.skin, roughness: 0.7, sheen: 0.12});
  const shade = new THREE.MeshStandardMaterial({color: new THREE.Color(a.skin).multiplyScalar(0.78), roughness: 0.8});
  const lip = new THREE.MeshStandardMaterial({color: new THREE.Color(a.skin).lerp(new THREE.Color('#a45459'), 0.25), roughness: 0.8});
  const dark = new THREE.MeshStandardMaterial({color: '#1a141a', roughness: 0.72});
  const white = new THREE.MeshStandardMaterial({color: '#e6e3de', roughness: 0.45});
  const iris = new THREE.MeshPhysicalMaterial({color: a.eyeColor ?? '#647d91', roughness: 0.3, clearcoat: 0.3});
  const hair = new THREE.MeshStandardMaterial({color: a.hairColor, roughness: 0.54, side: THREE.DoubleSide});
  const time = {value: 0}, motion = {value: 0};
  hair.onBeforeCompile = shader => {
    shader.uniforms.hairTime = time; shader.uniforms.hairMotion = motion;
    shader.vertexShader = 'attribute float lockPhase; varying vec2 fiberUv; uniform float hairTime; uniform float hairMotion;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      fiberUv = uv;
      float sway = hairMotion * uv.y * uv.y;
      transformed.x += sin(hairTime * 1.6 + lockPhase) * sway;
      transformed.z += cos(hairTime * 1.3 + lockPhase) * sway * 0.45;`);
    shader.fragmentShader = 'varying vec2 fiberUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float strand = sin(fiberUv.x * 160.0 + sin(fiberUv.y * 5.0) * 0.8);
      float broad = pow(max(0.0, sin(fiberUv.x * 3.14159)), 7.0);
      diffuseColor.rgb *= 0.86 + strand * 0.07 + broad * 0.2;`);
  };
  hair.customProgramCacheKey = () => 'avatar-fibers-v1';
  const browMaterial = new THREE.MeshStandardMaterial({color: a.hairColor, roughness: 0.82});
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, material); group.add(mesh); return mesh;
  };
  const ellipsoid = (p: THREE.Vector3, scale: THREE.Vector3, material: THREE.Material) => {
    const mesh = add(new THREE.SphereGeometry(1, low ? 16 : 24, 16), material);
    mesh.position.copy(p); mesh.scale.copy(scale); return mesh;
  };
  const stroke = (points: THREE.Vector3[], radius: number, material: THREE.Material) =>
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), low ? 12 : 22, radius, 6, false), material);
  const face = add(createFaceGeometry(a, low), skin); face.name = 'face-surface';
  const faceWidth = a.face === 'arredondado' ? 0.134 : a.face === 'angular' ? 0.12 : 0.127;
  for (const side of [-1, 1]) {
    const ear = ellipsoid(v(side * (faceWidth + 0.006), 0.187, -0.008), v(0.022, 0.041, 0.018), skin);
    ear.rotation.z = side * -0.15;
    stroke([v(side * (faceWidth + 0.005), 0.163, 0.006), v(side * (faceWidth + 0.015), 0.178, 0.009), v(side * (faceWidth + 0.014), 0.21, 0.007), v(side * (faceWidth + 0.004), 0.216, 0.004)], 0.003, shade);
    const eyeX = side * 0.051 * f.eyeSpacing, eyeY = 0.217;
    const w = 0.029 * f.eyeSize * (1.08 - realism * 0.15), h = 0.0128 * f.eyeSize * (1.1 - realism * 0.23);
    const eyePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = i / 32 * Math.PI * 2;
      eyePoints.push(v(eyeX + Math.cos(angle) * w, eyeY + Math.sin(angle) * h + Math.cos(angle) * side * 0.003, 0.105 - Math.abs(Math.cos(angle)) * 0.007));
    }
    const positions = [eyeX, eyeY, 0.108], indices: number[] = [];
    eyePoints.forEach(p => positions.push(...p.toArray()));
    for (let i = 1; i <= 32; i++) indices.push(0, i, i + 1);
    const eyeGeometry = new THREE.BufferGeometry();
    eyeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); eyeGeometry.setIndex(indices); eyeGeometry.computeVertexNormals();
    add(eyeGeometry, white);
    ellipsoid(v(eyeX, eyeY, 0.109), v(h * 0.83, h * 0.95, 0.0025), iris);
    ellipsoid(v(eyeX, eyeY, 0.112), v(h * 0.39, h * 0.61, 0.001), dark);
    ellipsoid(v(eyeX - 0.0025, eyeY + 0.004, 0.114), v(0.0016, 0.002, 0.0008), white);
    stroke(eyePoints.slice(0, 17), 0.0018, browMaterial);
    stroke(eyePoints.slice(16), 0.0021, skin);
    stroke(eyePoints.slice(1, 16).map(p => p.clone().add(v(0, 0.004, -0.002))), 0.0012, shade);
    stroke([v(eyeX - side * 0.025, 0.247, 0.097), v(eyeX, 0.256, 0.1), v(eyeX + side * 0.028, 0.251, 0.091)], 0.0032 * f.browThickness, browMaterial);
    const noseY = 0.169 - (f.noseLength - 1) * 0.04;
    ellipsoid(v(side * 0.013 * f.noseWidth, noseY - 0.012, 0.12), v(0.0027 * f.noseWidth, 0.0013, 0.0015), shade);
  }
  const mw = 0.032 * f.mouthWidth, fullness = f.lipFullness;
  for (const side of [-1, 1]) {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const x = i / 16 - 1, taper = Math.max(0, 1 - x * x);
      for (let row = 0; row <= 4; row++) {
        const t = row / 4;
        const cupid = side === 1 ? 0.65 + 0.35 * bump(Math.abs(x), 0.33, 0.23) : 1;
        positions.push(x * mw, 0.11 + side * 0.006 * fullness * taper * t * cupid, 0.106 + taper * (0.008 + 0.002 * Math.sin(t * Math.PI) - 0.005 * t));
        if (i < 32 && row < 4) {const j = i * 5 + row; if(side === 1) indices.push(j,j+5,j+1,j+1,j+5,j+6); else indices.push(j,j+1,j+5,j+1,j+6,j+5);}
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();add(g,lip);
  }
  stroke([v(-mw, 0.11, 0.107), v(0, 0.11, 0.1145), v(mw, 0.11, 0.107)], 0.0006, shade);
  const hairMesh = add(createHairGeometry(a, low), hair); hairMesh.name = 'hair-ribbons'; hairMesh.frustumCulled = false;
  const beardStyle = a.beardStyle ?? (a.beard ? 'barba curta' : 'sem barba');
  if (a.beard && beardStyle !== 'sem barba') {
    // Short curved strokes follow the lower facial surface; one merged draw call.
    const strokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 80; i++) {
      const x = (i % 20 / 19 - 0.5) * (beardStyle === 'cavanhaque' ? 0.047 : 0.14);
      const y = 0.025 + Math.floor(i / 20) * 0.014 + Math.abs(x) * 0.28;
      const z = 0.082 + bump(y, 0.065, 0.04) * 0.012 - Math.abs(x) * 0.13;
      strokes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v(x, y + 0.01, z), v(x * 0.99, y, z + 0.001), v(x * 0.96, y - (beardStyle === 'barba marcada' ? 0.018 : 0.006), z)]), 3, 0.0009, 3));
    }
    const positions: number[] = [], indices: number[] = [];
    strokes.forEach(g => {const offset = positions.length / 3; positions.push(...g.getAttribute('position').array); if (g.index) indices.push(...Array.from(g.index.array, i => i + offset)); g.dispose();});
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(indices); g.computeVertexNormals(); add(g, browMaterial);
  }
  if (headColor) {
    const band = add(new THREE.TorusGeometry(faceWidth * 1.04, 0.009, 8, 48), new THREE.MeshStandardMaterial({color: headColor, metalness: 0.35, roughness: 0.46}));
    band.rotation.x = Math.PI / 2; band.position.y = 0.317; band.scale.y = 0.85;
  }
  // All facial details, hair and head equipment inherit the same pivot transform.
  const update = (seconds: number, reduced: boolean) => {
    group.rotation.z = reduced ? 0 : Math.sin(seconds / 2.2) * 0.006;
    time.value = seconds; motion.value = reduced || a.hair === 'raspado' ? 0 : 0.0025 * (a.hairLength ?? 1);
  };
  return {group, update};
}
