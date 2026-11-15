import { DAY, EARTH, MARS, G0 } from './constants.js';
import { CREW_RATES, LANDER, SLS, TRANSIT } from '../data/sls.js';
import { createAscent } from './ascent.js';
import { createEDL, entryFromOrbit } from './edl.js';
import { elementsToState, polarState, propagateKepler } from './orbit.js';
import { hohmannTransfer, heliocentricAt } from './transfer.js';
import { rocketDeltaV } from './vehicle.js';
import { buildLandingPayload } from './landingPayload.js';
import { clamp } from './numerics.js';

export const MISSION_PHASES = Object.freeze(['PRELAUNCH', 'ASCENT', 'PARKING_ORBIT', 'TMI_BURN', 'CRUISE', 'MOI_BURN', 'MARS_ORBIT', 'DEORBIT', 'EDL', 'LANDED', 'FAILED']);
// 400000: cruise is propagated analytically (advanceCoast), so the playback director can show 259 days in ~1 min.
import { warpWithinGuard } from './warpGuard.js';
export const ALLOWED_WARPS = Object.freeze([1, 2, 5, 10, 50, 1000, 100000, 400000, 3000000]);

/** Consumables are gross metabolic demand without recycling, SI kg. Returns actual supported seconds. */
export function consumeSupplies(state, seconds) {
  const available = Math.min(...Object.keys(CREW_RATES).map(k => state.supplies[k] / (CREW_RATES[k] * state.crew.length / DAY)));
  const supported = Math.min(seconds, available);
  for (const [name, rate] of Object.entries(CREW_RATES)) state.supplies[name] = Math.max(0, state.supplies[name] - supported * rate * state.crew.length / DAY);
  return supported;
}

