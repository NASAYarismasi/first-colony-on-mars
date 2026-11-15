import {it,expect} from 'vitest'
import {createPowerController} from '../src/colony/ihan/power/controller.mjs'
import {advanceFacilityWater} from '../src/colony/ihan/power/facility-water.mjs'
import {createWaterState} from '../src/sim/ihanLifeSupportModels.js'
import {DRILL_KW,WATER_KWH_PER_L} from '../src/colony/ihan/power/mars-power.mjs'

it('uses the same extraction energy per litre as the live grid',()=>{
  const initial=createWaterState()
  const water=advanceFacilityWater(initial,1,{water:{consumption:2},habitat:{duty:1}},3)
  expect(water.extractedL).toBeCloseTo(DRILL_KW/WATER_KWH_PER_L,8)
  expect(initial.extractedL).toBe(0)
})

it('does not forecast a programmed blackout when recovery is disabled',()=>{
  const p=createPowerController()
  const start={unixSeconds:0,lmst:12,storm:false}
  p.update(start,true)
  p.update({...start,unixSeconds:1},true)
  const enabled=p.forecast().drillOff[0]
  p.controls.blackStart=false
  const disabled=p.forecast().drillOff[0]
  expect(disabled.gap).toBeLessThan(enabled.gap)
})

it('protects emergency batteries from optional rover charging',()=>{
  const p=createPowerController();
  const start={unixSeconds:0,lmst:22,storm:false};
  p.update(start,true);
  p.update({...start,unixSeconds:1},true);
  expect(p.telemetry.live.recovering).toBe(true);
  expect(p.consumeEnergy(1)).toBe(0);
  expect(p.telemetry.state.battery).toBe(8);
});

it('uses backup banks if primary kVA headroom is insufficient before they empty',async()=>{
  const {createGridState,stepMicrogrid}=await import('../src/colony/ihan/power/live-grid.mjs');
  const state=createGridState();
  state.banks=[20,20,.00101,.00101,.00101];
  const live=stepMicrogrid(state,20,.1,{season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:true,faults:{}});
  expect(live.life).toBeCloseTo(6,8);
  expect(live.habitat.sources).toContain(1);
  expect(live.groups.every(group=>Math.hypot(group.output,group.kvar)<=4+1e-8)).toBe(true);
});

it('stops a full tank with the feeder energized and charges the drill bank until the restart level',async()=>{
  const {createGridState,stepMicrogrid}=await import('../src/colony/ihan/power/live-grid.mjs')
  const state=createGridState()
  const options={season:0,transmission:1,panelDust:0,closed:true,lamp:0,drill:true,faults:{}}
  const step=()=>stepMicrogrid(state,6,1/120,options)
  state.water=100
  const full=step()
  expect(full.water).toMatchObject({tankHold:true,lineEnergized:true,consumption:0,current:0,duty:0})
  expect(full.groups[0].charge).toBeGreaterThan(0)
  expect(state.banks[0]).toBeGreaterThan(0)
  state.water=99
  expect(step().water.tankHold).toBe(true)
  options.closed=false
  expect(step().water.lineEnergized).toBe(false)
  options.closed=true
  state.water=95
  expect(step().water).toMatchObject({tankHold:false,consumption:DRILL_KW,duty:1})
})

it('accounts for energy supplied, stored, curtailed and lost over a full Mars sol',async()=>{
  const {atLocalTime,marsSun,MARS_SOL_SECONDS}=await import('../src/sim/marsSun.js');
  const {GRID,LED_KW,IRRIGATION_KW}=await import('../src/colony/ihan/power/mars-power.mjs');
  const start=atLocalTime(Date.UTC(2026,10,14)/1000,8*3600);
  const controller=createPowerController({blackStart:false,firstStormDelay:3600});
  let nights=0;
  for(let seconds=0;seconds<=MARS_SOL_SECONDS;seconds+=30){
    const sun=marsSun(start+seconds);
    controller.update({unixSeconds:start+seconds,lmst:sun.lmst/3600,sunElevationDeg:sun.elevation*180/Math.PI},true,(live)=>{
      expect(live.greenhouse.ledKW).toBe(live.daylight?0:LED_KW);
      if(!live.daylight)nights++;
    },{irrigation:true});
  }
  expect(nights).toBeGreaterThan(1000);
  const {state,live}=controller.telemetry;
  expect(live.greenhouse.pumpKW).toBe(IRRIGATION_KW);
  const deviceEnergy=Object.values(state.loadEnergy).reduce((sum,value)=>sum+value,0);
  expect(8+state.energy.solar).toBeCloseTo(state.battery+deviceEnergy+state.energy.feederLoss+
    state.energy.conversionLoss+state.energy.curtailed,6);
  expect(live.groups.every(g=>g.stored<=GRID.capacity/5)).toBe(true);
});

