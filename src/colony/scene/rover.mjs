// ROVER: Three.js adapter for the pure rover sim and the existing facility computer panel.
import * as T from 'three'
import { createRoverState, commandRover, stepRover, roverWheelKinematics, ROVER_STATIONS, ROVER_OBSTACLES,
  ROVER_TIME_COMPRESSION, ROVER_BATTERY_KWH, ROVER_DOCK_CHARGE_W, ROVER_HOME } from '../../sim/rover.js'

const MODES = { parked: "Parked", driving: "Driving", analyzing: "Analyzing", sampling: "Sampling" }
const number = (v, digits = 1) => v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits })
export const roverReadouts = s => [
  ["Charging station", s.docked ? `${number(s.chargingW??0,0)} W · connected` : "Waiting at base parking"],
  ["Mode / target", `${MODES[s.mode]} · ${s.target?.name ?? "Base parking"}`],
  ["Autopilot / campaign", `${s.autopilot ? "On" : "Paused"} · leg ${s.campaignLeg} · ${s.campaignPhase === 'charging' ? "MMRTG charging" : s.campaignPhase === 'returning' ? "Returning to base" : "Exploration"}`],
  ["Rover clock", "Rover time accelerated ×50"],
  ["Distance from base", `${number(s.distanceFromBaseM)} m`],
  ["Position (X / Z)", `${number(s.x)} / ${number(s.z)} m`],
  ["Speed / odometer", `${number(s.speedMps, 3)} m/s · ${number(s.odometerM)} m`],
  ["Battery / MMRTG", `${number(s.batteryKWh, 3)} kWh · %${number(s.batteryKWh / ROVER_BATTERY_KWH * 100, 0)} / 110 W`],
  ["Tubes / samples", `${s.tubesRemaining} / 43 · ${s.samples.length} rock samples · 5 witness tubes reserved`],
  ["Operation queue", s.instrumentQueue.join(' → ') || (s.mode === 'sampling' ? "Coring / sealing" : "Autonomous mission plan")],
  ["Latest measurement", s.measurements.at(-1)?.instrument ?? "No data yet"],
]

function labelSprite() {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 108
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
  const material = new T.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, transparent: true, sizeAttenuation: false })
  const sprite = new T.Sprite(material); sprite.scale.set(.32, .045, 1); sprite.renderOrder = 9; sprite.raycast = () => {}
  let previous = ''
  return { sprite, draw(s) {
    const text = `${MODES[s.mode]} · ${number(s.distanceFromBaseM,0)} m · ${s.target?.name ?? "Exploration"}`
    if (previous === text) return
    previous = text
    const g = canvas.getContext('2d'); g.clearRect(0, 0, 768, 108)
    g.fillStyle = 'rgba(6,19,29,.87)'; g.fillRect(0, 0, 768, 108)
    g.fillStyle = '#e7b25c'; g.fillRect(0, 0, 5, 108)
    g.font = '600 29px Barlow, Segoe UI, sans-serif'; g.fillText("PERSEVERANCE / AUTOPILOT · TIME ×50", 24, 35)
    g.fillStyle = '#f2ebe0'; g.font = '500 28px Barlow, Segoe UI, sans-serif'; g.fillText(text, 24, 79, 720)
    texture.needsUpdate = true
  }, dispose() { texture.dispose(); material.dispose(); sprite.removeFromParent() } }
}

