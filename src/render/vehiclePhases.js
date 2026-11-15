import { MARS } from '../sim/constants.js';
import { entryFromOrbit } from '../sim/edl.js';

const LAUNCH = ['PRELAUNCH', 'ASCENT'];
const TRANSIT = ['PARKING_ORBIT', 'TMI_BURN', 'CRUISE', 'MOI_BURN', 'MARS_ORBIT'];
const DESCENT = ['DEORBIT', 'EDL', 'LANDED'];
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t*t*(3-2*t); };

/** Stable assembly IDs; visibility changes never select a replacement lander. */
export const VEHICLE_PART_IDS = Object.freeze({ orion: 'orion', lander: 'mars-lander', heatShield: 'heat-shield', backshell: 'mars-backshell' });

/** Pure presentation policy. FAILED preserves the last established assembly. */
export function vehicleConfiguration(state) {
  const events = state.events ?? [];
  const phase = state.phase === 'FAILED'
    ? [...events].reverse().find(event => [...LAUNCH, ...TRANSIT, ...DESCENT].includes(event.type))?.type ?? 'PRELAUNCH'
    : state.phase;
  if (![...LAUNCH, ...TRANSIT, ...DESCENT].includes(phase)) throw new RangeError(`Unknown vehicle phase: ${phase}`);
  const launch = LAUNCH.includes(phase), docked = TRANSIT.includes(phase), separated = DESCENT.includes(phase);
  const jettisoned = phase === 'LANDED' || events.some(event => ['HEATSHIELD_JETTISON', 'SRP_IGNITION'].includes(event.type));
  const deploy = events.find(event => event.type === 'LEGS_DEPLOYED');
  return {
    phase, launch, docked, separated, orion: launch || docked || phase === 'DEORBIT',
    transit: docked || phase === 'DEORBIT', lander: docked || separated,
    heatShield: (docked || separated) && !jettisoned,
    backshell: (docked || separated) && !jettisoned,
    cabin: separated ? 'lander' : 'orion',
    // GAME ASSUMPTION: 12 s visual rendezvous and 3 s mechanical leg deployment.
    docking: phase === 'PARKING_ORBIT' ? smooth((state.phaseTime ?? 0)/12) : 1,
    arrays: launch ? 0 : phase === 'PARKING_ORBIT' ? smooth((state.phaseTime ?? 0)/6) : 1,
    legs: phase === 'LANDED' ? 1 : deploy ? smooth((state.missionTime-deploy.time)/3) : 0,
    ladder: phase === 'LANDED',
    ntrBurn: ['TMI_BURN', 'MOI_BURN'].includes(phase) && Boolean(state.engineFiring) && (state.throttle ?? 1) > 0,
    ids: VEHICLE_PART_IDS
  };
}

/** Unpowered MTV remains on the pre-deorbit circular orbit. The lander position
 * is the actual snapshot, subtracted in doubles before upload to the GPU.
 * entryFromOrbit() supplies the same apoapsis/initial anomaly as the sim burn.
 * No extra separation trajectory, impulses, or simulation state writes.
 */
export function transitOrbitOffset(state) {
  const departure = state.events?.find(event => event.type === 'DEORBIT');
  if (!departure || !state.polar || !['DEORBIT', 'EDL', 'LANDED', 'FAILED'].includes(state.phase)) return [0, 0, 0];
  const { a, e } = entryFromOrbit(), radius = a*(1+e);
  const angle = Math.PI + Math.sqrt(MARS.mu/radius**3)*Math.max(0, state.missionTime-departure.time) - state.polar[1];
  return [radius*Math.sin(angle), radius*Math.cos(angle)-state.polar[0], 0];
}
