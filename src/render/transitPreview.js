import * as T from 'three';
import {heliocentricAt,TRANSFER} from '../sim/transfer.js';
import {AU,EARTH,MARS} from '../sim/constants.js';
import {createPlanet,createSky} from './planet.js';
import {createVehicle} from './vehicle.js';
import {NTR_NOZZLES} from './transitParts.js';
import {interpolateState} from './interpolate.js';
import {disposeScene} from './dispose.js';

// GAME ASSUMPTION: cinematic miniature staging; distances and vehicle sizes are not to scale.
// Flight progress and the orbit angle are read from the real mission snapshot.
export function createTransitPreview(){let ctx,scene,earth,mars,sky,vehicle,rig,route,flames=[],caption;
 const smoothPosition=new T.Vector3();let hasPosition=false,smoothHeading=0;
 const sun=new T.Vector3(-.3,.7,1).normalize();
 const project=([x,y])=>new T.Vector3(-x/AU*31,y/AU*31,0);
 const path=Array.from({length:161},(_,i)=>project(heliocentricAt(TRANSFER.duration*i/160).ship));
 return {enter(context){ctx=context;scene=new T.Scene();this.scene=scene;
  scene.add(new T.AmbientLight(0x91a4c8,.6));const light=new T.DirectionalLight(0xfff0da,3.5);light.position.set(-40,80,100);scene.add(light);
  const rim=new T.DirectionalLight(0x69aaff,1.6);rim.position.set(40,-10,-30);scene.add(rim);
  earth=createPlanet(EARTH.radius,false,ctx.assets);mars=createPlanet(MARS.radius,true,ctx.assets);sky=createSky(ctx.assets);scene.add(earth.group,mars.group,sky.mesh);
  rig=new T.Group();vehicle=createVehicle(ctx.assets);rig.add(vehicle.group);rig.scale.setScalar(.15);scene.add(rig);
  // Preview-only forward fairing. Attach to Orion so it follows the docking animation.
  const noseProfile = [
    [2.25, 2.15], [2.29, 2.45], [2.22, 2.75], [2.04, 3.08],
    [1.72, 3.48], [1.30, 3.85], [.85, 4.13], [.42, 4.30], [0, 4.36]
  ].map(([radius, height]) => new T.Vector2(radius, height));
  const nose = new T.Mesh(
    new T.LatheGeometry(noseProfile, 64),
    new T.MeshStandardMaterial({color:0xe4e1d6, roughness:.48, metalness:.24})
  );
  nose.rotation.z = Math.PI;
  vehicle.orion.add(nose);
  const seam = new T.Mesh(new T.TorusGeometry(2.27,.055,8,64),
    new T.MeshStandardMaterial({color:0x526068,roughness:.55,metalness:.5}));
  seam.rotation.x = Math.PI/2;
  seam.position.y = -2.4;
  vehicle.orion.add(seam);

  for(const position of NTR_NOZZLES){const geometry=new T.PlaneGeometry(4,30);geometry.translate(0,-15,0);const material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 uv0;uniform float time;void main(){float x=abs(uv0.x-.5)*2.;float t=uv0.y;float core=pow(max(0.,1.-x),2.);float fade=pow(t,1.5);float wave=.85+.15*sin(t*45.-time*24.);gl_FragColor=vec4(mix(vec3(.18,.35,1.),vec3(.85,.95,1.),pow(t,4.)),core*fade*wave*.85);}`});const flame=new T.Mesh(geometry,material);flame.position.fromArray(position);vehicle.group.add(flame);flames.push(flame);}
  for(const position of [heliocentricAt(0).earth,heliocentricAt(0).mars]){
    const radius=Math.hypot(...position);
    const points=Array.from({length:192},(_,i)=>{const angle=i*Math.PI/96;return project([radius*Math.cos(angle),radius*Math.sin(angle)]);});
    scene.add(new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x597384,transparent:true,opacity:.32})));
  }
  scene.add(new T.Mesh(new T.SphereGeometry(2,24,16),new T.MeshBasicMaterial({color:0xffce83})));
  route=new T.Line(new T.BufferGeometry().setFromPoints(path),new T.LineDashedMaterial({color:0x70929e,transparent:true,opacity:.25,dashSize:.8,gapSize:1}));route.computeLineDistances();scene.add(route);
  const ring=new T.LineLoop(new T.BufferGeometry().setFromPoints(Array.from({length:160},(_,i)=>new T.Vector3(Math.cos(i/160*Math.PI*2)*28,Math.sin(i/160*Math.PI*2)*13,Math.sin(i/160*Math.PI*2)*17))),new T.LineBasicMaterial({color:0xe3b58a,transparent:true,opacity:.25}));ring.name='capture-ring';scene.add(ring);
  const earthRing=ring.clone();earthRing.name='earth-orbit';scene.add(earthRing);

  caption=document.createElement('div');caption.className='preview-journey';caption.innerHTML="<span class=\"preview-earth\">EARTH<small>LAUNCH POINT</small></span><div><b data-preview-title>INTERPLANETARY CRUISE</b><small>3D cinematic preview · Representative scales</small></div><span class=\"preview-mars\">MARS<small>ARRIVAL</small></span>";document.body.append(caption);
 },update(pair,alpha){const s=interpolateState(pair.previous,pair.current,alpha);caption.hidden=false;ctx.cameras.update(s,ctx.frameDelta);const camera=ctx.cameras.camera;
  const capture=['MOI_BURN','MARS_ORBIT'].includes(s.phase),departure=['PARKING_ORBIT','TMI_BURN'].includes(s.phase);
  camera.position.set(0,35,155);camera.lookAt(0,2,0);camera.fov=camera.aspect<1.4?55:43;camera.updateProjectionMatrix();sky.update({...s,density:0},camera);
  // Fix the surface, clouds and lighting in a single inertial orientation.
  const globeView={theta:0,rotation:0,missionTime:0,density:0,altitude:1e7};
  earth.update(globeView,sun);mars.update(globeView,sun);
  const elapsed=s.heliocentric.time;
  const epoch=s.events.find(event=>event.type==='CRUISE')?.time;
  const time=epoch===undefined?elapsed:s.missionTime-epoch;
  const positions=heliocentricAt(time,s.transfer);
  earth.group.position.copy(project(positions.earth));mars.group.position.copy(project(positions.mars));
  earth.group.scale.setScalar(5/EARTH.radius);mars.group.scale.setScalar(4/MARS.radius);
  vehicle.update({...s,theta:0,attitude:0},false,camera);
  // No persistent burn or propellant change is applied to the physics: plume is a cinematic cue.
  const heading=project(heliocentricAt(elapsed+60,s.transfer).ship).sub(project(s.heliocentric.ship));
  const transferPosition=project(s.heliocentric.ship);
  transferPosition.z=5;
  const orbitAngle=s.polar[1];
  const offset=new T.Vector3(Math.cos(orbitAngle)*8.4,Math.sin(orbitAngle)*3.9,Math.sin(orbitAngle)*5.1);
  const orbitPosition=(capture?mars.group.position:earth.group.position).clone().add(offset);
  const burnTotal=s.burnDelivered+s.burnRemaining;
  const burnProgress=burnTotal>0?s.burnDelivered/burnTotal:0;
  const eased=T.MathUtils.smoothstep(burnProgress,0,1);
  rig.position.copy(transferPosition);
  rig.rotation.z=Math.atan2(heading.y,heading.x)-Math.PI/2;
  if(departure){
    rig.position.copy(orbitPosition);
    if(s.phase==='TMI_BURN')rig.position.lerp(transferPosition,eased);
  }
  if(capture){
    const arrival=project(heliocentricAt(s.transfer.duration,s.transfer).ship);
    arrival.z=5;
    rig.position.copy(arrival).lerp(orbitPosition,s.phase==='MARS_ORBIT'?1:eased);
  }
  // Both local orbits remain visible throughout departure, transfer and capture.
  for(const [name,planet] of [['earth-orbit',earth],['capture-ring',mars]]){
    const ring=scene.getObjectByName(name);
    ring.visible=true;
    ring.position.copy(planet.group.position);
    ring.scale.setScalar(.30);
  }
  const blend=1-Math.exp(-Math.min(.1,ctx.frameDelta)*6);
  if(!hasPosition){smoothPosition.copy(rig.position);smoothHeading=rig.rotation.z;hasPosition=true;}
  else smoothPosition.lerp(rig.position,blend);
  rig.position.copy(smoothPosition);
  smoothHeading+=Math.atan2(Math.sin(rig.rotation.z-smoothHeading),Math.cos(rig.rotation.z-smoothHeading))*blend;
  rig.rotation.z=smoothHeading;
  flames.forEach(flame=>flame.material.uniforms.time.value=s.missionTime);route.visible=true;
  caption.querySelector('[data-preview-title]').textContent=capture?s.phase==='MARS_ORBIT'?"MARS ORBIT ACHIEVED":"MARS CAPTURE BURN":departure?"EARTH DEPARTURE":"INTERPLANETARY CRUISE";caption.classList.toggle('is-capture',capture);
  this.state=s;this.audioDistance=80;
 },suspend(){if(caption)caption.hidden=true;hasPosition=false;},exit(){caption?.remove();if(scene)disposeScene(scene);flames=[];scene=null;}};
}
