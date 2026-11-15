import { MARS_SOL_SECONDS } from '../src/sim/marsSun.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { createEnvironment } from '../src/colony/scene/environment.mjs';
import { createFirstPerson } from '../src/colony/scene/mars-fps.mjs';
import { addSurface } from '../src/colony/scene/surface.mjs';
import { jezeroLandscape } from '../src/colony/scene/mars-models.mjs';
import { createColony, exampleLanding, advanceSol } from '../src/colony/mars-koloni.mjs';

// Small event/element harness: no browser, server, WebGL context or Playwright is started.
class Element extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName=tag.toUpperCase(); this.style={}; this.children=[]; this.attributes={}; this.textContent=''; }
  append(...children) { for (const c of children) { c.parent=this; this.children.push(c); } }
  remove() { if (this.parent) this.parent.children=this.parent.children.filter(c=>c!==this); }
  setAttribute(key,value) { this.attributes[key]=value; }
  focus() { document.activeElement=this; }
  getContext() { return {
    createImageData: (w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
    putImageData() {}, createRadialGradient: ()=>({addColorStop() {}}),
    beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
  }; }
  getBoundingClientRect() { return {left:0,top:0,width:800,height:600,right:800,bottom:600}; }
}
let scene, camera, canvas, dispose;
function key(code,type='keydown') { const event=new Event(type,{cancelable:true}); Object.assign(event,{code,repeat:false}); document.dispatchEvent(event); }
beforeEach(() => {
  const doc=Object.assign(new EventTarget(),{head:new Element('head'),body:new Element('body'),pointerLockElement:null});
  doc.createElement=tag=>new Element(tag); doc.getElementById=()=>null; doc.exitPointerLock=()=>{doc.pointerLockElement=null;};
  vi.stubGlobal('document',doc); vi.stubGlobal('window',new EventTarget());
  vi.stubGlobal('ResizeObserver',class { observe() {} disconnect() {} });
  vi.stubGlobal('innerWidth',800); vi.stubGlobal('innerHeight',600);
  scene=new T.Scene(); camera=new T.PerspectiveCamera(); canvas=new Element('canvas'); dispose=undefined;
});
afterEach(() => { dispose?.(); vi.unstubAllGlobals(); });

