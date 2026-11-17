// EMBERFALL — entry point: game loop (fixed timestep), wiring, state.
// Loads as an ES module from index.html. No network, no libraries.

import { Game } from './world.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Particles } from './particles.js';
import { render } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const input = new Input(canvas);
const audio = new AudioSys();
const fx = new Particles();
const game = new Game(input, audio, fx);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.resize(canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

// Audio may only start after a user gesture (browser autoplay rule).
window.addEventListener('pointerdown', () => audio.ensure());
window.addEventListener('keydown', () => audio.ensure());

// ---- deterministic screenshot mode: ?shot=<scene>&seed=<n> ----
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = parseInt(params.get('seed') || '1337', 10);
  applyShot(game, shot, Number.isFinite(seed) ? seed : 1337);
  render(ctx, game);
  window.__shotReady = true;
} else {
  // ---- normal play: fixed-timestep loop at 60 Hz ----
  const STEP = 1 / 60;
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // tab was in the background: don't spiral
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      game.update(STEP);
      acc -= STEP;
      steps++;
    }
    render(ctx, game);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}
