import { describe, expect, it } from 'vitest'
import { createRoverState, commandRover, stepRover, planRoverPath, roverSegmentClear,
  ROVER_HOME, ROVER_STATIONS, ROVER_MAX_SPEED_MPS, ROVER_OBSTACLES, ROVER_TUBES,
  ROVER_WITNESS_TUBES, ROVER_GENERATOR_W, ROVER_LOAD_W, ROVER_BATTERY_KWH,
  nextRoverWaypoint, roverInBounds, roverWheelKinematics, ROVER_WHEEL_RADIUS_M, ROVER_TIME_COMPRESSION } from '../src/sim/rover.js'

function advance(s, seconds) { for (let i = 0; i < Math.round(seconds * 10); i++) stepRover(s, .1); return s }
function atSite(seed) { const s = createRoverState(seed); commandRover(s,'park'); Object.assign(s, { x: ROVER_STATIONS[0].x, z: ROVER_STATIONS[0].z }); return s }

describe('Perseverance surface operations', () => {
  it('turns in place, respects physical speed and accounts for actual ground travel', () => {
    const s = createRoverState(); commandRover(s, 'drive', 'seitah')
    stepRover(s, .1); expect(s.speedMps).toBe(0); expect(s.odometerM).toBe(0)
    let travelled = 0
    for (let i = 0; i < 30000; i++) {
      const x = s.x, z = s.z; stepRover(s, .1)
      const d = Math.hypot(s.x - x, s.z - z); travelled += d
      expect(s.speedMps).toBeLessThanOrEqual(ROVER_MAX_SPEED_MPS + 1e-12)
      expect(d).toBeLessThanOrEqual(ROVER_MAX_SPEED_MPS * .1 + 1e-12)
    }
    expect(s.mode).toBe('parked'); expect(s.x).toBeCloseTo(-26, 6); expect(s.z).toBeCloseTo(24, 6)
    expect(s.odometerM).toBeCloseTo(travelled, 8)
  })
  it('routes every station pair and base around every dome, lander and facility', () => {
    const sites = [ROVER_HOME, ...ROVER_STATIONS].filter(s=>roverSegmentClear(s,s))
    for (const a of sites) for (const b of sites) {
      const path = planRoverPath(a, b); expect(path.length).toBeGreaterThan(0)
      let p = a
      for (const q of path) {
        expect(roverSegmentClear(p, q)).toBe(true)
        for (let k = 0; k <= 100; k++) for (const [x, z, r] of ROVER_OBSTACLES)
          expect(Math.hypot(p.x + (q.x - p.x) * k / 100 - x, p.z + (q.z - p.z) * k / 100 - z)).toBeGreaterThanOrEqual(r - 1e-7)
        p = q
      }
    }
    expect(planRoverPath(ROVER_HOME, { x: 0, z: 0 })).toEqual([])
  })
  it('integrates generator/load energy and stops at depletion, recharges parked', () => {
    const s = createRoverState(); commandRover(s, 'drive', 'seitah'); advance(s, 30)
    expect(s.batteryKWh).toBeCloseTo(ROVER_BATTERY_KWH + (ROVER_GENERATOR_W - ROVER_LOAD_W.driving) * 30 / 3600000, 9)
    s.batteryKWh = 0; stepRover(s, .1); expect(s.mode).toBe('parked'); expect(s.speedMps).toBe(0)
    advance(s, 600); expect(s.batteryKWh).toBeGreaterThan(0)
    s.batteryKWh = ROVER_BATTERY_KWH; advance(s, 10); expect(s.batteryKWh).toBe(ROVER_BATTERY_KWH)
  })
  it('limits sampling to rock tubes, reserves five witnesses and rejects remote sampling', () => {
    expect(commandRover(createRoverState(), 'sample')).toBe(false)
    const s = atSite()
    for (let i = 0; i < 50; i++) { commandRover(s, 'sample'); advance(s, 46) }
    expect(s.samples).toHaveLength(ROVER_TUBES - ROVER_WITNESS_TUBES)
    expect(s.tubesRemaining).toBe(5); expect(s.samples.every(t => t.sealed)).toBe(true)
  })
  it('acquires reproducible instrument data in order, in SI, with no life claim', () => {
    const a = atSite(77), b = atSite(77)
    for (const s of [a, b]) { expect(commandRover(s, 'analyze', 'all')).toBe(true); advance(s, 121) }
    expect(a.measurements).toEqual(b.measurements)
    expect(a.measurements.map(m => m.instrument)).toEqual(['SuperCam', 'PIXL', 'SHERLOC', 'MEDA', 'RIMFAX'])
    const weather = a.measurements[3].values
    expect(weather.pressurePa).toBeGreaterThanOrEqual(600); expect(weather.pressurePa).toBeLessThanOrEqual(750)
    expect(a.measurements[2].values.confirmedLife).toBe(false)
    expect(a.instrumentQueue).toEqual([]); expect(a.mode).toBe('parked')
    const c = atSite(78); commandRover(c, 'analyze', 'all'); advance(c, 121)
    expect(c.measurements).not.toEqual(a.measurements)
  })
  it('supports interruption and return, rejects invalid steps/instruments', () => {
    const s = atSite(); commandRover(s, 'analyze', 'all'); commandRover(s, 'park'); advance(s, 200)
    expect(s.measurements).toEqual([]); expect(s.instrumentQueue).toEqual([])
    expect(commandRover(s, 'analyze', 'invalid')).toBe(false)
    expect(commandRover(s, 'return')).toBe(true); expect(s.target.id).toBe('base')
    expect(() => stepRover(s, -1)).toThrow(); expect(() => stepRover(s, Infinity)).toThrow()
  })
  it('starts autonomously and generates reproducible reachable rings inside the 620 m terrain', () => {
    const a=createRoverState(77), b=createRoverState(77)
    expect(a.autopilot).toBe(true); expect(ROVER_TIME_COMPRESSION).toBe(50)
    stepRover(a,.1); stepRover(b,.1) // both consume the same seeded draw for the first far waypoint
    expect(a.mode).toBe('driving'); expect(a.waypoint.id).toBe('survey-0')
    // Far-field only: the first target is already ≥150 m from the base.
    expect(Math.hypot(a.waypoint.x-ROVER_HOME.x,a.waypoint.z-ROVER_HOME.z)).toBeGreaterThanOrEqual(149)
    for(let leg=0;leg<40;leg++) {
      a.campaignLeg=leg; b.campaignLeg=leg
      const target=nextRoverWaypoint(a), same=nextRoverWaypoint(b)
      expect(target).toEqual(same); expect(roverInBounds(target)).toBe(true)
      if(roverSegmentClear(target,target)) expect(planRoverPath(ROVER_HOME,target).length).toBeGreaterThan(0)
      expect(Math.hypot(target.x-ROVER_HOME.x,target.z-ROVER_HOME.z)).toBeLessThanOrEqual(280.00001)
    }
    expect(planRoverPath(ROVER_HOME,{x:311,z:0})).toEqual([])
  })
  it('roams beyond 200 m within 14 rover hours, conducts science, samples, and never violates speed or keep-outs', () => {
    const s=createRoverState(); let maximum=0, maximumSpeed=0, blocked=false
    for(let i=0;i<14*3600*10;i++) {
      const before={x:s.x,z:s.z}; stepRover(s,.1)
      maximum=Math.max(maximum,s.distanceFromBaseM); maximumSpeed=Math.max(maximumSpeed,s.speedMps)
      if(!roverInBounds(s) || !roverSegmentClear(before,s) || s.batteryKWh<0) blocked=true
    }
    expect(maximum).toBeGreaterThan(200); expect(maximumSpeed).toBeLessThanOrEqual(ROVER_MAX_SPEED_MPS+1e-12)
    expect(blocked).toBe(false); expect(s.measurements.length).toBeGreaterThan(25)
    expect(new Set(s.measurements.map(m=>m.instrument)).size).toBe(5); expect(s.samples.length).toBeGreaterThan(0)
    expect(s.tubesRemaining).toBe(43-s.samples.length)
  })
  it('returns on low battery, recharges from MMRTG at base, then resumes the campaign', () => {
    const s=createRoverState(); Object.assign(s,{x:210,z:70,batteryKWh:.5})
    stepRover(s,.1); expect(s.campaignPhase).toBe('returning'); expect(s.waypoint.id).toBe('base')
    let minimum=s.batteryKWh
    for(let i=0;i<70000;i++) { stepRover(s,.1); minimum=Math.min(minimum,s.batteryKWh) }
    expect(minimum).toBeGreaterThan(0); expect(s.distanceFromBaseM).toBeLessThan(.01)
    expect(s.campaignPhase).toBe('charging')
    // Jump only the battery to just below the resume threshold; verify actual W/s recharge at rest.
    s.batteryKWh=ROVER_BATTERY_KWH*.9-.00001
    advance(s,2); expect(s.campaignPhase).toBe('exploring'); expect(s.mode).toBe('driving')
    s.batteryKWh=0; stepRover(s,.1); expect(s.batteryKWh).toBeGreaterThanOrEqual(0); expect(s.speedMps).toBe(0)
  })
  it('pauses/resumes without losing its route and accepts an optional recall', () => {
    const s=createRoverState(); advance(s,90)
    const position={x:s.x,z:s.z}, path=structuredClone(s.path), phase=s.mode
    commandRover(s,'autopilot',false); advance(s,10)
    expect({x:s.x,z:s.z}).toEqual(position); expect(s.path).toEqual(path)
    commandRover(s,'autopilot',true); expect(s.mode).toBe(phase); advance(s,400)
    expect(s.odometerM).toBeGreaterThan(0)
    commandRover(s,'return'); expect(s.autopilot).toBe(true); expect(s.campaignPhase).toBe('returning')
  })
  it('uses v/r wheel speed, signed differential rotation, and opposite corner steering in a pivot turn', () => {
    const s=createRoverState(); commandRover(s,'drive','seitah'); advance(s,100)
    expect(s.speedMps).toBeGreaterThan(0)
    expect(s.wheelAngularSpeedRadS).toBeCloseTo(s.speedMps/ROVER_WHEEL_RADIUS_M,12)
    const straight=roverWheelKinematics(.042,0,1,1)
    expect(straight.angularSpeedRadS).toBeCloseTo(.042/.2625,12); expect(straight.steeringRad).toBe(0)
    const front=roverWheelKinematics(0,.12,-1,1),rear=roverWheelKinematics(0,.12,-1,-1)
    expect(front.steeringRad).toBeCloseTo(-rear.steeringRad,12)
    expect(roverWheelKinematics(0,.12,1,0,false).angularSpeedRadS).toBeCloseTo(-.12/.2625,12)
  })
  it('uses the bounded grid navigator with many terrain rocks and validates every smoothed segment', () => {
    const rocks=[...ROVER_OBSTACLES,...Array.from({length:30},(_,i)=>[75+(i%5)*8,40+Math.floor(i/5)*8,2.7])]
    const target={x:125,z:95},path=planRoverPath(ROVER_HOME,target,rocks)
    expect(path.length).toBeGreaterThan(0); let p=ROVER_HOME
    for(const q of path) { expect(roverSegmentClear(p,q,rocks)).toBe(true); expect(roverInBounds(q)).toBe(true); p=q }
    expect(p).toEqual(target)
  })
})

