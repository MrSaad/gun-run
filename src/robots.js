import * as THREE from 'three';
import { B, rng, inTunnelBeat } from './timeline.js';
import { merge, box } from './geo.js';
import { toon } from './materials.js';

const MAX = 40;

function robotGeometry() {
  const body = 0x6d7689, dark = 0x2b2f3b, haz = 0xf28a1c, red = 0xff2a1a, cyan = 0x4ea0ff;
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  return merge([
    { geo: new THREE.IcosahedronGeometry(0.42, 1), color: body, ink: false, flat: true },
    { geo: cyl, scale: [0.25, 0.1, 0.25], rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.36], color: dark, ink: false },
    { geo: cyl, scale: [0.17, 0.1, 0.17], rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.4], color: red, glow: 1, ink: false },
    // angry brow
    box(0.5, 0.09, 0.2, [0, 0.24, 0.33], dark, { rot: [0.5, 0, 0] }),
    // wings / engine pods
    box(0.5, 0.07, 0.34, [-0.6, 0.05, -0.02], haz, { rot: [0, 0, 0.25] }),
    box(0.5, 0.07, 0.34, [0.6, 0.05, -0.02], haz, { rot: [0, 0, -0.25] }),
    box(0.16, 0.2, 0.5, [-0.88, 0.12, -0.02], dark),
    box(0.16, 0.2, 0.5, [0.88, 0.12, -0.02], dark),
    box(0.1, 0.13, 0.06, [-0.88, 0.12, -0.29], cyan, { glow: 1, ink: false }),
    box(0.1, 0.13, 0.06, [0.88, 0.12, -0.29], cyan, { glow: 1, ink: false }),
    // fin + chin guns
    box(0.05, 0.3, 0.34, [0, 0.5, -0.1], haz, { rot: [-0.3, 0, 0] }),
    box(0.07, 0.07, 0.42, [-0.17, -0.36, 0.22], dark),
    box(0.07, 0.07, 0.42, [0.17, -0.36, 0.22], dark),
  ]);
}

// Drones are scheduled by the beat they would reach the player on.
export function buildSchedule() {
  const r = rng(5757);
  const list = [];
  let lastX = 0;
  const add = (spawn, travel) => {
    const arr = spawn + travel;
    if ((arr >= B.break1 && arr < 271) || (arr >= B.break2 && arr < 367)) return;
    const tunnel = inTunnelBeat(arr) || inTunnelBeat(arr - 1.5) || inTunnelBeat(spawn);
    const xr = tunnel ? 3.4 : 6.5, yr = tunnel ? 2.6 : 4.2;
    let x = (r() * 2 - 1) * xr;
    if (Math.abs(x - lastX) < 1.5) x = -x * 0.9 + (x > 0 ? -0.8 : 0.8);
    lastX = x;
    const hover = new THREE.Vector3(x, 0.9 + r() * yr, -(6.5 + r() * 6));
    const start = new THREE.Vector3(tunnel ? x * 1.1 : x * 3 + (r() - 0.5) * 30, tunnel ? 1 + r() * 3 : 4 + r() * 22, -(125 + r() * 20));
    list.push({ spawn, arr, hover, start, ph: r() * 6.28, scale: 0.95 + r() * 0.3, state: 0 });
  };
  for (let sp = B.robots; sp < B.drop2; sp += 2) {
    add(sp, 8);
    if (sp >= B.drop1 && sp < B.tunnel2 - 8 && r() < 0.32) add(sp + 1, 8);
  }
  for (let sp = B.drop2; sp < B.tunnel3; sp += 1) add(sp, 6);
  for (let sp = B.drop3; sp < B.finale - 2; sp += 0.5) add(sp, 4);
  list.sort((a, b) => a.spawn - b.spawn);
  return list;
}

