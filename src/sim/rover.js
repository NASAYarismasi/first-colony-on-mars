/** Perseverance surface operations. Pure, deterministic; distances/time in SI.
 * batteryKWh is the requested dashboard interchange unit (energy integration uses watts/seconds).
 */
import { ROVER_PARK, FACILITY_KEEPOUTS, PAD_KEEPOUTS } from '../data/colonyLayout.js'
// NASA/JPL: 152 m/h on hard flat ground, rounded down to 0.042 m/s.
// https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/
export const ROVER_MAX_SPEED_MPS = .042
// JPL mobility: 4.2 cm/s wheel speed (autonomous sensing runs while driving).
// https://robotics.jpl.nasa.gov/what-we-do/flight-projects/mars-2020-rover/m2020mobility/
// NASA: 52.5 cm diameter, six independently driven wheels, four corner steering actuators.
// https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/mars-2020-rover-gets-its-wheels/
export const ROVER_WHEEL_RADIUS_M = .525 / 2
// GAME ASSUMPTION: fixed rover clock multiplier; applied once by the render adapter, never to SI speed.
// ×50 → the real 0.042 m/s AutoNav pace shows as ~2.1 m/s, so a 270 m traverse takes ~2 real minutes.
export const ROVER_TIME_COMPRESSION = 50
// Team lead: no science next to the base — only out in the field.
export const ROVER_MIN_SCIENCE_RANGE_M = 100
// GAME ASSUMPTION: 10 m edge margin inside crater-ecosystem.mjs's 620 m square terrain.
// That terrain's analytic relief has < .02 rad slopes; rocks/facilities are supplied as keep-outs.
export const ROVER_WORLD_LIMIT_M = 300
// NASA/JPL: initial MMRTG output ~110 W; two 43 Ah batteries.
// https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/
export const ROVER_GENERATOR_W = 110
export const ROVER_BATTERY_AH = 2 * 43
// GAME ASSUMPTION: 28 V nominal conversion, usable full capacity, constant loads and turn rate.
export const ROVER_BATTERY_KWH = ROVER_BATTERY_AH * 28 / 1000
export const ROVER_LOAD_W = { parked: 80, driving: 230, analyzing: 180, sampling: 300 }
export const ROVER_TURN_RAD_S = .02 // GAME ASSUMPTION: pivot rate keeps even corner hub speeds below 0.042 m/s.
// NASA: 43 total tubes, including 5 witness tubes; reserve witnesses, only 38 can hold rock.
// https://www.jpl.nasa.gov/news/press_kits/mars_2020/launch/quick_facts/
export const ROVER_TUBES = 43
export const ROVER_WITNESS_TUBES = 5
export const ROVER_INSTRUMENTS = ['SuperCam', 'PIXL', 'SHERLOC', 'MEDA', 'RIMFAX']
// GAME ASSUMPTION: compact teaching sites, not surveyed Jezero locations; all synthetic values below.
export const ROVER_HOME = { id: 'base', name: "Base parking", ...ROVER_PARK }
export const ROVER_STATIONS = [
  { id: 'seitah', name: "Séítah · olivine", x: -26, z: 24, mineral: "Olivine + pyroxene; weak carbonate", elements: [17, 18, 20, 4, .4] },
  { id: 'delta', name: "Delta front", x: 33, z: 30, mineral: "Carbonate + silicate; evidence of water alteration", elements: [10, 7, 24, 12, 1.8] },
  { id: 'salts', name: "Saline regolith", x: 45, z: 12, mineral: "Sulfate-rich regolith; perchlorate candidate (not confirmed)", elements: [14, 6, 22, 7, 4.6] },
  { id: 'layers', name: "Delta layers", x: 42, z: -38, mineral: "Fine-grained silicate + carbonate", elements: [12, 9, 25, 8, 1.1] },
]
// GAME ASSUMPTION: crew keep-outs enlarged for rover footprint; centre dome + tunnels, lander, facilities.
export const ROVER_OBSTACLES = [...FACILITY_KEEPOUTS, ...PAD_KEEPOUTS.map(([x,z,r])=>[x,z,r+1.5])]
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z)
export function roverSegmentClear(a, b, obstacles = ROVER_OBSTACLES) {
  const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz
  return obstacles.every(([x, z, r]) => {
    const t = d2 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / d2)) : 0
    return Math.hypot(a.x + t * dx - x, a.z + t * dz - z) >= r - 1e-8
  })
}
/** Visibility graph around keep-out circles. Generated only when receiving a drive command. */
export function planRoverPath(a, b, obstacles = ROVER_OBSTACLES) {
  if (!roverInBounds(a) || !roverInBounds(b)) return []
  if (obstacles.length > 20) return gridPath(a, b, obstacles)
  if (!roverSegmentClear(a, a, obstacles) || !roverSegmentClear(b, b, obstacles)) return []
  if (roverSegmentClear(a, b, obstacles)) return [{ x: b.x, z: b.z }]
  const nodes = [{ x: a.x, z: a.z }, { x: b.x, z: b.z }]
  // GAME ASSUMPTION: 24 navigation vertices per circle, .6 m extra clearance.
  for (const [x, z, r] of obstacles) for (let i = 0; i < 24; i++) {
    const p = { x: x + (r + .6) * Math.cos(i * Math.PI / 12), z: z + (r + .6) * Math.sin(i * Math.PI / 12) }
    if (roverInBounds(p) && roverSegmentClear(p, p, obstacles)) nodes.push(p)
  }
  const costs = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set()
  costs[0] = 0
  while (visited.size < nodes.length) {
    let best = -1
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (best < 0 || costs[i] < costs[best])) best = i
    if (best < 0 || !Number.isFinite(costs[best])) break
    if (best === 1) {
      const path = []; for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i])
      return path
    }
    visited.add(best)
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && roverSegmentClear(nodes[best], nodes[i], obstacles)) {
      const cost = costs[best] + distance(nodes[best], nodes[i])
      if (cost < costs[i]) { costs[i] = cost; previous[i] = best }
    }
  }
  return [] // Never fall back to a straight line through hardware.
}

