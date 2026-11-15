import {expect,it} from 'vitest';
import {atLocalTime,marsSun} from '../src/sim/marsSun.js';
import {createPowerController} from '../src/colony/ihan/power/controller.mjs';
import {groupStatus} from '../src/colony/ihan/power/group-hmi.mjs';

it('follows the scene sun even if the selected projection season would still be in daylight',()=>{
  const clock=atLocalTime(Date.UTC(2025,9,14)/1000,17.9*3600);
  const p=createPowerController();
  p.controls.season=90;
  p.controls.blackStart=false;
  const environment=unixSeconds=>{
    const sun=marsSun(unixSeconds);
    return {unixSeconds,lmst:sun.lmst/3600,sunElevationDeg:sun.elevation*180/Math.PI};
  };
  const first=environment(clock);
  expect(first.sunElevationDeg).toBeLessThan(0);
  p.update(first,true);
  p.update(environment(clock+5),true);
  const {daylight,production,groups}=p.telemetry.live;
  expect(daylight).toBe(false);
  expect(production).toBe(0);
  expect(groups.every(group=>group.charge===0)).toBe(true);
  expect(groups.map(group=>groupStatus({...group,daylight}))).toContain("Battery supplying power");
  expect(groups.map(group=>groupStatus({...group,daylight}))).toContain("Night · No solar generation");
});

it('keeps low twilight readings consistent with the displayed kW and shows daylight charging',()=>{
  expect(groupStatus({daylight:true,draw:0,charge:0,pv:.004})).toBe("No solar generation");
  expect(groupStatus({daylight:true,draw:0,charge:.5,pv:1})).toBe("Battery charging");
});

it('keeps the live PV output independent of the forecast season selector',()=>{
  const clock=atLocalTime(Date.UTC(2026,10,14)/1000,12*3600);
  const output=season=>{
    const power=createPowerController({blackStart:false});
    power.controls.season=season;
    for(const time of [clock,clock+30]){
      const sun=marsSun(time);
      power.update({unixSeconds:time,lmst:sun.lmst/3600,sunElevationDeg:sun.elevation*180/Math.PI},true);
    }
    return power.telemetry.live.production;
  };
  expect(output(0)).toBeGreaterThan(0);
  expect(output(90)).toBeCloseTo(output(270),10);
});
