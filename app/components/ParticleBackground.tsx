"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Turns a black & white image into a swaying 3D particle cloud.
 *
 * Every pixel becomes a particle with probability ~ brightness², so bright
 * areas read as dense "dust" and dark areas stay empty. Use a photo with a
 * pure black background for the best result (put it in /public).
 */

type Props = {
  src?: string;
  maxParticles?: number;
  pointSize?: number;
  /** Use for dark subjects on a light background: dark pixels become dense particles. */
  invert?: boolean;
  /** Image height as a fraction of screen height (auto-shrinks to fit narrow screens). */
  scale?: number;
  /** Vertical position of the image's center, as a fraction from the top of the screen. */
  centerY?: number;
  /** Particle brightness multiplier, 0..1. */
  brightness?: number;
  /** Fraction of candidate particles kept, 0..1. Lower = sparser, dimmer overall. */
  density?: number;
  /** Pixels darker than this (after invert) are dropped — removes faint background dust. */
  threshold?: number;
  /** How far particles scatter off their pixel, in world units (image is 10 tall). 0 = crisp. */
  fuzz?: number;
  /** Where the generated ground sits, as a fraction down the image (0 = top, 1 = bottom). */
  groundLine?: number;
  /** Max particles in the generated full-width ground. 0 disables it. */
  groundParticles?: number;
  /** Movement amount: 1 = subtle (original), higher = more sway and shimmer. */
  motion?: number;
  /** Called once, after the image particles have been drawn for the first time. */
  onReady?: () => void;
};

type SampleOptions = {
  maxParticles: number;
  invert: boolean;
  density: number;
  threshold: number;
  fuzz: number;
};

// Roughly gaussian random in about -1..1 (most values near 0, a few further out).
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

// 0 at the image border, 1 once `edge` (fraction of size) inside it.
const edgeFade = (u: number, edge = 0.08) => {
  const d = Math.min(u, 1 - u) / edge;
  const t = Math.min(1, Math.max(0, d));
  return t * t * (3 - 2 * t);
};

const WORLD_HEIGHT = 10; // image spans this many world units vertically
const FOV = 50;

function sampleImage(
  img: HTMLImageElement,
  { maxParticles, invert, density, threshold, fuzz }: SampleOptions,
) {
  // Always sample at ~1600px wide (upscaling small images) so particle density
  // doesn't depend on the source resolution.
  const w = 1600;
  const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const worldWidth = (w / h) * WORLD_HEIGHT;
  const positions: number[] = [];
  const colors: number[] = [];

  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      let lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (invert) lum = 1 - lum;
      // Remap so everything below the threshold vanishes, then fade the borders.
      lum = Math.max(0, (lum - threshold) / (1 - threshold));
      lum *= edgeFade(x / w) * edgeFade(y / h);
      if (lum < 0.02 || Math.random() > lum * lum * density) continue;

      // ~6% of particles stray much further, giving a dusty halo.
      const spread = fuzz * (Math.random() < 0.06 ? 4 : 1);
      positions.push(
        (x / w - 0.5) * worldWidth + gauss() * spread,
        (0.5 - y / h) * WORLD_HEIGHT + gauss() * spread,
        (Math.random() - 0.5) * (0.15 + fuzz * 4), // random depth for shimmer
      );
      if (invert) colors.push(lum, lum, lum);
      else colors.push(r, g, b);
      if (positions.length / 3 >= maxParticles) break outer;
    }
  }

  return { positions: new Float32Array(positions), colors: new Float32Array(colors) };
}

// --- procedural ground ------------------------------------------------------

// Integer hash -> 0..1
const hash2 = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

// Smooth 2D value noise, 0..1
const noise2 = (x: number, y: number) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};

// Fractal noise (4 octaves), roughly 0..1
const fbm = (x: number, y: number) => {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) {
    sum += noise2(x * freq, y * freq) * amp;
    freq *= 2;
    amp *= 0.5;
  }
  return sum / 0.9375;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Camera setup the ground is generated for. */
type GroundView = {
  camY: number; // camera height
  camZ: number; // camera distance from the image plane (z = 0)
  tanHalf: number; // tan(vertical fov / 2)
  aspect: number;
  baseY: number; // ground height where the pineapples stand
};

