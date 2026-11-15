import * as THREE from 'three';
import { MARS } from '../sim/constants.js';
import { material, noiseTexture, seeded } from './primitives.js';

// Jezero is ~45 km across and contains an ancient western river delta:
// https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/landing_site/
// GAME ASSUMPTION: every elevation, location offset and rock below is an
// illustrative reconstruction, not MOLA/HiRISE surveyed landing topography.
function heightAt(x,z) {
  const r=Math.hypot(x,z), basinRadius=Math.hypot(x-10000,z-3000);
  const rim=680*Math.exp(-(((basinRadius-22500)/1600)**2))*(1+.18*Math.sin(Math.atan2(z-3000,x-10000)*21));
  const dx=x+17000,dz=z+2200,fanRadius=Math.hypot(dx,dz),angle=Math.atan2(dz,dx);
  const fan=THREE.MathUtils.smoothstep(fanRadius,1000,2600)*(1-THREE.MathUtils.smoothstep(fanRadius,9000,11000))*(1-THREE.MathUtils.smoothstep(Math.abs(angle),.34,.65));
  const channels=1-.5*Math.exp(-((Math.sin(angle*19+fanRadius*.0002)*4)**2));
  const delta=fan*(160+22*Math.sin(fanRadius*.004))*channels;
  const broad=Math.sin(x*.0018)*Math.cos(z*.0014)*24+Math.sin(x*.008+z*.006)*5;
  const small=Math.sin(x*.15+z*.04)*Math.cos(z*.12)*.38+Math.sin(x*.032-z*.06)*1.4;
  // Clear, level contact area for the concept landing; preserve the sim's y=0.
  const clear=THREE.MathUtils.smoothstep(r,65,240);
  return (rim+delta+broad+small)*clear-r*r/(2*MARS.radius);
}

function radialPatch(inner,outer,rings,segments,mat) {
  const positions=[],uvs=[],indices=[];
  for(let j=0;j<=rings;j++) {
    const r=inner+(outer-inner)*(inner===0?(j/rings)**1.8:j/rings);
    for(let i=0;i<=segments;i++) {
      const a=i/segments*Math.PI*2,x=Math.cos(a)*r,z=Math.sin(a)*r;
      positions.push(x,heightAt(x,z),z);uvs.push(x/800,z/800);
      if(j<rings&&i<segments) {
        const n=j*(segments+1)+i;
        indices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.receiveShadow=true;return mesh;
}

export function createTerrain() {
  const group=new THREE.Group(),mat=material(0xac7953,.97,0);
  mat.map=noiseTexture('#ba9169',2);mat.map.repeat.set(24,24);mat.bumpMap=mat.map;mat.bumpScale=.16;
  // Bounded geometry: broad crater/delta silhouette, then metre-scale surface.
  const distant=radialPatch(800,42000,96,192,mat),near=radialPatch(0,800,64,128,mat);group.add(distant,near);
  const random=seeded(234),rockGeo=new THREE.DodecahedronGeometry(1,0);
  const rocks=new THREE.InstancedMesh(rockGeo,material(0x77604c,.97,0),650),dummy=new THREE.Object3D();
  for(let i=0;i<650;i++) {
    const a=random()*Math.PI*2,r=18+random()**2*760,x=Math.cos(a)*r,z=Math.sin(a)*r;
    const k=.12+random()**3*1.7;
    dummy.position.set(x,heightAt(x,z)+k*.18,z);dummy.scale.set(k,k*.55,k*.8);
    dummy.rotation.set(random()*.4,random()*6,random()*.3);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  rocks.castShadow=true;group.add(rocks);
  // Cosmetic surface scour, not a geological erosion solver. Four engine
  // impingement footprints remain after touchdown; no terrain/sim mutation.
  const scourMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{strength:{value:0}},
    vertexShader:`varying vec2 vUv;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    #include <logdepthbuf_vertex>
    }`,
    fragmentShader:`varying vec2 vUv;uniform float strength;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    vec2 p=(vUv-.5)*2.;float r=length(p);float streak=.6+.4*pow(.5+.5*sin(atan(p.y,p.x)*53.+r*12.),3.);float a=(1.-smoothstep(.1,1.,r))*streak*strength;gl_FragColor=vec4(.16,.105,.07,a*.42);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const scour=new THREE.Group();group.add(scour);
  const diskGeo=new THREE.PlaneGeometry(14,14);diskGeo.rotateX(-Math.PI/2);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,m=new THREE.Mesh(diskGeo,scourMat);m.position.set(Math.cos(a)*4.2,.035,Math.sin(a)*4.2);scour.add(m);}
  let anchor=null;
  return {group, surfaceY(x,z){
    const angle=group.rotation.z, cos=Math.cos(angle), sin=Math.sin(angle);
    const localX=(x-group.position.x)/cos;
    return group.position.y+sin*localX+heightAt(localX,z)/cos;
  },update(s){
    const altitude=s.altitude??1e6;
    group.visible=s.mars&&altitude<60000;
    if(!s.mars||!['EDL','LANDED'].includes(s.phase))anchor=null;
    // Lock the final landing patch to the rotating surface. Above this local
    // region, the procedural crater is an illustrative radial terrain layer.
    if(s.mars&&altitude<1000&&anchor===null)anchor=s.theta;
    const angle=anchor===null?0:anchor-s.theta;
    group.position.set(MARS.radius*Math.sin(angle),MARS.radius*(Math.cos(angle)-1)-altitude,0);
    group.rotation.z=-angle;
    near.visible=altitude<6000;rocks.visible=altitude<1800;
    scourMat.uniforms.strength.value=s.phase==='LANDED'?.8:s.engineFiring?THREE.MathUtils.clamp((30-altitude)/30,0,1)*(s.throttle??0)*3:0;
    scour.visible=scourMat.uniforms.strength.value>0;
  }};
}