it('charges only at the home dock and records transferred grid energy',()=>{const dock=createRoverState();dock.autopilot=false;dock.batteryKWh=1;const before=dock.batteryKWh;stepRover(dock,.1,{dockPowerW:250});expect(dock.docked).toBe(true);expect(dock.chargingW).toBeCloseTo(250);expect(dock.gridEnergyKWh).toBeCloseTo(250*.1/3600000,12);expect(dock.batteryKWh-before).toBeCloseTo((250+110-80)*.1/3600000,12);const away=createRoverState();away.autopilot=false;away.x+=30;away.batteryKWh=1;stepRover(away,.1,{dockPowerW:250});expect(away.chargingW).toBe(0);expect(away.gridEnergyKWh??0).toBe(0);expect(()=>stepRover(away,.1,{dockPowerW:-1})).toThrow();});

it('cancels a manual recall and resumes the prior driving target without resetting battery or position',()=>{const s=createRoverState(2026,{obstacles:[]});commandRover(s,'drive','delta');const target={...s.target};expect(commandRover(s,'return')).toBe(true);expect(s.returnPlan.target).toEqual(target);const [x,z,battery]=[s.x,s.z,s.batteryKWh];expect(commandRover(s,'cancel-return')).toBe(true);expect(s.target).toEqual(target);expect(s.mode).toBe('driving');expect(s.autopilot).toBe(false);expect([s.x,s.z,s.batteryKWh]).toEqual([x,z,battery]);expect(s.returnPlan).toBeNull();});
it('returns to an interrupted analysis point before restoring its remaining work',()=>{const s=createRoverState(2026,{obstacles:[]});s.autopilot=false;Object.assign(s,{x:ROVER_STATIONS[0].x,z:ROVER_STATIONS[0].z});commandRover(s,'analyze','SuperCam');stepRover(s,.1);const remaining=s.operationRemainingS;commandRover(s,'return');expect(commandRover(s,'cancel-return')).toBe(true);stepRover(s,.1);stepRover(s,.1);expect(s.mode).toBe('analyzing');expect(s.instrumentQueue).toEqual(['SuperCam']);expect(s.operationRemainingS).toBeCloseTo(remaining-.1,8);});
