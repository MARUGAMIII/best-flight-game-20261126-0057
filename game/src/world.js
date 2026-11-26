// Skyline Courier — the world’s placed objects.
// One job: rings, airstrips, the drop zone and clouds — where they are
// and how to ask about them. Terrain height lives in terrain.js.

import { AIRFIELDS, DROP_ZONE, RING_ROUTE } from './config.js';
import { mulberry32 } from './random.js';

export class World {
  constructor(terrain) {
    this.terrain = terrain;
    this.airfields = AIRFIELDS.map((f) => ({ ...f }));
    this.dropZone = { ...DROP_ZONE };
    this.rings = RING_ROUTE.map((r, i) => ({
      id: i,
      x: r.x,
      z: r.z,
      y: r.y,
      radius: 15,
      passed: false,
    }));
    this.clouds = this.placeClouds();
  }

  placeClouds() {
    const rand = mulberry32(4242);
    const clouds = [];
    for (let i = 0; i < 26; i++) {
      clouds.push({
        x: 300 + rand() * 3500,
        z: 300 + rand() * 3500,
        y: 320 + rand() * 130,
        size: 90 + rand() * 160,
      });
    }
    return clouds;
  }

  // The airstrip under a point, if the point is over one.
  airfieldAt(x, z) {
    for (const f of this.airfields) {
      const rad = (f.heading * Math.PI) / 180;
      const fx = Math.sin(rad);
      const fz = Math.cos(rad);
      const dx = x - f.x;
      const dz = z - f.z;
      const along = dx * fx + dz * fz;
      const across = dx * fz - dz * fx;
      if (Math.abs(along) <= f.length / 2 && Math.abs(across) <= f.width / 2) {
        return { field: f, along, across };
      }
    }
    return null;
  }

  resetRings() {
    for (const ring of this.rings) ring.passed = false;
  }
}
