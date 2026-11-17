// EMBERFALL — deterministic screenshot scenes.
// ?shot=<scene>&seed=<n> renders one fixed scene through the normal
// render path (no wall clock, no user input) and the caller sets
// window.__shotReady once it is drawn.

export const SHOT_SCENES = ['title', 'play', 'victory', 'gameover'];

// Build the fixed world state for `scene` and return the game.
export function applyShot(game, scene, seed) {
  const name = SHOT_SCENES.includes(scene) ? scene : 'title';
  const n = Number.isFinite(seed) ? seed : 1337;
  game.setupShot(name, n);
  return game;
}
