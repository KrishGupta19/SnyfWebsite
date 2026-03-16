/**
 * Snyf — Immersive 3D Scroll-Driven Experience
 * Three.js + GSAP ScrollTrigger
 *
 * Act 1 — The Past    (Hero)     Warm off-white / editorial paper world
 * Act 2 — The Present (Problem)  Muted red-grey / crisis tones
 * Act 3 — The Future  (Solution) Institutional monochrome / data network
 */

import * as THREE from 'three';

// ── GSAP globals (loaded via CDN <script> tags before this module) ────────────
const gsap = window.gsap;
const { ScrollTrigger } = window;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

// ── Device detection ──────────────────────────────────────────────────────────
const isMobile = window.innerWidth <= 768;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Canvas + Renderer ─────────────────────────────────────────────────────────
const canvas = document.getElementById('bg-canvas');
if (!canvas) throw new Error('Snyf 3D: #bg-canvas not found in DOM');

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !isMobile,
  alpha: false,
  powerPreference: isMobile ? 'low-power' : 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xF5F3EF, 1); // Act 1 initial — warm off-white

// ── Scene + Fog ───────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xF5F3EF, 0.008); // Act 1 fog

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

// baseCam is tweened by GSAP on act transitions
const baseCam = { x: -3, y: 3, z: 40 };
// camLookAt is also tweened
const camLookAt = new THREE.Vector3(0, 1, 0);
camera.position.set(baseCam.x, baseCam.y, baseCam.z);

// ── Act theme definitions ─────────────────────────────────────────────────────
// ACT_THEME — Light neutral
const ACT_THEME = {
  1: { fogColor: 0xF5F3EF, fogDensity: 0.008, clearColor: 0xF5F3EF }, // warm off-white
  2: { fogColor: 0xF5EEEE, fogDensity: 0.010, clearColor: 0xF5EEEE }, // faint rose-white
  3: { fogColor: 0xF4F6F9, fogDensity: 0.008, clearColor: 0xF4F6F9 }, // cool neutral white
};

// Camera destination per act
const CAM_DEST = {
  1: { px: -3, py: 3, pz: 40, lx: 0, ly: 1, lz: 0 },
  2: { px: 4, py: -2, pz: 38, lx: 0, ly: -1, lz: -6 },
  3: { px: 0, py: 0, pz: 40, lx: 0, ly: 0, lz: 0 },
};

// ── Scene groups (one per act) ────────────────────────────────────────────────
const g1 = new THREE.Group(); // Act 1 — Past
const g2 = new THREE.Group(); // Act 2 — Present (Chaos)
const g3 = new THREE.Group(); // Act 3 — Future (Snyf)
const actGroups = { 1: g1, 2: g2, 3: g3 };
scene.add(g1, g2, g3);
g2.visible = false;
g3.visible = false;

let currentAct = 1;
let activeTL = null; // active GSAP transition timeline

// ════════════════════════════════════════════════════════════════════════════════
//  ACT 1 — EDITORIAL / PAPER WORLD (light)
// ════════════════════════════════════════════════════════════════════════════════

// Warm dust particle field
const A1_COUNT = isMobile ? 900 : 2400;
{
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A1_COUNT * 3);
  const col = new Float32Array(A1_COUNT * 3);
  const palette = [
    [0.72, 0.68, 0.62], // warm grey
    [0.60, 0.57, 0.52], // mid grey
    [0.80, 0.77, 0.72], // light warm grey
    [0.50, 0.47, 0.43], // darker grey
  ];
  for (let i = 0; i < A1_COUNT; i++) {
    const i3 = i * 3;
    pos[i3] = (Math.random() - 0.5) * 180;
    pos[i3 + 1] = (Math.random() - 0.5) * 100;
    pos[i3 + 2] = (Math.random() - 0.5) * 90;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.10, vertexColors: true, transparent: true, opacity: 0.35,
    blending: THREE.NormalBlending, depthWrite: false,
  }));
  pts.name = 'a1dust';
  g1.add(pts);
}

