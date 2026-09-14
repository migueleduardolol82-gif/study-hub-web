'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { avatarItems, type Appearance } from '@/lib/avatar';

type Focus = 'corpo' | 'rosto';
type Props = {
  appearance: Appearance;
  equipped: Record<string, string>;
  archetypes?: string[];
  focus?: Focus;
};

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

export default function AvatarScene({ appearance, equipped, archetypes, focus = 'corpo' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const rotation = useRef(0.18);
  const zoom = useRef(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setTimeout(() => setError(true), 0);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#111421', 0.055);
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    const figure = new THREE.Group();
    figure.rotation.y = rotation.current;
    figure.scale.setScalar(appearance.height / 175);
    scene.add(figure);

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
    const skinShade = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.skin).multiplyScalar(0.78),
      roughness: 0.72,
    });
    const hair = new THREE.MeshPhysicalMaterial({
      color: appearance.hairColor,
      roughness: 0.43,
      clearcoat: 0.18,
      clearcoatRoughness: 0.38,
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
    const eyeWhite = new THREE.MeshPhysicalMaterial({ color: '#f3f5ff', roughness: 0.28, clearcoat: 0.28 });
    const iris = new THREE.MeshPhysicalMaterial({
      color: appearance.eyeColor ?? '#647d91',
      roughness: 0.15,
      clearcoat: 0.75,
      emissive: new THREE.Color(appearance.eyeColor ?? '#647d91').multiplyScalar(0.08),
    });
    const black = new THREE.MeshStandardMaterial({ color: '#080b12', roughness: 0.36 });
    const lip = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(appearance.skin).lerp(new THREE.Color('#8a3f4b'), 0.34),
      roughness: 0.5,
    });
    const shoe = new THREE.MeshPhysicalMaterial({
      color: shoeItem?.color ?? '#121826',
      roughness: 0.45,
      clearcoat: 0.28,
    });

    const meshes: THREE.Mesh[] = [];
    const auraRings: THREE.Mesh[] = [];
    const add = <G extends THREE.BufferGeometry>(geometry: G, material: THREE.Material, parent: THREE.Object3D = figure) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      meshes.push(mesh);
      return mesh;
    };
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
      const mesh = add(new THREE.SphereGeometry(1, 32, 24), material, parent);
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
      const mesh = add(new THREE.CapsuleGeometry(radius, length, 8, 20), material);
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotationZ;
      return mesh;
    };
    const lathe = (points: Array<[number, number]>, material: THREE.Material, y: number, depth = 0.7) => {
      const mesh = add(new THREE.LatheGeometry(points.map(([x, py]) => new THREE.Vector2(x, py)), 48), material);
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

    // Pescoço e rosto anime adulto: mandíbula marcada, olhos em camadas e expressão serena.
    capsule(0, 1.61, 0, 0.072, 0.1, skin);
    const faceWidth = (appearance.face === 'arredondado' ? 0.132 : appearance.face === 'angular' ? 0.116 : 0.124) + fat * 0.018;
    const jaw = appearance.face === 'angular' ? 0.76 : appearance.face === 'arredondado' ? 0.92 : 0.84;
    const face = lathe(
      [
        [0.028, 0],
        [faceWidth * 0.52, 0.025],
        [faceWidth * jaw, 0.07],
        [faceWidth, 0.16],
        [faceWidth * 0.98, 0.245],
        [faceWidth * 0.78, 0.315],
        [0.025, 0.345],
      ],
      skin,
      1.635,
      0.9,
    );
    face.scale.z *= 0.92;
    for (const side of [-1, 1]) {
      sphere(side * (faceWidth + 0.005), 1.825, -0.006, 0.024, 0.045, 0.018, skinShade);
      const eye = sphere(side * 0.05, 1.855, 0.112, 0.039, 0.017, 0.009, eyeWhite);
      eye.rotation.z = side * -0.08;
      sphere(side * 0.05, 1.855, 0.121, 0.013, 0.013, 0.005, iris);
      sphere(side * 0.05, 1.855, 0.126, 0.006, 0.008, 0.003, black);
      sphere(side * 0.046, 1.861, 0.13, 0.0025, 0.003, 0.0015, eyeWhite);
      const brow = capsule(side * 0.052, 1.894, 0.111, 0.006, 0.062, hair, side * 0.12);
      brow.rotation.x = Math.PI / 2;
    }
    sphere(0, 1.822, 0.126, 0.018, 0.043, 0.019, skinShade);
    sphere(0, 1.798, 0.14, 0.022, 0.014, 0.018, skin);
    const mouth = sphere(0, 1.747, 0.125, 0.044, 0.009, 0.007, lip);
    mouth.rotation.x = -0.08;
    sphere(0, 1.73, 0.11, 0.061, 0.025, 0.025, skinShade);

    // Cabelo por mechas, com silhuetas próprias para cada estilo.
    const hairStyle = appearance.hair === 'curto' ? 'moderno' : appearance.hair;
    if (hairStyle !== 'raspado') {
      sphere(0, 1.987, -0.015, faceWidth * 1.08, 0.105, 0.12, hair);
      const style = hairStyle === 'longo' ? 'longo' : hairStyle;
      const locks = style === 'social' ? 7 : style === 'heroico' ? 12 : style === 'ondulado' ? 11 : style === 'longo' ? 10 : 9;
      for (let index = 0; index < locks; index++) {
        const progress = index / (locks - 1);
        const x = THREE.MathUtils.lerp(-faceWidth * 0.88, faceWidth * 0.88, progress);
        const center = 1 - Math.abs(progress - 0.5) * 1.2;
        const messy = style === 'bagunçado' || style === 'heroico';
        const length = style === 'heroico' ? 0.15 + center * 0.06 : style === 'social' ? 0.09 : 0.115 + center * 0.04;
        const lock = add(new THREE.ConeGeometry(0.035 + center * 0.012, length, 7), hair);
        lock.position.set(x, 1.965 + (messy ? (index % 3) * 0.018 : 0), 0.07 + center * 0.025);
        lock.rotation.z = (progress - 0.5) * (style === 'social' ? 0.45 : 0.8);
        lock.rotation.x = style === 'heroico' ? -0.32 : -0.12;
      }
      if (style === 'ondulado') {
        for (const side of [-1, 1]) {
          for (let index = 0; index < 3; index++) sphere(side * (0.115 + index * 0.01), 1.91 - index * 0.055, -0.005, 0.045, 0.07, 0.055, hair);
        }
      }
      if (style === 'longo') {
        sphere(0, 1.82, -0.085, faceWidth * 1.18, 0.28, 0.075, hair);
        for (const side of [-1, 1]) capsule(side * faceWidth, 1.79, 0.005, 0.035, 0.28, hair, side * 0.02);
      }
    } else {
      sphere(0, 1.978, -0.022, faceWidth * 1.02, 0.06, 0.108, hair);
    }

    const beardStyle = appearance.beardStyle ?? (appearance.beard ? 'barba curta' : 'sem barba');
    if (appearance.beard && beardStyle !== 'sem barba') {
      const opacity = beardStyle === 'barba curta' ? 0.72 : 0.92;
      const beardMaterial = hair.clone();
      beardMaterial.transparent = true;
      beardMaterial.opacity = opacity;
      sphere(0, 1.718, 0.075, faceWidth * 0.82, beardStyle === 'barba marcada' ? 0.075 : 0.052, 0.055, beardMaterial);
      if (beardStyle === 'cavanhaque') {
        sphere(0, 1.69, 0.108, 0.045, 0.063, 0.025, beardMaterial);
        sphere(0, 1.765, 0.128, 0.04, 0.012, 0.01, beardMaterial);
      }
    }

    const wrist = avatarItems.find((item) => item.id === equipped['mão']);
    if (wrist) {
      const watch = sphere(-shoulder - 0.075, 0.81, 0.075, 0.035, 0.04, 0.015, trim);
      watch.rotation.z = -0.05;
    }
    const headItem = avatarItems.find((item) => item.id === equipped['cabeça']);
    if (headItem) {
      const band = add(new THREE.TorusGeometry(faceWidth * 0.98, 0.012, 10, 56), trim);
      band.rotation.x = Math.PI / 2;
      band.position.set(0, 1.955, 0.005);
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
      scene,
    );
    platform.position.y = -0.055;
    const platformRim = add(new THREE.TorusGeometry(0.74, 0.012, 10, 80), trim, scene);
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

    const ambient = new THREE.HemisphereLight('#dce8ff', '#1a1530', 2.35);
    scene.add(ambient);
    const key = new THREE.DirectionalLight('#fff3e8', 4.8);
    key.position.set(3.5, 5, 4.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const fill = new THREE.PointLight('#8db8ff', 12, 8, 2);
    fill.position.set(-2.4, 2.7, 2.8);
    scene.add(fill);
    const rim = new THREE.SpotLight(accent, 28, 9, Math.PI / 5, 0.7, 1.4);
    rim.position.set(-2.2, 3.8, -2.6);
    rim.target.position.set(0, 1.15, 0);
    scene.add(rim, rim.target);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startAt = performance.now();
    let frame = 0;
    let visible = true;
    let lastFrame = 0;
    let dragging = false;
    let lastX = 0;

    const setCamera = () => {
      const heightScale = appearance.height / 175;
      const faceFocus = focus === 'rosto';
      const targetY = faceFocus ? 1.78 * heightScale : 1.05 * heightScale;
      const baseZ = faceFocus ? 2.55 : 4.95;
      camera.position.set(0, faceFocus ? 1.76 * heightScale : 1.15 * heightScale, baseZ / zoom.current);
      camera.lookAt(0, targetY, 0);
    };
    setCamera();

    const render = (now: number) => {
      if (visible && !document.hidden && now - lastFrame >= 33) {
        lastFrame = now;
        const entrance = reduced ? 1 : THREE.MathUtils.smoothstep((now - startAt) / 650, 0, 1);
        const breath = reduced ? 0 : Math.sin(now / 1200);
        figure.rotation.y = rotation.current;
        figure.position.y = (1 - entrance) * -0.14 + breath * 0.004;
        figure.scale.setScalar((appearance.height / 175) * (0.96 + entrance * 0.04));
        face.rotation.z = reduced ? 0 : Math.sin(now / 2200) * 0.006;
        auraRings.forEach((ring, index) => {
          ring.rotation.z = now * (0.00008 + index * 0.000025) * (index % 2 ? -1 : 1);
        });
        setCamera();
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);

    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(container);

    const pointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      rotation.current += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
    };
    const pointerEnd = () => {
      dragging = false;
    };
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('pointerup', pointerEnd);
    renderer.domElement.addEventListener('pointercancel', pointerEnd);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener('pointerup', pointerEnd);
      renderer.domElement.removeEventListener('pointercancel', pointerEnd);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [appearance, equipped, archetypes, focus]);

  return (
    <div className="avatar-viewer">
      <div
        ref={host}
        className={`avatar-canvas ${equipped.moldura ? 'avatar-frame' : ''}`}
        role="img"
        aria-label="Avatar 3D anime personalizado, girável e conectado à sua evolução"
      />
      {error && <p>Seu dispositivo não disponibilizou 3D. Seus dados e equipamentos continuam disponíveis.</p>}
      <div className="avatar-rotation" aria-label="Controles da prévia 3D">
        <button type="button" onClick={() => (rotation.current -= 0.4)} aria-label="Girar avatar à esquerda">←</button>
        <span>Arraste para girar</span>
        <button type="button" onClick={() => (zoom.current = Math.min(1.38, zoom.current + 0.1))} aria-label="Aproximar avatar">+</button>
        <button type="button" onClick={() => (zoom.current = Math.max(0.82, zoom.current - 0.1))} aria-label="Afastar avatar">−</button>
        <button type="button" onClick={() => (rotation.current += 0.4)} aria-label="Girar avatar à direita">→</button>
      </div>
    </div>
  );
}