export function createRobots(scene) {
  const geo = robotGeometry();
  const mesh = new THREE.InstancedMesh(geo, toon({ vertexColors: true, glowAttr: true, tintGlow: true, beatGlow: 0.5, minLit: 0.5, detail: 2.2 }), MAX);
  const hull = new THREE.InstancedMesh(geo, toon({ hull: 0.035 }), MAX);
  hull.instanceMatrix = mesh.instanceMatrix;
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, white);
  mesh.frustumCulled = hull.frustumCulled = false;
  mesh.count = hull.count = 0;
  scene.add(mesh, hull);

  let schedule = buildSchedule();
  let next = 0;
  const active = [];
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  const v = new THREE.Vector3();

  function reset(fromBeat = -1e9) {
    schedule = buildSchedule();
    active.length = 0;
    next = 0;
    while (next < schedule.length && schedule[next].arr < fromBeat + 1) next++;
    mesh.count = hull.count = 0;
  }

  // onReach(robot) is called when a drone gets to the player un-shot.
  function update(dt, beat, t, camPos, onReach) {
    while (next < schedule.length && schedule[next].spawn <= beat) {
      const rb = schedule[next++];
      rb.state = 1; rb.pos = new THREE.Vector3().copy(rb.start);
      if (active.length < MAX) active.push(rb);
    }
    let n = 0;
    for (let i = active.length - 1; i >= 0; i--) {
      const rb = active[i];
      if (rb.state !== 1) { active.splice(i, 1); continue; }
      const u = (beat - rb.spawn) / (rb.arr - rb.spawn);
      if (u >= 1) { rb.state = 3; onReach(rb); active.splice(i, 1); continue; }
      rb.u = u;
      if (u < 0.75) {
        const k = u / 0.75, e = 1 - Math.pow(1 - k, 3);
        rb.pos.lerpVectors(rb.start, rb.hover, e);
        const w = 0.35 + (1 - e) * 2.5;
        rb.pos.x += Math.sin(t * 2.3 + rb.ph) * w * 0.5;
        rb.pos.y += Math.sin(t * 3.1 + rb.ph * 2) * 0.22;
      } else {
        const k = (u - 0.75) / 0.25;
        v.copy(rb.hover);
        v.x += Math.sin(t * 2.3 + rb.ph) * 0.175; v.y += Math.sin(t * 3.1 + rb.ph * 2) * 0.22;
        rb.pos.lerpVectors(v, camPos, k * k * 0.92);
      }
    }
    for (const rb of active) {
      d.position.copy(rb.pos);
      d.lookAt(camPos);
      d.rotateZ(Math.sin(t * 2.3 + rb.ph) * 0.3);
      const pop = Math.min(1, rb.u * 12);
      d.scale.setScalar(rb.scale * (0.2 + 0.8 * pop));
      d.updateMatrix();
      mesh.setMatrixAt(n, d.matrix);
      // eye flares white as it winds up to lunge
      const warn = rb.u > 0.62 ? (Math.sin(t * 40) > 0 ? 1 : 0.3) : 0;
      if (warn) mesh.setColorAt(n, c.setRGB(1 + warn * 0.8, 1 + warn * 2.5, 1 + warn * 2.5)); else mesh.setColorAt(n, white);
      n++;
    }
    mesh.count = hull.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  // Generous ray test: a little aim assist that grows with distance.
  function hitTest(origin, dir) {
    let best = null, bestD = 1e9;
    for (const rb of active) {
      if (rb.state !== 1) continue;
      v.subVectors(rb.pos, origin);
      const along = v.dot(dir);
      if (along < 0.3) continue;
      const perp2 = v.lengthSq() - along * along;
      const rad = 0.62 * rb.scale + along * 0.03;
      if (perp2 < rad * rad && along < bestD) { best = rb; bestD = along; }
    }
    return best;
  }
  function kill(rb) { rb.state = 2; }

  return { update, hitTest, kill, reset, active, get total() { return schedule.length; }, get schedule() { return schedule; } };
}
