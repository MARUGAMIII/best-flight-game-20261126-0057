// Skyline Courier — missions and scoring.
// One job: what a sortie asks for, whether it is done, and what it is
// worth. The flight model decides how the plane moves; this file decides
// what counts.

import { MISSIONS, SCORE, DROP_ZONE } from './config.js';

export class MissionDirector {
  constructor(world, flight) {
    this.world = world;
    this.flight = flight;
    this.missionIndex = 0;
    this.state = 'idle'; // idle | flying | done | failed
    this.score = 0;
    this.timeLeft = 0;
    this.message = '';
    this.messageTimer = 0;
    this.crates = 0;
    this.cratesDropped = 0;
    this.hopStage = 0; // 0: fly to Teluk, 1: landed there, 2: fly home
    this.dropResults = [];
    this.ringIndex = 0;
    this.landingQuality = 0;
  }

  get mission() {
    return MISSIONS[this.missionIndex];
  }

  get missionDone() {
    return this.missionIndex >= MISSIONS.length;
  }

  startMission(index) {
    this.missionIndex = index;
    const m = this.mission;
    this.state = 'flying';
    this.timeLeft = m.timeLimit;
    this.flight.fuel = m.fuelStart;
    this.flight.damage = 0;
    this.world.resetRings();
    this.ringIndex = 0;
    this.crates = 3;
    this.cratesDropped = 0;
    this.dropResults = [];
    this.hopStage = 0;
    this.landingQuality = 0;
    this.setMessage(`${m.name} — ${m.brief}`, 6);
  }

  startFreeFlight() {
    this.state = 'flying';
    this.timeLeft = 0;
    this.flight.fuel = 100;
    this.world.resetRings();
    this.ringIndex = 0;
    this.setMessage('Free flight — Meranti Field is yours. Land to refuel.', 5);
  }

  setMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds;
  }

  // Called when the pilot drops a crate (Space in the drop mission).
  dropCrate() {
    if (this.mission?.id !== 'drop' || this.state !== 'flying') return null;
    if (this.cratesDropped >= 3) return null;
    this.cratesDropped++;
    this.crates--;
    const dx = this.flight.x - DROP_ZONE.x;
    const dz = this.flight.z - DROP_ZONE.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    let points = 0;
    let label = 'Missed the beach';
    if (dist < DROP_ZONE.radius * 0.25) {
      points = SCORE.dropBullseye;
      label = 'Bullseye!';
    } else if (dist < DROP_ZONE.radius * 0.55) {
      points = SCORE.dropRing;
      label = 'Good drop';
    } else if (dist < DROP_ZONE.radius) {
      points = SCORE.dropOuter;
      label = 'On the beach';
    }
    this.score += points;
    this.dropResults.push({ dist: Math.round(dist), points, label });
    this.setMessage(
      `Crate ${this.cratesDropped}/3 — ${label} (+${points})`,
      3,
    );
    return { dist, points, label };
  }

  // Ring pass: the plane crossed the next ring's plane inside its radius.
  checkRings() {
    if (this.mission?.id !== 'rings' || this.state !== 'flying') return;
    if (this.ringIndex >= this.world.rings.length) return;
    const ring = this.world.rings[this.ringIndex];
    const dx = this.flight.x - ring.x;
    const dz = this.flight.z - ring.z;
    const dy = this.flight.y - ring.y;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    if (horizontal < ring.radius && Math.abs(dy) < ring.radius + 6) {
      ring.passed = true;
      this.ringIndex++;
      this.score += SCORE.ring;
      this.setMessage(
        `Ring ${this.ringIndex}/${this.world.rings.length} (+${SCORE.ring})`,
        2.5,
      );
      if (this.ringIndex >= this.world.rings.length) {
        const bonus = Math.round(this.timeLeft) * SCORE.ringTimeBonus;
        this.score += bonus;
        this.finishMission(`All rings! Time bonus +${bonus}.`);
      }
    }
  }

  // Landing quality: gentle and on the centreline scores best.
  scoreLanding(field) {
    const vs = this.flight.touchdownVs;
    const across = this.flight.touchdownAcross;
    const halfW = field.width / 2;
    const centre = Math.max(0, 1 - across / halfW);
    const gentle = Math.max(0, 1 - Math.max(0, vs - 2) / 8);
    const quality = Math.round((0.5 + 0.5 * centre) * (0.4 + 0.6 * gentle) * 100);
    const points = Math.round(
      SCORE.landingBase * (quality / 100) +
        SCORE.landingCenterBonus * centre * gentle,
    );
    this.score += points;
    this.landingQuality = quality;
    return { quality, points };
  }

  update(dt) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.state !== 'flying') return;
    if (this.timeLeft > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'failed';
        this.setMessage('Out of time — the sortie is over.', 5);
        return;
      }
    }
    const f = this.flight;
    if (f.crashed) {
      this.state = 'failed';
      this.setMessage('You crashed. Press R to fly again.', 6);
      return;
    }
    if (f.fuel <= 0 && f.airborne) {
      this.setMessage('Fuel empty — glide her down!', 3);
    }
    this.checkRings();
    this.updateHop(dt);
    this.updateDrop(dt);
  }

  updateHop() {
    if (this.mission?.id !== 'hop' || this.state !== 'flying') return;
    const f = this.flight;
    if (this.hopStage === 0 && f.landed && !f.airborne) {
      const strip = this.world.airfieldAt(f.x, f.z);
      if (strip?.field.id === 'teluk') {
        const r = this.scoreLanding(strip.field);
        this.hopStage = 1;
        this.setMessage(
          `Down at Teluk Strip — landing ${r.quality}% (+${r.points}). Refuelled. Now fly home to Meranti.`,
          6,
        );
        f.fuel = 100;
        f.damage = Math.max(0, f.damage - 20);
      }
    }
    if (this.hopStage === 1 && f.landed && !f.airborne) {
      const strip = this.world.airfieldAt(f.x, f.z);
      if (strip?.field.id === 'meranti') {
        const r = this.scoreLanding(strip.field);
        this.finishMission(
          `Home at Meranti Field — landing ${r.quality}% (+${r.points}).`,
        );
      }
    }
  }

  updateDrop() {
    if (this.mission?.id !== 'drop' || this.state !== 'flying') return;
    const f = this.flight;
    if (this.cratesDropped >= 3 && f.landed && !f.airborne) {
      const strip = this.world.airfieldAt(f.x, f.z);
      if (strip?.field.id === 'meranti') {
        const r = this.scoreLanding(strip.field);
        this.finishMission(
          `All crates away — landing ${r.quality}% (+${r.points}).`,
        );
      }
    }
  }

  finishMission(note) {
    this.state = 'done';
    this.setMessage(note, 6);
  }

  // What the HUD shows as the current objective.
  objectiveText() {
    if (this.missionDone) return 'Campaign complete — free flight, or fly again.';
    if (this.state !== 'flying') return this.mission.brief;
    const m = this.mission;
    if (m.id === 'rings') {
      return `Rings ${this.ringIndex}/${this.world.rings.length} — follow the glowing rings`;
    }
    if (m.id === 'hop') {
      return this.hopStage === 0
        ? 'Land at Teluk Strip (full stop)'
        : 'Fly home — land at Meranti Field';
    }
    if (m.id === 'drop') {
      return this.cratesDropped < 3
        ? `Drop crates on Pasir Beach (${this.cratesDropped}/3) — Space to drop`
        : 'Crates away — land at Meranti Field';
    }
    return m.brief;
  }
}
