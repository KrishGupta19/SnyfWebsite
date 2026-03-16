/**


* Snyf — Immersive 3D Scroll-Driven Experience
 * Three.js + GSAP ScrollTrigger
 *
 * Act 1 — The Past    (Hero)     Warm sepia/candlelight — vintage newspaper world
 * Act 2 — The Present (Problem)  Chaotic red/gold — raining stars, glitch bots
 * Act 3 — The Future  (Solution) Premium neon — Snyf AI data nodes & clarity
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
renderer.setClearColor(0x0d0804, 1); // Act 1 initial bg

// ── Scene + Fog ───────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x1a0e05, 0.018); // Act 1 fog

// ── Camera ────────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);

// baseCam is tweened by GSAP on act transitions
const baseCam = { x: -3, y: 3, z: 40 };
// camLookAt is also tweened
const camLookAt = new THREE.Vector3(0, 1, 0);
camera.position.set(baseCam.x, baseCam.y, baseCam.z);

// ── Act theme definitions ─────────────────────────────────────────────────────
const ACT_THEME = {
  1: { fogColor: 0x1a0e05, fogDensity: 0.018, clearColor: 0x0d0804 },
  2: { fogColor: 0x1a0505, fogDensity: 0.022, clearColor: 0x100505 },
  3: { fogColor: 0x05070f, fogDensity: 0.016, clearColor: 0x05070f },
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
//  ACT 1 — THE PAST  (Vintage / Candlelight World)
// ════════════════════════════════════════════════════════════════════════════════

// Warm dust particle field
const A1_COUNT = isMobile ? 900 : 2400;
{
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A1_COUNT * 3);
  const col = new Float32Array(A1_COUNT * 3);
  const palette = [
    [0.784, 0.663, 0.431], // #c8a96e warm gold
    [0.545, 0.416, 0.078], // #8b6a14 amber
    [0.831, 0.643, 0.353], // #d4a45a sandy
    [0.627, 0.471, 0.227], // #a0783a bronze
    [0.906, 0.784, 0.541], // #e8c88a pale gold
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
    size: 0.13, vertexColors: true, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
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
      color: wireframe ? 0x8b6914 : 0xb89050,
      transparent: true,
      opacity: wireframe ? 0.18 : 0.07,
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

// Central candle orb
const a1OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0x0d0804,
  emissive: new THREE.Color(0xd4a45a),
  emissiveIntensity: 0.35,
  metalness: 0.1, roughness: 0.55,
  transparent: true, opacity: 0.82,
});
const a1Orb = new THREE.Mesh(new THREE.SphereGeometry(3, 48, 48), a1OrbMat);
g1.add(a1Orb);

// Warm torus rings
{
  const rGeo = new THREE.TorusGeometry(5, 0.055, 8, 100);
  const r1 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0xd4a45a, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending,
  }));
  r1.rotation.x = Math.PI / 2;
  r1.name = 'a1r1';
  const r2 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x8b6914, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending,
  }));
  r2.rotation.set(0.9, 1.1, 0);
  r2.name = 'a1r2';
  g1.add(r1, r2);
}

// Act 1 lights
{
  g1.add(new THREE.AmbientLight(0x5a3a1a, 0.35));
  const l1 = new THREE.PointLight(0xd4a45a, 90, 70);
  l1.position.set(6, 8, 12); l1.name = 'a1l1'; g1.add(l1);
  g1.add(Object.assign(new THREE.PointLight(0x8b4513, 55, 45), { position: new THREE.Vector3(-9, -6, 6) }));
}

// ════════════════════════════════════════════════════════════════════════════════
//  ACT 2 — THE PRESENT  (Chaos / Raining Stars / Glitch Bots)
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
  new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.88, blending: THREE.AdditiveBlending }),
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

// Chaos / noise particle cloud
const A2_COUNT = isMobile ? 600 : 1800;
{
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A2_COUNT * 3);
  const col = new Float32Array(A2_COUNT * 3);
  const palette = [
    [1.0, 0.267, 0.267],
    [1.0, 0.843, 0.0],
    [1.0, 0.4, 0.0],
    [1.0, 0.0, 0.0],
    [1.0, 0.667, 0.0],
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
    size: 0.14, vertexColors: true, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pts.name = 'a2chaos';
  g2.add(pts);
}

// Wireframe bot silhouettes
const act2Bots = [];
{
  const bGeo = new THREE.BoxGeometry(1.8, 2.2, 0.6);
  const count = isMobile ? 6 : 18;
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: 0xff3333, wireframe: true, transparent: true,
      opacity: 0.07 + Math.random() * 0.06,
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

// Central warning / broken orb
const a2OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0x100505, emissive: new THREE.Color(0xff2200),
  emissiveIntensity: 0.28, metalness: 0.2, roughness: 0.4,
  transparent: true, opacity: 0.75,
});
const a2Orb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), a2OrbMat);
g2.add(a2Orb);

// Act 2 lights
{
  g2.add(new THREE.AmbientLight(0x3a0a00, 0.4));
  const l1 = new THREE.PointLight(0xff2200, 110, 65);
  l1.position.set(0, 10, 10); l1.name = 'a2l1'; g2.add(l1);
  g2.add(Object.assign(new THREE.PointLight(0xffd700, 65, 45), { position: new THREE.Vector3(12, -6, 6) }));
}

// ════════════════════════════════════════════════════════════════════════════════
//  ACT 3 — THE FUTURE  (Snyf AI / Neon Clarity)
// ════════════════════════════════════════════════════════════════════════════════

// Neon particle field
const A3_COUNT = isMobile ? 700 : 2500;
const a3Particles = (() => {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(A3_COUNT * 3);
  const col = new Float32Array(A3_COUNT * 3);
  const palette = [
    [0.0, 0.831, 1.0], // #00d4ff cyan
    [0.486, 0.361, 0.988], // #7c5cfc violet
    [0.063, 0.851, 0.627], // #10d9a0 green
    [0.231, 0.510, 0.965], // #3b82f6 blue
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
    size: 0.1, vertexColors: true, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  g3.add(pts);
  return pts;
})();

// Data nodes + connection lines
const nodePos3 = [];
const nodeMesh3 = [];
{
  const NODE_COUNT = isMobile ? 22 : 65;
  const sGeo = new THREE.SphereGeometry(0.22, 12, 12);
  const colors = [0x00d4ff, 0x7c5cfc, 0x10d9a0, 0x3b82f6];

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
          color: 0x00d4ff, transparent: true,
          opacity: (1 - d / CONN_DIST) * 0.28,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })));
      }
    }
  }
}

// Central AI core orb
const a3OrbMat = new THREE.MeshPhysicalMaterial({
  color: 0x07090f,
  emissive: new THREE.Color(0x00d4ff),
  emissiveIntensity: 0.12,
  metalness: 0.3, roughness: 0.2,
  clearcoat: 1, clearcoatRoughness: 0.05,
  transparent: true, opacity: 0.72,
});
const a3Orb = new THREE.Mesh(new THREE.SphereGeometry(3.5, 64, 64), a3OrbMat);
g3.add(a3Orb);

// Neon rings
const a3Rings = (() => {
  const rGeo = new THREE.TorusGeometry(5.2, 0.06, 12, 120);
  const r1 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x00d4ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending,
  }));
  r1.rotation.x = Math.PI / 2;
  const r2 = new THREE.Mesh(rGeo, new THREE.MeshBasicMaterial({
    color: 0x7c5cfc, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending,
  }));
  r2.rotation.set(0.6, 1.2, 0);
  g3.add(r1, r2);
  return [r1, r2];
})();

// Holographic data bar chart (floating right of center)
{
  const bars = [
    { val: 0.92, color: 0x00d4ff }, // Food
    { val: 0.87, color: 0x7c5cfc }, // Ambience
    { val: 0.75, color: 0x10d9a0 }, // Service
    { val: 0.81, color: 0x3b82f6 }, // Value
    { val: 0.54, color: 0xf59e0b }, // Speed
  ];
  bars.forEach((b, i) => {
    const h = b.val * 9;
    const bGeo = new THREE.BoxGeometry(0.65, h, 0.45);
    const x = (i - 2) * 2.3 + 14;
    const y = h / 2 - 4.5;
    const fill = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: b.color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending,
    }));
    fill.position.set(x, y, -8);
    const wire = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({
      color: b.color, wireframe: true, transparent: true, opacity: 0.55,
    }));
    wire.position.copy(fill.position);
    g3.add(fill, wire);
  });
}

// Act 3 lights
const a3L1 = new THREE.PointLight(0x00d4ff, 130, 85);
a3L1.position.set(12, 12, 12); a3L1.name = 'a3l1'; g3.add(a3L1);
const a3L2 = new THREE.PointLight(0x7c5cfc, 95, 80);
a3L2.position.set(-12, -12, -6); a3L2.name = 'a3l2'; g3.add(a3L2);
g3.add(new THREE.AmbientLight(0xffffff, 0.4));

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
  // Hard-set camera for instant repositioning at peak of fade-black
  camera.position.set(d.px, d.py, d.pz);
  // Mouse lerp reset
  camLX = 0; camLY = 0;

  canvas.style.filter = act === 2 ? 'contrast(1.12) saturate(1.35)' : 'none';
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

  // ── ACT 1 — Vintage World ────────────────────────────────────────────────────
  if (g1.visible) {
    const dust = g1.getObjectByName('a1dust');
    if (dust) { dust.rotation.y += 0.00022; dust.rotation.x += 0.00008; }

    // Candle flicker — two overlapping sines give organic feel
    a1OrbMat.emissiveIntensity = 0.30
      + 0.15 * Math.sin(t * 1.8 + 0.3)
      + 0.05 * Math.sin(t * 5.2);
    a1Orb.scale.setScalar(1 + 0.05 * Math.sin(t * 1.4));

    const r1 = g1.getObjectByName('a1r1');
    const r2 = g1.getObjectByName('a1r2');
    if (r1) r1.rotation.z = t * 0.14;
    if (r2) r2.rotation.z = -t * 0.09;

    const l1 = g1.getObjectByName('a1l1');
    if (l1) {
      l1.position.x = Math.sin(t * 0.45) * 10;
      l1.position.z = Math.cos(t * 0.45) * 10;
      // Multi-frequency flicker simulates real candle
      l1.intensity = 75 + Math.sin(t * 6.3) * 22 + Math.sin(t * 11.7) * 10;
    }

    for (const p of act1Papers) {
      const d = p.userData;
      p.position.y = d.baseY + Math.sin(t * d.freq + d.phase) * d.amp;
      p.rotation.z += d.rspd;
    }
  }

  // ── ACT 2 — Chaos World ──────────────────────────────────────────────────────
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

    // Pulsing red warning orb
    a2OrbMat.emissiveIntensity = 0.20 + 0.22 * Math.abs(Math.sin(t * 2.8));
    a2Orb.scale.setScalar(1 + 0.04 * Math.sin(t * 3.1));

    // Bot jitter
    for (const bot of act2Bots) {
      bot.position.y += Math.sin(t * bot.userData.spd + bot.userData.phase) * 0.004;
      bot.rotation.y += 0.003;
    }

    // Chaotic flickering light
    const l1 = g2.getObjectByName('a2l1');
    if (l1) l1.intensity = 95 + Math.sin(t * 5.1) * 45;
  }

  // ── ACT 3 — Future / Snyf World ─────────────────────────────────────────────
  if (g3.visible) {
    a3Particles.rotation.y += 0.00028;
    a3Particles.rotation.x += 0.00009;

    // Breathing AI core
    a3OrbMat.emissiveIntensity = 0.12 + 0.07 * Math.sin(t * 1.5);
    a3Orb.scale.setScalar(1 + 0.04 * Math.sin(t * 1.5));

    // Orbiting neon rings
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
