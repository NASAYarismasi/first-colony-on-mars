import { describe, expect, it , vi} from 'vitest';
import { MISSION_PHASES } from '../src/sim/mission.js';
import { MARS } from '../src/sim/constants.js';
import { entryFromOrbit } from '../src/sim/edl.js';
import { elementsToState, propagateKepler } from '../src/sim/orbit.js';
import { vehicleConfiguration, transitOrbitOffset, VEHICLE_PART_IDS } from '../src/render/vehiclePhases.js';
import { createVehicle } from '../src/render/vehicle.js';
import { disposeScene } from '../src/render/dispose.js';

const snapshot = (phase, extra={}) => ({phase,events:[],phaseTime:20,missionTime:100,
  attitude:0,theta:0,engineFiring:false,throttle:1,verticalSpeed:-200,surfaceVelocity:300,
  stages:['srb','core','icps'].map(id=>({id,attached:true})),lasAttached:true,...extra});

describe('spacecraft visual phase contract',()=>{
  const expected={
    PRELAUNCH:[true,false,false,'orion'],ASCENT:[true,false,false,'orion'],
    PARKING_ORBIT:[false,true,true,'orion'],TMI_BURN:[false,true,true,'orion'],
    CRUISE:[false,true,true,'orion'],MOI_BURN:[false,true,true,'orion'],MARS_ORBIT:[false,true,true,'orion'],
    DEORBIT:[false,true,true,'lander'],EDL:[false,false,true,'lander'],LANDED:[false,false,true,'lander'],
    FAILED:[true,false,false,'orion']
  };
  it.each(MISSION_PHASES)('%s has explicit parts and cabin policy',phase=>{
    const result=vehicleConfiguration(snapshot(phase));
    expect([result.launch,result.transit,result.lander,result.cabin]).toEqual(expected[phase]);
    expect(result.ids).toBe(VEHICLE_PART_IDS);
    expect(result.heatShield).toBe(result.lander&&phase!=='LANDED');
    expect(result.backshell).toBe(result.heatShield);
  });
  it('keeps all cruise hardware through MOI and Mars orbit until deorbit',()=>{
    for(const phase of ['CRUISE','MOI_BURN','MARS_ORBIT']){
      expect(vehicleConfiguration(snapshot(phase))).toMatchObject({orion:true,transit:true,lander:true,heatShield:true,backshell:true,separated:false});
    }
  });
  it('drives docking, arrays and legs from bounded phase/event time',()=>{
    expect(vehicleConfiguration(snapshot('PARKING_ORBIT',{phaseTime:0}))).toMatchObject({docking:0,arrays:0});
    expect(vehicleConfiguration(snapshot('PARKING_ORBIT',{phaseTime:6}))).toMatchObject({docking:.5,arrays:1});
    expect(vehicleConfiguration(snapshot('PARKING_ORBIT',{phaseTime:12})).docking).toBe(1);
    const events=[{type:'HEATSHIELD_JETTISON',time:95},{type:'LEGS_DEPLOYED',time:99}];
    expect(vehicleConfiguration(snapshot('EDL',{events}))).toMatchObject({heatShield:false,backshell:false,ladder:false});
    expect(vehicleConfiguration(snapshot('EDL',{events,missionTime:100.5})).legs).toBeCloseTo(.5);
    expect(vehicleConfiguration(snapshot('EDL',{events,missionTime:102})).legs).toBe(1);
    expect(vehicleConfiguration(snapshot('LANDED'))).toMatchObject({legs:1,ladder:true,heatShield:false});
  });
  it('only burns NTR with actual nonzero burn telemetry',()=>{
    for(const phase of MISSION_PHASES){
      expect(vehicleConfiguration(snapshot(phase,{engineFiring:true})).ntrBurn).toBe(['TMI_BURN','MOI_BURN'].includes(phase));
    }
    expect(vehicleConfiguration(snapshot('TMI_BURN',{engineFiring:true,throttle:0})).ntrBurn).toBe(false);
  });
  it('retains the established vehicle after failure',()=>{
    expect(vehicleConfiguration(snapshot('FAILED',{events:[{type:'CRUISE'},{type:'MOI_BURN'},{type:'FAILED'}]}))).toMatchObject({docked:true,lander:true,cabin:'orion'});
    expect(vehicleConfiguration(snapshot('FAILED',{events:[{type:'EDL'},{type:'SRP_IGNITION'},{type:'FAILED'}]}))).toMatchObject({separated:true,heatShield:false,cabin:'lander'});
    expect(()=>vehicleConfiguration(snapshot('unknown'))).toThrow(RangeError);
  });
});