// Floating paper / ledger planes
const act1Papers = [];
{
  const pGeo = new THREE.PlaneGeometry(3.5, 2.4);
  const count = isMobile ? 12 : 28;
  for (let i = 0; i < count; i++) {
    const wireframe = Math.random() > 0.45;
    const mat = new THREE.MeshBasicMaterial({
      color: wireframe ? 0xB0A898 : 0xD8D0C4,
      transparent: true,
      opacity: wireframe ? 0.20 : 0.10,
      side: THREE.DoubleSide,
      wireframe,
    });
    const mesh = new THREE.Mesh(pGeo, mat);
    const x = (Math.random() - 0.5) * 80;
    const y = (Math.random() - 0.5) * 45;
    const z = -10 - Math.random() * 50;
    mesh.position.set(x, y, z);
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI,
    );
    mesh.userData = {
      baseY: y,
      amp: 0.3 + Math.random() * 0.7,
      freq: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      rspd: (Math.random() - 0.5) * 0.003,
    };
    g1.add(mesh);
    act1Papers.push(mesh);
  }
}

// Central editorial orb
const a1OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0xE8E2D8,
  emissive: new THREE.Color(0xC8BEA8),
  emissiveIntensity: 0.15,
  metalness: 0.0, roughness: 0.9,
  transparent: true, opacity: 0.35,
});
const a1Orb = new THREE.Mesh(new THREE.SphereGeometry(3, 48, 48), a1OrbMat);
g1.add(a1Orb);

// Warm torus rings
{
  const rGeo = new THREE.TorusGeometry(5, 0.055, 8, 100);
  const r1 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0xC8BEA8, transparent: true, opacity: 0.12,
  }));
  r1.rotation.x = Math.PI / 2;
  r1.name = 'a1r1';
  const r2 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0xC8BEA8, transparent: true, opacity: 0.08,
  }));
  r2.rotation.set(0.9, 1.1, 0);
  r2.name = 'a1r2';
  g1.add(r1, r2);
}

// Act 1 lights
{
  g1.add(new THREE.AmbientLight(0xD4C8B4, 0.6));
  const l1 = new THREE.PointLight(0xC8BEA8, 20, 60);
  l1.position.set(6, 8, 12); l1.name = 'a1l1'; g1.add(l1);
  g1.add(Object.assign(new THREE.PointLight(0xB0A090, 15, 40), { position: new THREE.Vector3(-9, -6, 6) }));
}

// ════════════════════════════════════════════════════════════════════════════════
//  ACT 2 — CRISIS (muted red-grey tones)
// ════════════════════════════════════════════════════════════════════════════════

// Star shape geometry factory
function makeStarGeo(spikes = 5, outerR = 0.55, innerR = 0.24, depth = 0.1) {
  const shape = new THREE.Shape();
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = i * step - Math.PI / 2;
    i === 0
      ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

const STAR_COUNT = isMobile ? 80 : 180;
const starsMesh = new THREE.InstancedMesh(
  makeStarGeo(),
  new THREE.MeshBasicMaterial({ color: 0x8B3333, transparent: true, opacity: 0.55 }),
  STAR_COUNT,
);
starsMesh.name = 'rainStars';
g2.add(starsMesh);

const starData = Array.from({ length: STAR_COUNT }, () => ({
  x: (Math.random() - 0.5) * 90,
  y: 30 + Math.random() * 50,
  z: (Math.random() - 0.5) * 60,
  speed: 3 + Math.random() * 6,
  rotZ: Math.random() * Math.PI * 2,
  rotSpeed: (Math.random() - 0.5) * 2.5,
  scale: 0.6 + Math.random() * 1.8,
}));

// Chaos / noise particle cloud — muted red-grey
const A2_COUNT = isMobile ? 600 : 1800;
{
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A2_COUNT * 3);
  const col = new Float32Array(A2_COUNT * 3);
  const palette = [
    [0.55, 0.25, 0.25],
    [0.45, 0.20, 0.20],
    [0.60, 0.35, 0.35],
    [0.50, 0.30, 0.30],
  ];
  for (let i = 0; i < A2_COUNT; i++) {
    const i3 = i * 3;
    pos[i3] = (Math.random() - 0.5) * 130;
    pos[i3 + 1] = (Math.random() - 0.5) * 75;
    pos[i3 + 2] = (Math.random() - 0.5) * 65;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.10, vertexColors: true, transparent: true, opacity: 0.30,
    blending: THREE.NormalBlending, depthWrite: false,
  }));
  pts.name = 'a2chaos';
  g2.add(pts);
}

