// EMBERFALL — between-wave upgrades.
// Pool of 10 cards; each wave clear offers 3 distinct random ones.
// Each card: id, name, one-line effect, apply(player).

export const UPGRADES = [
  {
    id: 'damage',
    name: 'Ember Rounds',
    desc: '+25% bullet damage',
    apply(p) { p.damage = Math.round(p.damage * 1.25 * 10) / 10; },
  },
  {
    id: 'firerate',
    name: 'Rapid Ignition',
    desc: '+18% fire rate',
    apply(p) { p.fireInterval = Math.max(0.06, p.fireInterval * 0.82); },
  },
  {
    id: 'multishot',
    name: 'Split Flame',
    desc: '+1 projectile per shot',
    apply(p) { p.multishot += 1; },
  },
  {
    id: 'pierce',
    name: 'Piercing Embers',
    desc: 'Bullets pierce +1 enemy',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'maxhp',
    name: "Warden's Heart",
    desc: '+30 max HP and heal 30',
    apply(p) { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); },
  },
  {
    id: 'speed',
    name: 'Swift Boots',
    desc: '+12% move speed',
    apply(p) { p.speed = Math.round(p.speed * 1.12); },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    desc: '+60% pickup magnet radius',
    apply(p) { p.magnetRadius = Math.round(p.magnetRadius * 1.6); },
  },
  {
    id: 'dash',
    name: 'Phase Step',
    desc: '-25% dash cooldown',
    apply(p) { p.dashCooldown = Math.max(0.8, p.dashCooldown * 0.75); },
  },
  {
    id: 'bulletspeed',
    name: 'Swift Embers',
    desc: '+25% bullet speed',
    apply(p) { p.bulletSpeed = Math.round(p.bulletSpeed * 1.25); },
  },
  {
    id: 'thorns',
    name: 'Thornmail',
    desc: 'Attackers take +12 contact damage',
    apply(p) { p.thorns += 12; },
  },
];

// Roll `count` distinct random upgrades using the seeded rng.
export function rollUpgrades(rng, count) {
  const pool = UPGRADES.slice();
  rng.shuffle(pool);
  return pool.slice(0, count || 3);
}

// Apply one upgrade (by id) to the player. Returns the upgrade or null.
export function applyUpgrade(player, id) {
  const up = UPGRADES.find((u) => u.id === id);
  if (!up) return null;
  up.apply(player);
  return up;
}
