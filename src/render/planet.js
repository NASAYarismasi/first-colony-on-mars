import * as THREE from 'three';
import { KSC_LATITUDE } from '../sim/constants.js';

const vertex = `varying vec2 vTex; varying vec3 vN; varying vec3 vP;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vTex=uv; vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;
#include <logdepthbuf_vertex>
}`;
const fragment = `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D regionalMap; uniform float regionalAvailable; uniform sampler2D detailMap; uniform float detail; uniform vec3 sunDirection; uniform float mars; uniform float air; uniform float spaceView;
varying vec2 vTex; varying vec3 vN; varying vec3 vP;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
vec3 n=normalize(vN);vec2 tile=vTex*vec2(2200.,1100.);float grain=texture2D(detailMap,tile).r;float grain2=texture2D(detailMap,tile*.19).r;
vec3 east=normalize(cross(vec3(0.,1.,0.),n)+vec3(.0001));vec3 north=cross(n,east);
vec2 slope=vec2(texture2D(detailMap,tile+vec2(.004,0.)).r-grain,texture2D(detailMap,tile+vec2(0.,.004)).r-grain);
n=normalize(n+(east*slope.x+north*slope.y)*detail*1.8);float light=dot(n,sunDirection); vec3 day=texture2D(dayMap,vTex).rgb;
vec2 regionalUV=(vTex-vec2(.25,.55555556))/vec2(.13888889,.27777778);
float regionalEdge=smoothstep(0.,.035,regionalUV.x)*smoothstep(0.,.035,regionalUV.y)*(1.-smoothstep(.965,1.,regionalUV.x))*(1.-smoothstep(.965,1.,regionalUV.y));
day=mix(day,texture2D(regionalMap,clamp(regionalUV,0.,1.)).rgb,regionalEdge*detail*(1.-mars)*regionalAvailable);
day*=1.+((grain-.5)*.42+(grain2-.5)*.6)*detail;
vec3 night=texture2D(nightMap,vTex).rgb; vec3 v=normalize(cameraPosition-vP);
float ocean=(1.-mars)*max(smoothstep(.003,.035,day.b-day.r),(1.-smoothstep(.001,.006,max(day.r,max(day.g,day.b))))*(1.-smoothstep(.0005,.004,day.g-day.b))); day=mix(day,vec3(.025,.12,.24)*(1.+(grain-.5)*.18*detail),ocean*.45);float spec=pow(max(0.,dot(reflect(-sunDirection,n),v)),80.)*ocean*.35;
// Orbital surface grading preserves texture detail without crushing the night side.
day=mix(day,clamp((day-.18)*1.12+.18,0.,1.),spaceView*.45);
float softDay=smoothstep(-.08,.12,light);
vec3 col=day*(.06+max(0.,light)*1.4)+night*pow(1.-smoothstep(-.22,.15,light),2.)*(1.-mars)*.8+spec;
day=mix(day,day*vec3(1.12,.96,.85),mars*.35);vec3 orbital=day*(.025+max(0.,light)*1.32);
orbital+=night*pow(1.-smoothstep(-.18,.08,light),2.)*(1.-mars)*.48;
orbital+=vec3(.55,.73,.95)*spec*softDay;
col=mix(col,orbital,spaceView);
float haze=pow(1.-max(0.,dot(n,v)),3.)*air*.85;col=mix(col,mix(vec3(.25,.43,.57),vec3(.42,.27,.15),mars),haze);
gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function createPlanet(radius, mars, assets) {
  const group = new THREE.Group();
  const surface = new THREE.Mesh(new THREE.SphereGeometry(radius, mars?192:384, mars?128:192), new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: fragment,
    uniforms: { dayMap: { value: assets.textures[mars ? 'mars-color' : 'earth-day'] }, nightMap: { value: assets.textures['earth-night'] }, regionalMap:{value:assets.textures['earth-florida-atlantic']},regionalAvailable:{value:assets.failures.includes('earth-florida-atlantic')?0:1},detailMap:{value:assets.textures.earthDetail}, detail:{value:0}, sunDirection: { value: new THREE.Vector3(.65,.45,.6).normalize() }, mars: { value: mars ? 1 : 0 }, air: { value: 0 }, spaceView: { value: 0 } }
  }));
  group.add(surface);
  let clouds;
  if (!mars) {
    clouds = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.0025, 256, 128), new THREE.MeshStandardMaterial({ color: 0xffffff, alphaMap: assets.textures.clouds, alphaTest:0, transparent: true, opacity: .22, depthWrite: false, roughness: 1 }));
    group.add(clouds);
  }
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * (mars ? 1.018 : 1.022), 96, 64), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(mars ? 0xd39065 : 0x438fff) }, sunDirection: surface.material.uniforms.sunDirection }, vertexShader: vertex,
    fragmentShader: `uniform vec3 tint;uniform vec3 sunDirection;varying vec3 vN;varying vec3 vP;
    #include <common>
    #include <logdepthbuf_pars_fragment>
    void main(){
    #include <logdepthbuf_fragment>
    float rim=pow(1.-abs(dot(normalize(vN),normalize(cameraPosition-vP))),3.6);float lit=smoothstep(-.3,.6,dot(normalize(vN),sunDirection));gl_FragColor=vec4(tint*rim*(.15+lit)*1.4,rim*.7);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`
  })); group.add(atmosphere);
  return { group, surface, update(state, sun) {
    // The mission point is the launch deck / terrain contact reference. Keep the coarse globe below local detail.
    group.position.set(0, -radius - (state.altitude ?? 0) - (mars && state.altitude < 25000 ? 200 : 15), 0);
    // Texture frame follows real planetary rotation, while the observer frame follows the vehicle radial.
    surface.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),(mars?Math.PI/2:Math.PI/2-KSC_LATITUDE)+state.theta);
    // Display-only LC-39B longitude alignment; the sim constants are unchanged.
    // https://www.nasa.gov/centers-and-facilities/kennedy/launch-pad-39b/
    surface.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),state.rotation+(mars?-1.6:80.604*Math.PI/180)));
    surface.material.uniforms.spaceView.value=THREE.MathUtils.smoothstep(state.altitude??0,150000,500000);
    surface.material.uniforms.air.value=Math.min(1,Math.pow(state.density/(mars?.015:1.225),.28));
    surface.material.uniforms.detail.value=mars?0:Math.max(0,1-(state.altitude??0)/240000);
    if (clouds) { clouds.rotation.copy(surface.rotation); clouds.rotation.y += .05+state.missionTime*.000002; clouds.visible = state.altitude > 14000; }
    atmosphere.visible = state.altitude > (mars?50000:80000);
    surface.material.uniforms.sunDirection.value.copy(sun);
  } };
}

export function createSky(assets) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1e8, 32, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false,
    uniforms: { stars: { value: assets.textures.stars }, air: { value: 1 }, mars: { value: 0 } },
    vertexShader: `varying vec2 vTex;varying vec3 vRay;void main(){vTex=uv;vRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D stars;uniform float air;uniform float mars;varying vec2 vTex;varying vec3 vRay;
    void main(){float h=normalize(vRay).y;vec3 zenith=mix(vec3(.025,.20,.52),vec3(.23,.16,.10),mars);vec3 horizon=mix(vec3(.22,.47,.73),vec3(.63,.40,.22),mars);
    vec3 sky=mix(horizon,zenith,pow(max(0.,h),.4));vec3 star=texture2D(stars,vTex).rgb*.11;gl_FragColor=vec4(mix(star,sky,air),1.);}`
  })); sky.renderOrder = -1000; sky.frustumCulled = false;
  return { mesh: sky, update(state, camera) { sky.position.copy(camera.position); sky.material.uniforms.air.value = Math.min(1, Math.pow(state.density / (state.mars ? .015 : 1.225), .28)); sky.material.uniforms.mars.value = state.mars ? 1 : 0; } };
}
