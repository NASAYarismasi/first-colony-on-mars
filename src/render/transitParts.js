import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cylinder, beam, material, canvasTexture } from './primitives.js';

// GAME ASSUMPTION: detailed dimensions, panel counts and markings are original
// concept artwork. Artemis white, insulation tan and graphite are shared by
// Orion, the MTV and the surface vehicle; no new external image assets.
const palette = () => ({white:material(0xdedfd7,.64,.25),foil:material(0xb99752,.55,.55),
  dark:material(0x29383e,.65,.45),blue:material(0x183951,.4,.5),red:material(0xa74c36,.7,.15)});

/** Batch only a static subtree. Articulation pivots and named parts stay outside. */
function mergeStatic(group) {
  group.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets=new Map();
  group.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    if(!buckets.has(object.material))buckets.set(object.material,[]);
    buckets.get(object.material).push(geometry);
    object.geometry.dispose();
  });
  group.clear();
  for(const [mat,geometries] of buckets){
    const geometry=mergeGeometries(geometries,false);
    geometries.forEach(part=>part.dispose());
    const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
}

function marking(parent,text,y,radius,width=4) {
  // Canvas is optional for geometry/unit tests; browsers get original typography.
  if(typeof document==='undefined')return;
  const texture=canvasTexture(512,128,ctx=>{
    ctx.fillStyle='#dedfd7';ctx.fillRect(0,0,512,128);
    ctx.fillStyle='#a74c36';ctx.fillRect(18,22,70,12);
    ctx.fillStyle='#263841';ctx.font='bold 42px sans-serif';ctx.fillText(text,108,83);
  });
  const decal=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:texture,roughness:.8}));
  decal.position.set(0,y,radius);parent.add(decal);
}

/** A single Orion is reparented from SLS to the MTV docking port.
 * Approximate 5 m capsule, 4 m ESM, four 7 m wings / 19 m deployed span:
 * https://www.nasa.gov/wp-content/uploads/2023/02/orion-reference-guide-111022.pdf
 * https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Orion/European_Service_Module_Power
 * All other exterior detail dimensions are GAME ASSUMPTION.
 */
export function createOrion() {
  const group=new THREE.Group();group.name='orion';
  const body=new THREE.Group(),p=palette();group.add(body);
  cylinder(body,2.25,2.25,4,p.white,[0,-.5,0]);
  cylinder(body,2.5,2.25,.7,p.foil,[0,1.85,0]);
  cylinder(body,1.05,2.5,2.65,p.white,[0,3.525,0]);
  cylinder(body,1.02,1.02,.32,p.dark,[0,5.01,0]);
  cylinder(body,.65,.65,.22,p.foil,[0,5.28,0]);
  cylinder(body,.45,.85,1.15,p.dark,[0,-2.9,0]);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    const panel=box(body,[1.15,2.8,.08],i%2?p.foil:p.white,[Math.sin(a)*2.25,-.5,Math.cos(a)*2.25]);panel.rotation.y=a;
  }
  for(const x of [-.8,.8]){const window=box(body,[.55,.55,.12],p.blue,[x,3.8,1.75]);window.rotation.x=.5;}
  mergeStatic(body);marking(body,'ORION',1.95,2.54,2.8);
  const wings=[];
  for(let i=0;i<4;i++){
    const azimuth=new THREE.Group();azimuth.rotation.y=Math.PI/4+i*Math.PI/2;group.add(azimuth);
    const hinge=new THREE.Group();hinge.position.set(2.5,-.5,0);azimuth.add(hinge);wings.push(hinge);
    const panels=new THREE.Group();hinge.add(panels);
    beam(panels,[0,0,0],[7,0,0],.045,p.foil);
    for(let j=0;j<3;j++){
      box(panels,[2.24,.055,1.8],p.blue,[1.17+j*2.28,0,0]);
      for(let cell=0;cell<7;cell++)box(panels,[.012,.008,1.8],p.foil,[.18+j*2.28+cell*.31,.033,0]);
    }
    mergeStatic(panels);
  }
  return {group,wings};
}

