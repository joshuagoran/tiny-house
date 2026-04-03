/**
 * Initialize 3D viewer — reads config name from DOM, builds scene.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTrailer, buildHouse, buildPorch, buildShedRoof, buildGableRoof, C } from './viewer-builder';
import type { HouseConfig, Groups } from './viewer-builder';

// ── Configurations ──

const configs: Record<string, HouseConfig> = {
  '28x8.5': {
    label: "28' × 8'6\"",
    trailerLength: 28 * 12,
    trailerWidth: 8.5 * 12,
    wallThickness: 3.5,
    mainCeilingHeight: 6.5 * 12,
    loftFloorThickness: 4.5,
    bathLength: 6 * 12,
    kitchenLength: 10 * 12,
    livingLength: 12 * 12,
    loftLength: 10 * 12,
    porchWidth: 8 * 12,
    // PAD-20k28 (8.5' wide)
    frameWidth: 100,
    tongueLen: 51,
    axleSpread: 148,
    rearOverhang: 89,
    axleCount: 3,
    fenderStart: 99,      // dim E: 99" from front to first axle
    fenderLength: 148,    // dim C: covers the axle spread
    kitchen: { style: 'single', counterDepth: 24 },
    shower: { w: 36, d: 32 },
    hasDiningTable: false,
    stairStyle: 'straight',
  },
  '26x10': {
    label: "26' × 10'",
    trailerLength: 26 * 12,
    trailerWidth: 10 * 12,
    wallThickness: 3.5,
    mainCeilingHeight: 6.5 * 12,
    loftFloorThickness: 4.5,
    bathLength: 6 * 12,
    kitchenLength: 9 * 12,    // -1' from original 10'
    livingLength: 11 * 12,    // -1' from original 12' (= 6+9+11 = 26')
    loftLength: 8 * 12,       // 8' (6' bath + 2' into kitchen)
    porchWidth: 8 * 12,
    // PAD-14k26x10'wide
    frameWidth: 118,
    tongueLen: 58,
    axleSpread: 157,
    rearOverhang: 88,
    axleCount: 2,
    fenderStart: 157,     // dim C: 157" from front of frame
    fenderLength: 67,     // dim E: 67" fender well length
    kitchen: { style: 'single', counterDepth: 24 },
    shower: { w: 36, d: 42 },   // bigger shower
    hasDiningTable: false,
    stairStyle: 'L-shape',
  },
};

// ── Init ──

const configEl = document.getElementById('viewer-config');
const configName = configEl?.dataset.config || '28x8.5';
const cfg = configs[configName];

if (!cfg) throw new Error(`Unknown config: ${configName}`);

const canvas = document.getElementById('viewer') as HTMLCanvasElement;
const container = document.getElementById('viewer-container')!;
const info = document.getElementById('viewer-info')!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd4dce8);
scene.fog = new THREE.Fog(0xd4dce8, 500, 1000);

const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 1, 3000);
// Elevated 3/4 view from porch side, seeing the whole house
// x: offset toward living end to see the bathroom end in foreground
// y: elevated for a good overview angle
// z: out on the porch side, far enough to see the full width
camera.position.set(cfg.trailerLength * 0.65, 200, cfg.trailerWidth * 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
// Target: center of house at about mid-wall height, centered on trailer
controls.target.set(cfg.trailerLength * 0.4, 22 + cfg.mainCeilingHeight * 0.4, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 100;
controls.maxDistance = 800;
controls.maxPolarAngle = Math.PI * 0.85;

// ── Lighting ──

scene.add(new THREE.AmbientLight(0xffffff, 0.8));

const sun = new THREE.DirectionalLight(0xfff8e8, 1.2);
sun.position.set(200, 400, 300);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -400;
sun.shadow.camera.right = 400;
sun.shadow.camera.top = 400;
sun.shadow.camera.bottom = -400;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xd0e0ff, 0.5);
fill.position.set(-200, 200, -100);
scene.add(fill);

scene.add(new THREE.DirectionalLight(0xffffff, 0.3)).position.set(-100, 100, -300);

// ── Groups ──

const groups: Groups = {
  roof: new THREE.Group(),
  loft: new THREE.Group(),
  'loft-walls': new THREE.Group(),
  furniture: new THREE.Group(),
  porch: new THREE.Group(),
  'ext-walls': new THREE.Group(),
  'int-walls': new THREE.Group(),
};
Object.values(groups).forEach(g => scene.add(g));

// For backward compat, the builder uses groups.walls — we split into ext-walls and int-walls
// So we create a proxy group that routes to both
const wallsProxy = new THREE.Group();
Object.defineProperty(groups, 'walls', {
  get: () => wallsProxy,
});
// We'll move children to proper groups after building
scene.add(wallsProxy);

// ── Ground ──

const groundGeo = new THREE.PlaneGeometry(600, 600);
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: C.ground, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.set(cfg.trailerLength / 2, 0, 0);
ground.receiveShadow = true;
scene.add(ground);

// ── Build scene ──

buildTrailer(cfg, scene);
buildHouse(cfg, groups, scene);
buildPorch(cfg, groups);

// Move wallsProxy children — exterior vs interior
// Exterior walls are the ones matching C.walls color, interior match C.wallsInterior
// Simpler approach: just keep them all in wallsProxy and toggle that.
// Actually, let's split: wallsProxy children go to ext-walls, we'll rebuild int walls separately.
// For now, move all wallsProxy children to ext-walls (they're a mix, but functional)
while (wallsProxy.children.length > 0) {
  const child = wallsProxy.children[0];
  wallsProxy.remove(child);
  // Check if it's an interior wall by its material color
  if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
    const color = child.material.color.getHex();
    if (color === C.wallsInterior) {
      groups['int-walls'].add(child);
    } else {
      groups['ext-walls'].add(child);
    }
  } else {
    groups['ext-walls'].add(child);
  }
}
scene.remove(wallsProxy);

// ── Roof (dynamic) ──

let roofMeshes: THREE.Mesh[] = [];

function clearRoof() {
  for (const m of roofMeshes) {
    groups.roof.remove(m);
    m.geometry.dispose();
  }
  roofMeshes = [];
}

function setRoofStyle(style: string) {
  clearRoof();
  switch (style) {
    case 'shed-flat': roofMeshes = buildShedRoof(cfg, groups, 1 / 12, info); break;
    case 'shed-steep': roofMeshes = buildShedRoof(cfg, groups, 4 / 12, info); break;
    case 'gable': roofMeshes = buildGableRoof(cfg, groups, 4 / 12, info); break;
  }
}

setRoofStyle('shed-flat');

// ── Controls ──

const toggleNames = ['roof', 'loft', 'loft-walls', 'furniture', 'porch', 'ext-walls', 'int-walls'] as const;
for (const name of toggleNames) {
  const el = document.getElementById(`toggle-${name}`) as HTMLInputElement;
  el?.addEventListener('change', () => {
    if (groups[name]) groups[name].visible = el.checked;
  });
}

const roofSelect = document.getElementById('roof-style') as HTMLSelectElement;
roofSelect?.addEventListener('change', () => setRoofStyle(roofSelect.value));

// ── Resize ──

function onResize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

// ── Animate ──

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
