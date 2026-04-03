/**
 * Shared 3D scene builder for tiny house viewer.
 * Takes a config object with all dimensions and layout, builds the Three.js scene.
 */
import * as THREE from 'three';

export type HouseConfig = {
  label: string;
  trailerLength: number;
  trailerWidth: number;
  wallThickness: number;
  mainCeilingHeight: number;
  loftFloorThickness: number;
  bathLength: number;
  kitchenLength: number;
  livingLength: number;
  loftLength: number;
  porchWidth: number;
  // Trailer spec
  frameWidth: number;
  tongueLen: number;
  axleSpread: number;
  rearOverhang: number;
  axleCount: number;
  fenderStart: number;   // distance from front of frame to start of fender wells (dim C)
  fenderLength: number;  // length of fender well section (dim E)
  // Layout variant
  kitchen: KitchenLayout;
  shower: { w: number; d: number };
  hasDiningTable: boolean;
  stairStyle: 'straight' | 'L-shape';
};

export type KitchenLayout = {
  style: 'single' | 'L-shape';
  counterDepth: number;
  returnLength?: number; // for L-shape: how far the return runs along the partition wall
};

// Colors
export const C = {
  walls: 0xf5f0e8,
  wallsInterior: 0xe8e4dc,
  floor: 0xd4c9b0,
  loftFloor: 0xc9bea5,
  roof: 0x4a4a4a,
  bath: 0xdcd8ee,
  kitchen: 0xd4e4d6,
  living: 0xd4dfe8,
  furniture: 0xc4a86c,
  fixtures: 0x9ca0b8,
  appliances: 0x8aaa8e,
  stove: 0x3a3a3a,
  porch: 0xc9bea0,
  porchRoof: 0xb8c8d0,
  stairs: 0xc4a878,
  window: 0x8ec8e8,
  trailer: 0x555555,
  ground: 0x7a9a6a,
};

const ROOF_ASSEMBLY = 7;
const TRAILER_DECK_HEIGHT = 22;
const PORCH_DECK_HEIGHT = 16;
const COUNTER_HEIGHT = 36;
const STAIR_DEPTH = 28;
const MAX_ROOF_TOP = 162 - TRAILER_DECK_HEIGHT; // 140" above deck
const ENTRY_DOOR_W = 32;
const WOODSTOVE = 16;

export type Groups = Record<string, THREE.Group>;

// ── Helper functions ──