it('bills only the fraction of the drill that fits in the remaining clean water tank',async()=>{
  const {createGridState,stepMicrogrid}=await import('../src/colony/ihan/power/live-grid.mjs');
  const grid=createGridState();
  const initial={...createWaterState(),cleanL:99.9};
  grid.water=initial.cleanL;
  grid.iceKg=initial.iceKg;
  const options={season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:true,faults:{}};
  const waterBeforeDrilling=(habitat,hours)=>advanceFacilityWater(initial,hours,{habitat},3).cleanL;
  const step=stepMicrogrid(grid,6,1,{...options,waterBeforeDrilling});
  const final=advanceFacilityWater(initial,1,step,3);
  expect(final.cleanL).toBeCloseTo(100,10);
  expect(step.water.consumption).toBeCloseTo(final.extractedL*WATER_KWH_PER_L,10);
  expect(step.water.duty).toBeLessThan(1);
  expect(grid.waterTankHold).toBe(true);
  const idle=stepMicrogrid(grid,7,1,options);
  const afterFull=advanceFacilityWater(final,1,idle,3);
  expect(idle.water.consumption).toBe(0);
  expect(afterFull.extractedL).toBe(final.extractedL);
  expect(afterFull.recoveredL).toBe(final.recoveredL);
});

it('initializes and resets the live grid with the supplied landing energy',()=>{
  const power=createPowerController({initialEnergy:120});
  expect(power.telemetry.state.battery).toBe(120);
  expect(power.telemetry.state.banks).toEqual([6,6,36,36,36]);
  power.reset(72);
  expect(power.telemetry.state.initialEnergy).toBe(72);
  expect(power.telemetry.state.banks).toEqual([0,0,24,24,24]);
});

it('supports automatic and manual LED modes independently of the irrigation pump', async()=>{
  const {createGridState,stepMicrogrid}=await import('../src/colony/ihan/power/live-grid.mjs');
  const options={season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:false,faults:{}};
  const at=(hour,ledMode)=>{
    const state=createGridState(180);
    return stepMicrogrid(state,hour,1/120,{...options,ledMode}).greenhouse;
  };
  expect(at(6,'auto').ledKW).toBe(0);
  expect(at(6,'on').ledKW).toBeGreaterThan(0);
  expect(at(20,'auto').ledKW).toBeGreaterThan(0);
  expect(at(20,'off').ledKW).toBe(0);
});

it('debits the same irrigation volume from the plant meter and the clean water reserve', async()=>{
  const {createGridState,stepMicrogrid}=await import('../src/colony/ihan/power/live-grid.mjs');
  const {IRRIGATION_KW,IRRIGATION_L_PER_H}=await import('../src/colony/ihan/power/mars-power.mjs');
  const state=createGridState(180);
  const dt=1/120;
  const required=IRRIGATION_L_PER_H*dt;
  const initial={...createWaterState(),cleanL:required/2};
  state.water=initial.cleanL;
  const options={season:0,transmission:1,panelDust:0,closed:true,lamp:1,drill:false,faults:{},irrigation:true,ledMode:'on'};
  const live=stepMicrogrid(state,6,dt,options);
  const final=advanceFacilityWater(initial,dt,live,0);
  expect(live.greenhouse.pumpKW).toBeCloseTo(IRRIGATION_KW/2);
  expect(final.irrigatedL).toBeCloseTo(initial.cleanL);
  expect(state.water).toBe(0);
  expect(final.cleanL).toBe(0);
  const dry=stepMicrogrid(state,6,dt,options);
  expect(dry.greenhouse.pumpKW).toBe(0);
  expect(dry.greenhouse.ledKW).toBeGreaterThan(0);
});

it('runs a manual sweep through the same animation and charges for it only once',()=>{
  const power=createPowerController({initialEnergy:180,firstStormDelay:3600});
  const initial={unixSeconds:0,lmst:12};
  power.update(initial,true);
  power.update({...initial,unixSeconds:1},true);
  const before=power.telemetry;
  expect(power.startSweep()).toBe("Wipers started.");
  expect(power.startSweep()).toBe("Wipers already running.");
  expect(power.telemetry.state.loadEnergy.cleaning).toBe(.2);
  power.update({...initial,unixSeconds:31},true);
  expect(power.telemetry.strokes.some(value=>value>0)).toBe(true);
  power.update({...initial,unixSeconds:181},true);
  expect(power.telemetry.cleaning).toBe(true);
  power.update({...initial,unixSeconds:541},true);
  expect(power.telemetry.cleaning).toBe(false);
  expect(power.telemetry.state.loadEnergy.cleaning).toBe(.2);
  expect(power.telemetry.dust).toBeLessThan(before.dust);
});
