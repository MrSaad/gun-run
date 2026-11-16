import * as THREE from 'three';
import { B, rng, inTunnelBeat } from './timeline.js';
import { merge, box } from './geo.js';
import { toon, col } from './materials.js';

// Enemy palette: ivory, black and hot red, so they read against the navy/orange city.
const IVORY = 0xe9e4da, BLACK = 0x1b1c22, RED = 0xff3a24, CRIMSON = 0xb3121a, AMBER = 0xffa040;
const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);

// +Z faces the player (the instances are oriented with lookAt toward the camera).
function scoutGeometry() {
  return merge([
    { geo: new THREE.IcosahedronGeometry(0.42, 1), color: IVORY, ink: false, flat: true },
    { geo: cyl, scale: [0.25, 0.1, 0.25], rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.36], color: BLACK, ink: false },
    { geo: cyl, scale: [0.17, 0.1, 0.17], rot: [Math.PI / 2, 0, 0], pos: [0, 0.02, 0.4], color: RED, glow: 1, ink: false },
    box(0.5, 0.09, 0.2, [0, 0.24, 0.33], BLACK, { rot: [0.5, 0, 0] }),          // angry brow
    box(0.5, 0.07, 0.34, [-0.6, 0.05, -0.02], CRIMSON, { rot: [0, 0, 0.25] }),  // wings
    box(0.5, 0.07, 0.34, [0.6, 0.05, -0.02], CRIMSON, { rot: [0, 0, -0.25] }),
    box(0.16, 0.2, 0.5, [-0.88, 0.12, -0.02], BLACK),                          // engine pods
    box(0.16, 0.2, 0.5, [0.88, 0.12, -0.02], BLACK),
    box(0.1, 0.13, 0.06, [-0.88, 0.12, -0.29], RED, { glow: 1, ink: false }),
    box(0.1, 0.13, 0.06, [0.88, 0.12, -0.29], RED, { glow: 1, ink: false }),
    box(0.05, 0.3, 0.34, [0, 0.5, -0.1], CRIMSON, { rot: [-0.3, 0, 0] }),       // fin
    box(0.07, 0.07, 0.42, [-0.17, -0.36, 0.22], BLACK),                         // chin guns
    box(0.07, 0.07, 0.42, [0.17, -0.36, 0.22], BLACK),
  ]);
}

function dartGeometry() {
  const nose = new THREE.ConeGeometry(0.26, 1.2, 4); nose.rotateX(Math.PI / 2); nose.rotateZ(Math.PI / 4);
  return merge([
    { geo: nose, pos: [0, 0, 0.1], color: BLACK, ink: false, flat: true },
    box(1.7, 0.05, 0.42, [0, 0, -0.25], IVORY, { rot: [0, 0, 0] }),             // swept wing
    box(1.72, 0.06, 0.08, [0, 0, -0.04], RED, { glow: 1, ink: false }),         // leading-edge strip
    box(0.06, 0.34, 0.5, [-0.84, 0.1, -0.28], CRIMSON),                         // wingtip fins
    box(0.06, 0.34, 0.5, [0.84, 0.1, -0.28], CRIMSON),
    box(0.3, 0.06, 0.08, [0, 0.12, 0.42], RED, { glow: 1, ink: false }),        // eye slit
    box(0.28, 0.2, 0.3, [0, 0, -0.55], BLACK),                                  // engine
    box(0.2, 0.12, 0.06, [0, 0, -0.71], RED, { glow: 1, ink: false }),
    box(0.08, 0.02, 0.9, [0, 0.13, 0.0], IVORY, { ink: false }),                // racing stripe
  ]);
}

