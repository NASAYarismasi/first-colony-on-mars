import { createAirlock } from './airlock.mjs';
import {advanceFacilityWater} from "./power/facility-water.mjs";
import {supplyHabitatOxygen} from './power/habitat-oxygen.mjs';
import {createPowerController} from './power/controller.mjs';
import { createSystemConsoles } from '../scene/system-consoles.mjs';
/** IHAN-SRC — İhan's real a7d5ce6 installations and sera-demo airlock, hosted by the shared scene. */
import * as T from 'three';
import { createAirSystem } from './hava.mjs';
import { createWaterSystem } from "./su.mjs";
import { createGreenhouse } from './sera.mjs';
import { COLONY_ENERGY_KWH, createLifeSupport, syncLifeSupport, lifeSupportTelemetry } from '../../sim/colonyLifeSupport.js';
import { findAnimatedObjects, batchStaticLeaves } from '../scene/static-model.mjs';

function createOxygenLine(scene,heightAt,plantHeight,habitatFloor){
  const material=new T.MeshStandardMaterial({color:0x548c9d,metalness:.45,roughness:.46});
  const ground=(x,z)=>heightAt(x,z)-.45;
  const points=[
    [17.45,plantHeight+3.95,4.1],[16.95,plantHeight+3.95,4.1],
    [16.95,ground(16.95,4.1),4.1],[14,ground(14,2),2],
    [13.65,ground(13.65,0),0],[13.65,habitatFloor+.48,0],[12.52,habitatFloor+.48,0],
  ].map(p=>new T.Vector3(...p));
  const path=new T.CurvePath();
  for(let index=1;index<points.length;index++)path.add(new T.LineCurve3(points[index-1],points[index]));
  const geometry=new T.TubeGeometry(path,80,.065,8,false);
  const mesh=new T.Mesh(geometry,material);
  mesh.name='MOXIE to Habitat oxygen service line';
  scene.add(mesh);
  return {dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();}};
}

