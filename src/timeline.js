// Song map for "Black Magic" (114 BPM). Everything in the level is keyed off beats.
export const BPM = 114;
export const BEAT = 60 / BPM;
export const OFFSET = 0.456; // time of beat 0 in the audio file

export const beatTime = (k) => OFFSET + k * BEAT;
export const timeBeat = (t) => (t - OFFSET) / BEAT;

// Section boundaries, in beats (measured from the track).
export const B = {
  robots: 48,    // 0:25.7  drones start
  drop1: 112,    // 0:59.4  tunnel 1 -> city
  tunnel2: 176,  // 1:33.1
  drop2: 208,    // 1:49.9  city, 2x speed, lightning
  break1: 269,   // 2:22.0  one-bar dropout, slams back at 271
  tunnel3: 304,  // 2:40.5  no spawns
  uzi: 324,      // guns swap mid-tunnel
  drop3: 336,    // 2:57.3  city, 4x speed, rain, uzis
  break2: 365,   // 3:12.6  dropout, back at 367
  finale: 400,   // 3:31.0  bright tunnel
  score: 404,
  loopA: 420,    // after the song the final tunnel loops between these beats
  loopB: 424,
};

export const V1 = 30; // base train speed, m/s

const ramp = (b, b0, b1, v0, v1) => {
  const u = Math.min(1, Math.max(0, (b - b0) / (b1 - b0)));
  const e = u * u * (3 - 2 * u);
  return v0 + (v1 - v0) * e;
};

export function speedAtBeat(b) {
  if (b < 207) return V1;
  if (b < 208) return ramp(b, 207, 208, V1, 2 * V1);
  if (b < B.break1) return 2 * V1;
  if (b < 269.75) return ramp(b, 269, 269.75, 2 * V1, 0.4 * V1);
  if (b < 270.8) return 0.4 * V1;
  if (b < 271) return ramp(b, 270.8, 271, 0.4 * V1, 2 * V1);
  if (b < 335) return 2 * V1;
  if (b < 336) return ramp(b, 335, 336, 2 * V1, 4 * V1);
  if (b < B.break2) return 4 * V1;
  if (b < 365.75) return ramp(b, 365, 365.75, 4 * V1, 0.8 * V1);
  if (b < 366.8) return 0.8 * V1;
  if (b < 367) return ramp(b, 366.8, 367, 0.8 * V1, 4 * V1);
  if (b < B.finale) return 4 * V1;
  if (b < 408) return ramp(b, B.finale, 408, 4 * V1, 25);
  return 25;
}

// Distance travelled along the track as a function of song time (precomputed integral).
const DT = 0.005;
const T_MAX = 260;
const N = Math.ceil(T_MAX / DT) + 1;
const table = new Float64Array(N);
for (let i = 1; i < N; i++) {
  const tm = (i - 0.5) * DT;
  table[i] = table[i - 1] + speedAtBeat(timeBeat(tm)) * DT;
}

export function distAt(t) {
  if (t <= 0) return V1 * t;
  const f = t / DT;
  const i = Math.floor(f);
  if (i >= N - 1) return table[N - 1] + 25 * (t - T_MAX);
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}

// Track position of the thing that should pass the player exactly on beat k.
export const S = (k) => distAt(beatTime(k));

export const TUNNELS = [
  { a: -600, b: S(B.drop1), kind: 0 },
  { a: S(B.tunnel2), b: S(B.drop2), kind: 1 },
  { a: S(B.tunnel3), b: S(B.drop3), kind: 2 },
  { a: S(B.finale), b: S(B.finale) + 1600, kind: 3 },
];
export const CITIES = [
  { a: S(B.drop1), b: S(B.tunnel2), k0: B.drop1, k1: B.tunnel2, step: 1 },
  { a: S(B.drop2), b: S(B.tunnel3), k0: B.drop2, k1: B.tunnel3, step: 1 },
  { a: S(B.drop3), b: S(B.finale), k0: B.drop3, k1: B.finale, step: 0.5 },
];
export const TRACK_A = -600;
export const TRACK_B = S(B.finale) + 1600;

export function inTunnelBeat(b) {
  return b < B.drop1 || (b >= B.tunnel2 && b < B.drop2) || (b >= B.tunnel3 && b < B.drop3) || b >= B.finale;
}

// Small deterministic RNG so the level is identical every run.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
