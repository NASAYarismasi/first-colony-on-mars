import { describe, it, expect } from 'vitest';
import { REALISM, REALISM_NOTES, REALISM_SOURCES } from '../src/colony/realism.js';
import { CREW_RATES } from '../src/data/sls.js';
import { kgToPersonSols, SOL } from '../src/sim/landingPayload.js';
import { DAY } from '../src/sim/constants.js';

describe('colony reference notes', () => {
  it('keeps the displayed BVAD rates and person-sol meaning aligned with flight handoff', () => {
    expect(REALISM.crewKgPerEarthDay).toEqual(CREW_RATES);
    expect(REALISM.solSeconds).toBe(SOL);
    for (const rate of Object.values(REALISM.crewKgPerEarthDay)) {
      expect(kgToPersonSols(rate * REALISM.solSeconds / DAY, rate)).toBeCloseTo(1, 12);
    }
  });

  it('provides unique notes with primary-source links for every reference', () => {
    expect(new Set(REALISM_NOTES.map(note => note.id)).size).toBe(REALISM_NOTES.length);
    for (const note of REALISM_NOTES) {
      expect(note.text.length).toBeGreaterThan(40);
      expect(note.sources.length).toBeGreaterThan(0);
      for (const key of note.sources) expect(new URL(REALISM_SOURCES[key].url).hostname).toMatch(/(^|\.)nasa\.gov$/);
    }
    expect(REALISM.moxiePeakOxygenKgPerHour).toBe(0.012);
    expect(REALISM.marsSolarIrradiance).toBeLessThan(REALISM.earthSolarIrradiance);
  });
});
