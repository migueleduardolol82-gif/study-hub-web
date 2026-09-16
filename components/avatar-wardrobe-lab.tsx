'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {createRogerMaleAvatar} from '@/lib/avatar-male-model';
import {loadWardrobeCandidate} from '@/lib/avatar-fitted-wardrobe';
import {setClothingBodyMask} from '@/lib/avatar-body-mask';
import {initialAppearance} from '@/lib/avatar';
import {defaultItemColors,type ItemMaterialColors} from '@/lib/avatar-item-colors';
import {tintClothing} from '@/lib/avatar-clothing-materials';
import {disposeAvatarObject} from '@/lib/avatar-head';
import AvatarItemColorEditor from './avatar-item-color-editor';
import './avatar.css';

export default function AvatarWardrobeLab(){
 const host=useRef<HTMLDivElement>(null),tint=useRef<(colors:ItemMaterialColors)=>void>(()=>{});
 const [status,setStatus]=useState('Carregando candidatos…');
 const [saved,setSaved]=useState(defaultItemColors('#45505e'));
 useEffect(()=>{
  const container=host.current;if(!container)return;
  let disposed=false,frame=0;const scene=new THREE.Scene();scene.background=new THREE.Color('#242630');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(35,1,.01,20);camera.position.set(0,1.2,4);
  scene.add(new THREE.HemisphereLight('#e6eeff','#36303c',2));
  const light=new THREE.DirectionalLight('#fff1dc',3);light.position.set(2,4,3);light.castShadow=true;light.shadow.normalBias=.015;light.shadow.bias=-.00015;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-1.5;light.shadow.camera.right=1.5;light.shadow.camera.top=2.5;light.shadow.camera.bottom=-.5;scene.add(light);
  const fill=new THREE.DirectionalLight('#b6caff',1.3);fill.position.set(-3,2,-1);scene.add(fill);
  const resize=()=>{renderer.setSize(container.clientWidth,container.clientHeight);camera.aspect=container.clientWidth/container.clientHeight;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let controls:{update:()=>void;dispose:()=>void}|undefined;
  void Promise.all([createRogerMaleAvatar({...initialAppearance,shape:'masculino'}),import('three/examples/jsm/controls/OrbitControls.js')]).then(async([avatar,{OrbitControls}])=>{
   if(disposed){disposeAvatarObject(avatar.group);return;}scene.add(avatar.group);
   const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1,0);orbit.enableDamping=true;orbit.minDistance=1;orbit.maxDistance=6;controls=orbit;
   const colors=defaultItemColors('#45505e');
   const [top]=await Promise.all([loadWardrobeCandidate(avatar.group,'regular-tee',colors),loadWardrobeCandidate(avatar.group,'jogger',colors)]);
   if(disposed){disposeAvatarObject(avatar.group);return;}setClothingBodyMask(avatar.group,true,true);tint.current=c=>tintClothing(top,c,'top');
   setStatus('Candidatos locais · camiseta normal e jogger · rig compartilhado');
  }).catch(()=>{if(!disposed)setStatus('Não foi possível carregar os candidatos locais.');});
  let count=0,started=performance.now();
  const render=()=>{if(disposed)return;controls?.update();renderer.render(scene,camera);count++;if(count===60){container.dataset.frameMs=((performance.now()-started)/count).toFixed(2);container.dataset.drawCalls=String(renderer.info.render.calls);container.dataset.triangles=String(renderer.info.render.triangles);count=0;started=performance.now();}frame=requestAnimationFrame(render);};render();
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls?.dispose();tint.current=()=>{};disposeAvatarObject(scene);scene.traverse(object=>{if(object instanceof THREE.SkinnedMesh)object.skeleton.dispose();});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <main style={{padding:24,maxWidth:1100,margin:'auto'}}><h1>Revisão de vestuário</h1><p role="status">{status}</p><p>Ambiente de desenvolvimento. As peças ainda não estão liberadas no catálogo.</p><div style={{display:'flex',gap:24,flexWrap:'wrap'}}><div ref={host} style={{height:620,flex:'1 1 340px',minWidth:0}} aria-label="Prévia de roupas no AvatarBase"/><div style={{flex:'1 1 280px'}}><AvatarItemColorEditor key={JSON.stringify(saved)} name="Camiseta normal" slot="tronco" original="#45505e" saved={saved} busy={false} onPreview={c=>tint.current(c)} onCancel={()=>tint.current(saved)} onApply={async c=>{setSaved(c);return true;}}/></div></div></main>;
}
