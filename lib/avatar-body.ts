import * as THREE from 'three';
import { avatarItems, type Appearance } from './avatar.ts';
import { createSkinMaterial, createFabricMaterial } from './avatar-materials.ts';
import { resolvePhysique } from './avatar-physique.ts';
import { createHipGarment, createLimbGeometry, createTorsoGeometry, limbPoint, torsoPoint } from './avatar-anatomy.ts';

const archetypeColors: Record<string,string> = {sage:'#9b7cff',athlete:'#55c8e8',entrepreneur:'#d1a85e',leader:'#e6c978',executor:'#70d7b0',strategist:'#7d9cff'};
function mixedAccent(archetypes: string[]) {
  if (!archetypes.length) return new THREE.Color('#9e7cff');
  const colors = archetypes.slice(0,3), weights = [0.5,0.3,0.2];
  const total = weights.slice(0,colors.length).reduce((a,b)=>a+b,0);
  return colors.reduce((color,id,i)=>color.add(new THREE.Color(archetypeColors[id] ?? '#9e7cff').multiplyScalar(weights[i]/total)),new THREE.Color(0));
}

export function createAvatarBody(appearance: Appearance, equipped: Record<string,string>, archetypes: string[] = [], low = false, physicalDays = 0) {
  const group = new THREE.Group(); group.name = 'avatar-body';
  const anatomy = new THREE.Group(); anatomy.name = 'anatomy';
  const clothing = new THREE.Group(); clothing.name = 'clothing';
  const coverage = new THREE.Group(); coverage.name = 'anatomy-sport-shorts';
  group.add(anatomy,clothing,coverage); coverage.visible = false;
  const p = resolvePhysique(appearance,physicalDays), accent = mixedAccent(archetypes);
  const item = avatarItems.find(i=>i.id===equipped.tronco);
  const premium = ['Épico','Lendário','Mítico','Transcendente'].includes(item?.rarity ?? 'Comum');
  const skin = createSkinMaterial(appearance.skin);
  const fabric = createFabricMaterial(item?.color ?? '#45505e');
  const pants = createFabricMaterial('#202633');
  const trim = new THREE.MeshStandardMaterial({color:accent,roughness:0.5,metalness:premium ? 0.5 : 0.12});
  const shoes = new THREE.MeshStandardMaterial({color:avatarItems.find(i=>i.id===equipped['calçados'])?.color ?? '#171c27',roughness:0.7});
  const shorts = new THREE.MeshStandardMaterial({color:'#303a4b',roughness:0.96});
  const sphereGeometry = new THREE.SphereGeometry(1,low ? 16 : 24,low ? 12 : 18);
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group, name: string) => {
    const mesh = new THREE.Mesh(geometry,material); mesh.name = name; parent.add(mesh); return mesh;
  };
  const sphere = (parent: THREE.Group, name: string, position: number[], scale: number[], material: THREE.Material) => {
    const mesh = add(sphereGeometry,material,parent,name); mesh.position.fromArray(position);mesh.scale.fromArray(scale);return mesh;
  };
  const stroke = (parent: THREE.Group, name: string, points: THREE.Vector3[], radius: number, material: THREE.Material) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),low ? 18 : 30,radius,6,false),material,parent,name);
  add(createTorsoGeometry(p,low),skin,anatomy,'torso-skin');
  add(createTorsoGeometry(p,low,true),fabric,clothing,'shirt');
  add(createHipGarment(p,low),pants,clothing,'pants-waist');
  add(createHipGarment(p,low),shorts,coverage,'shorts-waist');
  // Neck blends into trapezius; the head continues to attach at the original pivot.
  const neck = add(new THREE.CylinderGeometry(0.054,0.079 + p.volume*0.01,0.2,low ? 20 : 32),skin,anatomy,'neck');neck.position.y=1.60;
  for (const side of [-1,1]) {
    add(createLimbGeometry(p,'arm',side,low),skin,anatomy,`arm-${side}`);
    add(createLimbGeometry(p,'leg',side,low),skin,anatomy,`leg-${side}`);
    add(createLimbGeometry(p,'arm',side,low,true),fabric,clothing,`sleeve-${side}`);
    add(createLimbGeometry(p,'leg',side,low,true),pants,clothing,`trouser-${side}`);
    add(createLimbGeometry(p,'leg',side,low,true,true),shorts,coverage,`shorts-leg-${side}`);
    const wrist = limbPoint(p,'arm',side,0,0);
    sphere(anatomy,`hand-${side}`,[wrist.x,0.829,0.037],[0.036,0.059,0.027],skin);
    for (let finger=0;finger<4;finger++) {
      const geometry = new THREE.CapsuleGeometry(0.007,0.036 - Math.abs(finger-1.5)*0.004,4,8);
      const mesh=add(geometry,skin,anatomy,`finger-${side}-${finger}`);mesh.position.set(wrist.x+(finger-1.5)*0.015,0.78,0.045);
    }
    const thumb=sphere(anatomy,`thumb-${side}`,[wrist.x-side*0.029,0.824,0.06],[0.012,0.03,0.013],skin);thumb.rotation.z=side*-0.42;
    sphere(anatomy,`foot-${side}`,[side*0.126,0.067,0.054],[0.054,0.052,0.121],skin);
    sphere(clothing,`shoe-${side}`,[side*0.126,0.067,0.063],[0.066,0.063,0.138],shoes);
    sphere(clothing,`sole-${side}`,[side*0.126,0.031,0.063],[0.068,0.023,0.137],pants);
    const hem=[];for(let i=0;i<=32;i++){const pt=limbPoint(p,'arm',side,0.5,i/32*Math.PI*2,true);hem.push(new THREE.Vector3(pt.x,pt.y,pt.z));}
    stroke(clothing,`sleeve-hem-${side}`,hem,0.003,trim);
  }
  const collar=add(new THREE.TorusGeometry(0.092,0.009,8,40),pants,clothing,'collar');collar.rotation.x=Math.PI/2;collar.position.y=1.558;collar.scale.y=0.85;
  const zipper=[];for(let i=0;i<=24;i++){const pt=torsoPoint(p,0.955+i/24*0.54,0,true);zipper.push(new THREE.Vector3(pt.x,pt.y,pt.z+0.002));}
  stroke(clothing,'zipper',zipper,0.002,trim);
  if (equipped['mão']) {
    const wrist=limbPoint(p,'arm',-1,0.04,0);
    const watch=sphere(group,'watch',[wrist.x,wrist.y,0.074],[0.025,0.023,0.013],trim);watch.rotation.z=-0.08;
  }
  if (equipped['insígnia']) {
    const point=torsoPoint(p,1.418,0.45,true);
    const badge=add(new THREE.CylinderGeometry(0.021,0.021,0.007,7),trim,clothing,'insignia');badge.rotation.x=Math.PI/2;badge.position.set(point.x,point.y,point.z+0.006);
  }
  const platform=add(new THREE.CylinderGeometry(0.66,0.71,0.055,48),new THREE.MeshStandardMaterial({color:'#171c2a',roughness:0.48,metalness:0.4}),group,'platform');platform.position.y=-0.022;
  const rim=add(new THREE.TorusGeometry(0.67,0.007,8,64),trim,group,'platform-rim');rim.rotation.x=Math.PI/2;rim.position.y=0.005;
  const auraRings: THREE.Mesh[] = [];
  const aura=avatarItems.find(i=>i.id===equipped.aura);
  if (aura) for(let i=0;i<3;i++) {
    const ring=add(new THREE.TorusGeometry(0.68+i*0.1,0.007,8,64),new THREE.MeshBasicMaterial({color:aura.color,transparent:true,opacity:0.42-i*0.08}),group,`aura-${i}`);
    ring.position.set(0,1.03+i*0.13,-0.34);ring.rotation.set(Math.PI/2.3,i*0.36,0);auraRings.push(ring);
  }
  return {group,anatomy,clothing,coverage,auraRings};
}
