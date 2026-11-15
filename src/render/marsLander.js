import * as THREE from 'three';
import { box, cylinder, beam, material } from './primitives.js';

/**
 * Original human-class Mars lander concept. All dimensions are GAME ASSUMPTION,
 * within the simulation's 15 m entry envelope; this is not flight hardware.
 * Human entry architecture context: NASA DRA 5.0
 * https://ntrs.nasa.gov/citations/20090012109
 * Large aeroshell + supersonic retropropulsion research:
 * https://ntrs.nasa.gov/citations/20200002811
 * The mission uses propulsive orbit capture, then atmospheric entry, not aerocapture.
 *
 * Surface/flight contract: metres, +Y up, footpad undersides at y=0,
 * hatch and ladder facing +Z. Returned configuration is landed, gear deployed.
 * No DOM, loaded assets, shared resources, or animation loop. The caller owns
 * and disposes geometries/materials. Named leg pivots allow flight articulation.
 * @returns {THREE.Group}
 */
export function createMarsLander() {
  const lander = new THREE.Group();
  lander.name = 'mars-lander';
  const white = material(0xdedfd7, .64, .25);
  const foil = material(0xb99752, .46, .7);
  const graphite = material(0x29383e, .7, .45);
  const thermal = material(0xc6cabe, .85, .15);
  const black = material(0x17252d, .5, .6);
  const windows = material(0x0a2534, .12, .65);
  windows.emissive.set(0x163a4a); windows.emissiveIntensity = .35;
  cylinder(lander, 4.5, 5.8, 4.3, graphite, [0, 5.65, 0], 16);
  // GAME ASSUMPTION: compact 9.94 m crewed lander, shared at 1:1 scale by flight and EVA.
  cylinder(lander, 3.05, 4.5, 1.2, thermal, [0, 8.4, 0], 16);
  cylinder(lander, 3.05, 3.05, .4, foil, [0, 9.2, 0]);
  cylinder(lander, 1.25, 1.25, .3, white, [0, 9.55, 0]);
  cylinder(lander, .85, 1.25, .24, black, [0, 9.82, 0]);
  cylinder(lander, 5.8, 5.8, .35, foil, [0, 3.65, 0], 48);
  cylinder(lander, 4.3, 4.8, 1.05, foil, [0, 2.95, 0]);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    beam(lander, [Math.cos(a)*5.82,3.7,Math.sin(a)*5.82], [Math.cos(a)*4.52,7.8,Math.sin(a)*4.52], .035, foil);
    if (i % 2 === 0) {
      const panel = box(lander, [1.25,1.5,.16], thermal, [Math.sin(a)*4.95,6.1,Math.cos(a)*4.95]);
      panel.rotation.set(.27,a,0);
    }
  }
  for (let i = -1; i <= 1; i++) {
    const frame = box(lander, [1.12,.88,.14], black, [i*1.25,8.65,4.12-Math.abs(i)*.16]);
    box(frame, [.94,.69,.05], windows, [0,0,.09]);
  }
  const hatch = box(lander, [1.35,1.9,.18], white, [0,5.6,5.73]); hatch.name = 'crew-hatch';
  box(hatch, [.7,.45,.04], windows, [0,.45,.12]);
  for (const x of [-.7,.7]) beam(lander, [x,4.5,5.9], [x,6.6,5.9], .045, foil);
  const ladder = new THREE.Group(); ladder.name = 'crew-ladder'; lander.add(ladder);
  for (let y = .5; y < 4.9; y += .38) beam(ladder, [-.55,y,6.15], [.55,y,6.15], .045, white);
  for (const x of [-.65,.65]) beam(ladder, [x,.16,6.15], [x,4.9,6.15], .05, foil);
  box(ladder, [1.6,.12,.8], graphite, [0,4.6,6.05]);
  const gear = new THREE.Group(); gear.name = 'landing-gear'; lander.add(gear);
  for (let i = 0; i < 4; i++) {
    const a = i*Math.PI/2+Math.PI/4, x = Math.cos(a), z = Math.sin(a);
    const leg = new THREE.Group(); leg.name = `landing-leg-${i}`;
    leg.position.set(x*4.8,5,z*4.8); gear.add(leg);
    const local = (radius,y) => [x*(radius-4.8),y-5,z*(radius-4.8)];
    beam(leg, [0,0,0], local(8.5,.35), .19, graphite);
    beam(leg, local(4.7,2.9), local(8.5,.35), .105, foil);
    beam(leg, local(6.4,3), local(8.5,.35), .085, white);
    const pad = cylinder(leg, 1,1.15,.22,graphite,local(8.5,.11),16); pad.name = `footpad-${i}`;
    const engineAngle = i*Math.PI/2, ex = Math.cos(engineAngle)*4.2, ez = Math.sin(engineAngle)*4.2;
    cylinder(lander,.35,.36,.65,foil,[ex,3.12,ez],24);
    const bellMat = black.clone(); bellMat.side = THREE.DoubleSide;
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(.34,.82,1.45,24,1,true),bellMat);
    bell.position.set(ex,2.225,ez); bell.castShadow = true; lander.add(bell);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.82,.045,8,24),foil);
    lip.rotation.x = Math.PI/2; lip.position.set(ex,1.5,ez); lander.add(lip);
  }
  return lander;
}

/** Separate disposable entry cover. Surface callers only need createMarsLander(). */
export function createMarsHeatShield() {
  const shield = new THREE.Group(); shield.name = 'heat-shield';
  const char = material(0x352b27,.97,.05), thermal = material(0xaeb2a5,.86,.15);
  cylinder(shield,7.5,6.8,.7,char,[0,0,0],48);
  cylinder(shield,5.75,7.5,2.3,thermal,[0,1.5,0],48);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.48,.10,8,48),material(0x8c7860,.8,.4));
  rim.rotation.x = Math.PI/2; rim.position.y = .35; shield.add(rim);
  return shield;
}

/** GAME ASSUMPTION: 15 m entry envelope enclosing the folded surface vehicle.
 * Same removable cover throughout rendezvous, cruise, orbit and entry.
 * The open central docking collar allows crew transfer before separation.
 * Concept context: https://ntrs.nasa.gov/citations/20120012928
 */
export function createMarsBackshell() {
  const shell = new THREE.Group(); shell.name = 'mars-backshell';
  const white = material(0xdedfd7,.75,.18), foil = material(0xb99752,.55,.45);
  const profile = [[7.5,2.75],[7.5,3.8],[5,8.05],[3.5,10],[1.45,11.35]].map(([r,y])=>new THREE.Vector2(r,y));
  const skin = new THREE.Mesh(new THREE.LatheGeometry(profile,48),white);
  skin.castShadow=true; skin.receiveShadow=true; shell.add(skin);
  cylinder(shell,1.5,1.5,.35,foil,[0,11.5,0]);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(7.48,.09,8,48),foil);
  rim.rotation.x=Math.PI/2; rim.position.y=2.75; shell.add(rim);
  for(let i=0;i<12;i++) {
    const angle=i*Math.PI/6;
    const point=(r,y)=>[Math.cos(angle)*r,y,Math.sin(angle)*r];
    beam(shell,point(7.51,3.8),point(5.01,8.05),.035,foil);
    beam(shell,point(5.01,8.05),point(3.51,10),.035,foil);
    beam(shell,point(3.51,10),point(1.46,11.32),.035,foil);
  }
  return shell;
}
