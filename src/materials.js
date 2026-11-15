import * as THREE from 'three';

// Colours are authored as display values and written straight to the framebuffer
// (no colour-space conversion in the custom shaders), which keeps the flat comic look.
export const hex = (h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);
export const col = (h) => new THREE.Color().setRGB(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255);

// Uniforms shared by every material in the scene.
export const G = {
  uFogColor: { value: new THREE.Vector3(0.02, 0.045, 0.06) },
  uFogNear: { value: 15 },
  uFogFar: { value: 240 },
  uAmbient: { value: new THREE.Vector3(0.4, 0.5, 0.55) },
  uLightDir: { value: new THREE.Vector3(0, 1, 0) },
  uLightCol: { value: new THREE.Vector3(0.5, 0.6, 0.65) },
  uFlash: { value: 0 },
  uBeat: { value: 0 },
  uTime: { value: 0 },
  uStorm: { value: 0 },
  uRain: { value: 0 },
  // four real point lights (muzzle flashes, explosions): xyz = position, w = radius
  uPLpos: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, -999, 0, 1)) },
  uPLcol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
};

// Two small tiling greyscale textures give surfaces some material character.
let _detail = null;
export function detailTextures() {
  if (_detail) return _detail;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const make = (draw) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d');
    draw(g);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  };
  const speckle = (g, n, a) => { for (let i = 0; i < n; i++) { const v = rnd() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); } };
  const metal = make((g) => {
    g.fillStyle = '#868686'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) { const v = 110 + rnd() * 50; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect((i % 2) * 128, Math.floor(i / 2) * 128, 128, 128); }
    speckle(g, 1500, 0.12);
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) { // scratches
      const x = rnd() * 256, y = rnd() * 256, a = rnd() * 6.28, l = 8 + rnd() * 40;
      g.strokeStyle = `rgba(235,235,235,${0.15 + rnd() * 0.3})`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(40,40,40,${0.12 + rnd() * 0.15})`; g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 8 + rnd() * 22, 5 + rnd() * 14, rnd() * 3, 0, 6.28); g.fill(); }
    for (const o of [0, 128]) { // plate seams with a bevel
      g.fillStyle = '#2e2e2e'; g.fillRect(o, 0, 3, 256); g.fillRect(0, o, 256, 3);
      g.fillStyle = 'rgba(230,230,230,0.5)'; g.fillRect(o + 3, 0, 1, 256); g.fillRect(0, o + 3, 256, 1);
    }
    for (const x of [14, 114, 142, 242]) for (const y of [14, 114, 142, 242]) { // rivets
      g.fillStyle = '#383838'; g.beginPath(); g.arc(x, y, 4.2, 0, 6.28); g.fill();
      g.fillStyle = '#c8c8c8'; g.beginPath(); g.arc(x - 1, y - 1, 2.2, 0, 6.28); g.fill();
    }
  });
  const concrete = make((g) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { // blotches (drawn wrapped so the tile repeats cleanly)
      const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 34, v = rnd() < 0.5 ? 50 : 200;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, `rgba(${v},${v},${v},0.16)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    speckle(g, 5000, 0.2);
    for (let i = 0; i < 9; i++) { // drips
      const x = rnd() * 256, y = rnd() * 200, l = 30 + rnd() * 90, w = 2 + rnd() * 5;
      const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(30,30,30,0.4)'); gr.addColorStop(1, 'rgba(30,30,30,0)');
      g.fillStyle = gr; g.fillRect(x, y, w, l);
    }
    g.strokeStyle = 'rgba(25,25,25,0.6)'; g.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) { // cracks
      let x = rnd() * 256, y = rnd() * 256; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 34; y += rnd() * 22; g.lineTo(x, y); }
      g.stroke();
    }
  });
  _detail = { metal, concrete };
  return _detail;
}

