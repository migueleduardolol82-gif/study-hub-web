import * as THREE from 'three';
import type { Physique } from './avatar-physique.ts';

const gaussian = (n: number, center: number, spread: number) => Math.exp(-(((n - center) / spread) ** 2));
type Ring = {x: number; y: number; z: number};

/** Indexed surface with smooth circumferential normals, shared by skin and fitted garments. */
function surface(sample: (t: number, angle: number) => Ring, rows: number, columns: number, start = 0, end = 1, caps = false) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = THREE.MathUtils.lerp(start, end, row / rows);
    for (let col = 0; col <= columns; col++) {
      const p = sample(t, col / columns * Math.PI * 2);
      positions.push(p.x, p.y, p.z);
      uvs.push(col / columns, row / rows);
      if (row < rows && col < columns) {
        const i = row * (columns + 1) + col;
        // Samples run bottom-to-top for torso; limb callers also use ascending height.
        indices.push(i, i + 1, i + columns + 1, i + 1, i + columns + 2, i + columns + 1);
      }
    }
  }
  if (caps) {
    for (const row of [0, rows]) {
      const center = new THREE.Vector3();
      for (let col = 0; col < columns; col++) center.add(new THREE.Vector3().fromArray(positions, (row * (columns + 1) + col) * 3));
      center.divideScalar(columns);
      const index = positions.length / 3; positions.push(center.x, center.y, center.z);uvs.push(0.5,0.5);
      for (let col = 0; col < columns; col++) {
        const i = row * (columns + 1) + col;
        if (row === 0) indices.push(index, i + 1, i); else indices.push(index, i, i + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let row = 0; row <= rows; row++) {
    const first = row * (columns + 1), last = first + columns;
    const n = new THREE.Vector3().fromBufferAttribute(normals, first).add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, n.x, n.y, n.z); normals.setXYZ(last, n.x, n.y, n.z);
  }
  return geometry;
}

function interpolate(y: number, profile: number[][], column: number) {
  const i = Math.max(0, profile.findIndex((p, n) => n < profile.length - 1 && y <= profile[n + 1][0]));
  const a = profile[i], b = profile[i + 1];
  const t = THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1);
  const previous=profile[Math.max(0,i-1)], next=profile[Math.min(profile.length-1,i+2)];
  const m0=(b[column]-previous[column])/(b[0]-previous[0])*(b[0]-a[0]);
  const m1=(next[column]-a[column])/(next[0]-a[0])*(b[0]-a[0]);
  return (2*t**3-3*t*t+1)*a[column]+(t**3-2*t*t+t)*m0+(-2*t**3+3*t*t)*b[column]+(t**3-t*t)*m1;
}

export function torsoPoint(p: Physique, y: number, angle: number, garment = false): Ring {
  const profile = [
    [0.86, p.hip * 0.91, 0.116 + p.softness * 0.04],
    [0.99, p.waist + 0.018, 0.12 + p.softness * 0.053],
    [1.12, p.waist, 0.113 + p.softness * 0.046],
    [1.28, p.chest * 0.86, 0.126 + p.volume * 0.014],
    [1.41, p.chest, 0.137 + p.volume * 0.026],
    [1.48, p.shoulder * 0.86, 0.116 + p.volume * 0.015],
    [1.56, 0.075, 0.068],
  ];
  const sx = Math.sin(angle), cz = Math.cos(angle);
  const x = sx * interpolate(y, profile, 1);
  let depth = interpolate(y, profile, 2);
  const detail = p.definition * (garment ? 0.23 : 1);
  if (cz > 0) {
    // Paired pectorals, abdominal bellies and obliques are deformations of one surface.
    const pec = 0.026 * gaussian(Math.abs(x), 0.103, 0.066) * gaussian(y, 1.402, 0.041);
    const pecFold = -0.005 * gaussian(Math.abs(x), 0.105, 0.07) * gaussian(y, 1.346, 0.012);
    let abs = 0;
    for (const center of [1.286, 1.222, 1.158]) abs += 0.015 * gaussian(Math.abs(x), 0.043, 0.034) * gaussian(y, center, 0.025);
    const midline = -0.004 * gaussian(x, 0, 0.01) * gaussian(y, 1.26, 0.13);
    const obliques = 0.012 * gaussian(Math.abs(x), 0.139 + (y - 1.14) * 0.1, 0.028) * gaussian(y, 1.19, 0.11);
    const clavicle = 0.01 * gaussian(y, 1.488 - Math.abs(x) * 0.12, 0.01) * gaussian(Math.abs(x), 0.11, 0.09);
    depth += detail * (pec + pecFold + abs + midline + obliques + clavicle);
  } else {
    const lats = 0.019 * gaussian(Math.abs(x), 0.15, 0.07) * gaussian(y, 1.34, 0.12);
    const scapula = 0.012 * gaussian(Math.abs(x), 0.088, 0.042) * gaussian(y, 1.435, 0.051);
    const spine = -0.005 * gaussian(x, 0, 0.018) * gaussian(y, 1.31, 0.18);
    depth += detail * (lats + scapula + spine);
  }
  const clearance = garment ? 0.027 : 0;
  return {x:x + sx * clearance, y, z:Math.sign(cz) * Math.pow(Math.abs(cz), 0.72) * depth + cz * clearance};
}

