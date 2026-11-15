import { it, expect } from 'vitest';
import { EARTH } from '../src/sim/constants.js';
import { visViva, elementsToState, stateToElements, propagateKepler, orbitalPeriod, specificEnergy, norm } from '../src/sim/orbit.js';
it('circular 200 km LEO speed is 7.784 km/s', () => {
  expect(visViva(EARTH.mu, EARTH.radius + 200000, EARTH.radius + 200000)).toBeCloseTo(7784, 0);
});
it.each([
  { a: 9000000, e: .2, inclination: .5, raan: .4, argumentOfPeriapsis: .9, trueAnomaly: 4.3 },
  { a: 6600000, e: 0, inclination: 0, raan: 0, argumentOfPeriapsis: 0, trueAnomaly: 1.2 },
  { a: 8000000, e: 0, inclination: .8, raan: 2, argumentOfPeriapsis: 0, trueAnomaly: 4 }
])('round-trips Cartesian vectors including circular singularities: %j', elements => {
  const s = elementsToState(elements, EARTH.mu);
  const restored = elementsToState(stateToElements(s, EARTH.mu), EARTH.mu);
  for (const key of ['position', 'velocity']) expect(norm(s[key].map((v, i) => v - restored[key][i])) / norm(s[key])).toBeLessThan(1e-10);
});
it('conserves energy through 10 orbits with repeated nontrivial Kepler steps', () => {
  let s = elementsToState({ a: 8500000, e: .15, inclination: .5, raan: .3, argumentOfPeriapsis: .8, trueAnomaly: 1 }, EARTH.mu);
  const initial = specificEnergy(s, EARTH.mu), dt = orbitalPeriod(EARTH.mu, 8500000) / 123;
  for (let i = 0; i < 1230; i++) {
    s = propagateKepler(s, dt, EARTH.mu);
    expect(Math.abs(specificEnergy(s, EARTH.mu) / initial - 1)).toBeLessThan(1e-9);
  }
});
