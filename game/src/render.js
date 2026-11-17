// EMBERFALL — all drawing: background, arena, entities, HUD, screens.
// Pure rendering: reads game state, never mutates gameplay (except
// writing the clickable rects the world hit-tests against).

import { CONFIG } from './config.js';
import { clamp } from './random.js';

const FONT = '"Trebuchet MS", Arial, sans-serif';

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function render(ctx, game) {
  const w = game.w;
  const h = game.h;
  const fx = game.fx;

  ctx.clearRect(0, 0, w, h);

  // ---- world layer (shaken) ----
  ctx.save();
  ctx.translate(fx.shakeX, fx.shakeY);
  drawBackground(ctx, game);
  drawPortals(ctx, game);
  drawPickups(ctx, game);
  drawEnemies(ctx, game);
  if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'upgrade') {
    drawPlayer(ctx, game);
  }
  drawBullets(ctx, game);
  fx.draw(ctx);
  ctx.restore();

  // ---- damage vignette (unshaken, over the world) ----
  if (game.hurtT > 0) {
    const a = clamp(game.hurtT / 0.4, 0, 1) * 0.45;
    const g = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.32,
      w / 2, h / 2, Math.max(w, h) * 0.72,
    );
    g.addColorStop(0, 'rgba(226, 72, 61, 0)');
    g.addColorStop(1, 'rgba(226, 72, 61, ' + a.toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- HUD + screens ----
  if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'upgrade') {
    drawHUD(ctx, game);
  }
  if (game.banner && (game.mode === 'playing' || game.mode === 'upgrade')) {
    drawBanner(ctx, game);
  }
  if (game.mode === 'title') drawTitle(ctx, game);
  else if (game.mode === 'paused') drawPause(ctx, game);
  else if (game.mode === 'upgrade') drawUpgrade(ctx, game);
  else if (game.mode === 'victory') drawVictory(ctx, game);
  else if (game.mode === 'gameover') drawGameOver(ctx, game);
}

