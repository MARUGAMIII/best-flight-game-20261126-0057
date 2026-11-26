// Skyline Courier — shared constants.
// One job: every number the game tunes lives here, so a balance change
// never means hunting through the flight model or the renderer.

export const WORLD = {
  size: 4096, // world units across (x and z), heightmap is 512 x 512 cells
  cells: 512,
  cellSize: 8,
  seaLevel: 0,
  seed: 20261126,
};

// Golden-hour look: one warm palette for sky, terrain and the plane.
export const PALETTE = {
  skyTop: '#2e6cb0',
  skyMid: '#7fb0d8',
  skyHorizon: '#ffd9a0',
  haze: '#c3d2e4',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  waterDeep: '#1d4e89',
  waterShallow: '#2f7fb8',
  sand: '#e8d29a',
  grass: '#6fae4e',
  meadow: '#8fc25e',
  forest: '#3f7d3a',
  rock: '#7d8a5a',
  snow: '#f2f5f7',
  runway: '#3c4148',
  runwayLine: '#f5f5f0',
  planeCream: '#f2ead8',
  planeRed: '#c0392b',
  planeTeal: '#1f7a6d',
  planeDark: '#2b2f36',
};

// The archipelago. Every island is a radial mask over the noise field;
// the runways are flattened pads painted into the heightmap.
export const ISLANDS = [
  // Meranti Besar — the big island, home airfield.
  { x: 2048, z: 2300, radius: 980, peak: 96, forest: 0.55 },
  // Teluk — second island, short strip.
  { x: 3350, z: 950, radius: 520, peak: 62, forest: 0.4 },
  // Pasir — small sandy island, the drop zone beach.
  { x: 950, z: 3300, radius: 380, peak: 26, forest: 0.25 },
  // Islets for the horizon.
  { x: 700, z: 900, radius: 220, peak: 30, forest: 0.3 },
  { x: 3600, z: 3100, radius: 260, peak: 34, forest: 0.3 },
  { x: 2500, z: 600, radius: 170, peak: 18, forest: 0.2 },
];

export const AIRFIELDS = [
  {
    id: 'meranti',
    name: 'Meranti Field',
    // Runway centre, heading in degrees (09 = east), length/width in units.
    x: 2048, z: 1780, heading: 90, length: 560, width: 48, elevation: 7,
    label: '09',
  },
  {
    id: 'teluk',
    name: 'Teluk Strip',
    x: 3350, z: 950, heading: 40, length: 400, width: 42, elevation: 9,
    label: '04',
  },
];

export const DROP_ZONE = {
  name: 'Pasir Beach',
  x: 950, z: 3300, radius: 46,
};

// Ring Run route: six rings over the bay, in order.
export const RING_ROUTE = [
  { x: 2300, z: 2050, y: 150 },
  { x: 2700, z: 1750, y: 210 },
  { x: 3050, z: 1400, y: 170 },
  { x: 3200, z: 1050, y: 240 },
  { x: 2900, z: 800, y: 190 },
  { x: 2450, z: 900, y: 260 },
];

export const FLIGHT = {
  minSpeed: 0, // knots, on the ground
  cruiseSpeed: 110,
  maxSpeed: 185,
  stallSpeed: 55, // 45 with flaps
  stallFlaps: 45,
  takeoffSpeed: 62,
  maxPitch: 28, // degrees the nose can point up/down
  maxBank: 55, // degrees of roll
  turnRate: 26, // degrees per second at full bank
  climbRate: 14, // units per second at full power, level pitch
  fuelCapacity: 100,
  fuelBurnCruise: 0.32, // units per second at 70% throttle
  fuelBurnFull: 0.55,
  gearDrag: 0.06,
  flapDrag: 0.1,
  damageHardLanding: 34, // damage points for a touchdown over the limit
  damageLimit: 100,
  crashVs: 16, // vertical speed (units/s) that breaks the plane on touchdown
  hardVs: 9, // vertical speed that damages on touchdown
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'RING RUN',
    brief: 'Fly the bay route: 6 rings in order, before the clock runs out.',
    timeLimit: 240,
    fuelStart: 100,
  },
  {
    id: 'hop',
    name: 'ISLAND HOP',
    brief: 'Land at Teluk Strip, full stop — then fly home and land at Meranti Field.',
    timeLimit: 420,
    fuelStart: 100,
  },
  {
    id: 'drop',
    name: 'SUPPLY DROP',
    brief: 'Drop 3 crates on Pasir Beach, then land at Meranti Field to finish.',
    timeLimit: 420,
    fuelStart: 100,
  },
];

// Scoring.
export const SCORE = {
  ring: 100,
  ringTimeBonus: 2, // per second left on the clock, ring run only
  landingBase: 150,
  landingCenterBonus: 100, // full marks for a centreline touchdown
  dropBullseye: 200,
  dropRing: 120, // inside the inner half of the zone
  dropOuter: 60, // inside the zone at all
  crashPenalty: 0, // a crash ends the sortie; no points banked for it
};

// Canvas / render.
export const VIEW = {
  width: 1280,
  height: 720,
  bufferWidth: 480, // terrain renders here, then upscales
  bufferHeight: 270,
  fov: 70, // degrees, horizontal
  chaseDistance: 26, // units behind the plane
  chaseHeight: 7, // units above the plane
  farDistance: 1100, // terrain march limit
};
