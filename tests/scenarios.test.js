import { beforeAll, expect, it } from 'vitest';
import { createScenario } from '../src/sim/scenarios.js';
import { createMission } from '../src/sim/mission.js';
import { buildLandingPayload } from '../src/sim/landingPayload.js';
import { CREW_RATES, LANDER, TRANSIT } from '../src/data/sls.js';
import { DAY, MARS } from '../src/sim/constants.js';
import { stateToElements } from '../src/sim/orbit.js';
import { captureRenderState } from '../src/core/renderState.js';
import { createCountdown } from '../src/sim/countdown.js';
import { createDebris } from '../src/sim/debris.js';

let nominal, scenario;
beforeAll(() => {
  // Independent reference: fly the ordinary player commands at the fixed tick.
  nominal = createMission();
  nominal.launch();
  for (let tick=0; tick<300000 && nominal.state.phase!=='MARS_ORBIT'; tick++) {
    expect(nominal.state.phase).not.toBe('FAILED');
    if (nominal.state.phase==='PARKING_ORBIT') nominal.burn();
    if (nominal.state.phase==='CRUISE') {
      // Deliberately split the analytical coast differently from the scenario.
      if (nominal.advanceCoast(Math.min(10*DAY,nominal.state.transfer.duration-nominal.state.cruiseTime))>0) continue;
    }
    nominal.step(.02);
  }
  expect(nominal.state.phase).toBe('MARS_ORBIT');
  scenario = createScenario('mars-orbit');
}, 15000);

it('keeps launch at the normal title/countdown starting point and rejects unknown chapters', () => {
  expect(createScenario('launch').state.phase).toBe('PRELAUNCH');
  expect(createScenario('launch').state.time).toBe(0);
  expect(() => createScenario('landing')).toThrow(RangeError);
});

it('matches the nominal MOI result, including orbit, transit fuel, elapsed time and resource mass', () => {
  const actual=scenario.state, expected=nominal.state;
  expect(actual.phase).toBe('MARS_ORBIT');
  expect(actual.phaseTime).toBe(0);
  expect(actual.warp).toBe(1);
  expect(actual.failureReason).toBeNull();
  expect(actual.time).toBeCloseTo(expected.time,5);
  expect(actual.cruiseTime).toBeCloseTo(expected.cruiseTime,5);
  expect(actual.transit.propellant).toBeCloseTo(expected.transit.propellant,6);
  expect(actual.transit.dryMass).toBe(TRANSIT.dryMass);
  expect(actual.transit.payloadMass).toBe(expected.transit.payloadMass);
  for (const key of ['position','velocity']) actual.orbitState[key].forEach((x,i)=>expect(x).toBeCloseTo(expected.orbitState[key][i],8));
  const orbit=stateToElements(actual.orbitState,MARS.mu);
  expect(orbit.e).toBeLessThan(1e-12);
  expect(orbit.periapsis-MARS.radius).toBeCloseTo(250000,6);
  expect(orbit.apoapsis-MARS.radius).toBeCloseTo(250000,6);
  // ~259 days is rounded UI wording. Use the actual Hohmann time plus burns.
  expect(actual.cruiseTime/DAY).toBeCloseTo(259,0);
  const initial=createScenario('launch').state;
  for (const [resource,rate] of Object.entries(CREW_RATES)) {
    expect(actual.supplies[resource]).toBeCloseTo(expected.supplies[resource],6);
    expect(initial.supplies[resource]-actual.supplies[resource]).toBeCloseTo(actual.time/DAY*3*rate,6);
  }
  expect(actual.ascent.state.vehicle.stages.every(stage=>!stage.attached)).toBe(true);
  expect(actual.ascent.state.lasAttached).toBe(false);
  expect(actual.events.filter(event=>event.type==='ICPS_SEPARATION')).toHaveLength(1);
  const snapshot=captureRenderState(scenario,createCountdown(),createDebris());
  expect(snapshot.mars).toBe(true);
  expect(snapshot.engineFiring).toBe(false);
  expect(snapshot.events.some(event=>event.type==='MARS_ORBIT')).toBe(true);
});

it('flies B/deorbit and EDL from the chapter through a safe landing and the unchanged payload contract', () => {
  expect(scenario.burn()).toBe(true);
  expect(scenario.state.phase).toBe('DEORBIT');
  expect(scenario.state.deorbitPropellant).toBeGreaterThan(0);
  expect(scenario.state.deorbitPropellant).toBeLessThan(LANDER.propellantMass);
  for (let tick=0;tick<250000&&!['LANDED','FAILED'].includes(scenario.state.phase);tick++) scenario.step(.02);
  const telemetry=scenario.getTelemetry();
  expect(telemetry.failureReason).toBeNull();
  expect(telemetry.phase).toBe('LANDED');
  expect(telemetry.touchdownSpeed).toBeLessThan(2.5);
  expect(telemetry.propellant).toBeGreaterThan(0);
  const payload=telemetry.landingPayload;
  expect(payload).toEqual(buildLandingPayload(scenario.state));
  expect(Object.keys(payload).sort()).toEqual(['crew','supplies','modules','landingSite','surfaceEnergy'].sort());
  expect(payload.crew).toHaveLength(3);
  expect(payload.crew.every(member=>member.health===100)).toBe(true);
  expect(payload.modules).toEqual(nominal.state.modules);
  expect(payload.landingSite).toBe('flat');
  expect(payload.surfaceEnergy).toBe(8);
  for (const value of Object.values(payload.supplies)) expect(value).toBeGreaterThan(0);
  const before=scenario.state.time;
  scenario.step(1);
  expect(scenario.state.time).toBe(before);
});

it('enters transfer at nominal TMI cutoff and retains the pre-transfer flight history', () => {
  const mission=createScenario('transfer');
  expect(mission.state.phase).toBe('CRUISE');
  expect(mission.state.cruiseTime).toBe(0);
  expect(mission.state.burnRemaining).toBe(0);
  expect(mission.state.events.some(event=>event.type==='TMI_BURN')).toBe(true);
  expect(mission.state.transit.propellant).toBeLessThan(TRANSIT.propellantMass);
  expect(mission.advanceCoast(DAY)).toBe(DAY);
});