function bruteGeometry() {
  const parts = [
    { geo: new THREE.DodecahedronGeometry(0.72, 0), color: CRIMSON, ink: false, flat: true },
    box(1.25, 0.32, 0.5, [0, 0.45, 0.35], BLACK, { rot: [0.35, 0, 0] }),        // armoured brow
    box(1.1, 0.12, 0.12, [0, 0.27, 0.6], AMBER),                                // hazard band
    box(1.0, 0.3, 0.32, [0, -0.42, 0.42], BLACK),                               // jaw plate
  ];
  for (const ex of [-0.3, 0, 0.3]) parts.push(box(0.16, 0.13, 0.08, [ex, 0.08, 0.72], RED, { glow: 1, ink: false })); // three eyes
  for (const sx of [-1, 1]) {
    parts.push(box(0.42, 0.7, 0.75, [sx * 0.86, 0, -0.05], BLACK));             // shoulder armour
    parts.push(box(0.12, 0.62, 0.1, [sx * 1.08, 0, 0.33], AMBER));
    parts.push({ geo: cyl, scale: [0.11, 0.8, 0.11], rot: [Math.PI / 2, 0, 0], pos: [sx * 0.86, -0.42, 0.45], color: IVORY }); // cannons
    parts.push(box(0.14, 0.14, 0.05, [sx * 0.86, -0.42, 0.86], RED, { glow: 1, ink: false }));
    parts.push(box(0.26, 0.36, 0.26, [sx * 0.5, 0.05, -0.72], BLACK));           // thrusters
    parts.push(box(0.2, 0.28, 0.06, [sx * 0.5, 0.05, -0.86], RED, { glow: 1, ink: false }));
  }
  return merge(parts);
}

function swarmGeometry() {
  const parts = [
    { geo: new THREE.IcosahedronGeometry(0.2, 0), color: RED, glow: 1, ink: false, flat: true },
    { geo: new THREE.IcosahedronGeometry(0.26, 0), scale: [1, 0.55, 1], color: BLACK, ink: false, flat: true },
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(box(0.06, 0.06, 0.34, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.05], IVORY, { rot: [0, 0, a] }));
  }
  return merge(parts);
}

// Every enemy dies in one hit. rad is the hit sphere. rim is the silhouette highlight.
const TYPES = {
  scout: { geo: scoutGeometry, max: 30, hp: [1, 1], pts: 100, rad: 0.62, rim: 0xff4a2a, boom: 1 },
  dart: { geo: dartGeometry, max: 20, hp: [1, 1], pts: 150, rad: 0.58, rim: 0xff4a2a, boom: 0.9 },
  brute: { geo: bruteGeometry, max: 8, hp: [1, 1], pts: 200, rad: 1.05, rim: 0xffa040, boom: 1.9 },
  swarm: { geo: swarmGeometry, max: 45, hp: [1, 1], pts: 60, rad: 0.42, rim: 0xffd0a0, boom: 0.6 },
};

// Enemies are scheduled by the beat they would reach the player on.
export function buildSchedule() {
  const r = rng(5757);
  const list = [];
  let lastX = 0;
  const add = (spawn, travel, type = 'scout', extra = {}) => {
    const arr = spawn + travel;
    if ((arr >= B.break1 && arr < 271) || (arr >= B.break2 && arr < 367)) return;
    const tunnel = inTunnelBeat(arr) || inTunnelBeat(arr - 1.5) || inTunnelBeat(spawn);
    // In the city most enemies come in from straight ahead, like in the tunnels; about a quarter
    // are flankers that swing in from the sides and above.
    const flank = !tunnel && type !== 'brute' && extra.x === undefined && r() < 0.25;
    const xr = tunnel ? 3.4 : flank ? 6 : 3.6, yr = tunnel ? 2.6 : flank ? 3.4 : 2.8;
    let x = extra.x ?? (r() * 2 - 1) * xr;
    if (extra.x === undefined && Math.abs(x - lastX) < 1.5) x = -x * 0.9 + (x > 0 ? -0.8 : 0.8);
    lastX = x;
    const far = type === 'brute' ? 10 + r() * 4 : tunnel ? 6.5 + r() * 6 : 8 + r() * 6;
    const hover = new THREE.Vector3(x, extra.y ?? (tunnel ? 0.9 : 1.0) + r() * yr, -far);
    const side = x < 0 ? -1 : 1;
    const start = tunnel ? new THREE.Vector3(x * 1.1, 1 + r() * 3, -(125 + r() * 20))
      : flank ? new THREE.Vector3(side * (35 + r() * 25), 8 + r() * 18, -(40 + r() * 50))
      : new THREE.Vector3(x * 1.6 + (r() - 0.5) * 8, 2 + r() * 8, -(125 + r() * 20));
    const T = TYPES[type];
    list.push({
      type, spawn, arr, hover, start, ph: extra.ph ?? r() * 6.28, slot: extra.slot ?? 0,
      scale: type === 'swarm' ? 1 : 0.95 + r() * 0.3, state: 0, pts: T.pts, rad: T.rad, boom: T.boom,
      hp: T.hp[arr >= B.uzi ? 1 : 0], flashT: 0, kick: 0, locked: 0,
    });
  };
  const swarm = (spawn, travel) => {
    const x = (r() * 2 - 1) * 3.2, y = 1.5 + r() * 2.5, ph = r() * 6.28;
    for (let k = 0; k < 3; k++) add(spawn, travel, 'swarm', { x, y, ph, slot: k });
  };

  // Stage 1: scouts in the tunnel; darts join once the city opens up.
  for (let sp = B.robots; sp < B.drop2; sp += 2) {
    const city = sp >= B.drop1 - 2 && sp < B.tunnel2 - 8;
    add(sp, 8, city && sp % 8 === 4 ? 'dart' : 'scout');
    if (city && r() < 0.35) add(sp + 1, 8, 'dart');
  }
  // Stage 2: double rate; brutes land on every other bar.
  for (let sp = B.drop2; sp < B.tunnel3; sp += 1) {
    if (sp % 8 === 0 && sp < B.tunnel3 - 10) add(sp, 9, 'brute');
    else add(sp, 6, sp % 4 === 2 ? 'dart' : 'scout');
  }
  // Stage 3 (uzis): swarms, darts and brutes at 228 bpm.
  for (let sp = B.drop3; sp < B.finale - 2; sp += 0.5) {
    if (sp % 8 === 0 && sp < B.finale - 10) add(sp, 8, 'brute');
    else if (sp % 4 === 1) swarm(sp, 4.5);
    else add(sp, 4, (sp * 2) % 4 === 1 ? 'dart' : 'scout');
  }
  list.sort((a, b) => a.spawn - b.spawn);
  return list;
}

