// Skyline Courier — the flight model.
// One job: how the Kestrel-9 moves. Arcade physics with real trade-offs:
// throttle and turns cost fuel, slow flight stalls, hard ground contact
// breaks the plane, and a good landing is a slow, straight, gentle one.

import { FLIGHT } from './config.js';

const DEG = Math.PI / 180;

export class Flight {
  constructor(terrain, world) {
    this.terrain = terrain;
    this.world = world;
    this.resetToRunway();
  }

  resetToRunway() {
    const field = this.world.airfields[0];
    const rad = (field.heading * DEG);
    // Parked on the threshold, facing down the runway.
    this.x = field.x - Math.sin(rad) * (field.length / 2 - 40);
    this.z = field.z - Math.cos(rad) * (field.length / 2 - 40);
    this.y = field.elevation + 1.2;
    this.heading = field.heading;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0; // knots
    this.verticalSpeed = 0;
    this.throttle = 0; // 0..100
    this.gearDown = true;
    this.flaps = false;
    this.fuel = 100;
    this.damage = 0;
    this.airborne = false;
    this.stalled = false;
    this.crashed = false;
    this.landed = false; // wheels on a runway, slow
    this.groundSpeed = 0;
    this.onRunway = true;
    this.touchdownVs = 0;
    this.touchdownAcross = 0;
  }

  // Place the plane in the air for a staged scene or a mission leg.
  placeInAir(x, z, y, heading, speed, throttle = 65) {
    this.x = x;
    this.z = z;
    this.y = y;
    this.heading = heading;
    this.pitch = 0;
    this.bank = 0;
    this.speed = speed;
    this.throttle = throttle;
    this.gearDown = false;
    this.flaps = false;
    this.airborne = true;
    this.onRunway = false;
    this.crashed = false;
    this.landed = false;
  }

  // dt in seconds. input: { pitch: -1..1 (up positive), bank: -1..1,
  // throttleDelta, flaps, gear, drop } — pitch input positive pulls up.
  step(dt, input) {
    if (this.crashed) return;

    // Throttle.
    this.throttle = Math.min(
      100,
      Math.max(0, this.throttle + (input.throttleDelta || 0) * dt),
    );
    if (input.flapsToggle) this.flaps = !this.flaps;
    if (input.gearToggle) this.gearDown = !this.gearDown;

    const stallSpeed = this.flaps ? FLIGHT.stallFlaps : FLIGHT.stallSpeed;
    const targetSpeed =
      (this.throttle / 100) * FLIGHT.maxSpeed * (this.flaps ? 0.92 : 1);
    const drag =
      0.25 +
      (this.gearDown ? FLIGHT.gearDrag : 0) +
      (this.flaps ? FLIGHT.flapDrag : 0) +
      Math.abs(this.bank) * 0.0012;
    this.speed += (targetSpeed - this.speed) * Math.min(1, drag * dt);
    if (this.speed < 0) this.speed = 0;

    this.stalled =
      this.airborne && this.speed < stallSpeed && this.throttle < 92;

    // Controls: bank eases toward the stick, pitch follows the stick.
    const bankTarget = (input.bank || 0) * FLIGHT.maxBank;
    this.bank += (bankTarget - this.bank) * Math.min(1, 3.2 * dt);
    const pitchTarget = (input.pitch || 0) * FLIGHT.maxPitch;
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, 2.4 * dt);

    // A stalled wing drops the nose and dulls the turn.
    let pitch = this.pitch;
    if (this.stalled) {
      pitch = Math.min(pitch, -6);
      this.bank *= 1 - 0.4 * dt;
    }

    // Turn: bank turns the heading; steeper bank turns faster.
    const turn = Math.sin(this.bank * DEG) * FLIGHT.turnRate;
    this.heading = (this.heading + turn * dt + 360) % 360;

    // Vertical speed: climb from pitch and power, sink when slow.
    // On the ground the wheels hold the plane down: no climb, no sink,
    // or the throttle's climb term lifts it off the runway a frame after
    // touchdown and a landing never sticks.
    if (this.airborne) {
      const climb =
        Math.sin(pitch * DEG) * this.speed * 0.9 +
        (this.throttle / 100) * FLIGHT.climbRate * 0.4 -
        (this.stalled ? 9 : 0);
      this.verticalSpeed += (climb - this.verticalSpeed) * Math.min(1, 2 * dt);
    } else {
      this.verticalSpeed = 0;
    }

    // Move.
    const hRad = this.heading * DEG;
    const forward = this.speed * 0.514; // knots -> units/s (1 kt ~ 0.51 u/s here)
    this.x += Math.sin(hRad) * forward * dt;
    this.z += Math.cos(hRad) * forward * dt;
    if (this.airborne) this.y += this.verticalSpeed * dt;

    // Fuel: throttle burns it; empty tank means the engine quits.
    const burn =
      (this.throttle / 100) *
      (this.throttle > 85 ? FLIGHT.fuelBurnFull : FLIGHT.fuelBurnCruise) *
      2;
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel <= 0 && this.throttle > 0) this.throttle = 0;

    // Ground and water.
    const ground = this.terrain.heightAt(this.x, this.z);
    const strip = this.world.airfieldAt(this.x, this.z);
    if (this.y <= ground + 1.2) {
      this.y = ground + 1.2;
      if (!this.airborne) {
        // Rolling on the ground: bleed speed, stay put.
        this.speed = Math.max(0, this.speed - 26 * dt);
        this.verticalSpeed = 0;
        this.landed = !!strip && this.speed < 8;
        if (strip && this.speed < 8) this.onRunway = true;
        // Liftoff: fast enough on a runway and the nose comes up. This
        // check lives here because the roll branch returns before the
        // liftoff check below — a plane that can never lift off is a
        // plane that can never fly.
        if (this.speed >= FLIGHT.takeoffSpeed && pitch > 4) {
          this.airborne = true;
          this.onRunway = false;
          this.landed = false;
        }
        return;
      }
      // Coming down: is it a landing or a crash?
      const vs = -this.verticalSpeed;
      if (strip && this.gearDown && vs <= FLIGHT.crashVs && this.speed > 30) {
        // Touchdown.
        this.touchdownVs = vs;
        this.touchdownAcross = Math.abs(strip.across);
        if (vs > FLIGHT.hardVs) {
          this.damage += FLIGHT.damageHardLanding;
        }
        this.airborne = false;
        this.verticalSpeed = 0;
        this.pitch = 0;
        this.bank = 0;
        this.speed = Math.max(0, this.speed - 8);
        this.landed = this.speed < 8;
        this.onRunway = true;
      } else {
        // Into terrain or water, or gear up, or far too fast down.
        this.crashed = true;
        this.damage = 100;
        this.speed = 0;
      }
      return;
    }

    // Liftoff: fast enough on a runway and the nose comes up.
    if (!this.airborne && this.speed >= FLIGHT.takeoffSpeed && pitch > 4) {
      this.airborne = true;
      this.onRunway = false;
      this.landed = false;
    }
    if (this.y > ground + 4) this.airborne = true;
  }
}
