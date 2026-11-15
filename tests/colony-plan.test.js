import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSceneColony } from '../src/colony/scene/mission-start.mjs';
import { cargoLimitKg, defaultManifest, planMission } from '../src/colony/mars-gorev-plani.mjs';
import { advanceSol, assignAstronaut, exampleLanding, placeModule } from '../src/colony/mars-koloni.mjs';
import { crops, grow, harvest, replant, startWorkshop } from '../src/colony/mars-atolye.mjs';
import { buildLandingPayload } from '../src/sim/landingPayload.js';
import { createMission } from '../src/sim/mission.js';

describe('cargo manifest → scene startup', () => {
  it('starts the planned cargo with person-sol stock, distinct duplicate modules and ECLSS operations', () => {
    const plan=planMission(defaultManifest);
    const state=createSceneColony({...exampleLanding,source:'example'},plan);
    expect(plan.massKg).toBeLessThanOrEqual(cargoLimitKg);
    expect(plan.massKg).toBeCloseTo(plan.cargo.reduce((sum,item)=>sum+item.kg,0),8);
    expect(state.supplies).toEqual({food:42,water:24,oxygen:24,spareParts:2});
    expect(state.operations).toEqual(plan.operations);
    expect(state.operations).not.toBe(plan.operations);
    expect(state.wastewater).toBe(0);
    expect(state.inventory.map(item=>item.type)).toEqual(plan.landing.modules);
    expect(state.inventory.filter(item=>item.type==='airScrubber')).toHaveLength(1);
    expect(state.inventory.filter(item=>item.type==='battery')).toHaveLength(2);
    expect(new Set(state.inventory.map(item=>item.id)).size).toBe(state.inventory.length);
    expect(plan.landing.supplies.food).toBe(14); // Conversion never mutates the manifest.
  });
  it('blocks an overweight plan before any colony is created', () => {
    const plan=planMission({...defaultManifest,mealDays:20,waterDays:20,oxygenDays:20,spareParts:6});
    expect(plan.massKg).toBeGreaterThan(cargoLimitKg);
    expect(()=>createSceneColony({...exampleLanding,source:'example'},plan)).toThrow(RangeError);
  });
  it('runs the planned CO₂ scrubber and carries wastewater into the next sol', () => {
    let state=createSceneColony({...exampleLanding,source:'example'},planMission(defaultManifest));
    for (const [index,item] of [...state.inventory].entries()) {
      state=placeModule(state,item.id,{x:(index%5-2)*8,z:Math.floor(index/5)*8});
    }
    for (let sol=0;sol<2;sol++) {
      for (const person of state.crew) state=assignAstronaut(state,person.id,'construction');
      state=advanceSol(state);
    }
    const day=state.timeline.at(-1);
    expect(day.needs.cleanAir).toBe(true);
    expect(day.systems).toContain("CO₂ scrubber operated");
    expect(day.systems).toContain("Water recovered from wastewater");
    expect(day.systems).toContain("Water electrolysis supplied oxygen");
    expect(state.wastewater).toBeGreaterThan(0);
    expect(state.placed.every(item=>item.active)).toBe(true);
  });
});

describe('flight and example startup precedence', () => {
  it('keeps flight shortages, crew health, modules and energy even when a cargo preview exists', () => {
    const payload=buildLandingPayload(createMission().state);
    payload.supplies={food:1.25,water:0,oxygen:2,spareParts:1};
    payload.crew[1].health=61;
    payload.crew=payload.crew.map((person,index)=>({...person,id:'flight-'+index}));
    payload.surfaceEnergy=5;
    const landing={...payload,source:'flight'};
    const state=createSceneColony(landing,planMission(defaultManifest));
    expect(state.supplies).toEqual({food:3.75,water:0,oxygen:6,spareParts:1});
    expect(state.crew[1]).toMatchObject({id:'flight-1',health:61});
    expect(state.inventory.map(item=>item.type)).toEqual(payload.modules);
    expect(state.startupEnergy).toBe(5);
    expect(state.operations).toBeUndefined();
    expect(createSceneColony(landing,planMission(defaultManifest))).toEqual(state); // Reset converts once.
    expect(payload.supplies.food).toBe(1.25);
  });
  it('keeps example person-sol units and rejects invalid imported flight data', () => {
    expect(createSceneColony({...exampleLanding,source:'example'}).supplies).toEqual(exampleLanding.supplies);
    expect(()=>createSceneColony({...exampleLanding,crew:[],source:'flight'})).toThrow(TypeError);
  });
});

describe('latest farm and HTML integration', () => {
  it('leaves a harvested pod empty until a new nutrient/seed cycle is started', () => {
    const unit={id:'pod',type:'potatoPod',active:true};
    let workshop={...startWorkshop(),growing:{pod:crops.potatoPod.sols}};
    workshop=harvest(workshop,unit);
    const colony={crew:exampleLanding.crew,placed:[unit],timeline:[{cropPower:true,needs:{habitat:true}}]};
    workshop=grow(workshop,colony);
    expect(workshop.growing.pod).toBeNull();
    expect(()=>replant(workshop,unit)).toThrow(RangeError);
    workshop={...workshop,stock:{...workshop.stock,nutrients:1}};
    const tubers=workshop.stock.tubers;
    workshop=replant(workshop,unit);
    expect(workshop.stock.nutrients).toBe(0);
    expect(workshop.stock.tubers).toBe(tubers-1);
    expect(grow(workshop,colony).growing.pod).toBe(1);
  });
  it('provides every static element the scene looks up in the restyled colony page', () => {
    const source=readFileSync(new URL('../src/colony/scene/mars-demo.mjs',import.meta.url),'utf8');
    const html=readFileSync(new URL('../colony.html',import.meta.url),'utf8');
    const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [,id] of source.matchAll(/byId\("([^"]+)"\)/g)) expect(ids, id).toContain(id);
  });
});