export const roverInBounds = p => Math.abs(p.x) <= ROVER_WORLD_LIMIT_M && Math.abs(p.z) <= ROVER_WORLD_LIMIT_M
const navigationCache = new WeakMap()
/** Spatially indexed A*: bounded memory, exact segment checks, no corner cutting.
 * GAME ASSUMPTION: 2 m grid, 8 m broad-phase buckets; paths are smoothed only with clear line of sight.
 */
function gridPath(a, b, obstacles) {
  let clear = navigationCache.get(obstacles)
  if (!clear) {
    const buckets = new Map(), key = (x, z) => `${x},${z}`
    for (const circle of obstacles) {
      const [x, z, r] = circle
      for (let i = Math.floor((x-r)/8); i <= Math.floor((x+r)/8); i++) for (let j = Math.floor((z-r)/8); j <= Math.floor((z+r)/8); j++) {
        const k = key(i, j); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(circle)
      }
    }
    clear = (p, q) => {
      const nearby = new Set()
      for (let i = Math.floor(Math.min(p.x,q.x)/8); i <= Math.floor(Math.max(p.x,q.x)/8); i++)
        for (let j = Math.floor(Math.min(p.z,q.z)/8); j <= Math.floor(Math.max(p.z,q.z)/8); j++)
          for (const c of buckets.get(key(i,j)) ?? []) nearby.add(c)
      return roverSegmentClear(p, q, [...nearby])
    }
    navigationCache.set(obstacles, clear)
  }
  if (!clear(a,a) || !clear(b,b)) return []
  if (clear(a,b)) return [{x:b.x,z:b.z}]
  const heap = [], costs = new Map(), previous = new Map(), closed = new Set()
  const key = p => `${p.x},${p.z}`
  function push(p, g, parent) {
    const k = key(p); if (g >= (costs.get(k) ?? Infinity)) return
    costs.set(k,g); previous.set(k,parent)
    const node = {p,g,f:g+distance(p,b)}; heap.push(node)
    let i = heap.length-1
    while (i) { const j = (i-1)>>1; if (heap[j].f <= node.f) break; heap[i]=heap[j]; i=j }; heap[i]=node
  }
  function pop() {
    const top=heap[0], last=heap.pop()
    if (heap.length) { let i=0; while (i*2+1<heap.length) { let j=i*2+1; if (j+1<heap.length && heap[j+1].f<heap[j].f) j++; if (heap[j].f>=last.f) break; heap[i]=heap[j]; i=j }; heap[i]=last }
    return top
  }
  for (let x=-2;x<=2;x++) for(let z=-2;z<=2;z++) {
    const p={x:Math.round(a.x/2)*2+x*2,z:Math.round(a.z/2)*2+z*2}
    if (roverInBounds(p) && clear(a,p)) push(p,distance(a,p),null)
  }
  while (heap.length) {
    const {p,g}=pop(), k=key(p); if(closed.has(k)) continue; closed.add(k)
    if (distance(p,b)<6 && clear(p,b)) {
      const route=[{x:b.x,z:b.z}]; let node=p
      while(node) { route.unshift(node); node=previous.get(key(node)) }
      const smooth=[]; let from=a, i=0
      while(i<route.length) { let end=route.length-1; while(end>i && !clear(from,route[end])) end--; smooth.push(route[end]); from=route[end]; i=end+1 }
      return smooth
    }
    for(let dx=-2;dx<=2;dx+=2) for(let dz=-2;dz<=2;dz+=2) {
      if(!dx&&!dz) continue
      const q={x:p.x+dx,z:p.z+dz}
      if(roverInBounds(q) && !closed.has(key(q)) && clear(p,q)) push(q,g+Math.hypot(dx,dz),p)
    }
  }
  return []
}