function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function wallBox(w: number, h: number, d: number, color: number, x: number, y: number, z: number, parent: THREE.Object3D) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.02, transparent: true, opacity: 0.92,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function windowPane(w: number, h: number, x: number, y: number, z: number, parent: THREE.Object3D, rotateY = 0) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshStandardMaterial({
    color: C.window, transparent: true, opacity: 0.4, side: THREE.DoubleSide, roughness: 0.1, metalness: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (rotateY) mesh.rotation.y = rotateY;
  parent.add(mesh);
  return mesh;
}

// ── Build functions ──

export function buildTrailer(cfg: HouseConfig, scene: THREE.Object3D) {
  const { trailerLength: L, frameWidth: fw, tongueLen, axleSpread, rearOverhang, axleCount } = cfg;
  const halfFW = fw / 2;
  const railH = 6;
  const railW = 3;
  const crossH = 6;
  const deckY = TRAILER_DECK_HEIGHT;
  const wheelR = 12.5;

  // Frame rails
  box(L, railH, railW, C.trailer, 0, deckY - railH, -halfFW, scene);
  box(L, railH, railW, C.trailer, 0, deckY - railH, halfFW - railW, scene);

  // Crossmembers
  const crossCount = Math.floor(L / 24);
  for (let i = 0; i <= crossCount; i++) {
    const cx = i * 24;
    if (cx <= L) {
      box(2, crossH, fw - 2 * railW, C.trailer, cx - 1, deckY - railH - crossH, -halfFW + railW, scene);
    }
  }

  // Tongue — extends from the living/right end (x=L) outward
  const tongueStartZ = 18;
  for (const sign of [-1, 1]) {
    const tGeo = new THREE.BufferGeometry();
    const ty = deckY - railH;
    const tVerts = new Float32Array([
      // Top face
      L, ty + 3, sign * tongueStartZ,
      L + tongueLen, ty + 3, sign * 3,
      L + tongueLen, ty + 3, sign * 1,
      L, ty + 3, sign * tongueStartZ,
      L + tongueLen, ty + 3, sign * 1,
      L, ty + 3, sign * (tongueStartZ - 2),
      // Bottom face
      L, ty, sign * tongueStartZ,
      L + tongueLen, ty, sign * 1,
      L + tongueLen, ty, sign * 3,
      L, ty, sign * (tongueStartZ - 2),
      L + tongueLen, ty, sign * 1,
      L, ty, sign * tongueStartZ,
    ]);
    tGeo.setAttribute('position', new THREE.BufferAttribute(tVerts, 3));
    tGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({
      color: C.trailer, roughness: 0.5, side: THREE.DoubleSide,
    })));
  }

  // Coupler at end of tongue
  const couplerGeo = new THREE.BoxGeometry(6, 6, 8);
  const coupler = new THREE.Mesh(couplerGeo, new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4 }));
  coupler.position.set(L + tongueLen + 3, deckY - railH + 3, 0);
  scene.add(coupler);

  // Axle positions — placed within the fender well area
  // Spec measures from tongue end: C (front-to-fenders) + E (axle span) + D (rear) = A
  // Tongue is at x=L, so fender area is at x = L-C-E to x = L-C
  // Which equals x = D to x = D+E (D = rearOverhang from bathroom end)
  const fenderLen = cfg.fenderLength;
  const fenderStart = cfg.rearOverhang; // D = distance from bathroom end to start of fender area
  const axlePositions: number[] = [];
  if (axleCount === 2) {
    // 2 axles evenly within fender span
    const margin = fenderLen * 0.2;
    axlePositions.push(fenderStart + margin, fenderStart + fenderLen - margin);
  } else {
    // 3 axles evenly within fender span
    const margin = fenderLen * 0.12;
    const span = fenderLen - 2 * margin;
    axlePositions.push(
      fenderStart + margin,
      fenderStart + margin + span / 2,
      fenderStart + fenderLen - margin,
    );
  }

  for (const axleX of axlePositions) {
    // Axle beam
    box(3, 3, fw + 8, C.trailer, axleX - 1.5, deckY - railH - crossH - 3, -halfFW - 4, scene);

    for (const zSide of [-1, 1]) {
      // Tire — cylinder oriented along z-axis (correct orientation: axle runs across width)
      const tireGeo = new THREE.CylinderGeometry(wheelR, wheelR, 8, 24);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.rotation.x = Math.PI / 2; // rotate so cylinder axis aligns with z (across width)
      tire.position.set(axleX, wheelR, zSide * (halfFW + 4));
      tire.castShadow = true;
      scene.add(tire);

      // Hub
      const hubGeo = new THREE.CylinderGeometry(4, 4, 2, 12);
      const hub = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.5 }));
      hub.rotation.x = Math.PI / 2;
      hub.position.set(axleX, wheelR, zSide * (halfFW + 8));
      scene.add(hub);
    }
  }

  // Fender flashing — per spec dimensions (reusing fenderStart/fenderLen from above)
  for (const zSide of [-1, 1]) {
    const fz = zSide > 0 ? halfFW - 1 : -halfFW - 2;
    box(fenderLen, 8.5, 3, C.trailer, fenderStart, deckY - railH, fz, scene);
  }
}

