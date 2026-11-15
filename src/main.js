import * as THREE from 'three';
import { B, BEAT, beatTime, timeBeat, distAt, speedAtBeat } from './timeline.js';
import { buildWorld } from './world.js';
import { buildTrain } from './train.js';
import { createRobots } from './robots.js';
import { createFx } from './fx.js';
import { createGuns } from './guns.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createCars } from './cars.js';

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 3000);
camera.rotation.order = 'YXZ';
camera.position.set(0, 1.7, 0);
scene.add(camera);

const world = buildWorld(scene);
buildTrain(scene);
const robots = createRobots(scene);
const fx = createFx(scene, camera);
const audio = createAudio('assets/black-magic.mp3');
const hud = createHud(scene);
const cars = createCars(scene, audio);

// ---------------------------------------------------------------- game state
const stats = { score: 0, combo: 0, maxCombo: 0, kills: 0, shots: 0, hits: 0, onBeat: 0 };
const mult = () => Math.min(8, 1 + Math.floor(stats.combo / 8));
const LOOP_T = 4 * BEAT;
// The run starts partway into the track, on the bar line at beat 32 (0:17.3). Game time stays song time,
// so every tunnel, spawn and lightning cue keeps its original sync.
const START_T = beatTime(32);
let state = 'menu'; // menu | ready | playing
let idleT = 0, songT = START_T - LOOP_T, t0 = 0, results = null;

const guns = createGuns({ scene, camera, fx, audio, robots, onHit, stats });

function onHit(rb, toward) {
  if (!robots.damage(rb)) { // armour holds: spark, clank, a few points
    fx.spark(rb.pos, toward);
    audio.sfx('clank', 0.32, 0.85 + Math.random() * 0.3);
    stats.score += 10 * mult();
    return;
  }
  const beat = timeBeat(songT);
  const grid = guns.uzi ? 0.5 : 1;
  const errSec = Math.abs(beat / grid - Math.round(beat / grid)) * grid * BEAT;
  const onBeat = errSec < (guns.uzi ? 0.05 : 0.09);
  stats.kills++; stats.combo++; stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
  stats.score += Math.round(rb.pts * mult() * (onBeat ? 1.5 : 1));
  if (onBeat) { stats.onBeat++; hud.onBeat(); fx.word(rb.pos); }
  fx.explode(rb.pos, onBeat, rb.boom);
  audio.sfx('boom', (onBeat ? 0.6 : 0.45) * Math.min(1.4, rb.boom), (0.85 + Math.random() * 0.4) / Math.sqrt(rb.boom));
  if (rb.type === 'brute') guns.pulse(0.8, 90);
}
function onReach(rb) {
  stats.hits++; stats.combo = 0;
  fx.playerHit();
  audio.sfx('hit', 0.7); audio.sfx('boom', 0.4, 0.7);
  guns.pulse(1, 180);
}

function resetRun() {
  Object.assign(stats, { score: 0, combo: 0, maxCombo: 0, kills: 0, shots: 0, hits: 0, onBeat: 0 });
  results = null;
  robots.reset(); fx.reset(); world.reset();
  guns.setUzi(false, true);
  audio.stopSong();
}
function toReady() { resetRun(); state = 'ready'; idleT = 0; }
function toMenu() { resetRun(); state = 'menu'; $('overlay').classList.remove('hidden');  }

function startRun() {
  if (!audio.loaded) return;
  audio.ctx.resume();
  const now = audio.ctx.currentTime;
  const from = parseFloat(params.get('t') || '0');
  if (from > 0) {
    songT = from; t0 = now + 0.1 - from;
    audio.playSong(now + 0.1, from);
    robots.reset(timeBeat(from));
    guns.setUzi(timeBeat(from) >= B.uzi, true);
  } else {
    t0 = now + 0.05 - songT; // the idle loop is just short of START_T; the song picks up exactly there
    audio.playSong(t0 + START_T, START_T);
  }
  state = 'playing';
}

// ---------------------------------------------------------------- input
function trigger(i, down) {
  if (!down) { guns.release(i); return; }
  if (state === 'ready') { startRun(); return; }
  if (state !== 'playing') return;
  const beat = timeBeat(songT);
  if (beat > B.score + 8) { toReady(); return; }
  guns.press(i, beat < B.finale + 2, beat, performance.now() / 1000);
}

const controllers = [0, 1].map((i) => {
  const c = renderer.xr.getController(i);
  c.addEventListener('selectstart', () => trigger(i, true));
  c.addEventListener('selectend', () => trigger(i, false));
  c.addEventListener('connected', (e) => { c.userData.src = e.data; guns.setSource(i, e.data); });
  c.addEventListener('disconnected', () => { c.userData.src = null; guns.setSource(i, null); guns.release(i); });
  scene.add(c);
  return c;
});

renderer.xr.addEventListener('sessionstart', () => { guns.attachXR(controllers);  });
renderer.xr.addEventListener('sessionend', () => {
  guns.attachDesktop();
  camera.position.set(0, 1.7, 0); camera.rotation.set(0, 0, 0);
  toMenu();
});

