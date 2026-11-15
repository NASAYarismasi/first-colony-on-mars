import {it,expect} from 'vitest';
import {createGridState,stepMoxieGas,stepMicrogrid,MOXIE_TANK_KG} from '../src/colony/ihan/power/live-grid.mjs';
import {stepGreenhouseGas} from '../src/colony/ihan/power/greenhouse-gas.mjs';
it('models twenty-seven modules across three equal oxygen tanks',()=>{
  const state=createGridState();
  const m=stepMoxieGas(state,true,1);
  expect(m.oxygenKgHour).toBeCloseTo(.162);
  expect(m.tanksKg).toEqual([.054,.054,.054]);
  state.oxygen=14.99;
  expect(stepMoxieGas(state,true,1).tankKg).toBe(15);
  expect(stepMoxieGas(state,true,1).oxygenKgHour).toBe(0);
});
it('shows wheat oxygen production under LEDs and net oxygen use in darkness',()=>{
  const state=createGridState();
  const positive=stepGreenhouseGas(state,{elevation:0,transmission:0,ledFraction:1},1);
  expect(positive.wheatKgHour).toBeCloseTo(.01468,5);
  expect(positive.algaeKgHour).toBeCloseTo(.000998,6);
  expect(positive.netKgHour).toBeCloseTo(positive.wheatKgHour+positive.algaeKgHour,9);
  const dark=stepGreenhouseGas(state,{elevation:0,transmission:0,ledFraction:0},1);
  expect(dark.netKgHour).toBeLessThan(0);
  expect(dark.algaeKgHour).toBeLessThan(0);
  expect(dark.generatedKg).toBe(positive.generatedKg);
});

it('cuts MOXIE electrical demand when all tanks are full',()=>{
  const state=createGridState();
  state.oxygen=MOXIE_TANK_KG;
  const live=stepMicrogrid(state,6,1/60,{season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:true,faults:{}});
  expect(live.moxie.supply).toBe(0);
  expect(live.gas.oxygenKgHour).toBe(0);
  expect(live.gas.tanksKg).toEqual([5,5,5]);
  expect(live.groups[2].charge).toBeGreaterThan(0);
});

it('bills only actual MOXIE runtime near 15 kg and keeps the interlock until reserve drops',()=>{
  const state=createGridState();
  state.oxygen=14.99;
  const options={season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:false,faults:{}};
  const flow=stepMicrogrid(state,6,1,options);
  expect(state.oxygen).toBe(15);
  expect(flow.moxie.consumption).toBeCloseTo(.5,8);
  state.oxygen=14.99;
  expect(stepMicrogrid(state,6,1,options).moxie.consumption).toBe(0);
  state.oxygen=14.8;
  expect(stepMicrogrid(state,6,1,options).moxie.consumption).toBeCloseTo(8.1,8);
});
