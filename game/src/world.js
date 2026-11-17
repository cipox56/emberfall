// EMBERFALL — game state machine + world simulation.
// Modes: title / playing / upgrade / paused / victory / gameover.
// Owns the player, enemies, bullets, pickups, portals, waves, score,
// and every transition between screens. Rendering lives in render.js.

import { CONFIG } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { createEnemy, pickSpawnPoint, updateEnemy } from './enemies.js';
import { createPlayer, updatePlayer, tryFire, damagePlayer } from './player.js';
import { rollUpgrades, applyUpgrade } from './upgrades.js';
import { inRect } from './input.js';

const BEST_KEY = 'emberfall_best';
const TOTAL_WAVES = 10;

export class Game {
  constructor(input, audio, fx) {
    this.input = input;
    this.audio = audio;
    this.fx = fx;
    this.rng = makeRng((Date.now() % 2147483647) | 1);
    this.w = 1280;
    this.h = 720;
    this.time = 0;
    this.mode = 'title';
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.elapsed = 0;
    this.best = this._loadBest();
    this.player = createPlayer(this.w / 2, this.h / 2);
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.pickups = [];
    this.portals = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.banner = null; // {text, sub, t, dur}
    this.upgradeChoices = [];
    this.upgradeRects = []; // set by render.js each frame
    this.muteRect = null; // set by render.js (title screen)
    this.buttonRect = null; // set by render.js (victory / gameover)
    this.hurtT = 0; // damage vignette timer
    this.bgEmbers = [];
    this._makeBgEmbers();
    this._setupTitleAmbient();
  }

