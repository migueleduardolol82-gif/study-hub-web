"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ParticleWaveProps {
  className?: string;
}

function ParticleWave({ className = "" }: ParticleWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 5.5, 9);
    camera.lookAt(0, 0, 0);

    const columns = 76;
    const rows = 56;
    const positions = new Float32Array(columns * rows * 3);
    const scales = new Float32Array(columns * rows);
    for (let x = 0; x < columns; x++) {
      for (let z = 0; z < rows; z++) {
        const index = x * rows + z;
        positions[index * 3] = (x - (columns - 1) / 2) * 0.18;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = (z - (rows - 1) / 2) * 0.18;
        scales[index] = 0.65 + (index % 5) * 0.08;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float scale;
        uniform float uTime;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.y += sin(p.x * 0.7 + uTime) * 0.28 + cos(p.z * 0.8 + uTime * 0.7) * 0.25;
          vec4 view = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = min(5.0, scale * 18.0 / -view.z);
          gl_Position = projectionMatrix * view;
          vFade = 1.0 - smoothstep(3.2, 7.2, length(p.xz));
        }
      `,
      fragmentShader: `
        varying float vFade;
        void main() {
          float circle = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - 0.5));
          gl_FragColor = vec4(1.0, 1.0, 1.0, circle * vFade * 0.34);
        }
      `,
    });
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let lastTime = 0;
    const animate = (time: number) => {
      frame = window.requestAnimationFrame(animate);
      if (document.hidden || reducedMotion.matches || time - lastTime < 32) return;
      lastTime = time;
      material.uniforms.uTime.value = time * 0.0007;
      renderer.render(scene, camera);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      scene.remove(particles);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export { ParticleWave };