// GAME ASSUMPTION: exterior layout in metres, sized for the existing 120 t LH2
// inventory with large insulated tanks; not a flight-qualified pressure vessel.
export const NTR_NOZZLES=Object.freeze(Array.from({length:3},(_,i)=>{
  const a=i*Math.PI*2/3;return Object.freeze([Math.cos(a)*2.2,-45,Math.sin(a)*2.2]);
}));

/** NTR engines, shadow shielding, LH2 tanks, habitat and radiator concept.
 * NASA DRA common propulsion stage / orbital assembly / photovoltaic arrays:
 * https://ntrs.nasa.gov/citations/20120012928
 * Reactor heats hydrogen without combustion:
 * https://www.nasa.gov/space-technology-mission-directorate/tdm/space-nuclear-propulsion/
 * All depicted geometry, radiator arrangement and dimensions: GAME ASSUMPTION.
 */
export function createTransitHardware() {
  const group=new THREE.Group();group.name='mars-transit-vehicle';
  const hull=new THREE.Group(),p=palette();group.add(hull);
  cylinder(hull,3.8,3.8,7,p.white,[0,-4,0]);
  cylinder(hull,2.6,3.8,1.4,p.foil,[0,.2,0]);
  cylinder(hull,1.4,1.4,2,p.dark,[0,1,0]);
  // Two cryogenic tank barrels, with domed end caps (about 1700 m³ total).
  for(const y of [-16,-30]){
    cylinder(hull,4.65,4.65,10,p.white,[0,y,0]);
    for(const end of [-1,1]){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(4.65,32,16),p.foil);
      dome.scale.y=.48;dome.position.y=y+end*5;dome.castShadow=true;hull.add(dome);
    }
    for(const end of [-1,1])cylinder(hull,4.69,4.69,.18,p.dark,[0,y+end*4.7,0]);
  }
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2+Math.PI/4,x=Math.cos(a)*3.4,z=Math.sin(a)*3.4;
    beam(hull,[x,-7.5,z],[x,-38,z],.11,p.dark);
  }
  cylinder(hull,4.7,3,.9,p.foil,[0,-38.3,0]); // shadow shield, crew forward of reactors
  for(const [x,y,z] of NTR_NOZZLES){
    cylinder(hull,.9,.9,2.7,p.dark,[x,-40.5,z]);
    cylinder(hull,1.1,.55,.8,p.foil,[x,-38.9,z]);
    const nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.4,1.25,3.2,24,1,true),p.dark);
    nozzle.material.side=THREE.DoubleSide;nozzle.position.set(x,y+1.6,z);nozzle.castShadow=true;hull.add(nozzle);
  }
  // Dark radiator fins are deliberately distinct from blue photovoltaic wings.
  for(const sign of [-1,1]){
    box(hull,[7.5,7,.09],p.dark,[sign*8.25,-35,0]);
    for(let j=0;j<6;j++)box(hull,[.04,7,.04],p.foil,[sign*(4.7+j*1.3),-35,.07]);
  }
  for(const y of [-7.5,-.7])cylinder(hull,3.85,3.85,.2,p.foil,[0,y,0]);
  mergeStatic(hull);marking(hull,'MTV · 01',-3,3.85,4.4);
  const arrays=[];
  for(const sign of [-1,1]){
    const hinge=new THREE.Group();hinge.position.set(sign*3.8,-5,0);group.add(hinge);arrays.push(hinge);
    const wing=new THREE.Group();hinge.add(wing);
    beam(wing,[0,0,0],[sign*15,0,0],.09,p.foil);
    for(let j=0;j<4;j++)box(wing,[3.4,.09,7],p.blue,[sign*(2+j*3.7),0,0]);
    for(let j=0;j<20;j++)box(wing,[.025,.012,7],p.foil,[sign*(.4+j*.71),.055,0]);
    mergeStatic(wing);
  }
  return {group,arrays};
}
