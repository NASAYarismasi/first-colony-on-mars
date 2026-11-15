import { MARS_SOL_SECONDS } from './marsSun.js';
/** IHAN-SRC — host wiring for İhan's a7d5ce6 air/water models. No DOM/Three.js. */
import { AIR_DEFAULTS, WATER_DEFAULTS, createAirState, createWaterState, stepAir, stepWater } from './ihanLifeSupportModels.js';

export const LIFE_SOL_SECONDS = MARS_SOL_SECONDS;
// GAME ASSUMPTION: one colony energy unit represents 12 kWh for this physical
// projection. The original colony rules remain in educational energy units.
export const COLONY_ENERGY_KWH = 12;
const active = (state, type) => state.placed.filter(m => m.active && m.type === type).length;
const crewCount = state => state.crew.filter(p => p.health > 0).length;

export function lifePowerBudget(state, previous = state) {
  const day = state.timeline.at(-1);
  const storm = Boolean(day?.storm);
  const generation = day?.generation ?? active(state, 'solarPanel') * (storm ? 4 : 12);
  const stored = state === previous ? state.startupEnergy + state.battery : previous.startupEnergy + previous.battery;
  // Other colony loads have priority; the physical plants share only the remainder.
  const energyKWh = Math.max(0, stored + generation - (day?.used ?? 0)) * COLONY_ENERGY_KWH;
  return { energyKWh, powerKW: energyKWh / 24.66, storm, generation };
}

export function createLifeSupport(state) {
  const crew = crewCount(state);
  // Person-sol stocks -> physical reserves. No mutation of landing JSON or rule state.
  return { air: { ...createAirState(), oxygenKg: Math.min(15, state.supplies.oxygen * .84 * 24.66 / 24) },
    water: { ...createWaterState(), cleanL: Math.min(100, state.supplies.water * 3.52 * 24.66 / 24) },
    sol: state.sol, elapsedInSol: 0, crew, budget: lifePowerBudget(state), spentKWh: 0,
    airKW: 0, waterKW: 0 };
}

/** Seconds at the host boundary; fixed one-minute substeps at the vendor boundary.
 * Same partition for a sol button and real-time progression; never step >24.66 h.
 */
export function stepLifeSupport(support, seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError('Invalid life-support step');
  let s = { ...support };
  let remaining = seconds;
  while (remaining > 1e-8) {
    const dt = Math.min(60, remaining), hours = dt / 3600;
    const remainingEnergy = Math.max(0, s.budget.energyKWh - s.spentKWh);
    const available = Math.min(s.budget.powerKW, remainingEnergy / hours);
    // Fans and CO2 removal first, followed by water recovery, O2, ice extraction.
    let airKW = Math.min(.8, available), waterKW = Math.min(.3, available - airKW);
    let rest = available - airKW - waterKW;
    if (rest + 1e-9 >= 2.7) { airKW += 2.7; rest -= 2.7; }
    if (rest + 1e-9 >= 2) waterKW += 2;
    const air = stepAir(s.air, hours, { powerKW: airKW }, { ...AIR_DEFAULTS, crew: s.crew });
    const water = stepWater(s.water, hours, { powerKW: waterKW }, { ...WATER_DEFAULTS, crew: s.crew });
    const used = air.energyKWh + water.energyKWh - s.air.energyKWh - s.water.energyKWh;
    s = { ...s, air, water, airKW, waterKW, spentKWh: s.spentKWh + used, elapsedInSol: s.elapsedInSol + dt };
    remaining -= dt;
  }
  return s;
}

export function syncLifeSupport(support, previous, next, { simulate = true } = {}) {
  if (next.sol < previous.sol) return createLifeSupport(next);
  let s = { ...support, crew: crewCount(next) };
  if (next.sol > previous.sol) {
    // Complete the newly calculated sol using its actual storm/generation/load row.
    s.budget = lifePowerBudget(next, previous);
    if (simulate) s = stepLifeSupport(s, Math.max(0, LIFE_SOL_SECONDS - s.elapsedInSol));
    s = { ...s, sol: next.sol, elapsedInSol: 0, spentKWh: 0, budget: lifePowerBudget(next) };
  }
  return s;
}

export function lifeSupportTelemetry(s) {
  return { oxygenKg: s.air.oxygenKg, waterL: s.water.cleanL, air: { ...s.air }, water: { ...s.water },
    powerKW: (s.air.powerUsedKW ?? 0) + (s.water.powerUsedKW ?? 0),
    availableKW: s.budget.powerKW, spentKWh: s.spentKWh, crew: s.crew, sol: s.sol,
    energyKWhPerGameUnit: COLONY_ENERGY_KWH };
}
