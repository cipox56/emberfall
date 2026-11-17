// EMBERFALL — particles, floating damage numbers, screen shake.
// One system, no allocations in the hot path beyond small objects.
// A seeded rng can be injected for deterministic screenshot scenes.

export class Particles {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._rand = Math.random;
  }

  setRng(fn) {
    this._rand = fn || Math.random;
  }

  // Radial burst of glowing sparks.
  burst(x, y, color, count, speed, life, size) {
    const n = count || 12;
    const sp = speed || 200;
    const lf = life || 0.6;
    const sz = size || 3;
    for (let i = 0; i < n; i++) {
      const a = this._rand() * Math.PI * 2;
      const v = sp * (0.35 + this._rand() * 0.85);
      const l = lf * (0.6 + this._rand() * 0.7);
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: l, maxLife: l,
        size: sz * (0.6 + this._rand() * 0.8),
        color,
        drag: 2.2,
      });
    }
  }

  // Small muzzle flash burst in the firing direction.
  muzzle(x, y, angle) {
    for (let i = 0; i < 5; i++) {
      const a = angle + (this._rand() - 0.5) * 0.7;
      const v = 260 + this._rand() * 180;
      this.parts.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.14, maxLife: 0.14,
        size: 2 + this._rand() * 2,
        color: i % 2 ? '#ffd166' : '#ff7a1a',
        drag: 4,
      });
    }
  }

  // Floating combat text (damage numbers, pickups, bonuses).
  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color: color || '#ffd166', life: 0.9, maxLife: 0.9 });
  }

  // Add screen shake trauma (0..1). Big kills / player damage call this.
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const mag = this.trauma * this.trauma * 15;
    this.shakeX = mag * (this._rand() * 2 - 1);
    this.shakeY = mag * (this._rand() * 2 - 1);

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = '700 15px "Trebuchet MS", Arial, sans-serif';
    for (const t of this.texts) {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.trauma = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
}
