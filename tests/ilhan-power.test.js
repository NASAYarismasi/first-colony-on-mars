import {it,expect} from 'vitest';
import {createGridState,stepMicrogrid} from '../src/colony/ihan/power/live-grid.mjs';
import {createPowerController} from '../src/colony/ihan/power/controller.mjs';
const options={season:0,transmission:1,panelDust:.03,closed:true,lamp:1,drill:true,faults:{}};
it('preserves five 36 kWh banks and finite daytime power flows',()=>{
 const state=createGridState();
 for(let i=0;i<120;i++){
  const live=stepMicrogrid(state,5+i/120,1/120,options);
  expect(Number.isFinite(live.production)).toBe(true);
  expect(state.battery).toBeCloseTo(state.banks.reduce((a,b)=>a+b,0),8);
  for(const bank of state.banks){expect(bank).toBeGreaterThanOrEqual(-1e-8);expect(bank).toBeLessThanOrEqual(36.000001);}
 }
});
it('removes PV production at night and isolates switched-off optional loads',()=>{
 const state=createGridState();state.banks.fill(30);state.battery=150;
 const live=stepMicrogrid(state,20,1/120,{...options,closed:false});
 expect(live.production).toBe(0);expect(live.water.consumption).toBe(0);expect(live.greenhouse.consumption).toBe(0);
 expect(state.battery).toBeLessThan(150);
});
it('runs live and forecast calculations without mutating live stocks',()=>{
 const controller=createPowerController();
 controller.update({unixSeconds:0,lmst:8,storm:false},true);
 controller.update({unixSeconds:120,lmst:8,storm:false},true);
 const before=controller.telemetry;
 const report=controller.forecast();
 expect(controller.telemetry).toEqual(before);
 expect(report.drillOn).toHaveLength(3);expect(report.drillOff).toHaveLength(3);
 for(const row of [...report.drillOn,...report.drillOff])expect(Number.isFinite(row.stored)).toBe(true);
});