it('keeps actual Orion, lander and both cover identities from launch through EDL',()=>{
  const vehicle=createVehicle({models:{}});
  const {orion,lander,aeroshell,backshell}=vehicle;
  const wing=orion.children.find(child=>child.children.some(grandchild=>grandchild.children.length));
  try{
    vehicle.update(snapshot('PRELAUNCH'));
    expect(orion.parent).toBe(vehicle.parts.orion);
    for(const phase of ['PARKING_ORBIT','TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT','DEORBIT','EDL']){
      vehicle.update(snapshot(phase));
      expect(vehicle.orion).toBe(orion);expect(orion.parent).toBe(vehicle.transit);
      expect(vehicle.lander).toBe(lander);expect(lander.visible).toBe(true);
      expect(lander.getObjectByName('heat-shield')).toBe(aeroshell);
      expect(lander.getObjectByName('mars-backshell')).toBe(backshell);
      expect(aeroshell.visible).toBe(true);expect(backshell.visible).toBe(true);
      expect(orion.children).toContain(wing);
    }
    const jettison=snapshot('EDL',{events:[{type:'HEATSHIELD_JETTISON',time:99}]}), t0=performance.now();
    vehicle.update(jettison); vehicle.update(jettison);
    // Separation is shown: both covers still visible, moving away from the lander for ~3 s.
    expect(aeroshell.visible).toBe(true);expect(backshell.visible).toBe(true);
    const clock=vi.spyOn(performance,'now').mockReturnValue(t0+1500); vehicle.update(jettison);
    expect(backshell.position.y).toBeGreaterThan(aeroshell.position.y+3);
    clock.mockReturnValue(t0+4000); vehicle.update(jettison); clock.mockRestore();
    expect(aeroshell.visible).toBe(false);expect(backshell.visible).toBe(false);
    expect(vehicle.lander).toBe(lander);
    vehicle.update(snapshot('LANDED'));expect(lander.getObjectByName('crew-ladder').visible).toBe(true);
    vehicle.update(snapshot('PRELAUNCH'));expect(orion.parent).toBe(vehicle.parts.orion);
  }finally{disposeScene(vehicle.group);}
});

it('renders the retained MTV on the circular orbit relative to the real deorbit ellipse',()=>{
  const entry=entryFromOrbit(),radius=entry.a*(1+entry.e),initial=elementsToState({...entry,trueAnomaly:Math.PI},MARS.mu);
  const departure={type:'DEORBIT',time:100};
  expect(transitOrbitOffset(snapshot('CRUISE'))).toEqual([0,0,0]);
  expect(transitOrbitOffset(snapshot('DEORBIT',{events:[departure],polar:[radius,Math.PI]}))).toEqual([0,0,0]);
  const time=20,lander=propagateKepler(initial,time,MARS.mu),r=Math.hypot(...lander.position),theta=Math.atan2(lander.position[1],lander.position[0]);
  const actual=transitOrbitOffset(snapshot('DEORBIT',{events:[departure],missionTime:100+time,polar:[r,theta]}));
  const circular=propagateKepler(elementsToState({a:radius,e:0,trueAnomaly:Math.PI},MARS.mu),time,MARS.mu);
  const dx=circular.position[0]-lander.position[0],dy=circular.position[1]-lander.position[1];
  expect(actual[0]).toBeCloseTo(-dx*Math.sin(theta)+dy*Math.cos(theta),6);
  expect(actual[1]).toBeCloseTo(dx*Math.cos(theta)+dy*Math.sin(theta),6);
  expect(Math.hypot(...actual)).toBeGreaterThan(100);
});
