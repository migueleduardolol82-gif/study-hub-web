import * as THREE from 'three';

/** Small deterministic material textures; no photos, network requests or per-frame allocations. */
function microTexture(fabric: boolean) {
  const size = 128, data = new Uint8Array(size * size * 4);
  let seed = 7391;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    const grain = (seed & 255) / 255;
    const weave = fabric ? (Math.sin(x * Math.PI / 2) + Math.cos(y * Math.PI / 2)) * 12 : 0;
    const value = Math.round(199 + grain * (fabric ? 12 : 24) + weave);
    const i = (y * size + x) * 4; data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255;
  }
  const texture = new THREE.DataTexture(data,size,size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(fabric ? 10 : 5,fabric ? 10 : 4);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function createSkinMaterial(color: string) {
  const detail = microTexture(false);
  return new THREE.MeshPhysicalMaterial({color,roughness:0.86,roughnessMap:detail,bumpMap:detail,bumpScale:0.00018,sheen:0.04,specularIntensity:0.3});
}

export function createFabricMaterial(color: string) {
  const detail = microTexture(true);
  return new THREE.MeshStandardMaterial({color,roughness:1,roughnessMap:detail,bumpMap:detail,bumpScale:0.0003});
}
