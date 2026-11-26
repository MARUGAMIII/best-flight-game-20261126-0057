// Skyline Courier — input.
// One job: read the keyboard and the mouse into one small state object
// the flight model and the menus consume. No game logic lives here.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed by the loop
    this.mouse = { x: 0, y: 0, clicked: false, down: false };
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouse.down = true;
      this.mouse.clicked = true;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
    });
    window.addEventListener('mouseup', () => {
      this.mouse.down = false;
    });
  }

  down(key) {
    return this.keys.has(key);
  }

  // True once per physical press; the main loop clears it every frame.
  wasPressed(key) {
    return this.pressed.has(key);
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  // Flight stick: pitch up positive, bank right positive, throttle -1..1.
  flightStick() {
    let pitch = 0;
    let bank = 0;
    if (this.down('arrowup')) pitch += 1;
    if (this.down('arrowdown')) pitch -= 1;
    if (this.down('arrowleft')) bank -= 1;
    if (this.down('arrowright')) bank += 1;
    let throttleDelta = 0;
    if (this.down('w')) throttleDelta += 55;
    if (this.down('s')) throttleDelta -= 55;
    return { pitch, bank, throttleDelta };
  }
}
