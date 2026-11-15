import { Vector3 } from 'three';
import { createAirlock } from './airlock.mjs';

export function createOvaNavigation(world) {
  let inside=false,activeLock=null;
  const locks=world.locks.map(lock=>({...lock,airlock:createAirlock({
    innerZ:2.92,outerZ:5.12,halfWidth:.61,
    setDoors(inner,outer){lock.inner.position.x=inner?-1.8:0;lock.outer.position.x=outer?1.8:0;}
  })}));
  const nearest=(x,z)=>locks.find(l=>Math.abs(x-l.x)<1.05&&Math.abs(z-(inside?2.45:world.entryZ))<2);
  function aimed(camera,x,z,doorX,doorZ){
    if(!camera)return true;
    const d=camera.getWorldDirection(new Vector3());
    if(Math.abs(d.z)<.001)return false;
    const t=(doorZ-z)/d.z;
    const hitY=camera.position.y+d.y*t-world.floorY;
    return t>0&&t<3.5&&Math.abs(x+d.x*t-doorX)<.8&&hitY>.02&&hitY<2.12;
  }
  return {
    get inside(){return inside||Boolean(activeLock&&activeLock.airlock.phase!=='entry');},
    reset(){inside=false;activeLock=null;locks.forEach(l=>l.airlock.reset());},
    floorAt(x,z){
      if(inside&&z<2.92)return world.floorY;
      const ramp=locks.find(l=>Math.abs(x-l.x)<.77&&z>=2.65&&z<=world.entryZ);
      if(!ramp)return null;
      const fraction=Math.max(0,(z-5.12)/(world.entryZ-5.12));
      return world.floorY+(ramp.rampFootY-world.floorY)*fraction;
    },
    prompt(x,z,camera){
      if(activeLock){
        const {airlock}=activeLock;
        if(airlock.phase==='ready'&&!aimed(camera,x,z,activeLock.x,airlock.targetZ))return "Look at the second door";
        return airlock.prompt;
      }
      if(inside){
        const roomPrompt=world.messagePrompt?.(x,z,camera)||world.labPrompt?.(x,z,camera)||world.privacyPrompt?.(x,z);
        if(roomPrompt)return roomPrompt;
      }
      const lock=nearest(x,z);
      return lock&&aimed(camera,x,z,lock.x,inside?2.92:5.12)?"E · Open airlock":'';
    },
    interact(x,z,camera){
      if(activeLock){
        const {airlock}=activeLock;
        if(aimed(camera,x,z,activeLock.x,airlock.targetZ))airlock.release();
        return true;
      }
      if(inside&&(world.openMessages?.(x,z,camera)||world.startLab?.(x,z,camera)||world.togglePrivacy?.(x,z)))return true;
      const lock=nearest(x,z);
      if(!lock||!aimed(camera,x,z,lock.x,inside?2.92:5.12))return false;
      activeLock=lock;lock.airlock.open(inside);
      return true;
    },
    update(dt,x,z){
      if(!activeLock)return;
      const {airlock}=activeLock;
      const arrived=airlock.update(dt,x-activeLock.x,z);
      if(arrived!==null)inside=arrived;
      if(!airlock.active)activeLock=null;
    },
    collides(x,z){
      if(activeLock){
        const blocked=activeLock.airlock.passage(x-activeLock.x,z);
        if(blocked!==null)return blocked;
      }
      if(inside)return Boolean(world.privacyBlocked?.(x,z))||!world.isInsideFloor(x,z)||world.indoorObstacles.some(b=>x>b.min.x-.2&&x<b.max.x+.2&&z>b.min.z-.2&&z<b.max.z+.2);
      return Math.abs(x)>170||Math.abs(z)>170||world.isHabitatBlocked(x,z)||world.obstacles.some(b=>x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z);
    }
  };
}