/** @param {{crewCount?: number, supplyDuration?: number, supplies?: {oxygen: number, water: number, food: number}, landingSite?: string}} options supplyDuration is in SI seconds. */
export function createMission({ crewCount = 3, supplyDuration = 320 * DAY, supplies, landingSite = 'flat' } = {}) {
  if (!Number.isInteger(crewCount) || crewCount < 1) throw new RangeError('At least one crew member required');
  const ascent = createAscent();
  const state = {
    phase: 'PRELAUNCH', time: 0, phaseTime: 0, warp: 1, failureReason: null,
    cabinPower: true, // GAME ASSUMPTION: powered cabin bus; no electrical load model.
    crew: Array.from({ length: crewCount }, (_, i) => ({ id: `astronaut-${i + 1}`, health: 100 })),
    supplies: supplies ? { ...supplies } : Object.fromEntries(Object.entries(CREW_RATES).map(([k, v]) => [k, v * crewCount * supplyDuration / DAY])),
    // GAME ASSUMPTION: README colony inventory; terrain changes surface energy only in this foundation.
    spareParts: 1, modules: ['habitat', 'solarPanel', 'battery', 'oxygenUnit', 'waterRecycler', 'greenhouse'],
    landingSite, surfaceEnergy: landingSite === 'flat' ? 8 : 6, events: [],
    ascent, orbitState: null, edl: null, transfer: hohmannTransfer({ earthAltitude: 185000 }), cruiseTime: 0,
    transit: { dryMass: TRANSIT.dryMass, payloadMass: TRANSIT.landerMass + SLS.payloadMass, propellant: TRANSIT.propellantMass, isp: TRANSIT.isp },
    burnRemaining: 0, burnDelivered: 0, throttle: 1, deorbitDuration: 0, deorbitPropellant: 0
  };
  function transition(phase) {
    state.phase = phase; state.phaseTime = 0; state.events.push({ type: phase, time: state.time });
  }
  function fail(reason) { state.failureReason = reason; state.warp = 1; transition('FAILED'); }
  const supplyMass = () => Object.values(state.supplies).reduce((s, v) => s + v, 0);
  function tickResources(dt) {
    const supported = consumeSupplies(state, dt);
    state.time += supported; state.phaseTime += supported;
    if (supported < dt - 1e-8) {
      state.crew.forEach(c => { c.health = 0; });
      fail("Life support supplies depleted."); return false;
    }
    return true;
  }
  function burnStep(dt) {
    const mass = state.transit.dryMass + state.transit.payloadMass + state.transit.propellant + supplyMass();
    const mdot = TRANSIT.thrust * state.throttle / (TRANSIT.isp * G0);
    const fuel = Math.min(state.transit.propellant, mdot * dt, mass * (1 - Math.exp(-state.burnRemaining / (TRANSIT.isp * G0))));
    const delivered = rocketDeltaV(mass, mass - fuel, TRANSIT.isp);
    state.transit.propellant -= fuel;
    state.burnRemaining = Math.max(0, state.burnRemaining - delivered); state.burnDelivered += delivered;
    if (state.burnRemaining < 1e-7) {
      if (state.phase === 'TMI_BURN') transition('CRUISE');
      else {
        state.orbitState = elementsToState({ a: MARS.radius + 250000, e: 0 }, MARS.mu);
        transition('MARS_ORBIT');
      }
    } else if (state.transit.propellant <= 0) fail("Transfer vehicle propellant depleted.");
  }
  /** Advance an analytical unpowered coast in exact multiples of the fixed physics tick.
   * CRUISE ends only at the Hohmann arrival time, not a UI presentation timer.
   */
  function advanceCoast(seconds) {
    const phase = state.phase;
    if (!['CRUISE', 'PARKING_ORBIT', 'MARS_ORBIT'].includes(phase) || seconds <= 0) return 0;
    const remaining = phase === 'CRUISE' ? state.transfer.duration - state.cruiseTime : seconds;
    const elapsed = Math.min(seconds, Math.floor((remaining + 1e-9) / .02) * .02);
    if (elapsed < .02 - 1e-10) return 0;
    coast(elapsed);
    return elapsed;
  }
  function coast(dt) {
    const phase = state.phase;
    if (!tickResources(dt)) return;
    if (phase === 'CRUISE') {
      state.cruiseTime = Math.min(state.transfer.duration, state.cruiseTime + dt);
      if (state.cruiseTime >= state.transfer.duration - 1e-7) beginBurn('MOI_BURN', state.transfer.captureDeltaV);
    } else {
      state.orbitState = propagateKepler(state.orbitState, dt, phase === 'PARKING_ORBIT' ? EARTH.mu : MARS.mu);
    }
  }
  function step(dt) {
    if (['PRELAUNCH', 'LANDED', 'FAILED'].includes(state.phase)) return;
    if (['CRUISE', 'PARKING_ORBIT', 'MARS_ORBIT'].includes(state.phase)) { coast(dt); return; }
    if (!tickResources(dt)) return;
    if (state.phase === 'ASCENT') {
      ascent.step(dt);
      if (ascent.state.status === 'ORBIT') { state.orbitState = polarState(ascent.state.vector); transition('PARKING_ORBIT'); }
      if (ascent.state.status === 'FAILED') fail("Launch failed to reach a safe orbit.");
    } else if (['TMI_BURN', 'MOI_BURN'].includes(state.phase)) burnStep(dt);
    else if (state.phase === 'DEORBIT') {
      state.orbitState = propagateKepler(state.orbitState, dt, MARS.mu);
      if (state.phaseTime >= state.deorbitDuration) {
        // Feed the propagated state, not an independently reset entry speed.
        const { position: p, velocity: v } = state.orbitState;
        const r = Math.hypot(...p), theta = Math.atan2(p[1], p[0]);
        state.edl = createEDL({ vector: [r, theta, (p[0] * v[0] + p[1] * v[1]) / r, (p[0] * v[1] - p[1] * v[0]) / r], propellant: LANDER.propellantMass - state.deorbitPropellant });
        transition('EDL');
      }
    } else if (state.phase === 'EDL') {
      state.edl.step(dt);
      if (state.edl.state.status === 'LANDED') transition('LANDED');
      if (state.edl.state.status === 'FAILED') fail("The lander failed to achieve a safe touchdown.");
    }
    if (state.warp > 10 && !canSetWarp(state.warp)) state.warp = 10;
  }
  function beginBurn(phase, deltaV) { state.burnRemaining = deltaV; state.burnDelivered = 0; state.throttle = 1; transition(phase); state.warp = Math.min(10, state.warp); }
  function burn() {
    if (state.phase === 'PARKING_ORBIT') {
      // The preassembled transit vehicle takes over in LEO; ICPS stays behind.
      // GAME ASSUMPTION: rendezvous/separation impulse is not modelled.
      if (ascent.state.vehicle.separate('icps')) state.events.push({ type: 'ICPS_SEPARATION', time: state.time });
      beginBurn('TMI_BURN', state.transfer.departureDeltaV); return true;
    }
    if (state.phase === 'MARS_ORBIT') {
      const entry = entryFromOrbit();
      state.deorbitPropellant = LANDER.propellantMass + LANDER.dryMass;
      state.deorbitPropellant *= 1 - Math.exp(-entry.deltaV / (LANDER.isp * G0));
      const E = 2 * Math.atan2(Math.sqrt(1 - entry.e) * Math.sin(entry.trueAnomaly / 2), Math.sqrt(1 + entry.e) * Math.cos(entry.trueAnomaly / 2));
      const M = E - entry.e * Math.sin(E);
      state.deorbitDuration = (M - Math.PI) / Math.sqrt(MARS.mu / entry.a ** 3);
      state.orbitState = elementsToState({ a: entry.a, e: entry.e, trueAnomaly: Math.PI }, MARS.mu);
      transition('DEORBIT'); return true;
    }
    return false;
  }
  function getTelemetry() {
    let physics = {};
    if (['PRELAUNCH', 'ASCENT'].includes(state.phase)) physics = ascent.getTelemetry();
    else if (state.edl) physics = state.edl.getTelemetry();
    else if (state.orbitState && state.phase !== 'CRUISE') {
      const mu = ['PARKING_ORBIT', 'TMI_BURN'].includes(state.phase) ? EARTH : MARS;
      const { position: p, velocity: v } = state.orbitState;
      physics = { altitude: Math.hypot(...p) - mu.radius, velocity: Math.hypot(...v), verticalSpeed: p.reduce((sum, x, i) => sum + x * v[i], 0) / Math.hypot(...p), inAtmosphere: false };
    }
    return { ...physics, phase: state.phase, missionTime: state.time, phaseTime: state.phaseTime,
      crew: state.crew.map(c => ({ ...c })), supplies: { ...state.supplies }, warp: state.warp, cabinPower: state.cabinPower,
      failureReason: state.failureReason, transitPropellant: state.transit.propellant,
      burnRemaining: state.burnRemaining, burnDelivered: state.burnDelivered,
      engineFiring: state.phase === 'ASCENT' ? Boolean(physics.engineFiring) : ['TMI_BURN', 'MOI_BURN'].includes(state.phase) ? state.throttle > 0 : state.phase === 'EDL' && Boolean(physics.engineFiring),
      inAtmosphere: Boolean(physics.inAtmosphere),
      cruiseProgress: state.cruiseTime / state.transfer.duration, heliocentric: heliocentricAt(state.cruiseTime, state.transfer),
      landingPayload: state.phase === 'LANDED' ? buildLandingPayload(state) : null };
  }
  // Fixed-timestep integration keeps physics identical at any warp; the guard only bounds steps per frame.
  // Vacuum burns (TMI/MOI) may run at ×50; anything in the atmosphere stays ≤ ×10.
  function canSetWarp(warp) { const t = getTelemetry(); return ALLOWED_WARPS.includes(warp) && warpWithinGuard(warp, t); }
  return { state, step, advanceCoast, getTelemetry,
    launch() { if (state.phase !== 'PRELAUNCH') return false; ascent.launch(); transition('ASCENT'); return true; },
    setThrottle(value) {
      state.throttle = clamp(value, 0, 1); ascent.setThrottle(value);
      if (state.warp > 10 && !canSetWarp(state.warp)) state.warp = 10;
    },
    stage: () => state.phase === 'ASCENT' && ascent.stage(), burn,
    abort() { if (!['LANDED', 'FAILED'].includes(state.phase)) fail("Mission aborted by user."); },
    setWarp(warp) { if (!canSetWarp(warp)) return false; state.warp = warp; return true; }
  };
}
