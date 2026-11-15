import {COMMS_PAD} from '../../data/colonyLayout.js';
// Crew NPCs: astronauts the player is not controlling walk to real base installations and work there,
// with a label above the helmet saying what they are doing. Their task follows the role assigned in
// İhan's colony rules (İnşaat / Bakım / Üretim); with no role they rotate through routine EVA chores.
import * as T from 'three'

// Approach points next to each installation (metres, scene coordinates). Work durations are
// GAME ASSUMPTIONs for pacing; the chores themselves mirror real surface-ops concerns:
// dust on solar arrays (NASA Mars surface power), CO₂ scrubber filters, ice-drill wear, crop care.
export const CREW_SITES = {
  greenhouse: { x: 26.8, z: -.4, face: Math.PI, text: "Greenhouse plant care · nutrient solution measurement" },
  air: { x: 19, z: 9.6, face: Math.PI, text: "Air plant · CO₂ filter inspection" },
  water: { x: 64, z: -21.4, face: Math.PI, text: "Water plant · ice drill maintenance" },
  solar: { x: -40.5, z: 31, face: -Math.PI / 2, text: "Solar panels · dust cleaning" },
  pad: { x: 2, z: 20, face: 0, text: "Construction area · ground and cable survey" },
  rover: { x: 7.6, z: 17, face: -2.2, text: "Rover · sample container inspection" },
}
const ROLE_SITES = {
  production: ['greenhouse', 'air', 'water'],
  maintenance: ['solar', 'air', 'water'],
  construction: ['pad', 'solar'],
}
const ROUTINE = ['greenhouse', 'solar', 'air', 'rover', 'water', 'pad']
// Keep-out circles (x, z, radius) for walking: the whole dome+tunnel complex as one circle (three
// overlapping dome circles would send a detour from one dome into the next), lander, greenhouse, plants.
const OBSTACLES = [[COMMS_PAD.x,COMMS_PAD.z,COMMS_PAD.radius+.3], [0, 0, 14.5], [-18, -12, 6.6], [26, -12.6, 8.2], [19, 6, 3], [64, -26, 3.2]]
const WALK = 1.0 // m/s, suit-limited EVA walking pace (Apollo EVA traverses ≈ 1 m/s)

const STRIDE_HZ = .75 // steps per second per leg at 1 m/s; low gravity → long, slow strides

/** Jointed limbs of team-astronaut-walk.glb (origins at shoulder/hip). Re-read after model swaps. */
function limbs(actor) {
  const found = { armL: [], armR: [], legL: [], legR: [] }
  actor.traverse(o => { const m = /^Walk_(armL|armR|legL|legR)/.exec(o.name); if (m) found[m[1]].push({node:o,rest:o.quaternion.clone()}) })
  return found
}
const swingAxis = new T.Vector3(1,0,0)
const swingRotation = new T.Quaternion()
function swing(parts, leftArm, rightArm, leftLeg, rightLeg) {
  const angles={armL:leftArm,armR:rightArm,legL:leftLeg,legR:rightLeg}
  for(const [key,joints] of Object.entries(parts)){
    swingRotation.setFromAxisAngle(swingAxis,angles[key])
    for(const {node,rest} of joints)node.quaternion.copy(rest).multiply(swingRotation)
  }
}

/** Inserts a detour point when the straight segment a→b crosses a keep-out circle. Pure. */
export function planPath(a, b, depth = 0) {
  if (depth > 3) return [b]
  const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz || 1
  for (const [cx, cz, r] of OBSTACLES) {
    const t = Math.max(0, Math.min(1, ((cx - a.x) * dx + (cz - a.z) * dz) / length2))
    const px = a.x + dx * t, pz = a.z + dz * t
    if (Math.hypot(px - cx, pz - cz) >= r || t <= 0 || t >= 1) continue
    let ox = px - cx, oz = pz - cz, d = Math.hypot(ox, oz)
    if (d < 1e-3) { ox = -dz; oz = dx; d = Math.hypot(ox, oz) }
    const detour = { x: cx + ox / d * (r + 1.4), z: cz + oz / d * (r + 1.4) }
    return [...planPath(a, detour, depth + 1), ...planPath(detour, b, depth + 1)]
  }
  return [b]
}

/** Which installation an NPC goes to next. Pure: role from İhan's rules, else a routine rotation. */
export function nextSite(role, previous, index, visit) {
  const list = ROLE_SITES[role] ?? ROUTINE
  const start = (index * 2 + visit) % list.length
  for (let i = 0; i < list.length; i++) { const site = list[(start + i) % list.length]; if (site !== previous) return site }
  return list[0]
}

function makeLabel() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 112
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, sizeAttenuation: false }))
  // Fixed on-screen size (sizeAttenuation off) so the task stays readable from the overview camera.
  sprite.scale.set(.2, .035, 1); sprite.position.y = 2.35; sprite.renderOrder = 10
  sprite.raycast = () => {}
  let current = ''
  return { sprite, set(title, text) {
    const key = title + '|' + text
    if (key === current) return
    current = key
    const g = canvas.getContext('2d')
    g.clearRect(0, 0, 640, 112)
    g.fillStyle = 'rgba(8,16,22,.78)'; g.beginPath(); g.roundRect?.(4, 4, 632, 104, 14) ?? g.rect(4, 4, 632, 104); g.fill()
    g.fillStyle = '#7ce0c3'; g.fillRect(4, 4, 6, 104)
    g.font = '600 30px "Barlow", "Segoe UI", sans-serif'; g.fillStyle = '#9fe9d3'; g.fillText(title, 26, 44)
    g.font = '500 28px "Barlow", "Segoe UI", sans-serif'; g.fillStyle = '#f2ebe0'
    g.fillText(text.length > 40 ? text.slice(0, 39) + '…' : text, 26, 86)
    texture.needsUpdate = true
  }, dispose() { texture.dispose(); sprite.material.dispose() } }
}