// Wireframe bot silhouettes — muted
const act2Bots = [];
{
  const bGeo = new THREE.BoxGeometry(1.8, 2.2, 0.6);
  const count = isMobile ? 6 : 18;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: 0x8B3333, wireframe: true, transparent: true,
      opacity: 0.08 + Math.random() * 0.06,
    }));
    mesh.position.set(
      (Math.random() - 0.5) * 70,
      (Math.random() - 0.5) * 35,
      (Math.random() - 0.5) * 35,
    );
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.userData = { phase: Math.random() * Math.PI * 2, spd: 0.8 + Math.random() * 0.8 };
    g2.add(mesh);
    act2Bots.push(mesh);
  }
}

// Central warning / broken orb — muted rose
const a2OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0xF0E8E8, emissive: new THREE.Color(0xCC4444),
  emissiveIntensity: 0.15, metalness: 0.2, roughness: 0.4,
  transparent: true, opacity: 0.30,
});
const a2Orb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), a2OrbMat);
g2.add(a2Orb);

// Act 2 lights
{
  g2.add(new THREE.AmbientLight(0xD4B4B4, 0.5));
  const l1 = new THREE.PointLight(0xCC3333, 20, 60);
  l1.position.set(0, 10, 10); l1.name = 'a2l1'; g2.add(l1);
  g2.add(Object.assign(new THREE.PointLight(0xAA6666, 15, 45), { position: new THREE.Vector3(12, -6, 6) }));
}

// ════════════════════════════════════════════════════════════════════════════════
//  ACT 3 — STRUCTURAL / MONOCHROME (institutional data network)
// ════════════════════════════════════════════════════════════════════════════════

// Institutional particle field
const A3_COUNT = isMobile ? 700 : 2500;
const a3Particles = (() => {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A3_COUNT * 3);
  const col = new Float32Array(A3_COUNT * 3);
  const palette = [
    [0.10, 0.11, 0.14], // near black
    [0.22, 0.25, 0.30], // dark grey
    [0.30, 0.33, 0.38], // mid grey
    [0.42, 0.45, 0.52], // lighter grey
  ];
  for (let i = 0; i < A3_COUNT; i++) {
    const i3 = i * 3;
    pos[i3] = (Math.random() - 0.5) * 170;
    pos[i3 + 1] = (Math.random() - 0.5) * 95;
    pos[i3 + 2] = (Math.random() - 0.5) * 65;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i3] = c[0]; col[i3 + 1] = c[1]; col[i3 + 2] = c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.09, vertexColors: true, transparent: true, opacity: 0.28,
    blending: THREE.NormalBlending, depthWrite: false,
  }));
  g3.add(pts);
  return pts;
})();

