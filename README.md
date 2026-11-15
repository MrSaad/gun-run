# Gun Run

A music-synced VR shooter for the Quest browser, built with three.js and WebXR.
You ride the roof of a train through neon tunnels and a cyberpunk city, shooting
flying drones to the beat of *Black Magic* (114 BPM).

## Play

It is a static site: no build step, three.js is vendored in `vendor/`.

- **Quest:** WebXR needs HTTPS. Serve this folder from GitHub Pages
  (Settings → Pages → deploy from branch, root folder), open the URL in the
  Quest browser and press **ENTER VR**.
- **Local testing:** run a local server; the page still needs a WebXR headset to play.

```bash
python3 -m http.server 8000
```

## How the level is built

Everything is keyed to beats (`src/timeline.js`). Scenery that should pass you
on a beat is placed at the distance the train has covered by that beat, so
tunnel rings, gantries and signs stay locked to the music at any train speed.

| Time | Beat | What happens |
|---|---|---|
| 0:00 | 0 | Tunnel 1, train only |
| 0:25 | 48 | Drones start, 57 per minute |
| 0:59 | 112 | Drop: out into the city |
| 1:33 | 176 | Tunnel 2 |
| 1:50 | 208 | City, 2× speed, lightning, 114 drones per minute |
| 2:22 | 269 | One-bar dropout: train brakes, then a giant strike |
| 2:40 | 304 | Tunnel 3, no spawns, pistols become uzis |
| 2:57 | 336 | City, 4× speed, rain, 228 drones per minute |
| 3:31 | 400 | Bright final tunnel, score card |

## Code map

- `index.html` – tutorial / start page
- `src/main.js` – game loop, state, input (WebXR controllers and mouse)
- `src/timeline.js` – BPM, section beats, train speed and distance
- `src/world.js` – tunnels, procedural city, signs, lightning, rain
- `src/materials.js` – cel-shading shaders
- `src/robots.js`, `src/guns.js`, `src/fx.js` – drones, weapons, explosions
- `src/audio.js`, `src/hud.js` – music, synthesised sound effects, score panels

## Dev shortcuts

The game is VR-only. For testing without a headset, add to the URL:
`?auto` skips the start page and plays with mouse controls, `?t=110` starts
the song at 110 seconds, `?bot` auto-aims and fires.
