import { it, expect, describe } from 'vitest';
import { createMission } from '../src/sim/mission.js';
import { buildLandingPayload, kgToPersonSols, SOL, LANDER_SURFACE_SOLS } from '../src/sim/landingPayload.js';
import { CREW_RATES } from '../src/data/sls.js';
import { DAY } from '../src/sim/constants.js';
import { saveLandingPayload, readLandingPayload, clearLandingPayload, isLandingPayload } from '../src/colony/handoff.js';
import { createColony, createColonyFromFlight, exampleLanding, placeModule, placementError, assignAstronaut, advanceSol, colonyReport, missionLength } from '../src/colony/mars-koloni.mjs';

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

describe('flight → colony units', () => {
  it('one colony unit is one person-sol of the NASA BVAD rate', () => {
    expect(SOL / DAY).toBeCloseTo(1.02749, 4);
    expect(kgToPersonSols(CREW_RATES.oxygen * SOL / DAY, CREW_RATES.oxygen)).toBeCloseTo(1, 12);
  });
  it('caps surface stock at the lander allotment but passes real shortages through', () => {
    const m = createMission(), full = buildLandingPayload(m.state);
    for (const k of ['food', 'water', 'oxygen']) expect(full.supplies[k]).toBe(LANDER_SURFACE_SOLS); // crew-sols
    m.state.supplies.oxygen = CREW_RATES.oxygen * 2 * SOL / DAY; // only two person-sols of O2 left
    expect(buildLandingPayload(m.state).supplies.oxygen).toBeCloseTo(2 / 3, 10); // 2 person-sols = 2/3 crew-sol
    m.state.supplies.water = -5;
    expect(buildLandingPayload(m.state).supplies.water).toBe(0);
  });
  it('flight payload is accepted by İhan\'s createColony', () => {
    const colony = createColonyFromFlight(buildLandingPayload(createMission().state));
    for (const k of ['food', 'water', 'oxygen']) expect(colony.supplies[k]).toBeCloseTo(12, 10); // 4 crew-sols × 3 = 12 person-sols
    expect(colony.crew).toHaveLength(3);
    expect(colony.inventory.map(i => i.type)).toEqual(exampleLanding.modules);
  });
});

describe('handoff storage', () => {
  it('round-trips a valid payload and falls back on missing/invalid data', () => {
    const store = memory(), payload = buildLandingPayload(createMission().state);
    expect(readLandingPayload(exampleLanding, store).source).toBe('example');
    expect(saveLandingPayload(payload, store)).toBe(true);
    const back = readLandingPayload(exampleLanding, store);
    expect(back.source).toBe('flight'); expect(back.supplies).toEqual(payload.supplies);
    store.setItem('mars-ilk-koloni:landing', '{broken');
    expect(readLandingPayload(exampleLanding, store).source).toBe('example');
    clearLandingPayload(store); expect(readLandingPayload(exampleLanding, store).source).toBe('example');
    expect(isLandingPayload({ ...payload, crew: [] })).toBe(false);
  });
  it('survives storage that throws', () => {
    const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
    expect(saveLandingPayload({}, bad)).toBe(false);
    expect(readLandingPayload(exampleLanding, bad).source).toBe('example');
  });
});

describe('colony rules (İhan)', () => {
  it('rejects overlapping placement and plays a full 10-sol mission to a report', () => {
    let s = createColony(exampleLanding);
    const habitat = s.inventory.find(i => i.type === 'habitat').id;
    s = placeModule(s, habitat, { x: 0, z: 0 });
    const panel = s.inventory.find(i => i.type === 'solarPanel').id;
    expect(placementError(s, panel, { x: 0, z: 0 })).toBeTruthy();
    expect(colonyReport(s).status).toBe('in-progress');
    const dead = s.crew[0];
    expect(() => assignAstronaut({ ...s, crew: [{ ...dead, health: 0 }, ...s.crew.slice(1)] }, dead.id, 'production')).toThrow(RangeError);
    for (let sol = 0; sol < missionLength && colonyReport(s).status === 'in-progress'; sol++) {
      const alive = s.crew.find(p => p.health > 0);
      if (alive) s = assignAstronaut(s, alive.id, sol === 0 ? 'construction' : 'production');
      s = advanceSol(s, { prioritizeLifeSupport: true });
    }
    const report = colonyReport(s);
    expect(['success', 'failed']).toContain(report.status);
    expect(report.reasons.length).toBeGreaterThan(0);
  });
});