// ------------------------------------------------------------------
function drawBackground(ctx, game) {
  const w = game.w;
  const h = game.h;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, CONFIG.colors.bg1);
  g.addColorStop(1, CONFIG.colors.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Faint ember glow spots drifting upward.
  for (const e of game.bgEmbers) {
    const tw = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(game.time * e.speed + e.phase));
    ctx.globalAlpha = tw * 0.5;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(e.x * w, ((e.y - game.time * 0.008 * e.speed) % 1 + 1) % 1 * h, e.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Arena border: glowing ember frame.
  const m = CONFIG.arenaMargin;
  ctx.strokeStyle = 'rgba(255, 122, 26, 0.55)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 14;
  ctx.strokeRect(m, m, w - m * 2, h - m * 2);
  ctx.shadowBlur = 0;

  // Vignette.
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------
function drawPortals(ctx, game) {
  for (const p of game.portals) {
    const frac = clamp(p.t / p.dur, 0, 1);
    const r = 12 + frac * 26;
    ctx.save();
    ctx.globalAlpha = 0.35 + frac * 0.6;
    ctx.strokeStyle = '#ff7a1a';
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, game.time * 3, game.time * 3 + Math.PI * 1.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.6, -game.time * 4, -game.time * 4 + Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPickups(ctx, game) {
  for (const u of game.pickups) {
    const bob = Math.sin(game.time * 3 + u.x * 0.01) * 3;
    const blink = u.life < 3 ? (Math.sin(game.time * 10) > 0 ? 1 : 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(u.x, u.y + bob);
    if (u.kind === 'health') {
      ctx.shadowColor = '#7dff9a';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#2fae5f';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#eafff0';
      ctx.fillRect(-2, -7, 4, 14);
      ctx.fillRect(-7, -2, 14, 4);
    } else if (u.kind === 'shield') {
      ctx.shadowColor = '#37e0d8';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#37e0d8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(55, 224, 216, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#dffffc';
      ctx.font = '700 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 1);
    } else { // spread
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffb347';
      drawStar(ctx, 0, 0, 5, 13, 6);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
}

function drawStar(ctx, x, y, points, outer, inner) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------------
function drawEnemies(ctx, game) {
  for (const e of game.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    // Spawning: fade/scale in from the portal.
    if (e.spawnT > 0) {
      const f = clamp(1 - e.spawnT / CONFIG.portalTime, 0.05, 1);
      ctx.globalAlpha = f;
      ctx.scale(f, f);
    }
    const flash = e.flash > 0;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 16;

    if (e.type === 'cinder') {
      // Ember blob with flickering flame core.
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = flash ? '#ffffff' : e.core;
      const fl = 1 + Math.sin(game.time * 9 + e.wobbleSeed) * 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.45 * fl, 0, Math.PI * 2);
      ctx.fill();
      // Eyes.
      ctx.fillStyle = '#1a0d05';
      ctx.beginPath();
      ctx.arc(-5, -3, 2.4, 0, Math.PI * 2);
      ctx.arc(5, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spark') {
      // Spitter diamond.
      ctx.rotate(e.angle + Math.PI / 4);
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.fillRect(-e.radius * 0.75, -e.radius * 0.75, e.radius * 1.5, e.radius * 1.5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = flash ? '#ffffff' : e.core;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'brute') {
      // Big heavy hexagon with cracked core.
      ctx.rotate(e.angle);
      ctx.fillStyle = flash ? '#ffffff' : e.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = flash ? '#ffffff' : e.core;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0d05';
      ctx.beginPath();
      ctx.arc(-8, -4, 3, 0, Math.PI * 2);
      ctx.arc(8, -4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'darter') {
      // Fast triangle, flashing white during its lunge windup.
      ctx.rotate(e.angle);
      const winding = e.state === 'windup';
      ctx.fillStyle = flash || winding ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.moveTo(e.radius + 6, 0);
      ctx.lineTo(-e.radius, e.radius * 0.8);
      ctx.lineTo(-e.radius * 0.5, 0);
      ctx.lineTo(-e.radius, -e.radius * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // HP bar for hurt enemies.
    if (e.hp < e.maxHp && e.spawnT <= 0) {
      ctx.rotate(-e.angle || 0);
      const bw = e.radius * 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-bw / 2, -e.radius - 11, bw, 5);
      ctx.fillStyle = '#ff7a1a';
      ctx.fillRect(-bw / 2, -e.radius - 11, bw * clamp(e.hp / e.maxHp, 0, 1), 5);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------
function drawPlayer(ctx, game) {
  const p = game.player;
  if (p.dead) return;
  ctx.save();
  ctx.translate(p.x, p.y);

  // Dash trail glow.
  if (p.dashTimer > 0) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(-p.dashDirX * 22, -p.dashDirY * 22, p.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Shield ring.
  if (p.shieldTimer > 0) {
    ctx.strokeStyle = 'rgba(55, 224, 216, 0.9)';
    ctx.shadowColor = '#37e0d8';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 10 + Math.sin(game.time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Body: ember warden — dark core, hot rim, aim barrel.
  ctx.rotate(p.angle);
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 20;
  ctx.fillStyle = p.invulnTimer > 0 && Math.sin(game.time * 30) > 0 ? '#ffd166' : '#ff7a1a';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2b1408';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, 0, p.radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // Barrel.
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(p.radius * 0.7, -3, 14, 6);
  ctx.restore();
}

function drawBullets(ctx, game) {
  ctx.save();
  ctx.shadowBlur = 10;
  for (const b of game.bullets) {
    ctx.shadowColor = '#ffb347';
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of game.ebullets) {
    ctx.shadowColor = '#e2483d';
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------
function drawHUD(ctx, game) {
  const w = game.w;
  const p = game.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Score, top-left.
  ctx.textAlign = 'left';
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '700 26px ' + FONT;
  ctx.fillText('SCORE  ' + game.score, 20, 36);
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 15px ' + FONT;
  ctx.fillText('BEST  ' + game.best, 20, 58);

  // Wave, top-center.
  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '700 22px ' + FONT;
  ctx.fillText('WAVE  ' + Math.max(1, game.wave) + ' / 10', w / 2, 36);
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 14px ' + FONT;
  ctx.fillText(fmtTime(game.elapsed) + '   •   ' + game.kills + ' KILLS', w / 2, 58);

  // Enemies left, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb347';
  ctx.font = '700 22px ' + FONT;
  ctx.fillText('FIENDS LEFT  ' + game.enemiesLeft(), w - 20, 36);
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 14px ' + FONT;
  ctx.fillText('M mute  •  P pause', w - 20, 58);

  // Health bar, bottom-left.
  const bw = 240;
  const bx = 20;
  const by = game.h - 34;
  ctx.textAlign = 'left';
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '700 15px ' + FONT;
  ctx.fillText('HP  ' + Math.ceil(p.hp) + ' / ' + p.maxHp, bx, by - 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  roundRect(ctx, bx, by, bw, 16, 8);
  ctx.fill();
  const hpf = clamp(p.hp / p.maxHp, 0, 1);
  ctx.fillStyle = hpf > 0.5 ? '#ff7a1a' : hpf > 0.25 ? '#ff9a3d' : '#e2483d';
  if (hpf > 0) {
    roundRect(ctx, bx, by, bw * hpf, 16, 8);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(245, 233, 211, 0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, 16, 8);
  ctx.stroke();

  // Active pickup timers, above the health bar.
  let ty = by - 34;
  ctx.font = '700 15px ' + FONT;
  if (p.shieldTimer > 0) {
    ctx.fillStyle = '#37e0d8';
    ctx.fillText('SHIELD  ' + p.shieldTimer.toFixed(1) + 's', bx, ty);
    ty -= 20;
  }
  if (p.spreadTimer > 0) {
    ctx.fillStyle = '#ffb347';
    ctx.fillText('SPREAD SHOT  ' + p.spreadTimer.toFixed(1) + 's', bx, ty);
    ty -= 20;
  }

  // Dash cooldown, bottom-right.
  const dw = 160;
  const dx = w - 20 - dw;
  const dy = game.h - 34;
  const ready = p.dashCdTimer <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = ready ? '#37e0d8' : CONFIG.colors.textDim;
  ctx.font = '700 15px ' + FONT;
  ctx.fillText(ready ? 'DASH READY  [SPACE]' : 'DASH  ' + p.dashCdTimer.toFixed(1) + 's', dx, dy - 10);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  roundRect(ctx, dx, dy, dw, 12, 6);
  ctx.fill();
  const df = clamp(1 - p.dashCdTimer / p.dashCooldown, 0, 1);
  ctx.fillStyle = ready ? '#37e0d8' : '#1d8f8a';
  if (df > 0) {
    roundRect(ctx, dx, dy, dw * df, 12, 6);
    ctx.fill();
  }
  ctx.restore();
}

function drawBanner(ctx, game) {
  const b = game.banner;
  const f = clamp(b.t / b.dur, 0, 1);
  const alpha = f < 0.15 ? f / 0.15 : f > 0.75 ? (1 - f) / 0.25 : 1;
  const scale = 1 + (1 - clamp(b.t / 0.25, 0, 1)) * 0.35;
  ctx.save();
  ctx.translate(game.w / 2, game.h * 0.3);
  ctx.scale(scale, scale);
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 64px ' + FONT;
  ctx.fillText(b.text, 0, 0);
  ctx.shadowBlur = 0;
  if (b.sub) {
    ctx.fillStyle = '#f5e9d3';
    ctx.font = '700 20px ' + FONT;
    ctx.fillText(b.sub, 0, 34);
  }
  ctx.restore();
}

// ------------------------------------------------------------------
function dimScreen(ctx, game, alpha) {
  ctx.fillStyle = 'rgba(5, 3, 2, ' + alpha + ')';
  ctx.fillRect(0, 0, game.w, game.h);
}

function drawTitle(ctx, game) {
  dimScreen(ctx, game, 0.55);
  const w = game.w;
  const h = game.h;
  ctx.save();
  ctx.textAlign = 'center';

  const pulse = 1 + Math.sin(game.time * 2) * 0.02;
  ctx.translate(w / 2, h * 0.30);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 42;
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 84px ' + FONT;
  ctx.fillText('EMBERFALL', 0, 0);
  ctx.restore();

  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '600 22px ' + FONT;
  ctx.fillText('The last Ember Warden holds the burning arena.', w / 2, h * 0.30 + 44);
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 17px ' + FONT;
  ctx.fillText('WASD / Arrows — move    •    Mouse — aim    •    Hold Click — fire', w / 2, h * 0.30 + 84);
  ctx.fillText('SPACE / SHIFT — dash    •    P — pause    •    M — mute', w / 2, h * 0.30 + 110);
  ctx.fillText('Clear 10 waves. Pick an upgrade after each one. Survive.', w / 2, h * 0.30 + 136);

  if (game.best > 0) {
    ctx.fillStyle = '#ffb347';
    ctx.font = '700 19px ' + FONT;
    ctx.fillText('BEST SCORE  ' + game.best, w / 2, h * 0.30 + 172);
  }

  const blink = 0.6 + 0.4 * Math.sin(game.time * 4);
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#ffd166';
  ctx.font = '700 24px ' + FONT;
  ctx.fillText('— Click or press Enter to start —', w / 2, h * 0.30 + 224);
  ctx.globalAlpha = 1;

  // Mute button, bottom-right.
  const r = { x: w - 150, y: h - 56, w: 130, h: 36 };
  game.muteRect = r;
  ctx.fillStyle = 'rgba(12, 8, 6, 0.7)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(245, 233, 211, 0.5)';
  ctx.stroke();
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '700 15px ' + FONT;
  ctx.fillText(game.audio.muted ? 'UNMUTE  [M]' : 'MUTE  [M]', w - 85, h - 33);
  ctx.restore();
}

function drawPause(ctx, game) {
  dimScreen(ctx, game, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 56px ' + FONT;
  ctx.fillText('PAUSED', game.w / 2, game.h / 2 - 20);
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '600 20px ' + FONT;
  ctx.fillText('Press P or Esc to resume    •    R to restart', game.w / 2, game.h / 2 + 24);
  ctx.restore();
}

function drawUpgrade(ctx, game) {
  dimScreen(ctx, game, 0.65);
  const w = game.w;
  const h = game.h;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 44px ' + FONT;
  ctx.fillText('WAVE ' + game.wave + ' CLEARED!', w / 2, h * 0.24);
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '600 20px ' + FONT;
  ctx.fillText('Choose an upgrade — click a card or press 1 / 2 / 3', w / 2, h * 0.24 + 36);

  const cw = 250;
  const ch = 190;
  const gap = 28;
  const total = cw * 3 + gap * 2;
  const startX = (w - total) / 2;
  const y = h * 0.24 + 70;
  game.upgradeRects = [];
  game.upgradeChoices.forEach((up, i) => {
    const x = startX + i * (cw + gap);
    const r = { x, y, w: cw, h: ch };
    game.upgradeRects.push(r);
    ctx.fillStyle = 'rgba(23, 14, 8, 0.92)';
    roundRect(ctx, x, y, cw, ch, 14);
    ctx.fill();
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff7a1a';
    ctx.shadowBlur = 12;
    roundRect(ctx, x, y, cw, ch, 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#37e0d8';
    ctx.font = '700 16px ' + FONT;
    ctx.fillText('[' + (i + 1) + ']', x + cw / 2, y + 34);
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 24px ' + FONT;
    ctx.fillText(up.name, x + cw / 2, y + 76);
    ctx.fillStyle = CONFIG.colors.text;
    ctx.font = '600 17px ' + FONT;
    ctx.fillText(up.desc, x + cw / 2, y + 112);
    ctx.fillStyle = CONFIG.colors.textDim;
    ctx.font = '600 14px ' + FONT;
    ctx.fillText('Click to take', x + cw / 2, y + 156);
  });
  ctx.restore();
}

function statLine(ctx, label, value, x, y, w) {
  ctx.textAlign = 'left';
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 20px ' + FONT;
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '700 20px ' + FONT;
  ctx.fillText(value, x + w, y);
}

function drawEndButton(ctx, game, label) {
  const w = 260;
  const h = 54;
  const x = game.w / 2 - w / 2;
  const y = game.h * 0.66;
  const r = { x, y, w, h };
  game.buttonRect = r;
  ctx.fillStyle = '#ff7a1a';
  ctx.shadowColor = '#ff7a1a';
  ctx.shadowBlur = 22;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a0d05';
  ctx.font = '800 22px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(label, game.w / 2, y + 35);
  ctx.fillStyle = CONFIG.colors.textDim;
  ctx.font = '600 15px ' + FONT;
  ctx.fillText('or press R', game.w / 2, y + h + 26);
}

function drawVictory(ctx, game) {
  dimScreen(ctx, game, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 36;
  ctx.fillStyle = '#ffd166';
  ctx.font = '900 72px ' + FONT;
  ctx.fillText('VICTORY', game.w / 2, game.h * 0.26);
  ctx.shadowBlur = 0;
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '600 21px ' + FONT;
  ctx.fillText('The arena is yours, Warden. All 10 waves have fallen.', game.w / 2, game.h * 0.26 + 42);

  const sx = game.w / 2 - 170;
  const sy = game.h * 0.26 + 92;
  statLine(ctx, 'SCORE', String(game.score), sx, sy, 340);
  statLine(ctx, 'BEST', String(game.best), sx, sy + 34, 340);
  statLine(ctx, 'KILLS', String(game.kills), sx, sy + 68, 340);
  statLine(ctx, 'TIME', fmtTime(game.elapsed), sx, sy + 102, 340);
  statLine(ctx, 'WAVES CLEARED', game.wave + ' / 10', sx, sy + 136, 340);
  drawEndButton(ctx, game, 'PLAY AGAIN');
  ctx.restore();
}

function drawGameOver(ctx, game) {
  dimScreen(ctx, game, 0.65);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#e2483d';
  ctx.shadowBlur = 36;
  ctx.fillStyle = '#ff6b5e';
  ctx.font = '900 72px ' + FONT;
  ctx.fillText('GAME OVER', game.w / 2, game.h * 0.26);
  ctx.shadowBlur = 0;
  ctx.fillStyle = CONFIG.colors.text;
  ctx.font = '600 21px ' + FONT;
  ctx.fillText('The embers fade… but the Warden rises again.', game.w / 2, game.h * 0.26 + 42);

  const sx = game.w / 2 - 170;
  const sy = game.h * 0.26 + 92;
  statLine(ctx, 'SCORE', String(game.score), sx, sy, 340);
  statLine(ctx, 'BEST', String(game.best), sx, sy + 34, 340);
  statLine(ctx, 'KILLS', String(game.kills), sx, sy + 68, 340);
  statLine(ctx, 'WAVE REACHED', game.wave + ' / 10', sx, sy + 102, 340);
  statLine(ctx, 'TIME', fmtTime(game.elapsed), sx, sy + 136, 340);
  drawEndButton(ctx, game, 'TRY AGAIN');
  ctx.restore();
}
