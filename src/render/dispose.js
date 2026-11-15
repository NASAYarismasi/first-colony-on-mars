/** Dispose shared GLTF and scene resources once, including material texture slots. */
export function disposeScene(scene, disposeShared = false) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  scene.traverse(object => {
    if (object.geometry && (disposeShared || !object.geometry.userData.shared)) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && (disposeShared || !value.userData.shared)) textures.add(value);
      for (const uniform of Object.values(material.uniforms ?? {})) if (uniform.value?.isTexture && (disposeShared || !uniform.value.userData.shared)) textures.add(uniform.value);
    }
    object.shadow?.dispose();
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
  scene.clear();
}
