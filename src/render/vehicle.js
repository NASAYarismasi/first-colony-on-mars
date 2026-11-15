import * as THREE from 'three';
import { createMarsLander, createMarsHeatShield, createMarsBackshell } from './marsLander.js';
import { cylinder, material, canvasTexture } from './primitives.js';
import { createOrion, createTransitHardware } from './transitParts.js';
import { vehicleConfiguration, transitOrbitOffset } from './vehiclePhases.js';

const PARTS = { srbLeft: [-6.4,27,0], srbRight:[6.4,27,0], core:[0,33,0], icps:[0,73,0], orion:[0,84,0], las:[0,94,0] };

/** Split the monolithic NASA mesh by geometric region into independently disposable stage meshes. */
function splitSLS(model) {
  const source = model.clone(true); source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const scale = 98 / size.y, buckets = Object.fromEntries(Object.keys(PARTS).map(id=>[id,{p:[],n:[],c:[]} ]));
  const pos = new THREE.Vector3(), norm = new THREE.Vector3(), normalMatrix = new THREE.Matrix3();
  source.traverse(m => {
    if (!m.isMesh) return;
    const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone(), p=g.attributes.position,n=g.attributes.normal;
    normalMatrix.getNormalMatrix(m.matrixWorld);
    for(let i=0;i<p.count;i+=3) {
      const triangle=[];
      for(let j=0;j<3;j++) {pos.fromBufferAttribute(p,i+j).applyMatrix4(m.matrixWorld);pos.x=(pos.x-center.x)*scale;pos.z=(pos.z-center.z)*scale;pos.y=(pos.y-bounds.min.y)*scale;triangle.push(pos.clone());}
      const c=triangle[0].clone().add(triangle[1]).add(triangle[2]).multiplyScalar(1/3);
      const id=Math.abs(c.x)>4.4&&c.y<61?(c.x<0?'srbLeft':'srbRight'):c.y<66?'core':c.y<80?'icps':c.y<90?'orion':'las';
      const b=buckets[id], pivot=PARTS[id];
      let color=new THREE.Color(id==='core'&&c.y>9&&c.y<62?0xbd6d33:0xe1e0d5);
      if(c.y<4)color.set(0x485054);
      if((id.startsWith('srb')&&[12,23,34,45].some(y=>Math.abs(c.y-y)<.16))||id==='core'&&(Math.abs(c.y-18)<.22||Math.abs(c.y-55)<.22))color.set(0x5c5548);
      for(let j=0;j<3;j++) {b.p.push(triangle[j].x-pivot[0],triangle[j].y-pivot[1],triangle[j].z-pivot[2]);norm.fromBufferAttribute(n,i+j).applyMatrix3(normalMatrix).normalize();b.n.push(...norm.toArray());b.c.push(color.r,color.g,color.b);}
    }g.dispose();
  });
  return Object.fromEntries(Object.entries(buckets).map(([id,b])=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));
    const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.64,metalness:.18}));m.castShadow=true;m.receiveShadow=true;return [id,m];
  }));
}
export function createVehicle(assets) {
  const group=new THREE.Group(), sls=new THREE.Group(), transit=createTransitHardware(), orion=createOrion();
  const lander=createMarsLander(), aeroshell=createMarsHeatShield(), backshell=createMarsBackshell();
  group.add(sls,transit.group,lander);aeroshell.position.y=1.6;lander.add(aeroshell,backshell);
  const white=material(0xdedfd7,.55,.25), parts={};
  const split=assets.models.sls?splitSLS(assets.models.sls):{};
  // The same Orion mesh and ESM wings fly on SLS and dock to the MTV.
  if(split.orion){split.orion.geometry.dispose();split.orion.material.dispose();delete split.orion;}
  for(const [id,pivot] of Object.entries(PARTS)) {
    const part=new THREE.Group();part.position.fromArray(pivot);parts[id]=part;sls.add(part);
    if(id==='orion'){part.add(orion.group);continue;}
    if(id==='core'){
      if(split.core){split.core.geometry.dispose();split.core.material.dispose();}
      const orange=material(0xbc6d32,.78,.12);
      const trim=material(0xdedfd7,.6,.2);
      cylinder(part,4.2,4.2,57,orange,[0,0,0]);
      cylinder(part,4.2,4.2,4.5,trim,[0,-30.75,0]);
      // Continuous interstage reaches the upper stage and separates with the core.
      cylinder(part,2.6,4.2,4.6,trim,[0,30.8,0]);
      cylinder(part,2.6,2.6,3.8,trim,[0,34.5,0]);
      for(const y of [-27.9,0,27.9]){
        cylinder(part,4.23,4.23,.12,orange,[0,y,0]);
      }
      continue;
    }
    if(id==='icps'){
      if(split.icps){split.icps.geometry.dispose();split.icps.material.dispose();}
      cylinder(part,2.6,2.6,8.8,white,[0,1,0]);
      cylinder(part,2.27,2.6,2.4,white,[0,6.6,0]);
      cylinder(part,2.6,1.0,1.4,white,[0,-4.1,0]);
      const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.55,1.15,2.1,32,1,true),material(0x28333c,.55,.65));
      nozzle.material.side=THREE.DoubleSide;
      nozzle.position.y=-5.85;
      part.add(nozzle);
      continue;
    }
    if(id==='las'){
      // Continuous launch fairing and escape tower seated over Orion.
      if(split.las){split.las.geometry.dispose();split.las.material.dispose();}
      const profile=[[2.62,-7.85],[2.62,-7.6],[2.38,-7.1],[1.24,-4.9],[.64,-4.35],[.43,-3.95],[.43,2.9],[.35,3.32],[.18,3.78],[0,4]];
      const tower=new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),48),white);
      tower.castShadow=true;
      part.add(tower);
      continue;
    }
    if(split[id]) {
      const lod=new THREE.LOD();lod.autoUpdate=false;lod.addLevel(split[id],0);
      const height=id.startsWith('srb')?54:id==='core'?66:id==='icps'?14:id==='orion'?8:8;
      const proxy=new THREE.Mesh(new THREE.CylinderGeometry(id==='las'?.2:id.startsWith('srb')?1.8:3.9,id.startsWith('srb')?1.8:4.2,height,12),id==='core'?material(0xb8703c):white);
      lod.addLevel(proxy,2500);part.add(lod);
    } else cylinder(part,id.startsWith('srb')?1.8:4,id.startsWith('srb')?1.8:4,id.startsWith('srb')?54:id==='core'?66:10,id==='core'?material(0xb8703c):white,[0,0,0]);
  }
  // Lettering is original typography, without NASA insignia.
  if(typeof document!=='undefined'){
  const lettering=canvasTexture(256,1024,c=>{c.fillStyle='#e9e7db';c.fillRect(0,0,256,1024);c.fillStyle='#172432';c.font='bold 110px sans-serif';for(const [i,s]of [...'USA'].entries())c.fillText(s,85,300+i*150);c.fillStyle='#aa4b3f';c.fillRect(80,80,100,52);});
  for(const x of [-6.4,6.4]) {const decal=new THREE.Mesh(new THREE.PlaneGeometry(1.5,6),new THREE.MeshStandardMaterial({map:lettering,roughness:.75,side:THREE.DoubleSide}));decal.position.set(x,37,1.82);parts[x<0?'srbLeft':'srbRight'].add(decal);decal.position.sub(new THREE.Vector3(...PARTS[x<0?'srbLeft':'srbRight']));}
  }
  const gear=lander.getObjectByName('landing-gear'),ladder=lander.getObjectByName('crew-ladder');
  const legAxes=Array.from({length:4},(_,i)=>{const a=i*Math.PI/2+Math.PI/4;return new THREE.Vector3(-Math.sin(a),0,Math.cos(a));});
  const orbitOffset=new THREE.Vector3();
  // Entry-cover separation is shown, not cut: the heat shield drops away below and the backshell is
  // pulled up/aft and tumbles, revealing the lander that was inside (real-time ~3 s, render only).
  const covers=[{obj:aeroshell,key:'heatShield',dir:new THREE.Vector3(.15,-1,0),accel:7,spin:1.1},
    {obj:backshell,key:'backshell',dir:new THREE.Vector3(-.35,1,.12).normalize(),accel:9,spin:-1.6}]
    .map(c=>({...c,home:c.obj.position.clone(),was:true,start:null}));
  const now=()=>(typeof performance!=='undefined'?performance.now():Date.now())/1000;
  function animateCovers(config){
    const t=now();
    for(const c of covers){
      const on=Boolean(config[c.key]);
      // The world scene reparents the covers to the simulated jettison trace; that trace owns them then.
      if(c.obj.parent!==lander){c.was=on;continue;}
      if(on){c.start=null;c.obj.visible=true;c.obj.position.copy(c.home);c.obj.rotation.set(0,0,0);}
      else{
        if(c.was&&c.start===null)c.start=t;
        const e=c.start===null?Infinity:t-c.start;
        c.obj.visible=e<3.2;
        if(c.obj.visible){c.obj.position.copy(c.home).addScaledVector(c.dir,.5*c.accel*e*e+1.2*e);c.obj.rotation.set(c.spin*e*.6,0,c.spin*e);}
      }
      c.was=on;
    }
  }
  return { group, parts, sls, capsule:orion.group, orion:orion.group, transit:transit.group, lander, aeroshell, backshell,
    update(state,onboard=false,camera) {
      const config=vehicleConfiguration(state),angle=state.attitude+state.theta;
      const launch=config.launch;
      const parent=launch?parts.orion:transit.group;
      if(orion.group.parent!==parent)parent.add(orion.group);
      // GAME ASSUMPTION: nose-first approach to the upper docking collar. This
      // twelve-second relative animation never changes the mission trajectory.
      orion.group.position.set(0,launch?0:17.1+(1-config.docking)*18,0);
      orion.group.rotation.z=launch?0:Math.PI;
      orion.wings.forEach(wing=>{wing.visible=!launch;wing.rotation.z=(1-config.arrays)*Math.PI/2;});
      transit.arrays.forEach((wing,i)=>{wing.rotation.z=(i===0?1:-1)*(1-config.arrays)*Math.PI/2;});
      animateCovers(config);
      gear.visible=config.lander;ladder.visible=config.ladder;
      gear.children.forEach((leg,i)=>leg.quaternion.setFromAxisAngle(legAxes[i],-2.25*(1-config.legs)));
      sls.visible=launch&&!onboard;lander.visible=config.lander&&!onboard;
      orbitOffset.fromArray(transitOrbitOffset(state));
      transit.group.position.copy(orbitOffset);
      // The retained MTV follows its circular orbit; once kilometres away it
      // is culled from the local view, rather than being drawn beside the lander.
      transit.group.visible=config.transit&&!onboard&&orbitOffset.length()<4000;
      sls.rotation.z=angle;transit.group.rotation.z=angle;
      lander.rotation.z=config.docked?angle:state.phase==='EDL'||state.phase==='DEORBIT'
        ?(state.engineFiring?state.thrustAngle??0:Math.atan2(Math.sqrt(Math.max(0,state.surfaceVelocity**2-state.verticalSpeed**2)),-state.verticalSpeed)):0;
      const heat=Math.min(1,(state.heatFlux??0)/60000);
      aeroshell.traverse(m=>{if(m.isMesh){m.material.emissive.setRGB(heat*.9,heat*.085,heat*.005);}});
      for(const id of ['srbLeft','srbRight'])parts[id].visible=state.stages.find(s=>s.id==='srb').attached;
      parts.core.visible=state.stages.find(s=>s.id==='core').attached;parts.las.visible=state.lasAttached;
      parts.icps.visible=state.stages.find(s=>s.id==='icps').attached;
      // Keep the retained upper stack near the floating origin after the lower stack separates.
      sls.position.set(0,0,0).applyAxisAngle(new THREE.Vector3(0,0,1),sls.rotation.z);
      if(camera)sls.traverse(m=>{if(m.isLOD){const distance=camera.position.length()*Math.tan(camera.fov*Math.PI/360)/Math.tan(Math.PI/8);m.levels[0].object.visible=distance<2500;m.levels[1].object.visible=distance>=2500;}});
    },
    makeDebris(id) {const source=parts[id];const clone=source.clone(true);clone.traverse(m=>{if(m.isMesh){m.geometry=m.geometry.clone();m.material=m.material.clone();}});clone.position.set(0,0,0);clone.visible=true;return clone;}
  };
}
