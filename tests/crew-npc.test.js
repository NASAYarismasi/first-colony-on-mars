import { describe, expect, it } from 'vitest';
import { planPath, nextSite, CREW_SITES } from '../src/colony/scene/crew-npc.mjs';

const domes = [[-9, 0], [0, 0], [9, 0]];

describe('crew NPC tasks', () => {
  it('walks around the domes instead of through them', () => {
    const path = [{ x: 0, z: 14 }, ...planPath({ x: 0, z: 14 }, { x: 0, z: -14 })];
    expect(path.length).toBeGreaterThan(2);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      for (let t = 0; t <= 1; t += .02) {
        const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
        for (const [cx, cz] of domes) expect(Math.hypot(x - cx, z - cz)).toBeGreaterThan(4.5);
      }
    }
  });
  it('follows the role from İhan\'s rules and never repeats the same site twice in a row', () => {
    expect(['greenhouse', 'air', 'water']).toContain(nextSite('production', null, 1, 0));
    expect(['solar', 'air', 'water']).toContain(nextSite('maintenance', null, 2, 0));
    let previous = null;
    for (let visit = 0; visit < 12; visit++) {
      const site = nextSite(null, previous, 1, visit);
      expect(site).not.toBe(previous); expect(CREW_SITES[site]).toBeDefined(); previous = site;
    }
  });
});
