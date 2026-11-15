import * as THREE from 'three';
import { EARTH, MARS, EARTH_SURFACE_RATE } from '../sim/constants.js';
import { createPlanet, createSky } from './planet.js';
import { createLaunchSite } from './launchSite.js';
import { createTerrain } from './terrain.js';
import { createVehicle } from './vehicle.js';
import { createCabin } from './cabin.js';
import { createEffects } from './effects.js';
import { disposeScene } from './dispose.js';
import { interpolateState } from './interpolate.js';

export function createWorldScene() {
  let ctx,scene,earth,mars,sky,pad,terrain,vehicle,cabin,effects,sun,ambient,sunDisk,heatShield;
  const detached=new Map();
  return {
    enter(context){ctx=context;scene=new THREE.Scene();this.scene=scene;
      sun=new THREE.DirectionalLight(0xffefdb,3.1);sun.position.set(300,360,240);sun.castShadow=true;
      sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-190,right:190,top:190,bottom:-190,near:1,far:1400});sun.shadow.bias=-.0002;sun.shadow.normalBias=.15;
      ambient=new THREE.HemisphereLight(0xa3c8e3,0x4c4538,1.3);scene.add(sun,ambient);
      earth=createPlanet(EARTH.radius,false,ctx.assets);mars=createPlanet(MARS.radius,true,ctx.assets);sky=createSky(ctx.assets);
      pad=createLaunchSite();terrain=createTerrain();vehicle=createVehicle(ctx.assets);cabin=createCabin(ctx.assets);effects=createEffects(scene);
      scene.add(earth.group,mars.group,sky.mesh,pad.group,terrain.group,vehicle.group,cabin.group);
      heatShield=new THREE.Group();heatShield.name='jettisoned-aeroshell';heatShield.visible=false;scene.add(heatShield);
      sunDisk=new THREE.Mesh(new THREE.SphereGeometry(75000,24,16),new THREE.MeshBasicMaterial({color:new THREE.Color(8,6,3)}));sunDisk.position.set(1.2e7,1.5e7,-1e7);scene.add(sunDisk);
    },
    update(pair,alpha){const s=interpolateState(pair.previous,pair.current,alpha);
      terrain.update(s);ctx.cameras.update(s,ctx.frameDelta,terrain.surfaceY);const onboard=ctx.cameras.effective===1;
      earth.group.visible=!s.mars;mars.group.visible=s.mars;
      const sunDirection=new THREE.Vector3(.65,.55,.6).normalize();sun.position.copy(sunDirection.clone().multiplyScalar(500));
      earth.update(s,sunDirection);mars.update(s,sunDirection);sky.update(s,ctx.cameras.camera);
      if(s.phase==='CRUISE'){
        // A separately scaled distant layer preserves planet angular radii without uploading AU-sized coordinates.
        for(const [body,id]of [[earth,'earth'],[mars,'mars']]){body.group.visible=true;body.group.scale.setScalar(1e-5);body.group.position.set((s.heliocentric[id][0]-s.heliocentric.ship[0])*1e-5,0,(s.heliocentric[id][1]-s.heliocentric.ship[1])*1e-5);}
        sunDirection.set(-s.heliocentric.ship[0],0,-s.heliocentric.ship[1]).normalize();sun.position.copy(sunDirection.clone().multiplyScalar(500));sunDisk.position.copy(sunDirection.clone().multiplyScalar(2e7));
      }else{earth.group.scale.setScalar(1);mars.group.scale.setScalar(1);}
      pad.update(s);vehicle.update(s,onboard,ctx.cameras.camera);cabin.update(s,onboard);effects.setQuality(ctx.quality==="Low"?.45:ctx.quality==="Medium"?.7:1);effects.update(s,ctx.height);
      const shield=s.heatShield;
      heatShield.visible=Boolean(shield&&!shield.impacted&&!onboard);
      if(heatShield.visible){
        // Reparent the actual flight covers, never substitute another model.
        // GAME ASSUMPTION: backshell and shield share the existing simulated
        // jettison trace; no second debris force/mass model is invented here.
        if(vehicle.aeroshell.parent!==heatShield)heatShield.add(vehicle.aeroshell,vehicle.backshell);
        vehicle.aeroshell.visible=vehicle.backshell.visible=true;
        // Relative polar coordinates are subtracted in JS doubles before upload.
        const [r,theta]=shield.vector,angle=theta-s.polar[1];
        heatShield.position.set(r*Math.sin(angle),r*Math.cos(angle)-s.polar[0],0);
        heatShield.rotation.set(shield.age*.11,0,shield.age*.17);
      }
      sun.castShadow=s.altitude<1500;// Mars-phase lighting also applies before the 'mars' flag is set (MOI → deorbit coast).
      const atMars=s.mars||['MOI_BURN','MARS_ORBIT','DEORBIT','EDL','LANDED'].includes(s.phase);
      ambient.intensity=s.phase==='CRUISE'?.18:atMars?.85:Math.max(.18,1.2*Math.exp(-(s.altitude??0)/30000));
      if(s.altitude<5000) {scene.fog=new THREE.FogExp2(s.mars?0x9d7453:0x5587b5,s.mars?.000022:.000002*Math.exp(-s.altitude/5000));}else scene.fog=null;
      for(const b of s.debris){let model=detached.get(b.id);if(!model){model=vehicle.makeDebris(b.id);scene.add(model);detached.set(b.id,model);
        const flash=new THREE.Group();for(const y of [-20,20]){const flare=new THREE.Mesh(new THREE.SphereGeometry(.6,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(6,4,2),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));flare.position.set(b.id==='srbLeft'?-2:2,y,0);flash.add(flare);}model.add(flash);model.userData.flash=flash;
      }
        const a=EARTH_SURFACE_RATE*s.missionTime,c=Math.cos(a),sn=Math.sin(a),[x,y]=b.vector;
        const wx=x*c-y*sn,wy=x*sn+y*c-EARTH.radius,dx=wx-s.position[0],dy=wy-s.position[1],ct=Math.cos(s.theta),st=Math.sin(s.theta);
        model.position.set(dx*ct-dy*st,dx*st+dy*ct,0);model.rotation.z=b.angle+a+s.theta;
        model.visible=b.age<65&&!onboard;
        model.userData.flash.visible=b.id.startsWith('srb')&&b.age<.55;
      }
      for(const [id,model]of detached)if(!s.debris.some(b=>b.id===id)){scene.remove(model);disposeScene(model);detached.delete(id);}
      this.audioDistance=ctx.cameras.camera.position.length();this.state=s;
    },
    exit(){if(scene)disposeScene(scene);detached.clear();scene=null;}
  };
}
