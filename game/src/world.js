// NEON VOID — the world: entities, waves, collisions, scoring.
// One job: everything that happens inside the arena. It owns the player,
// the enemies, bullets, shards and particles, the wave spawner, the combo
// chain and the upgrade offers. It draws nothing and hears nothing —
// render.js draws it, audio.js is told what to play through the `sound`
// object passed to update().

import { CONFIG, ENEMY_TYPES, UPGRADES } from './config.js';
import { mulberry32, range, chance, shuffled, edgePoint } from './rng.js';

const W = CONFIG.width;
const H = CONFIG.height;

function waveComp(rng, n) {
  const q = [];
  const add = (type, count) => {
    for (let i = 0; i < count; i++) q.push(type);
  };
  add('drifter', 4 + n);
  if (n >= 2) add('darter', 1 + Math.floor(n / 2));
  if (n >= 3) add('spitter', 1 + Math.floor((n - 1) / 2));
  if (n >= 4) add('splitter', Math.floor(n / 3));
  return shuffled(rng, q);
}

export class World {
  constructor(seed) {
    this.rng = mulberry32(seed);
    this.time = 0;
    this.score = 0;
    this.wave = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.particles = [];
    this.shards = [];
    this.texts = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.banner = null;
    this.gameOver = false;
    this.victory = false;
    this.deathT = 0;
    this.upgradeOffer = null;
    this.upgradesTaken = [];
    this.shardSoundT = 0;
    this.player = null;
    this.makePlayer();
  }

  makePlayer() {
    const p = CONFIG.player;
    this.player = {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: p.radius,
      speed: p.speed,
      fireRate: p.fireRate,
      bulletSpeed: p.bulletSpeed,
      bulletDamage: p.bulletDamage,
      projectiles: p.projectiles,
      pierce: p.pierce,
      magnet: p.magnet,
      lives: p.maxLives,
      maxLives: p.maxLives,
      dashCooldown: 0, // ready the moment a run starts
      dashCooldownMax: p.dashCooldown,
      dashTime: 0,
      dashDirX: 1,
      dashDirY: 0,
      invuln: 0,
      fireCooldown: 0,
      alive: true,
    };
  }

  mult() {
    return Math.min(CONFIG.combo.maxMult, 1 + Math.floor(this.combo / CONFIG.combo.step));
  }

  startRun() {
    this.makePlayer();
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.enemies = [];
    this.bullets = [];
    this.orbs = [];
    this.particles = [];
    this.shards = [];
    this.texts = [];
    this.gameOver = false;
    this.victory = false;
    this.deathT = 0;
    this.upgradeOffer = null;
    this.upgradesTaken = [];
    this.startWave(1);
  }

  startWave(n) {
    this.wave = n;
    this.spawnQueue = waveComp(this.rng, n);
    this.spawnTimer = 0.8;
    const interval = Math.max(
      CONFIG.waves.spawnIntervalMin,
      CONFIG.waves.spawnInterval - (n - 1) * 0.03,
    );
    this.spawnInterval = interval;
    this.banner = { text: `WAVE ${n}`, sub: n === CONFIG.finalWave ? 'FINAL WAVE — CLEAR THE VOID' : 'HOSTILES INBOUND', t: 2.2 };
  }

  offerUpgrades() {
    const pool = shuffled(this.rng, UPGRADES.slice());
    this.upgradeOffer = pool.slice(0, 3);
    return this.upgradeOffer;
  }

  applyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    def.apply(this.player);
    this.upgradesTaken.push(id);
    this.upgradeOffer = null;
  }

  spawnEnemy(type) {
    const base = ENEMY_TYPES[type];
    const p = this.player;
    const pos = edgePoint(this.rng, W, H, p.x, p.y, CONFIG.waves.spawnSafe);
    const hpBonus = Math.floor((this.wave - 1) / 3);
    const speedMul = 1 + Math.min(0.4, (this.wave - 1) * 0.04);
    this.enemies.push({
      type,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      hp: base.hp + hpBonus,
      maxHp: base.hp + hpBonus,
      radius: base.radius,
      speed: base.speed * speedMul,
      color: base.color,
      shape: base.shape,
      spawnT: 0.35,
      state: 'stalk',
      stateT: range(this.rng, 0.5, 1.1),
      aimX: 0,
      aimY: 0,
      fireT: range(this.rng, 1.2, 2.2),
      angle: 0,
    });
    this.burst(pos.x, pos.y, base.color, 10, 120);
  }

  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 420) this.particles.shift();
      const a = this.rng() * Math.PI * 2;
      const s = range(this.rng, speed * 0.3, speed);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: range(this.rng, 0.3, 0.7),
        maxLife: 0.7,
        size: range(this.rng, 1.5, 3.5),
        color,
      });
    }
  }

  addText(x, y, text, color) {
    this.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  addScore(n, x, y) {
    const gained = n * this.mult();
    this.score += gained;
    if (x !== undefined) this.addText(x, y, `+${gained}`, '#eaf6ff');
    return gained;
  }

  killEnemy(e, award) {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    this.kills++;
    this.combo++;
    this.comboTimer = CONFIG.combo.window;
    const base = ENEMY_TYPES[e.type];
    if (award !== false) this.addScore(base.score, e.x, e.y);
    this.burst(e.x, e.y, e.color, e.type === 'splitter' ? 26 : 16, 220);
    this.shake = Math.min(10, this.shake + (e.type === 'splitter' ? 5 : 2.5));
    if (chance(this.rng, 0.45)) {
      this.shards.push({
        x: e.x, y: e.y,
        vx: range(this.rng, -40, 40),
        vy: range(this.rng, -40, 40),
        value: CONFIG.score.shard,
        life: 9,
      });
    }
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const mini = ENEMY_TYPES.mini;
        this.enemies.push({
          type: 'mini',
          x: e.x + range(this.rng, -14, 14),
          y: e.y + range(this.rng, -14, 14),
          vx: 0, vy: 0,
          hp: mini.hp, maxHp: mini.hp,
          radius: mini.radius,
          speed: mini.speed,
          color: mini.color,
          shape: mini.shape,
          spawnT: 0.2,
          state: 'stalk', stateT: 0.4,
          aimX: 0, aimY: 0, fireT: 0, angle: 0,
        });
      }
    }
  }

  damagePlayer(sound) {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || p.dashTime > 0) return;
    p.lives--;
    p.invuln = CONFIG.player.invulnTime;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 14;
    this.burst(p.x, p.y, '#ff3355', 30, 300);
    if (sound) sound.playerHit();
    if (p.lives <= 0) {
      p.alive = false;
      this.gameOver = true;
      this.deathT = 1.1;
      this.burst(p.x, p.y, '#00f0ff', 60, 380);
      this.burst(p.x, p.y, '#ffffff', 30, 260);
      if (sound) sound.explode(true);
    }
  }

  fireBullet(sound) {
    const p = this.player;
    const aim = Math.atan2(this.aimY - p.y, this.aimX - p.x);
    p.angle = aim;
    const n = p.projectiles;
    const spread = 0.13 * (n - 1);
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const a = aim + off;
      this.bullets.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * p.bulletSpeed,
        vy: Math.sin(a) * p.bulletSpeed,
        damage: p.bulletDamage,
        pierce: p.pierce,
        life: CONFIG.bullets.life,
        hit: new Set(),
      });
    }
    p.fireCooldown = 1 / p.fireRate;
    if (sound) sound.shoot();
  }

  update(dt, input, sound) {
    this.time += dt;
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.shardSoundT -= dt;

    // Spawning.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this.spawnEnemy(this.spawnQueue.shift());
      }
    }

    const p = this.player;
    if (p.alive) {
      // Aim follows the mouse.
      this.aimX = input.mouseX;
      this.aimY = input.mouseY;

      // Dash: Shift, in the move direction (or the aim direction if idle).
      if ((input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) && p.dashCooldown <= 0) {
        const mv = input.moveVector();
        let dx = mv.x;
        let dy = mv.y;
        if (dx === 0 && dy === 0) {
          dx = Math.cos(p.angle);
          dy = Math.sin(p.angle);
        }
        p.dashDirX = dx;
        p.dashDirY = dy;
        p.dashTime = CONFIG.player.dashTime;
        p.dashCooldown = p.dashCooldownMax;
        if (sound) sound.dash();
      }
      p.dashCooldown = Math.max(0, p.dashCooldown - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.fireCooldown -= dt;

      if (p.dashTime > 0) {
        p.dashTime -= dt;
        p.vx = p.dashDirX * CONFIG.player.dashSpeed;
        p.vy = p.dashDirY * CONFIG.player.dashSpeed;
        this.particles.push({
          x: p.x, y: p.y,
          vx: -p.vx * 0.08, vy: -p.vy * 0.08,
          life: 0.25, maxLife: 0.25, size: 3, color: '#00f0ff',
        });
      } else {
        const mv = input.moveVector();
        p.vx = mv.x * p.speed;
        p.vy = mv.y * p.speed;
      }
      p.x = Math.max(p.radius, Math.min(W - p.radius, p.x + p.vx * dt));
      p.y = Math.max(p.radius, Math.min(H - p.radius, p.y + p.vy * dt));
      p.angle = Math.atan2(this.aimY - p.y, this.aimX - p.x);

      if (input.firing() && p.fireCooldown <= 0) this.fireBullet(sound);
    } else if (this.gameOver) {
      this.deathT -= dt;
    }

    this.updateEnemies(dt, sound);
    this.updateBullets(dt, sound);
    this.updateOrbs(dt, sound);
    this.updateShards(dt, sound);
    this.updateParticles(dt);
    this.updateTexts(dt);

    // Wave clear: queue empty and arena empty.
    if (!this.gameOver && !this.victory && this.spawnQueue.length === 0 && this.enemies.length === 0 && p.alive) {
      if (this.wave >= CONFIG.finalWave) {
        this.victory = true;
        if (sound) sound.victory();
      } else {
        this.offerUpgrades();
      }
    }
  }

  updateEnemies(dt, sound) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.spawnT > 0) {
        e.spawnT -= dt;
        continue;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.type === 'darter') {
        e.stateT -= dt;
        if (e.state === 'stalk') {
          e.vx = nx * e.speed;
          e.vy = ny * e.speed;
          if (e.stateT <= 0) { e.state = 'aim'; e.stateT = 0.35; }
        } else if (e.state === 'aim') {
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.aimX = nx;
          e.aimY = ny;
          if (e.stateT <= 0) { e.state = 'dash'; e.stateT = 0.45; }
        } else if (e.state === 'dash') {
          e.vx = e.aimX * ENEMY_TYPES.darter.dashSpeed;
          e.vy = e.aimY * ENEMY_TYPES.darter.dashSpeed;
          if (e.stateT <= 0) { e.state = 'rest'; e.stateT = 0.7; }
        } else {
          e.vx *= 0.92;
          e.vy *= 0.92;
          if (e.stateT <= 0) { e.state = 'stalk'; e.stateT = range(this.rng, 0.6, 1.1); }
        }
      } else if (e.type === 'spitter') {
        // Hold a firing distance, strafe slowly, shoot orbs.
        let mx = 0;
        let my = 0;
        if (dist > 280) { mx = nx; my = ny; }
        else if (dist < 200) { mx = -nx; my = -ny; }
        const strafe = Math.sin(this.time * 1.3 + e.x * 0.05) * 0.6;
        e.vx = (mx + -ny * strafe) * e.speed;
        e.vy = (my + nx * strafe) * e.speed;
        e.fireT -= dt;
        if (e.fireT <= 0 && dist < 480 && p.alive) {
          e.fireT = ENEMY_TYPES.spitter.fireEvery;
          this.orbs.push({
            x: e.x, y: e.y,
            vx: nx * ENEMY_TYPES.spitter.orbSpeed,
            vy: ny * ENEMY_TYPES.spitter.orbSpeed,
            radius: 7,
          });
          this.burst(e.x, e.y, '#9d4edd', 5, 90);
        }
      } else {
        // Drifter, mini, splitter: chase.
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      }
      e.x = Math.max(e.radius, Math.min(W - e.radius, e.x + e.vx * dt));
      e.y = Math.max(e.radius, Math.min(H - e.radius, e.y + e.vy * dt));
      e.angle = Math.atan2(e.vy, e.vx);

      // Touching the player hurts.
      if (p.alive && p.invuln <= 0 && p.dashTime <= 0) {
        const rr = e.radius + p.radius - 2;
        if (dist < rr) {
          this.damagePlayer(sound);
          // Knock the enemy back so one touch is one hit.
          e.x -= nx * 26;
          e.y -= ny * 26;
        }
      }
    }
  }

  updateBullets(dt, sound) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20;
      if (!dead) {
        for (const e of this.enemies.slice()) {
          if (e.spawnT > 0 || b.hit.has(e)) continue;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const rr = e.radius + CONFIG.bullets.radius;
          if (dx * dx + dy * dy < rr * rr) {
            b.hit.add(e);
            e.hp -= b.damage;
            this.burst(b.x, b.y, e.color, 5, 130);
            if (sound) sound.enemyHit();
            if (e.hp <= 0) {
              this.killEnemy(e, true);
              if (sound) sound.explode(e.type === 'splitter' || e.type === 'spitter');
            }
            if (b.pierce > 0) {
              b.pierce--;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  updateOrbs(dt, sound) {
    const p = this.player;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      let dead = o.x < -20 || o.x > W + 20 || o.y < -20 || o.y > H + 20;
      if (!dead && p.alive) {
        const dx = p.x - o.x;
        const dy = p.y - o.y;
        const rr = p.radius + o.radius - 2;
        if (dx * dx + dy * dy < rr * rr) {
          dead = true;
          this.damagePlayer(sound);
        }
      }
      if (dead) this.orbs.splice(i, 1);
    }
  }

  updateShards(dt, sound) {
    const p = this.player;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.96;
      s.vy *= 0.96;
      if (p.alive) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < p.magnet) {
          const pull = 420 * (1 - dist / (p.magnet + 1)) + 120;
          s.vx += (dx / dist) * pull * dt * 4;
          s.vy += (dy / dist) * pull * dt * 4;
        }
        if (dist < p.radius + 10) {
          this.addScore(s.value, s.x, s.y);
          if (sound && this.shardSoundT <= 0) {
            sound.shard();
            this.shardSoundT = 0.06;
          }
          this.shards.splice(i, 1);
          continue;
        }
      }
      if (s.life <= 0) this.shards.splice(i, 1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.985;
      pt.vy *= 0.985;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
  }

  updateTexts(dt) {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }
}
