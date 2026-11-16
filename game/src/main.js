// NEON VOID — entry point and game loop.
// One job: own the canvas, the clock and the state machine (title, play,
// upgrade, game over, victory, pause), and wire input, world, render and
// ui together. It also owns the deterministic shot scenes: with
// ?shot=start|play|upgrade|end&seed=N the game renders exactly one fixed
// scene, so screenshots are reproducible.

import { CONFIG } from './config.js';
import { World } from './world.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { drawWorld, drawBackground } from './render.js';
import { drawTitle, drawUpgrade, drawEnd, drawPause } from './ui.js';

const W = CONFIG.width;
const H = CONFIG.height;
const STEP = 1 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Crisp on hidpi: back the canvas at device pixels, draw in logical ones.
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = W * dpr;
canvas.height = H * dpr;

function fitCanvas() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

const input = new Input(canvas, toLogical);
const sound = new SoundBank();

let best = 0;
try {
  best = Number(window.localStorage.getItem('neonvoid.best') || 0) || 0;
} catch (e) {
  best = 0;
}

function saveBest() {
  try {
    window.localStorage.setItem('neonvoid.best', String(best));
  } catch (e) {
    // Private mode or no storage: the session best still shows.
  }
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;

// ---------------------------------------------------------------- shots
// A scripted stand-in for the player's hands: aims at the nearest enemy,
// strafes in a slow circle and holds fire. Deterministic, so a seeded run
// always paints the same frame.
class ScriptedInput {
  constructor() {
    this.mouseX = W / 2;
    this.mouseY = 120;
    this._mv = { x: 0, y: 0 };
  }
  moveVector() {
    return this._mv;
  }
  firing() {
    return true;
  }
  wasPressed() {
    return false;
  }
  takeClick() {
    return null;
  }
  endFrame() {}
}

function simulate(world, steps) {
  const scripted = new ScriptedInput();
  for (let i = 0; i < steps; i++) {
    const p = world.player;
    // Strafe in a slow circle.
    const a = i * 0.021;
    scripted._mv = { x: Math.cos(a) * 0.8, y: Math.sin(a) * 0.8 };
    // Aim at the nearest live enemy, else at the centre of the arena.
    let target = null;
    let bestDist = Infinity;
    for (const e of world.enemies) {
      if (e.spawnT > 0) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        target = e;
      }
    }
    if (target) {
      scripted.mouseX = target.x;
      scripted.mouseY = target.y;
    } else {
      scripted.mouseX = W / 2 + Math.cos(i * 0.05) * 200;
      scripted.mouseY = H / 2 + Math.sin(i * 0.05) * 120;
    }
    world.update(STEP, scripted, null);
    if (world.upgradeOffer) break;
  }
}

function renderShot(kind) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fixedTime = 1.0;
  const mouse = { x: -100, y: -100 };
  if (kind === 'start') {
    drawTitle(ctx, fixedTime, 2850, mouse);
    return;
  }
  const world = new World(seed);
  world.startRun();
  if (kind === 'play') {
    world.startWave(4);
    world.score = 1250;
    world.combo = 3;
    world.comboTimer = 2.0;
    simulate(world, 300);
    drawWorld(ctx, world, fixedTime);
    return;
  }
  if (kind === 'upgrade') {
    world.startWave(2);
    world.score = 2140;
    simulate(world, 200);
    world.enemies.length = 0;
    world.spawnQueue.length = 0;
    world.update(STEP, new ScriptedInput(), null);
    drawWorld(ctx, world, fixedTime, false);
    drawUpgrade(ctx, world, fixedTime, mouse);
    return;
  }
  if (kind === 'end') {
    world.startWave(4);
    simulate(world, 180);
    world.player.alive = false;
    world.player.lives = 0;
    world.gameOver = true;
    world.deathT = 0;
    world.score = 2850;
    world.wave = 4;
    world.kills = 37;
    drawWorld(ctx, world, fixedTime);
    drawEnd(ctx, world, 2850, false);
    return;
  }
  drawTitle(ctx, fixedTime, 2850, mouse);
}

// Shot mode renders one frozen frame and stops: no loop, no audio.
if (shot) {
  document.title = `NEON VOID — ${shot}`;
  renderShot(shot);
} else {
  startLiveGame();
}

