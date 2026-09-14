'use client';
import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { type Appearance, avatarItems } from '@/lib/avatar';
export default function AvatarScene({appearance:a,equipped,archetypes}:{appearance:Appearance;equipped:Record<string,string>;archetypes?:string[]}) {
 const host=useRef<HTMLDivElement>(null);const rotation=useRef(0);const previous=useRef(a);const zoom=useRef(1.2);const [error,setError]=useState(false);
 useEffect(()=>{
  const container=host.current;if(!container)return;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true});}catch{setTimeout(()=>setError(true),0);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.outputColorSpace=T.SRGBColorSpace;container.appendChild(renderer.domElement);
  const scene=new T.Scene();const camera=new T.PerspectiveCamera(32,1,.1,100);camera.position.set(0,1.35,5.5);camera.lookAt(0,1.10,0);
  scene.add(new T.HemisphereLight(0xe7edff,0x36313c,3));const key=new T.DirectionalLight(0xffffff,4);key.position.set(3,5,4);key.castShadow=true;scene.add(key);
  const rim=new T.DirectionalLight(0xb6a4ff,3);rim.position.set(-3,2,-2);scene.add(rim);
  const figure=new T.Group();scene.add(figure);figure.rotation.y=.2;
  const skin=new T.MeshStandardMaterial({color:a.skin,roughness:.66});const hair=new T.MeshStandardMaterial({color:a.hairColor,roughness:.9});
  const shoes=new T.MeshStandardMaterial({color:avatarItems.find(i=>i.id===equipped['calçados'])?.color||'#171e29',roughness:.65});
  const cloth=new T.MeshStandardMaterial({color:avatarItems.find(i=>i.id===equipped.tronco)?.color||'#45505e',roughness:.78});const pants=new T.MeshStandardMaterial({color:'#202632',roughness:.85});const dark=new T.MeshStandardMaterial({color:'#11151c'});
  const fat=(a.fat-20)/100;const muscle=a.muscle/100;const waist=.18+fat*.22+(a.weight-75)*.0007;
  function ellipsoid(x:number,y:number,z:number,sx:number,sy:number,sz:number,material:T.Material){const mesh=new T.Mesh(new T.SphereGeometry(1,24,20),material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;figure.add(mesh);return mesh;}
  function form(y:number,points:number[][],material:T.Material){const mesh=new T.Mesh(new T.LatheGeometry(points.map(p=>new T.Vector2(p[0],p[1])),40),material);mesh.position.y=y;mesh.scale.z=.68;mesh.castShadow=true;figure.add(mesh);return mesh;}
  form(.94,[[.15,0],[waist,.1],[waist,.24],[.24+muscle*.055,.46],[.225,.54],[.085,.62]],cloth);
  ellipsoid(0,.95,0,.21+fat*.13,.15,.14,pants);
  for(const sign of [-1,1]) {
   const leg=ellipsoid(sign*.115,.59,0,.095+muscle*.03,.35,.1,pants);leg.rotation.z=sign*-.035;
   ellipsoid(sign*.125,.205,0,.07,.18,.075,pants);ellipsoid(sign*.13,.055,.065,.085,.055,.16,shoes);
   ellipsoid(sign*.235,1.423,0,.084+muscle*.025,.10,.087,cloth);
   const arm=ellipsoid(sign*(.29+muscle*.035),1.25,0,.073+muscle*.025,.23,.075,cloth);arm.rotation.z=sign*.14;
   const fore=ellipsoid(sign*.335,.97,.015,.055+muscle*.015,.17,.055,skin);fore.rotation.z=sign*.06;
   ellipsoid(sign*.345,.79,.025,.047,.085,.04,skin);
  }
  ellipsoid(0,1.57,0,.067,.105,.067,skin);
  const faceWidth=(a.face==='angular'?.109:a.face==='arredondado'?.12:.105)+fat*.045;
  const face=form(1.62,[[.025,0],[.058,.025],[faceWidth*.83,.07],[faceWidth,.15],[faceWidth,.23],[faceWidth*.8,.28],[.025,.30]],skin);face.scale.z=.9;
  for(const s of [-1,1]){ellipsoid(s*.123,1.765,0,.022,.04,.025,skin);ellipsoid(s*.047,1.79,.107,.019,.007,.006,new T.MeshStandardMaterial({color:'#c8c2b4'}));ellipsoid(s*.047,1.79,.116,.006,.006,.003,dark);ellipsoid(s*.046,1.82,.111,.03,.007,.009,hair);}
  ellipsoid(0,1.758,.12,.018,.03,.023,skin);ellipsoid(0,1.71,.112,.036,.005,.007,new T.MeshStandardMaterial({color:'#845453'}));
  if(a.hair!=='raspado'){ellipsoid(0,1.89,-.013,.12,.048,.115,hair);if(a.hair==='longo')ellipsoid(0,1.75,-.082,.14,.21,.07,hair);}
  const accent=new T.Color('#849084');const colors:Record<string,string>={sage:'#aa8cff',athlete:'#72b7c9',entrepreneur:'#b49b68',leader:'#c4b487',executor:'#93aaa0',strategist:'#879ad1'};if(archetypes?.length){accent.set('#000000');const weights=[.5,.3,.2].slice(0,archetypes.length);const total=weights.reduce((a,b)=>a+b,0);archetypes.slice(0,3).forEach((id,i)=>accent.add(new T.Color(colors[id]||'#849084').multiplyScalar(weights[i]/total)));}
  const trim=new T.MeshStandardMaterial({color:accent,metalness:.4,roughness:.6});
  const zipper=new T.Mesh(new T.BoxGeometry(.007,.36,.009),trim);zipper.position.set(0,1.24,.157);figure.add(zipper);
  for(const side of [-1,1]){const cuff=new T.Mesh(new T.TorusGeometry(.053,.006,8,24),trim);cuff.rotation.x=Math.PI/2;cuff.position.set(side*.34,.875,.02);figure.add(cuff);ellipsoid(side*.309,.80,.058,.017,.042,.018,skin);}
  const wrist=avatarItems.find(i=>i.id===equipped['mão']);if(wrist)ellipsoid(-.344,.88,.079,.026,.033,.012,new T.MeshStandardMaterial({color:wrist.color,metalness:.8,roughness:.3}));
  const head=avatarItems.find(i=>i.id===equipped['cabeça']);if(head){const band=new T.Mesh(new T.TorusGeometry(.116,.012,8,48),new T.MeshStandardMaterial({color:head.color}));band.rotation.x=Math.PI/2;band.position.y=1.865;figure.add(band);}
  if(a.beard)ellipsoid(0,1.674,.051,.09,.038,.081,hair);
  if(a.shape==='feminino'){figure.children.filter(m=>m.position.y===.95).forEach(m=>m.scale.x*=1.12);}
  const badge=avatarItems.find(i=>i.id===equipped['insígnia']);if(badge)ellipsoid(.115,1.40,.167,.025,.033,.008,new T.MeshStandardMaterial({color:badge.color,metalness:.8,roughness:.25}));
  const aura=avatarItems.find(i=>i.id===equipped.aura);if(aura){const ring=new T.Mesh(new T.TorusGeometry(.72,.012,12,80),new T.MeshBasicMaterial({color:aura.color}));ring.position.set(0,1.15,-.25);figure.add(ring);}
  const before=previous.current;previous.current=a;
  const morphStart=performance.now();const transition=figure.children.map(child=>({child,target:child.scale.clone(),previous:child.scale.clone()}));
  for(const part of transition){if(part.child.position.y>.5&&part.child.position.y<1.5){part.previous.x*=Math.max(.7,Math.min(1.3,1+(before.fat-a.fat)*.003+(before.muscle-a.muscle)*.001));}}
  figure.scale.setScalar(a.height/175);
  const floor=new T.Mesh(new T.CircleGeometry(.68,64),new T.MeshStandardMaterial({color:'#242b38',roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
  let visible=true;let frame=0;let lastFrame=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render=()=>{if(visible&&!document.hidden&&performance.now()-lastFrame>33){lastFrame=performance.now();const progress=reduced?1:Math.min(1,(performance.now()-morphStart)/800);for(const part of transition)part.child.scale.lerpVectors(part.previous,part.target,progress);figure.scale.setScalar((before.height+(a.height-before.height)*progress)/175);camera.position.z=5.5*Math.max(1,a.height/175)/zoom.current;camera.lookAt(0,1.1*(a.height/175),0);figure.rotation.y=rotation.current+.2;if(!reduced)figure.position.y=Math.sin(performance.now()/1800)*.003;renderer.render(scene,camera);}frame=requestAnimationFrame(render);};render();
  const resize=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/Math.max(height,1);camera.updateProjectionMatrix();});resize.observe(container);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(container);
  let down=false,last=0;const start=(e:PointerEvent)=>{down=true;last=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);};const move=(e:PointerEvent)=>{if(down){rotation.current+=(e.clientX-last)*.012;last=e.clientX;}};const end=()=>{down=false;};
  renderer.domElement.addEventListener('pointerdown',start);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',end);renderer.domElement.addEventListener('pointercancel',end);
  return()=>{cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});renderer.dispose();renderer.domElement.remove();};
 },[a,equipped,archetypes]);
 return <div><div ref={host} className={`avatar-canvas ${equipped.moldura?"avatar-frame":""}`} role="img" aria-label="Representação 3D personalizada do seu avatar" />{error&&<p>Seu dispositivo não disponibilizou 3D. Seus dados e equipamentos continuam disponíveis.</p>}<div className="avatar-rotation"><button onClick={()=>rotation.current-=.4} aria-label="Girar avatar à esquerda">← Girar</button><button onClick={()=>zoom.current=Math.max(.8,Math.min(1.3,zoom.current+.1))} aria-label="Aproximar avatar">+</button><button onClick={()=>zoom.current=Math.max(.8,zoom.current-.1)} aria-label="Afastar avatar">−</button><button onClick={()=>rotation.current+=.4} aria-label="Girar avatar à direita">Girar →</button></div></div>;
}
