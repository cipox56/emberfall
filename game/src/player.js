// EMBERFALL — the player: movement, dash, aim, weapons, damage.
// The player is a plain object; the world owns it and the bullet array.

import { CONFIG } from './config.js';
import { clamp } from './random.js';

export function createPlayer(x, y) {
  const p = CONFIG.player;
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    radius: p.radius,
    hp: p.maxHp,
    maxHp: p.maxHp,
    speed: p.speed,
    damage: p.bulletDamage,
    fireInterval: p.fireInterval,
    fireTimer: 0,
    bulletSpeed: p.bulletSpeed,
    bulletRadius: p.bulletRadius,
    multishot: p.multishot,
    pierce: p.pierce,
    magnetRadius: p.magnetRadius,
    thorns: p.thorns,
    dashCooldown: p.dashCooldown,
    dashCdTimer: 0,
    dashTimer: 0,
    dashDirX: 0, dashDirY: -1,
    invulnTimer: 0,
    spreadTimer: 0, // 5-way fire while > 0
    shieldTimer: 0, // absorbs all damage while > 0
    dead: false,
  };
}

// Movement + dash + timers. Called every fixed step while playing.
export function updatePlayer(p, dt, input, w, h, audio) {
  if (p.fireTimer > 0) p.fireTimer -= dt;
  if (p.dashCdTimer > 0) p.dashCdTimer -= dt;
  if (p.invulnTimer > 0) p.invulnTimer -= dt;
  if (p.spreadTimer > 0) p.spreadTimer -= dt;
  if (p.shieldTimer > 0) p.shieldTimer -= dt;

  // Aim at the mouse.
  p.angle = Math.atan2(input.mouseY - p.y, input.mouseX - p.x);

  // Movement input (WASD or arrows).
  let mx = 0;
  let my = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) my -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) my += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
  const len = Math.sqrt(mx * mx + my * my) || 1;
  mx /= len;
  my /= len;

  // Dash: Space or Shift, ~2.5s cooldown, brief invulnerability.
  const dashPressed = input.wasPressed('Space') || input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight');
  if (dashPressed && p.dashCdTimer <= 0 && p.dashTimer <= 0) {
    // Dash along movement input, or along aim if standing still.
    if (mx === 0 && my === 0) {
      p.dashDirX = Math.cos(p.angle);
      p.dashDirY = Math.sin(p.angle);
    } else {
      p.dashDirX = mx;
      p.dashDirY = my;
    }
    p.dashTimer = CONFIG.player.dashTime;
    p.dashCdTimer = p.dashCooldown;
    p.invulnTimer = Math.max(p.invulnTimer, CONFIG.player.dashTime + 0.12);
    if (audio) audio.dash();
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashDirX * CONFIG.player.dashSpeed * dt;
    p.y += p.dashDirY * CONFIG.player.dashSpeed * dt;
  } else {
    p.x += mx * p.speed * dt;
    p.y += my * p.speed * dt;
  }

  const m = CONFIG.arenaMargin + p.radius;
  p.x = clamp(p.x, m, w - m);
  p.y = clamp(p.y, m, h - m);
}

// Fire while the mouse button is held. Creates bullets in `bullets`.
export function tryFire(p, dt, input, bullets, fx, audio) {
  if (!input.mouseDown) return;
  if (p.fireTimer > 0) return;
  p.fireTimer = p.fireInterval;

  const count = p.spreadTimer > 0 ? 5 : 1 + p.multishot;
  const gap = 0.13; // radians between projectiles
  const start = p.angle - (gap * (count - 1)) / 2;
  for (let i = 0; i < count; i++) {
    const a = start + gap * i;
    bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 6),
      y: p.y + Math.sin(p.angle) * (p.radius + 6),
      vx: Math.cos(a) * p.bulletSpeed,
      vy: Math.sin(a) * p.bulletSpeed,
      damage: p.damage,
      pierce: p.pierce,
      radius: p.bulletRadius,
      life: CONFIG.player.bulletLife,
    });
  }
  fx.muzzle(p.x + Math.cos(p.angle) * (p.radius + 8), p.y + Math.sin(p.angle) * (p.radius + 8), p.angle);
  if (audio) audio.shoot();
}

// Apply damage to the player. Returns true if the player just died.
// Shield absorbs everything; dash / post-hit invulnerability blocks it.
export function damagePlayer(p, amount, fx, audio, game) {
  if (p.dead) return false;
  if (p.invulnTimer > 0 || p.dashTimer > 0) return false;
  if (p.shieldTimer > 0) {
    fx.addText(p.x, p.y - 26, 'BLOCKED', '#37e0d8');
    return false;
  }
  p.hp -= amount;
  p.invulnTimer = CONFIG.player.invulnTime;
  if (game) game.hurtT = 0.4; // red damage vignette
  fx.shake(0.55);
  fx.burst(p.x, p.y, '#e2483d', 14, 220, 0.5, 3);
  if (audio) audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    return true;
  }
  return false;
}
