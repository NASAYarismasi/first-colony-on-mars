import { G0, P0 } from './constants.js';
import { clamp, interpolate } from './numerics.js';

/** @typedef {{count: number, thrustSL: number, thrustVac: number, ispSL: number, ispVac: number, thrustCurve?: number[][]}} Engine */
/** @typedef {{id: string, dryMass: number, propellantMass: number, engine: Engine}} Stage */

// GAME ASSUMPTION: generic axisymmetric launch stack Cd envelope, not SLS wind-tunnel data.
export const CD_TABLE = [[0, .25], [.8, .28], [1, .5], [1.3, .48], [2, .32], [5, .24], [15, .2]];
export const dragCoefficient = mach => interpolate(CD_TABLE, mach);
export const dragForce = (density, speed, area, mach) => .5 * density * speed ** 2 * dragCoefficient(mach) * area;
export const rocketDeltaV = (initialMass, finalMass, isp) => {
  if (!(initialMass >= finalMass && finalMass > 0 && isp > 0)) throw new RangeError('Invalid rocket equation masses/Isp');
  return isp * G0 * Math.log(initialMass / finalMass);
};
export const propellantForDeltaV = (mass, deltaV, isp) => mass * (1 - Math.exp(-Math.abs(deltaV) / (isp * G0)));
/** @param {Engine} engine @param {number} pressure Ambient pressure in Pa. */
export function enginePerformance(engine, pressure, throttle = 1, time = 0) {
  const p = clamp(pressure / P0, 0, 1);
  const factor = engine.thrustCurve ? interpolate(engine.thrustCurve, time) : 1;
  const thrust = engine.count * (engine.thrustVac - (engine.thrustVac - engine.thrustSL) * p) * clamp(throttle, 0, 1) * factor;
  const isp = engine.ispVac - (engine.ispVac - engine.ispSL) * p;
  return { thrust, isp, massFlow: thrust / (isp * G0) };
}
/** Independent mutable vehicle instance; data definitions are never mutated.
 * @param {{stages: Stage[], payloadMass: number}} definition
 */
export function createVehicle(definition) {
  const stages = definition.stages.map(s => ({ ...structuredClone(s), propellant: s.propellantMass, attached: true }));
  return {
    stages, payloadMass: definition.payloadMass,
    get mass() { return this.payloadMass + stages.reduce((m, s) => m + (s.attached ? s.dryMass + s.propellant : 0), 0); },
    separate(id) { const s = stages.find(s => s.id === id); if (!s || !s.attached) return false; s.attached = false; return true; },
    burn(id, dt, pressure, throttle = 1, time = 0) {
      const s = stages.find(s => s.id === id);
      if (!s?.attached || s.propellant <= 0) return { thrust: 0, massFlow: 0, consumed: 0 };
      const perf = enginePerformance(s.engine, pressure, throttle, time);
      const consumed = Math.min(s.propellant, perf.massFlow * dt);
      s.propellant -= consumed;
      return { ...perf, consumed, thrust: dt > 0 && perf.massFlow > 0 ? perf.thrust * consumed / (perf.massFlow * dt) : 0 };
    }
  };
}
