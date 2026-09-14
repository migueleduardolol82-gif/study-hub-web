import * as THREE from 'three';
import { avatarItems, type Appearance } from './avatar.ts';

const archetypeColors: Record<string, string> = {
  sage: '#9b7cff',
  athlete: '#55c8e8',
  entrepreneur: '#d1a85e',
  leader: '#e6c978',
  executor: '#70d7b0',
  strategist: '#7d9cff',
};

function mixedAccent(archetypes: string[] = []) {
  if (!archetypes.length) return new THREE.Color('#9e7cff');
  const weights = [0.5, 0.3, 0.2];
  const active = archetypes.slice(0, 3);
  const total = weights.slice(0, active.length).reduce((sum, value) => sum + value, 0);
  const color = new THREE.Color('#000000');
  active.forEach((id, index) => {
    color.add(new THREE.Color(archetypeColors[id] ?? '#9e7cff').multiplyScalar(weights[index] / total));
  });
  return color;
}


export function createAvatarBody(appearance: Appearance, equipped: Record<string,string>, archetypes: string[] = [], low = false) {
    const figure = new THREE.Group();
    const accent = mixedAccent(archetypes);
    const clothingItem = avatarItems.find((item) => item.id === equipped.tronco);
    const shoeItem = avatarItems.find((item) => item.id === equipped['calçados']);
    const auraItem = avatarItems.find((item) => item.id === equipped.aura);
    const rarity = clothingItem?.rarity ?? 'Comum';
    const premium = ['Épico', 'Lendário', 'Mítico', 'Transcendente'].includes(rarity);

    const skin = new THREE.MeshPhysicalMaterial({
      color: appearance.skin,
      roughness: 0.62,
      sheen: 0.18,
      sheenColor: new THREE.Color('#f4c7b8'),
    });
    const cloth = new THREE.MeshPhysicalMaterial({
      color: clothingItem?.color ?? '#364154',
      roughness: premium ? 0.44 : 0.67,
      metalness: premium ? 0.13 : 0.02,
      clearcoat: premium ? 0.22 : 0.04,
      sheen: 0.25,
      sheenColor: accent,
    });
    const clothDark = new THREE.MeshPhysicalMaterial({ color: '#171c2a', roughness: 0.76, sheen: 0.08 });
    const trim = new THREE.MeshPhysicalMaterial({
      color: accent,
      roughness: premium ? 0.28 : 0.46,
      metalness: premium ? 0.68 : 0.35,
      clearcoat: 0.45,
      emissive: accent.clone().multiplyScalar(premium ? 0.13 : 0.035),
    });
    const shoe = new THREE.MeshPhysicalMaterial({
      color: shoeItem?.color ?? '#121826',
      roughness: 0.45,
      clearcoat: 0.28,
    });


    const auraRings: THREE.Mesh[] = [];
    const add = <G extends THREE.BufferGeometry>(geometry: G, material: THREE.Material, parent: THREE.Object3D = figure) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);

      return mesh;
    };
    const sharedSphere = new THREE.SphereGeometry(1, low ? 16 : 32, low ? 12 : 24);
    const sphere = (
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
      material: THREE.Material,
      parent = figure,
    ) => {
      const mesh = add(sharedSphere, material, parent);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      return mesh;
    };
    const capsule = (
      x: number,
      y: number,
      z: number,
      radius: number,
      length: number,
      material: THREE.Material,
      rotationZ = 0,
    ) => {
      const mesh = add(new THREE.CapsuleGeometry(radius, length, low ? 4 : 8, low ? 12 : 20), material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      return mesh;
    };
    const lathe = (points: Array<[number, number]>, material: THREE.Material, y: number, depth = 0.7) => {
      const mesh = add(new THREE.LatheGeometry(points.map(([x, py]) => new THREE.Vector2(x, py)), low ? 28 : 48), material);
      mesh.position.y = y;
      mesh.scale.z = depth;
      return mesh;
    };

    const fat = THREE.MathUtils.clamp((appearance.fat - 12) / 53, 0, 1);
    const muscle = THREE.MathUtils.clamp(appearance.muscle / 100, 0, 1);
    const masculine = appearance.shape === 'masculino' ? 1 : appearance.shape === 'feminino' ? -0.75 : 0;
    const shoulder = 0.285 + muscle * 0.085 + Math.max(0, masculine) * 0.025;
    const waist = 0.205 + fat * 0.105 - muscle * 0.018;
    const hip = 0.23 + fat * 0.06 + Math.max(0, -masculine) * 0.035;

    // Corpo com silhueta adulta, transições anatômicas suaves e roupa em camadas.
    lathe(
      [
        [0.09, 0],
        [waist, 0.08],
        [waist + 0.012, 0.28],
        [shoulder, 0.52],
        [shoulder - 0.026, 0.62],
        [0.105, 0.68],
      ],
      cloth,
      0.89,
      0.69,
    );
    sphere(0, 0.9, -0.005, hip, 0.15, 0.16, clothDark);
    sphere(0, 1.31, 0.125, 0.19 + muscle * 0.035, 0.205, 0.045, cloth);

    for (const side of [-1, 1]) {
      capsule(side * 0.125, 0.565, 0, 0.09 + muscle * 0.018, 0.34, clothDark, side * -0.025);
      capsule(side * 0.13, 0.235, 0.014, 0.068 + muscle * 0.012, 0.23, clothDark, side * 0.012);
      const foot = sphere(side * 0.13, 0.065, 0.075, 0.098, 0.065, 0.19, shoe);
      foot.rotation.x = -0.05;
      sphere(side * 0.13, 0.068, 0.193, 0.075, 0.022, 0.045, trim);

      sphere(side * shoulder, 1.405, 0, 0.105 + muscle * 0.025, 0.12, 0.11, cloth);
      capsule(side * (shoulder + 0.045), 1.19, 0.005, 0.075 + muscle * 0.022, 0.25, cloth, side * 0.08);
      capsule(side * (shoulder + 0.077), 0.91, 0.032, 0.058 + muscle * 0.012, 0.215, skin, side * 0.025);
      sphere(side * (shoulder + 0.085), 0.735, 0.05, 0.052, 0.082, 0.045, skin);
      for (let finger = -1; finger <= 1; finger++) {
        capsule(side * (shoulder + 0.085 + finger * 0.008), 0.685, 0.065, 0.008, 0.04, skin);
      }

      const cuff = add(new THREE.TorusGeometry(0.062, 0.008, 10, 32), trim);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(side * (shoulder + 0.073), 0.805, 0.04);
    }

    // Gola, recortes e costuras dão leitura de traje RPG contemporâneo sem alterar os itens.
    const collar = add(new THREE.TorusGeometry(0.105, 0.018, 10, 42, Math.PI * 1.55), clothDark);
    collar.position.set(0, 1.57, 0.005);
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = Math.PI * 0.22;
    const zipper = add(new THREE.BoxGeometry(0.008, 0.47, 0.012), trim);
    zipper.position.set(0, 1.24, 0.182);
    const chestPanel = add(new THREE.RingGeometry(0.07, 0.092, 5), trim);
    chestPanel.position.set(0.128, 1.42, 0.182);
    chestPanel.rotation.z = Math.PI / 10;
    for (const side of [-1, 1]) {
      const seam = add(new THREE.TorusGeometry(0.18, 0.004, 8, 32, Math.PI * 0.58), trim);
      seam.position.set(side * 0.082, 1.31, 0.173);
      seam.rotation.z = side * 0.77;
    }


    capsule(0, 1.61, 0, 0.072, 0.1, skin);
    const wrist = avatarItems.find((item) => item.id === equipped['mão']);
    if (wrist) {
      const watch = sphere(-shoulder - 0.075, 0.81, 0.075, 0.035, 0.04, 0.015, trim);
      watch.rotation.z = -0.05;
    }
    const badge = avatarItems.find((item) => item.id === equipped['insígnia']);
    if (badge) {
      const insignia = add(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 7), trim);
      insignia.rotation.x = Math.PI / 2;
      insignia.position.set(0.145, 1.44, 0.194);
    }

    const platform = add(
      new THREE.CylinderGeometry(0.73, 0.79, 0.075, 64),
      new THREE.MeshPhysicalMaterial({ color: '#171c2a', roughness: 0.32, metalness: 0.55 }),
      figure,
    );
    platform.position.y = -0.055;
    const platformRim = add(new THREE.TorusGeometry(0.74, 0.012, 10, 80), trim, figure);
    platformRim.rotation.x = Math.PI / 2;
    platformRim.position.y = -0.012;

    if (auraItem) {
      for (let index = 0; index < 3; index++) {
        const ring = add(
          new THREE.TorusGeometry(0.68 + index * 0.1, 0.009 - index * 0.0015, 10, 96),
          new THREE.MeshBasicMaterial({ color: auraItem.color, transparent: true, opacity: 0.42 - index * 0.08 }),
          figure,
        );
        ring.position.set(0, 1.03 + index * 0.13, -0.34);
        ring.rotation.set(Math.PI / 2.3, index * 0.36, 0);
        auraRings.push(ring);
      }
    }


 return {group: figure, auraRings};
}
