// Skyline Courier — boot and the main loop.
// One job: own the game object, the screen state machine (title, flying,
// paused, debrief), the frame loop, and the wiring between input, flight,
// missions, rendering and sound. The flight model, the missions and the
// renderer each do their own job; this file only connects them.

import { Terrain } from './terrain.js';
import { World } from './world.js';
import { Flight } from './flight.js';
import { MissionDirector } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { applyShot } from './shots.js';
import { VIEW, MISSIONS } from './config.js';

const canvas = document.getElementById('game');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const terrain = new Terrain();
const world = new World(terrain);
const flight = new Flight(terrain, world);
const director = new MissionDirector(world, flight);
const renderer = new Renderer(canvas, terrain, world);
const hud = new Hud(canvas);
const input = new Input(canvas);
const sound = new Sound();

const game = {
  state: 'title', // title | flying | paused | debrief
  terrain,
  world,
  flight,
  director,
  renderer,
  hud,
  input,
  sound,
  best: 0,
  staged: false,
  crashTimer: 0,
};

try {
  game.best = Number(window.localStorage.getItem('skyline-courier-best') || 0) || 0;
} catch {
  game.best = 0;
}

function saveBest() {
  if (director.score > game.best) {
    game.best = director.score;
    try {
      window.localStorage.setItem('skyline-courier-best', String(game.best));
    } catch {
      // Storage unavailable (private mode, hosted CSP): the score is
      // still shown for this session.
    }
  }
}

function startMission(index) {
  sound.unlock();
  flight.resetToRunway();
  director.startMission(index);
  game.state = 'flying';
  game.crashTimer = 0;
}

function startFreeFlight() {
  sound.unlock();
  flight.resetToRunway();
  director.startFreeFlight();
  game.state = 'flying';
  game.crashTimer = 0;
}

function toTitle() {
  flight.resetToRunway();
  director.state = 'idle';
  game.state = 'title';
}

// ---- staged screenshots (?shot=...) ---------------------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  game.staged = applyShot(game, shot);
}

// ---- per-frame update -------------------------------------------------
function update(dt) {
  const f = flight;
  // Global keys.
  if (input.wasPressed('m')) sound.setMuted(!sound.muted);
  if (game.state === 'title') {
    if (input.wasPressed('enter') || input.mouse.clicked) startMission(0);
    else if (input.wasPressed('1')) startMission(0);
    else if (input.wasPressed('2')) startMission(1);
    else if (input.wasPressed('3')) startMission(2);
    else if (input.wasPressed('0')) startFreeFlight();
    renderer.updateCamera(f, dt);
    return;
  }
  if (game.state === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('escape')) game.state = 'flying';
    if (input.wasPressed('r')) restartSortie();
    return;
  }
  if (game.state === 'debrief') {
    if (input.wasPressed('enter')) {
      if (director.state === 'done' && !director.missionDone) {
        startMission(director.missionIndex + 1);
      } else {
        startMission(0);
      }
    }
    if (input.wasPressed('escape')) toTitle();
    if (input.wasPressed('0')) startFreeFlight();
    renderer.updateCamera(f, dt);
    return;
  }

  // Flying.
  if (input.wasPressed('p')) {
    game.state = 'paused';
    return;
  }
  if (input.wasPressed('escape')) {
    toTitle();
    return;
  }
  if (input.wasPressed('r')) {
    restartSortie();
    return;
  }

  const stick = input.flightStick();
  const stepInput = {
    pitch: stick.pitch,
    bank: stick.bank,
    throttleDelta: stick.throttleDelta,
    flapsToggle: input.wasPressed('f'),
    gearToggle: input.wasPressed('g'),
  };
  const wasAirborne = f.airborne;
  const wasLanded = f.landed;
  f.step(dt, stepInput);
  if (input.wasPressed(' ')) {
    const drop = director.dropCrate();
    if (drop) sound.blip(520, 0.15, 'triangle', 0.15);
  }
  director.update(dt);
  if (f.airborne !== wasAirborne && f.airborne) sound.blip(700, 0.2, 'sine', 0.12);
  if (f.landed && !wasLanded) {
    sound.thud();
    const strip = world.airfieldAt(f.x, f.z);
    if (strip && director.state === 'flying' && director.mission?.id !== 'hop') {
      // A full stop on a runway refuels the plane.
      f.fuel = 100;
      director.setMessage('Refuelled at ' + strip.field.name + '.', 3);
    }
  }
  if (f.stalled && Math.random() < dt * 2) sound.warn();

  sound.setEngine(f.throttle, f.speed);
  renderer.updateCamera(f, dt);

  if (f.crashed || director.state === 'failed' || director.state === 'done') {
    game.crashTimer += dt;
    if (game.crashTimer > 1.6) {
      saveBest();
      game.state = 'debrief';
      game.crashTimer = 0;
    }
  }
}

function restartSortie() {
  const idx = director.mission ? director.missionIndex : 0;
  if (director.state === 'flying' || director.mission) startMission(idx);
  else startFreeFlight();
}

// ---- render ------------------------------------------------------------
function render(time) {
  const ctx = canvas.getContext('2d');
  renderer.renderSky(time);
  renderer.renderTerrain();
  renderer.renderAirfieldLights();
  if (director.mission?.id === 'drop' || game.state === 'title') {
    renderer.renderDropZone(time);
  }
  if (director.mission?.id === 'rings' || game.state === 'title') {
    // On the title screen the rings are scenery: no "next" ring, so no
    // label pill fighting the title text.
    renderer.renderRings(game.state === 'title' ? -1 : director.ringIndex, time);
  }
  renderer.renderShadow(flight);
  if (game.state === 'title') {
    renderer.renderPlane(flight, time, { cy: 0.82, scale: 0.72 });
  } else {
    renderer.renderPlane(flight, time);
  }
  if (game.state === 'title') {
    hud.drawTitle(ctx, game.best);
  } else if (game.state === 'paused') {
    hud.draw(flight, director, time);
    hud.drawPaused(ctx);
  } else if (game.state === 'debrief') {
    hud.draw(flight, director, time);
    hud.drawDebrief(ctx, director, director.missionDone);
  } else {
    hud.draw(flight, director, time);
  }
}

// ---- the loop -----------------------------------------------------------
let last = performance.now();
let fpsAccum = 0;
let fpsFrames = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  if (!game.staged) update(dt);
  render(time);
  input.endFrame();
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 2) {
    window.__skylineFps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0;
    fpsFrames = 0;
  }
  requestAnimationFrame(frame);
}

// Expose the game for debugging and for the screenshot harness.
window.__skyline = game;
requestAnimationFrame(frame);
