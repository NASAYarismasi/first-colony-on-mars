import * as T from "three"
import area from "./jezero.json"

export const cell = 4
const material = color => new T.MeshStandardMaterial({ color, roughness: .78 })
const white = material(0xe4d1b9)
const dark = material(0x273642)
const gold = material(0xe5ad69)
const glass = material(0x447c83)
const blue = material(0x304e89)

export function terrainModel(scale = 1) {
  const { width, height, heights, spacingX, spacingZ } = area
  const geometry = new T.PlaneGeometry((width - 1) * spacingX * scale,
    (height - 1) * spacingZ * scale, width - 1, height - 1)
  geometry.rotateX(-Math.PI / 2)
  const values = heights.flat()
  const low = Math.min(...values)
  const range = Math.max(...values) - low
  const colors = []
  const position = geometry.attributes.position
  for (let index = 0; index < position.count; index++) {
    const meters = values[index] - low
    position.setY(index, meters * scale)
    const shade = new T.Color(0x753e35).lerp(new T.Color(0xca8361), meters / range)
    colors.push(shade.r, shade.g, shade.b)
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  mesh.name = "Jezero_MOLA"
  return mesh
}

/**
 * Regional context from the bundled MOLA sample, extended with a crater/delta silhouette.
 * https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
 * The sample spans 77.08–77.27 E, west of the landing site: this is regional morphology,
 * not a registered landing-site DEM. Rim/delta positions and meso-scale detail are GAME ASSUMPTION.
 * Jezero diameter ~45 km: https://science.nasa.gov/mars/exploration/jezero-crater/
 */
export function jezeroLandscape() {
  const size = 48000, segments = 160
  const geometry = new T.PlaneGeometry(size, size, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const points = geometry.attributes.position
  const colors = []
  const base = area.heights[12][12]
  for (let i = 0; i < points.count; i++) {
    // Align a central opening to the 300 m near-surface mesh; no overlapping terrain.
    let x = points.getX(i), z = points.getZ(i)
    if (Math.abs(x) === size / segments) x *= .5
    if (Math.abs(z) === size / segments) z *= .5
    points.setX(i, x); points.setZ(i, z)
    const r = Math.hypot(x, z)
    const u = T.MathUtils.clamp(x / 11000 + .5, 0, 1) * (area.width - 1)
    const v = T.MathUtils.clamp(z / 11000 + .5, 0, 1) * (area.height - 1)
    const ix = Math.min(area.width - 2, Math.floor(u)), iz = Math.min(area.height - 2, Math.floor(v))
    const a = T.MathUtils.lerp(area.heights[iz][ix], area.heights[iz][ix+1], u-ix)
    const b = T.MathUtils.lerp(area.heights[iz+1][ix], area.heights[iz+1][ix+1], u-ix)
    const mola = T.MathUtils.lerp(a, b, v-iz) - base
    const angle = Math.atan2(x, z)
    const ridge = Math.exp(-(((r - 19000 - 1300*Math.sin(angle*3)) / 1900)**2))
    const rim = ridge * (650 + 140*Math.sin(angle*17) + 75*Math.cos(angle*31))
    const deltaEdge = -1800 + 210*Math.sin(x*.0013) + 70*Math.sin(x*.004)
    const delta = 115 * T.MathUtils.smoothstep(deltaEdge-z, 0, 320) * Math.exp(-((x/3300)**4)) * Math.exp(-(((z+3000)/4000)**4))
    const blend = T.MathUtils.smoothstep(r, 220, 800)
    const y = -.12 + blend * (mola*.65 + rim + delta + 2.5*Math.sin(x*.006)*Math.cos(z*.004))
    points.setY(i, y)
    const shade = new T.Color(0x80604a).lerp(new T.Color(0xa77b5d), .5+.25*Math.sin(x*.0008)+.15*Math.cos(z*.0011))
    colors.push(shade.r, shade.g, shade.b)
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  const indices = geometry.index.array, outside = []
  for (let row = 0; row < segments; row++) for (let column = 0; column < segments; column++) {
    if (row >= segments/2-1 && row <= segments/2 && column >= segments/2-1 && column <= segments/2) continue
    const offset = (row*segments+column)*6
    outside.push(...indices.subarray(offset,offset+6))
  }
  geometry.setIndex(outside)
  geometry.computeVertexNormals()
  const landscape = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  landscape.name = 'Jezero_regional_context'
  landscape.receiveShadow = true
  return landscape
}

function part(group, geometry, surface, x, y, z) {
  const item = new T.Mesh(geometry, surface)
  item.position.set(x, y, z)
  group.add(item)
  return item
}

export function moduleModel(type) {
  const group = new T.Group()
  group.name = type
  const box = (w, h, d, surface, x, y, z) => part(group, new T.BoxGeometry(w,h,d), surface,x,y,z)
  const tube = (r, h, surface, x, y, z) => part(group, new T.CylinderGeometry(r,r,h,20),surface,x,y,z)
  if (type.endsWith("Pod")) {
    const tree = type === "treePod"
    const height = tree ? 2.25 : 1.04
    const soil = material(0x4e3024)
    const foliage = material(type === "beanPod" ? 0x76a653 : 0x3e7a43)
    const bubble = new T.MeshPhysicalMaterial({
      color: 0xcbe7e5, transparent: true, opacity: .24, depthWrite: false, roughness: .24,
    })
    box(tree ? 2.1 : 1.8, .26, tree ? 1.9 : 1.5, dark, 0, .13, 0)
    box(tree ? 1.9 : 1.62, .12, tree ? 1.7 : 1.32, soil, 0, .31, 0)
    const cover = part(group, new T.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), bubble, 0, .26, 0)
    cover.scale.set(tree ? 1.05 : .9, height, tree ? .95 : .75)
    cover.userData.noShadow = true
    const plants = new T.Group()
    plants.name = "plants"
    plants.position.y = .36
    group.add(plants)
    for (const x of tree ? [0] : [-.48, 0, .48]) {
      const stem = tree ? 1 : type === "beanPod" ? .52 : .24
      part(plants, new T.CylinderGeometry(.025, .065, stem, 8), soil, x, stem / 2, 0)
      for (const z of [-.19, .19]) {
        const leaf = part(plants, new T.IcosahedronGeometry(tree ? .48 : .17, 1), foliage, x, stem, z)
        leaf.scale.set(1, .7, 1)
      }
      if (tree) part(plants, new T.SphereGeometry(.085, 10, 8), material(0xc65138), x + .18, 1, .53)
    }
    return group
  }
  box(3.3,.16,3.1,dark,0,.08,0)
  switch (type) {
    case "habitat":
      tube(.9,2.5,white,0,1.05,0).rotation.z = Math.PI / 2
      tube(.43,.12,dark,1.31,1.04,0).rotation.z = Math.PI / 2
      for (const x of [-.7,0,.7]) box(.34,.32,.12,glass,x,1.28,.87)
      break
    case "solarPanel":
      tube(.13,1.15,white,0,.72,0)
      for (const x of [-.8,.8]) {
        box(1.53,.09,1.28,blue,x,1.3,0).rotation.x = -.42
        for (const z of [-.4,0,.4]) box(1.48,.04,.025,white,x,1.36+z*.44,z)
      }
      break
    case "battery":
      for (const x of [-.81,.81]) {
        box(1.39,1.0,1.62,gold,x,.66,0)
        box(.95,.1,.8,dark,x,1.19,.18)
      }
      break
    case "oxygenUnit":
    case "waterRecycler":
    case "airScrubber":
      box(2.45,.35,1.8,white,0,.32,0)
      for (const x of [-.65,.65]) tube(.4,1.43,type === "oxygenUnit" ? white :
        type === "airScrubber" ? dark : glass,x,1.16,0)
      box(2,.14,.24,gold,0,1.88,0)
      break
    case "greenhouse":
      box(2.95,.52,2.05,white,0,.38,0)
      part(group,new T.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI/2),glass,0,.63,0).scale.set(1.49,1.3,1.05)
      for (const x of [-.7,0,.7]) box(.08,.08,1.92,white,x,.67,0)
      break
  }
  return group
}