// Sun direction (normalized): low, from the back-left, so ripples cast shading.
const SUN = (() => {
  const v = [-0.55, 0.45, -0.7];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / l);
})();

/**
 * A 3D sand plain receding to the horizon. Grains are spread evenly in world
 * space, so perspective naturally packs them tighter in the distance. Height
 * comes from broad dunes + wind ripples, and each grain's brightness from how
 * its slope faces a low sun, which makes the terrain read as real ground.
 */
function generateGround(view: GroundView, maxCount: number) {
  const { camY, camZ, tanHalf, aspect, baseY } = view;
  const positions = new Float32Array(maxCount * 3);
  const colors = new Float32Array(maxCount * 3);

  const height = (x: number, z: number) => {
    // Broad, gentle dunes.
    const dunes = (fbm(x * 0.07 + 3.1, z * 0.07 + 8.4) - 0.5) * 1.6;
    // Wind ripples: wavy parallel ridges, warped by noise so they meander.
    const warp = fbm(x * 0.25, z * 0.25) * 3;
    const ripples = Math.sin(x * 0.35 + z * 2.4 + warp) * 0.035;
    // Flatten near where the pineapples stand (x≈0, z≈0) so they sit on it.
    const flat = smoothstep(2, 6, Math.hypot(x, z * 1.5));
    return baseY + dunes * flat + ripples;
  };

  // Depth range (distance from camera): from just below the screen's bottom
  // edge out to the horizon fade.
  const dNear = Math.max(1, (camY - (baseY - 0.8)) / tanHalf);
  const dFar = camZ + 45;
  const e = 0.05;

  let n = 0;
  for (let attempt = 0; attempt < maxCount * 3 && n < maxCount; attempt++) {
    // Uniform per world area within the view frustum: p(d) ∝ d.
    const d = Math.sqrt(dNear * dNear + Math.random() * (dFar * dFar - dNear * dNear));
    const halfW = d * tanHalf * aspect * 1.05;
    const x = (Math.random() * 2 - 1) * halfW;
    const z = camZ - d;
    const y = height(x, z);

    // Surface normal from finite differences, then simple diffuse lighting.
    const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    const nl = Math.hypot(dx, 1, dz);
    const diffuse = Math.max(0, (-dx * SUN[0] + SUN[1] - dz * SUN[2]) / nl);
    const lit = 0.12 + 0.88 * Math.pow(diffuse, 1.6);

    // Fade into darkness toward the horizon.
    const fade = 1 - smoothstep(dFar * 0.35, dFar, d);
    const c = lit * fade * (0.55 + 0.45 * Math.random());

    // Lit areas get more grains, shadowed ones fewer (same idea as the image).
    if (Math.random() > 0.25 + 0.75 * lit) continue;

    positions[n * 3] = x;
    positions[n * 3 + 1] = y;
    positions[n * 3 + 2] = z;
    colors[n * 3] = colors[n * 3 + 1] = colors[n * 3 + 2] = c;
    n++;
  }

  return { positions: positions.subarray(0, n * 3), colors: colors.subarray(0, n * 3) };
}
// ---------------------------------------------------------------------------

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;
  uniform float uMotion;
  attribute vec3 color;
  varying vec3 vColor;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 p = position;
    float t = uTime * (0.6 + 0.4 * uMotion);

    // Shared sway: higher particles move more (bases anchored, leaves drift).
    float amp = (0.012 + 0.04 * max(0.0, (p.y + 3.0) / 8.0)) * uMotion;
    p.x += sin(0.4 * t + 0.6 * p.y + 0.15 * p.x) * amp
         + sin(0.25 * t + 0.3 * p.x) * amp * 0.5;
    p.y += cos(0.35 * t + 0.4 * p.x) * amp * 0.4;
    p.z += sin(0.3 * t + 0.2 * p.y + 0.1 * p.x) * amp * 0.3;

    // Individual drift: each particle circles its spot with its own phase/speed,
    // so the dust shimmers instead of moving as one sheet.
    float r = hash(position);
    float r2 = hash(position.yzx + 7.0);
    float speed = 0.5 + r2 * 1.2;
    float wob = 0.018 * uMotion;
    p.x += sin(t * speed + r * 6.2831) * wob;
    p.y += cos(t * speed * 0.8 + r * 6.2831) * wob;
    p.z += sin(t * speed * 0.6 + r2 * 6.2831) * wob * 2.0;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (uScale / -mv.z); // perspective size attenuation
    vColor = color;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uBrightness;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor * uBrightness, 0.92);
  }
