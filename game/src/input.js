// EMBERFALL — keyboard + mouse state.
// Tracks held keys, edge-triggered presses (consumed on read, so a press
// can never fire twice across fixed-timestep substeps), mouse position,
// held mouse button, and a queue of clicks for UI buttons / cards.

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight',
  'KeyP', 'Escape', 'KeyM', 'KeyR', 'Enter',
  'Digit1', 'Digit2', 'Digit3',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set(); // currently held (e.code)
    this.justPressed = new Set(); // edge presses, cleared by wasPressed()/endFrame()
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.clicks = []; // queued {x, y} clicks, consumed by the game
    this.anyInteraction = false;

    this._onKeyDown = (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.justPressed.add(e.code);
      this.keys.add(e.code);
      this.anyInteraction = true;
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this._onMouseMove = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    };
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this.clicks.push({ x: this.mouseX, y: this.mouseY });
      this.anyInteraction = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    this._onContext = (e) => e.preventDefault();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  // True while the key is held down.
  isDown(code) {
    return this.keys.has(code);
  }

  // True exactly once per physical press (consumes the press).
  wasPressed(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  // Drain and return all queued clicks.
  takeClicks() {
    const out = this.clicks;
    this.clicks = [];
    return out;
  }

  // Called once per rendered frame: drops any unhandled edge presses.
  endFrame() {
    this.justPressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}

// Point-in-rect helper used by UI hit testing.
export function inRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
