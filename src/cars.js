import * as THREE from 'three';
import { merge, box } from './geo.js';
import { toon, col } from './materials.js';
import { TUNNELS, rng } from './timeline.js';

// Low-poly hover car. Front is -Z. Body parts are white so the per-car tint sets the paint.
function carGeometry() {
  const paint = 0xffffff, trim = 0x8a8f9a, glass = 0x1a2a44, amber = 0xffa040, cream = 0xffe6c0, red = 0xe8452e, blue = 0x4ea0ff;
  const parts = [
    box(1.9, 0.5, 4.2, [0, 0, 0.1], paint),                                  // hull
    box(1.84, 0.36, 1.3, [0, -0.02, -2.25], paint, { rot: [-0.28, 0, 0] }),  // sloped nose
    box(1.45, 0.46, 1.9, [0, 0.46, 0.35], glass),                            // canopy
    box(1.5, 0.08, 1.3, [0, 0.72, 0.5], paint),                              // roof
    box(1.95, 0.07, 0.55, [0, 0.55, 2.0], paint),                            // spoiler
    box(1.95, 0.05, 3.4, [0, 0.0, 0.2], blue, { glow: 1, ink: false }),      // belt-line strip
    box(0.5, 0.12, 0.06, [-0.55, 0.06, -2.79], cream, { glow: 1, ink: false }),
    box(0.5, 0.12, 0.06, [0.55, 0.06, -2.79], cream, { glow: 1, ink: false }),
    box(1.7, 0.1, 0.06, [0, 0.12, 2.22], red, { glow: 1, ink: false }),      // tail-light bar
  ];
  for (const sx of [-1, 1]) {
    parts.push(box(0.08, 0.32, 0.45, [sx * 0.88, 0.36, 2.0], trim));        // spoiler fins
    for (const sz of [-1.35, 1.35]) {                                       // thruster pods with hot undersides
      parts.push(box(0.46, 0.4, 1.35, [sx * 1.16, -0.18, sz], trim));
      parts.push(box(0.36, 0.05, 1.1, [sx * 1.16, -0.4, sz], amber, { glow: 1, ink: false }));
    }
  }
  return merge(parts);
}

// Lanes are fixed relative to the track; cars move along them at their own speed (m/s, + = same way as the train).
// The overhead lanes stay inside the clear corridor above the line; the side lanes slip under the overpasses.
const LANES = [
  { x: 0, y: 15.5, v: 58 }, { x: -4, y: 21, v: -46 }, { x: 4, y: 19.5, v: 74 }, { x: 0, y: 29, v: -40 },
  { x: -14, y: 7.2, v: -52 }, { x: 14, y: 7.4, v: 47 }, { x: -15, y: 25, v: 63 }, { x: 15, y: 23, v: -57 },
];
const PAINT = [0x5a6272, 0xc9c4b8, 0xc0642a, 0x2c3e66, 0x8a2a22, 0x30333b, 0xd08a3a];
const BEHIND = 120, SPAN = 720, SCALE = 1.25;
const inTunnel = (s) => TUNNELS.some((t) => s > t.a && s < t.b);

export function createCars(scene, audio) {
  const r = rng(808);
  const cars = [];
  for (const L of LANES) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      cars.push({ ...L, s0: (i + r() * 0.6) * (SPAN / n), ph: r() * 6.28, paint: PAINT[(r() * PAINT.length) | 0] });
    }
  }
  const geo = carGeometry();
  const mesh = new THREE.InstancedMesh(geo, toon({ vertexColors: true, glowAttr: true, tintBase: true, ink: true, detail: 0.9, minLit: 0.35, beatGlow: 0.4 }), cars.length);
  const hull = new THREE.InstancedMesh(geo, toon({ hull: 0.05 }), cars.length);
  hull.instanceMatrix = mesh.instanceMatrix;
  cars.forEach((c, i) => mesh.setColorAt(i, col(c.paint)));
  mesh.frustumCulled = hull.frustumCulled = false;
  scene.add(mesh, hull);

  const d = new THREE.Object3D();
  const mod = (a, m) => ((a % m) + m) % m;

  function update(dt, t, dist, playing) {
    let n = 0;
    for (const c of cars) {
      const rel = mod(c.s0 + c.v * t - dist + BEHIND, SPAN) - BEHIND; // metres ahead of the player
      if (inTunnel(dist + rel)) { continue; }
      const fade = Math.min(1, (rel + BEHIND) / 40, (SPAN - BEHIND - rel) / 100);
      if (fade <= 0) { continue; }
      const overhead = Math.abs(c.x) < 6;
      const weave = Math.sin(t * 0.55 + c.ph);
      d.position.set(c.x + weave * (overhead ? 0.8 : 1.4), c.y + Math.sin(t * 1.4 + c.ph * 2) * 0.35, -rel);
      d.rotation.set(Math.sin(t * 1.4 + c.ph * 2) * 0.04, c.v > 0 ? 0 : Math.PI, -Math.cos(t * 0.55 + c.ph) * 0.18 * (c.v > 0 ? 1 : -1));
      d.scale.setScalar(fade * SCALE);
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      mesh.setColorAt(n, col(c.paint));
      n++;
    }
    mesh.count = hull.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { update, mesh, cars };
}
