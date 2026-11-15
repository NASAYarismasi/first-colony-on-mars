/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
import * as THREE from 'three';
import { makeKit } from './equipment-kit.mjs';
// Liter ≈ kg water. Extraction/energy rates are explicit preliminary engineering assumptions.
export {WATER_DEFAULTS, createWaterState, stepWater} from '../../sim/ihanLifeSupportModels.js';
export function createWaterSystem(scene,{x=0,z=0,heightAt=()=>0}={}){
 const group=new THREE.Group();group.position.set(x,heightAt(x,z),z);group.name='WaterSystem';scene.add(group);const k=makeKit(group);k.skid(10,5);
 // Drilling mast: braced rails, carriage, helical auger and recovery shroud.
 for(const x of [-4.2,-2.4])k.box(.16,4.9,.18,x,2.95,-.8,'steel');
 for(let i=0;i<5;i++){k.box(1.9,.10,.18,-3.3,.65+i*1.08,-.8,'steel');const bar=k.box(2.05,.065,.085,-3.3,1.15+i*1.02,-.76,'dark');bar.rotation.z=i%2?.48:-.48;}
 k.box(2.1,.3,.65,-3.3,5.35,-.8,'orange');k.box(.65,.62,.6,-3.3,4.6,-.8,'dark');k.box(.95,.5,.85,-3.3,.70,-.8,'dark');
 const drill=new THREE.Group();drill.position.set(-3.3,0,-.8);group.add(drill);k.cylinder(.085,3.9,0,2.55,0,'steel',drill);
 const helix=[];for(let i=0;i<=360;i++){const a=i/360*Math.PI*2*11;helix.push([Math.cos(a)*.20,.65+i/360*3.7,Math.sin(a)*.20]);}k.pipe(helix,.028,'steel',drill);k.cylinder(.32,.20,-3.3,.42,-.8,'orange');
 k.pipe([[-3.3,4.65,-1.1],[-3.3,4.8,-1.5],[-2.2,4.8,-1.5],[-2.2,.75,-1.5],[-.7,.75,-1.37]],.065,'black');
 // Insulated thermal extractor with flange, service hatch and condenser.
 k.box(2.1,2.25,2.0,-.65,1.55,-.35,'foil',group,.13);k.panel(1.9,1.8,-.65,1.55,.69);k.label('ICE / THERMAL CORE',1.55,.2,-.65,2.15,.73);
 const hatch=k.cylinder(.51,.08,-.65,1.35,.76,'steel');hatch.rotation.x=Math.PI/2;k.valve(-.65,1.35,.84);for(let a=0;a<8;a++){const t=a/8*Math.PI*2;k.bolt(-.65+Math.cos(t)*.43,1.35+Math.sin(t)*.43,.82);}
 for(let i=0;i<3;i++){k.cylinder(.13,1.55,1.05+i*.33,1.55,-.8,'steel');k.ring(.15,.025,1.05+i*.33,.88,-.8,'orange');k.ring(.15,.025,1.05+i*.33,2.2,-.8,'orange');}
 k.pipe([[-.5,2.7,-.35],[-.5,3,-.35],[1.4,3,-.35],[1.4,2.32,-.8]],.06,'steel');
 k.box(1.15,1.5,1.2,1.25,1.2,1,'white',group,.09);k.panel(.95,1.18,1.25,1.2,1.63);k.label('H2O / PURIFY',.82,.18,1.25,1.53,1.67);k.gauge(1.05,1.14,1.7);k.valve(1.52,1.1,1.7);
 for(const z of [-1.3,1.25]){k.tank(3.25,z,.61,2.35,'foil');k.pipe([[2.15,.98,z],[2.64,.98,z]],.055,'blue');k.flange(2.64,.98,z,'x');k.flange(2.25,.98,z,'x');k.box(.18,1.6,.08,3.25,1.65,z+.64,'dark');k.box(.06,1.25,.09,3.25,1.65,z+.69,'blue');}
 k.flange(1.25,.98,1.64);k.pipe([[1.25,.98,1.64],[1.25,.98,2.15],[2.15,.98,2.15]],.055,'blue');k.pipe([[2.15,.98,2.15],[2.15,.98,-1.3]],.055,'blue');k.pipe([[3.25,.52,-1.92],[3.25,.52,-2.2],[.65,.52,-2.2],[.65,.52,.12],[.9,.8,.37]],.045,'black');k.flange(3.25,.52,-1.92);k.flange(.9,.8,.37);k.flange(-.7,.75,-1.37);k.flange(-.5,2.7,-.35,'y');k.flange(1.4,2.32,-.8,'y');
 k.box(.4,.35,.5,-4.3,.55,1.9,'dark');k.box(.4,.35,.5,1.2,.55,2.2,'dark');k.pipe([[-4.3,.4,1.9],[-2,.4,1.9],[-2,.4,2.2],[1.2,.4,2.2]],.04,'black');
 let active=false;
 return{group,update(state){active=Boolean(state.extractor)},frame(time,dt){if(active)drill.rotation.y+=dt*.65},dispose:k.dispose};
}
