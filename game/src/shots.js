// Skyline Courier — screenshot staging.
// One job: put the game into a chosen scene for a screenshot, from a
// ?shot= URL parameter, deterministically. The starter kit does the same
// with ?shot=start|play|end; these scenes are this game's own.
//
// ?shot=title   — title screen over the parked plane at Meranti Field
// ?shot=cover   — mid-flight, banked toward the next ring, island ahead
// ?shot=rings   — about to fly through a ring over the bay
// ?shot=landing — final approach to Meranti Field, gear and flaps down
//
// A staged scene freezes the simulation: the frame a screenshot takes is
// the frame the scene was set to, every run.

export function applyShot(game, shot) {
  const { flight, director, renderer, world } = game;
  if (shot === 'title') {
    game.state = 'title';
    flight.resetToRunway();
    director.state = 'idle';
    snapCamera(game);
    return true;
  }
  if (shot === 'cover') {
    game.state = 'flying';
    director.startMission(0);
    director.state = 'flying';
    director.messageTimer = 0;
    // Ring 1 already flown; ring 2 is the glowing next ring, just above
    // the nose over the bay — blue sea below, Meranti's green coast ahead.
    // The plane flies 16 units under the ring's height, so the ring sits
    // in the upper third of the frame instead of off the top of it.
    director.ringIndex = 1;
    world.rings[0].passed = true;
    flight.placeInAir(2750, 1650, 180, 334, 118, 68);
    flight.bank = 12;
    flight.fuel = 82;
    snapCamera(game);
    return true;
  }
  if (shot === 'rings') {
    game.state = 'flying';
    director.startMission(0);
    director.state = 'flying';
    director.messageTimer = 0;
    // Rings 1 and 2 already flown; ring 3 is the glowing next ring,
    // close and dead ahead over the bay.
    director.ringIndex = 2;
    world.rings[0].passed = true;
    world.rings[1].passed = true;
    flight.placeInAir(3035, 1330, 175, 12, 122, 70);
    flight.bank = 10;
    flight.fuel = 88;
    snapCamera(game);
    return true;
  }
  if (shot === 'landing') {
    game.state = 'flying';
    director.startMission(1);
    director.state = 'flying';
    director.messageTimer = 0;
    director.hopStage = 1;
    // Final approach to Meranti runway 09: low, slow, gear and flaps
    // down, on the centreline with the strip filling the frame ahead.
    flight.placeInAir(1700, 1780, 40, 90, 78, 42);
    flight.gearDown = true;
    flight.flaps = true;
    flight.bank = 0;
    flight.pitch = -3;
    flight.verticalSpeed = -3;
    flight.fuel = 41;
    snapCamera(game);
    return true;
  }
  return false;
}

// Put the chase camera exactly where it belongs, with no easing, so a
// staged frame is the same every time it is taken.
function snapCamera(game) {
  const { flight, renderer } = game;
  renderer.updateCamera(flight, 10);
  renderer.camSmooth.x = renderer.cam.x;
  renderer.camSmooth.z = renderer.cam.z;
  renderer.camSmooth.y = renderer.cam.y;
  renderer.camSmooth.heading = flight.heading;
  renderer.camSmooth.pitch = flight.pitch * 0.35 - 3.5;
  renderer.updateCamera(flight, 10);
}