export function buildHouse(cfg: HouseConfig, groups: Groups, scene: THREE.Object3D) {
  const { trailerLength: L, trailerWidth: W, wallThickness: WT, mainCeilingHeight: wallH,
    loftFloorThickness: loftFloorH, bathLength, kitchenLength, livingLength, loftLength,
    kitchen, shower, hasDiningTable } = cfg;
  const halfW = W / 2;
  const floorY = TRAILER_DECK_HEIGHT;
  const bathEnd = bathLength;
  const kitchenEnd = bathEnd + kitchenLength;

  // ── Floor (added to scene directly, not wall groups) ──
  box(L, 4, W, C.floor, 0, floorY - 4, -halfW, scene);

  // ── Exterior walls (first floor) ──
  wallBox(L, wallH, WT, C.walls, 0, floorY, -halfW, groups.walls);           // interior
  wallBox(L, wallH, WT, C.walls, 0, floorY, halfW - WT, groups.walls);       // porch
  wallBox(WT, wallH, W, C.walls, 0, floorY, -halfW, groups.walls);           // bath gable
  wallBox(WT, wallH, W, C.walls, L - WT, floorY, -halfW, groups.walls);      // living gable

  // Bath/kitchen partition
  wallBox(WT, wallH, W - 2 * WT, C.wallsInterior, bathLength - WT / 2, floorY, -halfW + WT, groups.walls);

  // ── Zone floors (added to scene directly) ──
  box(bathLength - WT, 0.5, W - 2 * WT, C.bath, WT, floorY, -halfW + WT, scene);
  box(kitchenLength, 0.5, W - 2 * WT, C.kitchen, bathEnd, floorY, -halfW + WT, scene);
  box(livingLength - WT, 0.5, W - 2 * WT, C.living, kitchenEnd, floorY, -halfW + WT, scene);

  // ── Windows ──
  windowPane(48, 36, WT / 2, floorY + 36, 0, groups.walls, Math.PI / 2);                     // bath gable
  windowPane(60, 40, L - WT / 2, floorY + 30, 0, groups.walls, Math.PI / 2);                  // living gable
  windowPane(24, 24, bathLength / 2 + 12, floorY + 42, -halfW + WT / 2, groups.walls);       // toilet
  windowPane(80, 30, bathEnd + kitchenLength / 2, floorY + 36, halfW - WT / 2, groups.walls); // kitchen
  windowPane(60, 36, kitchenEnd + 80, floorY + 30, halfW - WT / 2, groups.walls);             // living

  // ── Bathroom ──
  box(shower.w, 72, shower.d, C.fixtures, WT, floorY, halfW - WT - shower.d, groups.furniture);
  box(20, 34, 24, C.fixtures, WT, floorY, -halfW + WT + 6, groups.furniture);                   // vanity
  box(18, 18, 28, C.fixtures, WT + 20 + 8, floorY, -halfW + WT, groups.furniture);              // toilet
  box(18, 24, 18, C.appliances, bathLength - WT - 22, floorY, -halfW + WT, groups.furniture);    // HW

  // ── Kitchen ──
  const counterDepth = kitchen.counterDepth;
  const counterX = bathEnd + 8;
  const counterLen = kitchenLength - 16;

  // Main counter (porch side)
  box(counterLen, COUNTER_HEIGHT, counterDepth, C.kitchen,
    counterX, floorY, halfW - WT - counterDepth, groups.furniture);

  // Cooktop on counter
  box(12, 2, 20, C.stove,
    counterX + counterLen / 2 + 20, floorY + COUNTER_HEIGHT, halfW - WT - 22, groups.furniture);

  // ── Stairs + Woodstove ──
  const totalRise = wallH + loftFloorH;

  if (cfg.stairStyle === 'L-shape') {
    // L-shaped stairs — true perpendicular L, viewed from above:
    //
    //   Interior wall (z = -halfW + WT)
    //   ──────────────────────────────────────────────
    //     ←←← Run 2 ←←←  [LANDING] [STOVE]   couch→
    //                     [ Run 1 ]
    //                     [   ↑   ]
    //                     [   ↑   ]
    //                     [ start ]
    //   ──────────────────────────────────────────────
    //   Porch wall (z = +halfW - WT)
    //
    // Run 1: z-direction (toward interior wall), in living zone. You walk toward the wall.
    // Landing: square platform at interior wall, where run 1 meets run 2.
    // Run 2: x-direction (along interior wall toward bathroom/loft). You walk left.
    // Stove: at inside corner of L, against interior wall, right of landing.

    const stairTreadWidth = 28;  // width of treads perpendicular to walking direction
    const landingSize = 30;      // square landing
    const stepThick = 3;         // tread thickness

    // ── Landing position (the anchor point) ──
    const landingX = kitchenEnd;
    const landingZ = -halfW + WT;

    // ── Run 1: z-direction, 3 steps, 9" tread depth ──
    const run1Steps = 3;
    const run1TreadDepth = 9;
    const run1Rise = totalRise * 0.35;
    const run1StepH = run1Rise / run1Steps;

    const run1X = landingX + 1;
    const run1StartZ = landingZ + landingSize;

    for (let i = 0; i < run1Steps; i++) {
      const stepY = floorY + run1StepH * (i + 1);
      const stepZ = run1StartZ + (run1Steps - 1 - i) * run1TreadDepth;
      box(stairTreadWidth, stepThick, run1TreadDepth - 1, C.stairs,
        run1X, stepY - stepThick, stepZ, groups.furniture);
    }

    // ── Landing platform ──
    const landingH = run1Rise + run1StepH;
    box(landingSize, stepThick, landingSize, C.stairs,
      landingX, floorY + landingH - stepThick, landingZ, groups.furniture);
    box(4, landingH, 4, C.stairs,
      landingX + landingSize - 6, floorY, landingZ + 2, groups.furniture);
    box(4, landingH, 4, C.stairs,
      landingX + 2, floorY, landingZ + landingSize - 6, groups.furniture);

    // ── Run 2: x-direction, 5 steps, 10" tread depth, along interior wall ──
    const run2Steps = 5;
    const run2TreadDepth = 10;
    const run2Rise = totalRise - landingH;
    const run2StepH = run2Rise / run2Steps;

    for (let i = 0; i < run2Steps; i++) {
      const stepY = floorY + landingH + run2StepH * (i + 1);
      const stepX = landingX - (i + 1) * run2TreadDepth;
      box(run2TreadDepth - 1, stepThick, stairTreadWidth, C.stairs,
        stepX, stepY - stepThick, landingZ, groups.furniture);
    }

    // Run 2 ends at x = landingX - run2Steps * run2TreadDepth
    const run2EndX = landingX - run2Steps * run2TreadDepth;  // where last step starts

    // ── Under-stair appliances (along interior wall, under run 2) ──
    // Arranged from tallest clearance (near loft) to shortest (near landing):
    // Fridge → W/D → Pantry
    // Height under stairs at each position:
    //   at run2EndX: full landing + run2 rise = totalRise ≈ 82"
    //   at landingX: landingH ≈ 38"

    const applianceZ = -halfW + WT;  // against interior wall, under the stair treads
    const applianceDepth = 24;       // all appliances 24" deep

    // Fridge — tallest section (closest to loft, most headroom)
    // IKEA SUPERKALL: 24W x 24D x 63H
    box(24, 63, applianceDepth, C.appliances,
      run2EndX, floorY, applianceZ, groups.furniture);

    // W/D — next section (front-loader, only 34" tall, needs floor space in front)
    // Bosch compact: 24W x 24D x 34H
    box(24, 34, applianceDepth, C.appliances,
      run2EndX + 26, floorY, applianceZ, groups.furniture);

    // Pantry storage — remaining space toward landing, shorter clearance
    // Pull-out pantry cabinet
    const pantryX = run2EndX + 52;
    const pantryLen = landingX - pantryX - 2;
    if (pantryLen > 10) {
      box(pantryLen, 48, applianceDepth, C.kitchen,
        pantryX, floorY, applianceZ, groups.furniture);
    }

    // ── Woodstove — inside corner of L, against interior wall, right of landing ──
    const stoveX = landingX + landingSize + 6;
    const stoveZ = -halfW + WT;
    box(WOODSTOVE, 24, WOODSTOVE, C.stove, stoveX, floorY, stoveZ, groups.furniture);

    const fluePipeGeo = new THREE.CylinderGeometry(2, 2, wallH + 40, 8);
    const fluePipe = new THREE.Mesh(fluePipeGeo, new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4 }));
    fluePipe.position.set(stoveX + 8, floorY + wallH / 2, stoveZ + 8);
    groups.furniture.add(fluePipe);

  } else {
    // Straight stairs — original 28x8.5 layout
    const stairX = bathEnd + 4;
    const stairLen = kitchenLength + 36;
    const stairSteps = 8;
    const stepH = totalRise / stairSteps;
    const stepW = stairLen / stairSteps;
    for (let i = 0; i < stairSteps; i++) {
      box(stepW - 1, stepH * (i + 1), STAIR_DEPTH, C.stairs,
        stairX + (stairSteps - 1 - i) * stepW, floorY,
        -halfW + WT, groups.furniture);
    }

    // Woodstove — near interior wall at kitchen/living boundary
    box(WOODSTOVE, 24, WOODSTOVE, C.stove,
      kitchenEnd + 6, floorY, -halfW + WT + STAIR_DEPTH + 8, groups.furniture);
    const fluePipeGeo = new THREE.CylinderGeometry(2, 2, wallH + 40, 8);
    const fluePipe = new THREE.Mesh(fluePipeGeo, new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4 }));
    fluePipe.position.set(kitchenEnd + 6 + 8, floorY + wallH / 2, -halfW + WT + STAIR_DEPTH + 8 + 8);
    groups.furniture.add(fluePipe);
  }

  // ── Living furniture ──
  const couchDepth = 28;
  const couchArm = 24;
  const couchX = L - WT - couchDepth;

  // U-couch
  box(couchDepth, 18, W - 2 * WT, C.furniture, couchX, floorY, -halfW + WT, groups.furniture);
  box(couchArm, 18, couchDepth, C.furniture, couchX - couchArm, floorY, -halfW + WT, groups.furniture);
  box(couchArm, 18, couchDepth, C.furniture, couchX - couchArm, floorY, halfW - WT - couchDepth, groups.furniture);

  // Desk — only for straight stairs (L-stairs occupy the interior wall in living zone)
  if (cfg.stairStyle === 'straight') {
    box(48, 30, 24, C.furniture,
      kitchenEnd + 30, floorY, -halfW + WT + STAIR_DEPTH + 8, groups.furniture);
  }

  // Entry door
  const doorGeo = new THREE.PlaneGeometry(32, 78);
  const door = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: 0.6, side: THREE.DoubleSide }));
  door.position.set(kitchenEnd + 24, floorY + 39, halfW);
  door.rotation.y = Math.PI * 0.15;
  groups.walls.add(door);

  // ── Loft ──
  const loftY = floorY + wallH;

  box(loftLength, loftFloorH, W - 2 * WT, C.loftFloor, WT, loftY, -halfW + WT, groups.loft);

  // King bed — centered across width
  const bedW = 76;
  const bedL = 80;
  const bedX = WT + 2;
  const bedZ = -bedW / 2;  // centered at z=0
  box(bedL, 10, bedW, 0xd0c8e0, bedX, loftY + loftFloorH, bedZ, groups.loft);

  // Ledges — half bed length (40") at HEAD end, full width (wall to wall)
  const ledgeLen = bedL / 2;  // 40" — head end only
  const interiorW = W - 2 * WT;
  // Interior wall side ledge
  box(ledgeLen, 6, (interiorW - bedW) / 2, C.furniture,
    bedX, loftY + loftFloorH, -halfW + WT, groups.loft);
  // Porch side ledge
  box(ledgeLen, 6, (interiorW - bedW) / 2, C.furniture,
    bedX, loftY + loftFloorH, bedZ + bedW, groups.loft);

  // Partial wall at foot of bed
  wallBox(WT, 36, W - 2 * WT, C.wallsInterior, WT + 84, loftY + loftFloorH, -halfW + WT, groups.loft);

  // ── Second floor walls ──
  const loftWallH = MAX_ROOF_TOP - wallH - loftFloorH;
  const loftWallY = loftY + loftFloorH;

  // Full-length exterior walls above first floor ceiling
  wallBox(L, loftWallH, WT, C.walls, 0, loftWallY, -halfW, groups['loft-walls']);           // interior
  wallBox(L, loftWallH, WT, C.walls, 0, loftWallY, halfW - WT, groups['loft-walls']);       // porch
  wallBox(WT, loftWallH, W, C.walls, 0, loftWallY, -halfW, groups['loft-walls']);            // bath gable
  wallBox(WT, loftWallH, W, C.walls, L - WT, loftWallY, -halfW, groups['loft-walls']);       // living gable

  // Loft end wall at loft/open transition — on INTERIOR WALLS group
  // Opening for stairs: stairs arrive against interior wall, opening is ~28" wide on that side
  // Solid wall section on porch side (from porch wall to stair opening)
  const stairOpeningWidth = STAIR_DEPTH + 4; // 32" opening for stairs
  wallBox(WT, loftWallH, W - 2 * WT - stairOpeningWidth, C.wallsInterior,
    loftLength, loftWallY, -halfW + WT + stairOpeningWidth, groups['int-walls']);

  // Gable window in loft
  windowPane(48, loftWallH * 0.7, WT / 2, loftWallY + loftWallH * 0.4, 0, groups['loft-walls'], Math.PI / 2);

  // ── Skylight ──
  const skyGeo = new THREE.PlaneGeometry(30, 30);
  const skyMat = new THREE.MeshStandardMaterial({ color: C.window, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.position.set(bathEnd + kitchenLength / 2, floorY + MAX_ROOF_TOP - 10, 0);
  skyMesh.rotation.x = -Math.PI / 2;
  groups.roof.add(skyMesh);
}

export function buildPorch(cfg: HouseConfig, groups: Groups) {
  const { trailerLength: L, trailerWidth: W, porchWidth: PW } = cfg;
  const halfW = W / 2;
  const porchZ = halfW + 8;
  const porchLen = L; // porch matches house length

  box(porchLen, 4, PW, C.porch, 0, PORCH_DECK_HEIGHT - 4, porchZ, groups.porch);

  // Posts
  for (const px of [6, porchLen / 3, porchLen * 2 / 3, porchLen - 6]) {
    box(3.5, 84, 3.5, C.furniture, px - 1.75, PORCH_DECK_HEIGHT, porchZ + PW - 3.5, groups.porch);
  }

  // Polycarbonate roof
  const prGeo = new THREE.PlaneGeometry(porchLen + 12, PW + 12);
  const prMat = new THREE.MeshStandardMaterial({ color: C.porchRoof, transparent: true, opacity: 0.3, side: THREE.DoubleSide, roughness: 0.2 });
  const pr = new THREE.Mesh(prGeo, prMat);
  pr.rotation.x = -Math.PI / 2 + 0.15;
  pr.position.set(porchLen / 2, PORCH_DECK_HEIGHT + 84, porchZ + PW / 2);
  groups.porch.add(pr);
}

// ── Roof builders ──

export function buildShedRoof(cfg: HouseConfig, groups: Groups, pitch: number, info: HTMLElement) {
  const halfW = cfg.trailerWidth / 2;
  const floorY = TRAILER_DECK_HEIGHT;
  const L = cfg.trailerLength;
  const oh = 12;

  const roofHighY = floorY + MAX_ROOF_TOP;
  const roofLowY = roofHighY - cfg.trailerWidth * pitch;

  const roofMat = new THREE.MeshStandardMaterial({ color: C.roof, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -oh, roofLowY, -halfW - oh,
    L + oh, roofLowY, -halfW - oh,
    L + oh, roofHighY, halfW + oh,
    -oh, roofLowY, -halfW - oh,
    L + oh, roofHighY, halfW + oh,
    -oh, roofHighY, halfW + oh,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, roofMat);
  mesh.castShadow = true;
  groups.roof.add(mesh);

  const loftTop = floorY + cfg.mainCeilingHeight + cfg.loftFloorThickness;
  const high = (roofHighY - loftTop - ROOF_ASSEMBLY) / 12;
  const low = (roofLowY - loftTop - ROOF_ASSEMBLY) / 12;
  info.textContent = `${cfg.label} · Shed ${pitch <= 1/12 ? '1' : '4'}:12 · loft: ${high.toFixed(1)}' high, ${low.toFixed(1)}' low`;

  return [mesh];
}

export function buildGableRoof(cfg: HouseConfig, groups: Groups, pitch: number, info: HTMLElement) {
  const halfW = cfg.trailerWidth / 2;
  const floorY = TRAILER_DECK_HEIGHT;
  const L = cfg.trailerLength;
  const oh = 12;
  const meshes: THREE.Mesh[] = [];

  const ridgeY = floorY + MAX_ROOF_TOP;
  const eaveY = ridgeY - halfW * pitch;

  const roofMat = new THREE.MeshStandardMaterial({ color: C.roof, roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });

  // Porch side
  const geo1 = new THREE.BufferGeometry();
  geo1.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -oh, eaveY, halfW + oh, L + oh, eaveY, halfW + oh, L + oh, ridgeY, 0,
    -oh, eaveY, halfW + oh, L + oh, ridgeY, 0, -oh, ridgeY, 0,
  ]), 3));
  geo1.computeVertexNormals();
  const m1 = new THREE.Mesh(geo1, roofMat);
  m1.castShadow = true;
  groups.roof.add(m1);
  meshes.push(m1);

  // Interior side
  const geo2 = new THREE.BufferGeometry();
  geo2.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -oh, ridgeY, 0, L + oh, ridgeY, 0, L + oh, eaveY, -halfW - oh,
    -oh, ridgeY, 0, L + oh, eaveY, -halfW - oh, -oh, eaveY, -halfW - oh,
  ]), 3));
  geo2.computeVertexNormals();
  const m2 = new THREE.Mesh(geo2, roofMat);
  m2.castShadow = true;
  groups.roof.add(m2);
  meshes.push(m2);

  // Gable end triangles
  const gableMat = new THREE.MeshStandardMaterial({ color: C.walls, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide });
  for (const gx of [0, L]) {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      gx, eaveY, -halfW, gx, eaveY, halfW, gx, ridgeY, 0,
    ]), 3));
    gg.computeVertexNormals();
    const gm = new THREE.Mesh(gg, gableMat);
    groups.roof.add(gm);
    meshes.push(gm);
  }

  const loftTop = floorY + cfg.mainCeilingHeight + cfg.loftFloorThickness;
  const center = (ridgeY - loftTop - ROOF_ASSEMBLY) / 12;
  const edge = (eaveY - loftTop - ROOF_ASSEMBLY) / 12;
  info.textContent = `${cfg.label} · Gable 4:12 · loft: ${center.toFixed(1)}' ridge, ${edge.toFixed(1)}' eaves`;

  return meshes;
}
