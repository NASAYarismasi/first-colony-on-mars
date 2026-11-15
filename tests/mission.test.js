import { it, expect } from 'vitest';
import { createMission, consumeSupplies, MISSION_PHASES } from '../src/sim/mission.js';
import { CREW_RATES } from '../src/data/sls.js';
import { DAY } from '../src/sim/constants.js';
import { buildLandingPayload } from '../src/sim/landingPayload.js';
import { readFileSync } from 'node:fs';
it('consumes exactly 259 crew-days for 3 people and converts remaining kg to colony units', () => {
  const m = createMission(), before = { ...m.state.supplies };
  expect(consumeSupplies(m.state, 259 * DAY)).toBe(259 * DAY);
  for (const [name, rate] of Object.entries(CREW_RATES)) expect(before[name] - m.state.supplies[name]).toBeCloseTo(259 * 3 * rate, 8);
  const p = buildLandingPayload(m.state);
  const example = JSON.parse(readFileSync(new URL('../README.md', import.meta.url), 'utf8').match(/```json\s*([\s\S]*?)```/)[1]);
  function assertShape(actual, reference) {
    expect(typeof actual).toBe(typeof reference);
    if (Array.isArray(reference)) { expect(Array.isArray(actual)).toBe(true); expect(actual).toHaveLength(reference.length); actual.forEach((v, i) => assertShape(v, reference[i])); }
    else if (reference && typeof reference === 'object') { expect(Object.keys(actual).sort()).toEqual(Object.keys(reference).sort()); for (const key of Object.keys(reference)) assertShape(actual[key], reference[key]); }
  }
  assertShape(p, example);
  expect(Object.keys(p).sort()).toEqual(['crew', 'supplies', 'modules', 'landingSite', 'surfaceEnergy'].sort());
  expect(p.crew).toEqual([{ id: 'astronaut-1', health: 100 }, { id: 'astronaut-2', health: 100 }, { id: 'astronaut-3', health: 100 }]);
  expect(Object.keys(p.supplies).sort()).toEqual(['food', 'water', 'oxygen', 'spareParts'].sort());
  // 61 whole-crew days remain (~178 person-sols); the lander carries LANDER_SURFACE_SOLS crew-sols.
  for (const key of ['oxygen', 'water', 'food']) expect(p.supplies[key]).toBe(4);
  expect(p.modules).toEqual(['habitat', 'solarPanel', 'battery', 'oxygenUnit', 'waterRecycler', 'greenhouse']);
  expect(p.landingSite).toBe('flat'); expect(p.surfaceEnergy).toBe(8);
  p.crew[0].health = 0; p.modules.pop();
  expect(m.state.crew[0].health).toBe(100); expect(m.state.modules).toHaveLength(6);
});
it('flies the full state machine, burns real fuel, coasts to Mars, deorbits and delivers the landing payload', () => {
  const m = createMission();
  expect(m.burn()).toBe(false); expect(m.setWarp(1000)).toBe(false);
  expect(m.launch()).toBe(true); expect(m.launch()).toBe(false);
  const phases = new Set(['PRELAUNCH']);
  for (let i = 0; i < 300000 && !['LANDED', 'FAILED'].includes(m.state.phase); i++) {
    phases.add(m.state.phase);
    if (['PARKING_ORBIT', 'MARS_ORBIT'].includes(m.state.phase)) expect(m.burn()).toBe(true);
    if (m.state.phase === 'CRUISE') {
      expect(m.setWarp(100000)).toBe(true);
      const elapsed = m.advanceCoast(m.state.transfer.duration - m.state.cruiseTime);
      if (elapsed === 0) m.step(.02);
    } else m.step(.02);
  }
  expect(m.state.failureReason).toBeNull(); expect(m.state.phase).toBe('LANDED');
  for (const phase of MISSION_PHASES.filter(p => !['FAILED', 'LANDED'].includes(p))) expect(phases.has(phase) || m.state.events.some(e => e.type === phase)).toBe(true);
  const t = m.getTelemetry();
  expect(t.missionTime / DAY).toBeGreaterThan(258.9); expect(t.missionTime / DAY).toBeLessThan(260);
  expect(t.transitPropellant).toBeGreaterThan(0); expect(t.transitPropellant).toBeLessThan(20000);
  expect(t.propellant).toBeGreaterThan(0); expect(t.touchdownSpeed).toBeLessThan(2.5);
  expect(t.landingPayload).toEqual(buildLandingPayload(m.state));
  expect(t.landingPayload.supplies.food).toBeLessThan(62);
});
it('does not consume fuel during a zero-throttle burn and aborts without proceeding', () => {
  const m = createMission(); m.launch();
  while (m.state.phase === 'ASCENT') m.step(.02);
  m.burn(); m.setThrottle(0);
  const fuel = m.state.transit.propellant;
  m.step(.02); expect(m.state.transit.propellant).toBe(fuel);
  expect(m.setWarp(100000)).toBe(true);
  m.setThrottle(1); expect(m.state.warp).toBe(10); expect(m.getTelemetry().engineFiring).toBe(true);
  m.abort(); const t = m.state.time;
  m.step(1); expect(m.state.time).toBe(t); expect(m.state.phase).toBe('FAILED');
  expect(m.state.failureReason).toMatch(/aborted/);
});
it('fails on exhausted life support without negative supplies and exposes detached telemetry', () => {
  const m = createMission({ supplyDuration: .000001 * DAY }); m.launch(); m.step(1);
  expect(m.state.phase).toBe('FAILED');
  expect(Object.values(m.state.supplies).every(v => v >= 0)).toBe(true);
  expect(m.state.crew.every(c => c.health === 0)).toBe(true);
  const t = m.getTelemetry(); t.supplies.oxygen = 10000;
  expect(m.state.supplies.oxygen).toBeLessThan(.001);
});
