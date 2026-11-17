// EMBERFALL — seeded RNG (mulberry32) + small helpers.
// Deterministic: same seed => same sequence. Used for wave shuffles,
// upgrade rolls, drops, and the deterministic screenshot scenes.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Wraps a mulberry32 stream with convenience helpers.
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float in [a, b)
    range(a, b) {
      return a + next() * (b - a);
    },
    // Integer in [a, b] inclusive
    int(a, b) {
      return a + Math.floor(next() * (b - a + 1));
    },
    // Random element of an array
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // True with probability p (0..1)
    chance(p) {
      return next() < p;
    },
    // In-place Fisher-Yates shuffle, returns the array
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
  };
}

// Clamp a value into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Euclidean distance between two points.
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