const FRAG_COMMON = /* glsl */ `
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
uniform vec3 uAmbient; uniform vec3 uLightDir; uniform vec3 uLightCol;
uniform float uFlash; uniform float uBeat; uniform float uTime;
const vec3 INKCOL = vec3(0.012, 0.012, 0.03);
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float toonBand(vec3 n){
  float ndl = dot(n, uLightDir);
  return ndl > 0.5 ? 1.0 : (ndl > -0.1 ? 0.55 : 0.2);
}
vec3 toonLit(vec3 base, float band){
  return base * (uAmbient + uLightCol * band) + base * uFlash * (0.3 + band) * vec3(0.8, 0.9, 1.3);
}
float inkEdge(vec2 uv, float dist){
  vec2 d = max(fwidth(uv), vec2(1e-6));
  vec2 a = min(uv, 1.0 - uv) / d;
  float e = 1.0 - smoothstep(0.8, 1.8, min(a.x, a.y));
  return e * (1.0 - smoothstep(90.0, 320.0, dist));
}
uniform vec4 uPLpos[4]; uniform vec3 uPLcol[4];
vec3 pointLights(vec3 wpos, vec3 n){
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = uPLpos[i].xyz - wpos;
    float dist = length(d);
    float att = clamp(1.0 - dist / uPLpos[i].w, 0.0, 1.0);
    att = floor(att * 3.0 + 0.7) / 3.0;                       // stepped falloff, like the rest of the shading
    float facing = dot(n, d / max(dist, 1e-3)) > -0.15 ? 1.0 : 0.25;
    sum += uPLcol[i] * att * facing;
  }
  return sum;
}
vec3 grade(vec3 c){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 0.78);            // pull saturation down
  return c * 0.95 / (1.0 + 0.1 * l);    // and take the edge off the brightest neon
}
vec3 applyFog(vec3 c, float dist){
  return grade(mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist)));
}
`;

const VERT_HEAD = /* glsl */ `
varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying vec3 vPos; varying vec3 vW;
mat4 modelM(){
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = m * instanceMatrix;
  #endif
  return m;
}
`;