export function createLifeSupportFacilities(scene, heightAt, initialState, habitatFloor) {
  const power=createPowerController({blackStart:false,firstStormDelay:3600,initialEnergy:initialState.startupEnergy*COLONY_ENERGY_KWH}) // GAME ASSUMPTION: clear landing window.;
  const origin = { x: 26, z: -11, y: heightAt(26, -11) };
  const greenhouse = createGreenhouse(scene);
  greenhouse.group.position.set(origin.x, origin.y, origin.z);
  const air = createAirSystem(scene, { x: 19, z: 6, heightAt });
  const water = createWaterSystem(scene, { x: 64, z: -26, heightAt });
  const oxygenLine=createOxygenLine(scene,heightAt,air.group.position.y,habitatFloor);
  const machinery = [air, water].map(model => new T.Box3().setFromObject(model.group).expandByScalar(.32));
  // Host perf: ~920 static parts (pipes, flanges, frames, panels) become per-material batches.
  // Whatever İhan's own API moves (doors, fans, drill) is detected by running it once and stays live.
  const keepGreenhouse = findAnimatedObjects(greenhouse.group, () => { greenhouse.setAirlock(true, true, true); greenhouse.setNight(true); });
  greenhouse.setNight(false); greenhouse.setAirlock(false, false);
  const keepAir = findAnimatedObjects(air.group, () => { air.update({ producer: true }); for (let i = 1; i < 4; i++) air.frame(i, .5); });
  const keepWater = findAnimatedObjects(water.group, () => { water.update({ extractor: true }); for (let i = 1; i < 4; i++) water.frame(i, .5); });
  air.update({ producer: false }); water.update({ extractor: false });
  const batched = [batchStaticLeaves(greenhouse.group, keepGreenhouse), batchStaticLeaves(air.group, keepAir), batchStaticLeaves(water.group, keepWater)];
  let support = createLifeSupport(initialState), colony = initialState;
  let inside = false, time = 0, lastDraw = -1;
  const innerZ=6.07, outerZ=8.81, halfWidth=.76;
  const airlock=createAirlock({innerZ,outerZ,halfWidth,clearance:.5,setDoors:greenhouse.setAirlock});
  const greenhouseControls={irrigation:true,ledMode:'auto'};
  const ledOn=()=>(power.meters?.greenhouse?.ledKW??0)>0;
  const pumpOn=()=>(power.meters?.greenhouse?.pumpKW??0)>0;
  const applyGreenhouse=()=>{greenhouse.setNight(ledOn());greenhouse.setIrrigation(pumpOn());};
  const worldOf=set=>[...set].map(o=>o.getWorldPosition(new T.Vector3()));
  const vents=worldOf(keepAir).filter(p=>p.y>1.5),drill=worldOf(keepWater)[0]??new T.Vector3(64,heightAt(64,-26),-26);
  function electricalTelemetry(){
    const telemetry=lifeSupportTelemetry(support),grid=power.telemetry;
    return {...telemetry,electrical:grid,
      powerKW:grid.flow.totalConsumption,
      availableKW:grid.flow.solar+grid.flow.batteryToBus+grid.flow.roverKW,
      spentKWh:Object.values(grid.state.loadEnergy).reduce((sum,value)=>sum+value,0)};
  }
  function consoleTelemetry(){const t=electricalTelemetry();return {...t,oxygenHours:t.crew?t.oxygenKg/(t.crew*.84/24):0,waterDays:t.crew?t.waterL/(t.crew*3.52):0,
    controls:{solar:{},air:{fans:Boolean(t.air.fans)},water:{extract:Boolean(t.water.extractor),recycle:Boolean(t.water.recycler)},greenhouse:{...greenhouseControls}},
    greenhouse:{ledOn:ledOn(),pumpOn:pumpOn()},airlock:airlock.phase==='ready'?'awaiting-door':airlock.phase==='cycling'?'cycling':'idle'};}
  const consoles=createSystemConsoles({scene,heightAt,placements:{air:{x:23.4,z:9.4},water:{x:60.4,z:-21.6},greenhouse:{x:origin.x+3.4,z:origin.z+9.8},habitat:{x:2.5,z:7.4},solar:{x:-40.5,z:31}},
    emitters:{airVents:vents.length?vents:[new T.Vector3(19,2.8,6)],drill:new T.Vector3(drill.x,heightAt(drill.x,drill.z),drill.z),beds:Array.from({length:6},(_,i)=>new T.Vector3(origin.x+1.85+(i%2)*1.65,origin.y+1.3,origin.z-3.8+Math.floor(i/2)*3.35))},getTelemetry:consoleTelemetry,setControl:(system,key,value)=>{if(system==='solar'&&key==='sweep')return power.startSweep();if(system!=='greenhouse')return;if(key==='ledMode'&&['auto','on','off'].includes(value))greenhouseControls.ledMode=value;if(key==='irrigation'&&typeof value==='boolean')greenhouseControls.irrigation=value;applyGreenhouse();}});
  const direction = new T.Vector3();
  const local = camera => ({ x: camera.position.x - origin.x, z: camera.position.z - origin.z });
  function facing(camera, exiting) { camera.getWorldDirection(direction); return exiting ? direction.z > .5 : direction.z < -.5; }
  function near(camera) {
    const p = local(camera);
    return Math.abs(p.x) < 1.15 && Math.abs(p.z - (inside ? 6.07 : 8.81)) < 2.1 && facing(camera, inside);
  }
  function prompt(camera) {
    if (airlock.active) {
      if (airlock.phase==='ready'&&!facing(camera,airlock.targetZ===outerZ)) return "Look at the second door";
      return airlock.prompt;
    }
    return near(camera) ? (inside ? "E · Open greenhouse exit door" : "E · Open greenhouse entrance door") : '';
  }
  function draw() {
    const t = electricalTelemetry(), n = value => value.toLocaleString("en-US", { maximumFractionDigits: 3 });
    const values = { oxygen: `${n(t.oxygenKg)} kg`, produced: `${n(t.air.generatedKg)} kg`, consumed: `${n(t.air.consumedKg)} kg`,
      co2: `${n(t.air.removedCO2Kg)} kg`, water: `${n(t.waterL)} L`, extracted: `${n(t.water.extractedL)} L`, recycled: `${n(t.water.recoveredL)} L`,
      power: `${n(t.powerKW)} / ${n(t.availableKW)} kW` };
    for (const [key,value] of Object.entries(values)) { const el = document.getElementById(`life-${key}`); if (el) el.textContent = value; }
  }
  const api={
    consoles,power,
    forecast(){return power.forecast({water:support.water,air:support.air,crew:support.crew,...greenhouseControls});},
    resetNavigation(){inside=false;airlock.reset();},
    reserveChargingEnergy(requested){return power.consumeEnergy(requested);},
    get inside() { return inside || airlock.active; },
    floorAt(x,z) {
      const px=x-origin.x, pz=z-origin.z;
      if (inside&&pz<innerZ) return origin.y+.25;
      if (Math.abs(px)>halfWidth||pz<innerZ-.65||pz>outerZ+.65) return null;
      const t=Math.min(1,Math.max(0,(pz-outerZ)/.65));
      return (origin.y+.25)*(1-t)+heightAt(x,z)*t;
    },
    get telemetry() { return { ...electricalTelemetry(), greenhouse: { inside, airlock: airlock.phase==='ready'?'awaiting-door':airlock.phase==='cycling'?'cycling':'idle', night: this.night, ledMode:greenhouseControls.ledMode, ledOn:ledOn(),pumpOn:pumpOn() } }; },
    night: false,
    prompt:camera=>prompt(camera)||consoles.prompt(camera),
    interact(camera) {
      if (airlock.active) {
        if (facing(camera,airlock.targetZ===outerZ)) airlock.release();
        return true;
      }
      if (near(camera)) {
        airlock.open(inside);
        return true;
      }
      return !inside&&consoles.interact(camera);
    },
    collides(x, z) {
      const px = x-origin.x, pz = z-origin.z;
      if (airlock.active) {
        const blocked=airlock.passage(px,pz);
        if(blocked!==null)return blocked;
      }
      if (inside) {
        if (Math.abs(px)>4.55 || pz< -5.5 || pz>innerZ-.25) return true;
        if (px< -2.55 && px> -3.95 && pz<4.9 && pz> -5.1) return true;
        for(let row=0;row<3;row++)for(let col=0;col<2;col++)
          if(Math.abs(px-(1.85+col*1.65))<.95 && Math.abs(pz-(-3.8+row*3.35))<1.45)return true;
        return false;
      }
      return this.blocksFootprint(x,z,.3,.3)||consoles.blocks(x,z);
    },
    blocksFootprint(x,z,hx,hz) {
      return (Math.abs(x-origin.x)<5.5+hx && z+hz>origin.z-6.4 && z-hz<origin.z+6.4)
        || (Math.abs(x-origin.x)<1.4+hx && z+hz>origin.z+6.3 && z-hz<origin.z+9)
        || machinery.some(b=>x+hx>b.min.x && x-hx<b.max.x && z+hz>b.min.z && z-hz<b.max.z);
    },
    sync(next) { support = syncLifeSupport(support, colony, next, { simulate:false }); colony = next; draw(); },
    update(dt, environment, camera, fpsActive) {
      time += dt;
      power.syncWater(support.water);
      this.night=environment.sunElevationDeg<=0;
      power.update(environment,true,(grid,hours,state)=>{
        support={...support,
          air:supplyHabitatOxygen(support.air,hours,grid,state,support.crew),
          water:advanceFacilityWater(support.water,hours,grid,support.crew)};
        state.water=support.water.cleanL;
        state.iceKg=support.water.iceKg;
      },{
        ...greenhouseControls,
        waterBeforeDrilling:(habitat,hours)=>advanceFacilityWater(support.water,hours,{habitat},support.crew).cleanL,
      });
      applyGreenhouse();
      if(fpsActive&&airlock.active){
        const p=local(camera);
        const arrived=airlock.update(dt,p.x,p.z);
        if(arrived!==null)inside=arrived;
      }
      air.update({...support.air,producer:Boolean(power.meters?.moxie?.duty)&&!power.meters?.gas?.tankFull}); water.update({...support.water,extractor:support.water.extractor&&!power.meters?.water?.tankHold});
      air.frame(time,dt); water.frame(time,dt); greenhouse.frame(time);
      consoles.update(dt);
      if (time-lastDraw>.25) { draw(); lastDraw=time; }
    },
    reset(next) { power.reset(next.startupEnergy*COLONY_ENERGY_KWH);support=createLifeSupport(next); colony=next; inside=false; airlock.reset();  Object.assign(greenhouseControls,{irrigation:true,ledMode:'auto'}); applyGreenhouse(); draw(); },
    views: {
      greenhouse: { position:[origin.x+13,origin.y+8,origin.z+19], target:[origin.x,origin.y+2,origin.z] },
      air: { position:[25,5.5,17], target:[19,1.6,6] },
      water: { position:[55,6.1,-15], target:[62,1.65,-26] },
    },
    dispose() { oxygenLine.dispose();consoles.dispose();greenhouse.dispose(); air.dispose(); water.dispose(); for (const m of [greenhouse,air,water]) m.group.removeFromParent(); },
  };
  return api;
}
