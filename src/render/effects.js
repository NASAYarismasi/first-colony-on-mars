import * as THREE from 'three';
import { P0 } from '../sim/constants.js';
import { seeded } from './primitives.js';
import { landingSequence } from './landingSequence.js';
import { NTR_NOZZLES } from './transitParts.js';
import { vehicleConfiguration } from './vehiclePhases.js';

function plume(color, hydrolox) {
  const uniforms={time:{value:0},power:{value:0},color:{value:new THREE.Color(color)},hydro:{value:hydrolox?1:0},pressure:{value:1}};
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms,
    vertexShader:`varying vec2 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vUv=uv;vec3 base=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vec3 axis=normalize(mat3(modelMatrix)*vec3(0.,1.,0.));float len=length(mat3(modelMatrix)*vec3(0.,1.,0.));float width=length(mat3(modelMatrix)*vec3(1.,0.,0.));vec3 right=normalize(cross(axis,normalize(cameraPosition-base)));vec3 world=base+axis*position.y*len+right*position.x*width;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
    #include <logdepthbuf_vertex>
    }`,
    fragmentShader:`uniform float time,power,hydro,pressure;uniform vec3 color;varying vec2 vUv;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    float t=1.-vUv.y;float x=(vUv.x-.5)*2.;float n=sin(x*23.+t*71.-time*37.)*sin(t*117.-time*61.);float radius=.48+.52*t+sin(t*90.-time*43.)*.045*t;float radial=abs(x+sin(t*57.-time*32.)*.035*t)/radius;
    float soft=pow(max(0.,1.-radial*radial),1.7);float fade=pow(1.-t,1.35);float diamonds=pow(.5+.5*cos(t*(55.+20.*pressure)-time*3.),7.);float glow=(1.+n*.25+hydro*diamonds*2.5*pressure)*fade;
    vec3 hot=mix(color,vec3(4.,3.5,2.8),clamp(pow(1.-t,7.)+pow(max(0.,1.-radial),7.)*.35,0.,1.));gl_FragColor=vec4(hot*glow*power,soft*(hydro>.5?.38:.9)*fade*power);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const geometry=new THREE.PlaneGeometry(2,1,1,24);geometry.translate(0,-.5,0);
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  return mesh;
}

/** Cosmetic particles stay in planet-fixed double precision coordinates; origin changes only affect GPU positions. */
export function createEffects(scene) {
  const rig=new THREE.Group();scene.add(rig);const jets=[];
  function jet(type,pos) {const m=plume(type==='srb'?0xff9d3a:type==='retro'?0xffb778:0x637fff,type==='rs25'||type==='icps');m.position.fromArray(pos);rig.add(m);jets.push({type,m});}
  for(const x of [-6.4,6.4])jet('srb',[x,1,0]);
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;jet('rs25',[Math.cos(a)*2,0,Math.sin(a)*2]);}
  jet('icps',[0,66.1,0]);
  for(const position of NTR_NOZZLES)jet('transit',position);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;jet('retro',[Math.cos(a)*4.2,1.5,Math.sin(a)*4.2]);}
  const engineLight=new THREE.PointLight(0xffad57,0,400,2);engineLight.position.set(0,-3,0);scene.add(engineLight);
  const max=3600,positions=new Float32Array(max*3),sizes=new Float32Array(max),colors=new Float32Array(max*4),particles=[],random=seeded(90);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('color',new THREE.BufferAttribute(colors,4));
  const smoke=new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:false,
    uniforms:{pixelScale:{value:700}},vertexShader:`attribute float size;attribute vec4 color;varying vec4 vColor;uniform float pixelScale;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vColor=color;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(size*pixelScale/max(1.,-mvPosition.z),0.,350.);
    #include <logdepthbuf_vertex>
    }`,fragmentShader:`varying vec4 vColor;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float a=pow(1.-r*r,2.);gl_FragColor=vec4(vColor.rgb,a*vColor.a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}));smoke.frustumCulled=false;scene.add(smoke);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(11,9,48,1,true),new THREE.MeshBasicMaterial({color:0xe5edee,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));cone.position.y=66;rig.add(cone);
  const plasma=new THREE.Mesh(new THREE.SphereGeometry(8.1,40,24,0,Math.PI*2,Math.PI/2,Math.PI/2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{heat:{value:0},time:{value:0}},vertexShader:`varying vec3 vN;varying vec3 vP;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vN=normalMatrix*normal;vec4 p=modelViewMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*p;
    #include <logdepthbuf_vertex>
    }`,fragmentShader:`uniform float heat,time;varying vec3 vN;varying vec3 vP;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    float rim=pow(1.-abs(dot(normalize(vN),normalize(-vP))),1.5);float pulse=.85+.15*sin(vP.x*8.+time*50.);gl_FragColor=vec4(mix(vec3(3.,.18,.015),vec3(2.,1.2,.5),rim)*heat*pulse,(.18+rim*.8)*heat);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}));plasma.position.y=2;scene.add(plasma);
  // Cosmetic ablative wake: driven by the existing Sutton-Graves heat flux,
  // not an invented entry trajectory or a thermal/CFD temperature solution.
  const plasmaWake=new THREE.Mesh(new THREE.ConeGeometry(8.8,23,32,1,true),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:plasma.material.uniforms,
    vertexShader:`varying vec2 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    #include <logdepthbuf_vertex>
    }`,
    fragmentShader:`uniform float heat,time;varying vec2 vUv;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    float trail=pow(1.-vUv.y,1.7);float filaments=.4+.6*pow(.5+.5*sin(vUv.x*144.+vUv.y*27.-time*31.),4.);gl_FragColor=vec4(2.4,.35,.08,heat*trail*filaments*.24);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}));scene.add(plasmaWake);
  const entryLight=new THREE.PointLight(0xff6425,0,35,2);scene.add(entryLight);
  let lastTime=null,carry=0,quality=1,processedTime=-Infinity,landedDust=false;
  function emit(s,pos,kind) {
    if(particles.length>=max*quality)particles.shift();
    const c=Math.cos(s.theta),sn=Math.sin(s.theta),x=pos[0],y=pos[1];
    // Plume-driven regolith: radial ejection 15–35 m/s (SRP/skycrane erosion studies); bounded visual effect.
    const speed=kind==='dust'?15+random()*20:5;
    const vx=kind==='dust'?pos[0]/Math.max(1,Math.hypot(pos[0],pos[2]))*speed:(random()-.35)*speed;
    particles.push({p:[s.position[0]+x*c+y*sn,s.position[1]-x*sn+y*c,pos[2]],t:s.missionTime+(s.phase==='PRELAUNCH'?s.countdown.time:0),kind,seed:random(),vx:vx*c,vy:-vx*sn,vz:kind==='dust'?pos[2]/Math.max(1,Math.hypot(pos[0],pos[2]))*speed:(random()-.5)*8,theta:s.theta});
  }
  return {setQuality(v){quality=v;}, update(s,height=900){
    const config=vehicleConfiguration(s);
    const clock=s.missionTime+(s.phase==='PRELAUNCH'?s.countdown.time:0)+(s.phase==='LANDED'?landingSequence.elapsed??0:0);
    const dt=lastTime===null?0:Math.max(0,clock-lastTime);lastTime=clock;
    // GAME ASSUMPTION: faint entry pilot plumes are visual only; descent thrust remains simulation-driven.
    const entryPilot=s.phase==='EDL'&&!s.engineFiring;
    rig.rotation.z=s.phase==='EDL'?(s.engineFiring?s.thrustAngle??0:Math.atan2(Math.sqrt(Math.max(0,s.surfaceVelocity**2-s.verticalSpeed**2)),-s.verticalSpeed)):s.attitude+s.theta;rig.position.set(0,0,0).applyAxisAngle(new THREE.Vector3(0,0,1),rig.rotation.z);
    const launch=['PRELAUNCH','ASCENT'].includes(s.phase),solid=launch&&s.phase==='ASCENT'&&s.stages.find(p=>p.id==='srb').attached;
    const core=launch&&s.stages.find(p=>p.id==='core').attached&&(s.engineFiring&&s.throttle>0||s.countdown.running&&s.countdown.time>=-6.5);
    const pressure=Math.max(0,Math.min(1,s.pressure/P0)),expand=Math.min(4,Math.pow(P0/Math.max(10,s.pressure),.16));
    const pre=s.phase==='PRELAUNCH'?Math.min(1,(s.countdown.time+6.5)/5):1;
    for(const {type,m}of jets) {
      const active=type==='srb'?solid:type==='rs25'?core:type==='icps'?s.phase==='ASCENT'&&!s.stages.find(p=>p.id==='core').attached&&s.engineFiring:type==='retro'?s.phase==='EDL':config.ntrBurn;
      m.visible=active;if(!active)continue;
      const power=type==='retro'&&entryPilot?.14+.025*Math.sin(s.missionTime*5):type==='srb'?Math.min(1,(s.thrust??3e7)/3e7):Math.max(.08,(s.throttle??1)*pre);
      const radius=type==='srb'?3.3:type==='rs25'?1.5:type==='retro'?1:type==='transit'?1.25:2;
      const length=type==='srb'?70:type==='rs25'?27:type==='retro'?15:type==='transit'?14:30;
      // GAME ASSUMPTION: a very faint blue visibility cue for hot hydrogen;
      // NTR uses reactor heat, not combustion. No orange flame/Mach diamonds.
      // https://www.nasa.gov/space-technology-mission-directorate/tdm/space-nuclear-propulsion/
      m.scale.set(radius*expand*(type==='retro'&&entryPilot?.3:1),length*(type==='retro'?.2+power*.8:.65+power*.35),radius*expand*(type==='retro'&&entryPilot?.3:1));m.material.uniforms.time.value=s.missionTime+(s.phase==='PRELAUNCH'?s.countdown.time:0);// Methalox retro plumes are faint in Martian daylight; the NTR hydrogen plume nearly invisible.
      m.material.uniforms.power.value=type==='transit'?power*.055:type==='retro'?power*.3:power;m.material.uniforms.pressure.value=pressure;
    }
    engineLight.position.y=s.mars?1.5:-3;
    engineLight.intensity=(solid?90000:core?45000:s.phase==='EDL'&&s.engineFiring?(s.altitude<150?320:900)*s.throttle:0)*(.92+.08*Math.sin(s.missionTime*103));
    cone.material.opacity=launch?Math.max(0,1-Math.abs((s.mach??0)-1)/.13)*Math.min(1,s.density/.15)*.22:0;
    plasma.visible=s.phase==='EDL'&&(s.heatFlux??0)>2000;plasma.material.uniforms.heat.value=Math.min(1.6,(s.heatFlux??0)/28000);plasma.material.uniforms.time.value=s.missionTime;plasma.rotation.z=!s.engineFiring?Math.atan2(Math.sqrt(Math.max(0,s.surfaceVelocity**2-s.verticalSpeed**2)),-s.verticalSpeed):0;
    plasma.position.set(0,2,0).applyAxisAngle(new THREE.Vector3(0,0,1),plasma.rotation.z);
    plasmaWake.visible=plasma.visible&&!s.engineFiring;
    plasmaWake.rotation.copy(plasma.rotation);plasmaWake.position.set(0,13,0).applyAxisAngle(new THREE.Vector3(0,0,1),plasma.rotation.z);
    entryLight.intensity=plasma.visible?Math.min(1600,(s.heatFlux??0)*.018):0;entryLight.position.copy(plasma.position);
    // Samples are captured by the fixed physics loop, so time stepping and real-time flight produce the same trail.
    for(const e of s.exhaust??[]){
      if(e.time<=processedTime||clock-e.time>105)continue;
      const sample={...s,...e,missionTime:e.time,countdown:{...s.countdown,time:e.time}};
      // emit() receives a continuous mission/countdown clock through this explicit phase override.
      sample.phase='ASCENT';
      for(let i=0;i<6*quality;i++){
        const nozzle=new THREE.Vector3((i%2?1:-1)*6.4,-5,0).applyAxisAngle(new THREE.Vector3(0,0,1),e.attitude+e.theta);
        if(e.phase==='ASCENT')emit(sample,nozzle.toArray(),'smoke');
        if(e.altitude<30)for(let j=0;j<2;j++)emit(sample,[(random()-.5)*70,-e.altitude-9,(random()-.5)*45],e.phase==='PRELAUNCH'?'water':'ground');
      }processedTime=e.time;
    }
    // GAME ASSUMPTION (order of magnitude): a crew-class retro-propulsive lander erodes regolith from
    // ~120 m (Curiosity's far smaller skycrane plume already lifted dust at ~20 m, NASA/JPL 2012).
    // Intensity grows ~ (1 - h/120)^2 with throttle; the ring widens as the plume spreads at low height.
    if(dt>0&&s.phase==='EDL'&&s.engineFiring&&s.altitude<120) {
      const near=1-s.altitude/120, ring=4+s.altitude*.22;
      carry+=Math.min(dt,.3)*520*quality*(.3+.7*(s.throttle??0))*near*near;const count=Math.floor(carry);carry-=count;
      for(let i=0;i<count;i++) {
        const a=random()*Math.PI*2, r=ring*(.35+random()*.65);
        if(s.mars)emit(s,[Math.cos(a)*r,-s.altitude+.3,Math.sin(a)*r],'dust');
      }
    }
    // A short contact puff also survives a large deterministic test time step.
    // Dust advection/settling is a bounded visual effect, not terrain physics.
    if(s.phase!=='LANDED')landedDust=false;
    if(s.phase==='LANDED'&&!landedDust){
      for(let i=0;i<320*quality;i++){const a=random()*Math.PI*2,r=2+random()*9;emit(s,[Math.cos(a)*r,.3,Math.sin(a)*r],'dust');}
      landedDust=true;
    }
    const c=Math.cos(s.theta),sn=Math.sin(s.theta);let n=0;
    for(let i=particles.length-1;i>=0;i--) {
      const p=particles[i],age=clock-p.t,life=p.kind==='water'?6:p.kind==='dust'?12:100;
      if(age>life){particles.splice(i,1);continue;}
      // Dust: fast radial sheet that decelerates (drag), lofts a few metres and settles over ~12 s.
      const loft=p.kind==='dust'?Math.min(6,age*2.4)*Math.exp(-age/4.5)*(.5+p.seed):Math.min(60,age*1.4);
      const drift=p.kind==='dust'?1.6*(1-Math.exp(-age/1.6)):age;
      const dx=p.p[0]+p.vx*drift+loft*Math.sin(p.theta)-s.position[0],dy=p.p[1]+p.vy*drift+loft*Math.cos(p.theta)-s.position[1];
      positions[n*3]=dx*c-dy*sn;positions[n*3+1]=dx*sn+dy*c;positions[n*3+2]=p.p[2]+p.vz*drift;
      sizes[n]=p.kind==='water'?1+age:p.kind==='dust'?3.5+age*3.6:7+age*(p.kind==='ground'?5:2.4);
      const shade=.42+p.seed*.22,glow=Math.max(0,1-age/5)*(p.kind==='ground'?1.2:.5);colors.set(p.kind==='dust'?[.5,.31,.17,Math.min(1,age*3)*(1-age/life)*.3]:p.kind==='water'?[.8,.88,.9,(1-age/life)*.25]:[shade+.08+glow,shade+.07+glow*.45,shade+.04,(1-age/life)*.43],n*4);n++;
    }
    geometry.setDrawRange(0,n);geometry.attributes.position.needsUpdate=true;geometry.attributes.size.needsUpdate=true;geometry.attributes.color.needsUpdate=true;smoke.material.uniforms.pixelScale.value=height;
  }};
}