// Data nodes + connection lines — monochrome
const nodePos3 = [];
const nodeMesh3 = [];
{
  const NODE_COUNT = isMobile ? 22 : 65;
  const sGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const colors = [0x1A1A1A, 0x374151, 0x4B5563, 0x6B7280];

  for (let i = 0; i < NODE_COUNT; i++) {
    const p = new THREE.Vector3(
      (Math.random() - 0.5) * 95,
      (Math.random() - 0.5) * 52,
      (Math.random() - 0.5) * 32,
    );
    const mesh = new THREE.Mesh(sGeo, new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true, opacity: 0.8,
    }));
    mesh.position.copy(p);
    g3.add(mesh);
    nodePos3.push(p);
    nodeMesh3.push(mesh);
  }

  // Connection lines (O(n²) but done once at load)
  const CONN_DIST = 18;
  for (let i = 0; i < nodePos3.length; i++) {
    for (let j = i + 1; j < nodePos3.length; j++) {
      const d = nodePos3[i].distanceTo(nodePos3[j]);
      if (d < CONN_DIST) {
        const lGeo = new THREE.BufferGeometry().setFromPoints([nodePos3[i], nodePos3[j]]);
        g3.add(new THREE.Line(lGeo, new THREE.LineBasicMaterial({
          color: 0x374151, transparent: true,
          opacity: (1 - d / CONN_DIST) * 0.12,
          depthWrite: false,
        })));
      }
    }
  }
}

// Central institutional core orb
const a3OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0x1A1A1A,
  emissive: new THREE.Color(0x374151),
  emissiveIntensity: 0.4,
  metalness: 0.8, roughness: 0.15,
  clearcoat: 1, clearcoatRoughness: 0.05,
  transparent: true, opacity: 0.90,
});
const a3Orb = new THREE.Mesh(new THREE.SphereGeometry(3.5, 64, 64), a3OrbMat);
g3.add(a3Orb);

// Structural rings — monochrome
const a3Rings = (() => {
  const rGeo = new THREE.TorusGeometry(5.2, 0.06, 12, 120);
  const r1 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x374151, transparent: true, opacity: 0.10,
  }));
  r1.rotation.x = Math.PI / 2;
  const r2 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x4B5563, transparent: true, opacity: 0.07,
  }));
  r2.rotation.set(0.6, 1.2, 0);
  g3.add(r1, r2);
  return [r1, r2];
})();

// Institutional data bar chart (floating right of center)
{
  const bars = [
    { val: 0.92, color: 0x1A1A1A }, // Food
    { val: 0.87, color: 0x374151 }, // Ambience
    { val: 0.75, color: 0x4B5563 }, // Service
    { val: 0.81, color: 0x6B7280 }, // Value
    { val: 0.54, color: 0x9CA3AF }, // Speed
  ];
  bars.forEach((b, i) => {
    const h = b.val * 9;
    const bGeo = new THREE.BoxGeometry(0.65, h, 0.45);
    const x = (i - 2) * 2.3 + 14;
    const y = h / 2 - 4.5;
    const fill = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: b.color, transparent: true, opacity: 0.20,
    }));
    fill.position.set(x, y, -8);
    const wire = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: b.color, wireframe: true, transparent: true, opacity: 0.45,
    }));
    wire.position.copy(fill.position);
    g3.add(fill, wire);
  });
}

// Act 3 lights — institutional
const a3L1 = new THREE.PointLight(0x374151, 25, 70);
a3L1.position.set(12, 12, 12); a3L1.name = 'a3l1'; g3.add(a3L1);
const a3L2 = new THREE.PointLight(0x1A1A1A, 15, 60);
a3L2.position.set(-12, -12, -6); a3L2.name = 'a3l2'; g3.add(a3L2);
g3.add(new THREE.AmbientLight(0xffffff, 0.8));

// ════════════════════════════════════════════════════════════════════════════════
//  TRANSITION SYSTEM
// ════════════════════════════════════════════════════════════════════════════════

const overlay = document.getElementById('scene-transition-overlay');

function applyActTheme(act) {
  const t = ACT_THEME[act];
  renderer.setClearColor(t.clearColor, 1);
  scene.fog.color.set(t.fogColor);
  scene.fog.density = t.fogDensity;

  const d = CAM_DEST[act];
  baseCam.x = d.px; baseCam.y = d.py; baseCam.z = d.pz;
  camLookAt.set(d.lx, d.ly, d.lz);
  // Hard-set camera for instant repositioning at peak of fade
  camera.position.set(d.px, d.py, d.pz);
  // Mouse lerp reset
  camLX = 0; camLY = 0;

  // No canvas filter — institutional light mode uses no image effects
  canvas.style.filter = 'none';
}