`;

export default function ParticleBackground({
  src = "/source.png",
  maxParticles = 420_000,
  pointSize = 0.014,
  invert = false,
  scale = 0.5,
  centerY = 0.58,
  brightness = 0.55,
  density = 0.6,
  threshold = 0.25,
  fuzz = 0.06,
  groundLine = 0.94,
  groundParticles = 350_000,
  motion = 2.5,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setClearColor("#000000");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    let imageAspect = 1; // width / height, known once the image loads

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: pointSize },
        uScale: { value: 1 },
        uBrightness: { value: brightness },
        uMotion: { value: motion },
      },
      transparent: true,
      depthWrite: false,
    });

    let geometry: THREE.BufferGeometry | null = null;

    // Ground is generated to fit the visible area, so it's rebuilt (debounced)
    // when the screen size changes.
    let groundGeometry: THREE.BufferGeometry | null = null;
    let groundPoints: THREE.Points | null = null;
    let groundTimer: ReturnType<typeof setTimeout> | undefined;
    let groundView: GroundView | null = null;
    let builtView: GroundView | null = null;

    const buildGround = () => {
      if (!groundView || groundParticles <= 0) return;
      if (builtView && Math.abs(builtView.aspect - groundView.aspect) < 0.05 &&
          Math.abs(builtView.camZ - groundView.camZ) < 0.5 &&
          Math.abs(builtView.camY - groundView.camY) < 0.2) return;
      builtView = groundView;
      const { positions, colors } = generateGround(groundView, groundParticles);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      if (groundPoints) scene.remove(groundPoints);
      groundGeometry?.dispose();
      groundGeometry = geo;
      groundPoints = new THREE.Points(geo, material);
      scene.add(groundPoints);
    };

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      // Fraction of screen height the image should occupy; shrink on narrow
      // screens so its width stays within 95% of the screen.
      const heightFrac = Math.min(scale, (0.95 * camera.aspect) / imageAspect);
      const visibleH = WORLD_HEIGHT / heightFrac; // world units visible top-to-bottom
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const dist = visibleH / 2 / tanHalf;
      // Aim the camera so the image center lands at `centerY` down the screen.
      const lookY = (centerY - 0.5) * visibleH;
      camera.position.set(0, lookY, dist);
      camera.lookAt(0, lookY, 0);
      camera.updateProjectionMatrix();
      // Same scale three.js PointsMaterial uses for sizeAttenuation.
      material.uniforms.uScale.value = (h * renderer.getPixelRatio()) / 2;

      groundView = {
        camY: lookY,
        camZ: dist,
        tanHalf,
        aspect: camera.aspect,
        baseY: (0.5 - groundLine) * WORLD_HEIGHT,
      };
      clearTimeout(groundTimer);
      groundTimer = setTimeout(buildGround, builtView ? 250 : 0);
    };

    let cancelled = false;
    let pendingReady = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      imageAspect = img.naturalWidth / img.naturalHeight;
      resize();
      const { positions, colors } = sampleImage(img, { maxParticles, invert, density, threshold, fuzz });
      geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      scene.add(new THREE.Points(geometry, material));
      pendingReady = true;
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (!reduceMotion) material.uniforms.uTime.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      if (pendingReady) {
        pendingReady = false;
        onReadyRef.current?.();
      }
    });

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    return () => {
      cancelled = true;
      clearTimeout(groundTimer);
      ro.disconnect();
      renderer.setAnimationLoop(null);
      geometry?.dispose();
      groundGeometry?.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src, maxParticles, pointSize, invert, scale, centerY, brightness, density, threshold, fuzz, groundLine, groundParticles, motion]);

  return <div ref={containerRef} aria-hidden="true" className="h-full w-full bg-black" />;
}