function trail(scene, heightAt) {
  // GAME ASSUMPTION: shallow wheel imprints and sparse, low dust at the rover's very slow speed.
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 64
  const g = canvas.getContext('2d'); g.fillStyle = '#ffffff'
  for (let y = 0; y < 64; y += 10) { g.fillRect(2, y, 28, 4); g.fillRect(2, y, 3, 8); g.fillRect(27, y, 3, 8) }
  const texture = new T.CanvasTexture(canvas)
  const tracks = new T.InstancedMesh(new T.PlaneGeometry(.32, .62), new T.MeshStandardMaterial({ map: texture, color: 0x594334,
    transparent: true, opacity: .36, depthWrite: false, alphaTest: .02, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }), 512)
  tracks.count = 0; tracks.frustumCulled = false; tracks.receiveShadow = true; scene.add(tracks)
  const fades=new Float32Array(512), stampedAt=new Float32Array(512).fill(-Infinity)
  tracks.geometry.setAttribute('trackFade',new T.InstancedBufferAttribute(fades,1))
  tracks.material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float trackFade; varying float vTrackFade;\n'+shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTrackFade=trackFade;')
    shader.fragmentShader='varying float vTrackFade;\n'+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a *= vTrackFade;')
  }
  tracks.material.customProgramCacheKey=()=> 'rover-distance-fade-v1'
  const disc = document.createElement('canvas'); disc.width = disc.height = 64
  const ctx = disc.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.4, '#ffffff88'); gradient.addColorStop(1, '#ffffff00')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
  const soft = new T.CanvasTexture(disc), positions = new Float32Array(24 * 3).fill(-100)
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3))
  const dust = new T.Points(geometry, new T.PointsMaterial({ map: soft, color: 0xa98b6b, size: .18, transparent: true, opacity: .17, depthWrite: false }))
  dust.frustumCulled = false; scene.add(dust)
  const pose = new T.Object3D(), ages = new Float32Array(24).fill(10), origins = new Float32Array(24 * 3)
  let index = 0, mote = 0, lastDistance = 0
  return { softTexture: soft, update(dt, s) {
    if (s.odometerM - lastDistance >= .48) {
      lastDistance = s.odometerM
      for (let side = -1; side <= 1; side += 2) {
        const x = s.x + Math.cos(s.heading) * side * 1.04, z = s.z - Math.sin(s.heading) * side * 1.04
        pose.position.set(x, heightAt(x, z) + .012, z); pose.rotation.set(-Math.PI / 2, 0, s.heading); pose.updateMatrix()
        tracks.setMatrixAt(index, pose.matrix); index = (index + 1) % 512; tracks.count = Math.min(512, tracks.count + 1)
        stampedAt[(index+511)%512]=s.odometerM
        tracks.instanceMatrix.needsUpdate = true
        // GAME ASSUMPTION: three low puffs per side at the six wheel contact patches.
        for(const forward of [-1.1,0,1.1]) {
          const px=x+Math.sin(s.heading)*forward,pz=z+Math.cos(s.heading)*forward
          ages[mote] = 0; origins[mote * 3] = px; origins[mote * 3 + 1] = heightAt(px,pz)+.06; origins[mote * 3 + 2] = pz
          mote = (mote + 1) % 24
        }
      }
    }
    for (let i = 0; i < 24; i++) {
      ages[i] += dt; positions[i * 3] = origins[i * 3] + ages[i] * .14
      positions[i * 3 + 1] = ages[i] < 1.5 ? origins[i * 3 + 1] + Math.sin(ages[i] * 2) * .06 : -100
      positions[i * 3 + 2] = origins[i * 3 + 2]
    }
    geometry.attributes.position.needsUpdate = true
    for(let i=0;i<512;i++) fades[i]=Math.max(0,1-(s.odometerM-stampedAt[i])/80) // GAME ASSUMPTION: 80 m fade distance.
    tracks.geometry.attributes.trackFade.needsUpdate=true
  }, dispose() { for (const o of [tracks, dust]) { o.removeFromParent(); o.geometry.dispose(); o.material.dispose() }; texture.dispose(); soft.dispose() } }
}