function transitionToAct(newAct) {
  if (newAct === currentAct) return;

  // Kill any running transition and snap overlay visible to avoid flash
  if (activeTL) activeTL.kill();

  const prevAct = currentAct;
  currentAct = newAct;

  activeTL = gsap.timeline({ onComplete: () => { activeTL = null; } })
    .to(overlay, { opacity: 1, duration: 0.4, ease: 'power2.in' })
    .call(() => {
      actGroups[prevAct].visible = false;
      actGroups[newAct].visible = true;
      applyActTheme(newAct);
    })
    .to(overlay, { opacity: 0, duration: 0.6, ease: 'power2.out' });
}

// ── Mouse/parallax state — declared here so applyActTheme can reset them ─────
let mouseX = 0, mouseY = 0, camLX = 0, camLY = 0;

// Apply initial theme without transition
applyActTheme(1);

// ════════════════════════════════════════════════════════════════════════════════
//  GSAP SCROLL TRIGGERS
// ════════════════════════════════════════════════════════════════════════════════

function initScrollTriggers() {
  if (!gsap || !ScrollTrigger) {
    console.warn('Snyf 3D: GSAP/ScrollTrigger not available — scroll transitions disabled');
    return;
  }

  // Act 1 → 2: Problem section enters
  ScrollTrigger.create({
    trigger: '#problem',
    start: 'top 62%',
    onEnter: () => transitionToAct(2),
    onLeaveBack: () => transitionToAct(1),
  });

  // Act 2 → 3: Solution section enters
  ScrollTrigger.create({
    trigger: '#solution',
    start: 'top 62%',
    onEnter: () => transitionToAct(3),
    onLeaveBack: () => transitionToAct(2),
  });

  // Subtle z-scrub through Act 2 (creates a sense of flying through the chaos)
  ScrollTrigger.create({
    trigger: '#problem',
    start: 'top 62%',
    end: 'bottom 20%',
    scrub: 1.5,
    onUpdate(self) {
      if (currentAct !== 2) return;
      camera.position.z = CAM_DEST[2].pz - self.progress * 5;
    },
  });
}

// ════════════════════════════════════════════════════════════════════════════════
//  MOUSE / TOUCH PARALLAX
// ════════════════════════════════════════════════════════════════════════════════

window.addEventListener('mousemove', e => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

window.addEventListener('touchmove', e => {
  mouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 1.3;
  mouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 1.3;
}, { passive: true });

// ════════════════════════════════════════════════════════════════════════════════
//  RESIZE
// ════════════════════════════════════════════════════════════════════════════════

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  }, 150);
}, { passive: true });

// ════════════════════════════════════════════════════════════════════════════════
//  ANIMATION LOOP
// ════════════════════════════════════════════════════════════════════════════════

const clock = new THREE.Clock();
const dummy = new THREE.Object3D(); // reused for InstancedMesh
let animPaused = false;

document.addEventListener('visibilitychange', () => {
  animPaused = document.hidden;
  if (!animPaused) animate();
});

