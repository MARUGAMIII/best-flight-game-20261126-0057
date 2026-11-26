// Skyline Courier — the renderer.
// One job: turn the world into a picture. A Comanche-style voxel-space
// terrain march into a small buffer (upscaled soft), then the plane, the
// rings, the runway lights and the clouds drawn crisp on top.

import { VIEW, PALETTE } from './config.js';
import { packColor } from './terrain.js';

const DEG = Math.PI / 180;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export class Renderer {
  constructor(canvas, terrain, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.terrain = terrain;
    this.world = world;
    this.bw = VIEW.bufferWidth;
    this.bh = VIEW.bufferHeight;
    this.focal = (this.bw / 2) / Math.tan((VIEW.fov / 2) * DEG);
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.bw;
    this.bufferCanvas.height = this.bh;
    this.bufferCtx = this.bufferCanvas.getContext('2d');
    this.image = this.bufferCtx.createImageData(this.bw, this.bh);
    this.pixels = new Uint32Array(this.image.data.buffer);
    this.ybuf = new Float32Array(this.bw);
    this.haze = hexRgb(PALETTE.haze);
    this.cam = { x: 0, y: 30, z: 0, heading: 90, pitch: 0 };
    this.camSmooth = { x: 0, y: 30, z: 0, heading: 90, pitch: 0 };
    this.cloudSprites = this.makeCloudSprites();
    this.skyTop = hexRgb(PALETTE.skyTop);
    this.skyMid = hexRgb(PALETTE.skyMid);
    this.skyHorizon = hexRgb(PALETTE.skyHorizon);
  }

  makeCloudSprites() {
    const sprites = [];
    for (let v = 0; v < 3; v++) {
      const c = document.createElement('canvas');
      c.width = 220;
      c.height = 90;
      const g = c.getContext('2d');
      const puffs = [
        [60, 55, 42],
        [110, 45, 52],
        [165, 58, 40],
        [85, 62, 36],
        [140, 64, 34],
      ];
      for (const [x, y, r] of puffs) {
        const grad = g.createRadialGradient(x, y, 2, x, y, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.92)');
        grad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      sprites.push(c);
    }
    return sprites;
  }

  // Chase camera: behind and above the plane, eased so it never fights.
  updateCamera(flight, dt) {
    const hRad = flight.heading * DEG;
    const tx = flight.x - Math.sin(hRad) * VIEW.chaseDistance;
    const tz = flight.z - Math.cos(hRad) * VIEW.chaseDistance;
    const ty = flight.y + VIEW.chaseHeight;
    const k = Math.min(1, 4.5 * dt);
    this.camSmooth.x += (tx - this.camSmooth.x) * k;
    this.camSmooth.z += (tz - this.camSmooth.z) * k;
    this.camSmooth.y += (ty - this.camSmooth.y) * k;
    // Heading eases the short way around the compass.
    let dh = flight.heading - this.camSmooth.heading;
    while (dh > 180) dh -= 360;
    while (dh < -180) dh += 360;
    this.camSmooth.heading += dh * Math.min(1, 3.5 * dt);
    this.camSmooth.pitch +=
      (flight.pitch * 0.35 - 3.5 - this.camSmooth.pitch) *
      Math.min(1, 3 * dt);
    this.cam.x = this.camSmooth.x;
    this.cam.y = this.camSmooth.y;
    this.cam.z = this.camSmooth.z;
    this.cam.heading = (this.camSmooth.heading + 360) % 360;
    this.cam.pitch = this.camSmooth.pitch;
  }

  // World point -> screen point on the display canvas, or null if behind.
  project(x, y, z) {
    const hRad = this.cam.heading * DEG;
    const fx = Math.sin(hRad);
    const fz = Math.cos(hRad);
    const rx = fz;
    const rz = -fx;
    const dx = x - this.cam.x;
    const dy = y - this.cam.y;
    const dz = z - this.cam.z;
    const depth = dx * fx + dz * fz;
    if (depth < 2) return null;
    const right = dx * rx + dz * rz;
    // Camera looks slightly down with pitch; up component includes it.
    const pRad = this.cam.pitch * DEG;
    const up = dy * Math.cos(pRad) + depth * Math.sin(pRad);
    const fwd = depth * Math.cos(pRad) - dy * Math.sin(pRad);
    if (fwd < 2) return null;
    const scale = (this.canvas.width / this.bw) * this.focal;
    const sx = this.canvas.width / 2 + (right / fwd) * scale;
    const horizon =
      this.canvas.height / 2 - Math.tan(pRad) * scale;
    const sy = horizon - (up / fwd) * scale;
    return { x: sx, y: sy, depth };
  }

  horizonY() {
    const pRad = this.cam.pitch * DEG;
    const scale = (this.canvas.width / this.bw) * this.focal;
    return this.canvas.height / 2 - Math.tan(pRad) * scale;
  }

  renderSky(time) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const hy = this.horizonY();
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(hy + 40, H));
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(0.55, PALETTE.skyMid);
    grad.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // Sun: fixed in the west, so it sits left when flying east.
    const sun = this.project(
      this.cam.x - 2600,
      this.cam.y + 500,
      this.cam.z + 200,
    );
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,179,71,0.55)');
      glow.addColorStop(1, 'rgba(255,179,71,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 130, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.sunCore;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    // Clouds, pre-rendered sprites.
    for (let i = 0; i < this.world.clouds.length; i++) {
      const c = this.world.clouds[i];
      const p = this.project(c.x, c.y, c.z);
      if (!p || p.y > hy + 30) continue;
      const s = (c.size / p.depth) * (this.canvas.width / this.bw) * this.focal;
      if (s < 8 || s > 900) continue;
      const sprite = this.cloudSprites[i % 3];
      ctx.globalAlpha = 0.85;
      ctx.drawImage(sprite, p.x - s / 2, p.y - s * 0.2, s, s * 0.41);
    }
    ctx.globalAlpha = 1;
    void time;
  }

  renderTerrain() {
    const bw = this.bw;
    const bh = this.bh;
    const pix = this.pixels;
    pix.fill(0);
    this.ybuf.fill(bh);
    const cam = this.cam;
    const pRad = cam.pitch * DEG;
    const horizon = bh / 2 - Math.tan(pRad) * this.focal;
    const terrain = this.terrain;
    const cells = terrain.cells;
    const heights = terrain.heights;
    const colors = terrain.colors;
    const cellSize = terrain.cell;
    const haze = this.haze;
    const headingRad = cam.heading * DEG;
    const sinH = Math.sin(headingRad);
    const cosH = Math.cos(headingRad);

    for (let sx = 0; sx < bw; sx++) {
      const angle = headingRad + ((sx - bw / 2) / this.focal);
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      let t = 6;
      while (t < VIEW.farDistance) {
        const wx = cam.x + dx * t;
        const wz = cam.z + dz * t;
        let col;
        let h;
        if (wx < 0 || wz < 0 || wx >= terrain.size || wz >= terrain.size) {
          h = -7;
          col = packColor(29, 78, 137);
        } else {
          const ix = Math.min(cells - 1, (wx / cellSize) | 0);
          const iz = Math.min(cells - 1, (wz / cellSize) | 0);
          const idx = iz * cells + ix;
          h = heights[idx];
          col = colors[idx];
        }
        const y = horizon - ((h - cam.y) * this.focal) / t;
        const yTop = this.ybuf[sx];
        if (y < yTop) {
          // Fog toward the haze colour by distance — capped low so the
          // sea and the far islands keep their colour instead of washing
          // out to grey.
          const fog = Math.min(0.55, t / 1200);
          const r = (col & 255) + ((haze[0] - (col & 255)) * fog) | 0;
          const g = ((col >> 8) & 255) + ((haze[1] - ((col >> 8) & 255)) * fog) | 0;
          const b = ((col >> 16) & 255) + ((haze[2] - ((col >> 16) & 255)) * fog) | 0;
          const packed = (255 << 24) | (b << 16) | (g << 8) | r;
          const yStart = Math.max(0, Math.floor(y));
          const yEnd = Math.min(bh, Math.ceil(yTop));
          for (let yy = yStart; yy < yEnd; yy++) {
            pix[yy * bw + sx] = packed;
          }
          this.ybuf[sx] = y;
        }
        t += 1.2 + t * 0.035;
      }
    }
    this.bufferCtx.putImageData(this.image, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(
      this.bufferCanvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }

  renderRings(nextIndex, time) {
    const ctx = this.ctx;
    for (let i = 0; i < this.world.rings.length; i++) {
      const ring = this.world.rings[i];
      const p = this.project(ring.x, ring.y, ring.z);
      if (!p) continue;
      const scale = (this.canvas.width / this.bw) * this.focal;
      const rx = (ring.radius / p.depth) * scale;
      if (rx < 3 || rx > 1200) continue;
      const ry = Math.max(rx * 0.32, 4);
      const isNext = i === nextIndex;
      const passed = ring.passed;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (isNext) {
        const pulse = 0.75 + 0.25 * Math.sin(time * 4);
        ctx.shadowColor = '#39d0ba';
        ctx.shadowBlur = 26 * pulse;
        ctx.strokeStyle = '#39d0ba';
        ctx.lineWidth = 5;
      } else if (passed) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
      } else {
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 3;
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.86, ry * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (isNext) {
        ctx.fillStyle = '#eafffb';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'left';
        // Label at the ring's right side: the plane sits centred in
        // frame, so a label under the ring hides behind the fuselage.
        const label = `NEXT RING — ${Math.round(p.depth * 2)} m`;
        const lw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10,18,28,0.55)';
        ctx.beginPath();
        ctx.roundRect(p.x + rx + 12, p.y - 12, lw + 20, 26, 8);
        ctx.fill();
        ctx.fillStyle = '#eafffb';
        ctx.fillText(label, p.x + rx + 22, p.y + 6);
      }
    }
  }

  renderAirfieldLights() {
    const ctx = this.ctx;
    for (const f of this.world.airfields) {
      const rad = (f.heading * Math.PI) / 180;
      const fx = Math.sin(rad);
      const fz = Math.cos(rad);
      // Approach lights: a row of dots before each threshold.
      for (let s = 0; s < 2; s++) {
        const dir = s === 0 ? 1 : -1;
        for (let k = 1; k <= 5; k++) {
          const d = (f.length / 2 + k * 26) * dir;
          const p = this.project(
            f.x + fx * d,
            f.elevation + 2,
            f.z + fz * d,
          );
          if (!p) continue;
          ctx.fillStyle = k % 2 ? '#ffffff' : '#ffd27a';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  renderDropZone(time) {
    const ctx = this.ctx;
    const dz = this.world.dropZone;
    const ground = this.terrain.heightAt(dz.x, dz.z);
    const p = this.project(dz.x, ground + 1, dz.z);
    if (!p) return;
    const scale = (this.canvas.width / this.bw) * this.focal;
    const r = (dz.radius / p.depth) * scale;
    if (r < 4 || r > 900) return;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    ctx.strokeStyle = `rgba(255,120,60,${0.5 + 0.4 * pulse})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.45, r * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Smoke column so the zone is findable from altitude.
    const top = this.project(dz.x, ground + 90, dz.z);
    if (top) {
      const grad = ctx.createLinearGradient(p.x, p.y, top.x, top.y);
      grad.addColorStop(0, 'rgba(255,110,50,0.5)');
      grad.addColorStop(1, 'rgba(255,110,50,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderShadow(flight) {
    const ground = this.terrain.heightAt(flight.x, flight.z);
    const alt = flight.y - ground;
    if (alt < 2 || alt > 500) return;
    const p = this.project(flight.x, ground + 1, flight.z);
    if (!p) return;
    const scale = (this.canvas.width / this.bw) * this.focal;
    const r = Math.max(4, (14 / p.depth) * scale * (1 - alt / 700));
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(20,26,34,${Math.max(0.08, 0.4 - alt / 600)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // The Kestrel-9 from behind and above: wings, tail, cheatline, fin.
  // place lets the title screen park it smaller and lower, clear of the text.
  renderPlane(flight, time, place = {}) {
    const ctx = this.ctx;
    const cx = this.canvas.width / 2;
    const cy = this.canvas.height * (place.cy ?? 0.62);
    const S = (this.canvas.width / 1280) * (place.scale ?? 1);
    const bank = flight.bank * DEG;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank * 0.9);
    ctx.scale(S, S);
    // Wings.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.strokeStyle = 'rgba(43,47,54,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-215, 26);
    ctx.quadraticCurveTo(-120, 6, -52, 14);
    ctx.lineTo(-52, 40);
    ctx.quadraticCurveTo(-120, 44, -215, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(215, 26);
    ctx.quadraticCurveTo(120, 6, 52, 14);
    ctx.lineTo(52, 40);
    ctx.quadraticCurveTo(120, 44, 215, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Wingtip lights: red port, green starboard, blinking white strobe.
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(-208, 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#35d07f';
    ctx.beginPath();
    ctx.arc(208, 38, 6, 0, Math.PI * 2);
    ctx.fill();
    if (Math.floor(time * 1.4) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-52, 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fuselage: tapered body, nose away from the viewer.
    const body = ctx.createLinearGradient(0, -70, 0, 70);
    body.addColorStop(0, '#fbf6ea');
    body.addColorStop(0.6, PALETTE.planeCream);
    body.addColorStop(1, '#d9cdb2');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(43,47,54,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-34, 66);
    ctx.quadraticCurveTo(-40, -30, -16, -66);
    ctx.quadraticCurveTo(0, -76, 16, -66);
    ctx.quadraticCurveTo(40, -30, 34, 66);
    ctx.quadraticCurveTo(0, 78, -34, 66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Red cheatline down the fuselage.
    ctx.fillStyle = PALETTE.planeRed;
    ctx.fillRect(-34, 18, 68, 9);
    // Cabin roof windows.
    ctx.fillStyle = '#24344d';
    ctx.beginPath();
    ctx.roundRect(-20, -58, 40, 22, 8);
    ctx.fill();
    // Tail fin with the Skyline mark.
    ctx.fillStyle = PALETTE.planeTeal;
    ctx.beginPath();
    ctx.moveTo(-8, -66);
    ctx.lineTo(-4, -118);
    ctx.lineTo(14, -118);
    ctx.lineTo(20, -66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(6, -92);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('SKYLINE', 0, 4);
    ctx.restore();
    // Tailplane.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-78, 58);
    ctx.lineTo(-30, 44);
    ctx.lineTo(-30, 58);
    ctx.lineTo(-78, 70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(78, 58);
    ctx.lineTo(30, 44);
    ctx.lineTo(30, 58);
    ctx.lineTo(78, 70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Flaps down: visible trailing-edge panels.
    if (flight.flaps) {
      ctx.fillStyle = 'rgba(192,57,43,0.85)';
      ctx.fillRect(-46, 44, 92, 6);
    }
    // Gear down: two wheels.
    if (flight.gearDown) {
      ctx.fillStyle = '#22262c';
      ctx.beginPath();
      ctx.arc(-26, 82, 7, 0, Math.PI * 2);
      ctx.arc(26, 82, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
