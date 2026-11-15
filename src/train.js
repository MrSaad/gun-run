import * as THREE from 'three';
import { merge, box } from './geo.js';
import { toon } from './materials.js';

// The train is fixed to the player; the world slides past it. Roof top is y = 0.
export function buildTrain(scene) {
  const steel = 0x4a5263, dark = 0x2a2e39, roof = 0x596275, haz = 0xf08a24, cyan = 0x4ea0ff, red = 0xff3b1f;
  const parts = [];
  const car = (z0, z1, lead) => {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    parts.push(box(3.0, 3.5, len, [0, -1.85, cz], steel));
    parts.push(box(3.1, 0.1, len, [0, -0.05, cz], roof));
    parts.push(box(2.6, 0.5, len - 1, [0, -3.75, cz], dark));
    // roof edge rails + glow strips that pulse with the beat
    for (const sx of [-1, 1]) {
      parts.push(box(0.1, 0.1, len, [sx * 1.5, 0.05, cz], haz));
      parts.push(box(0.05, 0.05, len - 0.4, [sx * 1.36, 0.03, cz], cyan, { glow: 1, ink: false }));
      parts.push(box(0.06, 0.5, len - 1.2, [sx * 1.53, -1.2, cz], cyan, { glow: 1, ink: false }));
    }
    // vents / roof clutter (kept low so nothing blocks the view)
    const n = Math.floor(len / 5);
    for (let i = 0; i < n; i++) {
      const z = z0 + 3 + i * 5;
      if (lead && Math.abs(z) < 2.2) continue; // keep the player's standing area clear
      parts.push(box(1.1, 0.22, 1.4, [(i % 2 ? 0.6 : -0.6), 0.11, z], dark));
    }
  };
  car(-7, 13, true);
  car(13.7, 33.7, false);
  car(34.4, 54.4, false);
  // nose
  parts.push(box(2.8, 2.5, 3.2, [0, -2.35, -8.6], steel));
  parts.push(box(2.9, 0.5, 3.4, [0, -3.7, -8.8], haz));
  parts.push(box(2.6, 1.2, 0.1, [0, -1.6, -7.02], 0x10131c, { rot: [0, 0, 0] }));
  for (const sx of [-1, 1]) {
    parts.push(box(0.5, 0.3, 0.1, [sx * 0.9, -2.9, -10.22], 0xfff2c0, { glow: 1, ink: false }));
    parts.push(box(0.12, 0.12, 0.1, [sx * 1.3, -2.3, -10.22], red, { glow: 1, ink: false }));
  }
  // extra detail: panel seams, pipes, hatches, mast, light bar, couplers, cow-catcher
  for (let z = -6; z < 54; z += 2.5) {
    if (Math.abs(z) < 1.5) continue;
    parts.push(box(2.7, 0.012, 0.05, [0, 0.008, z], 0x242832, { ink: false }));
  }
  for (const sx of [-1, 1]) {
    parts.push(box(0.09, 0.09, 17, [sx * 1.18, 0.06, 4.5], 0x7a4a2a));
    parts.push(box(0.14, 0.16, 0.3, [sx * 1.18, 0.08, -3.5], dark));
    parts.push(box(0.14, 0.16, 0.3, [sx * 1.18, 0.08, 12.5], dark));
    for (let z = -5; z < 13; z += 3) parts.push(box(0.05, 1.5, 0.9, [sx * 1.53, -2.3, z], 0x10131c, { ink: false })); // windows
    parts.push(box(0.3, 0.6, 2.2, [sx * 1.3, -3.2, -9.6], haz, { rot: [0, sx * 0.35, 0] }));
  }
  parts.push(box(0.9, 0.06, 0.9, [0.55, 0.03, -3.6], 0x6a7388));
  parts.push(box(0.12, 0.05, 0.4, [0.55, 0.08, -3.6], haz));
  parts.push(box(0.9, 0.06, 0.9, [-0.5, 0.03, 4.4], 0x6a7388));
  parts.push(box(0.06, 1.7, 0.06, [1.15, 0.85, 3.2], dark));
  parts.push(box(0.5, 0.04, 0.04, [1.15, 1.35, 3.2], dark));
  parts.push(box(0.12, 0.12, 0.12, [1.15, 1.76, 3.2], red, { glow: 1, ink: false }));
  parts.push(box(0.45, 0.5, 0.45, [-1.0, 0.25, 6.2], dark));
  parts.push(box(0.3, 0.75, 0.3, [-1.0, 0.4, 7.0], steel));
  parts.push(box(2.2, 0.16, 0.22, [0, 0.1, -6.6], dark));
  parts.push(box(2.0, 0.07, 0.06, [0, 0.11, -6.73], 0xfff2c0, { glow: 1, ink: false }));
  parts.push(box(1.0, 0.8, 0.8, [0, -2.6, 13.35], dark));
  parts.push(box(1.0, 0.8, 0.8, [0, -2.6, 34.05], dark));
  parts.push(box(2.4, 0.7, 0.7, [0, -3.5, -10.6], dark, { rot: [0.5, 0, 0] }));
  parts.push(box(2.2, 0.9, 0.12, [0, -1.5, -10.26], 0x10131c));
  // standing pad
  parts.push(box(1.8, 0.03, 1.8, [0, 0.015, 0], 0x343a48));
  parts.push(box(1.9, 0.02, 0.12, [0, 0.02, -0.95], haz));
  parts.push(box(1.9, 0.02, 0.12, [0, 0.02, 0.95], haz));

  const mesh = new THREE.Mesh(merge(parts), toon({ vertexColors: true, ink: true, glowAttr: true, beatGlow: 0.9, minLit: 0.3, detail: 0.8, pulse: true }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  // headlight beam thrown down the track
  const bg = new THREE.BufferGeometry();
  const y = -3.93, z0 = -10.6, z1 = -85;
  bg.setAttribute('position', new THREE.Float32BufferAttribute([-1.5, y, z0, 1.5, y, z0, 4.4, y, z1, -1.5, y, z0, 4.4, y, z1, -4.4, y, z1], 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute([0.13, 0.115, 0.07, 0.13, 0.115, 0.07, 0, 0, 0, 0.13, 0.115, 0.07, 0, 0, 0, 0, 0, 0], 3));
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }));
  beam.frustumCulled = false; beam.renderOrder = 1;
  scene.add(beam);
  return mesh;
}
