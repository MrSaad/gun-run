import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _n = new THREE.Matrix3();

// Merge simple primitives into one cel-shadeable geometry.
// Each part: { geo, pos:[x,y,z], rot:[x,y,z], scale:[x,y,z]|number, color:0xrrggbb, glow:0|1, ink:bool }
export function merge(parts) {
  const P = [], N = [], U = [], C = [], Gl = [];
  const v = new THREE.Vector3();
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (p.flat) g.computeVertexNormals();
    const s = p.scale ?? 1;
    _e.set(...(p.rot ?? [0, 0, 0]));
    _m.compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      _q.setFromEuler(_e),
      typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s),
    );
    _n.getNormalMatrix(_m);
    const pa = g.attributes.position, na = g.attributes.normal, ua = g.attributes.uv;
    const c = p.color ?? 0xffffff;
    const r = ((c >> 16) & 255) / 255, gg = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
    const ink = p.ink !== false;
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(_m); P.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(_n).normalize(); N.push(v.x, v.y, v.z);
      if (ink && ua) U.push(ua.getX(i), ua.getY(i)); else U.push(0.5, 0.5);
      C.push(r, gg, b); Gl.push(p.glow ? 1 : 0);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.setAttribute('glow', new THREE.Float32BufferAttribute(Gl, 1));
  return out;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const box = (w, h, d, pos, color, extra = {}) => ({ geo: unitBox, scale: [w, h, d], pos, color, ...extra });

// A flat n-point comic "burst" star in the XY plane.
export function starGeometry(points = 10, rOuter = 1, rInner = 0.42, jitter = 0.25, seed = 1) {
  let a = seed * 9301 + 49297;
  const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  const verts = [];
  const ring = [];
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2;
    const r = (i % 2 === 0 ? rOuter * (1 - jitter * rnd()) : rInner * (1 + jitter * rnd()));
    ring.push([Math.cos(ang) * r, Math.sin(ang) * r]);
  }
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    verts.push(0, 0, 0, p[0], p[1], 0, q[0], q[1], 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  return g;
}