// The game is VR-only. Mouse look/click exists solely for the ?auto dev shortcut (testing without a headset).
let yaw = 0, pitch = 0, alt = 0;
const canvas = renderer.domElement;
const devMode = params.has('auto');
if (devMode) canvas.addEventListener('mousedown', (e) => {
  if (renderer.xr.isPresenting || state === 'menu') return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
  if (state === 'playing' && guns.uzi) { trigger(0, true); trigger(1, true); }
  else { alt = 1 - alt; trigger(alt, true); guns.release(alt); }
  e.preventDefault();
});
if (devMode) window.addEventListener('mouseup', () => { guns.release(0); guns.release(1); });
if (devMode) window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  yaw -= e.movementX * 0.0022; pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * 0.0022));
});
window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return;
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- menu
const vrBtn = $('btn-vr'), statusEl = $('status');
function enterGame() {
  audio.ctx.resume();
  $('overlay').classList.add('hidden');
  toReady();
}
let vrReady = false;
function noVR() {
  vrBtn.textContent = 'VR HEADSET REQUIRED';
  statusEl.textContent = 'Gun Run is VR only. Open this page in the Meta Quest browser.';
}
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
    if (ok) { vrBtn.disabled = false; vrReady = true; } else noVR();
  }).catch(noVR);
} else {
  window.isSecureContext ? noVR() : (vrBtn.textContent = 'VR NEEDS HTTPS');
}
vrBtn.addEventListener('click', async () => {
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    enterGame();
  } catch (err) { statusEl.textContent = 'Could not start VR: ' + err.message; }
});
audio.ready.then(() => { if (statusEl.textContent === 'Loading track…') statusEl.textContent = ''; }).catch((e) => { statusEl.textContent = 'Failed to load the track: ' + e.message; });

// ---------------------------------------------------------------- frame loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3();
const bot = params.has('bot');
let wasUzi = false;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());

  if (state === 'playing') {
    songT += dt;
    if (audio.ctx.state === 'running') {
      const err = audio.ctx.currentTime - t0 - audio.latency() - songT;
      if (Math.abs(err) > 0.12) songT += err; else songT += err * 0.08; // glide to the audio clock, no stutter
    }
  } else {
    idleT += dt;
    songT = START_T - LOOP_T + (idleT % LOOP_T);
  }
  const realBeat = timeBeat(songT);
  // after the song, the bright tunnel loops forever behind the score card
  let t = songT;
  const tA = beatTime(B.loopA), tB = beatTime(B.loopB);
  if (t > tB) t = tA + ((t - tA) % (tB - tA));
  const beat = timeBeat(t);
  const playing = state === 'playing';

  if (!renderer.xr.isPresenting) camera.rotation.set(pitch, yaw, 0);
  camera.updateMatrixWorld();
  if (renderer.xr.isPresenting) renderer.xr.getCamera().getWorldPosition(camPos); else camera.getWorldPosition(camPos);
  if (camPos.lengthSq() === 0) camPos.set(0, 1.7, 0);

  world.update(dt, t, beat, distAt(t), camPos, playing);
  cars.update(dt, t, distAt(t), playing);

  if (playing) {
    const uzi = realBeat >= B.uzi;
    if (uzi !== wasUzi) guns.setUzi(uzi);
    wasUzi = uzi;
    robots.update(dt, realBeat, songT, camPos, onReach);
    if (bot) runBot(realBeat);
    if (realBeat >= B.score && !results) {
      const frac = stats.kills / Math.max(1, robots.total);
      results = {
        score: stats.score, kills: stats.kills, total: robots.total, onBeat: stats.onBeat, maxCombo: stats.maxCombo, hits: stats.hits,
        acc: stats.shots ? Math.round((100 * stats.kills) / stats.shots) : 0,
        rank: frac >= 0.95 ? 'S' : frac >= 0.85 ? 'A' : frac >= 0.7 ? 'B' : frac >= 0.5 ? 'C' : 'D',
      };
    }
  } else { wasUzi = false; }
  guns.update(dt, realBeat, playing && realBeat < B.finale + 2);
  fx.update(dt, speedAtBeat(beat));

  // info card
  let kind = null;
  if (state === 'ready') kind = audio.loaded ? 'ready' : 'loading';
  else if (playing) {
    if (results) kind = 'results';
    else if (realBeat < B.robots - 2) kind = 'intro';
    else if (realBeat >= B.uzi && realBeat < B.drop3 - 2) kind = 'uzi';
  }
  hud.showInfo(kind, results);
  hud.setScoreVisible(state !== 'menu');
  hud.setScore(stats.score, mult(), stats.combo, dt);
  hud.update(dt);

  renderer.render(scene, camera);
}

// dev helper (?bot): auto-aims and shoots so the whole run can be watched hands-free
const botV = new THREE.Vector3();
let botCool = 0;
function runBot(beat) {
  let target = null;
  for (const rb of robots.active) if (rb.state === 1 && rb.u > 0.4 && (!target || rb.arr < target.arr)) target = rb;
  if (!target) { guns.release(0); guns.release(1); return; }
  botV.subVectors(target.pos, camPos).normalize();
  yaw = Math.atan2(-botV.x, -botV.z); pitch = Math.asin(botV.y);
  camera.rotation.set(pitch, yaw, 0); camera.updateMatrixWorld();
  botCool -= 1;
  if (guns.uzi) { if (!guns.guns[0].held) { trigger(0, true); trigger(1, true); } }
  else if (botCool <= 0) { botCool = 8; alt = 1 - alt; trigger(alt, true); guns.release(alt); }
}

renderer.setAnimationLoop(frame);

if (params.has('auto')) { $('overlay').classList.add('hidden'); toReady(); audio.ready.then(startRun); }
window.__game = { cars, fx, look(y, p) { yaw = y; pitch = p; }, scene, world, camera, stats, robots, guns, audio, get songT() { return songT; }, get state() { return state; }, set songT(v) { songT = v; t0 = audio.ctx.currentTime - v; } };
