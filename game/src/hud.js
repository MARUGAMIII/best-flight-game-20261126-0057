// Skyline Courier — the HUD and the screens.
// One job: everything drawn over the world — instruments, objective,
// messages, menus and debriefs. All vector, all crisp at display size.

import { MISSIONS } from './config.js';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  // ---- instruments -------------------------------------------------
  draw(flight, director, time) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.panel(ctx, 16, 16, 250, 108);
    this.text(ctx, 'AIRSPEED', 30, 40, 13, '#9fb6c9');
    this.text(ctx, `${Math.round(flight.speed)}`, 30, 82, 40, '#ffffff', 'bold');
    this.text(ctx, 'KT', 118, 82, 16, '#9fb6c9');
    this.text(ctx, `THR ${Math.round(flight.throttle)}%`, 30, 108, 15, '#cfe3ef');
    this.bar(ctx, 150, 66, 100, 12, flight.throttle / 100, '#39d0ba');

    this.panel(ctx, W - 266, 16, 250, 108);
    this.text(ctx, 'ALTITUDE', W - 252, 40, 13, '#9fb6c9');
    this.text(ctx, `${Math.round(flight.y * 3.2)}`, W - 252, 82, 40, '#ffffff', 'bold');
    this.text(ctx, 'FT', W - 150, 82, 16, '#9fb6c9');
    const vs = flight.verticalSpeed * 3.2 * 60;
    this.text(
      ctx,
      `V/S ${vs >= 0 ? '+' : ''}${Math.round(vs)} FPM`,
      W - 252,
      108,
      15,
      vs < -600 ? '#ffb347' : '#cfe3ef',
    );

    // Compass tape.
    this.compass(ctx, W / 2, 30, flight.heading);

    // Fuel + damage, bottom left.
    this.panel(ctx, 16, H - 100, 250, 84);
    this.text(ctx, 'FUEL', 30, H - 74, 13, '#9fb6c9');
    this.bar(ctx, 30, H - 64, 222, 12, flight.fuel / 100, flight.fuel < 25 ? '#ff6b5e' : '#39d0ba');
    this.text(ctx, 'DAMAGE', 30, H - 38, 13, '#9fb6c9');
    this.bar(ctx, 30, H - 28, 222, 12, flight.damage / 100, '#ff6b5e');

    // Attitude indicator, bottom right.
    this.attitude(ctx, W - 92, H - 92, flight);

    // Gear / flaps lights, left of the attitude indicator.
    this.text(
      ctx,
      `GEAR ${flight.gearDown ? 'DOWN' : 'UP'}   FLAPS ${flight.flaps ? 'DOWN' : 'UP'}`,
      W - 160,
      H - 70,
      14,
      '#cfe3ef',
      '600',
      'right',
    );

    // Objective bar, top centre under the compass.
    const obj = director.objectiveText();
    ctx.font = '600 16px system-ui, sans-serif';
    const tw = ctx.measureText(obj).width;
    this.panel(ctx, W / 2 - tw / 2 - 16, 66, tw + 32, 34);
    this.text(ctx, obj, W / 2, 89, 16, '#eafffb', '600', 'center');

    // Score + clock.
    this.text(ctx, `SCORE ${director.score}`, W - 24, 150, 18, '#ffffff', 'bold', 'right');
    if (director.timeLeft > 0) {
      const t = Math.max(0, Math.ceil(director.timeLeft));
      this.text(
        ctx,
        `TIME ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`,
        W - 24,
        176,
        18,
        t < 30 ? '#ff6b5e' : '#ffffff',
        'bold',
        'right',
      );
    }
    if (director.mission && !director.missionDone) {
      this.text(
        ctx,
        `MISSION ${director.missionIndex + 1}/${MISSIONS.length} — ${director.mission.name}`,
        W - 24,
        202,
        14,
        '#ffffff',
        '600',
        'right',
      );
    }

    // Stall warning.
    if (flight.stalled) {
      const blink = Math.floor(time * 4) % 2 === 0;
      if (blink) {
        ctx.font = 'bold 30px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff6b5e';
        ctx.fillText('STALL — NOSE DOWN, THROTTLE UP', W / 2, H * 0.3);
      }
    }

    // Mission message.
    if (director.messageTimer > 0 && director.message) {
      ctx.font = '600 19px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const mw = ctx.measureText(director.message).width;
      this.panel(ctx, W / 2 - mw / 2 - 18, H * 0.36, mw + 36, 40);
      this.text(ctx, director.message, W / 2, H * 0.36 + 27, 19, '#ffffff', '600', 'center');
    }
  }

  compass(ctx, cx, y, heading) {
    const W = 340;
    ctx.save();
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    ctx.beginPath();
    ctx.roundRect(cx - W / 2, y, W, 34, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - W / 2, y, W, 34);
    ctx.clip();
    for (let d = -60; d <= 60; d += 5) {
      let h = Math.round(heading + d);
      h = ((h % 360) + 360) % 360;
      const x = cx + (d / 60) * (W / 2 - 8);
      const major = h % 30 === 0;
      ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + (major ? 6 : 10));
      ctx.lineTo(x, y + 18);
      ctx.stroke();
      if (major) {
        const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[h] ?? String(h).padStart(3, '0');
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x, y + 31);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ff6b5e';
    ctx.beginPath();
    ctx.moveTo(cx - 6, y);
    ctx.lineTo(cx + 6, y);
    ctx.lineTo(cx, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  attitude(ctx, cx, cy, flight) {
    const r = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const roll = (-flight.bank * Math.PI) / 180;
    const pitchShift = Math.max(-r, Math.min(r, flight.pitch * 1.1));
    ctx.translate(cx, cy);
    ctx.rotate(roll);
    ctx.translate(0, pitchShift);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r * 2, r * 2, r * 2);
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(-r, 0, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings.
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - r + 8, cy);
    ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy);
    ctx.lineTo(cx + r - 8, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd27a';
    ctx.fill();
  }

  // ---- screens -----------------------------------------------------
  drawTitle(ctx, best) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(8,16,26,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SKYLINE COURIER', W / 2, H * 0.3);
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText('A bush-plane courier over the Meranti Archipelago', W / 2, H * 0.3 + 44);
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillStyle = '#eaf3fa';
    const lines = [
      'Fly rings, hop between island strips, drop supplies on the beach.',
      'Arrows pitch and bank · W/S throttle · F flaps · G gear · Space action',
      'Land gently, on the centreline, with the gear down — or swim home.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, W / 2, H * 0.44 + i * 32));
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#39d0ba';
    ctx.fillText('Press ENTER to fly — Mission 1: RING RUN', W / 2, H * 0.62);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = '#cfe3ef';
    ctx.fillText('or press 2 / 3 to start a later mission · 0 for free flight', W / 2, H * 0.62 + 34);
    if (best > 0) {
      ctx.fillStyle = '#ffd27a';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(`Best score: ${best}`, W / 2, H * 0.72);
    }
  }

  drawPaused(ctx) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(8,16,26,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('P to resume · R to restart the sortie · Esc for the menu', W / 2, H / 2 + 34);
  }

  drawDebrief(ctx, director, final) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(8,16,26,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const title = director.state === 'done'
      ? (final ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE')
      : 'SORTIE OVER';
    ctx.fillStyle = director.state === 'done' ? '#39d0ba' : '#ff6b5e';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText(title, W / 2, H * 0.3);
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillText(director.message, W / 2, H * 0.3 + 44);
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`Score: ${director.score}`, W / 2, H * 0.44);
    if (director.dropResults.length > 0) {
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillStyle = '#eaf3fa';
      director.dropResults.forEach((d, i) => {
        ctx.fillText(
          `Crate ${i + 1}: ${d.label} — ${d.dist} m off (${d.points} pts)`,
          W / 2,
          H * 0.52 + i * 28,
        );
      });
    }
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const next = final
      ? 'ENTER — fly the campaign again · 0 — free flight'
      : 'ENTER — next mission';
    ctx.fillText(next, W / 2, H * 0.66);
    ctx.fillText('Esc — back to the menu', W / 2, H * 0.66 + 34);
  }

  // ---- helpers -----------------------------------------------------
  panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10,18,28,0.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  bar(ctx, x, y, w, h, frac, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(4, w * Math.min(1, Math.max(0, frac))), h, 4);
    ctx.fill();
  }

  text(ctx, s, x, y, size, color, weight = '600', align = 'left') {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
  }
}