export function createRobots(scene) {
  const black = new THREE.Color(0, 0, 0), white = new THREE.Color(1, 1, 1);
  const kinds = {};
  for (const [name, T] of Object.entries(TYPES)) {
    const geo = T.geo();
    const mesh = new THREE.InstancedMesh(geo, toon({ vertexColors: true, glowAttr: true, tintGlow: true, beatGlow: 0.6, minLit: 0.85, detail: 2.2, rim: T.rim }), T.max);
    const hull = new THREE.InstancedMesh(geo, toon({ hull: name === 'swarm' ? 0.03 : 0.04 }), T.max);
    for (let i = 0; i < T.max; i++) { mesh.setColorAt(i, white); hull.setColorAt(i, black); }
    mesh.frustumCulled = hull.frustumCulled = false;
    mesh.count = hull.count = 0;
    scene.add(mesh, hull);
    kinds[name] = { mesh, hull, n: 0 };
  }

  let schedule = buildSchedule();
  let next = 0;
  const active = [];
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  const v = new THREE.Vector3(), toCam = new THREE.Vector3();
  const LOCK = new THREE.Color(1.0, 0.42, 0.2);

  function reset(fromBeat = -1e9) {
    schedule = buildSchedule();
    active.length = 0;
    next = 0;
    while (next < schedule.length && schedule[next].arr < fromBeat + 1) next++;
    for (const k of Object.values(kinds)) k.mesh.count = k.hull.count = 0;
  }

  const tri = (x) => 1 - 4 * Math.abs(x - Math.floor(x + 0.5)); // triangle wave, -1..1

  // onReach(robot) is called when an enemy gets to the player un-shot.
  function update(dt, beat, t, camPos, onReach) {
    while (next < schedule.length && schedule[next].spawn <= beat) {
      const rb = schedule[next++];
      rb.state = 1; rb.pos = new THREE.Vector3().copy(rb.start);
      if (active.length < 90) active.push(rb);
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const rb = active[i];
      if (rb.state !== 1) { active.splice(i, 1); continue; }
      const u = (beat - rb.spawn) / (rb.arr - rb.spawn);
      if (u >= 1) { rb.state = 3; onReach(rb); active.splice(i, 1); continue; }
      rb.u = u;
      const heavy = rb.type === 'brute';
      if (u < 0.75) {
        const k = u / 0.75, e = 1 - Math.pow(1 - k, 3);
        rb.pos.lerpVectors(rb.start, rb.hover, e);
        const w = (heavy ? 0.15 : 0.35) + (1 - e) * 2.5;
        rb.pos.x += Math.sin(t * 2.3 + rb.ph) * w * 0.5;
        rb.pos.y += Math.sin(t * (heavy ? 1.6 : 3.1) + rb.ph * 2) * 0.22;
      } else {
        const k = (u - 0.75) / 0.25;
        v.copy(rb.hover);
        v.x += Math.sin(t * 2.3 + rb.ph) * 0.175; v.y += Math.sin(t * 3.1 + rb.ph * 2) * 0.22;
        rb.pos.lerpVectors(v, camPos, k * k * 0.92);
      }
      if (rb.type === 'dart') rb.pos.x += tri(beat * 0.5 + rb.ph) * 2.2 * (1 - u * 0.7); // zig-zags on the beat
      if (rb.type === 'swarm') { // three orbs circling a shared centre
        const a = t * 3.2 + rb.slot * 2.094 + rb.ph, R = 0.85 * (1 - u * 0.5);
        rb.pos.x += Math.cos(a) * R; rb.pos.y += Math.sin(a) * R;
      }
      rb.flashT = Math.max(0, rb.flashT - dt);
      rb.kick *= Math.exp(-dt * 12);
    }

    for (const k of Object.values(kinds)) k.n = 0;
    for (const rb of active) {
      const K = kinds[rb.type];
      if (K.n >= TYPES[rb.type].max) continue;
      toCam.subVectors(camPos, rb.pos).normalize();
      d.position.copy(rb.pos).addScaledVector(toCam, -rb.kick);
      d.lookAt(camPos);
      if (rb.type === 'dart') d.rotateZ(-tri(beat * 0.5 + rb.ph + 0.25) * 0.6);
      else if (rb.type === 'swarm') d.rotateZ(t * 6 + rb.slot);
      else d.rotateZ(Math.sin(t * 2.3 + rb.ph) * (rb.type === 'brute' ? 0.12 : 0.3));
      const pop = Math.min(1, rb.u * 12);
      d.scale.setScalar(rb.scale * (0.2 + 0.8 * pop));
      d.updateMatrix();
      K.mesh.setMatrixAt(K.n, d.matrix);
      // locked targets get a thicker, glowing outline
      const lockPulse = 0.8 + 0.2 * Math.sin(t * 22);
      if (rb.locked > 0) { d.scale.multiplyScalar(1.12); d.updateMatrix(); }
      K.hull.setMatrixAt(K.n, d.matrix);
      K.hull.setColorAt(K.n, rb.locked > 0 ? c.copy(LOCK).multiplyScalar(lockPulse * 1.4) : black);
      // body tint: white flash when hit, eyes strobe as it winds up to lunge
      const warn = rb.u > 0.62 ? (Math.sin(t * 40) > 0 ? 1 : 0.3) : 0;
      if (rb.flashT > 0) K.mesh.setColorAt(K.n, c.setRGB(4, 4, 4));
      else if (warn) K.mesh.setColorAt(K.n, c.setRGB(1 + warn * 0.8, 1 + warn * 2.5, 1 + warn * 2.5));
      else if (rb.locked > 0) K.mesh.setColorAt(K.n, c.setRGB(1.6, 1.6, 1.6));
      else K.mesh.setColorAt(K.n, white);
      K.n++;
    }
    for (const K of Object.values(kinds)) {
      K.mesh.count = K.hull.count = K.n;
      K.mesh.instanceMatrix.needsUpdate = K.hull.instanceMatrix.needsUpdate = true;
      K.mesh.instanceColor.needsUpdate = K.hull.instanceColor.needsUpdate = true;
    }
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
      const rad = rb.rad * rb.scale + along * 0.03;
      if (perp2 < rad * rad && along < bestD) { best = rb; bestD = along; }
    }
    return best;
  }
  // Returns true when the hit destroys it.
  function damage(rb) {
    rb.hp -= 1;
    if (rb.hp <= 0) { rb.state = 2; return true; }
    rb.flashT = 0.07; rb.kick = 0.35;
    return false;
  }
  function kill(rb) { rb.state = 2; }

  return { update, hitTest, damage, kill, reset, active, get total() { return schedule.length; }, get schedule() { return schedule; } };
}
