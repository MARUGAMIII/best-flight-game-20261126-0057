// Skyline Courier — terrain.
// One job: build the heightmap and the colour map of the archipelago,
// flatten and paint the runways, and answer height queries.

import { WORLD, ISLANDS, AIRFIELDS, PALETTE } from './config.js';
import { makeNoise2D, mulberry32 } from './random.js';

// Pack r,g,b into a Uint32 that ImageData reads as RGBA on little-endian.
export function packColor(r, g, b) {
  return (255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255);
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export class Terrain {
  constructor() {
    const cells = WORLD.cells;
    this.cells = cells;
    this.size = WORLD.size;
    this.cell = WORLD.cellSize;
    this.heights = new Float32Array(cells * cells);
    this.colors = new Uint32Array(cells * cells);
    this.noise = makeNoise2D(WORLD.seed);
    this.townRand = mulberry32(WORLD.seed + 77);
    this.buildHeights();
    this.paintRunways();
    this.paintColors();
  }

  // World x/z -> cell indices, clamped.
  cellAt(x, z) {
    const c = this.cells;
    const ix = Math.min(c - 1, Math.max(0, Math.floor(x / this.cell)));
    const iz = Math.min(c - 1, Math.max(0, Math.floor(z / this.cell)));
    return [ix, iz];
  }

  heightAt(x, z) {
    const c = this.cells;
    const gx = Math.min(c - 1.001, Math.max(0, x / this.cell));
    const gz = Math.min(c - 1.001, Math.max(0, z / this.cell));
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const h = this.heights;
    const h00 = h[iz * c + ix];
    const h10 = h[iz * c + ix + 1];
    const h01 = h[(iz + 1) * c + ix];
    const h11 = h[(iz + 1) * c + ix + 1];
    return (
      h00 * (1 - fx) * (1 - fz) +
      h10 * fx * (1 - fz) +
      h01 * (1 - fx) * fz +
      h11 * fx * fz
    );
  }

  colorAt(x, z) {
    const [ix, iz] = this.cellAt(x, z);
    return this.colors[iz * this.cells + ix];
  }

  buildHeights() {
    const c = this.cells;
    const cell = this.cell;
    const fbm = this.noise;
    for (let iz = 0; iz < c; iz++) {
      for (let ix = 0; ix < c; ix++) {
        const x = (ix + 0.5) * cell;
        const z = (iz + 0.5) * cell;
        // Ocean floor.
        let h = -7;
        for (const isl of ISLANDS) {
          const dx = x - isl.x;
          const dz = z - isl.z;
          const d = Math.sqrt(dx * dx + dz * dz) / isl.radius;
          if (d >= 1) continue;
          const mask = 1 - smoothstep(0.55, 1, d);
          const hills = fbm(x * 0.0016, z * 0.0016);
          const detail = fbm(x * 0.008 + 40, z * 0.008 + 40);
          const peak = isl.peak * (0.35 + 0.65 * hills) + detail * 6;
          h = Math.max(h, mask * peak);
        }
        this.heights[iz * c + ix] = h;
      }
    }
  }

  // Flatten the runway pads and their shoulders into the heightmap.
  // The flat corridor runs well past each runway end, so the approach
  // is over level ground and the lights sit on it, not in a hillside.
  paintRunways() {
    const c = this.cells;
    for (const field of AIRFIELDS) {
      const rad = (field.heading * Math.PI) / 180;
      const fx = Math.sin(rad);
      const fz = Math.cos(rad);
      const halfL = field.length / 2 + 180;
      const halfW = field.width / 2 + 120;
      const x0 = Math.max(0, Math.floor((field.x - halfL) / this.cell));
      const x1 = Math.min(c - 1, Math.ceil((field.x + halfL) / this.cell));
      const z0 = Math.max(0, Math.floor((field.z - halfL) / this.cell));
      const z1 = Math.min(c - 1, Math.ceil((field.z + halfL) / this.cell));
      for (let iz = z0; iz <= z1; iz++) {
        for (let ix = x0; ix <= x1; ix++) {
          const x = (ix + 0.5) * this.cell;
          const z = (iz + 0.5) * this.cell;
          const dx = x - field.x;
          const dz = z - field.z;
          const along = dx * fx + dz * fz;
          const across = dx * fz - dz * fx;
          if (Math.abs(along) > halfL || Math.abs(across) > halfW) continue;
          // Fully flat inside the runway rectangle itself, then a smooth
          // falloff across the shoulders — a runway end must never sit on
          // a hillside, or the plane parks on a slope and the camera with it.
          const alongExcess =
            Math.max(0, Math.abs(along) - (field.length / 2 + 30)) / 150;
          const acrossExcess =
            Math.max(0, Math.abs(across) - field.width / 2) / 120;
          const edge = Math.max(alongExcess, acrossExcess);
          const target = field.elevation;
          const current = this.heights[iz * c + ix];
          const blend = 1 - smoothstep(0, 1, edge);
          this.heights[iz * c + ix] =
            current + (target - current) * blend;
        }
      }
    }
  }

  paintColors() {
    const c = this.cells;
    const waterDeep = hexRgb(PALETTE.waterDeep);
    const waterShallow = hexRgb(PALETTE.waterShallow);
    const sand = hexRgb(PALETTE.sand);
    const grass = hexRgb(PALETTE.grass);
    const meadow = hexRgb(PALETTE.meadow);
    const forest = hexRgb(PALETTE.forest);
    const rock = hexRgb(PALETTE.rock);
    const snow = hexRgb(PALETTE.snow);
    const runway = hexRgb(PALETTE.runway);
    const runwayLine = hexRgb(PALETTE.runwayLine);
    const h = this.heights;
    const fbm = this.noise;

    for (let iz = 0; iz < c; iz++) {
      for (let ix = 0; ix < c; ix++) {
        const i = iz * c + ix;
        const height = h[i];
        const x = (ix + 0.5) * this.cell;
        const z = (iz + 0.5) * this.cell;
        let rgb;
        if (height < -0.4) {
          // Water: deeper further from shore, with a static sparkle.
          const depth = Math.min(1, (-height - 0.4) / 6);
          const sparkle = ((ix * 7 + iz * 13) % 5 === 0 ? 10 : 0);
          rgb = [
            Math.round(
              waterShallow[0] + (waterDeep[0] - waterShallow[0]) * depth,
            ) + sparkle,
            Math.round(
              waterShallow[1] + (waterDeep[1] - waterShallow[1]) * depth,
            ) + sparkle,
            Math.round(
              waterShallow[2] + (waterDeep[2] - waterShallow[2]) * depth,
            ) + sparkle,
          ];
        } else if (height < 3.2) {
          rgb = sand;
        } else {
          // Land: meadow/grass patches, forest where the noise says so,
          // rock on steep ground or high up, snow on the highest peaks.
          const hx = ix > 0 ? h[i - 1] : height;
          const hz = iz > 0 ? h[i - c] : height;
          const slope = Math.abs(height - hx) + Math.abs(height - hz);
          const green = fbm(x * 0.004 + 9, z * 0.004 + 9);
          const wooded = fbm(x * 0.002 + 31, z * 0.002 + 31);
          const base =
            wooded > 0.56 && height > 5
              ? forest
              : green > 0.55
                ? meadow
                : grass;
          if (height > 84) rgb = snow;
          else if (height > 72) rgb = rock;
          else if (slope > 12) {
            // Steep ground blends toward rock instead of switching hard,
            // so hillsides read as scrub, not grey walls.
            const k = Math.min(1, (slope - 12) / 12);
            rgb = [
              Math.round(base[0] + (rock[0] - base[0]) * k),
              Math.round(base[1] + (rock[1] - base[1]) * k),
              Math.round(base[2] + (rock[2] - base[2]) * k),
            ];
          } else rgb = base;
          // A little per-cell brightness jitter, so flat ground reads as
          // texture instead of one big flat colour field.
          const jitter = (((ix * 73 + iz * 149) % 5) - 2) * 2;
          rgb = [
            Math.max(0, Math.min(255, rgb[0] + jitter)),
            Math.max(0, Math.min(255, rgb[1] + jitter)),
            Math.max(0, Math.min(255, rgb[2] + jitter)),
          ];
        }
        // Runway paint: asphalt, centreline dashes, threshold bars.
        for (const field of AIRFIELDS) {
          const rad = (field.heading * Math.PI) / 180;
          const fx = Math.sin(rad);
          const fz = Math.cos(rad);
          const dx = x - field.x;
          const dz = z - field.z;
          const along = dx * fx + dz * fz;
          const across = dx * fz - dz * fx;
          const halfL = field.length / 2;
          const halfW = field.width / 2;
          if (Math.abs(along) <= halfL && Math.abs(across) <= halfW) {
            rgb = runway;
            const dash = Math.floor((along + halfL) / 22) % 2 === 0;
            if (Math.abs(across) < 1.6 && dash) rgb = runwayLine;
            if (Math.abs(along) > halfL - 16) {
              const band = Math.floor((across + halfW) / 7) % 2 === 0;
              if (band) rgb = runwayLine;
            }
          }
        }
        this.colors[i] = packColor(rgb[0], rgb[1], rgb[2]);
      }
    }
    this.paintTown();
  }

  // A small town of roof-coloured blocks beside Meranti Field, so the
  // terrain reads as inhabited from the air.
  paintTown() {
    const rand = this.townRand;
    const roofs = [
      hexRgb('#8a4a38'),
      hexRgb('#9c7a52'),
      hexRgb('#6f655c'),
      hexRgb('#7d4444'),
    ];
    for (let n = 0; n < 30; n++) {
      const cx = 2180 + rand() * 260;
      const cz = 1960 + rand() * 180;
      const w = 1;
      const d = 1;
      const roof = roofs[Math.floor(rand() * roofs.length)];
      const [ix0, iz0] = this.cellAt(cx - w * 4, cz - d * 4);
      const [ix1, iz1] = this.cellAt(cx + w * 4, cz + d * 4);
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          const i = iz * this.cells + ix;
          if (this.heights[i] > 4) {
            this.colors[i] = packColor(roof[0], roof[1], roof[2]);
          }
        }
      }
    }
  }
}
