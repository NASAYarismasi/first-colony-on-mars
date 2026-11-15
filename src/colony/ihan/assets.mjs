/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
export function prepareOvaRover(root) {
  // The source has three tiny transmitting lens materials. Screen-space refraction
  // renders the whole colony again; translucent glass preserves the distant lenses.
  const materials = new Set();
  root.traverse(part => {
    for (const material of [part.material].flat()) if (material) materials.add(material);
  });
  for (const material of materials) {
    if (!(material.transmission > 0)) continue;
    material.transmission = 0;
    material.transparent = true;
    material.opacity = .45; // GAME ASSUMPTION: inexpensive camera-lens appearance.
    material.depthWrite = false;
    material.needsUpdate = true;
  }
  return root;
}