const stateObstacles = new WeakMap()
const obstaclesFor = s => stateObstacles.get(s) ?? ROVER_OBSTACLES

export function createRoverState(seed = 2026, { obstacles = ROVER_OBSTACLES } = {}) {
  const state = { x: ROVER_HOME.x, z: ROVER_HOME.z, heading: -.6, speedMps: 0, odometerM: 0,
    mode: 'parked', target: null, batteryKWh: ROVER_BATTERY_KWH, instrumentQueue: [],
    samples: [], measurements: [], tubesRemaining: ROVER_TUBES, witnessTubes: ROVER_WITNESS_TUBES,
    path: [], elapsedS: 0, operationRemainingS: 0, seed: seed >>> 0, message: "Starting autonomous exploration campaign.",
    autopilot: true, waypoint: null, distanceFromBaseM: 0, campaignLeg: 0, campaignPhase: 'exploring',
    wheelAngleRad: 0, wheelAngularSpeedRadS: 0, yawRateRadS: 0, steeringRad: 0,
    sciencePending: false, samplePending: false, returnRequested: false, timeCompression: ROVER_TIME_COMPRESSION }
  stateObstacles.set(state, obstacles)
  return state
}
const stationAt = state => ROVER_STATIONS.find(s => distance(state, s) <= 1) ?? (state.target && distance(state,state.target)<=1 ? state.target : null)
function driveTo(state, target) {
  const path = planRoverPath(state, target, obstaclesFor(state))
  if (!path.length) return false
  state.target = {...target}; state.waypoint = {...target}; state.path = path
  state.suspendedMode=null
  state.instrumentQueue.length=0; state.operationRemainingS=0; state.mode='driving'; state.speedMps=0
  state.message=`${target.name} safe route ready.`
  return true
}
/** Seeded expanding survey rings; radius stays within the finite terrain even at cardinal bearings. */
export function nextRoverWaypoint(state) {
  const leg = state.campaignLeg
  // GAME ASSUMPTION: far-field survey only — four spokes per ring at 150/210/270 m, seeded azimuth jitter.
  // The near stations stay as mineral 'context' for the synthetic measurements, never as targets.
  const index=leg, radius=Math.min(270,150+60*Math.floor(index/4))
  const angle=index*Math.PI/2+.2+(random(state)-.5)*.16
  const context=ROVER_STATIONS[index%ROVER_STATIONS.length]
  return {...context,id:`survey-${leg}`,name:`Exploration ${leg+1} · ${radius} m`,
    x:ROVER_HOME.x+Math.cos(angle)*radius,z:ROVER_HOME.z+Math.sin(angle)*radius}
}
function autopilot(state) {
  if (!state.autopilot) return
  // GAME ASSUMPTION: conservative detour/turn allowance plus 15% capacity reserve.
  const returnEnergy=(state.distanceFromBaseM*1.6/ROVER_MAX_SPEED_MPS+120)*
    (ROVER_LOAD_W.driving-ROVER_GENERATOR_W)/3600000 + ROVER_BATTERY_KWH*.15
  if (state.campaignPhase==='exploring' && (state.returnRequested || state.batteryKWh<Math.max(ROVER_BATTERY_KWH*.25,returnEnergy))) {
    state.sciencePending=false; state.samplePending=false; state.campaignPhase='returning'
    if (!driveTo(state,ROVER_HOME)) { state.mode='parked'; state.campaignPhase='charging' }
  }
  if (state.mode!=='parked') return
  if (state.campaignPhase==='returning') { state.campaignPhase='charging'; state.returnRequested=false }
  if (state.campaignPhase==='charging') {
    state.message="MMRTG charging; exploration will resume after recharge."
    if (state.batteryKWh<ROVER_BATTERY_KWH*.9) return // GAME ASSUMPTION: resume at 90%.
    state.campaignPhase='exploring'
  }
  if (state.sciencePending) {
    state.sciencePending=false; state.samplePending=state.campaignLeg%3===0
    commandRover(state,'analyze','all'); return
  }
  if (state.samplePending) {
    state.samplePending=false
    if (state.tubesRemaining>ROVER_WITNESS_TUBES) { commandRover(state,'sample'); return }
  }
  // Unreachable science sites are skipped deterministically (e.g. relocated facilities / rocks).
  for(let attempt=0;attempt<16;attempt++) {
    const target=nextRoverWaypoint(state); state.campaignLeg++
    if (driveTo(state,target)) { state.sciencePending=Math.hypot(target.x-ROVER_HOME.x,target.z-ROVER_HOME.z)>=ROVER_MIN_SCIENCE_RANGE_M; return }
  }
  state.message="Searching for a safe exploration target."
}
/** Commands mutate this isolated sim state. Returns false with a Turkish reason if rejected. */
export function commandRover(state, command, value) {
  const reject = message => { state.message = message; return false }
  if (command === 'autopilot') {
    state.autopilot = value ?? !state.autopilot
    if (!state.autopilot) { state.suspendedMode=state.mode; state.mode='parked'; state.speedMps=0 }
    else if(state.suspendedMode) { state.mode=state.suspendedMode; state.suspendedMode=null }
    state.message=state.autopilot?"Autopilot resumed.":"Autopilot paused."
    return true
  }
  if (command === 'park') {
    state.autopilot=false; state.sciencePending=false; state.samplePending=false
    state.mode = 'parked'; state.speedMps = 0; state.path.length = 0; state.instrumentQueue.length = 0
    state.operationRemainingS = 0; state.message = "Rover parked."; return true
  }
  if(command==='cancel-return'){
    const plan=state.returnPlan;if(!plan)return reject("No return-to-base command to cancel.");
    const target=plan.mode==='driving'?plan.target:{id:'resume-work',name:"Previous work site",x:plan.x,z:plan.z};
    if(target&&!driveTo(state,target))return reject("No safe route back to the previous task.");
    state.autopilot=plan.autopilot;state.campaignPhase=plan.campaignPhase;state.sciencePending=plan.sciencePending;state.samplePending=plan.samplePending;state.returnRequested=false;state.returnPlan=null;
    if(plan.mode==='analyzing'||plan.mode==='sampling'){state.resumeWork={...plan};state.autopilot=false;}
    else if(plan.resumeWork){state.resumeWork=plan.resumeWork;state.autopilot=false;}
    state.message="Return to base canceled; resuming previous task.";return true;
  }
  if (command === 'drive' || command === 'return') {
    const saved=command==='return'&&!state.returnPlan?structuredClone({x:state.x,z:state.z,mode:state.mode,target:state.target,autopilot:state.autopilot,campaignPhase:state.campaignPhase,sciencePending:state.sciencePending,samplePending:state.samplePending,instrumentQueue:state.instrumentQueue,operationRemainingS:state.operationRemainingS,resumeWork:state.resumeWork??null}):null;
    const target = command === 'return' ? ROVER_HOME : ROVER_STATIONS.find(s => s.id === value)
    if (!target) return reject("Select a valid science station.")
    if (!driveTo(state,target)) return reject("No safe route found.")
    if(command==='return') { if(saved)state.returnPlan=saved;state.autopilot=true; state.campaignPhase='returning'; state.sciencePending=false; state.samplePending=false }
    else state.autopilot=false // Legacy commands retained for integration; computer exposes autopilot only.
    return true
  }
  if (state.mode !== 'parked') return reject("Wait for driving or the current operation to finish / Park first.")
  if (!stationAt(state)) return reject("Drive to a science station for analysis and sampling.")
  if (state.batteryKWh < .05) return reject("Battery low; wait for MMRTG charging.") // GAME ASSUMPTION: reserve.
  if (command === 'analyze') {
    const instruments = value === 'all' ? ROVER_INSTRUMENTS : [value]
    if (instruments.some(i => !ROVER_INSTRUMENTS.includes(i))) return reject("Unknown instrument.")
    state.instrumentQueue = [...instruments]; state.mode = 'analyzing'
    state.operationRemainingS = 24 // GAME ASSUMPTION: compressed instrument acquisition time.
    state.message = "Science instruments collecting data."; return true
  }
  if (command === 'sample') {
    if (state.samples.length >= ROVER_TUBES - ROVER_WITNESS_TUBES) return reject("Rock sample tubes full; 5 witness tubes reserved.")
    state.mode = 'sampling'; state.operationRemainingS = 45 // GAME ASSUMPTION: compressed coring/sealing time.
    state.message = "Coring and sealing sample tube."; return true
  }
  return reject("Unknown rover command.")
}
function random(state) { state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0; return state.seed / 4294967296 }
const round = v => Math.round(v * 100) / 100
/** Synthetic teaching observations, informed by Mars 2020 publications, never live/archival instrument data.
 * Olivine/carbonate/sulfate context: https://ntrs.nasa.gov/citations/20220003568
 * Jezero salts & subsurface: https://ntrs.nasa.gov/api/citations/20230016431/downloads/Sun%20et%20al%202023%20JGR%20Planets%20Jezero%20Campaign.pdf
 * SHERLOC fluorescence is not uniquely organic: https://doi.org/10.1126/sciadv.adm8241
 * MEDA suite: https://science.nasa.gov/resource/meda-is-ready-weather-or-not/
 */
