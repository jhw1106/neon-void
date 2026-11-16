// NEON VOID — canvas rendering.
// One job: draw the world. It reads the world and never mutates it, so the
// same frame can be drawn again and again. All art is drawn shapes and
// gradients — no images, no fonts loaded from anywhere.

import { CONFIG } from './config.js';
import { mulberry32, range } from './rng.js';

const W = CONFIG.width;
const H = CONFIG.height;
const C = CONFIG.palette;

// A fixed starfield: same seed every run, so the backdrop is stable.
const stars = (() => {
  const rng = mulberry32(1337);
  const list = [];
  for (let i = 0; i < 90; i++) {
    list.push({
      x: range(rng, 0, W),
      y: range(rng, 0, H),
      r: range(rng, 0.6, 2.0),
      tw: range(rng, 0, Math.PI * 2),
      c: rng() < 0.7 ? '#cfe8ff' : rng() < 0.5 ? '#00f0ff' : '#ff2d95',
    });
  }
  return list;
})();

let vignette = null;

export function drawBackground(ctx, time) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg);
  g.addColorStop(1, C.bgEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Grid, brighter near the centre line.
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 40; x < W; x += 40) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 40; y < H; y += 40) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.strokeStyle = C.gridBright;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Twinkling stars.
  for (const s of stars) {
    const a = 0.35 + 0.35 * Math.sin(time * 1.4 + s.tw);
    ctx.globalAlpha = a;
    ctx.fillStyle = s.c;
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // Arena border.
  ctx.strokeStyle = C.cyan;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.globalAlpha = 1;
}

