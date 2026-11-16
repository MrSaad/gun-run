import * as THREE from 'three';

const FONT = '"Arial Black", Impact, "Helvetica Neue", sans-serif';

function panel(w, h, pw, ph) {
  const cv = document.createElement('canvas'); cv.width = pw; cv.height = ph;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
  mesh.renderOrder = 30;
  return { mesh, g, tex, pw, ph };
}
// Comic-style outlined text. Shrinks to fit maxW, since fonts render at different widths per device.
function comic(g, text, x, y, size, fill, stroke = '#000', lw = 0.16, align = 'center', maxW = 0) {
  g.save();
  g.font = `italic 900 ${size}px ${FONT}`;
  const limit = maxW || (align === 'center' ? Math.min(2 * x, 2 * (g.canvas.width - x)) * 0.86 : g.canvas.width * 0.86);
  const w = g.measureText(text).width + size * lw;
  if (w > limit) { size *= limit / w; g.font = `italic 900 ${size}px ${FONT}`; }
  g.textAlign = align; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.strokeStyle = stroke; g.lineWidth = size * lw; g.strokeText(text, x, y);
  g.fillStyle = fill; g.fillText(text, x, y);
  g.restore();
}
function plate(g, w, h, border) {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(6,6,16,0.82)';
  g.beginPath(); g.moveTo(30, 8); g.lineTo(w - 8, 8); g.lineTo(w - 30, h - 8); g.lineTo(8, h - 8); g.closePath(); g.fill();
  g.strokeStyle = border; g.lineWidth = 8; g.stroke();
}

export function createHud(scene) {
  // score strip, low on the roof ahead of the player
  const score = panel(1.7, 0.425, 768, 192);
  score.mesh.position.set(0, 0.5, -3.3); score.mesh.rotation.x = -0.45;
  scene.add(score.mesh);
  // big info card
  const info = panel(3.4, 1.7, 1024, 512);
  info.mesh.position.set(0, 2.0, -5.2);
  info.mesh.material.opacity = 0;
  scene.add(info.mesh);

  let lastKey = '', infoKind = '', infoTarget = 0, beatFlash = 0;

  function setScore(s, mult, combo, dt) {
    beatFlash = Math.max(0, beatFlash - dt);
    const key = `${s}|${mult}|${combo}|${beatFlash > 0 ? 1 : 0}`;
    if (key === lastKey) return;
    lastKey = key;
    const g = score.g;
    plate(g, 768, 192, beatFlash > 0 ? '#ffc24a' : '#4ea0ff');
    comic(g, String(s).padStart(6, '0'), 300, 100, 104, '#ffffff');
    comic(g, 'x' + mult, 640, 86, 96, mult >= 6 ? '#ff8a2a' : mult >= 3 ? '#ffb020' : '#4ea0ff');
    comic(g, beatFlash > 0 ? 'ON BEAT!' : combo + ' COMBO', 640, 152, 30, beatFlash > 0 ? '#ffc24a' : '#9fb0c8', '#000', 0.2);
    score.tex.needsUpdate = true;
  }
  function onBeat() { beatFlash = 0.35; }

  function showInfo(kind, data) {
    infoTarget = kind ? 1 : 0;
    if (!kind || kind === infoKind) return;
    infoKind = kind;
    const g = info.g;
    plate(g, 1024, 512, kind === 'results' ? '#ffc24a' : kind === 'uzi' ? '#ff8a2a' : '#4ea0ff');
    if (kind === 'loading') {
      comic(g, 'GUN RUN', 512, 190, 150, '#ffc24a');
      comic(g, 'LOADING TRACK…', 512, 350, 52, '#ffffff');
    } else if (kind === 'ready') {
      comic(g, 'GUN RUN', 512, 130, 150, '#ffc24a');
      comic(g, 'PULL THE TRIGGER TO START', 512, 262, 54, '#ffffff');
      comic(g, 'Shoot the drones before they reach you', 512, 350, 36, '#4ea0ff', '#000', 0.2);
      comic(g, 'Kill on the beat for bonus points', 512, 404, 36, '#ff8a2a', '#000', 0.2);
    } else if (kind === 'intro') {
      comic(g, 'DRONES INBOUND', 512, 165, 104, '#e8452e');
      comic(g, 'Kill on the beat for bonus points', 512, 300, 46, '#ffc24a', '#000', 0.2);
      comic(g, 'Don\'t let them touch you — it breaks your combo', 512, 378, 36, '#4ea0ff', '#000', 0.2);
    } else if (kind === 'uzi') {
      comic(g, 'GUNS UPGRADED', 512, 200, 124, '#ff8a2a');
      comic(g, 'Hold down trigger for full auto fire.', 512, 350, 52, '#ffffff', '#000', 0.2);
    } else if (kind === 'results') {
      comic(g, 'RUN COMPLETE', 512, 76, 74, '#ffc24a');
      comic(g, String(data.score).padStart(6, '0'), 400, 210, 150, '#ffffff');
      comic(g, data.rank, 850, 210, 230, data.rank === 'S' ? '#ff8a2a' : '#4ea0ff');
      comic(g, `DRONES ${data.kills}/${data.total}   ON BEAT ${data.onBeat}`, 512, 340, 40, '#4ea0ff', '#000', 0.2);
      comic(g, `MAX COMBO ${data.maxCombo}   ACCURACY ${data.acc}%   HITS TAKEN ${data.hits}`, 512, 396, 34, '#ffffff', '#000', 0.2);
      comic(g, 'pull the trigger to ride again', 512, 458, 30, '#9fb0c8', '#000', 0.2);
    }
    info.tex.needsUpdate = true;
  }
  function update(dt) {
    const m = info.mesh.material;
    m.opacity += (infoTarget - m.opacity) * Math.min(1, dt * 6);
    info.mesh.visible = m.opacity > 0.01;
    if (!info.mesh.visible && infoTarget === 0) infoKind = '';
  }
  function setScoreVisible(v) { score.mesh.visible = v; }
  return { setScore, onBeat, showInfo, update, setScoreVisible };
}
