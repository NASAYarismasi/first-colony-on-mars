import { it, expect } from 'vitest';
import { createAscent } from '../src/sim/ascent.js';
import { EARTH, G0 } from '../src/sim/constants.js';
import { polarState, propagateKepler, stateToElements } from '../src/sim/orbit.js';
function fly(dt = .02) {
  const a = createAscent(); a.launch();
  for (let i = 0; i < Math.ceil(900 / dt) && a.state.status === 'FLYING'; i++) a.step(dt);
  return a;
}
it('flies the real-mass SLS into a stable parking orbit using guidance, not state resets', () => {
  const a = fly(), t = a.getTelemetry();
  expect(a.state.status).toBe('ORBIT');
  expect(t.periapsis).toBeGreaterThan(160000);
  expect(t.apoapsis).toBeLessThan(220000);
  expect(t.time).toBeLessThan(600);
  expect(t.propellant.icps).toBeGreaterThanOrEqual(0);
  expect(t.maxQ.time).toBeGreaterThan(50); expect(t.maxQ.time).toBeLessThan(90);
  expect(t.maxQ.value).toBeGreaterThan(25000); expect(t.maxQ.value).toBeLessThan(45000);
  const sep = a.state.events.find(e => e.type === 'SRB_SEPARATION');
  expect(sep.time).toBeGreaterThanOrEqual(120); expect(sep.time).toBeLessThan(135);
  expect(t.maxAcceleration / G0).toBeLessThan(4);
  for (const name of ['LIFTOFF', 'MAX_Q', 'LAS_JETTISON', 'MECO', 'CORE_SEPARATION', 'ICPS_IGNITION', 'ORBIT_INSERTION']) expect(a.state.events.some(e => e.type === name)).toBe(true);
  const coast = propagateKepler(polarState(a.state.vector), 7200, EARTH.mu);
  expect(stateToElements(coast, EARTH.mu).periapsis - EARTH.radius).toBeGreaterThan(160000);
  console.info('ASCENT', JSON.stringify({ maxQ: t.maxQ, srbSeparation: sep.time, periapsis: t.periapsis, apoapsis: t.apoapsis, time: t.time, maxG: t.maxAcceleration / G0 }));
});
it('converges with half the integration timestep', () => {
  const a = fly().getTelemetry(), b = fly(.01).getTelemetry();
  expect(Math.abs(a.time - b.time)).toBeLessThan(.2);
  expect(Math.abs(a.periapsis - b.periapsis)).toBeLessThan(100);
  expect(Math.abs(a.maxQ.value - b.maxQ.value)).toBeLessThan(50);
});
it('uses the projected KSC rotation boost and fails a rocket commanded to zero core thrust', () => {
  const a = createAscent();
  expect(a.getTelemetry().velocity).toBeCloseTo(408.246, 2);
  expect(a.getTelemetry().engineFiring).toBe(false);
  expect(a.getTelemetry().acceleration).toBe(0);
  a.setThrottle(0); a.launch();
  for (let i = 0; i < 45000 && a.state.status === 'FLYING'; i++) a.step(.02);
  expect(a.state.status).toBe('FAILED');
});
