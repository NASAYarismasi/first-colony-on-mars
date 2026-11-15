import { it, expect } from 'vitest';
import { createEDL, entryFromOrbit } from '../src/sim/edl.js';
import { LANDER } from '../src/data/sls.js';
import { MARS } from '../src/sim/constants.js';
function land(options, dt = .02) {
  const e = createEDL(options);
  for (let i = 0; i < 500000 && !['LANDED', 'FAILED'].includes(e.state.status); i++) e.step(dt);
  return e;
}
it('starts from the deorbit ellipse and lands safely using lifting entry and SRP, without parachutes', () => {
  const entry = entryFromOrbit();
  expect(entry.vector[0] - MARS.radius).toBe(125000);
  expect(entry.vector[2]).toBeLessThan(0);
  const e = land(), t = e.getTelemetry();
  expect(t.status).toBe('LANDED'); expect(t.altitude).toBe(0);
  expect(t.touchdownSpeed).toBeLessThan(2.5); expect(t.touchdownSpeed).toBeGreaterThan(0);
  expect(t.propellant).toBeGreaterThan(0); expect(t.propellant).toBeLessThan(LANDER.propellantMass);
  expect(t.peakDeceleration).toBeGreaterThan(10); expect(t.peakHeating).toBeGreaterThan(1000); expect(t.heatLoad).toBeGreaterThan(0);
  const srp = e.state.events.find(e => e.type === 'SRP_IGNITION');
  expect(srp.speed).toBeGreaterThan(500); // engines start supersonically.
  expect(Math.abs(land(undefined, .01).getTelemetry().touchdownSpeed - t.touchdownSpeed)).toBeLessThan(.02);
  console.info('EDL', JSON.stringify({ touchdownSpeed: t.touchdownSpeed, propellant: t.propellant, peakDeceleration: t.peakDeceleration, peakHeating: t.peakHeating, srp }));
});
it('reports hard touchdown rather than manufacturing a landing when propellant is absent', () => {
  expect(land({ propellant: 0 }).getTelemetry().status).toBe('FAILED');
});

it('jettisons one independently integrated shield at SRP and commands gear below 1000 m', () => {
  const e=createEDL();
  while(!e.state.powered)e.step(.02);
  const snapshot=e.getTelemetry();
  expect(snapshot.heatShield).not.toBeNull();
  expect(snapshot.legsDeployed).toBe(false);
  expect(e.state.events.slice(0,2).map(e=>e.type)).toEqual(['HEATSHIELD_JETTISON','SRP_IGNITION']);
  expect(snapshot.thrustAngle).toBeCloseTo(Math.atan2(-e.state.control.at,e.state.control.ar));
  const shieldBefore=[...snapshot.heatShield.vector];
  e.step(.02);
  expect(snapshot.heatShield.vector).toEqual(shieldBefore); // copied telemetry, not live sim data
  expect(e.getTelemetry().heatShield.vector).not.toEqual(shieldBefore);
  while(!['LANDED','FAILED'].includes(e.state.status))e.step(.02);
  expect(e.state.events.filter(e=>e.type==='HEATSHIELD_JETTISON')).toHaveLength(1);
  const gear=e.state.events.filter(e=>e.type==='LEGS_DEPLOYED');
  expect(gear).toHaveLength(1);expect(gear[0].altitude).toBeLessThanOrEqual(1000);
  expect(gear[0].time).toBeGreaterThan(e.state.events[0].time);
  expect(e.getTelemetry().legsDeployed).toBe(true);
  expect(e.state.status).toBe('LANDED');
});

it('propagates released shield debris under inverse-square gravity and stops at ground crossing', () => {
  const r=MARS.radius+1e6,e=createEDL({vector:[r,0,0,0]});
  e.state.heatShield={vector:[r,0,0,0],age:0,impacted:false};
  e.step(.02);
  expect(e.state.heatShield.vector[2]).toBeCloseTo(-MARS.mu/(r*r)*.02,8);
  expect(e.state.heatShield.vector[0]).toBeLessThan(r);
  // A low-altitude tracer must not fall through the spherical surface.
  e.state.heatShield={vector:[MARS.radius+.01,0,-10,MARS.rotation*MARS.radius],age:0,impacted:false};
  e.step(.02);
  const impact=e.getTelemetry().heatShield;
  expect(impact.impacted).toBe(true);expect(impact.vector[0]).toBe(MARS.radius);
  expect(impact.age).toBeGreaterThan(0);expect(impact.age).toBeLessThan(.02);
  e.step(.02);expect(e.getTelemetry().heatShield).toEqual(impact);
});
