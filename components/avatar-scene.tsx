'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { avatarItems, type Appearance, type AvatarStyleMode } from '@/lib/avatar';
import { createAvatarBody } from '@/lib/avatar-body';
import { createEquipmentDetail } from '@/lib/avatar-equipment-model';
import { createAvatarHead, disposeAvatarObject } from '@/lib/avatar-head';
import { createRogerMaleAvatar, type RogerMaleAvatar } from '@/lib/avatar-male-model';
import { frameAvatar, measureAvatar, type AvatarFocus } from '@/lib/avatar-camera';

type Props = { appearance: Appearance; equipped: Record<string, string>; itemColors?:Record<string,string>; archetypes?: string[]; focus?: AvatarFocus; focusRevision?: number; physicalDays?: number; styleMode?: AvatarStyleMode };
type Update = (props: Props, low: boolean, anatomy: boolean) => void;

export default function AvatarScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<Update | null>(null);
  const controls = useRef({rotation: 0.18, zoom: 1});
  const cameraPreset = useRef<AvatarFocus | null>(null);
  const previousFocus = useRef([props.focus,props.focusRevision]);
  const invalidate = useRef(() => {});
  const [error, setError] = useState(false);
  const [quality, setQuality] = useState<'auto' | 'low'>('auto');
  const [anatomyView, setAnatomyView] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: 'default'});
    } catch {
      const id = window.setTimeout(() => setError(true), 0);
      return () => window.clearTimeout(id);
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.01, 50);
    const figure = new THREE.Group(); scene.add(figure);
    scene.add(new THREE.HemisphereLight('#e6ecff', '#777080', 1.9));
    scene.add(new THREE.AmbientLight('#fff3ed', 0.6));
    const key = new THREE.DirectionalLight('#fff2e7', 2.8); key.position.set(2.2, 3.8, 4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-1.4;key.shadow.camera.right=1.4;key.shadow.camera.top=2.5;key.shadow.camera.bottom=-.2;key.shadow.bias=-.0004;scene.add(key);
    const fill = new THREE.DirectionalLight('#c4d8ff', 1.4); fill.position.set(-3, 2, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight('#b39cef', 2.5); rim.position.set(-1.8, 3, -2); scene.add(rim);
    const ground=new THREE.Mesh(new THREE.CircleGeometry(.78,64),new THREE.ShadowMaterial({color:'#050508',opacity:.38}));ground.rotation.x=-Math.PI/2;ground.position.y=-.051;ground.receiveShadow=true;scene.add(ground);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 700px)');
    let reduced = preference.matches, low = mobile.matches, visible = false, disposed = false, requestedLow = false;
    let showAnatomy = false;
    let current: Props | null = null, head: ReturnType<typeof createAvatarHead> | null = null, male: RogerMaleAvatar | null = null;
    let body: ReturnType<typeof createAvatarBody> | null = null;
    let detailVersion=0;
    let bodyKey = '', headKey = '', maleKey = '', maleVersion = 0, pending: {props: Props; low: boolean} | null = null;
    let frame = 0, lastFrame = 0, width = 1, height = 1, dragging = false, lastX = 0;
    let animationSeconds = 0, previousTime = 0;
    let measurement: ReturnType<typeof measureAvatar> | null = null;
    let cameraReady = false;
    const lookTarget = new THREE.Vector3();

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.2 : 1.8));
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const setCamera = () => {
      if (!current) return;
      if (!measurement) {
        const rotation = figure.rotation.y;
        figure.rotation.y = 0;
        figure.updateMatrixWorld(true);
        const base = male?.group ?? body?.anatomy;
        if (base) {
          measurement = measureAvatar(base);
          if (!male && head) {
            measurement.bounds.union(new THREE.Box3().setFromObject(head.group, true));
            measurement.size = measurement.bounds.getSize(new THREE.Vector3());
          }
        }
        figure.rotation.y = rotation;
        figure.updateMatrixWorld(true);
      }
      if (!measurement) return;
      const focus = cameraPreset.current ?? current.focus ?? 'corpo';
      const frame = frameAvatar(measurement, focus, camera.aspect, camera.fov, controls.current.zoom);
      const blend = !cameraReady || reduced ? 1 : .18;
      camera.position.lerp(frame.position, blend);
      lookTarget.lerp(frame.target, blend);
      camera.lookAt(lookTarget);
      cameraReady = true;
      container.dataset.cameraFocus = focus;
      container.dataset.cameraDistance = camera.position.distanceTo(lookTarget).toFixed(4);
    };
    const loadDetail = (target:ReturnType<typeof createAvatarBody>,props:Props,item:typeof avatarItems[number]|undefined,version:number) => {
      const mode=props.styleMode??'rpg',style=mode==='rpg'?item?.rpgStyle:item?.humanStyle;
      if(!style||!item)return;
      void createEquipmentDetail(mode,style,props.itemColors?.[item.id]??item.color).then(detail=>{
        if(!detail)return;
        if(disposed||version!==detailVersion||body!==target){disposeAvatarObject(detail);return;}
        target.clothing.add(detail);schedule();
      }).catch(()=>{/* Procedural clothing remains available if the optional detail library cannot load. */});
    };
    const applyPending = () => {
      if (!pending) return;
      current = pending.props;
      measurement = null;
      const a = current.appearance;
      const nextLow = pending.low || mobile.matches;
      if (low !== nextLow) {low = nextLow; resize();}
      const nextBody = JSON.stringify([a.skin, a.shape, a.fat, a.muscle, current.physicalDays, current.equipped, current.itemColors, current.archetypes, current.styleMode, low]);
      if (nextBody !== bodyKey) {
        detailVersion++;
        if (body) {figure.remove(body.group); disposeAvatarObject(body.group);}
        body = createAvatarBody(a, current.equipped, current.archetypes, low, current.physicalDays, current.styleMode,current.itemColors); figure.add(body.group); bodyKey = nextBody;
        const torsoItem=avatarItems.find(item=>item.id===current?.equipped.tronco);loadDetail(body,current,torsoItem,detailVersion);
      }
      const usesRoger=a.shape==='masculino';
      if (body) {
        body.anatomy.visible=!usesRoger;
        body.clothing.visible=!showAnatomy;
        body.coverage.visible=showAnatomy&&!usesRoger;
      }
      male?.underwear.forEach(item=>{item.visible=true;});
      const nextMale=usesRoger?JSON.stringify([a.skin,a.hairColor,a.eyeColor,a.hair,a.hairLength,a.beard,a.beardStyle,a.muscle,a.fat,current.physicalDays]):'';
      if(nextMale!==maleKey){
        const version=++maleVersion;
        if(male&&!usesRoger){figure.remove(male.group);disposeAvatarObject(male.group);male=null;}
        container.dataset.avatarModel=usesRoger?'roger-loading':'procedural';
        maleKey=nextMale;
        if(usesRoger)void createRogerMaleAvatar(a,current.physicalDays).then(result=>{
          if(disposed||version!==maleVersion){disposeAvatarObject(result.group);return;}
          if(male){figure.remove(male.group);disposeAvatarObject(male.group);}
          if(head){figure.remove(head.group);disposeAvatarObject(head.group);head=null;}
          if(body)body.anatomy.visible=false;
          male=result;measurement=null;male.underwear.forEach(item=>{item.visible=true;});figure.add(result.group);
          container.dataset.avatarModel='roger';schedule();
        }).catch(()=>{if(!disposed&&version===maleVersion){container.dataset.avatarModel=male?'roger':'procedural-fallback';if(!male){if(body)body.anatomy.visible=true;if(!head){head=createAvatarHead(a,undefined,low);figure.add(head.group);}}measurement=null;schedule();}});
      }
      const headItem = avatarItems.find(item => item.id === current?.equipped['cabeça']),headColor=headItem?(current.itemColors?.[headItem.id]??headItem.color):undefined;
      const nextHead = usesRoger?'':JSON.stringify([a.skin, a.hair, a.hairColor, a.eyeColor, a.face, a.facial, a.hairLength, a.realism, a.beard, a.beardStyle, headColor,headItem?.equipmentStyle,low]);
      if (nextHead !== headKey) {
        if (head) {figure.remove(head.group); disposeAvatarObject(head.group);}
        head = usesRoger?null:createAvatarHead(a, headColor, low,headItem?.equipmentStyle==='crown'?'crown':'band');
        if(head)figure.add(head.group);headKey = nextHead;
      }
      pending = null;
    };
    const schedule = () => {
      if (!disposed && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
    };
    const render = (now: number) => {
      frame = 0;
      if (disposed || !visible || document.hidden || !container.clientWidth || !container.clientHeight) return;
      if (now - lastFrame < (low ? 40 : 33)) {schedule(); return;}
      applyPending();
      if (!current) return;
      animationSeconds += reduced || !previousTime ? 0 : Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now; lastFrame = now;
      figure.rotation.y = controls.current.rotation;
      figure.scale.setScalar(current.appearance.height / 175);
      figure.position.y = reduced ? 0 : Math.sin(animationSeconds / 1.2) * 0.003;
      head?.update(animationSeconds, reduced);
      body?.auraRings.forEach((ring, i) => {ring.rotation.z = reduced ? 0 : animationSeconds * (0.08 + i * 0.025) * (i % 2 ? -1 : 1);});
      setCamera(); renderer.render(scene, camera);
      if (!reduced) schedule();
    };
    update.current = (next, forceLow, anatomy) => {showAnatomy = anatomy; requestedLow = forceLow; pending = {props: next, low: forceLow}; schedule();};
    invalidate.current = schedule;
    const onPreference = () => {reduced = preference.matches; previousTime = 0; schedule();};
    preference.addEventListener('change', onPreference);
    const onMobile = () => {if (current) {pending = {props: pending?.props ?? current, low: requestedLow}; schedule();}};
    mobile.addEventListener('change', onMobile);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      previousTime = 0;
      if (!visible) {cancelAnimationFrame(frame); frame = 0;} else schedule();
    }); observer.observe(container);
    const onVisibility = () => {previousTime = 0; if (document.hidden) {cancelAnimationFrame(frame); frame = 0;} else schedule();};
    document.addEventListener('visibilitychange', onVisibility);
    const resizeObserver = new ResizeObserver(() => {resize(); schedule();}); resizeObserver.observe(container); resize();
    const pointers = new Map<number, THREE.Vector2>();
    let pinchDistance = 0;
    const span = () => {const points=[...pointers.values()];return points.length===2?points[0].distanceTo(points[1]):0;};
    const down = (event: PointerEvent) => {pointers.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));pinchDistance=span();dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId);};
    const move = (event: PointerEvent) => {
      if(!pointers.has(event.pointerId))return;
      pointers.set(event.pointerId,new THREE.Vector2(event.clientX,event.clientY));
      if(pointers.size===2){const distance=span();if(pinchDistance>0)controls.current.zoom=THREE.MathUtils.clamp(controls.current.zoom*distance/pinchDistance,.65,1.8);pinchDistance=distance;}
      else if(dragging)controls.current.rotation += (event.clientX-lastX)*.012;
      lastX=event.clientX;schedule();
    };
    const end = (event: PointerEvent) => {pointers.delete(event.pointerId);dragging=pointers.size>0;pinchDistance=span();const remaining=[...pointers.values()][0];if(remaining)lastX=remaining.x;};
    const wheel = (event: WheelEvent) => {event.preventDefault();controls.current.zoom=THREE.MathUtils.clamp(controls.current.zoom*Math.exp(-event.deltaY*.001),.65,1.8);schedule();};
    const lost = (event: Event) => {event.preventDefault(); setError(true); visible = false; cancelAnimationFrame(frame); frame = 0;};
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', end); renderer.domElement.addEventListener('pointercancel', end);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    renderer.domElement.addEventListener('wheel', wheel, {passive:false});
    return () => {
      disposed = true;detailVersion++;maleVersion++;cancelAnimationFrame(frame); update.current = null; invalidate.current = () => {};
      observer.disconnect(); resizeObserver.disconnect(); preference.removeEventListener('change', onPreference); mobile.removeEventListener('change', onMobile);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', end); renderer.domElement.removeEventListener('pointercancel', end);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.removeEventListener('wheel', wheel);
      disposeAvatarObject(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {
    if(previousFocus.current[0]!==props.focus||previousFocus.current[1]!==props.focusRevision){cameraPreset.current=null;controls.current.zoom=1;previousFocus.current=[props.focus,props.focusRevision];}
    update.current?.(props, quality === 'low', anatomyView);
  }, [props, quality, anatomyView]);
  const changeView = (rotation: number, zoom: number) => {
    controls.current.rotation += rotation;
    controls.current.zoom = THREE.MathUtils.clamp(controls.current.zoom + zoom, .65, 1.8);
    invalidate.current();
  };
  return <div className="avatar-viewer">
    <div ref={host} className={`avatar-canvas avatar-mode-${props.styleMode ?? 'rpg'} ${props.equipped.moldura ? 'avatar-frame' : ''}`} role="img" aria-label={`Avatar 3D ${props.styleMode==='human'?'humano':'RPG'} personalizado, girável e conectado à sua evolução`} />
    {error && <p role="alert">O 3D ficou indisponível neste dispositivo. Recarregue a página para tentar novamente. Seus dados continuam salvos.</p>}
    <div className="avatar-rotation" aria-label="Controles da prévia 3D">
      <button type="button" onClick={() => changeView(-0.4, 0)} aria-label="Girar avatar à esquerda">←</button>
      <span>Arraste para girar</span>
      <button type="button" onClick={() => changeView(0, 0.1)} aria-label="Aproximar avatar">+</button>
      <button type="button" onClick={() => changeView(0, -0.1)} aria-label="Afastar avatar">−</button>
      <button type="button" onClick={() => changeView(0.4, 0)} aria-label="Girar avatar à direita">→</button>
    </div>
    <div className="avatar-view-options">
      {([['corpo','Corpo inteiro'],['meio','Meio corpo'],['rosto','Ver rosto'],['equipamentos','Equipamentos'],['calcados','Calçados']] as const).map(([preset,label])=><button type="button" key={preset} onClick={()=>{cameraPreset.current=preset;controls.current.zoom=1;invalidate.current();}}>{label}</button>)}
      <button type="button" onClick={()=>{controls.current.rotation=0;invalidate.current();}}>Ver frente</button>
      <button type="button" onClick={()=>{controls.current.rotation=Math.PI;invalidate.current();}}>Ver costas</button>
      <button type="button" aria-pressed={anatomyView} onClick={() => setAnatomyView(v => !v)}>{anatomyView ? 'Ver roupas' : 'Ver anatomia'}</button>
      <button type="button" onClick={() => {cameraPreset.current='corpo';controls.current = {rotation: 0, zoom: 1}; invalidate.current();}}>Resetar câmera</button>
      <button type="button" aria-pressed={quality === 'low'} onClick={() => setQuality(q => q === 'low' ? 'auto' : 'low')}>Qualidade reduzida</button>
    </div>
  </div>;
}
