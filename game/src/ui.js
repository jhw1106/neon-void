// NEON VOID — screens: title, upgrade choice, end, pause.
// One job: everything that is not the live arena. Each draw function
// returns the clickable rectangles it painted, so main.js can route a
// click without knowing how a screen looks. Panels are drawn over the
// arena (which main.js draws first, dimmed where the screen asks for it).

import { CONFIG } from './config.js';
import { drawBackground, drawShape } from './render.js';

const W = CONFIG.width;
const H = CONFIG.height;
const C = CONFIG.palette;

function panel(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(5, 8, 24, ${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = C.cyan;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function button(ctx, rect, label, accent, hover) {
  ctx.save();
  ctx.fillStyle = hover ? accent : 'rgba(0,240,255,0.08)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.fillStyle = hover ? '#05060f' : accent;
  ctx.font = '700 18px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6);
  ctx.restore();
}

function inside(rect, x, y) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function drawTitle(ctx, time, best, mouse) {
  drawBackground(ctx, time);
  // A few decorative hostiles drifting across the title.
  const decoys = [
    { shape: 'diamond', color: C.magenta, x: 150, y: 150, r: 22, sp: 0.5 },
    { shape: 'triangle', color: C.yellow, x: 810, y: 130, r: 18, sp: -0.7 },
    { shape: 'hexagon', color: C.purple, x: 830, y: 470, r: 20, sp: 0.4 },
    { shape: 'square', color: C.orange, x: 130, y: 460, r: 20, sp: -0.5 },
  ];
  for (const d of decoys) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    drawShape(ctx, d.shape, d.x + Math.sin(time * 0.6 + d.x) * 12, d.y, d.r, time * d.sp);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 32;
  ctx.font = '700 84px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText('NEON VOID', W / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = '700 20px "Courier New", monospace';
  ctx.fillStyle = C.cyan;
  ctx.fillText('— ARENA ROGUELITE —', W / 2, 228);

  ctx.font = '16px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('Survive the waves. Chain kills into combos.', W / 2, 272);
  ctx.fillText('Pick an upgrade after every wave. Clear wave 10 to win.', W / 2, 296);

  ctx.font = '700 15px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText('WASD / ARROWS — MOVE      MOUSE — AIM', W / 2, 348);
  ctx.fillText('HOLD CLICK / SPACE — FIRE      SHIFT — DASH', W / 2, 372);
  ctx.fillStyle = C.dim;
  ctx.fillText('P — PAUSE      M — MUTE', W / 2, 396);

  if (best > 0) {
    ctx.font = '700 16px "Courier New", monospace';
    ctx.fillStyle = C.yellow;
    ctx.fillText(`BEST SCORE  ${best}`, W / 2, 436);
  }

  const btn = { x: W / 2 - 130, y: 468, w: 260, h: 52 };
  const hover = inside(btn, mouse.x, mouse.y);
  const pulse = 0.75 + 0.25 * Math.sin(time * 4);
  ctx.save();
  ctx.globalAlpha = pulse;
  button(ctx, btn, '▶  START', C.cyan, hover);
  ctx.restore();
  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('or press ENTER', W / 2, 552);
  ctx.restore();
  return { start: btn };
}

export function drawUpgrade(ctx, world, time, mouse) {
  // Dim the arena behind the cards.
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 12, 0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = C.cyan;
  ctx.shadowBlur = 20;
  ctx.font = '700 40px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(`WAVE ${world.wave} CLEARED`, W / 2, 108);
  ctx.shadowBlur = 0;
  ctx.font = '700 17px "Courier New", monospace';
  ctx.fillStyle = C.cyan;
  ctx.fillText('CHOOSE ONE UPGRADE', W / 2, 140);
  ctx.restore();

  const cards = world.upgradeOffer || [];
  const cw = 230;
  const ch = 190;
  const gap = 26;
  const total = cards.length * cw + (cards.length - 1) * gap;
  const x0 = (W - total) / 2;
  const y0 = 190;
  const rects = [];
  cards.forEach((card, i) => {
    const x = x0 + i * (cw + gap);
    const rect = { x, y: y0, w: cw, h: ch, id: card.id };
    const hover = inside(rect, mouse.x, mouse.y);
    ctx.save();
    ctx.fillStyle = hover ? 'rgba(0,240,255,0.12)' : 'rgba(8, 12, 34, 0.92)';
    ctx.fillRect(x, y0, cw, ch);
    ctx.strokeStyle = hover ? card.color : 'rgba(139,147,184,0.55)';
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.strokeRect(x, y0, cw, ch);
    if (hover) {
      ctx.shadowColor = card.color;
      ctx.shadowBlur = 18;
      ctx.strokeRect(x, y0, cw, ch);
      ctx.shadowBlur = 0;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = card.color;
    ctx.font = '700 13px "Courier New", monospace';
    ctx.fillText(`[ ${i + 1} ]`, x + cw / 2, y0 + 34);
    ctx.fillStyle = C.white;
    ctx.font = '700 19px "Courier New", monospace';
    wrapText(ctx, card.name, x + cw / 2, y0 + 66, cw - 28, 22);
    ctx.fillStyle = C.dim;
    ctx.font = '15px "Courier New", monospace';
    wrapText(ctx, card.desc, x + cw / 2, y0 + 116, cw - 28, 20);
    ctx.restore();
    rects.push(rect);
  });

  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '15px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('Click a card, or press 1 / 2 / 3', W / 2, y0 + ch + 44);
  ctx.fillText(`SCORE ${world.score}   —   NEXT: WAVE ${world.wave + 1}`, W / 2, y0 + ch + 70);
  ctx.restore();
  return rects;
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  const lines = [''];
  for (const word of words) {
    const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(test).width > maxW && lines[lines.length - 1]) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = test;
    }
  }
  lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineH));
}

