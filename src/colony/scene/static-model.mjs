import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** Surface EVA never gets close enough to resolve hardware lens refraction.
 * glTF transmission on three tiny Perseverance lenses otherwise causes Three.js
 * to render the entire regolith/colony again into a transmission buffer.
 */
export function prepareSurfaceMaterials(root) {
  const materials = new Map()
  const convert = source => {
    if (!source.isMeshPhysicalMaterial) return source
    if (!materials.has(source)) {
      const material = new T.MeshStandardMaterial().copy(source)
      if (source.transmission > 0) {
        material.transparent = true; material.opacity = .28; material.depthWrite = false
        material.color.multiply(new T.Color(0x849ba3))
        material.forceSinglePass = true
      }
      materials.set(source, material)
    }
    return materials.get(source)
  }
  root.traverse(mesh => {
    if (mesh.isMesh) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material)
  })
  materials.forEach((_, source) => source.dispose())
  return root
}

/** Bake static NASA hardware into material batches, retaining its metre-scale silhouette.
 * Skinned/morph meshes are left intact. The returned root owns the new buffers.
 */
export function batchStaticModel(root) {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map()
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isSkinnedMesh || Array.isArray(mesh.material) ||
        Object.keys(mesh.geometry.morphAttributes).length) return
    const geometry = mesh.geometry
    const attributes = Object.keys(geometry.attributes).sort().map(name => {
      const attribute = geometry.attributes[name]
      return `${name}:${attribute.itemSize}:${attribute.normalized}`
    }).join(',')
    const key = `${mesh.material.uuid}/${Boolean(geometry.index)}/${attributes}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(mesh)
  })
  const retired = new Set()
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue
    const geometries = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(
      new T.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)))
    const geometry = mergeGeometries(geometries)
    geometries.forEach(part => part.dispose())
    if (!geometry) continue
    const batch = new T.Mesh(geometry, meshes[0].material)
    batch.name = 'Static_material_batch'
    batch.castShadow = batch.receiveShadow = true
    root.add(batch)
    for (const mesh of meshes) {
      // A static mesh can also be a transform parent for an unbatched part.
      for (const child of [...mesh.children]) root.attach(child)
      retired.add(mesh.geometry); mesh.removeFromParent()
    }
  }
  retired.forEach(geometry => geometry.dispose())
  return root
}

/** Runs `exercise()` (the model's own animation/door/night API) once and reports every object whose
 * local transform or visibility it changed. All transforms are restored afterwards, so the model is
 * left exactly as built. Measured, not guessed: whatever the teammate's code animates stays live.
 */
export function findAnimatedObjects(root, exercise) {
  const before = new Map()
  root.traverse(o => before.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]))
  exercise()
  const animated = new Set()
  for (const [o, [p, q, s, v]] of before) {
    if (!o.position.equals(p) || !o.quaternion.equals(q) || !o.scale.equals(s) || o.visible !== v) animated.add(o)
    o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); o.visible = v
  }
  root.updateMatrixWorld(true)
  return animated
}

/** Merges static LEAF meshes of `root` into one mesh per material (+ attribute layout).
 * Kept live: anything inside a `keep` subtree, instanced/skinned/morph meshes, meshes with children,
 * multi-material and hidden meshes. Materials stay shared, so emissive/colour changes still apply.
 * Returns { before, after } mesh counts.
 */
export function batchStaticLeaves(root, keep = new Set()) {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map()
  let before = 0
  const live = o => { for (let a = o; a; a = a.parent) { if (keep.has(a)) return true; if (a === root) break } return false }
  root.traverse(mesh => {
    if (!mesh.isMesh) return
    before++
    if (mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.children.length || !mesh.visible ||
        Array.isArray(mesh.material) || Object.keys(mesh.geometry.morphAttributes).length || live(mesh)) return
    const g = mesh.geometry
    const layout = Object.keys(g.attributes).sort().map(n => `${n}:${g.attributes[n].itemSize}:${g.attributes[n].normalized}`).join(',')
    const key = `${mesh.material.uuid}/${Boolean(g.index)}/${layout}/${mesh.castShadow}/${mesh.receiveShadow}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(mesh)
  })
  let merged = 0
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue
    const parts = meshes.map(m => m.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld)))
    const geometry = mergeGeometries(parts)
    parts.forEach(p => p.dispose())
    if (!geometry) continue
    const batch = new T.Mesh(geometry, meshes[0].material)
    batch.name = 'Static_leaf_batch'
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow
    root.add(batch)
    // Source geometries may be shared with live parts (kit caches), so they are not disposed here.
    for (const m of meshes) m.removeFromParent()
    merged += meshes.length - 1
  }
  return { before, after: before - merged }
}
