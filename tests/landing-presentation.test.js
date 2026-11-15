import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createMarsLander } from '../src/render/marsLander.js';
import { createLandingSequence } from '../src/render/landingSequence.js';
import { disposeScene } from '../src/render/dispose.js';
import { landingCallout } from '../src/ui/hud.js';

it('shares an asset-free landed model with ground contact at zero and the hatch facing +Z', () => {
  const lander=createMarsLander();
  expect(lander.isGroup).toBe(true);lander.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(lander);
  expect(bounds.min.y).toBeCloseTo(0,6);expect(bounds.max.y).toBeGreaterThan(8);expect(bounds.max.y).toBeLessThan(10);
  for(let i=0;i<4;i++) {
    const pad=lander.getObjectByName(`footpad-${i}`);
    expect(new THREE.Box3().setFromObject(pad).min.y).toBeCloseTo(0,6);
  }
  expect(lander.getObjectByName('crew-hatch').position.z).toBeGreaterThan(0);
  expect(new THREE.Box3().setFromObject(lander.getObjectByName('crew-ladder')).min.z).toBeGreaterThan(0);
  const other=createMarsLander();
  expect(other.children[0].geometry).not.toBe(lander.children[0].geometry);
  disposeScene(lander);disposeScene(other);
});

it('runs a six-second presentation independently of frozen mission time, pauses, and resets', () => {
  const clock=createLandingSequence();clock.update('EDL',1/60);expect(clock.elapsed).toBeNull();
  clock.update('LANDED',1/60);expect(clock.elapsed).toBe(0);
  for(let i=0;i<240;i++)clock.update('LANDED',1/60);
  expect(clock.elapsed).toBeCloseTo(4);expect(clock.fade).toBe(0);expect(clock.complete).toBe(false);
  clock.paused=true;clock.update('LANDED',.1);expect(clock.elapsed).toBeCloseTo(4);
  clock.paused=false;
  for(let i=0;i<61;i++)clock.update('LANDED',1/60);
  expect(clock.fade).toBeGreaterThan(0);expect(clock.fade).toBeLessThan(1);
  for(let i=0;i<61;i++)clock.update('LANDED',1/60);
  expect(clock.complete).toBe(true);expect(clock.fade).toBe(1);
  clock.update('PRELAUNCH',1/60);expect(clock.elapsed).toBeNull();expect(clock.complete).toBe(false);
});

it('announces sim events and landing milestones in English', () => {
  const t={phase:'EDL',missionTime:100,altitude:15000,events:[{type:'HEATSHIELD_JETTISON',time:100}]};
  expect(landingCallout(t)).toContain("Heat shield jettisoned");
  expect(landingCallout({...t,altitude:999,events:[{type:'LEGS_DEPLOYED',time:100}]})).toContain('1000 m');
  expect(landingCallout({...t,altitude:900,missionTime:104,events:[{type:'LEGS_DEPLOYED',time:100}]})).toContain("Landing gear deployed");
  expect(landingCallout({...t,altitude:20})).toContain("Surface dust");
  expect(landingCallout({...t,phase:'LANDED',touchdownSpeed:1.5})).toBe('');
  expect(landingCallout({...t,phase:'ASCENT'})).toBe('');
});
