import { describe, it, expect } from 'vitest';
import { marsSun, JEZERO, MARS_SOL_SECONDS, advanceSurfaceTime, nextMarsMorning, atLocalTime, terrestrialOffset } from '../src/sim/marsSun.js';
import { AU } from '../src/sim/constants.js';
const DEG = 180 / Math.PI;
const utc = text => Date.parse(text) / 1000;
// Published tables round intermediate terms (some D values differ from the current formula by <0.001°).
// https://www.giss.nasa.gov/tools/mars24/help/algorithm.html#WorkedExamples
describe('NASA Mars24 published worked examples', () => {
  it('matches near-coincident Earth/Mars midnight, 6 January 2000', () => {
    const sun = marsSun(utc('2000-01-06T00:00:00Z'), { latitude: 0, longitude: 0 });
    expect(sun.marsSolDate).toBeCloseTo(1075103.99425 / 24, 5);
    expect(sun.ls * DEG).toBeCloseTo(277.18758, 4);
    expect(sun.lmst / 3600).toBeCloseTo(23.99425, 4);
    expect(sun.ltst / 3600).toBeCloseTo(23.64840, 4);
    expect(sun.declination * DEG).toBeCloseTo(-25.22825, 4);
    expect(Math.abs(sun.elevation * DEG - (90 - 154.26182))).toBeLessThan(.001);
    expect(sun.azimuth * DEG).toBeCloseTo(191.03905, 4);
    expect(sun.distance / AU).toBeCloseTo(1.39358, 4);
  });
  it('matches Spirit pre-landing local true midnight, 3 January 2004', () => {
    const sun = marsSun(utc('2004-01-03T13:46:31Z'), { latitude: -14.640 / DEG, longitude: -184.702 / DEG });
    expect(sun.ls * DEG).toBeCloseTo(327.32416, 4);
    expect(sun.lmst / 3600).toBeCloseTo(.85190, 4);
    expect(sun.ltst / 3600).toBeCloseTo(.00025, 4);
    expect(Math.abs(sun.declination * DEG + 13.42065)).toBeLessThan(.001);
    expect(Math.abs(sun.elevation * DEG - (90 - 151.93895))).toBeLessThan(.001);
    expect(sun.azimuth * DEG).toBeCloseTo(179.99383, 4);
    expect(sun.distance / AU).toBeCloseTo(1.47767, 4);
  });
});
describe('Jezero clock and coordinates', () => {
  const epoch = utc('2026-11-14T00:00:00Z');
  it('uses east-positive longitude, SI angles and historical leap offsets', () => {
    expect(terrestrialOffset(utc('2000-01-06T00:00:00Z'))).toBe(64.184);
    expect(terrestrialOffset(epoch)).toBe(69.184);
    expect(marsSun(epoch).lmst).toBeCloseTo(marsSun(epoch, { longitude: 0 }).lmst + JEZERO.longitude * 86400 / (2*Math.PI), 5);
  });
  it('advances a sol in 600 seconds and preserves the allowed warp factors', () => {
    for (const warp of [1, 10, 60]) {
      expect(advanceSurfaceTime(epoch, 600 / warp, warp) - epoch).toBeCloseTo(MARS_SOL_SECONDS, 5);
    }
    expect(() => advanceSurfaceTime(epoch, -1)).toThrow();
    expect(() => advanceSurfaceTime(epoch, 1, 2)).toThrow();
  });
  it('jumps to the next calendar morning at 07:00, even before dawn', () => {
    for (const hours of [1, 7, 12, 23.9]) {
      const start = atLocalTime(epoch, hours*3600);
      const next = nextMarsMorning(start);
      expect(marsSun(next).lmst / 3600).toBeCloseTo(7, 5);
      expect(next - start).toBeCloseTo((31-hours)/24*MARS_SOL_SECONDS, 4);
    }
  });
  it('places the morning sun east and afternoon sun west, wraps all angles and rejects invalid input', () => {
    expect(Math.sin(marsSun(atLocalTime(epoch, 9*3600)).azimuth)).toBeGreaterThan(0);
    expect(Math.sin(marsSun(atLocalTime(epoch, 15*3600)).azimuth)).toBeLessThan(0);
    for (const time of [epoch, -2208988800, epoch + 1000*MARS_SOL_SECONDS]) {
      const sun = marsSun(time);
      expect(sun.lmst).toBeGreaterThanOrEqual(0);
      expect(sun.lmst).toBeLessThan(86400);
      expect(sun.azimuth).toBeGreaterThanOrEqual(0);
      expect(sun.azimuth).toBeLessThan(2*Math.PI);
      expect(Number.isFinite(sun.elevation)).toBe(true);
    }
    expect(() => marsSun(NaN)).toThrow();
    expect(() => marsSun(epoch, { latitude: Math.PI })).toThrow();
  });
});
