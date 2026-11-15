import { it, expect } from 'vitest';
import { TRANSFER, heliocentricAt, consumeManeuver } from '../src/sim/transfer.js';
import { AU, DAY, G0 } from '../src/sim/constants.js';
import { TRANSIT } from '../src/data/sls.js';
it('preserves verified Hohmann transfer figures in SI', () => {
  expect(TRANSFER.duration / DAY).toBeCloseTo(258.9, 0);
  expect(TRANSFER.phaseAngle * 180 / Math.PI).toBeCloseTo(44.3, 0);
  expect(TRANSFER.departureDeltaV / 1000).toBeCloseTo(3.61, 2);
  expect(TRANSFER.captureDeltaV / 1000).toBeCloseTo(2.10, 2);
  const start = heliocentricAt(0), end = heliocentricAt(TRANSFER.duration);
  expect(Math.hypot(...start.ship)).toBeCloseTo(AU, 3);
  expect(Math.hypot(...end.ship)).toBeCloseTo(1.523679 * AU, 3);
  expect(Math.hypot(...end.ship.map((x, i) => x - end.mars[i]))).toBeLessThan(.001);
});
it('accounts for TMI and MOI propellant with the rocket equation and rejects impossible burns', () => {
  const vehicle = { dryMass: TRANSIT.dryMass, payloadMass: TRANSIT.landerMass, propellant: TRANSIT.propellantMass, isp: TRANSIT.isp };
  const initial = vehicle.dryMass + vehicle.payloadMass + vehicle.propellant;
  consumeManeuver(vehicle, TRANSFER.departureDeltaV); consumeManeuver(vehicle, TRANSFER.captureDeltaV);
  const final = vehicle.dryMass + vehicle.payloadMass + vehicle.propellant;
  expect(final).toBeCloseTo(initial * Math.exp(-(TRANSFER.departureDeltaV + TRANSFER.captureDeltaV) / (900 * G0)), 7);
  expect(vehicle.propellant).toBeGreaterThan(0);
  expect(() => consumeManeuver(vehicle, 100000)).toThrow(/propellant/);
});
