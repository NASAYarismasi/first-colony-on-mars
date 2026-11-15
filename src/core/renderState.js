import { EARTH, MARS, EARTH_SURFACE_RATE } from '../sim/constants.js';
import { earthAtmosphere, marsAtmosphere } from '../sim/atmosphere.js';
import { stateToElements, polarState } from '../sim/orbit.js';

export const isMarsPhase = phase => ['MOI_BURN', 'MARS_ORBIT', 'DEORBIT', 'EDL', 'LANDED'].includes(phase);
/** Snapshot all mutable sim data before a tick. Rendering never receives a live mission object. */
export function captureRenderState(mission, countdown, debris) {
  const t = mission.getTelemetry(), s = mission.state, mars = isMarsPhase(t.phase);
  const planet = mars ? MARS : EARTH, rate = mars ? MARS.rotation : EARTH_SURFACE_RATE;
  let polar = s.ascent.state.vector, pitch = s.ascent.state.pitch;
  let orbit = null;
  if (s.edl) { polar = s.edl.state.vector; pitch = Math.PI / 2; }
  else if (s.orbitState) {
    const { position: p, velocity: v } = s.orbitState, r = Math.hypot(...p);
    polar = [r, Math.atan2(p[1], p[0]), (p[0] * v[0] + p[1] * v[1]) / r, (p[0] * v[1] - p[1] * v[0]) / r];
    pitch = Math.atan2(polar[2], polar[3]);
    orbit = stateToElements(s.orbitState, planet.mu);
  }
  const theta = polar[1] - rate * t.missionTime;
  if (!orbit) orbit = stateToElements(polarState(polar), planet.mu);
  const atm = (mars ? marsAtmosphere : earthAtmosphere)(t.altitude ?? 0);
  const stages = s.ascent.state.vehicle.stages.map(st => ({ id: st.id, propellant: st.propellant, attached: st.attached }));
  return { ...t, flightPathAngle: t.flightPathAngle ?? Math.atan2(polar[2],polar[3]), mars, radius: planet.radius, rotation: planet.rotation * t.missionTime,
    position: [polar[0] * Math.sin(theta), polar[0] * Math.cos(theta) - planet.radius, 0],
    velocityVector: [polar[2] * Math.sin(theta) + polar[3] * Math.cos(theta), polar[2] * Math.cos(theta) - polar[3] * Math.sin(theta), 0],
    theta, attitude: pitch - theta - Math.PI / 2, polar: [...polar], orbit,
    pressure: t.phase==='CRUISE'?0:atm.pressure, density: t.phase==='CRUISE'?0:atm.density,
    stages, lasAttached: s.ascent.state.lasAttached,
    countdown: { ...countdown.state, events: [...countdown.state.events] },
    events: [...countdown.state.events, ...s.ascent.state.events, ...s.events, ...(s.edl?.state.events ?? []).map(e => ({ ...e, time: t.missionTime - s.edl.state.time + e.time }))],
    debris: debris.bodies.map(b => ({ ...b, vector: [...b.vector] })),
    transfer: { ...s.transfer }, commandedThrottle: s.throttle,
  };
}
