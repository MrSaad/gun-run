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
};

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
vec3 applyFog(vec3 c, float dist){
  return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist));
}
`;

const VERT_HEAD = /* glsl */ `
varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying vec3 vPos;
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
  defines.BEATGLOW = (o.beatGlow ?? 0.35).toFixed(3);
  return new THREE.ShaderMaterial({
    defines,
    uniforms: { ...G, uColor: { value: hex(o.color ?? 0xffffff) } },
    vertexColors: !!o.vertexColors,
    side: o.hull ? THREE.BackSide : (o.side ?? THREE.FrontSide),
    vertexShader: VERT_HEAD + /* glsl */ `
      uniform vec3 uColor;
      #ifdef HAS_GLOW
        attribute float glow;
      #endif
      varying vec3 vCol; varying float vGlow; varying vec3 vTint;
      void main(){
        mat4 m = modelM();
        vec3 p = position;
        #ifdef HULL
          p += normalize(normal) * HULL;
        #endif
        vec4 mv = viewMatrix * (m * vec4(p, 1.0));
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
      void main(){
        float dist = length(vView);
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
          float band = toonBand(normalize(vN));
          #ifdef UNLIT
            vec3 c = base * (band > 0.9 ? 1.0 : (band > 0.4 ? 0.93 : 0.8));
          #else
            vec3 c = toonLit(base, band);
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
    uniforms: { ...G },
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
      vec3 pal(float h){
        return h < 0.4 ? vec3(1.0, 0.72, 0.3) : (h < 0.72 ? vec3(0.25, 0.9, 1.0) : vec3(1.0, 0.25, 0.75));
      }
      void main(){
        float dist = length(vView);
        vec3 n = normalize(vN);
        float band = toonBand(n);
        vec3 c = toonLit(vTint, band);
        float wall = abs(n.y) > 0.5 ? 0.0 : 1.0;
        vec2 wc = abs(n.x) > 0.5 ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
        vec2 q = wc / vec2(4.0, 3.6);
        vec2 cell = floor(q); vec2 f = fract(q);
        float sid = floor(vSeed * 255.0 + 0.5);
        float seed = sid / 255.0;
        float h = hash21(cell + vec2(sid * 7.0, sid * 13.0));
        float lit = step(0.6, h);
        float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.25, f.y) * step(f.y, 0.8);
        float fw = max(fwidth(q.x), fwidth(q.y));
        float detail = 1.0 - smoothstep(0.2, 0.6, fw);
        vec3 wcol = pal(fract(seed * 3.7 + step(0.9, h) * 0.37)) * (0.55 + 0.45 * fract(h * 17.0));
        c = mix(c, wcol, win * lit * wall * detail);
        c += wcol * 0.13 * (1.0 - detail) * wall;
        // neon trim along some rooftops
        float trim = step(vTop - 1.6, vLocal.y) * step(0.5, fract(seed * 7.3)) * wall;
        c = mix(c, pal(fract(seed * 5.1)) * (1.0 + uBeat * 0.4), trim);
        c = mix(c, INKCOL, inkEdge(vUv, dist) * 0.9);
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- tunnel shell ---------------------------------------------------------------
export function tunnelMaterial({ period, colA, colB, wall, self = 0 }) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      ...G,
      uPeriod: { value: period }, uColA: { value: hex(colA) }, uColB: { value: hex(colB) },
      uWall: { value: hex(wall) }, uSelf: { value: self },
    },
    vertexShader: VERT_HEAD + /* glsl */ `
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz; vN = mat3(modelMatrix) * normal; vPos = position; vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vN; varying vec3 vView; varying vec3 vPos;
      uniform float uPeriod; uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uWall; uniform float uSelf;
      void main(){
        float dist = length(vView);
        vec3 n = normalize(vN);
        float s = -vPos.z;
        float q = s / uPeriod;
        float fq = fract(q);
        vec3 base = uWall * (mod(floor(q), 2.0) < 0.5 ? 1.0 : 0.82);
        float band = toonBand(n);
        vec3 c = mix(toonLit(base, band), base, uSelf);
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
        c = mix(c, uColA * glowK, sA);
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
    uniforms: { ...G },
    vertexShader: VERT_HEAD + /* glsl */ `
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = mv.xyz; vPos = position; vN = vec3(0.0, 1.0, 0.0); vUv = uv;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vView; varying vec3 vPos;
      void main(){
        float dist = length(vView);
        float ax = abs(vPos.x);
        vec3 base = vec3(0.14, 0.14, 0.18);
        float sl = step(ax, 1.35) * step(fract(-vPos.z / 0.9), 0.4) * (1.0 - smoothstep(40.0, 110.0, dist));
        base = mix(base, vec3(0.26, 0.23, 0.22), sl);
        float rail = step(0.68, ax) * step(ax, 0.82);
        base = mix(base, vec3(0.62, 0.66, 0.74), rail);
        vec3 c = toonLit(base, 1.0);
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
        vec3 c = mix(vec3(0.03, 0.03, 0.07), vec3(0.75, 0.42, 0.12) * (0.5 + 0.5 * dash), road);
        c += vec3(0.1, 0.12, 0.2) * uFlash;
        gl_FragColor = vec4(applyFog(c, dist), 1.0);
      }`,
  });
}

// ---- sky dome -------------------------------------------------------------------
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { ...G },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 uFogColor; uniform float uFlash; uniform float uStorm;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        float t = pow(1.0 - h, 5.0);
        t = floor(t * 7.0 + 0.5) / 7.0;                 // banded, comic-style gradient
        vec3 top = mix(vec3(0.02, 0.015, 0.07), vec3(0.015, 0.015, 0.035), uStorm);
        vec3 hor = mix(vec3(0.36, 0.09, 0.4), vec3(0.16, 0.1, 0.34), uStorm);
        vec3 c = mix(top, hor, t);
        float m = dot(d, normalize(vec3(-0.3, 0.33, -0.9)));
        float moon = step(0.9982, m);
        float halo = step(0.993, m) * 0.07 + step(0.985, m) * 0.04;
        c += (vec3(0.95, 0.9, 1.0) * moon + vec3(0.6, 0.5, 0.9) * halo) * (1.0 - uStorm * 0.85);
        c = mix(c, uFogColor, smoothstep(0.1, 0.0, d.y));
        c += uFlash * vec3(0.22, 0.26, 0.45) * (0.35 + t);
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
      attribute float aCell;
      void main(){
        mat4 m = modelM();
        vec4 mv = viewMatrix * (m * vec4(position, 1.0));
        vView = mv.xyz;
        float cx = mod(aCell, 4.0); float cy = floor(aCell / 4.0);
        vUv = (vec2(cx, cy) + uv) / vec2(4.0, 8.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: FRAG_COMMON + /* glsl */ `
      varying vec3 vView; varying vec2 vUv;
      uniform sampler2D uMap;
      void main(){
        vec3 c = texture2D(uMap, vUv).rgb * (1.0 + uBeat * 0.3);
        gl_FragColor = vec4(applyFog(c, length(vView)), 1.0);
      }`,
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
        p -= normalize(uVel) * aEnd * 1.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; uniform float uFlash;
      void main(){ gl_FragColor = vec4(vec3(0.6, 0.72, 1.0) + uFlash * 0.4, uAlpha); }`,
  });
}
