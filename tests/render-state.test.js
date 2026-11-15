import { it, expect } from 'vitest';
import { createMission } from '../src/sim/mission.js';
import { createCountdown } from '../src/sim/countdown.js';
import { createDebris } from '../src/sim/debris.js';
import { captureRenderState } from '../src/core/renderState.js';
import { interpolateState } from '../src/render/interpolate.js';

it('captures independent snapshots and retains metre-scale launch position',()=>{
  const mission=createMission(),countdown=createCountdown(),debris=createDebris();
  const before=captureRenderState(mission,countdown,debris);
  expect(before.position).toEqual([0,0,0]);expect(before.pressure).toBeCloseTo(101325);
  mission.launch();for(let i=0;i<100;i++)mission.step(.02);
  const after=captureRenderState(mission,countdown,debris);
  expect(before.stages[0].propellant).toBe(1252000);expect(after.stages[0].propellant).toBeLessThan(before.stages[0].propellant);
  expect(after.position[1]).toBeCloseTo(after.altitude,1);expect(after.position[0]).toBeLessThan(1);
});
it('interpolates position and detached bodies using loop alpha without changing sim samples',()=>{
  const m=createMission(),c=createCountdown(),d=createDebris(),before=captureRenderState(m,c,d);
  const after={...before,position:[100,200,300],missionTime:2,attitude:1};
  const interpolated=interpolateState(before,after,.25);
  expect(interpolated.position).toEqual([25,50,75]);expect(interpolated.missionTime).toBe(.5);expect(before.position).toEqual([0,0,0]);expect(after.position).toEqual([100,200,300]);
  expect(interpolateState(before,{...after,phase:'ASCENT'},.25).position).toEqual([100,200,300]);
});
