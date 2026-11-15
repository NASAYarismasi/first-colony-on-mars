import { it, expect } from 'vitest';
import { createCountdown } from '../src/sim/countdown.js';
import { createDebris } from '../src/sim/debris.js';
import { EARTH } from '../src/sim/constants.js';
import { createAscent } from '../src/sim/ascent.js';
import { createEDL } from '../src/sim/edl.js';
it('sequences RS-25 at -6.5 and solids at zero once, with a pausable fixed clock', () => {
  const c = createCountdown(); c.step(5); expect(c.state.time).toBe(-10);
  c.start(); c.step(3.49); expect(c.state.events).toHaveLength(0);
  c.step(.01); expect(c.state.events[0]).toEqual({ type: 'RS25_START', time: -6.5 });
  expect(c.step(6.5)).toBe(true); expect(c.state.time).toBe(0);
  expect(c.step(1)).toBe(false); expect(c.state.events).toHaveLength(2);
});
it('separated bodies conserve specific orbital energy and diverge under separation impulse', () => {
  const d = createDebris(), r = EARTH.radius + 60000;
  d.release('srb', [0, r], [1800, 500], [8, 0], 0, .1);
  const energy = b => (b.vector[2] ** 2 + b.vector[3] ** 2) / 2 - EARTH.mu / Math.hypot(...b.vector.slice(0, 2));
  const initial = energy(d.bodies[0]);
  for (let i = 0; i < 1000; i++) d.step(.02);
  expect(Math.abs((energy(d.bodies[0]) - initial) / initial)).toBeLessThan(1e-10);
  expect(d.bodies[0].angle).toBeCloseTo(2); expect(d.bodies[0].vector[0]).toBeGreaterThan(36000);
});
it('exposes ambient pressure, density, thrust and instantaneous heating for rendering', () => {
  const a = createAscent(); expect(a.getTelemetry().pressure).toBeCloseTo(101325, -1);
  a.launch(); a.step(.02); expect(a.getTelemetry().thrust).toBeGreaterThan(3e7);
  const e = createEDL(); expect(e.getTelemetry().heatFlux).toBeGreaterThan(0);
  expect(e.getTelemetry().pressure).toBeGreaterThan(0);
});
it('includes retropropulsion in EDL proper acceleration instead of reporting aerodynamic drag alone', () => {
  const e=createEDL();
  for(let i=0;i<80000&&!e.state.powered;i++)e.step(.02);
  const t=e.getTelemetry();expect(t.engineFiring).toBe(true);
  expect(t.acceleration).toBeGreaterThan(5);
  expect(Math.hypot(e.state.control.ar,e.state.control.at)).toBeGreaterThan(5);
});