export function createTorsoGeometry(p: Physique, low = false, garment = false) {
  return surface((t, a) => torsoPoint(p, THREE.MathUtils.lerp(garment ? 0.935 : 0.86, 1.56, t), a, garment), low ? 42 : 68, low ? 36 : 56);
}

type Limb = 'arm' | 'leg';
export function limbPoint(p: Physique, limb: Limb, side: number, t: number, angle: number, garment = false): Ring {
  const arm = limb === 'arm';
  const y = arm ? THREE.MathUtils.lerp(0.875, 1.49, t) : THREE.MathUtils.lerp(0.11, 0.945, t);
  const profile = arm ? [
    [0,0.031,0.032], [0.19,0.043 + p.volume * 0.014,0.039 + p.volume * 0.013],
    [0.40,0.043,0.041], [0.65,0.059 + p.volume * 0.031,0.056 + p.volume * 0.03],
    [0.84,0.069 + p.volume * 0.033,0.065 + p.volume * 0.025], [1,0.055,0.059],
  ] : [
    [0,0.035,0.038], [0.24,0.049 + p.volume * 0.017,0.048 + p.volume * 0.022],
    [0.44,0.048,0.051], [0.7,0.071 + p.volume * 0.032 + p.softness * 0.019,0.08 + p.volume * 0.024],
    [1,0.079 + p.volume * 0.024 + p.softness * 0.019,0.088 + p.volume * 0.021],
  ];
  const rx = interpolate(t, profile, 1), rz = interpolate(t, profile, 2);
  const centerX = arm ? side * (p.shoulder + 0.075 - 0.18 * Math.pow(t, 4)) : side * (0.126 - 0.015 * t);
  const centerZ = arm ? 0.035 * (1 - t) : 0.012 * (1 - t);
  const front = Math.cos(angle), sx = Math.sin(angle);
  const definition = p.definition * (garment ? 0.2 : 1);
  const muscle = arm
    ? 0.011 * gaussian(t, front > 0 ? 0.66 : 0.72, 0.115) + 0.006 * gaussian(t, 0.23, 0.13)
    : 0.014 * gaussian(t, front > 0 ? 0.74 : 0.24, front > 0 ? 0.16 : 0.12) + (front > 0 ? 0.005 * gaussian(t,0.44,0.05) : 0);
  const clearance = garment ? 0.019 : 0;
  return {x:centerX + sx * (rx + clearance), y, z:centerZ + front * (rz + definition * muscle + clearance)};
}

export function createLimbGeometry(p: Physique, limb: Limb, side: number, low = false, garment = false, shorts = false) {
  return surface((t,a) => limbPoint(p,limb,side,t,a,garment), low ? 32 : 52, low ? 24 : 36, garment ? (limb === 'arm' ? 0.5 : shorts ? 0.72 : 0) : 0, 1, !garment);
}

export function createHipGarment(p: Physique, low = false) {
  return surface((t,a) => {
    const y = THREE.MathUtils.lerp(0.855,0.965,t);
    const r = THREE.MathUtils.lerp(p.hip + 0.012, p.waist + 0.029, t);
    return {x:Math.sin(a)*r,y,z:Math.cos(a)*(0.138+p.softness*0.04)};
  }, 10, low ? 28 : 48);
}
