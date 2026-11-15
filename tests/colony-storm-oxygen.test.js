import {expect,it} from 'vitest';
import {createPowerController} from '../src/colony/ihan/power/controller.mjs';
import {createGridState,stepMoxieGas} from '../src/colony/ihan/power/live-grid.mjs';
import {supplyHabitatOxygen} from '../src/colony/ihan/power/habitat-oxygen.mjs';
import {createAirState} from '../src/sim/ihanLifeSupportModels.js';

it('automatically attenuates daylight gradually and cleans rows at different times',()=>{
  const power=createPowerController();
  const frames=[];
  for(let second=0;second<=1260;second+=5){
    power.update({unixSeconds:second,lmst:8},true);
    frames.push(power.telemetry);
  }
  const at=second=>frames[second/5];
  expect(at(180).live.production).toBeLessThan(at(60).live.production);
  expect(at(300).live.production).toBeLessThan(at(180).live.production);
  expect(at(300).live.production).toBeGreaterThan(0);
  expect(at(720).live.production).toBeGreaterThan(at(540).live.production);
  const staggered=frames.find(frame=>frame.strokes[0]>0&&frame.strokes[5]===0);
  expect(staggered?.cleaning).toBe(true);
  expect(at(720).dust).toBeLessThan(at(480).dust);
  expect(at(720).cleaning).toBe(true);
  expect(at(1260).cleaning).toBe(false);
  expect(new Set(at(720).live.groups.map(group=>group.pv)).size).toBe(5);
});

it('conserves MOXIE oxygen across production, tanks and habitat consumption',()=>{
  const grid=createGridState();
  grid.oxygen=.2;
  stepMoxieGas(grid,true,1);
  const air=createAirState();
  const supplied=supplyHabitatOxygen(air,1,{habitat:{duty:1}},grid,3);
  expect(grid.oxygenToHabitat).toBeCloseTo(.105);
  expect(grid.oxygen+grid.oxygenToHabitat).toBeCloseTo(.2+.162);
  expect(grid.oxygenProduced).toBeCloseTo(.162);
  expect(supplied.oxygenKg).toBeCloseTo(air.oxygenKg);
  const before=grid.oxygen;
  supplyHabitatOxygen(supplied,1,{habitat:{duty:0}},grid,3);
  expect(grid.oxygen).toBe(before);
  expect(grid.oxygenTransferKgHour).toBe(0);
});

it('uses transferred oxygen to cover the current shortfall with an empty habitat reserve',()=>{
  const grid=createGridState();
  grid.oxygen=.2;
  const air={...createAirState(),oxygenKg:0};
  const supplied=supplyHabitatOxygen(air,1,{habitat:{duty:1}},grid,3);
  expect(supplied.oxygenKg).toBe(0);
  expect(supplied.unservedOxygenKg).toBeCloseTo(0);
});