function makeHeadlamp(actor) {
  const mount = new T.Group()
  mount.name = 'Crew helmet lamp'
  mount.position.set(0, 1.77, .19)
  const lamp = new T.SpotLight(0xffefd5, 0, 20, Math.PI / 7, .55, 2)
  lamp.target.position.set(0, -1.1, 4)
  const housing = new T.Mesh(new T.BoxGeometry(.14, .07, .09),
    new T.MeshStandardMaterial({color: 0x3e474b}))
  housing.raycast = () => {}
  const lens = new T.Mesh(new T.BoxGeometry(.105, .038, .012),
    new T.MeshBasicMaterial({color: 0x657078}))
  lens.position.z = .049
  lens.raycast = () => {}
  mount.add(lamp, lamp.target, housing, lens)
  actor.add(mount)
  return {
    mount,
    get on() { return lamp.intensity > 0 },
    update(equipped, night) {
      if (mount.parent !== actor) actor.add(mount)
      housing.visible = lens.visible = equipped
      lamp.intensity = equipped && night ? 34 : 0
      lens.material.color.setHex(lamp.intensity > 0 ? 0xfff0d1 : 0x657078)
    },
    dispose() {
      mount.removeFromParent()
      lamp.dispose()
      for (const part of [housing, lens]) { part.geometry.dispose(); part.material.dispose() }
    },
  }
}

export function createCrewAgents({ crewModels, groundY }) {
  const agents = new Map()
  for (const [index, actor] of crewModels) {
    const label = makeLabel(); actor.add(label.sprite)
    agents.set(index, { actor, label, headlamp: makeHeadlamp(actor), path: [], site: null, mode: 'idle', timer: 2 + index * 3, visit: 0, phase: index })
  }
  const target = new T.Vector3()
  return {
    /** dt in real seconds; `speed` lets the colony time warp hurry the crew a little (capped). */
    update(dt, { state, playerId, fpsActive, camera, night = false, speed = 1 }) {
      const step = dt * Math.min(Math.max(speed, 1), 8)
      state.crew.forEach((person, index) => {
        const agent = agents.get(index)
        if (!agent) return
        const { actor, label, headlamp } = agent
        headlamp.update(person.health > 0 && person.id !== playerId, night)
        // İhan's character loader clears the actor's children when the NASA suit GLB arrives.
        if (label.sprite.parent !== actor) {actor.add(label.sprite);agent.parts=null}if(!agent.parts||!agent.parts.armL.length)agent.parts=limbs(actor)
        actor.rotation.order = 'YXZ'
        const name = "Astronaut " + (index + 1)
        if (person.health <= 0) { label.sprite.visible = false; return }
        if (person.id === playerId) {
          // The player's body follows the camera in FPS so that switching astronaut keeps continuity.
          if (fpsActive) { actor.position.set(camera.position.x, groundY(camera.position.x, camera.position.z), camera.position.z); agent.mode = 'idle'; agent.path = [] }
          label.set(name + " · You", "You are in control")
          label.sprite.visible = !fpsActive
          return
        }
        label.sprite.visible = true
        agent.phase += step
        if (agent.mode === 'idle' || (agent.mode === 'working' && (agent.timer -= step) <= 0)) {
          agent.site = nextSite(person.role, agent.site, index, agent.visit++)
          const site = CREW_SITES[agent.site]
          agent.path = planPath({ x: actor.position.x, z: actor.position.z }, site)
          agent.mode = 'walking'
        }
        const site = CREW_SITES[agent.site]
        if (agent.mode === 'walking') {
          const next = agent.path[0]
          const dx = next.x - actor.position.x, dz = next.z - actor.position.z, d = Math.hypot(dx, dz)
          if (d < .15) {
            agent.path.shift()
            if (!agent.path.length) { agent.mode = 'working'; agent.timer = 35 + ((index * 17 + agent.visit * 11) % 40); actor.rotation.y = site.face }
          } else {
            const move = Math.min(d, WALK * step)
            actor.position.x += dx / d * move; actor.position.z += dz / d * move
            actor.rotation.y = Math.atan2(dx, dz)
          }
          actor.rotation.x = 0
          // Low-g gait: slow, slightly floaty steps (Mars g = 3.71 m/s²).
          const s=Math.sin(agent.phase*Math.PI*2*STRIDE_HZ);swing(agent.parts,s*.28,-s*.28,s*.42,-s*.42);actor.position.y=groundY(actor.position.x,actor.position.z)+Math.abs(s)*.045
          label.set(name + " · En route", site.text.split(' · ')[0] + " walking to")
        } else if (agent.mode === 'working') {
          // Slow lean in and out, as if inspecting/handling hardware at chest height.
          actor.position.y = groundY(actor.position.x, actor.position.z)
          actor.rotation.x=.06+Math.sin(agent.phase*1.3)*.04;const w=Math.sin(agent.phase*2.1);swing(agent.parts,-.85+w*.18,-.85-w*.18,0,0)
          label.set(name + (person.role ? ' · ' + { production: "Production", maintenance: "Maintenance", construction: "Construction" }[person.role] : ''), site.text)
        }
      })
    },
    get telemetry() {
      return [...agents].map(([index, a]) => ({ index, headlamp: a.headlamp.on, mode: a.mode, site: a.site, x: +a.actor.position.x.toFixed(2), z: +a.actor.position.z.toFixed(2) }))
    },
    dispose() { for (const a of agents.values()) { a.label.sprite.removeFromParent(); a.label.dispose(); a.headlamp.dispose() } },
  }
}
