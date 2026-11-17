// EMBERFALL — enemy types, spawning, and AI.
// Enemies are plain objects; the world owns the arrays. AI runs in
// updateEnemy(e, dt, player, rng, fireEnemyBullet).

import { CONFIG } from './config.js';
import { clamp, dist } from './random.js';

export const ENEMY_TYPES = ['cinder', 'spark', 'brute', 'darter'];

// Create one enemy of `type` at (x, y) for wave `wave` (1-based).
// Stats scale mildly with wave number so later waves feel tougher.
export function createEnemy(type, x, y, wave) {
  const def = CONFIG.enemies[type];
  const w = Math.max(1, wave || 1);
  const hp = Math.round(def.hp * (1 + def.hpScale * (w - 1)));
  const speed = def.speed * (1 + def.speedScale * (w - 1));
  return {
    type,
    name: def.name,
    x, y,
    vx: 0, vy: 0,
    angle: 0,
    hp, maxHp: hp,
    speed,
    radius: def.radius,
    damage: def.damage,
    score: def.score,
    color: def.color,
    core: def.core,
    flash: 0, // hit-flash timer (drawn white while > 0)
    contactCd: 0, // cooldown between contact-damage hits on the player
    spawnT: CONFIG.portalTime, // materializing: cannot move / be hit yet
    wobbleSeed: Math.random() * Math.PI * 2,
    // Spark (spitter)
    shootTimer: 1.2 + Math.random() * 1.2,
    // Darter (lunger) state machine
    state: 'approach',
    stateT: 0,
    dead: false,
  };
}

// Pick a spawn point on the arena edge, away from the player.
export function pickSpawnPoint(w, h, player, rng) {
  const m = CONFIG.arenaMargin + 10;
  for (let attempt = 0; attempt < 8; attempt++) {
    const edge = rng.int(0, 3);
    let x, y;
    if (edge === 0) { x = rng.range(m, w - m); y = m; }
    else if (edge === 1) { x = rng.range(m, w - m); y = h - m; }
    else if (edge === 2) { x = m; y = rng.range(m, h - m); }
    else { x = w - m; y = rng.range(m, h - m); }
    if (dist(x, y, player.x, player.y) > 280) return { x, y };
  }
  // Fallback: far corner from the player.
  return {
    x: player.x < w / 2 ? w - m : m,
    y: player.y < h / 2 ? h - m : m,
  };
}

// Per-frame AI. `time` is the global animation clock (for wobble).
// fireEnemyBullet(x, y, vx, vy, damage) is called by spitters.
export function updateEnemy(e, dt, player, rng, time, fireEnemyBullet) {
  if (e.flash > 0) e.flash -= dt;
  if (e.contactCd > 0) e.contactCd -= dt;
  if (e.spawnT > 0) {
    e.spawnT -= dt;
    return; // still materializing inside its spawn portal
  }

  const dx = player.x - e.x;
  const dy = player.y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  e.angle = Math.atan2(dy, dx);

  if (e.type === 'cinder') {
    // Slow chase with a drifting wobble.
    const wob = Math.sin(time * 2.5 + e.wobbleSeed) * 0.45;
    const px = -ny * wob;
    const py = nx * wob;
    e.x += (nx + px) * e.speed * dt;
    e.y += (ny + py) * e.speed * dt;
  } else if (e.type === 'spark') {
    // Keeps its distance: approaches when far, backs off when close,
    // strafes sideways, and fires projectiles at the player.
    if (d > 320) {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    } else if (d < 210) {
      e.x -= nx * e.speed * 0.8 * dt;
      e.y -= ny * e.speed * 0.8 * dt;
    } else {
      const dir = Math.sin(e.wobbleSeed) > 0 ? 1 : -1;
      e.x += -ny * dir * e.speed * 0.55 * dt;
      e.y += nx * dir * e.speed * 0.55 * dt;
    }
    e.shootTimer -= dt;
    const def = CONFIG.enemies.spark;
    if (e.shootTimer <= 0 && d < def.shootRange) {
      const bs = def.bulletSpeed;
      fireEnemyBullet(e.x, e.y, nx * bs, ny * bs, def.bulletDamage);
      e.shootTimer = def.shootInterval * (0.9 + rng.next() * 0.25);
    }
  } else if (e.type === 'brute') {
    // Slow, heavy, relentless chase.
    e.x += nx * e.speed * dt;
    e.y += ny * e.speed * dt;
  } else if (e.type === 'darter') {
    // Fast lunger: approach, telegraph (windup), lunge, recover.
    const def = CONFIG.enemies.darter;
    if (e.state === 'approach') {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
      if (d < def.lungeRange) {
        e.state = 'windup';
        e.stateT = def.windupTime;
      }
    } else if (e.state === 'windup') {
      e.stateT -= dt;
      // Tremble in place as a telegraph.
      e.x += (rng.next() - 0.5) * 2;
      e.y += (rng.next() - 0.5) * 2;
      if (e.stateT <= 0) {
        e.state = 'lunge';
        e.stateT = def.lungeTime;
        e.vx = nx * def.lungeSpeed;
        e.vy = ny * def.lungeSpeed;
      }
    } else if (e.state === 'lunge') {
      e.stateT -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.stateT <= 0) {
        e.state = 'recover';
        e.stateT = def.recoverTime;
      }
    } else { // recover
      e.stateT -= dt;
      e.x += nx * e.speed * 0.25 * dt;
      e.y += ny * e.speed * 0.25 * dt;
      if (e.stateT <= 0) e.state = 'approach';
    }
  }

  // Keep inside the arena.
  const m = CONFIG.arenaMargin;
  e.x = clamp(e.x, m, 20000); // clamped properly by the world (knows w/h)
  e.y = clamp(e.y, m, 20000);
}
