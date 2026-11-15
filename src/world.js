import * as THREE from 'three';
import { B, BEAT, S, V1, TUNNELS, CITIES, TRACK_A, TRACK_B, rng, speedAtBeat } from './timeline.js';
import { G, toon, buildingMaterial, tunnelMaterial, deckMaterial, groundMaterial, skyMaterial, signMaterial, rainMaterial, col } from './materials.js';

const DECK_Y = -4.0;
const GROUND_Y = -60;
// Tunnel cross-section (inside), left-bottom -> over the top -> right-bottom.
const PROFILE = [[-5, -4.3], [-5, 3.0], [-3.2, 5.2], [3.2, 5.2], [5, 3.0], [5, -4.3]];

const TUNNEL_STYLE = [
  { colA: 0x22e6ff, colB: 0xff9a1f, wall: 0x39424d, ring: 0x22e6ff, ringDown: 0xffffff, v: V1 },
  { colA: 0xff2bd0, colB: 0x22e6ff, wall: 0x40364d, ring: 0xff2bd0, ringDown: 0x22e6ff, v: V1 },
  { colA: 0xff3b1f, colB: 0xffb020, wall: 0x4a3434, ring: 0xff3b1f, ringDown: 0xffd040, v: 2 * V1 },
  { colA: 0xffd27a, colB: 0xffffff, wall: 0xf2e9d8, ring: 0xffe9b0, ringDown: 0xffffff, v: 25, self: 1 },
];

const ENV = {
  t1: { fog: [0.02, 0.05, 0.065], near: 15, far: 240, amb: [0.42, 0.5, 0.56], lc: [0.5, 0.6, 0.65], ld: [0, 1, 0.25], storm: 0, rain: 0 },
  city1: { fog: [0.15, 0.055, 0.21], near: 60, far: 1000, amb: [0.36, 0.32, 0.52], lc: [0.5, 0.5, 0.8], ld: [-0.45, 0.6, -0.65], storm: 0, rain: 0 },
  t2: { fog: [0.07, 0.015, 0.085], near: 15, far: 240, amb: [0.5, 0.4, 0.56], lc: [0.6, 0.45, 0.6], ld: [0, 1, 0.25], storm: 0.5, rain: 0 },
  city2: { fog: [0.11, 0.06, 0.22], near: 60, far: 950, amb: [0.34, 0.32, 0.54], lc: [0.45, 0.5, 0.85], ld: [-0.45, 0.6, -0.65], storm: 0.6, rain: 0 },
  t3: { fog: [0.085, 0.018, 0.012], near: 15, far: 260, amb: [0.56, 0.4, 0.36], lc: [0.65, 0.45, 0.4], ld: [0, 1, 0.25], storm: 1, rain: 0 },
  city3: { fog: [0.075, 0.07, 0.19], near: 30, far: 620, amb: [0.32, 0.34, 0.52], lc: [0.4, 0.48, 0.8], ld: [-0.45, 0.6, -0.65], storm: 1, rain: 1 },
  t4: { fog: [1.0, 0.95, 0.84], near: 4, far: 190, amb: [1, 1, 1], lc: [0.25, 0.25, 0.25], ld: [0, 1, 0.25], storm: 1, rain: 0 },
};
function envForBeat(b) {
  const e = b + 0.75; // start blending just before each portal so exits read as a reveal
  if (b >= B.finale) return ENV.t4;
  if (e < B.drop1) return ENV.t1;
  if (e < B.tunnel2) return ENV.city1;
  if (e < B.drop2) return ENV.t2;
  if (e < B.tunnel3) return ENV.city2;
  if (e < B.drop3) return ENV.t3;
  return ENV.city3;
}