// ---- generic cel-shaded material -------------------------------------------------
export function toon(o = {}) {
  const defines = {};
  if (o.ink) defines.INK = 1;
  if (o.glowAttr) defines.HAS_GLOW = 1;
  if (o.allGlow) defines.ALLGLOW = 1;
  if (o.hull) defines.HULL = o.hull.toFixed(4);
  if (o.tintGlow) defines.TINT_GLOW = 1;
  if (o.unlit) defines.UNLIT = 1;
  if (o.minLit) defines.MINLIT = o.minLit.toFixed(3);
  if (o.detail) defines.DETAIL = o.detail.toFixed(3);
  if (o.pulse) defines.PULSE = 1;
  if (o.halo) { defines.HALO = o.halo.toFixed(3); defines.HALOSTR = (o.haloStrength ?? 0.3).toFixed(3); }
  defines.BEATGLOW = (o.beatGlow ?? 0.35).toFixed(3);
  return new THREE.ShaderMaterial({
    defines,
    uniforms: { ...G, uColor: { value: hex(o.color ?? 0xffffff) }, uDetail: { value: o.detail ? detailTextures()[o.detailTex ?? 'metal'] : null } },
    vertexColors: !!o.vertexColors,
    transparent: !!o.halo, depthWrite: !o.halo, blending: o.halo ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: o.hull ? THREE.BackSide : (o.side ?? THREE.FrontSide),
    vertexShader: VERT_HEAD + /* glsl */ `
      uniform vec3 uColor;
      #ifdef HAS_GLOW
        attribute float glow;
      #endif
      varying vec3 vCol; varying float vGlow; varying vec3 vTint;
      varying vec3 vLp; varying vec3 vLn;
      void main(){
        mat4 m = modelM();
        vec3 p = position;
        #ifdef USE_INSTANCING
          vLp = (instanceMatrix * vec4(position, 1.0)).xyz; vLn = mat3(instanceMatrix) * normal;
          #ifdef HALO
            vec3 hsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
            p += sign(position) * min(vec3(HALO), hsc * 0.9) / hsc;
          #endif
        #else
          vLp = position; vLn = normal;
        #endif
        #ifdef HULL
          p += normalize(normal) * HULL;
        #endif
        vec4 wp = m * vec4(p, 1.0);
        vW = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vView = mv.xyz;
        vN = mat3(m) * normal;
        vUv = uv;
        vCol = uColor;
        #ifdef USE_COLOR
          vCol *= color;
        #endif
        vGlow = 0.0;
        #ifdef HAS_GLOW
          vGlow = glow;
        #endif
        #ifdef ALLGLOW
          vGlow = 1.0;
        #endif
        vTint = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vTint = instanceColor;
        #endif
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec2 vUv;
      varying vec3 vCol; varying float vGlow; varying vec3 vTint;
      varying vec3 vLp; varying vec3 vLn; varying vec3 vW;
      uniform sampler2D uDetail;
      void main(){
        float dist = length(vView);
        #ifdef HALO
          float hf = 1.0 - smoothstep(uFogNear, uFogFar, dist);
          gl_FragColor = vec4(grade(vCol * vTint) * HALOSTR * hf * (0.8 + uBeat * 0.6), 1.0);
          return;
        #endif
        #ifdef HULL
          vec3 c = INKCOL;
        #else
          vec3 base = vCol;
          vec3 g = vCol;
          #ifdef TINT_GLOW
            g *= vTint;
          #else
            base *= vTint; g *= vTint;
          #endif
          #ifdef DETAIL
            vec3 an = abs(normalize(vLn));
            vec2 duv = an.x > 0.5 ? vLp.zy : (an.y > 0.5 ? vLp.xz : vLp.xy);
            base *= 0.6 + 0.8 * texture2D(uDetail, duv * DETAIL).r;
          #endif
          #ifdef PULSE
            g *= 0.72 + 0.7 * step(0.86, fract(vLp.z * 0.05 + uTime * 0.9));
          #endif
          float band = toonBand(normalize(vN));
          #ifdef UNLIT
            vec3 c = base * (band > 0.9 ? 1.0 : (band > 0.4 ? 0.93 : 0.8));
          #else
            vec3 c = toonLit(base, band) + base * pointLights(vW, normalize(vN));
            #ifdef MINLIT
              c = max(c, base * MINLIT * (0.55 + 0.45 * band));
            #endif
          #endif
          #ifdef DETAIL
            if (band < 0.9) { // comic hatching in the shaded bands
              float hz = step(0.55, fract((duv.x + duv.y) * DETAIL * 16.0));
              c *= 1.0 - 0.24 * hz * (1.0 - smoothstep(22.0, 60.0, dist));
            }
          #endif
          c = mix(c, g * (1.0 + uBeat * BEATGLOW), vGlow);
          #ifdef INK
            c = mix(c, INKCOL, inkEdge(vUv, dist) * 0.9);
          #endif
        #endif
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- city buildings: instanced unit boxes with procedural lit windows -------------
export function buildingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, uDetail: { value: detailTextures().concrete } },
    vertexShader: VERT_HEAD + /* glsl */ `
      varying vec3 vLocal; varying float vSeed; varying float vTop; varying vec3 vTint;
      void main(){
        mat4 m = modelM();
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vLocal = position * sc;
        vTop = sc.y * 0.5;
        vSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        vTint = instanceColor;
        vec4 mv = viewMatrix * (m * vec4(position, 1.0));
        vView = mv.xyz; vN = mat3(m) * normal; vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec2 vUv;
      varying vec3 vLocal; varying float vSeed; varying float vTop; varying vec3 vTint;
      uniform sampler2D uDetail;
      vec3 pal(float h){
        return h < 0.58 ? vec3(1.0, 0.6, 0.26) : (h < 0.88 ? vec3(0.34, 0.6, 1.0) : vec3(1.0, 0.9, 0.74));
      }
      void main(){
        float dist = length(vView);
        vec3 n = normalize(vN);
        float band = toonBand(n);
        float wall = abs(n.y) > 0.5 ? 0.0 : 1.0;
        vec2 wc = abs(n.x) > 0.5 ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
        vec2 tuv = wall > 0.5 ? wc : vLocal.xz;
        vec3 c = toonLit(vTint * (0.62 + 0.76 * texture2D(uDetail, tuv * 0.045).r), band);
        vec2 q = wc / vec2(4.0, 3.6);
        vec2 cell = floor(q); vec2 f = fract(q);
        float sid = floor(vSeed * 255.0 + 0.5);
        float seed = sid / 255.0;
        float h = hash21(cell + vec2(sid * 7.0, sid * 13.0));
        float lit = step(0.66, h);
        float style = fract(seed * 11.3);
        float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.25, f.y) * step(f.y, 0.8);
        if (style > 0.72) win = step(0.32, f.x) * step(f.x, 0.68) * step(0.1, f.y) * step(f.y, 0.92);          // tall slits
        else if (style > 0.42) { win = step(0.3, f.y) * step(f.y, 0.74); lit = step(0.7, hash21(vec2(floor(cell.x / 3.0), cell.y) + sid)); } // ribbons
        lit *= 1.0 - step(0.975, h) * step(0.5, fract(uTime * (1.5 + fract(h * 53.0) * 5.0)));                   // the odd flicker
        float fw = max(fwidth(q.x), fwidth(q.y));
        float detail = 1.0 - smoothstep(0.2, 0.6, fw);
        vec3 wcol = pal(fract(seed * 3.7 + step(0.9, h) * 0.37)) * (0.5 + 0.4 * fract(h * 17.0));
        c *= 1.0 - 0.45 * step(f.y, 0.07) * wall * detail;   // floor ledges
        c = mix(c, wcol, win * lit * wall * detail);
        c += wcol * 0.11 * (1.0 - detail) * wall;
        // neon trim along some rooftops
        float trim = step(vTop - 1.6, vLocal.y) * step(0.8, fract(seed * 7.3)) * wall;
        c = mix(c, pal(fract(seed * 5.1)) * (1.0 + uBeat * 0.4), trim);
        c = mix(c, INKCOL, inkEdge(vUv, dist) * 0.9);
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- tunnel shell ---------------------------------------------------------------
export function tunnelMaterial({ period, colA, colB, wall, self = 0, ringSp = 16, ringOff = 0 }) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...G,
      uPeriod: { value: period }, uColA: { value: hex(colA) }, uColB: { value: hex(colB) },
      uDetail: { value: detailTextures().concrete },
      uWall: { value: hex(wall) }, uSelf: { value: self }, uRingSp: { value: ringSp }, uRingOff: { value: ringOff },
    },
    vertexShader: VERT_HEAD + /* glsl */ `
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        vView = mv.xyz; vN = mat3(modelMatrix) * normal; vPos = position; vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vPos; varying vec3 vW;
      uniform sampler2D uDetail;
      uniform float uPeriod; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uWall; uniform float uSelf; uniform float uRingSp; uniform float uRingOff;
      void main(){
        float dist = length(vView);
        vec3 n = normalize(vN);
        float s = -vPos.z;
        float q = s / uPeriod;
        float fq = fract(q);
        vec3 base = uWall * (mod(floor(q), 2.0) < 0.5 ? 1.0 : 0.82);
        vec2 tuv = abs(n.x) > 0.9 ? vec2(s, vPos.y) : vec2(s, vPos.x);
        base *= 0.6 + 0.8 * texture2D(uDetail, tuv * 0.16).r;
        base *= 1.0 - 0.3 * step(0.6, texture2D(uDetail, vec2(s * 0.37, vPos.y * 0.02)).r) * step(0.9, abs(n.x)); // water stains
        float band = toonBand(n);
        vec3 c = mix(toonLit(base, band) + base * pointLights(vW, n) * 1.25, base, uSelf);
        // the only light in here comes from the fittings: pools around rings, strips and ceiling lamps
        float isWallP = step(0.9, abs(n.x));
        float rd = abs(fract((s - uRingOff) / uRingSp + 0.5) - 0.5) * uRingSp;
        vec3 pool = uColA * 0.42 * exp(-rd * 0.55);
        pool += uColA * 0.3 * exp(-abs(vPos.y - 1.25) * 1.5) * isWallP;
        pool += uColB * 0.12 * exp(-abs(vPos.y + 1.6) * 1.5) * isWallP * step(0.5, fract(q * 0.5));
        pool += mix(uColA, vec3(1.0), 0.5) * 0.22 * exp(-abs(vPos.x) * 0.7) * step(n.y, -0.3) * step(fq, 0.55);
        float pb = floor(clamp(dot(pool, vec3(0.4)), 0.0, 1.0) * 5.0 + 0.5) / 5.0; // stepped, comic falloff
        c += base * normalize(pool + 1e-4) * pb * 3.2 * (1.0 + uBeat * 0.35) * (1.0 - uSelf);
        float near = 1.0 - smoothstep(60.0, 160.0, dist);
        // panel seams
        float seam = 1.0 - smoothstep(0.03, 0.07, min(fq, 1.0 - fq) * uPeriod);
        c = mix(c, INKCOL, seam * 0.85 * near * (1.0 - uSelf * 0.7));
        float isWall = step(0.9, abs(n.x));
        // cable trunking
        float cable = step(2.25, vPos.y) * step(vPos.y, 2.7) * isWall;
        c = mix(c, c * 0.45, cable);
        // neon strips
        float glowK = 1.0 + uBeat * 0.5;
        float sA = (1.0 - smoothstep(0.07, 0.1, abs(vPos.y - 1.25))) * isWall;
        c = mix(c, uColA * glowK * (0.78 + 0.4 * step(0.8, fract(q * 0.125 - uTime * 0.7))), sA); // chase pulse
        float sB = (1.0 - smoothstep(0.1, 0.13, abs(vPos.y + 1.6))) * isWall * step(0.5, fract(q * 0.5));
        c = mix(c, uColB * glowK, sB);
        // ceiling light dashes
        float ceilL = step(n.y, -0.9) * step(abs(vPos.x), 0.35) * step(fq, 0.55);
        c = mix(c, mix(uColA, vec3(1.0), 0.6) * glowK, ceilL);
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- track deck -----------------------------------------------------------------
export function deckMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...G, uDetail: { value: detailTextures().concrete }, uRain: G.uRain },
    vertexShader: VERT_HEAD + /* glsl */ `
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vW = (modelMatrix * vec4(position, 1.0)).xyz;
        vView = mv.xyz; vPos = position; vN = vec3(0.0, 1.0, 0.0); vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vView; varying vec3 vPos; varying vec3 vW;
      uniform sampler2D uDetail; uniform float uRain;
      void main(){
        float dist = length(vView);
        float ax = abs(vPos.x);
        vec3 base = vec3(0.14, 0.14, 0.18) * (0.65 + 0.7 * texture2D(uDetail, vPos.xz * 0.3).r);
        float sl = step(ax, 1.35) * step(fract(-vPos.z / 0.9), 0.4) * (1.0 - smoothstep(40.0, 110.0, dist));
        base = mix(base, vec3(0.26, 0.23, 0.22), sl);
        float rail = step(0.68, ax) * step(ax, 0.82);
        base = mix(base, vec3(0.62, 0.66, 0.74), rail);
        vec3 c = toonLit(base, 1.0) + base * pointLights(vW, vec3(0.0, 1.0, 0.0));
        // rain: puddles pick up the neon haze
        float puddle = step(0.56, texture2D(uDetail, vPos.xz * 0.045 + 0.31).r) * uRain * (1.0 - rail);
        c = mix(c, c * 0.45 + uFogColor * 1.5 + vec3(0.05, 0.08, 0.16) * uBeat, puddle);
        float edge = step(4.3, ax) * step(ax, 4.6);
        c = mix(c, vec3(1.0, 0.75, 0.1) * 0.8, edge * step(0.5, fract(-vPos.z / 4.0)));
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- ground far below the viaduct -------------------------------------------------
export function groundMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...G },
    vertexShader: VERT_HEAD + /* glsl */ `
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz; vPos = position;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vView; varying vec3 vPos;
      void main(){
        float dist = length(vView);
        vec2 g = abs(fract(vPos.xz / 70.0) - 0.5) * 70.0;
        float road = 1.0 - step(3.0, min(g.x, g.y));
        float dash = step(0.5, fract((vPos.x + vPos.z) / 9.0));
        vec3 c = mix(vec3(0.025, 0.032, 0.06), vec3(0.6, 0.32, 0.1) * (0.4 + 0.4 * dash), road);
        c += vec3(0.1, 0.12, 0.2) * uFlash;
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- sky: procedural night skybox (stars, moon, banded clouds, far skyline) ----------
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...G },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uFogColor; uniform float uFlash; uniform float uStorm; uniform float uTime;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p){ return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 7.3) + 0.15 * vnoise(p * 4.3 + 1.7); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        float t = pow(1.0 - h, 5.0);
        t = floor(t * 7.0 + 0.5) / 7.0;                       // banded, comic-style gradient
        vec3 top = mix(vec3(0.018, 0.03, 0.085), vec3(0.012, 0.018, 0.045), uStorm);
        vec3 hor = mix(vec3(0.42, 0.21, 0.1), vec3(0.17, 0.15, 0.2), uStorm);   // sodium glow off the city
        vec3 c = mix(top, hor, t);
        // stars
        vec2 sp = d.xz / (d.y + 0.35) * 70.0;
        vec2 sc = floor(sp);
        float sr = h21(sc);
        float star = step(0.93, sr) * step(length(fract(sp) - 0.5 - (vec2(h21(sc + 3.1), h21(sc + 9.7)) - 0.5) * 0.6), 0.05 + 0.09 * fract(sr * 31.0));
        c += vec3(0.8, 0.85, 1.0) * star * (0.5 + 0.5 * fract(sr * 77.0)) * smoothstep(0.08, 0.3, d.y) * (1.0 - uStorm);
        // moon with a couple of maria
        vec3 md = normalize(vec3(-0.3, 0.33, -0.9));
        float m = dot(d, md);
        float moon = step(0.9978, m);
        vec3 mr = normalize(cross(md, vec3(0.0, 1.0, 0.0))), mu = cross(mr, md);
        vec2 mp = vec2(dot(d, mr), dot(d, mu)) / 0.066;
        float mare = step(length(mp - vec2(0.25, 0.3)), 0.28) + step(length(mp - vec2(-0.35, -0.1)), 0.2) + step(length(mp - vec2(0.2, -0.45)), 0.14);
        vec3 mcol = mix(vec3(0.93, 0.9, 1.0), vec3(0.7, 0.68, 0.86), min(mare, 1.0));
        float halo = step(0.992, m) * 0.06 + step(0.982, m) * 0.035;
        // clouds: two cel bands, thicker and lower in the storm
        vec2 cp = d.xz / (d.y + 0.16);
        float n = fbm(cp * 1.15 + vec2(uTime * 0.012, uTime * 0.004));
        float th = mix(0.56, 0.4, uStorm);
        float cover = step(th, n) * smoothstep(0.02, 0.12, d.y);
        float thick = step(th + 0.1, n);
        vec3 cl = mix(vec3(0.06, 0.08, 0.14), vec3(0.035, 0.045, 0.085), thick);
        cl = mix(cl, hor * 0.75, t * 0.9);                    // city glow on the cloud base
        cl += uFlash * vec3(0.3, 0.34, 0.55) * (1.0 - thick * 0.6);
        c += (mcol * moon + vec3(0.45, 0.58, 0.9) * halo) * (1.0 - cover) * (1.0 - uStorm * 0.9);
        c = mix(c, cl, cover);
        // distant skyline silhouette with pin-prick lights
        float az = atan(d.x, -d.z);
        float bx = az * 46.0, bi = floor(bx);
        float bh = 0.025 + 0.085 * pow(h21(vec2(bi, 4.0)), 2.2) + 0.03 * step(0.9, h21(vec2(bi, 9.0)));
        float bx2 = az * 17.0 + 3.0, bi2 = floor(bx2);
        float bh2 = 0.02 + 0.13 * pow(h21(vec2(bi2, 2.0)), 3.0);
        vec3 haze = mix(uFogColor, hor, 0.35);
        if (d.y < bh2) c = mix(haze, vec3(0.035, 0.045, 0.09), 0.4);
        if (d.y < bh) {
          c = mix(uFogColor, vec3(0.02, 0.028, 0.06), 0.6);
          vec2 wc = vec2(floor(fract(bx) * 5.0), floor(d.y * 260.0));
          float wl = step(0.82, h21(wc + bi * 13.0)) * step(0.15, fract(bx)) * step(fract(bx), 0.85);
          c += vec3(0.75, 0.5, 0.28) * wl * 0.55;
          c += vec3(0.9, 0.15, 0.1) * step(bh - 0.004, d.y) * step(0.8, h21(vec2(bi, 21.0))) * step(0.4, fract(bx)) * step(fract(bx), 0.6);
        }
        c = mix(c, uFogColor, smoothstep(0.035, 0.0, d.y));
        c += uFlash * vec3(0.2, 0.24, 0.42) * (0.3 + t);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 0.82) * 0.96;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ---- neon signs from an atlas -----------------------------------------------------
export function signMaterial(atlas) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { ...G, uMap: { value: atlas } },
    vertexShader: VERT_HEAD + /* glsl */ `
      attribute float aCell; varying float vFl;
      void main(){
        mat4 m = modelM();
        vec4 mv = viewMatrix * (m * vec4(position, 1.0));
        vView = mv.xyz;
        float cx = mod(aCell, 4.0); float cy = floor(aCell / 4.0);
        vUv = (vec2(cx, cy) + uv) / vec2(4.0, 8.0);
        vFl = fract(sin(dot(m[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vView; varying vec2 vUv;
      uniform sampler2D uMap; varying float vFl;
      void main(){
        float fl = floor(vFl * 64.0);
        float buzz = step(48.0, fl) * step(0.82, fract(sin(floor(uTime * 14.0) * (fl + 1.0) * 1.37) * 4375.85)); // some tubes are dying
        vec3 c = texture2D(uMap, vUv).rgb * (1.0 + uBeat * 0.3) * (1.0 - 0.75 * buzz);
        gl_FragColor = vec4(applyFog(c, length(vView)), 1.0);
      }`,
  });
}

// ---- flying traffic: instanced light bars that slide along lanes, animated on the GPU
export function trafficMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { ...G },
    vertexShader: /* glsl */ `
      attribute vec3 aA; attribute vec3 aB; attribute vec2 aP; attribute vec3 aCol;
      uniform float uTime;
      varying vec3 vCol; varying vec3 vView;
      void main(){
        float f = fract(aP.x + uTime * aP.y);
        vec3 l = position * vec3(1.3, 0.55, 3.6);
        if (abs(aB.x) > abs(aB.z)) l = l.zyx;
        vec4 mv = modelViewMatrix * vec4(aA + aB * f + l, 1.0);
        vView = mv.xyz; vCol = aCol;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vCol; varying vec3 vView;
      void main(){ gl_FragColor = vec4(applyFog(vCol, length(vView)), 1.0); }`,
  });
}

// ---- rain streaks -----------------------------------------------------------------
export function rainMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uT: { value: 0 }, uVel: { value: new THREE.Vector3(0.6, -26, 15) },
      uBox: { value: new THREE.Vector3(36, 22, 44) }, uAlpha: { value: 0 }, uFlash: G.uFlash,
    },
    vertexShader: /* glsl */ `
      attribute float aEnd;
      uniform float uT; uniform vec3 uVel; uniform vec3 uBox;
      void main(){
        vec3 p = mod(position + uVel * uT, uBox) - uBox * 0.5;
        float nearCam = step(length(p), 2.2);
        p -= normalize(uVel) * aEnd * 1.5;
        gl_Position = mix(projectionMatrix * modelViewMatrix * vec4(p, 1.0), vec4(2.0, 2.0, 2.0, 1.0), nearCam);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform float uFlash;
      void main(){ gl_FragColor = vec4(vec3(0.6, 0.72, 1.0) + uFlash * 0.4, uAlpha); }`,
  });
}