export function createRover({ scene, reference, heightAt, focus, reserveEnergy=()=>0 }) {
  // Recover conservative rock keep-outs from the rendered, seeded terrain once.
  // The pure sim receives only numeric circles; it never imports Three.js or samples DOM state.
  const obstacles=ROVER_OBSTACLES.map(c=>[...c]), matrix=new T.Matrix4(), bounds=new T.Box3()
  scene.updateMatrixWorld(true)
  scene.traverse(part=>{
    if(!part.isInstancedMesh || part.geometry.type!=='IcosahedronGeometry' || part.material.metalness!==0) return
    part.geometry.computeBoundingBox()
    for(let i=0;i<part.count;i++) {
      part.getMatrixAt(i,matrix); matrix.premultiply(part.matrixWorld); bounds.copy(part.geometry.boundingBox).applyMatrix4(matrix)
      const x=(bounds.min.x+bounds.max.x)/2,z=(bounds.min.z+bounds.max.z)/2
      // GAME ASSUMPTION: avoid protruding rocks >25 cm, with 1.35 m rover footprint clearance.
      if(bounds.max.y-heightAt(x,z)>.25) obstacles.push([x,z,Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2+1.35])
    }
  })
  // Existing parking computer now overlooks a docking bay, without moving the rover home.
  const station=new T.Group();station.name='RoverChargingDock';scene.add(station);
  station.position.set(ROVER_HOME.x,heightAt(ROVER_HOME.x,ROVER_HOME.z),ROVER_HOME.z);
  const metal=new T.MeshStandardMaterial({color:0x56646b,metalness:.65,roughness:.52}),mark=new T.MeshStandardMaterial({color:0xc5a55c,roughness:.8});
  function dockBox(w,h,d,x,y,z,material){const o=new T.Mesh(new T.BoxGeometry(w,h,d),material);o.position.set(x,y,z);o.receiveShadow=true;station.add(o);return o;}
  for(const x of [-1.05,1.05])dockBox(.25,.035,3.2,x,.025,0,mark);
  for(const z of [-1.65,1.65])dockBox(2.6,.035,.12,0,.025,z,mark);
  dockBox(.48,1.2,.38,-1.7,.6,.8,metal);dockBox(.7,.08,.6,-1.7,.06,.8,metal);
  const dockLamp=new T.Mesh(new T.SphereGeometry(.055,10,6),new T.MeshStandardMaterial({color:0xe4ad50,emissive:0xe4ad50,emissiveIntensity:1}));dockLamp.position.set(-1.7,1.23,.8);station.add(dockLamp);
  const dockLead=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-1.7,.9,.8),new T.Vector3(-1.4,.45,.65),new T.Vector3(-1.2,.55,.2)]),16,.035,6,false),metal);station.add(dockLead);
  const chargingLine=document.createElement('canvas');chargingLine.width=256;chargingLine.height=96;const gc=chargingLine.getContext('2d');gc.fillStyle='#10232a';gc.fillRect(0,0,256,96);gc.fillStyle='#b5edd5';gc.font='bold 23px sans-serif';gc.fillText("ROVER / CHARGING",18,37);gc.font='19px sans-serif';gc.fillText('250 W - E: TABLET',18,72);const dockTexture=new T.CanvasTexture(chargingLine);dockTexture.colorSpace=T.SRGBColorSpace;const plate=new T.Mesh(new T.PlaneGeometry(.55,.21),new T.MeshBasicMaterial({map:dockTexture}));plate.position.set(-1.7,.99,1.0);station.add(plate);
  const state = createRoverState(2026,{obstacles}), label = labelSprite(), tracks = trail(scene, heightAt), wheels=[]
  scene.add(label.sprite)
  const style = document.createElement('style')
  style.textContent = `.rover-controls{display:grid;gap:8px}.rover-controls label{font-size:12px;color:#a9babe}.rover-controls select{width:100%;padding:9px;color:#f2ebe0;background:#0b1f29;border:1px solid #aac7d35c;font:inherit}.rover-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.rover-actions button{padding:9px;background:#0b1f29;border:1px solid #aac7d34d;color:#eef5f2;font:inherit;font-size:13px;cursor:pointer}.rover-actions button:first-child{border-color:#e7b25c;color:#e7b25c}.rover-actions button:disabled{opacity:.38;cursor:default}.rover-results{border-top:1px solid #aac7d333;margin-top:12px;padding-top:10px}.rover-results h3{font-size:12px;letter-spacing:.08em;color:#e7b25c;margin:8px 0}.rover-results p{font-size:12px;line-height:1.45;margin:7px 0;color:#a9babe}.rover-results ol{padding-left:19px;max-height:210px;overflow:auto}.rover-results li{font-size:12px;line-height:1.45;margin:10px 0;color:#dce9e5}.rover-results b{color:#e7b25c}`
  document.head.append(style)
  const flash = new T.Sprite(new T.SpriteMaterial({ map: tracks.softTexture, color: 0xff8058, transparent: true, opacity: .8, blending: T.AdditiveBlending, depthWrite: false }))
  flash.scale.setScalar(.06); flash.visible = false; scene.add(flash)
  // Four survey markers, two instanced draws. No extra lights or runtime light topology changes.
  const markers = new T.InstancedMesh(new T.RingGeometry(.7, .76, 32), new T.MeshBasicMaterial({ color: 0xc69b61, transparent: true, opacity: .6, side: T.DoubleSide }), ROVER_STATIONS.length)
  const posts = new T.InstancedMesh(new T.CylinderGeometry(.025, .025, .7, 6), new T.MeshStandardMaterial({ color: 0xd0bb90, roughness: .85 }), ROVER_STATIONS.length)
  const pose = new T.Object3D()
  for (let i = 0; i < ROVER_STATIONS.length; i++) {
    const s = ROVER_STATIONS[i], y = heightAt(s.x, s.z)
    pose.position.set(s.x, y + .02, s.z); pose.rotation.set(-Math.PI / 2, 0, 0); pose.updateMatrix(); markers.setMatrixAt(i, pose.matrix)
    pose.position.set(s.x + .9, y + .35, s.z); pose.rotation.set(0, 0, 0); pose.updateMatrix(); posts.setMatrixAt(i, pose.matrix)
  }
  scene.add(markers, posts)
  const routePositions = new Float32Array(128 * 3), routeGeometry = new T.BufferGeometry()
  routeGeometry.setAttribute('position', new T.BufferAttribute(routePositions, 3)); routeGeometry.setDrawRange(0, 0)
  const route = new T.Line(routeGeometry, new T.LineBasicMaterial({ color: 0x80b7aa, transparent: true, opacity: .36, depthWrite: false }))
  route.frustumCulled = false; scene.add(route)
  const mastPoint = new T.Vector3(), headBounds = new T.Box3()
  let mast = null, model = null, realTime = 0, lastEmission = -Infinity, lastLabelMode = '', lastResult = '', resultBox = null, controlsBox = null

  function drawRoute() {
    let count = 0
    for (const p of [state, ...state.path]) {
      if (count === 128) break
      routePositions[count * 3] = p.x; routePositions[count * 3 + 1] = heightAt(p.x, p.z) + .07; routePositions[count * 3 + 2] = p.z; count++
    }
    routeGeometry.setDrawRange(0, state.mode === 'driving' ? count : 0); routeGeometry.attributes.position.needsUpdate = true
  }
  function command(action, value) { const accepted = commandRover(state, action, value); drawRoute(); return accepted }
  function renderResults(box) {
    resultBox = box; box.classList.add('rover-results')
    const key = `${state.message}|${state.mode}|${state.measurements.length}|${state.samples.length}`
    if (controlsBox) {
      const toggle=controlsBox.querySelector('[data-rover-action="autopilot"]')
      toggle.textContent=state.autopilot?"Pause autopilot":"Resume autopilot"
      toggle.setAttribute('aria-pressed',String(state.autopilot))
    }
    if(controlsBox){const recall=controlsBox.querySelector('[data-rover-action="return"]');if(recall)recall.textContent=state.returnPlan?"Cancel recall to base":"Recall to base";}
    if (key === lastResult) return
    lastResult = key; box.replaceChildren()
    box.append(Object.assign(document.createElement('p'), { role: 'status', textContent: state.message }))
    box.append(Object.assign(document.createElement('h3'), { textContent: `SCIENCE ARCHIVE · ${state.measurements.length} MEASUREMENTS / ${state.samples.length} SAMPLES` }))
    const list = document.createElement('ol'); list.reversed = true
    for (let i = state.measurements.length - 1; i >= 0; i--) {
      const m = state.measurements[i], li = document.createElement('li'), title = document.createElement('b')
      title.textContent = `${m.instrument} · ${m.stationName}`; li.append(title, document.createElement('br'))
      let summary = m.summary
      if (m.instrument === 'MEDA') summary = `${number(m.values.pressurePa / 100, 2)} hPa · ${number(m.values.airTemperatureK - 273.15)} °C · ${number(m.values.windMps)} m/s · τ ${number(m.values.dustOpacity, 2)}`
      li.append(document.createTextNode(summary)); list.append(li)
    }
    box.append(list)
    if (state.samples.length) box.append(Object.assign(document.createElement('p'), { textContent: "Sealed tubes: " + state.samples.map(s => `#${String(s.tube).padStart(2, '0')} ${s.stationName}`).join(' · ') }))
  }
  const api = {
    get telemetry() { return state },
    command,
    bindModel(root) {
      model = root
      root.updateMatrixWorld(true)
      for(const name of ['LF','LM','LR','RF','RM','RR']) {
        const wheel=root.getObjectByName('Wheel_'+name)
        if(!wheel) continue
        const pivot=new T.Group(),spin=new T.Group(),point=new T.Vector3()
        wheel.getWorldPosition(point); reference.worldToLocal(point)
        pivot.name='Steering_'+name; pivot.position.copy(point); reference.add(pivot)
        spin.name='Axle_'+name; pivot.add(spin); spin.attach(wheel)
        wheels.push({pivot,spin,lateral:point.x,forward:point.z,corner:!name.endsWith('M')})
      }
      // Keep every wheel drawable at long range; no discrete distance visibility cutoff.
      root.traverse(part=>{if(part.isMesh) part.frustumCulled=false})
      const head = root.getObjectByName('head')
      if (head) {
        reference.updateMatrixWorld(true); headBounds.setFromObject(head); headBounds.getCenter(mastPoint); reference.worldToLocal(mastPoint)
        mast = new T.Group(); mast.name = 'Rover_mast_azimuth'; mast.position.copy(mastPoint); reference.add(mast); mast.attach(head)
      }
    },
    renderControls(box, on) {
      controlsBox = box; box.classList.add('rover-controls'); lastResult = ''
      const note=Object.assign(document.createElement('p'),{textContent:"Rover time is accelerated ×50. AutoNav follows the route; the science plan manages instruments and sampling automatically."})
      const actions = document.createElement('div'); actions.className = 'rover-actions'
      for (const [action, text] of [['autopilot', state.autopilot?"Pause autopilot":"Resume autopilot"], ['return', "Recall to base"]]) {
        const b = Object.assign(document.createElement('button'), { type: 'button', textContent: text }); b.dataset.roverAction = action
        on(b, 'click', () => {
          command(action==='return'&&state.returnPlan?'cancel-return':action)
          if (resultBox) renderResults(resultBox)
        }); actions.append(b)
      }
      box.append(actions);

    },
    renderResults,
    update(dt, warp, camera) {
      realTime += dt
      // GAME ASSUMPTION: fixed rover ×50 on top of colony warp. Every watt/second uses the same rover clock.
      const oldDistance=state.odometerM,oldHeading=state.heading,simDt=dt*warp*ROVER_TIME_COMPRESSION
      let remaining = simDt
      while (remaining > 1e-9) { const h = Math.min(.1, remaining);
        const atDock=state.mode==='parked'&&Math.hypot(state.x-ROVER_HOME.x,state.z-ROVER_HOME.z)<.7;
        const request=atDock?Math.min(Math.max(0,ROVER_BATTERY_KWH-state.batteryKWh),ROVER_DOCK_CHARGE_W*h/3600000):0;
        const energy=request>0?reserveEnergy(request):0;
        const beforeGrid=state.gridEnergyKWh??0;stepRover(state,h,{dockPowerW:h?energy*3600000/h:0});const delivered=(state.gridEnergyKWh??0)-beforeGrid;if(energy>delivered)reserveEnergy(delivered-energy);remaining-=h }
      const travel=state.odometerM-oldDistance,yaw=state.heading-oldHeading
      for(const wheel of wheels) {
        const motion=roverWheelKinematics(travel,yaw,wheel.lateral,wheel.forward,wheel.corner)
        wheel.spin.rotation.x=(wheel.spin.rotation.x+motion.angularSpeedRadS)%(Math.PI*2)
        if(simDt>0) wheel.pivot.rotation.y=roverWheelKinematics(state.speedMps,state.yawRateRadS,wheel.lateral,wheel.forward,wheel.corner).steeringRad
      }
      dockLamp.material.color.set(state.chargingW>0?0x66dbb1:state.docked?0x75a9ce:0xe4ad50);dockLamp.material.emissive.copy(dockLamp.material.color);dockLead.visible=Boolean(state.docked);
      reference.position.set(state.x, heightAt(state.x, state.z), state.z)
      reference.rotation.order = 'YXZ'; reference.rotation.y = state.heading
      const sx = Math.sin(state.heading), sz = Math.cos(state.heading)
      reference.rotation.x = Math.atan2(heightAt(state.x - sx, state.z - sz) - heightAt(state.x + sx, state.z + sz), 2)
      reference.rotation.z = Math.atan2(heightAt(state.x + sz, state.z - sx) - heightAt(state.x - sz, state.z + sx), 2)
      if (mast) {
        const target = state.target, desired = state.mode === 'analyzing' && target ? Math.atan2(target.x + 1 - state.x, target.z + 2 - state.z) - state.heading : 0
        mast.rotation.y += Math.atan2(Math.sin(desired - mast.rotation.y), Math.cos(desired - mast.rotation.y)) * Math.min(1, dt * 2)
      }
      label.sprite.position.set(state.x, reference.position.y + 3.1, state.z)
      // GAME ASSUMPTION: keep distant banners from covering the base in the new arrival/overview views.
      label.sprite.visible = Boolean(model) && reference.visible && (!camera || reference.position.distanceTo(camera.position) < 45)
      if(state.mode!==lastLabelMode || dt===0) {label.draw(state);lastLabelMode=state.mode}
      flash.visible = Boolean(model) && reference.visible && state.mode === 'analyzing' && state.instrumentQueue[0] === 'SuperCam' && state.elapsedS % .6 < .06
      if (flash.visible) { if (mast) mast.getWorldPosition(flash.position); else flash.position.set(state.x, reference.position.y + 2, state.z) }
      tracks.update(dt, state)
      if (state.mode !== 'driving') routeGeometry.setDrawRange(0, 0)
      else { routePositions[0] = state.x; routePositions[1] = reference.position.y + .07; routePositions[2] = state.z; routeGeometry.attributes.position.needsUpdate = true }
      if (realTime - lastEmission >= .5) {
        lastEmission = realTime
        window.dispatchEvent(new CustomEvent('rover:state', { detail: structuredClone(state) }))
        label.draw(state)
        drawRoute()
      }
    },
    reset() { Object.assign(state, createRoverState(2026,{obstacles})); for(const w of wheels){w.spin.rotation.x=0;w.pivot.rotation.y=0}; drawRoute(); lastResult = '' },
    dispose() {
      station.removeFromParent();const owned=new Set();station.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.material){owned.add(o.material);if(o.material.map)owned.add(o.material.map)}});owned.forEach(r=>r.dispose());label.dispose(); tracks.dispose(); style.remove(); flash.removeFromParent(); flash.material.dispose()
      for (const o of [markers, posts, route]) { o.removeFromParent(); o.geometry.dispose(); o.material.dispose() }
    },
  }
  return api
}
