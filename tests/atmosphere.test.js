import { describe, it, expect } from 'vitest';
import { earthAtmosphere, marsAtmosphere } from '../src/sim/atmosphere.js';
describe('standard atmospheres', () => {
  it.each([[0, 1.225], [11000, .3639], [20000, .0889]])('Earth density at %s m within 1%%', (h, expected) => {
    expect(Math.abs(earthAtmosphere(h).density / expected - 1)).toBeLessThan(.01);
  });
  it('remains continuous at every layer and at the 86 km exponential tail', () => {
    for (const h of [11000, 20000, 32000, 47000, 51000, 71000, 84852].map(h => 6356766 * h / (6356766 - h)).concat(86000)) {
      expect(Math.abs(earthAtmosphere(h - .01).pressure / earthAtmosphere(h + .01).pressure - 1)).toBeLessThan(.00001);
    }
    for (const h of [86000, 125000, 200000]) expect(earthAtmosphere(h).density).toBeGreaterThanOrEqual(0);
  });
  it('implements the actual Glenn Mars fit, which yields 0.015 kg/m³ rather than generic 0.020', () => {
    expect(marsAtmosphere(0).density).toBeCloseTo(699 / (192.1 * 242.15), 10);
    expect(marsAtmosphere(0).density).toBeGreaterThan(.014);
    expect(marsAtmosphere(0).density).toBeLessThan(.021);
    expect(marsAtmosphere(10000).pressure).toBeCloseTo(699 * Math.exp(-.9), 10);
    expect(marsAtmosphere(125000).temperature).toBeGreaterThan(0);
  });
});
