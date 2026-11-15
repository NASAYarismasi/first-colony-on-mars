import * as THREE from 'three';
import { landingSequence } from './landingSequence.js';
import { vehicleConfiguration, transitOrbitOffset } from './vehiclePhases.js';
export const CAMERA_NAMES=["Follow","Cabin / landing window","Ground tracking","Engine camera","Cinematic","Orbit map"];
export function createCameras(canvas) {
  const camera=new THREE.PerspectiveCamera(45,1,.15,1e10);let selected=0,effective=0,lastEffective=-1,yaw=.52,elevation=.16,distance=235,zoom=1,initialized=false,cinematicTime=0;
  const desired=new THREE.Vector3(),target=new THREE.Vector3();let drag=false;
  const down=e=>{if(e.button===0){drag=true;canvas.setPointerCapture(e.pointerId);}};
  const up=()=>{drag=false;};
  const move=e=>{if(drag&&selected===0){yaw-=e.movementX*.005;elevation=THREE.MathUtils.clamp(elevation+e.movementY*.004,-.7,1.35);}};
  const wheel=e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom*Math.exp(e.deltaY*.001),.2,6);};
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointermove',move);canvas.addEventListener('wheel',wheel,{passive:false});
  return {camera,get selected(){return selected;},get effective(){return effective;},get name(){return CAMERA_NAMES[selected]+(selected===4?` / ${CAMERA_NAMES[effective]}`:'');},
    select(i){selected=(i+6)%6;initialized=false;zoom=1;},cycle(){this.select(selected+1);},
    update(s,dt,surfaceY){
      landingSequence.update(s.phase,dt);
      const configuration=vehicleConfiguration(s),inLander=configuration.cabin==='lander',stack=configuration.docked;
      effective=selected;
      if(selected===4){
        const age=id=>{const e=s.events.find(e=>e.type===id);return e?s.missionTime-e.time:Infinity;};
        if(s.phase==='PRELAUNCH')effective=s.countdown.time>=-6.5&&s.countdown.running?3:2;
        else if(s.phase==='ASCENT')effective=age('SRB_SEPARATION')<12||age('LAS_JETTISON')<6||(s.dynamicPressure??0)>27000?0:age('MECO')<10||age('ICPS_IGNITION')<10?3:age('LIFTOFF')<18?2:Math.floor((s.phaseTime-18)/24)%2===0?0:3;
        else effective=s.phase==='EDL'&&s.altitude<250?2:0;
      }
      if(s.phase==='LANDED')effective=0;
      if(effective!==lastEffective){initialized=false;lastEffective=effective;}
      const launch=configuration.launch,h=launch?(s.stages.find(p=>p.id==='core').attached?(s.phase==='ASCENT'?25:48):80):stack?0:5;
      target.set(0,h,0);camera.up.set(0,1,0);camera.fov=45;camera.near=.15;
      if(effective===0){
        // GAME ASSUMPTION: framing margins for the ~67 m assembled vehicle.
        distance=launch?(s.phase==='ASCENT'?320:260):stack?145:70;
        if(stack){const a=s.attitude+s.theta;target.set(9*Math.sin(a),-9*Math.cos(a),0);}
        if(s.phase==='DEORBIT'){
          const offset=new THREE.Vector3().fromArray(transitOrbitOffset(s));
          if(offset.length()<180){target.copy(offset).multiplyScalar(.5);distance=145+offset.length()*.65;}
        }
        const d=distance*zoom;desired.set(Math.sin(yaw)*d,target.y+Math.sin(elevation)*d,Math.cos(yaw)*Math.cos(elevation)*d);
        if(selected===4&&stack){const orbit=s.phaseTime*.012;desired.set(Math.sin(.55+orbit)*d,target.y+d*.32,Math.cos(.55+orbit)*d);}
      }
      else if(effective===1){
        if(inLander){desired.set(0,8.6,2.8);target.set(.2,3.5,14);camera.fov=70;}
        else {desired.set(3.55,3.45,-3.55);target.set(-.4,1.5,.5);camera.fov=78;}
        camera.near=.06;
      }
      else if(effective===2){
        if(inLander){
          // GAME ASSUMPTION: autonomous site camera, 52 m from the contact
          // reference. Ground height follows the same sim altitude as terrain.
          desired.set(34,9-(s.altitude??0),40);target.set(0,5,0);
          camera.fov=THREE.MathUtils.clamp(2*Math.atan(18*zoom/desired.distanceTo(target))*180/Math.PI,1.2,42);
        }else if(stack){desired.set(80,45,120);target.set(0,-9,0);camera.fov=46;
        }else{
        // Fixed ground site 5 km west of LC-39B, transformed through the same floating origin.
        const x=-1800-s.position[0],y=24-s.position[1],c=Math.cos(s.theta),sn=Math.sin(s.theta);
        desired.set(x*c-y*sn,x*sn+y*c,1600);
        target.y=launch&&s.altitude<220?42-s.altitude*.5:h;
        const dist=desired.distanceTo(target);camera.fov=THREE.MathUtils.clamp(2*Math.atan((launch?180:35)*zoom/dist)*180/Math.PI, .18, 40);
        }
      }else if(effective===3){
        if(stack){const a=s.attitude+s.theta;desired.set(38,14,55).applyAxisAngle(new THREE.Vector3(0,0,1),a);target.set(0,-29,0).applyAxisAngle(new THREE.Vector3(0,0,1),a);camera.fov=66;}
        else{desired.set(5,launch?30:6,4);target.set(0,-70,-3);camera.fov=75;}
      }
      else{desired.set(0,180,250);target.set(0,0,0);camera.near=.1;camera.fov=45;}
      if(s.titleScreen){cinematicTime+=Math.min(.1,dt);const angle=.42+Math.sin(cinematicTime*.045)*.10;desired.set(Math.sin(angle)*240,65+Math.sin(cinematicTime*.035)*7,Math.cos(angle)*240);target.set(-56,47,0);camera.fov=34;}
      if(s.phase==='LANDED'){
        // Ease from the final chase shot to the +Z hatch without moving the vehicle.
        const progress=THREE.MathUtils.smoothstep(landingSequence.elapsed??0,0,4.6);
        desired.set(THREE.MathUtils.lerp(26,1.8,progress),THREE.MathUtils.lerp(13,6,progress),THREE.MathUtils.lerp(38,10.8,progress));
        target.set(0,THREE.MathUtils.lerp(4.5,5.6,progress),THREE.MathUtils.lerp(0,5.7,progress));camera.fov=48;
      }
      const damping=effective===1||effective===3||effective===5?1:1-Math.exp(-Math.min(.1,dt)*7);
      if(!initialized){camera.position.copy(desired);initialized=true;}else camera.position.lerp(desired,damping);
      if(effective!==5){const shake=effective===1?.006:effective===2?.013:.05;const amount=Math.min(1,(s.acceleration??0)/40+(s.dynamicPressure??0)/40000)*shake;camera.position.x+=Math.sin(s.missionTime*71)*amount;camera.position.y+=Math.sin(s.missionTime*89)*amount;}
      if(surfaceY && (s.phase==='EDL'||s.phase==='LANDED') && s.altitude<1000 && effective!==1){
        const floor=surfaceY(camera.position.x,camera.position.z);
        camera.position.y=Math.max(camera.position.y,floor+5);
      }
      camera.lookAt(target);camera.updateProjectionMatrix();
    },dispose(){canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('wheel',wheel);}
  };
}
