import * as THREE from 'three';
import { merge, box, starGeometry } from './geo.js';
import { toon } from './materials.js';

// Barrel points down -Z. Origin is roughly where the controller's pointer ray starts.
function pistolGeometry() {
  const steel = 0x8791a6, dark = 0x2a2e3a, accent = 0xff8a12, cyan = 0x4ea0ff;
  return merge([
    box(0.046, 0.062, 0.3, [0, 0.01, -0.13], steel),                       // slide
    box(0.036, 0.036, 0.26, [0, -0.035, -0.12], dark),                     // frame
    box(0.06, 0.08, 0.06, [0, 0.01, -0.3], accent),                        // muzzle brake
    box(0.02, 0.02, 0.03, [0, 0.01, -0.335], 0x111111, { ink: false }),    // bore
    box(0.042, 0.14, 0.056, [0, -0.11, 0.02], dark, { rot: [0.28, 0, 0] }),// grip
    box(0.012, 0.05, 0.07, [0, -0.07, -0.05], dark),                       // trigger guard
    box(0.012, 0.03, 0.02, [0, 0.055, -0.27], accent),                     // front sight
    box(0.03, 0.02, 0.02, [0, 0.05, 0.0], dark),                           // rear sight
    box(0.05, 0.012, 0.2, [0, 0.01, -0.12], cyan, { glow: 1, ink: false }),// energy strip
  ]);
}
function uziGeometry() {
  const steel = 0x767f93, dark = 0x23262f, accent = 0xff8a2a, hot = 0xffa040;
  return merge([
    box(0.05, 0.085, 0.27, [0, 0.0, -0.09], steel),                        // receiver
    box(0.028, 0.028, 0.13, [0, 0.0, -0.285], dark),                       // barrel
    box(0.04, 0.04, 0.04, [0, 0.0, -0.345], hot),                          // flash hider
    box(0.036, 0.25, 0.05, [0, -0.16, 0.0], dark, { rot: [0.12, 0, 0] }),  // long magazine / grip
    box(0.012, 0.045, 0.07, [0, -0.06, -0.07], dark),                      // trigger guard
    box(0.03, 0.03, 0.12, [0, 0.03, 0.1], dark),                           // stub stock
    box(0.02, 0.03, 0.03, [0, 0.055, -0.19], dark),                        // sight
    box(0.054, 0.014, 0.2, [0, 0.012, -0.09], accent, { glow: 1, ink: false }),
    box(0.054, 0.014, 0.2, [0, -0.02, -0.09], accent, { glow: 1, ink: false }),
  ]);
}

