// NEON VOID — keyboard and mouse input.
// One job: turn browser events into game state. The game reads keys by
// code (WASD and arrows move, Space fires, Shift dashes, P pauses, M
// mutes, R restarts, 1/2/3 pick an upgrade card) and the mouse position in
// logical arena coordinates. Clicks are queued so a single click is only
// ever spent once, by whichever screen is showing.

export class Input {
  constructor(canvas, toLogical) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: cleared after each update
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicks = [];
    this.toLogical = toLogical; // (clientX, clientY) -> {x, y} in arena space

    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e.clientX, e.clientY);
      this.mouseX = p.x;
      this.mouseY = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        const p = this.toLogical(e.clientX, e.clientY);
        this.mouseX = p.x;
        this.mouseY = p.y;
        this.clicks.push({ x: p.x, y: p.y });
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    // Never lose the pointer outside the window mid-drag.
    canvas.addEventListener('mouseleave', () => { this.mouseDown = false; });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement vector from WASD or arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  firing() {
    return this.mouseDown || this.down('Space');
  }

  // Take the oldest queued click, or null. Buttons consume clicks.
  takeClick() {
    return this.clicks.shift() || null;
  }

  // Call at the end of each frame: edge triggers live one frame only.
  endFrame() {
    this.pressed.clear();
  }
}
