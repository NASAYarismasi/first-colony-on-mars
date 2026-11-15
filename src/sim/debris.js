import { EARTH } from './constants.js';
import { rk4 } from './numerics.js';
// GAME ASSUMPTION: point-mass separation impulses and constant angular rates; no aerodynamics.
/** Detached hardware is isolated from the mission mass/trajectory, but follows inverse-square gravity. */
export function createDebris() {
  const bodies = [];
  return { bodies,
    release(id, position, velocity, impulse, angle, spin) {
      bodies.push({ id, vector: [...position, ...velocity.map((v, i) => v + impulse[i])], angle, spin, age: 0 });
    },
    step(dt) {
      for (const b of bodies) {
        b.vector = rk4(b.vector, b.age, dt, s => {
          const r = Math.hypot(s[0], s[1]), k = -EARTH.mu / r ** 3;
          return [s[2], s[3], k * s[0], k * s[1]];
        });
        b.angle += b.spin * dt; b.age += dt;
      }
      for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].age > 90) bodies.splice(i, 1);
    }
  };
}