export function drawEnd(ctx, world, best, victory) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 12, 0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  const accent = victory ? C.yellow : C.red;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 28;
  ctx.font = '700 58px "Courier New", monospace';
  ctx.fillStyle = victory ? C.yellow : C.red;
  ctx.fillText(victory ? 'VOID CLEARED' : 'GAME OVER', W / 2, 150);
  ctx.shadowBlur = 0;
  ctx.font = '700 17px "Courier New", monospace';
  ctx.fillStyle = C.cyan;
  ctx.fillText(
    victory ? 'You survived all ten waves. The void is yours.' : 'The void takes another pilot.',
    W / 2,
    186,
  );

  // Score panel.
  panel(ctx, W / 2 - 210, 220, 420, 170, 0.85);
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('FINAL SCORE', W / 2, 250);
  ctx.font = '700 46px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText(String(world.score).padStart(6, '0'), W / 2, 300);
  ctx.font = '16px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText(`WAVE REACHED  ${world.wave}    KILLS  ${world.kills}`, W / 2, 332);
  ctx.fillStyle = world.score >= best && world.score > 0 ? C.yellow : C.dim;
  ctx.font = '700 16px "Courier New", monospace';
  ctx.fillText(
    world.score >= best && world.score > 0 ? '★ NEW BEST ★' : `BEST  ${best}`,
    W / 2,
    364,
  );

  const btn = { x: W / 2 - 130, y: 428, w: 260, h: 52 };
  button(ctx, btn, '↻  PLAY AGAIN', C.cyan, false);
  ctx.font = '13px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('or press R', W / 2, 512);
  ctx.restore();
  return { retry: btn };
}

export function drawPause(ctx) {
  ctx.save();
  ctx.fillStyle = 'rgba(3, 4, 12, 0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = '700 44px "Courier New", monospace';
  ctx.fillStyle = C.white;
  ctx.fillText('PAUSED', W / 2, H / 2 - 6);
  ctx.font = '16px "Courier New", monospace';
  ctx.fillStyle = C.dim;
  ctx.fillText('Press P to resume', W / 2, H / 2 + 28);
  ctx.restore();
}
