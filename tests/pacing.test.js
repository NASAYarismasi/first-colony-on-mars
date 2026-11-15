import { beforeAll, expect, it } from 'vitest';
import { createPacingDirector, createPacingPlan, pacingFrame, pacingTarget, PACING } from '../src/core/pacing.js';
import { createMission } from '../src/sim/mission.js';
import { createLoop, WARPS } from '../src/core/loop.js';
import { missionElapsed, missionCalendar } from '../src/ui/presentation.js';

let plan;
beforeAll(() => { plan = createPacingPlan(); });

it('derives all key moment forecasts from an ordinary physical mission', () => {
  expect(plan.events.ASCENT.map(e => e.type)).toEqual(expect.arrayContaining(['MAX_Q','SRB_SEPARATION','LAS_JETTISON','MECO','ICPS_IGNITION','ORBIT_INSERTION']));
  expect(plan.events.EDL.map(e => e.type)).toEqual(expect.arrayContaining(['HEATSHIELD_JETTISON','SRP_IGNITION','LEGS_DEPLOYED','TOUCHDOWN']));
  expect(plan.phases.CRUISE / 86400).toBeCloseTo(258.87, 1);
  expect(plan.phases.EDL).toBeGreaterThan(800);
});

it('bounds log-space rate change even when the requested target changes drastically', () => {
  const director = createPacingDirector(plan);
  for(let i=0;i<300;i++){
    const before=director.rate, dt=1/60;
    const t={phase:i<150?'CRUISE':'ASCENT',phaseTime:100,engineFiring:i>=150};
    const choice=director.update(t,dt);
    expect(Math.abs(Math.log(choice.rate/(i===0?100:before)))).toBeLessThanOrEqual(PACING.logSlope*dt+1e-12);
  }
});

it('slows down in advance of every forecast and holds real time after events', () => {
  for(const [phase,events] of Object.entries(plan.events)){
    for(const event of events){
      const close=pacingFrame({phase,phaseTime:event.time-PACING.eventLead},plan);
      expect(close.timeToEvent).toBeLessThanOrEqual(PACING.eventLead+.001);
      const minimum=['ASCENT','EDL'].includes(phase)?1:100;
      expect(pacingTarget(close)).toBe(minimum);
      expect(pacingTarget({phase,timeToEvent:0,sinceEvent:100})).toBe(minimum);
    }
  }
  expect(pacingTarget({phase:'EDL',timeToTouchdown:PACING.landingRealtime-5,sinceEvent:100})).toBe(1); // final descent in real time
});

it('manual warp remains latched until the explicit automatic toggle and reset', () => {
  const director=createPacingDirector(plan);
  director.setManual(5);
  expect(director.update({phase:'CRUISE',phaseTime:100},100)).toEqual({mode:'manual',rate:5,targetRate:5,burn:false});
  director.toggle(5);expect(director.mode).toBe('automatic');
  director.reset();expect(director.rate).toBe(1);expect(director.targetRate).toBe(1);
  expect(()=>director.update({},NaN)).toThrow(RangeError);
});

it('runs the headless director with the actual warp guard and measures feasible durations', () => {
  const mission=createMission(),director=createPacingDirector(plan),durations={};
  const eventRates=[];
  mission.launch();
  const loop=createLoop({getState:()=>mission.getTelemetry(),advanceCoast:mission.advanceCoast,maxSteps:10000,
    step(dt){
      const phase=mission.state.phase,events=phase==='ASCENT'?mission.state.ascent.state.events:mission.state.edl?.state.events;
      const count=events?.length??0;
      mission.step(dt);
      if((events?.length??0)>count)eventRates.push({type:events.at(-1).type,rate:loop.warp});
    }});
  let seconds=0,chapter2=0;
  const dt=.05;
  while(mission.state.phase!=='LANDED'&&seconds<2000){
    const t=mission.getTelemetry(),choice=director.update(t,dt);
    const candidates=[...WARPS.filter(w=>w>=choice.rate),...WARPS.filter(w=>w<choice.rate).reverse()];
    const carrier=candidates.find(w=>mission.setWarp(w));
    expect(carrier).toBeDefined();
    expect(loop.setPlaybackRate(Math.min(choice.rate,carrier))).toBe(true);
    if(choice.burn)mission.burn();
    loop.advance(dt);seconds+=dt;
    durations[t.phase]=(durations[t.phase]??0)+dt;
    if(['MARS_ORBIT','DEORBIT','EDL'].includes(t.phase))chapter2+=dt;
    expect(mission.state.phase).not.toBe('FAILED');
    expect(loop.backlog).toBeLessThan(.02001);
  }
  expect(mission.state.phase).toBe('LANDED');
  expect(mission.getTelemetry().touchdownSpeed).toBeLessThan(2.5);
  for(const event of eventRates)expect(event.rate, event.type).toBeLessThan(1.15);
  // Vacuum burns ×50 and analytic cruise ×400000: cruise + burns now fit in ~2 min.
  const lowerBound=plan.phases.CRUISE/PACING.cruise+(plan.phases.TMI_BURN+plan.phases.MOI_BURN)/PACING.burn;
  expect(lowerBound).toBeLessThan(180);
  console.log('PACING_TOTAL_S', Math.round(seconds), 'CHAPTER2_S', Math.round(chapter2), JSON.stringify(Object.fromEntries(Object.entries(durations).map(([k,v])=>[k,Math.round(v)]))));
  expect(seconds).toBeGreaterThan(60);
  expect(seconds).toBeLessThan(2*60); // team lead: whole flight ≤ ~3 min
  expect(chapter2).toBeGreaterThan(PACING.landingRealtime);
  expect(chapter2).toBeLessThan(2*60);
  console.info('PACING measured real seconds',JSON.stringify({total:seconds,chapter2,phases:durations,eventRates}));
},20000);

it('keeps the real mission clock and cruise calendar distinct from playback rate', () => {
  expect(missionElapsed(258*86400+22*3600+20*60)).toBe("T+ 258 d 22 h 20 min");
  expect(missionCalendar({phase:'CRUISE',cruiseProgress:131/258.87,transfer:{duration:258.87*86400}})).toBe("Cruise · Day 132 / 259");
});
