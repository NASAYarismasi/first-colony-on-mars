import {readMenuPreferences} from '../../menu/preferences.js'
import * as T from 'three'
import { marsSun, JEZERO, advanceSurfaceTime, nextMarsMorning, atLocalTime, MARS_SOL_SECONDS } from '../../sim/marsSun.js'
import { createSuitAudio } from './suit-audio.mjs'
import { AU } from '../../sim/constants.js'

const DEG = 180 / Math.PI
const smooth = T.MathUtils.smoothstep
// GAME ASSUMPTION: fixed demo epoch, initially 08:00 LMST. Clock is independent of resource sols.
const EPOCH = atLocalTime(Date.UTC(2026, 10, 14)/1000, 8*3600)

const skyVertex = `varying vec3 vDirection;
void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
// Dust colour and forward blue lobe are an artistic single-scattering approximation, not radiative transfer.
// Curiosity/Spirit: https://science.nasa.gov/resource/sunset-in-mars-gale-crater/
// https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/
const skyFragment = `
varying vec3 vDirection;
uniform vec3 sunDirection;
uniform float daylight, twilight, storm, sunRadius, dustTime;
float dustHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453);
}
float dustNoise(vec2 p) {
  vec2 tile=floor(p), blend=fract(p);
  blend=blend*blend*(3.0-2.0*blend);
  return mix(mix(dustHash(tile),dustHash(tile+vec2(1,0)),blend.x),
             mix(dustHash(tile+vec2(0,1)),dustHash(tile+1.0),blend.x),blend.y);
}
void main() {
  vec3 d = normalize(vDirection);
  float horizon = pow(1.0 - max(0.0,d.y), 3.0);
  vec3 night = mix(vec3(0.001,0.002,0.005), vec3(0.009,0.008,0.011), horizon);
  vec3 zenith = mix(vec3(0.32,0.18,0.115), vec3(0.34,0.18,0.11), storm);
  vec3 horizonColor = mix(vec3(0.67,0.40,0.25), vec3(0.66,0.34,0.17), storm);
  vec3 color = mix(night, mix(zenith,horizonColor,horizon), daylight);
  float alignment = dot(d,sunDirection);
  float forward = exp(-(1.0-alignment)*95.0);
  color += vec3(0.08,0.22,0.40) * forward * twilight * (1.0-storm*0.85);
  color += vec3(0.27,0.18,0.10) * pow(max(0.0,alignment),24.0) * daylight * (1.0-storm*.7);
  vec2 flow=d.xz*4.0+vec2(-dustTime*.14,dustTime*.03);
  float density=.65*dustNoise(flow+vec2(0.0,d.y*9.0))+.35*dustNoise(flow*2.3);
  float lowCloud=1.0-smoothstep(.035,.42,max(0.0,d.y));
  float wisps=storm*lowCloud*smoothstep(.25,.78,density);
  vec3 drift=mix(vec3(.57,.25,.11),vec3(.86,.49,.29),density);
  color=mix(color,drift,wisps*daylight*.94);
  float disc = smoothstep(cos(sunRadius*1.08),cos(sunRadius),alignment);
  float sunVisible = smoothstep(-0.015,0.0,sunDirection.y);
  color += mix(vec3(7.0,6.0,4.0),vec3(.12,.09,.05),storm)*disc*sunVisible;
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function createEnvironment(scene, camera, canvas) {
  let unixSeconds = EPOCH, warpIndex = 0, lastSol = 0, lastEmission = -Infinity, realTime = 0
  let solar = marsSun(unixSeconds), manualLamp = null, lampOn = false, storm = false, isFPS = false
  let paused = false
  let latestLifeSupport = null // IHAN-SRC: read-only vendor plant telemetry
  let latestState, activeTask = null, lastSnapshot = '', lastHUD = -Infinity
  const warps = [1,10,60]
  const abort = new AbortController()
  const {muted,master}=readMenuPreferences()
  const audio = createSuitAudio({muted,volume:master/100})
  const root = new T.Group(); root.name = 'Mars_environment'; scene.add(root)
  scene.add(camera)
  const skyRoot = new T.Group(); root.add(skyRoot)
  const uniforms = {
    sunDirection: { value: new T.Vector3() }, daylight: { value: 1 }, twilight: { value: 0 },
    storm: { value: 0 }, sunRadius: { value: .0031 }, dustTime: { value: 0 },
  }
  const sky = new T.Mesh(new T.SphereGeometry(44000,32,20), new T.ShaderMaterial({
    uniforms, vertexShader: skyVertex, fragmentShader: skyFragment,
    side: T.BackSide, depthWrite: false, fog: false,
  }))
  sky.renderOrder = -100; sky.frustumCulled = false; skyRoot.add(sky)
  const haze = new T.Color()
  const coolSun = new T.Color(0xf1f2ff), nightHaze = new T.Color().setRGB(.002,.003,.006), clearHaze = new T.Color(0xb28a6c), stormHaze = new T.Color(0xcf9369)
  scene.background = new T.Color(0x030408)
  scene.fog = new T.FogExp2(0x926c50,.00008)
  const ambient = new T.HemisphereLight(0xf6cba1,0x514137,1)
  const sun = new T.DirectionalLight(0xffedd8,2.8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024,1024)
  Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:220})
  sun.shadow.camera.updateProjectionMatrix(); sun.shadow.normalBias = .025; sun.shadow.bias = -.00012
  root.add(ambient,sun,sun.target)
  // Candela, inverse-square attenuation; only the directional sun casts a shadow.
  // GAME ASSUMPTION: warm-white suit lamp, 80 cd, 42 m rendering cutoff.
  const lamp = new T.SpotLight(0xffefd5,0,42,Math.PI/6,.55,2)
  lamp.name = 'Suit_headlamp'
  lamp.position.set(.18,-.10,-.06); lamp.target.position.set(0,-.12,-12)
  camera.add(lamp,lamp.target)

  // Seeded decorative stars, not an astrometric catalogue. Fixed, small GPU buffers.
  let seed = 431
  const random = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296 }
  const starPositions = [], starColors = []
  for(let i=0;i<1300;i++) {
    const y=random()*2-1, a=random()*Math.PI*2, r=Math.sqrt(1-y*y)
    starPositions.push(37000*r*Math.sin(a),37000*y,37000*r*Math.cos(a))
    const b=.3+random()**3*.7; starColors.push(b*.89,b*.94,b)
  }
  const starsGeometry=new T.BufferGeometry()
  starsGeometry.setAttribute('position',new T.Float32BufferAttribute(starPositions,3))
  starsGeometry.setAttribute('color',new T.Float32BufferAttribute(starColors,3))
  const stars=new T.Points(starsGeometry,new T.PointsMaterial({size:1.35,sizeAttenuation:false,
    vertexColors:true,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}))
  stars.renderOrder=-90; skyRoot.add(stars)
  const dustPositions = []
  for(let i=0;i<280;i++)dustPositions.push(random()*140,.30+random()**2*3.4,random()*140)
  const dustGeometry = new T.BufferGeometry()
  dustGeometry.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3))
  const dustUniforms={clock:{value:0},strength:{value:0},viewport:{value:720},tint:{value:new T.Color(0xdc9b6d)}}
  const dustPuffs = new T.Points(dustGeometry,new T.ShaderMaterial({
    uniforms:dustUniforms,transparent:true,depthWrite:false,fog:false,
    vertexShader:`
      uniform float clock, viewport;
      varying float plume, shape;
      void main(){
        vec3 p=position;
        p.x=cameraPosition.x+mod(p.x+clock*6.2-cameraPosition.x,140.0)-70.0;
        p.z=cameraPosition.z+mod(p.z+clock*2.1-cameraPosition.z,140.0)-70.0;
        p.y+=sin(position.x+clock*.7)*.36;
        vec4 view=modelViewMatrix*vec4(p,1.0);
        plume=(1.0-smoothstep(44.0,68.0,length(p.xz-cameraPosition.xz)))*smoothstep(1.7,9.0,-view.z);
        shape=fract(position.x*.731+position.z*.213);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(viewport*3.8/max(1.0,-view.z),2.0,125.0);
      }`,
    fragmentShader:`
      uniform float strength;
      uniform vec3 tint;
      varying float plume, shape;
      void main(){
        vec2 uv=(gl_PointCoord-.5)*2.0;
        float contour=length(vec2(uv.x,uv.y*1.8));
        contour+=sin(uv.x*8.0+shape*8.0)*.11+sin(uv.y*9.0-uv.x*4.0)*.06;
        float opacity=1.0-smoothstep(.08,.97,contour);
        gl_FragColor=vec4(tint,opacity*opacity*plume*strength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }))
  dustPuffs.name='Windblown Mars dust'
  dustPuffs.frustumCulled=false
  dustPuffs.visible=false
  root.add(dustPuffs)
  const earthGeometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0],3))
  const earth = new T.Points(earthGeometry,new T.PointsMaterial({color:0xaccfff,size:2.8,sizeAttenuation:false,fog:false,toneMapped:false}))
  earth.name='Earth_illustrative_elongation'; earth.renderOrder=-80; skyRoot.add(earth)
  const moons=[['Phobos',9376000,11266,.31891*86400,.4],['Deimos',23463000,6200,1.26244*86400,2.4]].map(([name,orbit,radius,period,phase])=>{
    // Mean orbits/radii: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
    // Circular equatorial approximation. Initial phases are GAME ASSUMPTION, not JPL ephemerides.
    // Deimos is unresolved from the surface; a small point preserves its visibility on laptop screens.
    const mesh=name==='Deimos'
      ? new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,0,0],3)),
        new T.PointsMaterial({color:0xb9ab95,size:1.5,sizeAttenuation:false,fog:false}))
      : new T.Mesh(new T.IcosahedronGeometry(1,1),new T.MeshBasicMaterial({color:0xb9ab95,fog:false}))
    mesh.name=name; mesh.renderOrder=-80; skyRoot.add(mesh)
    return {mesh,orbit,radius,period,phase}
  })
  const markers=new T.InstancedMesh(new T.BoxGeometry(.42,.12,.07),new T.MeshStandardMaterial({
    color:0xe4d5b0,emissive:0xffd18c,emissiveIntensity:0,roughness:.5}),128)
  markers.count=0; markers.frustumCulled=false; root.add(markers)
  const porch=new T.PointLight(0xffd7a1,0,13,2); root.add(porch)
  let hasPorch = false
  const pose=new T.Object3D()

  const style=document.createElement('style')
  style.textContent=`
    #surface-status{position:absolute;bottom:18px;right:18px;z-index:8;max-width:calc(100% - 28px);pointer-events:none;color:#ece5d8;font:12px/1.6 'Barlow','Segoe UI',sans-serif;letter-spacing:.035em;text-shadow:0 1px 3px #000}
    #surface-status .surface-readout{padding:7px 11px;border:1px solid #d8c2a833;border-radius:4px;background:#11171db8;backdrop-filter:blur(5px)}
    #surface-status small{display:block;font-size:10px;color:#bdc3c3}
    #surface-audio{pointer-events:auto;float:right;font:inherit;font-size:10px;padding:3px 7px;margin-top:4px;background:#11171dc9;color:#d3d5ce;border:1px solid #b1b7b733;border-radius:3px}
    #surface-visor{position:fixed;pointer-events:none;z-index:5;border-radius:13% / 19%;box-shadow:inset 0 0 35px 8px #080c1266,inset 0 -19px 12px -10px #0a0f17a8,inset 0 17px 12px -10px #0a0f1780;background:radial-gradient(ellipse at 17% 15%,#d6e7ed0a 0%,transparent 30%),linear-gradient(115deg,transparent 70%,#e3ecf003 74%,transparent 76%);border-top:3px solid #151e2770}
  `
  document.head.append(style)
  const hud=document.createElement('div'); hud.id='surface-status'
  const readout=document.createElement('div'); readout.className='surface-readout'
  const help=document.createElement('small'); help.textContent="[ / ] Time · L Light · Esc Settings"
  const button=document.createElement('button'); button.id='surface-audio'; button.type='button'
  button.textContent="Suit audio: "+(audio.enabled?"ON":"OFF"); button.setAttribute('aria-pressed',String(audio.enabled))
  hud.append(readout,help,button)
  const host=document.getElementById('scene-hud')
  ;(host || document.body).append(hud)
  if (!host) hud.style.position='fixed'
  const visor=document.createElement('div'); visor.id='surface-visor'; visor.setAttribute('aria-hidden','true'); document.body.append(visor)
  function alignHUD() {
    const r=canvas.getBoundingClientRect()
    Object.assign(visor.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'})
    if(!host) { hud.style.right=Math.max(10,innerWidth-r.right+16)+'px'; hud.style.bottom=Math.max(10,innerHeight-r.bottom+16)+'px' }
  }
  const observer=new ResizeObserver(alignHUD); observer.observe(canvas)
  window.addEventListener('scroll',alignHUD,{signal:abort.signal,passive:true}); window.addEventListener('resize',alignHUD,{signal:abort.signal})
  function toggleAudio() { const value=audio.toggle(); button.textContent="Suit audio: "+(value?"ON":"OFF"); button.setAttribute('aria-pressed',String(value)) }
  button.addEventListener('click',toggleAudio,{signal:abort.signal})
  document.addEventListener('keydown',event=>{
    if(paused || event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName) || event.target?.isContentEditable) return
    if(event.code==='KeyL') toggleLamp()

    if(event.code==='BracketRight' || event.code==='BracketLeft') {
      warpIndex=T.MathUtils.clamp(warpIndex+(event.code==='BracketRight'?1:-1),0,warps.length-1)
      event.preventDefault(); updateLighting(true); emit(true)
    }
  },{signal:abort.signal})

  function updateLighting(forceHUD=false) {
    solar=marsSun(unixSeconds)
    const elevation=solar.elevation*DEG, daylight=smooth(elevation,-9,18), night=1-smooth(elevation,-8,6)
    const direction=uniforms.sunDirection.value
    // World +X east, +Y up, −Z north.
    direction.set(Math.sin(solar.azimuth)*Math.cos(solar.elevation),Math.sin(solar.elevation),-Math.cos(solar.azimuth)*Math.cos(solar.elevation))
    uniforms.daylight.value=daylight; uniforms.twilight.value=Math.exp(-((elevation/9)**2))
    const dust=latestLifeSupport?.electrical?.opacity??Number(storm)
    uniforms.storm.value=dust
    uniforms.dustTime.value=realTime
    dustPuffs.visible=dust>.015
    dustUniforms.clock.value=realTime
    dustUniforms.viewport.value=canvas.height
    dustUniforms.strength.value=dust*T.MathUtils.lerp(.065,.55,daylight)
    // Solar radius at 1 AU ≈0.2666°; Mars' distance makes the diameter ~2/3 Earth's.
    // https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/
    uniforms.sunRadius.value=.2666/DEG*AU/solar.distance
    sun.intensity=T.MathUtils.lerp(2.8,1.55,dust)*smooth(elevation,-.7,12)
    sun.color.set(0xffe7c6).lerp(coolSun,1-smooth(elevation,0,12))
    // Keep the light/shadow topology fixed. Visibility changes rebuild every lit shader,
    // which stalls software WebGL when the detailed terrain enters dusk.
    // Real Mars night is ~starlight (.012). GAME ASSUMPTION: the overview/plan camera gets a faint
    // 'enhanced view' floor so the base stays readable; the astronaut's own eyes (FPS) stay realistic.
    ambient.intensity=(isFPS ? .012 : .09)+daylight*T.MathUtils.lerp(.85,1.24,dust)
    ambient.color.set(0xf3c9a2).lerp(stormHaze,dust*.23); ambient.groundColor.set(0x4d352a)
    haze.copy(clearHaze).lerp(stormHaze,dust).lerp(nightHaze,1-daylight)
    scene.fog.color.copy(haze); scene.fog.density=T.MathUtils.lerp(.000065,.015,dust*dust)
    stars.material.opacity=night*T.MathUtils.lerp(.9,.015,dust)
    // Sidereal rotation (88642.663 s) from NASA GISS Mars24 technical notes.
    stars.rotation.set(JEZERO.latitude-Math.PI/2,0,0)
    stars.rotateY(-(unixSeconds-EPOCH)*2*Math.PI/88642.663)
    // GAME ASSUMPTION: illustrative 35° evening/morning elongation, not an Earth ephemeris.
    const earthElevation=solar.elevation+.46
    const earthAzimuth=solar.azimuth+.34
    earth.position.set(Math.sin(earthAzimuth)*Math.cos(earthElevation),Math.sin(earthElevation),-Math.cos(earthAzimuth)*Math.cos(earthElevation)).multiplyScalar(35000)
    earth.visible=night>.15 && dust<.65 && earth.position.y>0
    const elapsed=unixSeconds-EPOCH
    const rotation=elapsed*2*Math.PI/88642.663
    for(const moon of moons) {
      const a=elapsed*2*Math.PI/moon.period+moon.phase-rotation
      const east=moon.orbit*Math.sin(a), radial=moon.orbit*Math.cos(a)
      const north=-radial*Math.sin(JEZERO.latitude), up=radial*Math.cos(JEZERO.latitude)-3389500
      const distance=Math.hypot(east,north,up)
      moon.mesh.position.set(east,up,-north).normalize().multiplyScalar(35000)
      moon.mesh.scale.setScalar(moon.mesh.isPoints?1:35000*moon.radius/distance)
      moon.mesh.visible=up>0 && !storm
      moon.mesh.material.color.setScalar(.12+daylight*.45+night*.28)
    }
    lampOn=manualLamp ?? elevation<4
    lamp.intensity=isFPS && lampOn ? 80 : 0
    markers.material.emissiveIntensity=night*2.6
    porch.intensity=hasPorch ? night*18 : 0
    visor.hidden=!isFPS
    const hours=solar.lmst/3600, hh=Math.floor(hours), mm=Math.floor(hours%1*60)
    // GAME ASSUMPTION: indicative −80…−20°C diurnal air cycle; not live Jezero weather.
    // Curiosity REMS observations: https://mars.nasa.gov/msl/mission/weather/
    const temperature=Math.round(-80+60*Math.max(0,Math.sin(solar.elevation))**.55)
    if(forceHUD || realTime-lastHUD>=.25) {
      lastHUD=realTime
      readout.textContent=`LMST ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} · ×${warps[warpIndex]} · Sun ${elevation.toFixed(1)}° · ${temperature} °C (estimated)`
      help.textContent=`Headlamp: ${lampOn?"ON":"OFF"}${manualLamp===null?" · AUTO":''} · [ / ] Time · L Light · M Audio`
    }
    updateLightingPose()
  }
  function updateLightingPose() {
    sun.position.copy(camera.position).addScaledVector(uniforms.sunDirection.value,100)
    sun.target.position.copy(camera.position)
    skyRoot.position.copy(camera.position)
  }
  function emit(force=false) {
    if(!latestState || (!force && realTime-lastEmission<.25)) return
    lastEmission=realTime
    // KOL contract: lmst is decimal Mars hours [0,24), elevation is degrees; state is unmodified İhan state.
    window.dispatchEvent(new CustomEvent('colony:state',{detail:{state:latestState,storm,activeTask,
      lifeSupport:latestLifeSupport, // IHAN-SRC: KERK / drawer integration
      lmst:solar.lmst/3600,headlamp:lampOn,audio:audio.enabled,sunElevationDeg:solar.elevation*DEG}}))
  }
  function toggleLamp(){manualLamp=!lampOn;updateLighting(true);emit(true)}
  updateLighting(); alignHUD()
  return {
    get telemetry() { return {lmst:solar.lmst/3600,headlamp:lampOn,sunElevationDeg:solar.elevation*DEG,warp:warps[warpIndex],unixSeconds,storm,audio:audio.enabled} },
    updateLightingPose,
    publish:emit,
    toggleAudio, toggleLamp,
    setPaused(value) { paused=value; audio.setActive(isFPS&&!paused) },
    setPeriod(period) {
      const target=atLocalTime(unixSeconds,period==='day'?12*3600:0);
      if((solar.elevation>0)===(period==='day')) return;
      unixSeconds=target>unixSeconds?target:target+MARS_SOL_SECONDS;
      updateLighting(true)
    },
    setLifeSupport(value) {
      const updateDust=paused&&value?.electrical?.opacity!==latestLifeSupport?.electrical?.opacity
      latestLifeSupport=value
      if(updateDust)updateLighting()
    }, // IHAN-SRC
    setFPS(value) { isFPS=value; audio.setActive(value&&!paused); updateLighting(true) },
    step(running) { audio.step(running) },
    sync(state,task) {
      latestState=state; activeTask=task; storm=Boolean(state.timeline.at(-1)?.storm)
      if(state.sol<lastSol) { unixSeconds=EPOCH; manualLamp=null; warpIndex=0 }
      else if(state.sol>lastSol) for(let i=lastSol;i<state.sol;i++) unixSeconds=nextMarsMorning(unixSeconds)
      lastSol=state.sol; updateLighting(true)
      const snapshot=JSON.stringify([state,task])
      if(snapshot!==lastSnapshot) { lastSnapshot=snapshot; emit(true) }
    },
    syncModules(modules) {
      const lit=modules.filter(item=>item.active && item.type!=='solarPanel')
      markers.count=Math.min(128,lit.length)
      for(let i=0;i<markers.count;i++) {
        const item=lit[i]; pose.position.set(item.x,item.y+Math.min(1.35,item.lightHeight??1.35),item.z+(item.halfZ??1.55)+.06); pose.scale.setScalar(1); pose.updateMatrix()
        markers.setMatrixAt(i,pose.matrix)
      }
      markers.instanceMatrix.needsUpdate=true
      const home=modules.find(item=>item.type==='habitat' && item.active)
      hasPorch=Boolean(home)
      if(home) porch.position.set(home.x,home.y+2,home.z+(home.halfZ??2.6)+.65)
      updateLighting()
    },
    reset() { unixSeconds=EPOCH; manualLamp=null; warpIndex=0; lastSol=0; updateLighting(true) },
    update(dt) { realTime+=dt; unixSeconds=advanceSurfaceTime(unixSeconds,dt,warps[warpIndex]); updateLighting(); audio.update(realTime) },
    dispose() {
      abort.abort(); observer.disconnect(); audio.dispose(); hud.remove(); visor.remove(); style.remove()
      camera.remove(lamp,lamp.target); sun.shadow.dispose(); root.removeFromParent()
      root.traverse(object=>{ object.geometry?.dispose(); for(const material of [object.material].flat()) material?.dispose() })
    },
  }
}
