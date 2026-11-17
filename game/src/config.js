// EMBERFALL — all tuning constants in one place.
// Pure data: no DOM, no audio, no imports. Every other module reads from here.
export const CONFIG = {
  // Arena / canvas margins
  arenaMargin: 36,

  // ---- Player ----
  player: {
    radius: 16,
    speed: 265,
    maxHp: 100,
    fireInterval: 0.17, // seconds between shots
    bulletSpeed: 660,
    bulletDamage: 14,
    bulletRadius: 5,
    bulletLife: 1.1,
    dashSpeed: 840,
    dashTime: 0.16,
    dashCooldown: 2.5,
    invulnTime: 0.5, // brief invulnerability after taking a hit
    magnetRadius: 95,
    thorns: 0,
    multishot: 0, // extra projectiles beyond the first
    pierce: 0, // extra enemies a bullet can pass through
  },

  // ---- Enemies ----
  // hpScale / speedScale are per-wave multipliers applied on top of base stats.
  enemies: {
    cinder: {
      name: 'Cinder', hp: 22, speed: 74, radius: 16, damage: 10, score: 100,
      color: '#ff7a1a', core: '#ffd166', hpScale: 0.09, speedScale: 0.03,
    },
    spark: {
      name: 'Spark', hp: 18, speed: 58, radius: 14, damage: 8, score: 150,
      color: '#ffb347', core: '#fff3b0', hpScale: 0.09, speedScale: 0.03,
      shootInterval: 2.4, shootRange: 360, bulletSpeed: 235, bulletDamage: 8,
    },
    brute: {
      name: 'Brute', hp: 135, speed: 42, radius: 30, damage: 25, score: 300,
      color: '#e2483d', core: '#ff9a76', hpScale: 0.12, speedScale: 0.02,
    },
    darter: {
      name: 'Darter', hp: 26, speed: 96, radius: 13, damage: 12, score: 200,
      color: '#ff4d6d', core: '#ffc2d1', hpScale: 0.09, speedScale: 0.04,
      lungeSpeed: 560, lungeTime: 0.32, windupTime: 0.45, recoverTime: 1.1,
      lungeRange: 290,
    },
  },

  // ---- Waves (10). Composition per wave. ----
  waves: [
    { cinder: 5, spark: 0, brute: 0, darter: 0 },
    { cinder: 8, spark: 2, brute: 0, darter: 0 },
    { cinder: 10, spark: 3, brute: 0, darter: 2 },
    { cinder: 12, spark: 4, brute: 1, darter: 3 },
    { cinder: 14, spark: 5, brute: 2, darter: 4 },
    { cinder: 16, spark: 6, brute: 2, darter: 6 },
    { cinder: 18, spark: 7, brute: 3, darter: 7 },
    { cinder: 20, spark: 8, brute: 4, darter: 8 },
    { cinder: 22, spark: 9, brute: 5, darter: 10 },
    { cinder: 24, spark: 10, brute: 6, darter: 12 },
  ],
  waveClearBonus: 250, // + 50 per wave number
  spawnInterval: 0.45, // seconds between spawns from the queue
  portalTime: 0.7, // spawn telegraph duration

  // ---- Pickups ----
  pickups: {
    healthDrop: 0.10,
    shieldDrop: 0.06,
    spreadDrop: 0.06,
    healthAmount: 25,
    shieldTime: 8,
    spreadTime: 10,
    radius: 12,
    life: 14, // seconds before a dropped pickup fades
  },

  // ---- Palette ----
  colors: {
    bg0: '#0b0908',
    bg1: '#171009',
    ember: '#ff7a1a',
    emberBright: '#ffb347',
    emberHot: '#ffd166',
    cyan: '#37e0d8',
    cyanDim: '#1d8f8a',
    danger: '#e2483d',
    text: '#f5e9d3',
    textDim: '#b8a88f',
    hudBg: 'rgba(12, 8, 6, 0.62)',
  },
};