function measure(state, instrument, site) {
  const r = random(state), result = { id: state.measurements.length + 1, instrument, stationId: site.id,
    stationName: site.name, elapsedS: state.elapsedS, simulated: true, values: {}, summary: '' }
  // GAME ASSUMPTION: all abundances, weather, depths, spectral peak selection and organic candidates.
  if (instrument === 'SuperCam') {
    result.values = { ramanPeaksPerCm: site.id === 'seitah' ? [825, 850, 1085] : site.id === 'salts' ? [1010, 1085] : [1085, 1090] }
    result.summary = `LIBS/Raman: ${site.mineral}.`
  } else if (instrument === 'PIXL') {
    const elements = ['Fe', 'Mg', 'Si', 'Ca', 'S']
    elements.forEach((e, i) => { result.values[e] = round(site.elements[i] * (.96 + random(state) * .08)) })
    result.values.unit = 'wt%'; result.summary = elements.map(e => `${e} ${result.values[e]}%`).join(' · ') + " (remainder: O and other elements)"
  } else if (instrument === 'SHERLOC') {
    result.values = { organicsCandidate: r > .4, confirmedLife: false }
    result.summary = r > .4 ? "Fluorescence candidate; organic origin unconfirmed. Not evidence of life." : "Organic candidate signal below threshold; mineral fluorescence dominates."
  } else if (instrument === 'MEDA') {
    result.values = { pressurePa: round(600 + r * 150), airTemperatureK: round(205 + random(state) * 35), windMps: round(1 + random(state) * 9), dustOpacity: round(.25 + random(state) * .65) }
    result.summary = "Measured pressure, air temperature, wind and dust optical depth."
  } else {
    result.values = { layerDepthM: round(2 + r * 12), dipRad: round(.05 + random(state) * .3) }
    result.summary = `${result.values.layerDepthM} m deep layered reflector; not a confirmed ice detection.`
  }
  state.measurements.push(result)
  state.message = `${instrument} measurement recorded.`
}
/** Fixed sim step (caller uses <= .1 s). Warp changes elapsed simulation seconds, never speed limit. */
// GAME ASSUMPTION: dock charger maximum 250 W; colony adapter reserves the delivered energy.
export const ROVER_DOCK_CHARGE_W=250;
export function stepRover(state, dt, {dockPowerW=0}={}) {
  if (!Number.isFinite(dt) || dt < 0 || dt > .100001) throw new RangeError('Rover step must be 0…0.1 s')
  if(!Number.isFinite(dockPowerW)||dockPowerW<0)throw new RangeError('Invalid dock power');
  if (!dt) return state
  state.elapsedS += dt; state.speedMps = 0; state.yawRateRadS=0; state.wheelAngularSpeedRadS=0; state.steeringRad=0
  state.distanceFromBaseM=distance(state,ROVER_HOME)
  if (state.batteryKWh <= 0 && state.mode !== 'parked') {
    state.mode='parked'; state.path=[]; state.campaignPhase='charging'; state.sciencePending=false; state.samplePending=false
  }
  if(state.resumeWork&&state.mode==='parked'){
    const work=state.resumeWork;state.resumeWork=null;state.mode=work.mode;state.instrumentQueue=[...work.instrumentQueue];state.operationRemainingS=work.operationRemainingS;state.target=work.target;state.autopilot=work.autopilot;state.message="Resuming the interrupted task from where it stopped.";
  }
  if(state.returnPlan&&state.campaignPhase==='charging'&&state.distanceFromBaseM<.7)state.returnPlan=null;
  autopilot(state)
  const load = ROVER_LOAD_W[state.mode]
  state.batteryKWh = Math.max(0, Math.min(ROVER_BATTERY_KWH, state.batteryKWh + (ROVER_GENERATOR_W - load) * dt / 3600000))
  state.docked=state.mode==='parked'&&distance(state,ROVER_HOME)<.7;
  state.chargingW=0;
  if(state.docked&&dockPowerW>0){const energy=Math.min(ROVER_BATTERY_KWH-state.batteryKWh,Math.min(ROVER_DOCK_CHARGE_W,dockPowerW)*dt/3600000);state.batteryKWh+=energy;state.chargingW=energy*3600000/dt;state.gridEnergyKWh=(state.gridEnergyKWh??0)+energy;}
  if (state.mode === 'driving') {
    const next = state.path[0]
    if (!next) { state.mode = 'parked'; return state }
    const dx = next.x - state.x, dz = next.z - state.z, d = Math.hypot(dx, dz)
    if (d < 1e-8) { state.path.shift(); if (!state.path.length) { state.mode = 'parked'; state.message = "Destination reached. Select a science operation." }; return state }
    const desired = Math.atan2(dx, dz), error = Math.atan2(Math.sin(desired - state.heading), Math.cos(desired - state.heading))
    const turn = Math.min(Math.abs(error), ROVER_TURN_RAD_S * dt)
    state.heading += Math.sign(error) * turn
    state.yawRateRadS=Math.sign(error)*turn/dt
    state.steeringRad=state.yawRateRadS ? Math.PI/4*Math.sign(error) : 0 // GAME ASSUMPTION: status cue; actual corner angles use hub geometry.
    // Turn in place before translating; no corner cutting through keep-out circles.
    if (Math.abs(error) > 1e-8) return state
    const travel = Math.min(d, ROVER_MAX_SPEED_MPS * dt)
    state.x += dx / d * travel; state.z += dz / d * travel
    state.speedMps = travel / dt; state.odometerM += travel
    state.wheelAngularSpeedRadS=state.speedMps/ROVER_WHEEL_RADIUS_M
    state.wheelAngleRad=(state.wheelAngleRad+travel/ROVER_WHEEL_RADIUS_M)%(2*Math.PI)
    state.distanceFromBaseM=distance(state,ROVER_HOME)
  } else if (state.mode === 'analyzing' || state.mode === 'sampling') {
    state.operationRemainingS -= dt
    if (state.operationRemainingS <= 1e-8) {
      const site = stationAt(state)
      if (!site) { state.mode='parked'; state.operationRemainingS=0; return state }
      if (state.mode === 'sampling') {
        state.samples.push({ tube: state.samples.length + 1, stationId: site.id, stationName: site.name, elapsedS: state.elapsedS, sealed: true })
        state.tubesRemaining = ROVER_TUBES - state.samples.length; state.message = "Sample sealed."
      } else {
        measure(state, state.instrumentQueue.shift(), site)
        if (state.instrumentQueue.length) { state.operationRemainingS = 24; return state }
      }
      state.mode = 'parked'; state.operationRemainingS = 0
    }
  }
  return state
}

/** Rigid-body hub kinematics, SI: local +X right, +Z forward; four corner wheels steer.
 * Middle wheels are differential drive. Reverse wheel rotation avoids a 180° steering jump.
 */
export function roverWheelKinematics(speedMps, yawRateRadS, lateralM, forwardM, corner=true) {
  const forward=speedMps-yawRateRadS*lateralM, sideways=corner?yawRateRadS*forwardM:0
  let steeringRad=Math.atan2(sideways,forward), sign=1
  if (steeringRad>Math.PI/2) { steeringRad-=Math.PI; sign=-1 }
  if (steeringRad< -Math.PI/2) { steeringRad+=Math.PI; sign=-1 }
  return {steeringRad:corner?steeringRad:0, angularSpeedRadS:sign*Math.hypot(forward,sideways)/ROVER_WHEEL_RADIUS_M}
}
