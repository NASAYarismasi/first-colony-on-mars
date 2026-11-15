import { EARTH, EARTH_SURFACE_RATE, G0 } from './constants.js';
import { earthAtmosphere } from './atmosphere.js';
import { createVehicle, enginePerformance, dragForce } from './vehicle.js';
import { polarState, stateToElements } from './orbit.js';
import { clamp, rk4 } from './numerics.js';
import { SLS } from '../data/sls.js';

// GAME ASSUMPTION: direct ~185 km crew parking orbit, not Artemis I's 30 x 1800 km insertion.
// KSC rotation projected into an equatorial plane; no inclination, J2, wind or crossrange.
/** @param {{targetAltitude?: number, pitchKick?: number}} options Target metres, kick rate rad/s. */
export function createAscent({ targetAltitude = 185000, pitchKick = .012 } = {}) {
  const vehicle = createVehicle(SLS);
  vehicle.payloadMass += SLS.lasMass;
  const state = {
    time: 0, vector: [EARTH.radius, 0, 0, EARTH_SURFACE_RATE * EARTH.radius],
    vehicle, status: 'READY', stage: 'core', throttle: 1, throttleCommand: 1,
    events: [], maxQ: { time: 0, value: 0 }, maxAcceleration: 0, lasAttached: true,
    targetAltitude, pitchKick, pitch: Math.PI / 2, coreOff: false, separationTime: null
  };
  const event = type => state.events.push({ type, time: state.time });
  const getStage = id => vehicle.stages.find(s => s.id === id);
  function guidance(vector) {
    const [r, , vr, vt] = vector, h = r - EARTH.radius;
    const rel = vt - EARTH_SURFACE_RATE * r;
    if (state.time < 12) return Math.PI / 2;
    if (state.time < 20) return Math.PI / 2 - state.pitchKick * (state.time - 12);
    if (h < 55000) return Math.atan2(vr, Math.max(1, rel)); // gravity turn: align with air-relative velocity.
    // Closed-loop radial control: reduce climb as target altitude approaches; gravity compensation
    // decreases naturally as horizontal velocity approaches circular speed.
    const thrust = state.coreOff ? 110000 : 4 * 2.279e6 * state.throttle;
    const a = thrust / vehicle.mass;
    const desiredVr = clamp((state.targetAltitude - h) / 100, -120, 650);
    const desiredAr = (desiredVr - vr) / 35;
    const radialThrust = desiredAr + EARTH.mu / r ** 2 - vt ** 2 / r;
    return Math.asin(clamp(radialThrust / a, -.5, .9));
  }
  function forces(vector, time, props, throttle, pitch) {
    const [r, , vr, vt] = vector;
    const atm = earthAtmosphere(r - EARTH.radius), rel = vt - EARTH_SURFACE_RATE * r;
    const speed = Math.hypot(vr, rel);
    const drag = dragForce(atm.density, speed, SLS.referenceArea, speed / atm.speedOfSound);
    let thrust = 0;
    const flows = vehicle.stages.map((s, i) => {
      const firing = state.status === 'FLYING' && s.attached && props[i] > 0 && (s.id === 'srb' ? time < SLS.stages[0].burnTime : s.id === 'core' ? !state.coreOff : state.coreOff && state.separationTime !== null && time >= state.separationTime + 2);
      if (!firing) return 0;
      const perf = enginePerformance(s.engine, atm.pressure, s.id === 'srb' ? 1 : throttle, time);
      thrust += perf.thrust;
      return -perf.massFlow;
    });
    const mass = vehicle.payloadMass + vehicle.stages.reduce((m, s, i) => m + (s.attached ? s.dryMass + Math.max(0, props[i]) : 0), 0);
    const ar = (thrust * Math.sin(pitch) - (speed ? drag * vr / speed : 0)) / mass;
    const at = (thrust * Math.cos(pitch) - (speed ? drag * rel / speed : 0)) / mass;
    return { thrust, drag, mass, ar, at, flows, atm, speed, q: .5 * atm.density * speed ** 2 };
  }
  function step(dt) {
    if (state.status !== 'FLYING') return;
    const props = vehicle.stages.map(s => s.propellant);
    const [r, , vr, vt] = state.vector;
    const atm = earthAtmosphere(r - EARTH.radius);
    const speed = Math.hypot(vr, vt - EARTH_SURFACE_RATE * r);
    const q = .5 * atm.density * speed ** 2;
    let throttle = state.throttleCommand;
    if (!state.coreOff) {
      // GAME ASSUMPTION: max-Q throttle bucket and 3.8 g proper acceleration limiter.
      if (q > 28000 && state.time < 110) throttle = Math.min(throttle, clamp(1 - (q - 28000) / 15000, .615, 1));
      throttle = Math.min(throttle, 3.8 * G0 * vehicle.mass / (4 * 2.279e6));
      if (throttle > 0) throttle = Math.max(.615, throttle);
    }
    state.throttle = throttle;
    state.pitch = guidance(state.vector);
    const full = [...state.vector, ...props];
    const next = rk4(full, state.time, dt, (s, t) => {
      const f = forces(s, t, s.slice(4), throttle, state.pitch);
      return [s[2], s[3] / s[0], s[3] ** 2 / s[0] - EARTH.mu / s[0] ** 2 + f.ar, f.at - s[2] * s[3] / s[0], ...f.flows];
    });
    state.vector = next.slice(0, 4);
    vehicle.stages.forEach((s, i) => { s.propellant = Math.max(0, next[4 + i]); });
    state.time += dt;
    const f = forces(state.vector, state.time, vehicle.stages.map(s => s.propellant), throttle, state.pitch);
    state.maxAcceleration = Math.max(state.maxAcceleration, Math.hypot(f.ar, f.at));
    if (f.q > state.maxQ.value) state.maxQ = { time: state.time, value: f.q };
    if (getStage('srb').attached && (state.time >= 126 || getStage('srb').propellant <= 0)) {
      vehicle.separate('srb'); event('SRB_SEPARATION');
    }
    if (state.lasAttached && state.vector[0] - EARTH.radius > 80000) {
      vehicle.payloadMass -= SLS.lasMass; state.lasAttached = false; event('LAS_JETTISON');
    }
    const elements = stateToElements(polarState(state.vector), EARTH.mu);
    if (!state.coreOff && (getStage('core').propellant <= 0 || elements.periapsis - EARTH.radius >= 140000)) {
      state.coreOff = true; event('MECO'); vehicle.separate('core');
      state.separationTime = state.time; state.stage = 'icps'; event('CORE_SEPARATION');
    }
    if (state.coreOff && !state.events.some(e => e.type === 'ICPS_IGNITION') && state.time >= state.separationTime + 2) event('ICPS_IGNITION');
    if (state.coreOff && elements.periapsis - EARTH.radius > 180000 && Math.abs(state.vector[2]) < 35) {
      state.status = 'ORBIT'; state.throttle = 0; event('ORBIT_INSERTION');
      state.events.push({ type: 'MAX_Q', ...state.maxQ });
    }
    if (state.vector[0] < EARTH.radius - 1 || state.time > 900 || (state.coreOff && getStage('icps').propellant <= 0)) {
      state.status = 'FAILED'; event('ASCENT_FAILED');
    }
  }
  function getTelemetry() {
    const [r, theta, vr, vt] = state.vector;
    const f = forces(state.vector, state.time, vehicle.stages.map(s => s.propellant), state.status === 'FLYING' ? state.throttle : 0, state.pitch);
    const orbit = stateToElements(polarState(state.vector), EARTH.mu);
    return {
      time: state.time, altitude: r - EARTH.radius, downrange: EARTH.radius * (theta - EARTH_SURFACE_RATE * state.time),
      velocity: Math.hypot(vr, vt), surfaceVelocity: f.speed, verticalSpeed: vr,
      acceleration: Math.hypot(f.ar, f.at), mach: f.speed / f.atm.speedOfSound, dynamicPressure: f.q,
      pressure: f.atm.pressure, density: f.atm.density, thrust: f.thrust,
      throttle: state.throttle, stage: state.stage, mass: vehicle.mass, pitch: state.pitch,
      propellant: Object.fromEntries(vehicle.stages.map(s => [s.id, s.propellant])),
      flightPathAngle: Math.atan2(vr, vt), apoapsis: orbit.apoapsis - EARTH.radius, periapsis: orbit.periapsis - EARTH.radius,
      maxQ: { ...state.maxQ }, maxAcceleration: state.maxAcceleration,
      engineFiring: state.status === 'FLYING' && f.thrust > 0, inAtmosphere: r - EARTH.radius < 120000,
      status: state.status
    };
  }
  return { state, step, getTelemetry, launch() { if (state.status === 'READY') { state.status = 'FLYING'; event('LIFTOFF'); } },
    setThrottle(value) { state.throttleCommand = clamp(value, 0, 1); },
    stage() { if (getStage('srb').propellant <= 0) return vehicle.separate('srb'); return false; } };
}
