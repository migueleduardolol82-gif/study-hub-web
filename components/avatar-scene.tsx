'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { avatarItems, type Appearance } from '@/lib/avatar';
import { createAvatarBody } from '@/lib/avatar-body';
import { createAvatarHead, disposeAvatarObject } from '@/lib/avatar-head';

type Props = { appearance: Appearance; equipped: Record<string, string>; archetypes?: string[]; focus?: 'corpo' | 'rosto'; physicalDays?: number };
type Update = (props: Props, low: boolean, anatomy: boolean) => void;

export default function AvatarScene(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const update = useRef<Update | null>(null);
  const controls = useRef({rotation: 0.18, zoom: 1});
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
    renderer.toneMappingExposure = 1;
    // Soft studio lighting avoids expensive dynamic shadow passes on mobile.
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.01, 50);
    const figure = new THREE.Group(); scene.add(figure);
    scene.add(new THREE.HemisphereLight('#e6ecff', '#777080', 1.9));
    scene.add(new THREE.AmbientLight('#fff3ed', 0.6));
    const key = new THREE.DirectionalLight('#fff2e7', 2.8); key.position.set(2.2, 3.8, 4); scene.add(key);
    const fill = new THREE.DirectionalLight('#c4d8ff', 1.4); fill.position.set(-3, 2, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight('#b39cef', 2.5); rim.position.set(-1.8, 3, -2); scene.add(rim);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mobile = window.matchMedia('(max-width: 700px)');
    let reduced = preference.matches, low = mobile.matches, visible = false, disposed = false, requestedLow = false;
    let showAnatomy = false;
    let current: Props | null = null, head: ReturnType<typeof createAvatarHead> | null = null;
    let body: ReturnType<typeof createAvatarBody> | null = null;
    let bodyKey = '', headKey = '', pending: {props: Props; low: boolean} | null = null;
    let frame = 0, lastFrame = 0, width = 1, height = 1, dragging = false, lastX = 0;
    let animationSeconds = 0, previousTime = 0;

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.2 : 1.8));
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const setCamera = () => {
      if (!current) return;
      const scale = current.appearance.height / 175, face = current.focus === 'rosto' && !showAnatomy;
      const facialHeight = current.appearance.facial?.faceHeight ?? 1;
      const targetY = face ? (1.635 + 0.194 * facialHeight) * scale : 1.05 * scale;
      // Fit both horizontal and vertical bounds at narrow phone widths, then apply user zoom.
      const fit = face ? Math.max(0.65, 0.49 / camera.aspect) : Math.max(2.42, 1.12 / camera.aspect);
      const distance = fit / (2 * Math.tan(THREE.MathUtils.degToRad(27) / 2)) * scale / controls.current.zoom;
      camera.position.set(0, targetY + (face ? 0 : 0.08 * scale), distance);
      camera.lookAt(0, targetY, 0);
    };
    const applyPending = () => {
      if (!pending) return;
      current = pending.props;
      const a = current.appearance;
      const nextLow = pending.low || mobile.matches;
      if (low !== nextLow) {low = nextLow; resize();}
      const nextBody = JSON.stringify([a.skin, a.shape, a.fat, a.muscle, current.physicalDays, current.equipped, current.archetypes, low]);
      if (nextBody !== bodyKey) {
        if (body) {figure.remove(body.group); disposeAvatarObject(body.group);}
        body = createAvatarBody(a, current.equipped, current.archetypes, low, current.physicalDays); figure.add(body.group); bodyKey = nextBody;
      }
      if (body) {body.clothing.visible = !showAnatomy; body.coverage.visible = showAnatomy;}
      const headColor = avatarItems.find(item => item.id === current?.equipped['cabeça'])?.color;
      const nextHead = JSON.stringify([a.skin, a.hair, a.hairColor, a.eyeColor, a.face, a.facial, a.hairLength, a.realism, a.beard, a.beardStyle, headColor, low]);
      if (nextHead !== headKey) {
        if (head) {figure.remove(head.group); disposeAvatarObject(head.group);}
        head = createAvatarHead(a, headColor, low); figure.add(head.group); headKey = nextHead;
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
    const down = (event: PointerEvent) => {dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId);};
    const move = (event: PointerEvent) => {if (dragging) {controls.current.rotation += (event.clientX - lastX) * 0.012; lastX = event.clientX; schedule();}};
    const end = () => {dragging = false;};
    const lost = (event: Event) => {event.preventDefault(); setError(true); visible = false; cancelAnimationFrame(frame); frame = 0;};
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', end); renderer.domElement.addEventListener('pointercancel', end);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      disposed = true; cancelAnimationFrame(frame); update.current = null; invalidate.current = () => {};
      observer.disconnect(); resizeObserver.disconnect(); preference.removeEventListener('change', onPreference); mobile.removeEventListener('change', onMobile);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', end); renderer.domElement.removeEventListener('pointercancel', end);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      disposeAvatarObject(scene); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);

  useEffect(() => {update.current?.(props, quality === 'low', anatomyView);}, [props, quality, anatomyView]);
  const changeView = (rotation: number, zoom: number) => {
    controls.current.rotation += rotation;
    controls.current.zoom = THREE.MathUtils.clamp(controls.current.zoom + zoom, 0.82, 1.65);
    invalidate.current();
  };
  return <div className="avatar-viewer">
    <div ref={host} className={`avatar-canvas ${props.equipped.moldura ? 'avatar-frame' : ''}`} role="img" aria-label="Avatar 3D anime personalizado, girável e conectado à sua evolução" />
    {error && <p role="alert">O 3D ficou indisponível neste dispositivo. Recarregue a página para tentar novamente. Seus dados continuam salvos.</p>}
    <div className="avatar-rotation" aria-label="Controles da prévia 3D">
      <button type="button" onClick={() => changeView(-0.4, 0)} aria-label="Girar avatar à esquerda">←</button>
      <span>Arraste para girar</span>
      <button type="button" onClick={() => changeView(0, 0.1)} aria-label="Aproximar avatar">+</button>
      <button type="button" onClick={() => changeView(0, -0.1)} aria-label="Afastar avatar">−</button>
      <button type="button" onClick={() => changeView(0.4, 0)} aria-label="Girar avatar à direita">→</button>
    </div>
    <div className="avatar-view-options">
      <button type="button" aria-pressed={anatomyView} onClick={() => setAnatomyView(v => !v)}>{anatomyView ? 'Ver roupas' : 'Ver anatomia'}</button>
      <button type="button" onClick={() => {controls.current = {rotation: 0, zoom: 1}; invalidate.current();}}>Centralizar</button>
      <button type="button" aria-pressed={quality === 'low'} onClick={() => setQuality(q => q === 'low' ? 'auto' : 'low')}>Qualidade reduzida</button>
    </div>
  </div>;
}
