import * as THREE from 'three';
import { toon, col, G } from './materials.js';
import { starGeometry } from './geo.js';

const FIRE_MAX = 160, SMOKE_MAX = 80, DEBRIS_MAX = 160, TRACER_MAX = 40;
const WORDS = ['BOOM!', 'KRAK!', 'BLAM!', 'POW!', 'WHAM!', 'BANG!'];

function wordTexture(word, fill) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d');
  g.translate(256, 128); g.rotate(-0.08); g.transform(1, 0, -0.2, 1, 0, 0);
  g.font = 'italic 900 150px "Arial Black", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.fillStyle = '#d11'; g.fillText(word, 10, 12);
  g.strokeStyle = '#000'; g.lineWidth = 26; g.strokeText(word, 0, 0);
  g.fillStyle = fill; g.fillText(word, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createFx(scene, camera) {
  const ico = new THREE.IcosahedronGeometry(1, 1);
  ico.computeVertexNormals();
  const fire = new THREE.InstancedMesh(ico, toon({ unlit: true }), FIRE_MAX);
  const fireHull = new THREE.InstancedMesh(ico, toon({ hull: 0.09 }), FIRE_MAX);
  fireHull.instanceMatrix = fire.instanceMatrix;
  const smoke = new THREE.InstancedMesh(ico, toon({}), SMOKE_MAX);
  const debris = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toon({ ink: true }), DEBRIS_MAX);
  const tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false, toneMapped: false }), TRACER_MAX);
  const white = new THREE.Color(1, 1, 1);
  for (const m of [fire, fireHull, smoke, debris, tracers]) {
    m.frustumCulled = false; m.count = 0; scene.add(m);
  }
  for (let i = 0; i < FIRE_MAX; i++) fire.setColorAt(i, white);
  for (let i = 0; i < SMOKE_MAX; i++) smoke.setColorAt(i, white);
  for (let i = 0; i < DEBRIS_MAX; i++) debris.setColorAt(i, white);

  const P = { fire: [], smoke: [], debris: [], tracer: [] };
  const FIRE_COLS = [col(0xfffbd6), col(0xffe02a), col(0xff9a12), col(0xff5a0a), col(0xf02a0a)];
  const SMOKE_COLS = [col(0x3a3440), col(0x55505c), col(0x2a2630)];
  const DEB_COLS = [col(0x6d7689), col(0xf28a1c), col(0x2b2f3b)];
  const rnd = (a = 1) => (Math.random() * 2 - 1) * a;

  // impact-frame star bursts
  const stars = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(starGeometry(11, 1, 0.4, 0.35, i + 3), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; scene.add(m); stars.push({ m, age: 9 });
  }
  let starI = 0;

  // comic words
  const texY = WORDS.map((w) => wordTexture(w, '#ffc24a'));
  const words = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ map: texY[0], transparent: true, fog: false, toneMapped: false, depthWrite: false }));
    m.visible = false; m.renderOrder = 20; scene.add(m); words.push({ m, age: 9, tilt: 0, base: 1 });
  }
  let wordI = 0, wordCool = 0;

  // red hit flash, glued to the camera
  const hitQuad = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xff1a10, transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }));
  hitQuad.position.z = -0.4; hitQuad.renderOrder = 100; hitQuad.visible = false;
  camera.add(hitQuad);
  let hitA = 0;

  function explode(pos, big = false, size = 1) {
    const k = (big ? 1.45 : 1) * size;
    P.fire.push({ p: pos.clone(), v: new THREE.Vector3(), life: 0.3, age: 0, s: 1.5 * k, c: FIRE_COLS[0] });
    const n = big ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd(), rnd(), rnd()).normalize().multiplyScalar(3 + Math.random() * 5);
      P.fire.push({ p: pos.clone().addScaledVector(v, 0.05), v, life: 0.35 + Math.random() * 0.3, age: 0, s: (0.55 + Math.random() * 0.6) * k, c: FIRE_COLS[1 + ((Math.random() * 4) | 0)] });
    }
    for (let i = 0; i < 3; i++) {
      const v = new THREE.Vector3(rnd(), rnd(0.6) + 0.5, rnd()).multiplyScalar(2.5);
      P.smoke.push({ p: pos.clone(), v, life: 0.7 + Math.random() * 0.5, age: 0, s: (0.7 + Math.random() * 0.6) * k, c: SMOKE_COLS[i % 3] });
    }
    for (let i = 0; i < 7; i++) {
      const v = new THREE.Vector3(rnd(), rnd() + 0.3, rnd()).normalize().multiplyScalar(6 + Math.random() * 9);
      P.debris.push({ p: pos.clone(), v, life: 0.7 + Math.random() * 0.5, age: 0, s: 0.08 + Math.random() * 0.2, c: DEB_COLS[i % 3], rot: new THREE.Euler(rnd(3), rnd(3), rnd(3)), spin: rnd(14) });
    }
    while (P.fire.length > FIRE_MAX) P.fire.shift();
    while (P.smoke.length > SMOKE_MAX) P.smoke.shift();
    while (P.debris.length > DEBRIS_MAX) P.debris.shift();
    light(pos, 1.5 * k, 0.8 * k, 0.3 * k, big ? 18 : 13, 0.3);
    const st = stars[starI++ % stars.length];
    st.m.position.copy(pos); st.age = 0; st.size = 2.6 * k; st.m.rotation.z = Math.random() * 6.28;
    st.m.material.color.setHex(big ? 0xffffff : 0xfff2a8);
  }

  function word(pos) {
    if (wordCool > 0) return;
    wordCool = 0.3;
    const w = words[wordI++ % words.length];
    w.m.material.map = texY[(Math.random() * texY.length) | 0];
    w.m.position.copy(pos).add(new THREE.Vector3(rnd(0.5), 0.9, 0));
    w.age = 0; w.tilt = rnd(0.3);
  }

  function tracer(a, b) {
    P.tracer.push({ a: a.clone(), b: b.clone(), age: 0, life: 0.07 });
    while (P.tracer.length > TRACER_MAX) P.tracer.shift();
  }

  // real point lights: a pool of four, reused oldest-first
  const lights = [0, 1, 2, 3].map(() => ({ age: 9, life: 0.1, r: 0, g: 0, b: 0 }));
  let lightI = 0;
  function light(pos, r, g, b, radius, life) {
    const i = lightI++ % 4, L = lights[i];
    L.age = 0; L.life = life; L.r = r; L.g = g; L.b = b;
    G.uPLpos.value[i].set(pos.x, pos.y, pos.z, radius);
  }

  function playerHit() { hitA = 0.42; }

  const d = new THREE.Object3D();
  const camPos = new THREE.Vector3(), camQ = new THREE.Quaternion();
  function update(dt, speed) {
    camera.getWorldPosition(camPos); camera.getWorldQuaternion(camQ);
    const wind = 8 + speed * 0.45; // everything gets ripped backwards past the train

    const step = (list, mesh, grav, sizeFn) => {
      let n = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age += dt;
        if (p.age >= p.life || p.p.distanceToSquared(camPos) < 3.0) { list.splice(i, 1); continue; }
        p.v.z += wind * dt; p.v.y -= grav * dt;
        p.p.addScaledVector(p.v, dt);
      }
      for (const p of list) {
        const u = p.age / p.life;
        d.position.copy(p.p);
        if (p.rot) { p.rot.x += p.spin * dt; p.rot.y += p.spin * 0.7 * dt; d.rotation.copy(p.rot); } else d.rotation.set(p.age * 3, p.age * 2, 0);
        d.scale.setScalar(Math.max(0.001, p.s * sizeFn(u)));
        d.updateMatrix();
        mesh.setMatrixAt(n, d.matrix); mesh.setColorAt(n, p.c); n++;
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      return n;
    };
    const fireSize = (u) => (u < 0.25 ? 1 - Math.pow(1 - u / 0.25, 3) : 1 - Math.pow((u - 0.25) / 0.75, 2));
    fireHull.count = step(P.fire, fire, 0, fireSize);
    step(P.smoke, smoke, -1.5, (u) => (0.5 + u) * (1 - u * u * u));
    step(P.debris, debris, 12, (u) => 1 - u * u);

    // tracers
    let n = 0;
    for (let i = P.tracer.length - 1; i >= 0; i--) { P.tracer[i].age += dt; if (P.tracer[i].age > P.tracer[i].life) P.tracer.splice(i, 1); }
    for (const t of P.tracer) {
      const len = t.a.distanceTo(t.b), u = t.age / t.life;
      d.position.lerpVectors(t.a, t.b, 0.5); d.lookAt(t.b); d.rotation.z = 0;
      const w = 0.03 * (1 - u) + 0.006;
      d.scale.set(w, w, len); d.updateMatrix();
      tracers.setMatrixAt(n++, d.matrix);
    }
    tracers.count = n; tracers.instanceMatrix.needsUpdate = true;

    for (const s of stars) {
      s.age += dt;
      s.m.visible = s.age < 0.09;
      if (s.m.visible) { s.m.quaternion.copy(camQ); s.m.rotateZ(s.age * 20); s.m.scale.setScalar(s.size * (0.6 + s.age * 9)); }
    }
    wordCool -= dt;
    for (const w of words) {
      w.age += dt;
      w.m.visible = w.age < 0.6;
      if (!w.m.visible) continue;
      const u = w.age / 0.6;
      const pop = u < 0.15 ? 0.4 + (u / 0.15) * 0.9 : 1.3 - Math.min(1, (u - 0.15) / 0.15) * 0.3;
      const dist = w.m.position.distanceTo(camPos);
      w.m.position.z += wind * 0.15 * dt; w.m.position.y += dt * 0.8;
      w.m.quaternion.copy(camQ); w.m.rotateZ(w.tilt);
      w.m.scale.setScalar(pop * (0.5 + dist * 0.11));
      w.m.material.opacity = u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    }

    lights.forEach((L, i) => {
      L.age += dt;
      const k = Math.max(0, 1 - L.age / L.life);
      G.uPLcol.value[i].set(L.r * k, L.g * k, L.b * k);
    });

    hitA = Math.max(0, hitA - dt * 1.6);
    hitQuad.visible = hitA > 0.01;
    hitQuad.material.opacity = hitA;
  }

  function reset() {
    for (const k in P) P[k].length = 0;
    for (const s of stars) s.age = 9;
    for (const w of words) w.age = 9;
    for (const L of lights) L.age = 9;
    hitA = 0;
  }

  // non-lethal hit on armour: a white impact burst and a few sparks
  function spark(pos, toward) {
    const st = stars[starI++ % stars.length];
    st.m.position.copy(pos).addScaledVector(toward, 0.6); st.age = 0; st.size = 1.1; st.m.rotation.z = Math.random() * 6.28;
    st.m.material.color.setHex(0xffffff);
    for (let i = 0; i < 5; i++) {
      const v = new THREE.Vector3(rnd(), rnd() + 0.4, rnd()).normalize().multiplyScalar(5 + Math.random() * 6).addScaledVector(toward, 4);
      P.debris.push({ p: pos.clone().addScaledVector(toward, 0.5), v, life: 0.35 + Math.random() * 0.25, age: 0, s: 0.05 + Math.random() * 0.06, c: FIRE_COLS[i % 2], rot: new THREE.Euler(rnd(3), rnd(3), rnd(3)), spin: rnd(14) });
    }
    while (P.debris.length > DEBRIS_MAX) P.debris.shift();
    light(pos, 0.9, 0.8, 0.6, 7, 0.08);
  }

  return { explode, spark, word, tracer, playerHit, light, update, reset };
}
