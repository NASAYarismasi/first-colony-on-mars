import { createMission } from '../sim/mission.js';

// GAME ASSUMPTION: presentation choices, never flight dynamics or event triggers.
// Team lead: whole flight in 2–3 real minutes. Key events still play at ×1 (shorter lead/hold).
export const PACING = Object.freeze({ easingSeconds: .25, logSlope: 9, eventLead: .7, eventHold: .6, landingRealtime: 9,
  ascent: 90, burn: 4000, coast: 40000, cruise: 12000000, edl: 100, orbitDwell: 2.1 });

/** Compute a deterministic reference through public flight commands. Event times are
 * predictions only; the live mission remains the authority for every transition.
 * Cached by the host, not global: no wall clock, DOM, renderer or mutable singleton.
 */
export function createPacingPlan() {
  const mission = createMission(), phases = {}, events = {};
  mission.launch();
  let previous = 'ASCENT', phaseStart = 0;
  for (let tick = 0; tick < 400000; tick++) {
    const s = mission.state;
    if (s.phase !== previous) {
      phases[previous] = s.time - phaseStart;
      previous = s.phase; phaseStart = s.time;
    }
    if (['LANDED', 'FAILED'].includes(s.phase)) break;
    if (['PARKING_ORBIT', 'MARS_ORBIT'].includes(s.phase)) mission.burn();
    if (s.phase === 'CRUISE' && mission.advanceCoast(s.transfer.duration - s.cruiseTime) > 0) continue;
    mission.step(.02);
  }
  if (mission.state.phase !== 'LANDED') throw new Error('Nominal pacing reference did not land');
  events.ASCENT = mission.state.ascent.state.events.filter(e => !['LIFTOFF', 'ASCENT_FAILED'].includes(e.type));
  events.EDL = mission.state.edl.state.events;
  for (const phase of ['TMI_BURN', 'CRUISE', 'MOI_BURN', 'DEORBIT']) events[phase] = [{ type: `${phase}_END`, time: phases[phase] }];
  // The nominal max-Q record is emitted at insertion but contains its actual peak time.
  for (const list of Object.values(events)) list.sort((a, b) => a.time - b.time);
  return { phases, events };
}

/** Pure projection. Nominal forecasts slow the view; they never advance the mission. */
export function pacingFrame(telemetry, plan) {
  const { phase, phaseTime = 0 } = telemetry;
  const list = plan.events[phase] ?? [];
  const next = list.find(e => e.time >= phaseTime - 1e-6);
  const last = list.findLast(e => e.time < phaseTime);
  return { ...telemetry, nextEvent: next?.type, timeToEvent: next ? Math.max(0, next.time - phaseTime) : Infinity,
    lastEvent: last?.type, sinceEvent: Math.min(phaseTime, last ? phaseTime - last.time : Infinity),
    timeToTouchdown: phase === 'EDL' ? Math.max(0, plan.phases.EDL - phaseTime) : Infinity };
}

export function pacingTarget(frame, limits = PACING) {
  const { phase, timeToEvent = Infinity, sinceEvent = Infinity } = frame;
  const vacuum=['PARKING_ORBIT','TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT','DEORBIT'].includes(phase);
  if(vacuum){
    const maximum=phase==='CRUISE'?limits.cruise:phase==='DEORBIT'?limits.coast:phase.includes('ORBIT')?100:limits.burn;
    const approach=(timeToEvent-limits.eventLead)/(limits.easingSeconds+1/limits.logSlope);
    return sinceEvent<limits.eventHold?100:Math.max(100,Math.min(maximum,approach));
  }

  let peak = ({ ASCENT: limits.ascent, PARKING_ORBIT: limits.coast, TMI_BURN: limits.burn,
    CRUISE: limits.cruise, MOI_BURN: limits.burn, MARS_ORBIT: limits.coast, DEORBIT: limits.coast, EDL: limits.edl })[phase] ?? 1;
  if (phase === 'PARKING_ORBIT' || phase === 'MARS_ORBIT') peak = 1;
  // Final descent (retro-rockets, dust plume, touchdown) always plays in real time.
  if (phase === 'EDL' && frame.timeToTouchdown < limits.landingRealtime) peak = 1;
  // Give the camera time to show both boosters clearing the core and the upper stage pulling away.
  const separation = ['SRB_SEPARATION','CORE_SEPARATION','MECO','ICPS_IGNITION','LAS_JETTISON'].includes(frame.lastEvent);
  if (sinceEvent < (separation ? 2.6 : limits.eventHold)) return 1;
  // Braking envelope leaves both the logarithmic deceleration distance and
  // the easing lag ahead of the event. A long cruise cannot jump over ignition.
  const approach = Math.max(1, (timeToEvent - limits.eventLead) / (limits.easingSeconds + 1 / limits.logSlope));
  return Math.max(1, Math.min(peak, approach));
}

/** Continuous log-space rate, with a bounded change per real second. The host
 * negotiates discrete mission warp carriers separately; this is the playback clock.
 */
export function createPacingDirector(plan, options = {}) {
  const limits = { ...PACING, ...options };
  let rate = 1, targetRate = 1, mode = 'automatic', dwell = 0, lastPhase;
  return {
    get mode() { return mode; }, get rate() { return rate; }, get targetRate() { return targetRate; },
    setManual(value = rate) { mode = 'manual'; rate = targetRate = value; dwell = 0; },
    toggle(value = rate) { mode = mode === 'automatic' ? 'manual' : 'automatic'; rate = targetRate = value; dwell = 0; },
    reset() { mode = 'automatic'; rate = targetRate = 1; dwell = 0; lastPhase = undefined; },
    update(telemetry, realSeconds) {
      if (!(Number.isFinite(realSeconds) && realSeconds >= 0)) throw new RangeError('Invalid pacing interval');
      if (telemetry.phase !== lastPhase) { dwell = 0; lastPhase = telemetry.phase; }
      if (mode === 'manual') return { mode, rate, targetRate, burn: false };
      dwell += realSeconds;
      targetRate = pacingTarget(pacingFrame(telemetry, plan), limits);
      const difference = Math.log(targetRate) - Math.log(rate);
      const eased = difference * (1 - Math.exp(-realSeconds * 3 / limits.easingSeconds));
      const change = Math.max(-limits.logSlope * realSeconds, Math.min(limits.logSlope * realSeconds, eased));
      rate = Math.exp(Math.log(rate) + change);
      if(['PARKING_ORBIT','TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT','DEORBIT'].includes(telemetry.phase))rate=Math.max(100,rate);
      return { mode, rate, targetRate,
        burn: ['PARKING_ORBIT', 'MARS_ORBIT'].includes(telemetry.phase) && dwell >= limits.orbitDwell };
    }
  };
}