function animate() {
  if (animPaused) return;
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // ── Mouse camera parallax ────────────────────────────────────────────────────
  camLX += (mouseX * 5 - camLX) * 0.04;
  camLY += (-mouseY * 3 - camLY) * 0.04;
  camera.position.x = baseCam.x + camLX;
  camera.position.y = baseCam.y + camLY;
  camera.lookAt(
    camLookAt.x + camLX * 0.15,
    camLookAt.y + camLY * 0.15,
    camLookAt.z,
  );

  // ── ACT 1 — Editorial / Paper World ─────────────────────────────────────────
  if (g1.visible) {
    const dust = g1.getObjectByName('a1dust');
    if (dust) { dust.rotation.y += 0.00022; dust.rotation.x += 0.00008; }

    // Subtle orb breathe — no dramatic flicker
    a1OrbMat.emissiveIntensity = 0.12
      + 0.04 * Math.sin(t * 1.8 + 0.3)
      + 0.02 * Math.sin(t * 5.2);
    a1Orb.scale.setScalar(1 + 0.03 * Math.sin(t * 1.4));

    const r1 = g1.getObjectByName('a1r1');
    const r2 = g1.getObjectByName('a1r2');
    if (r1) r1.rotation.z = t * 0.14;
    if (r2) r2.rotation.z = -t * 0.09;

    const l1 = g1.getObjectByName('a1l1');
    if (l1) {
      l1.position.x = Math.sin(t * 0.45) * 10;
      l1.position.z = Math.cos(t * 0.45) * 10;
      // Gentle light oscillation
      l1.intensity = 18 + Math.sin(t * 2.3) * 4;
    }

    for (const p of act1Papers) {
      const d = p.userData;
      p.position.y = d.baseY + Math.sin(t * d.freq + d.phase) * d.amp;
      p.rotation.z += d.rspd;
    }
  }

  // ── ACT 2 — Crisis / Muted Red World ─────────────────────────────────────────
  if (g2.visible) {
    const chaos = g2.getObjectByName('a2chaos');
    if (chaos) { chaos.rotation.y -= 0.0009; chaos.rotation.z += 0.00045; }

    // Rain stars downward, loop back to top
    for (let i = 0; i < STAR_COUNT; i++) {
      const sd = starData[i];
      sd.y -= sd.speed * 0.018;
      sd.rotZ += sd.rotSpeed * 0.018;
      if (sd.y < -35) {
        sd.y = 42 + Math.random() * 14;
        sd.x = (Math.random() - 0.5) * 90;
      }
      dummy.position.set(sd.x, sd.y, sd.z);
      dummy.scale.setScalar(sd.scale);
      dummy.rotation.z = sd.rotZ;
      dummy.updateMatrix();
      starsMesh.setMatrixAt(i, dummy.matrix);
    }
    starsMesh.instanceMatrix.needsUpdate = true;

    // Pulsing muted warning orb
    a2OrbMat.emissiveIntensity = 0.12 + 0.08 * Math.abs(Math.sin(t * 2.8));
    a2Orb.scale.setScalar(1 + 0.04 * Math.sin(t * 3.1));

    // Bot jitter
    for (const bot of act2Bots) {
      bot.position.y += Math.sin(t * bot.userData.spd + bot.userData.phase) * 0.004;
      bot.rotation.y += 0.003;
    }

    // Muted flickering light
    const l1 = g2.getObjectByName('a2l1');
    if (l1) l1.intensity = 18 + Math.sin(t * 5.1) * 6;
  }

  // ── ACT 3 — Institutional / Data Network World ───────────────────────────────
  if (g3.visible) {
    a3Particles.rotation.y += 0.00028;
    a3Particles.rotation.x += 0.00009;

    // Breathing institutional core
    a3OrbMat.emissiveIntensity = 0.4 + 0.06 * Math.sin(t * 1.5);
    a3Orb.scale.setScalar(1 + 0.03 * Math.sin(t * 1.5));

    // Orbiting structural rings
    a3Rings[0].rotation.z = t * 0.28;
    a3Rings[1].rotation.z = -t * 0.19;
    a3Rings[1].rotation.x = 0.6 + Math.sin(t * 0.45) * 0.2;

    // Orbiting point lights
    a3L1.position.x = Math.sin(t * 0.52) * 16;
    a3L1.position.z = Math.cos(t * 0.52) * 16;
    a3L2.position.x = Math.sin(t * 0.52 + Math.PI) * 12;
    a3L2.position.z = Math.cos(t * 0.52 + Math.PI) * 12;

    // Floating data nodes
    for (let i = 0; i < nodeMesh3.length; i++) {
      nodeMesh3[i].position.y = nodePos3[i].y + Math.sin(t * 0.5 + i * 0.42) * 0.5;
    }
  }

  renderer.render(scene, camera);
}

animate();
initScrollTriggers();