describe('surface environment integration', () => {
  it('emits the original colony object immediately on change and at most 4Hz otherwise', () => {
    const environment=createEnvironment(scene,camera,canvas); dispose=()=>environment.dispose();
    const colony=createColony(exampleLanding), events=[];
    window.addEventListener('colony:state',e=>events.push(e.detail));
    environment.sync(colony,'Yerleştir');
    expect(events).toHaveLength(1); expect(events[0].state).toBe(colony);
    expect(events[0]).toMatchObject({storm:false,activeTask:'Yerleştir',headlamp:false});
    expect(events[0].lmst).toBeCloseTo(8,5);
    for (let i=0;i<61;i++) environment.update(1/60);
    expect(events.length).toBeLessThanOrEqual(5);
    for (const event of events) expect(event.sunElevationDeg).toBeTypeOf('number');
    environment.sync(colony,'Yerleştir'); expect(events.length).toBeLessThanOrEqual(5);
    const next=advanceSol(colony);
    environment.sync(next,'Yeni sol');
    expect(events.at(-1).state).toBe(next); expect(events.at(-1).lmst).toBeCloseTo(7,5);
    environment.sync(createColony(exampleLanding),'Sıfırla');
    expect(environment.telemetry.lmst).toBeCloseTo(8,5);
  });
  it('illuminates night with the camera lamp, respects L, and keeps daylight readable through dusty haze', () => {
    const environment=createEnvironment(scene,camera,canvas); dispose=()=>environment.dispose();
    environment.setFPS(true); environment.sync(createColony(exampleLanding),'');
    const sun=scene.getObjectByProperty('isDirectionalLight',true);
    const lamp=camera.getObjectByProperty('isSpotLight',true);
    const clearIntensity=sun.intensity;
    const ambient=scene.getObjectByProperty('isHemisphereLight',true);
    const clearAmbient=ambient.intensity;
    environment.sync({...createColony(exampleLanding),timeline:[{storm:true}]},'');
    expect(sun.intensity).toBeLessThan(clearIntensity);
    expect(sun.intensity).toBeGreaterThan(clearIntensity*.5);
    expect(ambient.intensity).toBeGreaterThan(clearAmbient);
    expect(scene.getObjectByName('Windblown Mars dust').visible).toBe(true);
    expect(scene.fog.density).toBeGreaterThan(.01);
    environment.sync(createColony(exampleLanding),'');
    environment.update(300); // 08:00 → 20:00 LMST, half a sol.
    expect(environment.telemetry.sunElevationDeg).toBeLessThan(0);
    expect(environment.telemetry.headlamp).toBe(true); expect(lamp.intensity).toBe(80);
    key('KeyL'); expect(environment.telemetry.headlamp).toBe(false); expect(lamp.intensity).toBe(0);
    key('KeyL'); expect(environment.telemetry.headlamp).toBe(true);
    environment.setFPS(false); expect(lamp.intensity).toBe(0);
    // Day/night and user toggles preserve light counts and the shadow topology.
    expect(lamp.visible).toBe(true); expect(sun.visible).toBe(true); expect(sun.castShadow).toBe(true);
    let shadows=0; scene.traverse(o=>{if(o.isLight && o.castShadow) shadows++;}); expect(shadows).toBe(1);
  });
  it('keeps reserved wrist keys available, changes warp, and removes nodes/listeners on teardown', () => {
    const environment=createEnvironment(scene,camera,canvas); dispose=undefined;
    key('KeyQ'); key('AltLeft'); expect(environment.telemetry.warp).toBe(1);
    key('BracketRight'); expect(environment.telemetry.warp).toBe(10);
    key('BracketRight'); key('BracketRight'); expect(environment.telemetry.warp).toBe(60);
    key('BracketLeft'); expect(environment.telemetry.warp).toBe(10);
    const audioBefore=environment.telemetry.audio; key('KeyM'); expect(environment.telemetry.audio).toBe(audioBefore);
    environment.update(10); environment.reset(); expect(environment.telemetry.lmst).toBeCloseTo(8,5);
    expect(environment.telemetry.warp).toBe(1);
    environment.dispose(); expect(document.body.children).toHaveLength(0); expect(document.head.children).toHaveLength(0);
    expect(scene.getObjectByName('Mars_environment')).toBeUndefined();
    expect(camera.children).toHaveLength(0);
    key('BracketRight'); expect(environment.telemetry.warp).toBe(1);
  });
  it('moves between night and day without running the Mars clock backwards', () => {
    const environment=createEnvironment(scene,camera,canvas);
    dispose=()=>environment.dispose();
    const arrival=environment.telemetry.unixSeconds;
    environment.setPaused(true);
    environment.setPeriod('night');
    const midnight=environment.telemetry.unixSeconds;
    expect(midnight).toBeGreaterThan(arrival);
    expect(environment.telemetry.sunElevationDeg).toBeLessThan(0);
    environment.setPeriod('night');
    expect(environment.telemetry.unixSeconds).toBe(midnight);
    environment.setPeriod('day');
    expect(environment.telemetry.unixSeconds).toBeGreaterThan(midnight);
    expect(environment.telemetry.sunElevationDeg).toBeGreaterThan(0);
  });
});
describe('FPS movement and terrain contracts', () => {
  it('spawns at the exact ground position and faces the colony without an implicit forward offset', () => {
    const fps=createFirstPerson(canvas,camera,{onMode:()=>{},onAim:()=>{},collides:()=>false,groundY:()=>-.035});
    dispose=()=>fps.dispose();
    fps.respawn(new T.Vector3(-16.4,0,20.7),-.65); fps.setActive(true);
    expect(camera.position.toArray()).toEqual([-16.4,1.615,20.7]);
    const forward=camera.getWorldDirection(new T.Vector3()); expect(forward.x).toBeGreaterThan(.5); expect(forward.z).toBeLessThan(-.7);
    fps.update(1); expect(camera.position.y).toBeCloseTo(1.615,6);
  });
  it('walks and runs at suit speeds, clears held keys for the wrist, and jumps under Mars gravity', () => {
    const onStep=vi.fn();
    const fps=createFirstPerson(canvas,camera,{onMode:()=>{},onAim:()=>{},interact:()=>{},accessRoof:()=>{},collides:()=>false,groundY:()=>0,onStep});
    dispose=()=>fps.dispose(); fps.setActive(true);
    const z=camera.position.z; key('KeyW'); fps.update(1);
    expect(z-camera.position.z).toBeCloseTo(1.8,2); expect(onStep).toHaveBeenCalled();
    key('ShiftLeft'); const walkZ=camera.position.z; fps.update(1);
    expect(walkZ-camera.position.z).toBeCloseTo(4.5,2);
    key('Tab'); const stopZ=camera.position.z; fps.update(1); expect(camera.position.z).toBe(stopZ);
    key('Space'); fps.update(.2); expect(camera.position.y).toBeGreaterThan(1.8); expect(fps.telemetry.grounded).toBe(false);
    fps.update(1); expect(camera.position.y).toBeCloseTo(1.65,5); expect(fps.telemetry.grounded).toBe(true);
    key('Escape'); expect(fps.active).toBe(true);
  });
  it('honours collision and a raised support surface without sinking back to ground', () => {
    let support=0; const fps=createFirstPerson(canvas,camera,{onMode:()=>{},onAim:()=>{},interact:()=>{},accessRoof:lookFrom=>{
      support=3; lookFrom(new T.Vector3(0,4.65,0),-1.47);
    },collides:()=>true,groundY:()=>support});
    dispose=()=>fps.dispose(); fps.setActive(true); const z=camera.position.z;
    key('KeyW'); fps.update(.5); expect(camera.position.z).toBe(z);
    key('KeyR'); fps.update(.5); expect(camera.position.y).toBeCloseTo(4.65,5);
  });
  it('provides continuous near-ground heights that match rendered triangles and a metre-scale regional horizon', () => {
    const ground=addSurface(scene), landscape=jezeroLandscape(); scene.add(landscape);
    const ray=new T.Raycaster(), down=new T.Vector3(0,-1,0);
    scene.updateMatrixWorld(true);
    for (const [x,z] of [[0,0],[-18,20],[34.1,11.7],[-49.2,-43.1],[90.4,-120.3]]) {
      ray.set(new T.Vector3(x,100,z),down);
      expect(ground.userData.heightAt(x,z)).toBeCloseTo(ray.intersectObject(ground)[0].point.y,5);
    }
    landscape.geometry.computeBoundingBox();
    expect(landscape.geometry.boundingBox.max.x).toBe(24000);
    expect(landscape.geometry.boundingBox.max.y).toBeGreaterThan(600);
    // Local morphology has no second regional surface underneath it.
    for (const [x,z] of [[0,0],[35,12],[-49,-43],[149,149]]) {
      ray.set(new T.Vector3(x,100,z),down);
      expect(ray.intersectObject(landscape)).toHaveLength(0);
    }
    const pad=ground.userData.heightAt(0,0);
    for (const [x,z] of [[20,0],[-20,0],[0,20],[0,-20]]) expect(ground.userData.heightAt(x,z)).toBeCloseTo(pad,6);
    ray.set(new T.Vector3(150,100,0),down);
    expect(ray.intersectObject(landscape)[0].point.y).toBeCloseTo(ground.userData.heightAt(150,0),6);
    expect(ground.material.bumpMap.image.width).toBe(512);
    expect(scene.getObjectByName('Jezero_gravel_carpet').count).toBeLessThan(3000);
    expect(ground.userData.rocks.count).toBeLessThan(1000);
    scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat()){m?.bumpMap?.dispose();m?.dispose();}});
  });
  it('restores the original plan-camera field of view after FPS exploration', () => {
    camera.fov=48;
    const fps=createFirstPerson(canvas,camera,{onMode:()=>{},onAim:()=>{},collides:()=>false,groundY:()=>0});
    dispose=()=>fps.dispose();
    fps.setActive(true); expect(camera.fov).toBe(66);
    fps.setActive(false); expect(camera.fov).toBe(48);
  });
  it('teleports through the airlock with an explicit heading and keeps the interior floor', () => {
    const fps=createFirstPerson(canvas,camera,{onMode:()=>{},onAim:()=>{},interact:()=>{},collides:()=>false,groundY:()=>.5});
    dispose=()=>fps.dispose(); fps.setActive(true);
    fps.teleport(new T.Vector3(0,2.15,2.45),0,Math.PI/2);
    const direction=camera.getWorldDirection(new T.Vector3());
    expect(direction.x).toBeCloseTo(-1,6);
    fps.update(.5);expect(camera.position.y).toBeCloseTo(2.15,6);
    expect(camera.position.z).toBeCloseTo(2.45,6);
  });
});