function makeSignAtlas() {
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = 1024;
  const g = cv.getContext('2d');
  const words = ['NEON', 'RAMEN', '24H', 'CYBER', 'BAR', 'HOTEL', 'NOODLE', 'ARCADE', 'SYNTH', 'GUN RUN', '777', 'DATA', 'OPEN', 'VOID', 'TAXI', 'PAWN',
    'NO SIGNAL', 'KARAOKE', 'CHROME', 'SUSHI', 'MOTEL', 'LIVE', 'ZERO', 'EXIT', 'MEGA', 'CLINIC', 'BLACK MAGIC', 'TATTOO', 'GHOST', 'VOLT', 'OMNI', '>>>'];
  const cols = ['#22e6ff', '#ff2bd0', '#ffb020', '#7dff3a', '#ff4530', '#b06bff'];
  g.fillStyle = '#05050c'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 32; i++) {
    const x = (i % 4) * 256, y = Math.floor(i / 4) * 128;
    const c = cols[i % cols.length];
    g.fillStyle = '#0b0b18'; g.fillRect(x + 4, y + 4, 248, 120);
    g.strokeStyle = c; g.lineWidth = 7; g.strokeRect(x + 10, y + 10, 236, 108);
    g.fillStyle = c; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 70;
    g.font = `italic 900 ${size}px "Arial Black", Impact, sans-serif`;
    while (g.measureText(words[i]).width > 205 && size > 20) { size -= 4; g.font = `italic 900 ${size}px "Arial Black", Impact, sans-serif`; }
    g.shadowColor = c; g.shadowBlur = 14;
    g.fillText(words[i], x + 128, y + 68);
    g.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function tunnelGeometry(a, b) {
  const pos = [], nor = [];
  const segLen = 100;
  const n = Math.ceil((b - a) / segLen);
  for (let i = 0; i < n; i++) {
    const z0 = -(a + i * segLen), z1 = -Math.min(b, a + (i + 1) * segLen);
    for (let j = 0; j < PROFILE.length - 1; j++) {
      const [x0, y0] = PROFILE[j], [x1, y1] = PROFILE[j + 1];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      const nx = dy / l, ny = -dx / l; // inward
      pos.push(x0, y0, z0, x1, y1, z0, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y0, z1);
      for (let k = 0; k < 6; k++) nor.push(nx, ny, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function buildWorld(scene) {
  const group = new THREE.Group(); // everything fixed to the track; slides toward the player
  scene.add(group);
  const r = rng(1140);
  const L = TRACK_B - TRACK_A;
  const midZ = -(TRACK_A + TRACK_B) / 2;

  // ---- deck, rails, ground
  const deckGeo = new THREE.PlaneGeometry(10, L, 1, Math.ceil(L / 100));
  deckGeo.rotateX(-Math.PI / 2); deckGeo.translate(0, DECK_Y, midZ);
  const deck = new THREE.Mesh(deckGeo, deckMaterial()); deck.frustumCulled = false; group.add(deck);

  const groundGeo = new THREE.PlaneGeometry(2400, L, 8, Math.ceil(L / 200));
  groundGeo.rotateX(-Math.PI / 2); groundGeo.translate(0, GROUND_Y, midZ);
  const ground = new THREE.Mesh(groundGeo, groundMaterial()); ground.frustumCulled = false; group.add(ground);

  // ---- instance lists
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
  const E = new THREE.Euler();
  const lists = { build: [], prop: [], glow: [], sign: [] };
  const push = (list, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0, extra) => {
    E.set(rx, ry, rz);
    M.compose(P.set(x, y, z), Q.setFromEuler(E), Sc.set(sx, sy, sz));
    lists[list].push({ m: M.clone(), c: color, extra });
  };


  // ---- tunnels: shell, megastructure around it, portal frames, beat-locked rings
  const ringAt = (s, color, thick = 0.2, depth = 0.5, inset = 0.12) => {
    for (let j = 0; j < PROFILE.length - 1; j++) {
      const [x0, y0] = PROFILE[j], [x1, y1] = PROFILE[j + 1];
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
      const nx = dy / l, ny = -dx / l;
      push('glow', (x0 + x1) / 2 + nx * inset, (y0 + y1) / 2 + ny * inset, -s, l + thick, thick, depth, color, 0, 0, Math.atan2(dy, dx));
    }
  };
  TUNNELS.forEach((t, i) => {
    const st = TUNNEL_STYLE[t.kind];
    const mesh = new THREE.Mesh(tunnelGeometry(t.a, t.b), tunnelMaterial({ period: st.v * BEAT / 4, colA: st.colA, colB: st.colB, wall: st.wall, self: st.self ?? 0 }));
    mesh.frustumCulled = false; group.add(mesh);
    const len = t.b - t.a, cz = -(t.a + t.b) / 2, W = 260, TOP = 190;
    const tint = i === 3 ? 0x2a2a3a : 0x1b1b2a;
    push('build', -(5.4 + W / 2), (TOP + GROUND_Y) / 2, cz, W, TOP - GROUND_Y, len, tint);
    push('build', (5.4 + W / 2), (TOP + GROUND_Y) / 2, cz, W, TOP - GROUND_Y, len, tint);
    push('build', 0, (TOP + 5.5) / 2, cz, 10.8, TOP - 5.5, len, tint);
    push('build', 0, (GROUND_Y + DECK_Y - 0.05) / 2, cz, 10.8, DECK_Y - 0.05 - GROUND_Y, len, tint);
    if (i > 0) ringAt(t.a - 0.2, st.ring, 0.7, 0.8, -0.3);
    if (i < 3) ringAt(t.b + 0.2, st.ring, 0.7, 0.8, -0.3);
  });
  // rings on the beat
  const ringsFor = (k0, k1, step, kind) => {
    const st = TUNNEL_STYLE[kind];
    for (let k = k0; k < k1; k += step) {
      const down = Number.isInteger(k) && ((k % 4) + 4) % 4 === 0;
      const whole = Number.isInteger(k);
      ringAt(S(k), down ? st.ringDown : st.ring, whole ? (down ? 0.34 : 0.22) : 0.1, whole ? 0.6 : 0.3);
    }
  };
  ringsFor(-34, B.drop1, 1, 0);
  ringsFor(B.tunnel2 + 1, B.drop2, 1, 1);
  ringsFor(B.tunnel3 + 0.5, B.drop3, 0.5, 2);
  ringsFor(B.finale + 1, B.loopB + 30, 1, 3);

  // ---- city: buildings
  const tints = [0x1c1c2e, 0x232338, 0x191926, 0x2a2440, 0x1d2633];
  const billboards = [];
  for (const c of CITIES) {
    for (const side of [-1, 1]) {
      let s = c.a + 6;
      while (s < c.b - 30) { // row hugging the track
        const w = 14 + r() * 14, d = Math.min(14 + r() * 18, c.b - 8 - s);
        const low = r() < 0.62;
        const top = low ? -30 + r() * 24 : 8 + r() * 60;
        const x = side * ((low ? 9 : 14) + w / 2 + r() * 12);
        push('build', x, (top + GROUND_Y) / 2, -(s + d / 2), w, top - GROUND_Y, d, tints[(r() * tints.length) | 0]);
        if (top > 22 && r() < 0.5) billboards.push({ x: x - side * (w / 2 + 0.4), y: 8 + r() * (top - 16), s: s + d / 2, side, size: 12 });
        s += d + 3 + r() * 12;
      }
      s = c.a + 4;
      while (s < c.b - 50) { // mid row, taller
        const w = 25 + r() * 25, d = Math.min(25 + r() * 30, c.b - 6 - s);
        const top = 30 + r() * 110;
        const x = side * (50 + w / 2 + r() * 35);
        push('build', x, (top + GROUND_Y) / 2, -(s + d / 2), w, top - GROUND_Y, d, tints[(r() * tints.length) | 0]);
        if (r() < 0.45) billboards.push({ x: x - side * (w / 2 + 0.4), y: 20 + r() * (top - 30), s: s + d / 2, side, size: 22 });
        s += d + 8 + r() * 25;
      }
      s = c.a + 4;
      while (s < c.b - 90) { // skyline giants
        const w = 40 + r() * 40, d = Math.min(40 + r() * 40, c.b - 6 - s);
        const top = 90 + r() * 230;
        push('build', side * (150 + w / 2 + r() * 190), (top + GROUND_Y) / 2, -(s + d / 2), w, top - GROUND_Y, d, tints[(r() * tints.length) | 0]);
        s += d + 30 + r() * 80;
      }
    }
    // beat-locked gantries + trackside signs
    let n = 0;
    for (let k = c.k0 + c.step; k < c.k1 - 0.01; k += c.step, n++) {
      const s = S(k);
      const down = Number.isInteger(k) && k % 4 === 0;
      for (const x of [-4.7, 4.7]) push('prop', x, 0.7, -s, 0.35, 9.4, 0.35, 0x39404f);
      push('prop', 0, 5.4, -s, 10.4, 0.45, 0.45, down ? 0x8a6a1c : 0x39404f);
      push('glow', 0, 5.08, -s, down ? 9.0 : 6.0, 0.16, 0.22, down ? 0xffd040 : (Math.floor(k / 4) % 2 ? 0xff2bd0 : 0x22e6ff));
      // sign between gantries, alternating sides
      const ks = k + c.step / 2;
      if (ks < c.k1 - 1) {
        const ss = S(ks), side = n % 2 ? 1 : -1;
        push('prop', side * 5.1, 0.4, -ss, 0.25, 8.8, 0.25, 0x2c313d);
        push('prop', side * 6.4, 4.7, -ss, 2.8, 0.2, 0.2, 0x2c313d);
        push('sign', side * 7.6, 3.2, -ss + 0.2, 5.2, 2.6, 1, 0, 0, -side * 0.35, 0, (r() * 32) | 0);
      }
      if (n % 2 === 0) push('prop', 0, (GROUND_Y + DECK_Y) / 2 - 0.3, -s, 5, DECK_Y - GROUND_Y - 0.6, 3, 0x20222c); // viaduct pier
    }
  }
  for (const b of billboards) push('sign', b.x, b.y, -b.s, b.size, b.size / 2, 1, 0, 0, -b.side * Math.PI / 2, 0, (r() * 32) | 0);

  // ---- build instanced meshes
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const inst = (list, geo, mat) => {
    const items = lists[list];
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    const c = new THREE.Color();
    items.forEach((it, i) => { mesh.setMatrixAt(i, it.m); mesh.setColorAt(i, c.copy(col(it.c))); });
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    return mesh;
  };
  inst('build', unit, buildingMaterial());
  inst('prop', unit, toon({ ink: true }));
  inst('glow', unit, toon({ allGlow: true, beatGlow: 0.6 }));
  const signGeo = new THREE.PlaneGeometry(1, 1);
  const signMesh = inst('sign', signGeo, signMaterial(makeSignAtlas()));
  signMesh.geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(new Float32Array(lists.sign.map((s) => s.extra)), 1));

  // ---- sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2200, 24, 12), skyMaterial());
  sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);

  // ---- lightning
  const BOLT_VERTS = 60 * 6 * 2;
  const bolts = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BOLT_VERTS * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BOLT_VERTS * 3), 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    m.frustumCulled = false; m.visible = false; scene.add(m);
    bolts.push({ mesh: m, age: 9, life: 0.2 });
  }
  let boltIdx = 0;
  const lr = rng(77);
  function strike(big) {
    const bolt = bolts[boltIdx++ % bolts.length];
    const az = (lr() - 0.5) * (big ? 0.5 : 2.4);
    const d = big ? 130 + lr() * 60 : 160 + lr() * 380;
    const bx = Math.sin(az) * d, bz = -Math.cos(az) * d;
    const px = Math.cos(az), pz = Math.sin(az); // ribbon width direction (perpendicular to view)
    const pos = bolt.mesh.geometry.attributes.position, colr = bolt.mesh.geometry.attributes.color;
    let v = 0;
    const quad = (ax, ay, az_, bx_, by, bz_, w, cr, cg, cb, toward) => {
      const ox = px * w, oz = pz * w;
      const tx = -Math.sin(az) * toward, tz = Math.cos(az) * toward;
      const pts = [[ax - ox, ay, az_ - oz], [ax + ox, ay, az_ + oz], [bx_ + ox, by, bz_ + oz], [ax - ox, ay, az_ - oz], [bx_ + ox, by, bz_ + oz], [bx_ - ox, by, bz_ - oz]];
      for (const p of pts) { pos.setXYZ(v, p[0] + tx, p[1], p[2] + tz); colr.setXYZ(v, cr, cg, cb); v++; }
    };
    const path = (x, y, z, yEnd, segs, w, spread) => {
      const pts = [[x, y, z]];
      for (let i = 1; i <= segs; i++) {
        const yy = y + (yEnd - y) * (i / segs);
        x += (lr() - 0.5) * spread; z += (lr() - 0.5) * spread * 0.3;
        pts.push([x * 1 + px * (lr() - 0.5) * spread, yy, z]);
      }
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[i + 1];
        quad(a[0], a[1], a[2], b[0], b[1], b[2], w * 3.2, 0.42, 0.3, 1.0, 0);
        quad(a[0], a[1], a[2], b[0], b[1], b[2], w, 1, 1, 1, 2);
      }
      return pts;
    };
    const sc = d / 250;
    const main = path(bx, 420, bz, -30 + lr() * 60, 12, (big ? 3.4 : 1.6) * sc + 0.6, 34 * sc);
    const f = main[4 + ((lr() * 4) | 0)];
    path(f[0], f[1], f[2], f[1] - 120 - lr() * 80, 6, (big ? 1.6 : 0.8) * sc + 0.3, 46 * sc);
    if (big) { const f2 = main[3]; path(f2[0], f2[1], f2[2], f2[1] - 160, 6, 1.4 * sc + 0.3, 50 * sc); }
    bolt.mesh.geometry.setDrawRange(0, v);
    pos.needsUpdate = true; colr.needsUpdate = true;
    bolt.age = 0; bolt.life = big ? 0.42 : 0.2;
    flash = Math.max(flash, big ? 1.7 : 0.85 + lr() * 0.3);
  }
  let flash = 0;
  let lastHalf = -1;
  const hsh = (k) => { const x = Math.sin(k * 127.1 + 3.3) * 43758.5453; return x - Math.floor(x); };

  // ---- rain
  const RAIN_N = 1400;
  const rp = new Float32Array(RAIN_N * 6), re = new Float32Array(RAIN_N * 2);
  for (let i = 0; i < RAIN_N; i++) {
    const x = r() * 36, y = r() * 22, z = r() * 44;
    rp.set([x, y, z, x, y, z], i * 6); re[i * 2] = 0; re[i * 2 + 1] = 1;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainGeo.setAttribute('aEnd', new THREE.BufferAttribute(re, 1));
  const rainMat = rainMaterial();
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; rain.visible = false; rain.renderOrder = 5; scene.add(rain);

  // ---- per-frame
  const env = { fog: new THREE.Vector3(), amb: new THREE.Vector3(), lc: new THREE.Vector3(), ld: new THREE.Vector3(), near: 15, far: 240, storm: 0, rain: 0 };
  const tmp = new THREE.Vector3();
  let first = true;
  function update(dt, t, beat, dist, camPos, playing) {
    group.position.z = dist;
    sky.position.copy(camPos);

    const e = envForBeat(beat);
    const k = first ? 1 : 1 - Math.exp(-dt * 5);
    first = false;
    env.fog.lerp(tmp.fromArray(e.fog), k); env.amb.lerp(tmp.fromArray(e.amb), k);
    env.lc.lerp(tmp.fromArray(e.lc), k); env.ld.lerp(tmp.fromArray(e.ld).normalize(), k).normalize();
    env.near += (e.near - env.near) * k; env.far += (e.far - env.far) * k;
    env.storm += (e.storm - env.storm) * k; env.rain += (e.rain - env.rain) * k;
    G.uFogColor.value.copy(env.fog); G.uAmbient.value.copy(env.amb); G.uLightCol.value.copy(env.lc); G.uLightDir.value.copy(env.ld);
    G.uFogNear.value = env.near; G.uFogFar.value = env.far; G.uStorm.value = env.storm;

    // beat pulse (stronger once the kick is in)
    const hasKick = beat >= B.drop1 - 1 && beat < B.score;
    const fb = beat - Math.floor(beat);
    G.uBeat.value = Math.exp(-fb * 5) * (hasKick ? 1 : 0.35);
    G.uTime.value = t;

    // lightning, on the beat
    const half = Math.floor(beat * 2);
    if (playing && half !== lastHalf) {
      lastHalf = half;
      const b = half / 2, whole = half % 2 === 0;
      if (b === 271 || b === 367 || b === B.drop2 || b === B.drop3) { strike(true); strike(false); }
      else if (b > B.drop2 && b < B.tunnel3 - 1 && !(b >= B.break1 && b < 271)) {
        if (whole && (b % 8 === 0 || hsh(b) < 0.3)) strike(false);
      } else if (b > B.drop3 && b < B.finale - 1 && !(b >= B.break2 && b < 367)) {
        if (whole ? hsh(b) < 0.75 : hsh(b) < 0.3) strike(false);
        if (whole && b % 4 === 0) strike(false);
      }
    }
    flash *= Math.exp(-dt * 7);
    let vis = flash;
    for (const bolt of bolts) {
      bolt.age += dt;
      const u = bolt.age / bolt.life;
      const on = u < 1 && !(u > 0.3 && u < 0.45);
      bolt.mesh.visible = on;
      if (u > 0.3 && u < 0.45) vis *= 0.4;
    }
    G.uFlash.value = Math.min(1.5, vis);

    // rain
    rain.visible = env.rain > 0.02;
    if (rain.visible) {
      rain.position.copy(camPos);
      rainMat.uniforms.uT.value = t;
      rainMat.uniforms.uAlpha.value = env.rain * 0.55;
    }
  }
  function reset() { first = true; lastHalf = -1; flash = 0; for (const b of bolts) { b.age = 9; b.mesh.visible = false; } }

  return { group, update, reset, speed: (beat) => speedAtBeat(beat) };
}
