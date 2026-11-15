import * as THREE from 'three';
import { box, cylinder, beam, material, canvasTexture } from './primitives.js';
import { vehicleConfiguration } from './vehiclePhases.js';

export function createCabin(assets) {
  const group=new THREE.Group(), shell=material(0x626b71,.7,.3), trim=material(0x18242c,.45,.6), suit=material(0xe4e4d9,.75,0);
  // Open front and side apertures show the same planet/lighting as the external camera.
  box(group,[8,.25,11],shell,[0,0,1]);box(group,[8,.35,11],shell,[0,6.3,1]);
  for(const x of [-4,4]) {box(group,[.3,6.2,11],shell,[x,3.1,1]);box(group,[.2,1.7,9],trim,[x*.93,1,0]);}
  box(group,[8,1.4,.4],shell,[0,5.6,-4.2]);box(group,[8,.8,.4],shell,[0,.1,-4.2]);
  for(const x of [-3.8,-1.4,1.4,3.8]) {const pillar=box(group,[.28,4,.5],trim,[x,3.5,-4.2]);pillar.rotation.z=x*.04;}
  // Window bevels, handholds and ceiling conduits.
  for(const x of [-2.7,0,2.7]) {box(group,[2.35,.12,.6],material(0xa0a9ab),[x,4.96,-4]);box(group,[2.35,.12,.6],trim,[x,.56,-4]);}
  for(const x of [-3,3])cylinder(group,.07,.07,7,trim,[x,5.8,0]).rotation.x=Math.PI/2;
  const screenTexture=canvasTexture(1536,512,()=>{}),screenMat=new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false});
  const screens=[];
  for(const x of [-2.6,0,2.6]) {const panel=box(group,[2.35,1.22,.25],trim,[x,1.7,-2.6]);panel.rotation.x=-.25;const screen=new THREE.Mesh(new THREE.PlaneGeometry(2.12,1),screenMat);screen.position.set(0,0,.14);panel.add(screen);screens.push(screen);}
  for(let i=0;i<3;i++) {
    const x=(i-1)*2.2, chair=new THREE.Group();chair.position.set(x,1.3,.7);group.add(chair);
    const back=box(chair,[1.12,.91,.19],trim,[0,.36,.30]);back.rotation.x=.42;
    const cushion=material(0x34464d,.92,0);
    const pad=box(chair,[1.02,.81,.13],cushion,[0,.36,.18]);pad.rotation.x=.42;
    box(chair,[1.24,.2,.9],cushion,[0,-.03,-.23]);box(chair,[.48,.27,.19],trim,[0,.87,.55]);
    for(const side of [-1,1]){
      beam(chair,[side*.48,-.15,.2],[side*.56,-1.05,.55],.045,shell);
      box(chair,[.14,.13,.8],trim,[side*.66,.19,-.16]);
      beam(chair,[side*.4,-.1,-.5],[side*.4,-.32,-.95],.035,shell);
    }
    box(chair,[.85,.06,.35],trim,[0,-.32,-.95]);
    const astronaut=new THREE.Group();astronaut.position.set(x,.39,.7);group.add(astronaut);
    if(assets.models['astronaut-seated']){
      const model=assets.models['astronaut-seated'].clone(true);model.rotation.y=Math.PI;
      model.traverse(m=>{if(m.isMesh){m.material=Array.isArray(m.material)?m.material.map(mat=>mat.clone()):m.material.clone();m.castShadow=true;}});
      astronaut.add(model);
    } else {
      // A seated suited figure remains available if the NASA derivative fails to load.
      beam(astronaut,[0,.91,0],[0,1.48,.25],.26,suit);
      const helmet=new THREE.Mesh(new THREE.SphereGeometry(.25,24,16),suit);helmet.position.set(0,1.72,.36);astronaut.add(helmet);
      for(const side of [-1,1]){
        beam(astronaut,[side*.18,.91,0],[side*.2,.72,-.48],.14,suit);
        beam(astronaut,[side*.2,.72,-.48],[side*.2,.22,-.58],.12,suit);
        beam(astronaut,[side*.3,1.42,.2],[side*.35,1.02,.08],.1,suit);
        beam(astronaut,[side*.35,1.02,.08],[side*.24,.92,-.32],.09,suit);
      }
    }
    // Seat restraints follow the reclined torso and remain visible from camera 2.
    for(const side of [-1,1])beam(chair,[side*.24,1.05,.32],[side*.19,.09,-.26],.025,material(0x9eaa9b,.9,0));
    box(chair,[.24,.12,.08],material(0x8c9696),[0,.09,-.28]);
  }
  const light=new THREE.PointLight(0x8dd5ee,35,12,2);light.position.set(0,4,3);group.add(light);
  const panelLight=new THREE.PointLight(0xc4dceb,45,14,2);panelLight.position.set(0,3,-2);group.add(panelLight);
  const strip=new THREE.Mesh(new THREE.BoxGeometry(5,.03,.07),new THREE.MeshBasicMaterial({color:0xa4d7ff}));strip.position.set(0,5.9,-2);group.add(strip);
  // GAME ASSUMPTION: compact forward/downward lander observation station.
  // Its aperture faces +Z, matching createMarsLander's crew-facing windows.
  const landingCabin=new THREE.Group(),interior=new THREE.Group();interior.add(group,landingCabin);
  box(landingCabin,[5,.25,4.6],shell,[0,6.65,2.5]);
  box(landingCabin,[5,.2,3.6],shell,[0,9.8,2.7]);
  for(const x of [-2.4,2.4]){box(landingCabin,[.2,3.1,3.6],shell,[x,8.2,2.7]);beam(landingCabin,[x*.9,7.1,4.2],[x*.9,9.6,4.2],.1,trim);}
  for(const y of [7.15,9.5])beam(landingCabin,[-2.25,y,4.2],[2.25,y,4.2],.13,trim);
  const landerPanel=box(landingCabin,[4.4,.65,.45],trim,[0,7,3.65]);landerPanel.rotation.x=.18;
  const landerScreen=new THREE.Mesh(new THREE.PlaneGeometry(3.8,.48),screenMat);landerScreen.position.set(0,0,.24);landerPanel.add(landerScreen);
  const landerLight=new THREE.PointLight(0x8dd5ee,12,6,2);landerLight.position.set(0,8,2);landingCabin.add(landerLight);
  let last=-1;
  return {group:interior,update(state,visible){const inLander=vehicleConfiguration(state).cabin==='lander';interior.visible=visible;group.visible=!inLander;landingCabin.visible=inLander;if(!visible||Math.abs(state.missionTime-last)<.1)return;last=state.missionTime;const c=screenTexture.image.getContext('2d');c.fillStyle='#04121b';c.fillRect(0,0,1536,512);c.fillStyle='#73b8c9';c.font='25px monospace';c.fillText((inLander?"PIONEER /":'ORION /')+" FLIGHT COMPUTER                       GNC  ● NOMINAL",36,54);c.strokeStyle='#24404d';for(let y=85;y<512;y+=86){c.beginPath();c.moveTo(30,y);c.lineTo(1500,y);c.stroke();}c.fillStyle='#d1e8ed';c.font='52px monospace';c.fillText(`ALTITUDE  ${((state.altitude??0)/1000).toFixed(1)} km`,38,150);c.fillText(`SPEED     ${((state.velocity??0)/1000).toFixed(3)} km/s`,38,240);c.fillText(`VERTICAL   ${(state.verticalSpeed??0).toFixed(0)} m/s`,38,330);c.fillStyle='#5be6bc';c.font='28px monospace';c.fillText("AUTOPILOT / THREE CREW / LIFE SUPPORT ACTIVE",38,451);screenTexture.needsUpdate=true;}};
}
