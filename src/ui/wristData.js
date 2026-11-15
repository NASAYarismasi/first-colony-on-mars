import { CREW_RATES } from '../data/sls.js';
import { AU, DAY } from '../sim/constants.js';
import { SOL } from '../sim/landingPayload.js';
import { roles } from '../colony/mars-koloni.mjs';
import { PHASE_LABELS } from './flightAdapters.js';
import { nextEvent } from './presentation.js';

// Read-only UI projections. Flight mass uses NASA Ames rates from sls.js;
// colony units are person-sols, as defined in landingPayload.js (not kilograms).
const finite = value => Number.isFinite(value) ? value : null;
const stock = value => Number.isFinite(value) ? Math.max(0, value) : null;
const pad = value => String(value).padStart(2, '0');

export function wristMET(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const t = Math.floor(Math.abs(seconds) + 1e-6), days = Math.floor(t / DAY);
  return `${seconds < 0 ? 'T−' : 'T+'} ${days ? `${days}d ` : ''}${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
}

function crewData(crew, colony) {
  return (Array.isArray(crew) ? crew : []).map((person, index) => ({
    id: person.id, name: person.name ?? `Astronaut ${index + 1}`,
    health: finite(person.health), alive: person.health > 0, role: person.role ?? null,
    roleLabel: roles[person.role] ?? (colony ? "Unassigned" : "Flight crew"),
  }));
}

/** @param {object} telemetry Mission snapshot; missing samples stay unknown. */
export function flightWristData(telemetry = {}) {
  const t = telemetry ?? {}, crew = crewData(t.crew, false);
  const resources = Object.fromEntries(Object.entries(CREW_RATES).map(([key, rate]) => {
    const kg = stock(t.supplies?.[key]);
    // Match the flight sim's actual consumption: rate × current crew count.
    return [key, { kg, days: kg !== null && crew.length ? kg / (rate * crew.length) : null }];
  }));
  const cruise = t.phase === 'CRUISE';
  const ship = t.heliocentric?.ship;
  const distance = cruise ? (Array.isArray(ship) && ship.length && ship.every(Number.isFinite) ? Math.hypot(...ship) / AU : null)
    : (finite(t.altitude) === null ? null : t.altitude / 1000);
  const speed = finite(cruise ? t.heliocentric?.speed : t.surfaceVelocity ?? t.velocity);
  // nextEvent's legacy adapter expects full countdown and stage objects.
  const eventTelemetry = { ...t, countdown: t.countdown ?? { running: false }, stages: t.stages ?? [] };
  if (t.phase === 'ASCENT') {
    eventTelemetry.stages = ['srb', 'core'].map(id => t.stages?.find(stage => stage.id === id) ?? { id, attached: false });
  }
  const missionTime = t.phase === 'PRELAUNCH' ? finite(t.countdown?.time) ?? finite(t.missionTime) : finite(t.missionTime);
  return {
    mode: 'flight', phase: t.phase ?? null, phaseLabel: PHASE_LABELS[t.phase] ?? "Awaiting telemetry",
    missionTime, met: wristMET(missionTime), crew, livingCrew: crew.filter(person => person.alive).length,
    resources, nextEvent: nextEvent(eventTelemetry),
    power: { enabled: typeof t.cabinPower === 'boolean' ? t.cabinPower : null },
    navigation: {
      distance, distanceLabel: cruise ? "Distance to Sun" : "Altitude", distanceUnit: cruise ? 'AU' : 'km',
      velocity: speed === null ? null : speed / 1000, velocityUnit: 'km/s',
      velocityLabel: cruise ? "Sun-relative speed" : finite(t.surfaceVelocity) !== null ? "Surface-relative speed" : "Orbital speed",
    },
  };
}

function localTime(value) {
  if (typeof value === 'string' && value.trim()) return value;
  // Numeric LMST is decimal Mars clock hours, NOT elapsed SI seconds.
  if (Number.isFinite(value)) {
    const seconds = Math.floor(((value % 24 + 24) % 24) * 3600);
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  }
  if (value && Number.isFinite(value.hours ?? value.hour)) {
    return `${pad(value.hours ?? value.hour)}:${pad(value.minutes ?? value.minute ?? 0)}:${pad(value.seconds ?? value.second ?? 0)}`;
  }
  return null;
}

/** colony:state detail = {state, storm?, activeTask?, lmst?, headlamp?, sunElevationDeg?}. */
export function colonyWristData(detail = {}) {
  const d = detail ?? {}, state = d.state ?? {}, crew = crewData(state.crew, true);
  const livingCrew = crew.filter(person => person.alive).length;
  const resources = Object.fromEntries(Object.keys(CREW_RATES).map(key => {
    const personSols = stock(state.supplies?.[key]);
    const sols = personSols !== null && livingCrew > 0 ? personSols / livingCrew : null;
    return [key, { personSols, sols, days: sols === null ? null : sols * SOL / DAY }];
  }));
  const lastSol = state.timeline?.at(-1);
  const stormValue = d.storm ?? lastSol?.storm;
  const storm = typeof stormValue === 'boolean' ? stormValue : typeof stormValue?.active === 'boolean' ? stormValue.active : null;
  const task = typeof d.activeTask === 'string' ? d.activeTask : d.activeTask?.label ?? d.activeTask?.title ?? d.activeTask?.name;
  return {
    mode: 'colony', phaseLabel: "JEZERO / SURFACE OPERATIONS", sol: finite(state.sol), lmst: localTime(d.lmst),
    lifeSupport: d.lifeSupport ?? null, // IHAN-SRC: physical reserves are separate from person-sol stocks
    crew, livingCrew, resources, storm, stormLabel: storm === null ? "Awaiting weather data" : storm ? "Dust storm" : "Clear sky",
    activeTask: task || "No mission selected", nextEvent: task || "Colony operations",
    headlamp: typeof d.headlamp === 'boolean' ? d.headlamp : null, sunElevationDeg: finite(d.sunElevationDeg),
    // Use colony accounting directly. Energy is an educational game unit, never kWh.
    energy: { startup: finite(state.startupEnergy), battery: finite(state.battery),
      generation: finite(lastSol?.generation), used: finite(lastSol?.used), capacity: finite(lastSol?.capacity) },
  };
}