  _loadBest() {
    try {
      return parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch (err) {
      return 0;
    }
  }

  _saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try {
        window.localStorage.setItem(BEST_KEY, String(this.best));
      } catch (err) { /* ignore */ }
    }
  }

  _makeBgEmbers() {
    this.bgEmbers = [];
    const r = makeRng(20261117);
    for (let i = 0; i < 80; i++) {
      this.bgEmbers.push({
        x: r.next(), y: r.next(), // normalized 0..1, scaled at draw time
        r: 1 + r.next() * 2.4,
        phase: r.next() * Math.PI * 2,
        speed: 0.5 + r.next() * 1.5,
      });
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const m = CONFIG.arenaMargin + 20;
    this.player.x = clamp(this.player.x, m, w - m);
    this.player.y = clamp(this.player.y, m, h - m);
  }

  // ---- setup ------------------------------------------------------
  _setupTitleAmbient() {
    // A few fiends drifting behind the title screen.
    this.enemies = [];
    const types = ['cinder', 'cinder', 'spark', 'darter', 'cinder', 'brute'];
    for (let i = 0; i < types.length; i++) {
      const e = createEnemy(types[i], 0, 0, 1);
      e.spawnT = 0;
      e.x = this.rng.range(80, this.w - 80);
      e.y = this.rng.range(120, this.h - 120);
      e.vx = this.rng.range(-28, 28);
      e.vy = this.rng.range(-28, 28);
      e.ambient = true;
      this.enemies.push(e);
    }
  }

  newGame() {
    this.score = 0;
    this.kills = 0;
    this.wave = 0;
    this.elapsed = 0;
    this.enemies = [];
    this.bullets = [];
    this.ebullets = [];
    this.pickups = [];
    this.portals = [];
    this.spawnQueue = [];
    this.upgradeChoices = [];
    this.hurtT = 0;
    this.fx.clear();
    this.player = createPlayer(this.w / 2, this.h / 2);
    this.mode = 'playing';
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    const comp = CONFIG.waves[n - 1];
    const queue = [];
    for (const type of ['cinder', 'spark', 'brute', 'darter']) {
      const count = comp[type] || 0;
      for (let i = 0; i < count; i++) queue.push(type);
    }
    this.rng.shuffle(queue);
    this.spawnQueue = queue;
    this.spawnTimer = 0.6;
    this.banner = {
      text: 'WAVE ' + n,
      sub: n === TOTAL_WAVES ? 'FINAL WAVE — HOLD THE LINE' : '',
      t: 0,
      dur: 2.2,
    };
    this.audio.waveStart();
  }

  enemiesLeft() {
    return this.spawnQueue.length + this.portals.length + this.enemies.length;
  }

  // ---- per-frame update -------------------------------------------
  update(dt) {
    this.time += dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }

    // Global mute toggle.
    if (this.input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.fx.addText(this.player.x, this.player.y - 30, muted ? 'MUTED' : 'SOUND ON', '#37e0d8');
    }

    if (this.mode === 'title') this._updateTitle(dt);
    else if (this.mode === 'playing') this._updatePlaying(dt);
    else if (this.mode === 'upgrade') this._updateUpgrade(dt);
    else if (this.mode === 'paused') this._updatePaused(dt);
    else if (this.mode === 'victory' || this.mode === 'gameover') this._updateEnd(dt);
  }

  _updateTitle(dt) {
    // Drift the ambient fiends; bounce off the arena edge.
    const m = CONFIG.arenaMargin;
    for (const e of this.enemies) {
      e.x += (e.vx || 0) * dt;
      e.y += (e.vy || 0) * dt;
      if (e.x < m || e.x > this.w - m) e.vx = -(e.vx || 0);
      if (e.y < m || e.y > this.h - m) e.vy = -(e.vy || 0);
      e.angle += dt * 0.4;
    }
    this.fx.update(dt);
    if (Math.random() < dt * 2) {
      this.fx.burst(
        this.rng.range(60, this.w - 60), this.rng.range(60, this.h - 60),
        '#ff7a1a', 3, 60, 1.2, 2,
      );
    }
    const clicks = this.input.takeClicks();
    for (const c of clicks) {
      if (this.muteRect && inRect(c.x, c.y, this.muteRect)) {
        this.audio.ensure();
        this.audio.toggleMute();
        this.audio.click();
        continue;
      }
      this.audio.ensure();
      this.audio.click();
      this.newGame();
      return;
    }
    if (this.input.wasPressed('Enter')) {
      this.audio.ensure();
      this.audio.click();
      this.newGame();
    }
  }

  _updatePlaying(dt) {
    this.elapsed += dt;
    const p = this.player;

    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.mode = 'paused';
      this.audio.click();
      this.input.takeClicks();
      return;
    }

    updatePlayer(p, dt, this.input, this.w, this.h, this.audio);
    tryFire(p, dt, this.input, this.bullets, this.fx, this.audio);

    this._spawnTick(dt);
    this._updatePortals(dt);
    this._updateEnemies(dt);
    this._updateBullets(dt);
    this._updateEBullets(dt);
    this._updatePickups(dt);
    this.fx.update(dt);

    if (p.dead) {
      this._gameOver();
      return;
    }

    // Wave cleared: all spawned, all portals done, all enemies dead.
    if (this.spawnQueue.length === 0 && this.portals.length === 0 && this.enemies.length === 0) {
      const bonus = CONFIG.waveClearBonus + this.wave * 50;
      this.score += bonus;
      this.fx.addText(p.x, p.y - 34, 'WAVE CLEAR  +' + bonus, '#ffd166');
      if (this.wave >= TOTAL_WAVES) {
        this._victory();
      } else {
        this.upgradeChoices = rollUpgrades(this.rng, 3);
        this.mode = 'upgrade';
        this.audio.upgrade();
      }
    }
  }

  _updateUpgrade(dt) {
    this.fx.update(dt);
    if (this.input.wasPressed('Digit1')) { this.chooseUpgrade(0); return; }
    if (this.input.wasPressed('Digit2')) { this.chooseUpgrade(1); return; }
    if (this.input.wasPressed('Digit3')) { this.chooseUpgrade(2); return; }
    const clicks = this.input.takeClicks();
    for (const c of clicks) {
      for (let i = 0; i < this.upgradeRects.length; i++) {
        if (inRect(c.x, c.y, this.upgradeRects[i])) {
          this.chooseUpgrade(i);
          return;
        }
      }
    }
  }

  _updatePaused(dt) {
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape') || this.input.wasPressed('Enter')) {
      this.mode = 'playing';
      this.audio.click();
    }
    if (this.input.wasPressed('KeyR')) this.newGame();
    this.input.takeClicks();
  }

  _updateEnd(dt) {
    this.fx.update(dt);
    if (this.input.wasPressed('KeyR') || this.input.wasPressed('Enter')) {
      this.audio.click();
      this.newGame();
      return;
    }
    const clicks = this.input.takeClicks();
    for (const c of clicks) {
      if (this.buttonRect && inRect(c.x, c.y, this.buttonRect)) {
        this.audio.click();
        this.newGame();
        return;
      }
    }
  }

  chooseUpgrade(i) {
    const choice = this.upgradeChoices[i];
    if (!choice) return;
    applyUpgrade(this.player, choice.id);
    this.fx.addText(this.player.x, this.player.y - 34, choice.name + '!', '#37e0d8');
    this.audio.upgrade();
    this.upgradeChoices = [];
    this.mode = 'playing';
    this.startWave(this.wave + 1);
  }

  // ---- simulation pieces ------------------------------------------
  _spawnTick(dt) {
    if (this.spawnQueue.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = CONFIG.spawnInterval;
    const type = this.spawnQueue.shift();
    const pos = pickSpawnPoint(this.w, this.h, this.player, this.rng);
    this.portals.push({ x: pos.x, y: pos.y, t: 0, dur: CONFIG.portalTime, type });
  }

  _updatePortals(dt) {
    for (let i = this.portals.length - 1; i >= 0; i--) {
      const portal = this.portals[i];
      portal.t += dt;
      if (portal.t >= portal.dur) {
        this.portals.splice(i, 1);
        const e = createEnemy(portal.type, portal.x, portal.y, this.wave);
        e.spawnT = 0.25;
        this.enemies.push(e);
        this.fx.burst(portal.x, portal.y, '#ff7a1a', 8, 140, 0.4, 2);
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.player;
    const m = CONFIG.arenaMargin;
    const fireEBullet = (x, y, vx, vy, damage) => {
      this.ebullets.push({ x, y, vx, vy, damage, radius: 6, life: 4 });
    };
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      updateEnemy(e, dt, p, this.rng, this.time, fireEBullet);
      e.x = clamp(e.x, m, this.w - m);
      e.y = clamp(e.y, m, this.h - m);
      if (e.dead) continue;
      // Contact damage on the player.
      if (e.spawnT <= 0 && e.contactCd <= 0 && !p.dead) {
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < e.radius + p.radius - 2) {
          e.contactCd = 0.8;
          const died = damagePlayer(p, e.damage, this.fx, this.audio, this);
          if (p.thorns > 0) this._hurtEnemy(e, p.thorns, true);
          if (died) return;
        }
      }
    }
    // Remove enemies killed by thorns.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].hp <= 0) this._killEnemy(i);
    }
  }

  _hurtEnemy(e, amount, silent) {
    e.hp -= amount;
    e.flash = 0.12;
    this.fx.addText(e.x, e.y - e.radius - 6, String(Math.round(amount)), '#ffd166');
    if (!silent) this.fx.burst(e.x, e.y, '#ffb347', 5, 150, 0.35, 2);
  }

  _killEnemy(index) {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);
    this.score += e.score;
    this.kills += 1;
    const big = e.type === 'brute';
    this.fx.burst(e.x, e.y, e.color, big ? 30 : 16, big ? 320 : 240, 0.7, 3);
    this.fx.burst(e.x, e.y, '#ffd166', 8, 160, 0.5, 2);
    this.fx.addText(e.x, e.y - e.radius - 4, '+' + e.score, '#ffd166');
    this.fx.shake(big ? 0.5 : 0.22);
    this.audio.explode(big);
    this._rollDrop(e.x, e.y);
  }

  _rollDrop(x, y) {
    const r = this.rng.next();
    const pk = CONFIG.pickups;
    let kind = null;
    if (r < pk.healthDrop) kind = 'health';
    else if (r < pk.healthDrop + pk.shieldDrop) kind = 'shield';
    else if (r < pk.healthDrop + pk.shieldDrop + pk.spreadDrop) kind = 'spread';
    if (!kind) return;
    const a = this.rng.range(0, Math.PI * 2);
    this.pickups.push({
      kind,
      x, y,
      vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
      t: 0, life: pk.life,
    });
  }

  _updateBullets(dt) {
    const m = CONFIG.arenaMargin;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < m - 20 || b.x > this.w - m + 20 || b.y < m - 20 || b.y > this.h - m + 20) {
        this.bullets.splice(i, 1);
        continue;
      }
      // Hit enemies.
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (e.spawnT > 0) continue;
        const d = dist(b.x, b.y, e.x, e.y);
        if (d < e.radius + b.radius) {
          this._hurtEnemy(e, b.damage, false);
          this.audio.hit();
          // Small knockback away from the bullet.
          const nx = (e.x - b.x) / (d || 1);
          const ny = (e.y - b.y) / (d || 1);
          e.x += nx * 5;
          e.y += ny * 5;
          if (e.hp <= 0) this._killEnemy(j);
          b.pierce -= 1;
          if (b.pierce < 0) {
            this.bullets.splice(i, 1);
          }
          break; // one enemy per bullet per step (unless piercing)
        }
      }
    }
  }

  _updateEBullets(dt) {
    const p = this.player;
    const m = CONFIG.arenaMargin;
    for (let i = this.ebullets.length - 1; i >= 0; i--) {
      const b = this.ebullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < m - 16 || b.x > this.w - m + 16 || b.y < m - 16 || b.y > this.h - m + 16) {
        this.ebullets.splice(i, 1);
        continue;
      }
      if (!p.dead && dist(b.x, b.y, p.x, p.y) < b.radius + p.radius - 2) {
        this.ebullets.splice(i, 1);
        if (damagePlayer(p, b.damage, this.fx, this.audio, this)) return;
      }
    }
  }

  _updatePickups(dt) {
    const p = this.player;
    const pk = CONFIG.pickups;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const u = this.pickups[i];
      u.t += dt;
      u.life -= dt;
      if (u.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      // Drift, then magnet toward the player.
      const d = dist(u.x, u.y, p.x, p.y);
      if (d < p.magnetRadius && !p.dead) {
        const pull = 520;
        u.vx += ((p.x - u.x) / (d || 1)) * pull * dt * 4;
        u.vy += ((p.y - u.y) / (d || 1)) * pull * dt * 4;
      } else {
        u.vx *= Math.max(0, 1 - 2 * dt);
        u.vy *= Math.max(0, 1 - 2 * dt);
      }
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      if (d < p.radius + pk.radius + 6 && !p.dead) {
        this.pickups.splice(i, 1);
        this._collectPickup(u);
      }
    }
  }

  _collectPickup(u) {
    const p = this.player;
    const pk = CONFIG.pickups;
    if (u.kind === 'health') {
      p.hp = Math.min(p.maxHp, p.hp + pk.healthAmount);
      this.fx.addText(p.x, p.y - 30, '+' + pk.healthAmount + ' HP', '#7dff9a');
      this.fx.burst(p.x, p.y, '#7dff9a', 10, 150, 0.5, 2);
    } else if (u.kind === 'shield') {
      p.shieldTimer = pk.shieldTime;
      this.fx.addText(p.x, p.y - 30, 'SHIELD!', '#37e0d8');
      this.fx.burst(p.x, p.y, '#37e0d8', 12, 160, 0.5, 2);
    } else if (u.kind === 'spread') {
      p.spreadTimer = pk.spreadTime;
      this.fx.addText(p.x, p.y - 30, 'SPREAD SHOT!', '#ffb347');
      this.fx.burst(p.x, p.y, '#ffb347', 12, 160, 0.5, 2);
    }
    this.audio.pickup();
  }

  _victory() {
    this.mode = 'victory';
    this._saveBest();
    this.audio.victory();
    this.fx.burst(this.w / 2, this.h / 2 - 60, '#ffd166', 60, 380, 1.2, 4);
  }

  _gameOver() {
    this.mode = 'gameover';
    this._saveBest();
    this.audio.defeat();
    this.fx.burst(this.player.x, this.player.y, '#ff7a1a', 50, 380, 1.1, 4);
    this.fx.shake(1);
  }

  // ---- deterministic screenshot scenes (see shots.js) ------------
  setupShot(scene, seed) {
    this.rng = makeRng(seed || 1337);
    this.fx.setRng(this.rng.next);
    this.fx.clear();
    this.bullets = [];
    this.ebullets = [];
    this.pickups = [];
    this.portals = [];
    this.spawnQueue = [];
    this.banner = null;
    this.best = 12500;
    this.time = 12.4; // fixed clock so twinkle / wobble is stable

    if (scene === 'title') {
      this.mode = 'title';
      this.score = 0;
      this.kills = 0;
      this.wave = 0;
      this.player = createPlayer(this.w / 2, this.h / 2 + 40);
      this._setupTitleAmbient();
      this.fx.burst(this.w * 0.3, this.h * 0.3, '#ff7a1a', 14, 200, 0.8, 3);
      this.fx.burst(this.w * 0.72, this.h * 0.62, '#ffb347', 10, 160, 0.8, 3);
    } else if (scene === 'play') {
      this.mode = 'playing';
      this.score = 2450;
      this.kills = 37;
      this.wave = 4;
      this.elapsed = 186;
      this.player = createPlayer(this.w / 2, this.h / 2);
      this.player.hp = 68;
      this.player.angle = -0.5;
      this.player.spreadTimer = 6.2;
      this.player.dashCdTimer = 0.8;
      this.player.shieldTimer = 0;
      // A few bullets mid-flight toward the upper-right.
      for (let i = 0; i < 4; i++) {
        this.bullets.push({
          x: this.w / 2 + 40 + i * 46, y: this.h / 2 - 22 - i * 24,
          vx: 560, vy: -280, damage: 14, pierce: 0, radius: 5, life: 0.9,
        });
      }
      const mk = (type, x, y, hpFrac) => {
        const e = createEnemy(type, x, y, 4);
        e.spawnT = 0;
        e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
        e.flash = type === 'cinder' ? 0.1 : 0;
        return e;
      };
      this.enemies = [
        mk('cinder', this.w / 2 + 210, this.h / 2 - 130, 0.5),
        mk('cinder', this.w / 2 - 260, this.h / 2 + 90, 1),
        mk('spark', this.w / 2 + 300, this.h / 2 + 120, 1),
        mk('brute', this.w / 2 - 180, this.h / 2 - 190, 0.7),
        mk('darter', this.w / 2 + 120, this.h / 2 + 190, 1),
      ];
      this.portals.push({ x: this.w - 120, y: 130, t: 0.35, dur: CONFIG.portalTime, type: 'cinder' });
      this.pickups.push({ kind: 'health', x: this.w / 2 - 90, y: this.h / 2 + 150, vx: 0, vy: 0, t: 1, life: 12 });
      this.ebullets.push({ x: this.w / 2 + 180, y: this.h / 2 + 40, vx: -200, vy: 60, damage: 8, radius: 6, life: 3 });
      this.fx.burst(this.w / 2 + 210, this.h / 2 - 130, '#ff7a1a', 12, 220, 0.7, 3);
      this.fx.addText(this.w / 2 + 150, this.h / 2 - 170, '14', '#ffd166');
      this.banner = { text: 'WAVE 4', sub: '', t: 0.4, dur: 2.2 };
    } else if (scene === 'victory') {
      this.mode = 'victory';
      this.score = 18400;
      this.kills = 214;
      this.wave = 10;
      this.elapsed = 742;
      this.player = createPlayer(this.w / 2, this.h / 2);
      this.enemies = [];
      this.fx.burst(this.w / 2, this.h / 2 - 60, '#ffd166', 50, 340, 1.1, 4);
    } else if (scene === 'gameover') {
      this.mode = 'gameover';
      this.score = 7320;
      this.kills = 96;
      this.wave = 7;
      this.elapsed = 431;
      this.player = createPlayer(this.w / 2, this.h / 2);
      this.player.hp = 0;
      this.player.dead = true;
      this.enemies = [];
      this.fx.burst(this.w / 2, this.h / 2, '#e2483d', 30, 300, 1.0, 4);
    } else {
      // Unknown scene: fall back to the title.
      this.setupShot('title', seed);
    }
  }
}
