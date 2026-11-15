/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
import * as THREE from 'three';
import { makeKit } from './equipment-kit.mjs';
// kg, kW, hours. Reference-scale values are hypotheses, not qualified life-support hardware.
export {AIR_DEFAULTS, createAirState, stepAir} from '../../sim/ihanLifeSupportModels.js';
export function createAirSystem(scene,{x=0,z=0,heightAt=()=>0}={}){
 const group=new THREE.Group();group.position.set(x,heightAt(x,z),z);group.name='AirSystem';scene.add(group);const k=makeKit(group);k.skid(8,4.5);
 const fans=[];
 // Three serviceable processing cassettes on a shared thermal skid.
 for(let i=0;i<3;i++){
  const xx=-2.55+i*2.55;k.box(2.12,2.35,1.75,xx,1.58,.28,'white',group,.12);k.panel(1.92,1.97,xx,1.6,1.18);k.box(1.65,.09,.07,xx,2.35,1.23,'orange');
  const screen=k.label('9× MOXIE',1.55,.34,xx,2.07,1.24,group,'#abf4dc');screen.name='MOXIE bank '+(i+1)+' display';screen.castShadow=false;k.vents(xx,1.18,1.23,1.46,9);
  for(const dx of [-.68,.68]){k.box(.055,.35,.055,xx+dx,1.72,1.28,'steel');k.box(.16,.03,.06,xx+dx,1.88,1.28,'steel');}
  k.box(.58,.24,.04,xx,.86,1.24,'glass');for(let j=0;j<3;j++)k.cylinder(.025,.05,xx-.18+j*.18,.91,1.28,'lamp').rotation.x=Math.PI/2;

  const rotor=new THREE.Group();rotor.position.set(xx,2.77,.26);group.add(rotor);k.ring(.37,.04,xx,2.77,.26,'dark');for(let b=0;b<7;b++){const blade=k.box(.11,.035,.32,0,0,0,'dark',rotor,.015);blade.position.set(Math.sin(b/7*Math.PI*2)*.19,0,Math.cos(b/7*Math.PI*2)*.19);blade.rotation.y=b/7*Math.PI*2+.3}fans.push(rotor);
  for(const dx of [-.19,0,.19])k.box(.015,.035,.72,xx+dx,2.81,.26,'steel');
 }
 // Separate circuits: short cassette couplings, upper product header and lower return.
 // No duplicate routes through the same coordinates; each branch ends at a flange.
 for(const left of [-2.55,0]){
  const a=left+1.085,b=left+2.55-1.085;
  k.flange(a,1.4,.28,'x');k.flange(b,1.4,.28,'x');
  k.pipe([[a,1.4,.28],[b,1.4,.28]],.06,'steel');
 }
 for(const xx of [-1.55,1.55]){
  k.tank(xx,-1.9,.44,2.7,'blue');
  k.flange(xx,3.64,-1.9,'y');
  k.pipe([[xx,3.64,-1.9],[xx,3.95,-1.9]],.055,'steel');
  k.flange(xx,.85,-1.44);
  k.pipe([[xx,.85,-1.44],[xx,.85,-1.1]],.055,'blue');
 }
 k.pipe([[-1.55,3.95,-1.9],[1.55,3.95,-1.9]],.055,'steel');
 k.flange(0,2.77,-.35,'y');
 k.pipe([[0,2.77,-.35],[0,3.25,-.35],[0,3.25,-1.9],[0,3.95,-1.9]],.055,'steel');
 k.pipe([[-1.55,.85,-1.1],[1.55,.85,-1.1]],.055,'blue');
 k.pipe([[0,.85,-1.1],[0,.85,-.62]],.055,'blue');k.flange(0,.85,-.62);
 k.pipe([[.5,3.95,-1.9],[.5,3.95,-1.65]],.035,'steel');k.gauge(.5,3.95,-1.62);
 const lamp=k.mesh(new THREE.SphereGeometry(.07,16,10),'lamp',0,2.39,1.29);
 let active=false;
 return{group,update(state){active=Boolean(state.producer);lamp.material.emissive.set(active?0x4ab99a:0xc66c2a)},frame(time,dt){if(active)fans.forEach(f=>f.rotation.y+=dt*4)},dispose:k.dispose};
}
