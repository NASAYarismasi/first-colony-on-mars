import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, box, cylinder, beam, noiseTexture, seeded } from './primitives.js';

/** Approximate LC-39B architecture in metres; all layout/detail choices are GAME ASSUMPTION. */
export function createLaunchSite() {
  const group = new THREE.Group();
  const steel = material(0x7e8b90, .45, .65), dark = material(0x222c30), concrete = material(0x77786f), rail = material(0xb3b5ac);
  concrete.map = noiseTexture('#8f9188');
  const groundMat = material(0x64705b, .98, 0); groundMat.map = noiseTexture('#777965');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(52000,52000), groundMat); ground.rotation.x = -Math.PI/2; ground.position.y = -14.2; ground.receiveShadow = true; group.add(ground);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(30000,70000), material(0x246b96,.32,.12)); ocean.rotation.x=-Math.PI/2; ocean.position.set(16000,-14,0); group.add(ocean);
  box(group,[340,1,260],concrete,[0,-13.5,0]);
  box(group,[45,7,180],dark,[0,-10,-36]); box(group,[14,.3,180],material(0x171b1c),[0,-6.3,-36]);
  for (const x of [-30,30]) box(group,[35,7,85],concrete,[x,-10,0]);
  box(group,[57,8,46],steel,[0,-6,0]);
  box(group,[17,8.3,15],dark,[0,-5.9,0]);
  for (const x of [-8,8]) for (const z of [-7,7]) cylinder(group,.6,.9,5,steel,[x,-.7,z],12);
  const tower = new THREE.Group(); tower.position.set(-23,-10,-18); group.add(tower);
  for (const x of [-6,6]) for (const z of [-6,6]) box(tower,[1.1,112,1.1],steel,[x,56,z]);
  for (let y = 5; y <= 110; y += 7) {
    box(tower,[14,.65,14],steel,[0,y,0]);
    for (const z of [-6,6]) { beam(tower,[-6,y,z],[6,y+7,z],.19,rail); beam(tower,[6,y,z],[-6,y+7,z],.19,rail); }
    for (const x of [-6,6]) beam(tower,[x,y,-6],[x,y+7,6],.19,rail);
    for (const z of [-6.8,6.8]) { beam(tower,[-7,y+1.5,z],[7,y+1.5,z],.07,rail); }
  }
  box(tower,[24,3.4,4],rail,[12,87,2]);
  for (let y = 20; y < 77; y += 14) box(tower,[18,1.3,3.3],steel,[12,y,1]);
  for (let y=12;y<104;y+=3) box(tower,[2.5,.2,1.4],dark,[-7.4,y,2]);
  for(const [x,z] of [[-145,100],[145,100],[0,-180]]) {
    const mast = new THREE.Group(); mast.position.set(x,-14,z); group.add(mast);
    for(const [a,b] of [[-3,-3],[3,-3],[0,3]]) beam(mast,[a,0,b],[a*.2,130,b*.2],.4,rail);
    for(let y=0;y<127;y+=8) { beam(mast,[-3*(1-y/160),y,-3],[3*(1-(y+8)/160),y+8,-3],.12,steel); }
    cylinder(mast,.15,.2,20,rail,[0,140,0],8);
  }
  // Omit subpixel overhead wires: their thin triangles alias into dashed rows
  // in the long-lens ground camera. Lightning protection masts remain visible.
  // Cable ducts, tanks, service buildings and crawlerway add scale without expensive assets.
  box(group,[42,.12,1900],material(0x898c82),[-120,-13,930]);
  for(let i=0;i<8;i++) {
    cylinder(group,5,5,14,rail,[-80-i*13,-6,-74],20);
    box(group,[27,8,16],material(0xa1a69e),[-100-i*36,-10,120]);
  }
  const rand=seeded(44), bushGeo=new THREE.IcosahedronGeometry(1,0), bushMat=material(0x475d40,1,0);
  const scrub=new THREE.InstancedMesh(bushGeo,bushMat,1100), dummy=new THREE.Object3D();
  for(let i=0;i<1100;i++) { const a=rand()*Math.PI*2,r=220+rand()*6500;dummy.position.set(Math.cos(a)*r,-13.5,Math.sin(a)*r);dummy.scale.set(2+rand()*4,.5+rand(),2+rand()*4);dummy.updateMatrix();scrub.setMatrixAt(i,dummy.matrix); }group.add(scrub);
  // Static launch hardware is batched by material, keeping hundreds of trusses to a handful of draws.
  group.updateMatrixWorld(true);const batches=new Map(),originals=[];
  group.traverse(m=>{if(!m.isMesh||m.isInstancedMesh)return;if(!batches.has(m.material))batches.set(m.material,[]);const g=m.geometry.clone().applyMatrix4(m.matrixWorld);batches.get(m.material).push(g);originals.push(m);});
  for(const m of originals){m.removeFromParent();m.geometry.dispose();}
  for(const [mat,geometries] of batches){const g=mergeGeometries(geometries,false);for(const original of geometries)original.dispose();const batch=new THREE.Mesh(g,mat);batch.castShadow=true;batch.receiveShadow=true;group.add(batch);}
  return { group, update(state) {
    // Transform pad-fixed coordinates into the vehicle-centred radial basis.
    const r=state.radius+(state.altitude??0);group.position.set(-state.radius*Math.sin(state.theta),state.radius*Math.cos(state.theta)-r,0); group.rotation.z=state.theta;
    group.visible=['PRELAUNCH','ASCENT'].includes(state.phase) && (state.altitude??0)<4000;
    groundMat.transparent=true;groundMat.opacity=Math.max(0,1-Math.max(0,(state.altitude??0)-500)/3500);
  } };
}
