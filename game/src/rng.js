// NEON VOID — seeded randomness.
// One job: every random choice in the game flows through here, so a fixed
// seed replays the same world. Nothing else in the game calls Math.random
// for gameplay; Math.random is only used for cosmetic particle jitter that
// never affects the score or the shot scenes.

// mulberry32: small, fast, deterministic PRNG with a 32-bit seed.
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

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// Fisher-Yates shuffle driven by the seeded rng; returns a new array.
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// A point on a random edge of the arena, at least `minDist` away from (x, y).
export function edgePoint(rng, w, h, x, y, minDist) {
  for (let tries = 0; tries < 12; tries++) {
    const side = Math.floor(rng() * 4);
    let px = 0;
    let py = 0;
    if (side === 0) { px = range(rng, 30, w - 30); py = 30; }
    if (side === 1) { px = range(rng, 30, w - 30); py = h - 30; }
    if (side === 2) { px = 30; py = range(rng, 30, h - 30); }
    if (side === 3) { px = w - 30; py = range(rng, 30, h - 30); }
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy >= minDist * minDist) return { x: px, y: py };
  }
  // Fallback: the farthest corner from the player.
  const cx = x < w / 2 ? w - 40 : 40;
  const cy = y < h / 2 ? h - 40 : 40;
  return { x: cx, y: cy };
}
