// NEON VOID — tuning data and the upgrade pool.
// One job: every number the game balances on lives here, so tuning never
// means hunting through logic files.

export const CONFIG = {
  width: 960,
  height: 600,
  finalWave: 10,

  palette: {
    bg: '#05060f',
    bgEdge: '#0a0d24',
    grid: '#131a3d',
    gridBright: '#1c2560',
    cyan: '#00f0ff',
    magenta: '#ff2d95',
    yellow: '#ffe600',
    purple: '#9d4edd',
    orange: '#ff7a18',
    green: '#39ff88',
    red: '#ff3355',
    white: '#eaf6ff',
    dim: '#8b93b8',
  },

  player: {
    radius: 13,
    speed: 265,
    fireRate: 5.0, // shots per second
    bulletSpeed: 560,
    bulletDamage: 1,
    projectiles: 1,
    pierce: 0,
    magnet: 80,
    maxLives: 3,
    dashSpeed: 620,
    dashTime: 0.16,
    dashCooldown: 1.6,
    invulnTime: 1.5,
  },

  bullets: {
    radius: 5,
    life: 0.9, // seconds before a bullet fades
  },

  combo: {
    window: 3.0, // seconds without a kill before the chain breaks
    step: 5, // kills per multiplier step
    maxMult: 8,
  },

  waves: {
    spawnInterval: 0.55, // seconds between spawns, shrinks per wave
    spawnIntervalMin: 0.32,
    spawnSafe: 170, // enemies never spawn this close to the player
  },

  score: {
    drifter: 100,
    darter: 150,
    spitter: 200,
    splitter: 250,
    mini: 50,
    shard: 25,
  },
};

// Enemy blueprints. hp and speed scale with the wave inside world.js.
export const ENEMY_TYPES = {
  drifter: {
    name: 'Drifter',
    radius: 16,
    hp: 1,
    speed: 95,
    score: 100,
    color: '#ff2d95',
    shape: 'diamond',
  },
  darter: {
    name: 'Darter',
    radius: 14,
    hp: 2,
    speed: 70,
    dashSpeed: 340,
    score: 150,
    color: '#ffe600',
    shape: 'triangle',
  },
  spitter: {
    name: 'Spitter',
    radius: 18,
    hp: 2,
    speed: 80,
    fireEvery: 2.4,
    orbSpeed: 145,
    score: 200,
    color: '#9d4edd',
    shape: 'hexagon',
  },
  splitter: {
    name: 'Splitter',
    radius: 22,
    hp: 3,
    speed: 62,
    score: 250,
    color: '#ff7a18',
    shape: 'square',
  },
  mini: {
    name: 'Mini',
    radius: 9,
    hp: 1,
    speed: 150,
    score: 50,
    color: '#ff7a18',
    shape: 'diamond',
  },
};

// Upgrade cards offered between waves. Each card's apply() mutates the
// player's stats object; the text is what the card shows.
export const UPGRADES = [
  {
    id: 'rapid',
    name: 'RAPID CYCLER',
    desc: '+25% fire rate',
    color: '#00f0ff',
    apply: (p) => { p.fireRate *= 1.25; },
  },
  {
    id: 'heavy',
    name: 'HEAVY ROUNDS',
    desc: '+35% bullet damage',
    color: '#ff2d95',
    apply: (p) => { p.bulletDamage *= 1.35; },
  },
  {
    id: 'multi',
    name: 'SPLIT BARREL',
    desc: '+1 projectile per shot',
    color: '#ffe600',
    apply: (p) => { p.projectiles += 1; },
  },
  {
    id: 'pierce',
    name: 'PIERCE ROUNDS',
    desc: 'Bullets pass through +1 enemy',
    color: '#9d4edd',
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'swift',
    name: 'SWIFT THRUSTERS',
    desc: '+15% move speed',
    color: '#39ff88',
    apply: (p) => { p.speed *= 1.15; },
  },
  {
    id: 'plating',
    name: 'VOID PLATING',
    desc: '+1 max life, restore 1 life',
    color: '#ff3355',
    apply: (p) => {
      p.maxLives = Math.min(5, p.maxLives + 1);
      p.lives = Math.min(p.maxLives, p.lives + 1);
    },
  },
  {
    id: 'magnet',
    name: 'TRACTOR WEB',
    desc: '+90 score-shard pull radius',
    color: '#00f0ff',
    apply: (p) => { p.magnet += 90; },
  },
  {
    id: 'dash',
    name: 'OVERDRIVE DASH',
    desc: 'Dash recharges 30% faster',
    color: '#ffe600',
    apply: (p) => { p.dashCooldown *= 0.7; },
  },
  {
    id: 'velocity',
    name: 'HOT LOADER',
    desc: '+25% bullet speed',
    color: '#ff7a18',
    apply: (p) => { p.bulletSpeed *= 1.25; },
  },
];