export function createGuns({ scene, camera, fx, audio, robots, onHit, stats }) {
  const bodyMat = toon({ vertexColors: true, ink: true, glowAttr: true, beatGlow: 1.2, minLit: 0.5, detail: 7.0 });
  const hullMat = toon({ hull: 0.0045 });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
  const laserGeo = new THREE.BoxGeometry(1, 1, 1); laserGeo.translate(0, 0, -0.5); // unit beam along -Z, scaled per frame

  // lock-on reticle: four comic corner brackets, drawn on top of everything
  const reticleGeo = (() => {
    const pos = [], L = 0.42, W = 0.09;
    const quad = (x0, y0, x1, y1) => pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = sx, y = sy;
      quad(Math.min(x, x - sx * L), Math.min(y, y - sy * W), Math.max(x, x - sx * L), Math.max(y, y - sy * W));
      quad(Math.min(x, x - sx * W), Math.min(y, y - sy * L), Math.max(x, x - sx * W), Math.max(y, y - sy * L));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
  })();
  const dotGeo = new THREE.CircleGeometry(1, 16);
  const pg = pistolGeometry(), ug = uziGeometry();
  const star = starGeometry(8, 1, 0.38, 0.4, 5), starCore = starGeometry(8, 0.5, 0.2, 0.3, 9);
  const spike = new THREE.PlaneGeometry(0.07, 0.5); spike.rotateX(-Math.PI / 2); spike.translate(0, 0, -0.25);

  const desktopHolders = [-1, 1].map((sx) => {
    const h = new THREE.Group();
    h.position.set(sx * 0.24, -0.2, -0.5); h.rotation.set(0.02, -sx * 0.06, 0);
    camera.add(h); return h;
  });

  let uzi = false, xr = false;
  const guns = [0, 1].map((i) => {
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);
    body.position.set(0, -0.015, 0.04);
    const pistol = new THREE.Group(); pistol.add(new THREE.Mesh(pg, bodyMat), new THREE.Mesh(pg, hullMat));
    const uziM = new THREE.Group(); uziM.add(new THREE.Mesh(ug, bodyMat), new THREE.Mesh(ug, hullMat)); uziM.visible = false;
    const flash = new THREE.Group(); flash.visible = false;
    const s1 = new THREE.Mesh(star, flashMat), s2 = new THREE.Mesh(starCore, coreMat); s2.position.z = -0.002;
    const sp1 = new THREE.Mesh(spike, flashMat), sp2 = new THREE.Mesh(spike, flashMat); sp2.rotation.z = Math.PI / 2;
    flash.add(s1, s2, sp1, sp2);
    const muzzle = new THREE.Object3D();
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, fog: false, toneMapped: false, transparent: true, opacity: 0.28, depthWrite: false });
    const laser = new THREE.Mesh(laserGeo, laserMat); laser.position.set(0, 0.01, -0.3);
    const reticle = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0xff5a2a, fog: false, toneMapped: false, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    reticle.renderOrder = 40; reticle.visible = false; scene.add(reticle);
    const dot = new THREE.Group();
    const dotOuter = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xff3a1a, fog: false, toneMapped: false, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    const dotCore = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xfff0e0, fog: false, toneMapped: false, depthTest: false, depthWrite: false }));
    dotCore.scale.setScalar(0.4); dotCore.renderOrder = 42; dotOuter.renderOrder = 41;
    dot.add(dotOuter, dotCore); dot.visible = false; scene.add(dot);
    body.add(pistol, uziM, flash, muzzle, laser);
    desktopHolders[i].add(root);
    const g = { i, root, body, pistol, uziM, flash, muzzle, laser, laserMat, reticle, dot, target: null, lockT: 0, kick: 0, flashT: 0, held: false, last: -1, lastShot: -1, aim: camera, src: null };
    setMuzzle(g);
    return g;
  });
  function setMuzzle(g) {
    const z = uzi ? -0.37 : -0.34, y = uzi ? 0.0 : 0.01;
    g.muzzle.position.set(0, y, z); g.flash.position.set(0, y, z);
  }

  const origin = new THREE.Vector3(), dir = new THREE.Vector3(), mp = new THREE.Vector3(), end = new THREE.Vector3(), q = new THREE.Quaternion();
  function fire(g) {
    g.aim.getWorldPosition(origin);
    g.aim.getWorldQuaternion(q);
    dir.set(0, 0, -1).applyQuaternion(q).normalize();
    g.muzzle.getWorldPosition(mp);
    const rb = robots.hitTest(origin, dir);
    if (rb) end.copy(rb.pos); else end.copy(origin).addScaledVector(dir, 140);
    fx.tracer(mp, end);
    fx.light(mp, 1.1, 0.85, 0.4, uzi ? 4.5 : 6.5, uzi ? 0.05 : 0.09);
    stats.shots++;
    g.kick = uzi ? 0.55 : 1;
    g.flashT = uzi ? 0.045 : 0.065;
    g.flash.rotation.z = Math.random() * 6.28;
    g.flash.scale.setScalar((uzi ? 0.11 : 0.17) * (0.8 + Math.random() * 0.5));
    audio.sfx(uzi ? 'uzi' : 'pistol', uzi ? 0.22 : 0.42, 0.92 + Math.random() * 0.16);
    const act = g.src && g.src.gamepad && g.src.gamepad.hapticActuators && g.src.gamepad.hapticActuators[0];
    if (act && act.pulse) act.pulse(uzi ? 0.5 : 0.9, uzi ? 30 : 60);
    if (rb) onHit(rb, dir.clone().negate());
  }

  function press(i, enabled, beat, now) {
    const g = guns[i]; g.held = true;
    if (!enabled) return;
    if (uzi) { fire(g); g.last = Math.floor(beat * 4 + i * 0.5); }
    else if (now - g.lastShot > 0.085) { g.lastShot = now; fire(g); }
  }
  function release(i) { guns[i].held = false; }

  const camQ = new THREE.Quaternion(), camP = new THREE.Vector3(), hitP = new THREE.Vector3();
  function haptic(g, s, ms) {
    const act = g.src && g.src.gamepad && g.src.gamepad.hapticActuators && g.src.gamepad.hapticActuators[0];
    if (act && act.pulse) act.pulse(s, ms);
  }
  // What each gun is pointing at, every frame: drives the outline glow, reticle, laser length and dot.
  function updateTargets(dt, enabled) {
    camera.getWorldQuaternion(camQ); camera.getWorldPosition(camP);
    guns.forEach((g, gi) => {
      let rb = null;
      if (enabled) {
        g.aim.getWorldPosition(origin); g.aim.getWorldQuaternion(q);
        dir.set(0, 0, -1).applyQuaternion(q).normalize();
        rb = robots.hitTest(origin, dir);
      }
      if (g.target && g.target.state !== 1) g.target = null;
      if (rb !== g.target) {
        if (g.target) g.target.locked = Math.max(0, g.target.locked - 1);
        if (rb) {
          rb.locked = (rb.locked || 0) + 1; g.lockT = 0;
          haptic(g, 0.25, 18);
        }
        g.target = rb;
      }
      g.lockT += dt;
      const showRet = !!rb && (xr || gi === 0); // desktop: both guns share the camera ray, show one reticle
      g.reticle.visible = showRet;
      if (rb) {
        const along = hitP.subVectors(rb.pos, origin).dot(dir);
        if (showRet) {
          const pop = Math.max(0, 1 - g.lockT / 0.12);                     // snaps in from wide
          const R = rb.rad * rb.scale * 1.15 * (1 + pop * 0.9);
          g.reticle.position.copy(rb.pos);
          g.reticle.quaternion.copy(camQ);
          g.reticle.rotateZ((gi ? -1 : 1) * (0.785 * pop + g.lockT * 0.6));
          g.reticle.scale.setScalar(R);
          g.reticle.material.opacity = 0.75 + 0.25 * Math.sin(g.lockT * 30);
          g.reticle.material.color.setHex(rb.type === 'brute' ? 0xffa040 : 0xff5a2a);
        }
        // laser ends on the enemy's surface, brighter and fatter
        const len = Math.max(0.3, along - rb.rad * rb.scale * 0.7);
        g.laser.scale.set(0.007, 0.007, len);
        g.laserMat.opacity = 0.75;
        hitP.copy(origin).addScaledVector(dir, len + 0.05);
        g.dot.visible = xr;
        g.dot.position.copy(hitP);
        g.dot.quaternion.copy(camQ);
        g.dot.scale.setScalar(0.06 + 0.02 * Math.sin(g.lockT * 25));
      } else {
        g.laser.scale.set(0.004, 0.004, 45);
        g.laserMat.opacity = 0.28;
        g.dot.visible = false;
      }
    });
  }

  function update(dt, beat, enabled) {
    updateTargets(dt, enabled);
    for (const g of guns) {
      if (uzi && g.held && enabled) {
        const idx = Math.floor(beat * 4 + g.i * 0.5); // 16th-note grid, hands offset by a 32nd
        if (idx !== g.last) { g.last = idx; fire(g); }
      }
      g.kick *= Math.exp(-dt * 16);
      g.body.rotation.x = g.kick * 0.32;
      g.body.position.z = 0.04 + g.kick * 0.035;
      g.flashT -= dt;
      g.flash.visible = g.flashT > 0;
      g.laser.visible = xr;
    }
  }

  function setUzi(on, silent) {
    if (on === uzi) return;
    uzi = on;
    for (const g of guns) { g.pistol.visible = !on; g.uziM.visible = on; setMuzzle(g); g.kick = 1.5; }
    if (!silent) audio.sfx('power', 0.5);
  }

  function attachXR(controllers) {
    xr = true;
    guns.forEach((g, i) => { controllers[i].add(g.root); g.aim = controllers[i]; g.src = controllers[i].userData.src || null; });
  }
  function attachDesktop() {
    xr = false;
    guns.forEach((g, i) => { desktopHolders[i].add(g.root); g.aim = camera; g.src = null; g.held = false; });
  }
  function setSource(i, src) { if (xr) guns[i].src = src; }
  function pulse(strength, ms) {
    for (const g of guns) {
      const act = g.src && g.src.gamepad && g.src.gamepad.hapticActuators && g.src.gamepad.hapticActuators[0];
      if (act && act.pulse) act.pulse(strength, ms);
    }
  }

  return { guns, press, release, update, setUzi, attachXR, attachDesktop, setSource, pulse, get uzi() { return uzi; } };
}
