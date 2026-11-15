import * as T from 'three'
import { COMMS_PAD, COMMS_CABLE_ROUTE, beaconOnAt } from '../../data/colonyLayout.js'
import { batchStaticLeaves } from '../scene/static-model.mjs'

/** Host layout: İhan-style lattice hardware on its own regolith-anchored service pad.
 * GAME ASSUMPTION: all visual dimensions, relay direction and pointing rates; no RF simulation.
 * Procedural geometry/texture only; scene owner disposes geometry, materials and texture.
 */
export function createCommsStation(scene, heightAt) {
  const group = new T.Group(); group.name = 'Surface_comms_station'
  group.position.set(COMMS_PAD.x, heightAt(COMMS_PAD.x, COMMS_PAD.z), COMMS_PAD.z)
  scene.add(group)
  const steel = new T.MeshStandardMaterial({ color: 0x686056, metalness: .45, roughness: .58 })
  const seal = new T.MeshStandardMaterial({ color: 0xc0a688, roughness: .7 })
  const dark = new T.MeshStandardMaterial({ color: 0x23343e, roughness: .82 })
  const mark = new T.MeshStandardMaterial({ color: 0xd6a639, roughness: .7 })
  const part = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const rod = new T.CylinderGeometry(1, 1, 1, 6)
  const beam = (parent, a, b, radius, material = steel) => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start)
    const mesh = part(parent, rod, material); mesh.position.copy(start).add(end).multiplyScalar(.5)
    mesh.scale.set(radius, delta.length(), radius)
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()); return mesh
  }
  const ground = (x, z) => heightAt(COMMS_PAD.x + x, COMMS_PAD.z + z) - group.position.y
  const padGeometry = new T.CircleGeometry(COMMS_PAD.radius, 64).rotateX(-Math.PI / 2)
  const padPositions = padGeometry.attributes.position
  for (let i=0;i<padPositions.count;i++) padPositions.setY(i,ground(padPositions.getX(i),padPositions.getZ(i))+.012)
  padGeometry.computeVertexNormals()
  const apron = part(group,padGeometry,new T.MeshStandardMaterial({color:0x8f7154,roughness:1,
    transparent:true,opacity:.23,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}))
  apron.castShadow=false
  const corners = [[-.48, -.48], [.48, -.48], [.48, .48], [-.48, .48]]
  for (let bay = 0; bay < 10; bay++) for (let i = 0; i < 4; i++) {
    const [x, z] = corners[i], [nx, nz] = corners[(i + 1) % 4], y = bay * 1.25
    beam(group, [x, y, z], [x, y + 1.25, z], .042)
    beam(group, [x, y, z], [nx, y + 1.25, nz], .026)
    beam(group, [nx, y, nz], [x, y + 1.25, z], .026)
    beam(group, [x, y, z], [nx, y, nz], .032)
  }
  // Driven screw anchors with broad metal plates, no poured concrete.
  for (const [x, z] of [...corners, [-4.8, -3.5], [4.8, -3.5], [-4.8, 3.5], [4.8, 3.5]]) {
    const y = ground(x, z)
    part(group, new T.CylinderGeometry(.3, .36, .10, 8), steel, x, y + .035, z)
    beam(group, [x, y - .4, z], [x, y + .26, z], .085)
    if (Math.abs(x) > 1) {
      beam(group, [x, y + .2, z], [Math.sign(x) * .48, 9.5, Math.sign(z) * .48], .015)
      part(group, new T.BoxGeometry(.45, .12, .3), mark, x, y + .13, z)
    }
  }
  part(group, new T.BoxGeometry(1.8, 1.6, .95), seal, 2.5, ground(2.5, 1) + .95, 1)
  for (const x of [1.85, 3.15]) beam(group, [x, ground(x, 1), 1], [x, .4, 1], .08)
  for (let y = .65; y < 1.8; y += .16) part(group, new T.BoxGeometry(.8, .04, .035), dark, 2.5, y, 1.49)
  part(group, new T.BoxGeometry(.5, .18, .035), mark, 2.5, 2, 1.49)
  beam(group, [0, 8.2, 0], [1.3, 8.2, 0], .11)
  // Azimuth bearing + elevation yoke: paraboloid opens along local +Y.
  const azimuth = new T.Group(); azimuth.position.set(1.3, 8.2, 0); group.add(azimuth)
  part(azimuth, new T.CylinderGeometry(.28, .28, .42, 12), steel)
  const elevation = new T.Group(); elevation.position.y = .45; azimuth.add(elevation)
  for (const x of [-.6, .6]) beam(azimuth, [x, 0, 0], [x, .6, 0], .08)
  const profile = Array.from({ length: 17 }, (_, i) => { const r = i * 1.65 / 16; return new T.Vector2(r, r * r / 2.7) })
  const dish = part(elevation, new T.LatheGeometry(profile, 48), new T.MeshStandardMaterial({
    color: 0xd8ccb3, metalness: .48, roughness: .48, side: T.DoubleSide,
  }))
  dish.name = 'Steerable_high_gain_dish'
  part(elevation, new T.TorusGeometry(1.65, .045, 6, 48), steel, 0, profile.at(-1).y).rotation.x = Math.PI / 2
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3
    beam(elevation, [Math.cos(a) * 1.65, 1.01, Math.sin(a) * 1.65], [0, 1.75, 0], .023)
  }
  part(elevation, new T.CylinderGeometry(.13, .18, .28, 12), dark, 0, 1.75, 0)
  for (const x of [-.9, .9]) {
    beam(group, [0, 11.8, 0], [x, 11.8, 0], .045)
    beam(group, [x, 11.8, 0], [x, 13.7, 0], .018, seal)
    part(group, new T.CylinderGeometry(.055, .055, .3, 8), dark, x, 11.9, 0)
  }
  beam(group, [0, 12.5, 0], [0, 14.2, 0], .045)
  const red = new T.MeshStandardMaterial({ color: 0x6c0805, emissive: 0xff1708, emissiveIntensity: 8, toneMapped: false })
  const beacon = part(group, new T.SphereGeometry(.15, 12, 8), red, 0, 14.25, 0)
  beacon.name = 'Comms_red_obstruction_beacon'; beacon.castShadow = false
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.15, '#ffffffcc'); gradient.addColorStop(1, '#ffffff00')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64)
  const glow = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), color: 0xff1b09,
    blending: T.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false }))
  glow.position.copy(beacon.position); glow.scale.set(1.5, 1.5, 1); group.add(glow)
  // Buried service cables: render only the short terminal risers at either end.
  for(const offset of [0,.13])for(const [x,z] of [COMMS_CABLE_ROUTE[0],COMMS_CABLE_ROUTE.at(-1)]){
    const base=heightAt(x,z)-group.position.y;
    const path=new T.LineCurve3(new T.Vector3(x-COMMS_PAD.x,base-.15,z-COMMS_PAD.z+offset),new T.Vector3(x-COMMS_PAD.x,base+.55,z-COMMS_PAD.z+offset));
    part(group,new T.TubeGeometry(path,1,.045,6,false),dark);
  }
  const [endX, endZ] = COMMS_CABLE_ROUTE.at(-1)
  part(group, new T.BoxGeometry(.4, .5, .25), steel, endX-COMMS_PAD.x,
    heightAt(endX,endZ)-group.position.y+.55,endZ-COMMS_PAD.z)
  const retired = new Set(); group.traverse(o => { if (o.geometry) retired.add(o.geometry) })
  batchStaticLeaves(elevation); batchStaticLeaves(azimuth, new Set([elevation]))
  batchStaticLeaves(group, new Set([azimuth, beacon]))
  group.traverse(o => retired.delete(o.geometry)); retired.forEach(g => g.dispose())
  let seconds = 0, on = true
  const relay = new T.Vector3(-.45, .8, -.4).normalize()
  const target = new T.Vector3()
  const update = (dt, earthDirection) => {
    seconds += dt; on = beaconOnAt(seconds)
    red.emissiveIntensity = on ? 8 : .08; glow.material.opacity = on ? .95 : 0
    target.copy(earthDirection?.y > .26 ? earthDirection : relay)
    azimuth.rotation.y = Math.atan2(target.x, target.z)
    elevation.rotation.x = Math.acos(T.MathUtils.clamp(target.y, -1, 1))
  }
  update(0)
  return { group, update, get telemetry() { return { ...COMMS_PAD, beaconOn: on, beaconSeconds: seconds,
    target: "Track Earth above the horizon; otherwise use a representative relay", direction: target.toArray() } } }
}