export function drawShape(ctx, shape, x, y, r, angle) {
  ctx.beginPath();
  if (shape === 'diamond') {
    ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    ctx.lineTo(x + Math.cos(angle + Math.PI / 2) * r * 0.72, y + Math.sin(angle + Math.PI / 2) * r * 0.72);
    ctx.lineTo(x + Math.cos(angle + Math.PI) * r, y + Math.sin(angle + Math.PI) * r);
    ctx.lineTo(x + Math.cos(angle - Math.PI / 2) * r * 0.72, y + Math.sin(angle - Math.PI / 2) * r * 0.72);
    ctx.closePath();
  } else if (shape === 'triangle') {
    for (let i = 0; i < 3; i++) {
      const a = angle + (i * Math.PI * 2) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const a = angle + (i * Math.PI) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    // square
    ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  }
}

function drawHeart(ctx, x, y, s, color, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 10, s / 10);
  ctx.beginPath();
  ctx.moveTo(0, 3);
  ctx.bezierCurveTo(-7, -4, -3, -9, 0, -5);
  ctx.bezierCurveTo(3, -9, 7, -4, 0, 3);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawWorld(ctx, world, time, showHud = true) {
  ctx.save();
  if (world.shake > 0.3) {
    // Deterministic jitter: a pure function of time, so a frozen frame
    // renders identically every run while live play still shakes.
    const m = world.shake;
    ctx.translate(Math.sin(time * 91.7) * m, Math.cos(time * 113.3) * m);
  }
  drawBackground(ctx, time);

  // Score shards.
  for (const s of world.shards) {
    const pulse = 0.7 + 0.3 * Math.sin(time * 6 + s.x);
    ctx.save();
    ctx.globalAlpha = Math.min(1, s.life / 2) * pulse;
    ctx.translate(s.x, s.y);
    ctx.rotate(time * 2 + s.x);
    ctx.fillStyle = C.green;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }

  // Enemy orbs.
  for (const o of world.orbs) {
    const pulse = 1 + 0.15 * Math.sin(time * 8);
    ctx.save();
    ctx.shadowColor = C.purple;
    ctx.shadowBlur = 14;
    ctx.fillStyle = C.purple;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.radius * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemies.
  for (const e of world.enemies) {
    const scaleIn = e.spawnT > 0 ? 1 - e.spawnT / 0.35 : 1;
    const r = e.radius * Math.max(0.2, scaleIn);
    ctx.save();
    if (e.spawnT > 0) ctx.globalAlpha = 0.45 + 0.55 * scaleIn;
    // Darter telegraph: a faint aim line while it locks on.
    if (e.type === 'darter' && e.state === 'aim' && world.player.alive) {
      ctx.strokeStyle = e.color;
      ctx.globalAlpha = 0.35;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(world.player.x, world.player.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = e.color;
    ctx.fillStyle = e.color;
    ctx.lineWidth = 2;
    const ang = e.type === 'darter' ? e.angle : time * 0.8;
    drawShape(ctx, e.shape, e.x, e.y, r, ang);
    if (e.type === 'spitter' || e.type === 'splitter') {
      ctx.globalAlpha *= 0.85;
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    // Inner core.
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(e.x, e.y, Math.max(2, r * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // HP bar for tough enemies.
    if (e.maxHp > 1 && e.spawnT <= 0) {
      const bw = e.radius * 1.6;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw, 3);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - bw / 2, e.y - e.radius - 9, bw * (e.hp / e.maxHp), 3);
    }
  }

  // Player bullets.
  for (const b of world.bullets) {
    ctx.save();
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player ship.
  const p = world.player;
  if (p.alive) {
    const blink = p.invuln > 0 && Math.floor(time * 14) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 18;
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-11, -11);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, 11);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#062a33';
    ctx.beginPath();
    ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Dash cooldown ring.
    const frac = 1 - p.dashCooldown / p.dashCooldownMax;
    if (frac < 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0,240,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Particles.
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Floating score text.
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = '700 15px "Courier New", monospace';
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // Vignette.
  if (!vignette) {
    vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,10,0.55)');
  }
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  ctx.restore();

  if (showHud) drawHUD(ctx, world);
  if (world.banner) drawBanner(ctx, world.banner);
}

export function drawHUD(ctx, world) {
  const p = world.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Score.
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('SCORE', 20, 30);
  ctx.font = '700 28px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(String(world.score).padStart(6, '0'), 20, 58);

  // Combo.
  if (world.combo >= 2) {
    const mult = world.mult();
    ctx.font = '700 16px "Courier New", monospace';
    ctx.fillStyle = mult >= 4 ? C.yellow : C.cyan;
    ctx.fillText(`COMBO x${mult}  (${world.combo})`, 20, 82);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(20, 88, 120, 4);
    ctx.fillStyle = mult >= 4 ? C.yellow : C.cyan;
    ctx.fillRect(20, 88, 120 * (world.comboTimer / CONFIG.combo.window), 4);
  }

  // Wave, centre.
  ctx.textAlign = 'center';
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('WAVE', W / 2, 30);
  ctx.font = '700 28px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(`${world.wave} / ${CONFIG.finalWave}`, W / 2, 58);
  const hostiles = world.enemies.length + world.spawnQueue.length;
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = hostiles > 0 ? C.magenta : C.green;
  ctx.fillText(hostiles > 0 ? `HOSTILES ${hostiles}` : 'CLEAR', W / 2, 80);

  // Lives, right.
  ctx.textAlign = 'right';
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('LIVES', W - 20, 30);
  for (let i = 0; i < p.maxLives; i++) {
    drawHeart(ctx, W - 32 - i * 26, 48, 11, C.red, i < p.lives);
  }

  // Dash readiness, bottom centre.
  const frac = 1 - p.dashCooldown / p.dashCooldownMax;
  ctx.textAlign = 'center';
  ctx.font = '700 11px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('DASH [SHIFT]', W / 2, H - 26);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(W / 2 - 60, H - 20, 120, 4);
  ctx.fillStyle = frac >= 1 ? C.cyan : C.dim;
  ctx.fillRect(W / 2 - 60, H - 20, 120 * frac, 4);
  ctx.textAlign = 'left';
}

export function drawBanner(ctx, banner) {
  const a = Math.min(1, banner.t / 0.6) * Math.min(1, (2.2 - banner.t) / 0.25 + 0.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.textAlign = 'center';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 24;
  ctx.font = '700 52px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(banner.text, W / 2, H / 2 - 8);
  ctx.shadowBlur = 0;
  ctx.font = '700 16px "Courier New", monospace';
  ctx.fillStyle = C.cyan;
  ctx.fillText(banner.sub, W / 2, H / 2 + 24);
  ctx.restore();
}
