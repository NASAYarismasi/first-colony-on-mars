import { it, expect } from 'vitest';
import { SLS } from '../src/data/sls.js';
import { G0, P0 } from '../src/sim/constants.js';
import { createVehicle, rocketDeltaV, enginePerformance, propellantForDeltaV, dragCoefficient, dragForce } from '../src/sim/vehicle.js';
// Independent hand-calculation fixtures (m/s): expended parallel-booster/core fuel is not
// represented by adding these ideal isolated-stage budgets; flight integration tests cover that.
it.each([
  ['srb', 2589143, 1337143, 1736.68094],
  ['core', 1131543, 144543, 9121.24080],
  ['icps', 59268, 30220, 3074.82387]
])('%s ideal vacuum delta-v agrees with hand calculation including upper stack', (id, wet, dry, expected) => {
  const stage = SLS.stages.find(s => s.id === id);
  expect(rocketDeltaV(wet, dry, stage.engine.ispVac)).toBeCloseTo(expected, 4);
  expect(propellantForDeltaV(wet, expected, stage.engine.ispVac)).toBeCloseTo(stage.propellantMass, 2);
});
it('interpolates thrust and Isp in ambient pressure, and conserves mass when burning/separating', () => {
  const v = createVehicle(SLS), engine = SLS.stages[1].engine;
  const perf = enginePerformance(engine, P0 / 2, .7);
  expect(perf.thrust).toBeCloseTo(engine.count * (engine.thrustVac + engine.thrustSL) / 2 * .7, 8);
  expect(perf.isp).toBe((engine.ispVac + engine.ispSL) / 2);
  const initial = v.mass, burn = v.burn('core', 1, P0 / 2, .7);
  expect(initial - v.mass).toBeCloseTo(burn.thrust / (perf.isp * G0), 7);
  const attached = v.mass, stageMass = v.stages[1].dryMass + v.stages[1].propellant;
  expect(v.separate('core')).toBe(true);
  expect(attached - v.mass).toBeCloseTo(stageMass, 7);
  expect(v.burn('core', 1, 0).thrust).toBe(0);
  v.burn('icps', 1e6, 0);
  expect(v.stages[2].propellant).toBe(0);
  expect(v.mass).toBeGreaterThan(0);
});
it('has a transonic drag rise and quadratic drag', () => {
  expect(dragCoefficient(1)).toBeGreaterThan(dragCoefficient(.2));
  expect(dragForce(1, 200, 10, 1) / dragForce(1, 100, 10, 1)).toBe(4);
});
