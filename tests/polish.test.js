import { it, expect } from 'vitest';
import { createMission } from '../src/sim/mission.js';
import { createCountdown } from '../src/sim/countdown.js';
import { createDebris } from '../src/sim/debris.js';
import { captureRenderState } from '../src/core/renderState.js';
import { apsisReadout, vehicleConfiguration, resourceDays, nextEvent } from '../src/ui/presentation.js';
import { DAY } from '../src/sim/constants.js';

it('projects the actual attached stages through separation, orbit and lander handoff',()=>{
  const mission=createMission(),countdown=createCountdown(),debris=createDebris();
  const snapshot=()=>captureRenderState(mission,countdown,debris);
  expect(vehicleConfiguration(snapshot())).toBe('boosters');
  mission.launch();while(mission.state.ascent.state.vehicle.stages[0].attached)mission.step(.02);
  expect(vehicleConfiguration(snapshot())).toBe('core');
  while(mission.state.ascent.state.vehicle.stages[1].attached)mission.step(.02);
  expect(vehicleConfiguration(snapshot())).toBe('upper');
  while(mission.state.phase==='ASCENT')mission.step(.02);
  expect(vehicleConfiguration(snapshot())).toBe('upper');
  mission.burn();expect(vehicleConfiguration(snapshot())).toBe('transit');
  expect(vehicleConfiguration({...snapshot(),phase:'DEORBIT',mars:true})).toBe('lander');
});

it('formats only physically meaningful apsides and handles open trajectories',()=>{
  expect(apsisReadout(-6369000,.99,'peri')).toEqual({value:'—',unit:"suborbital"});
  expect(apsisReadout(-1,1.2,'apo')).toEqual({value:'—',unit:"open trajectory"});
  expect(apsisReadout(Infinity,1,'apo').value).toBe('—');
  expect(apsisReadout(NaN,0,'peri').unit).toBe('');
  expect(apsisReadout(185000,0,'peri')).toEqual({value:'185.0',unit:'km'});
});

it('wrist resources and cabin power come from independent telemetry snapshots',()=>{
  const mission=createMission();
  expect(mission.getTelemetry().cabinPower).toBe(true);
  mission.state.cabinPower=false;
  const t=mission.getTelemetry();expect(t.cabinPower).toBe(false);
  for(const resource of ['oxygen','water','food'])expect(resourceDays(t,resource)).toBeCloseTo(320);
  mission.launch();mission.step(.02);
  expect(resourceDays(mission.getTelemetry(),'oxygen')).toBeCloseTo(320-.02/DAY,10);
  expect(nextEvent({...t,countdown:{running:false}})).toBe("Start countdown");
});