// ---------------------------------------------------------------- live game
function startLiveGame() {
  let world = new World((Math.random() * 0xffffffff) >>> 0);
  let state = 'title';
  let paused = false;
  let titleRects = null;
  let upgradeRects = null;
  let endRects = null;
  let time = 0;
  let acc = 0;
  let last = performance.now();

  window.addEventListener('keydown', () => sound.ensure());
  canvas.addEventListener('mousedown', () => sound.ensure());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') paused = true;
  });

  function startRun() {
    world = new World((Math.random() * 0xffffffff) >>> 0);
    world.startRun();
    state = 'playing';
    paused = false;
    sound.ensure();
    sound.startPulse();
    sound.waveStart();
  }

  function endRun(victory) {
    state = victory ? 'victory' : 'gameover';
    sound.stopPulse();
    if (victory) sound.victory();
    else sound.gameOver();
    if (world.score > best) {
      best = world.score;
      saveBest();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // Global keys.
    if (input.wasPressed('KeyM')) {
      sound.ensure();
      sound.toggleMute();
    }

    if (state === 'title') {
      time += dt;
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        sound.click();
        startRun();
      } else {
        const click = input.takeClick();
        if (click && titleRects && click.x >= titleRects.start.x && click.x <= titleRects.start.x + titleRects.start.w
          && click.y >= titleRects.start.y && click.y <= titleRects.start.y + titleRects.start.h) {
          sound.click();
          startRun();
        }
      }
    } else if (state === 'playing') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        paused = !paused;
        sound.click();
      }
      if (!paused) {
        acc += dt;
        let steps = 0;
        while (acc >= STEP && steps < 5) {
          world.update(STEP, input, sound);
          acc -= STEP;
          steps++;
          time += STEP;
        }
        if (world.upgradeOffer) {
          state = 'upgrade';
          sound.upgrade();
        } else if (world.victory) {
          endRun(true);
        } else if (world.gameOver && world.deathT <= 0) {
          endRun(false);
        }
      }
    } else if (state === 'upgrade') {
      time += dt;
      const cards = world.upgradeOffer || [];
      let picked = null;
      if (input.wasPressed('Digit1')) picked = cards[0];
      if (input.wasPressed('Digit2')) picked = cards[1];
      if (input.wasPressed('Digit3')) picked = cards[2];
      const click = input.takeClick();
      if (click && upgradeRects) {
        for (const r of upgradeRects) {
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
            picked = cards.find((c) => c.id === r.id);
          }
        }
      }
      if (picked) {
        world.applyUpgrade(picked.id);
        world.startWave(world.wave + 1);
        state = 'playing';
        sound.waveStart();
      }
    } else if (state === 'gameover' || state === 'victory') {
      time += dt;
      if (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.wasPressed('Space')) {
        sound.click();
        startRun();
      } else {
        const click = input.takeClick();
        if (click && endRects && click.x >= endRects.retry.x && click.x <= endRects.retry.x + endRects.retry.w
          && click.y >= endRects.retry.y && click.y <= endRects.retry.y + endRects.retry.h) {
          sound.click();
          startRun();
        }
      }
    }

    // Draw.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const mouse = { x: input.mouseX, y: input.mouseY };
    if (state === 'title') {
      titleRects = drawTitle(ctx, time, best, mouse);
    } else if (state === 'playing') {
      drawWorld(ctx, world, time);
      if (paused) drawPause(ctx);
    } else if (state === 'upgrade') {
      drawWorld(ctx, world, time, false);
      upgradeRects = drawUpgrade(ctx, world, time, mouse);
    } else if (state === 'gameover') {
      drawWorld(ctx, world, time);
      endRects = drawEnd(ctx, world, best, false);
    } else if (state === 'victory') {
      drawWorld(ctx, world, time);
      endRects = drawEnd(ctx, world, best, true);
    } else {
      drawBackground(ctx, time);
    }
    input.endFrame();
  }

  // Read-only handle for automated play-testing; harmless in the shipped game.
  window.__neonvoid = {
    get state() { return state; },
    get paused() { return paused; },
    get score() { return world.score; },
    get wave() { return world.wave; },
    get lives() { return world.player.lives; },
    get hostiles() { return world.enemies.length + world.spawnQueue.length; },
    get combo() { return world.combo; },
    get dashReady() { return world.player.dashCooldown <= 0; },
    get player() { return { x: world.player.x, y: world.player.y }; },
    get enemies() {
      return world.enemies
        .filter((e) => e.spawnT <= 0)
        .map((e) => ({ x: e.x, y: e.y, type: e.type }));
    },
  };

  requestAnimationFrame(frame);
}
