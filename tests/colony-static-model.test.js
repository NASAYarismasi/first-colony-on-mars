import { it, expect } from 'vitest';
import * as T from 'three';
import { batchStaticModel, prepareSurfaceMaterials } from '../src/colony/scene/static-model.mjs';
import { disposeScene } from '../src/render/dispose.js';

it('batches shared static materials while preserving world bounds and independent materials', () => {
  const root = new T.Group(); root.position.set(7,2,-4); root.scale.setScalar(.7);
  const material = new T.MeshStandardMaterial(), otherMaterial = new T.MeshStandardMaterial();
  const child = new T.Group(); child.rotation.y=.6; root.add(child);
  for(let i=0;i<8;i++) {
    const mesh = new T.Mesh(new T.BoxGeometry(1,2,3),i===7?otherMaterial:material);
    mesh.position.set(i, i*.2, -i); child.add(mesh);
  }
  root.updateMatrixWorld(true);
  const before = new T.Box3().setFromObject(root);
  batchStaticModel(root); root.updateMatrixWorld(true);
  const after = new T.Box3().setFromObject(root);
  expect(after.min.distanceTo(before.min)).toBeLessThan(1e-6);
  expect(after.max.distanceTo(before.max)).toBeLessThan(1e-6);
  const meshes=[]; root.traverse(o=>{if(o.isMesh)meshes.push(o);});
  expect(meshes).toHaveLength(2); expect(meshes.map(m=>m.material)).toContain(material);
  expect(meshes.map(m=>m.material)).toContain(otherMaterial);
  disposeScene(root);
});

it('replaces hardware lens transmission with one shared transparent surface material', () => {
  const root=new T.Group(), lens=new T.MeshPhysicalMaterial({transmission:1,roughness:.2});
  const metal=new T.MeshStandardMaterial({metalness:.8});
  root.add(new T.Mesh(new T.BoxGeometry(),lens),new T.Mesh(new T.BoxGeometry(),lens),new T.Mesh(new T.BoxGeometry(),metal));
  prepareSurfaceMaterials(root);
  expect(root.children[0].material).toBe(root.children[1].material);
  expect(root.children[0].material.isMeshPhysicalMaterial).toBeUndefined();
  expect(root.children[0].material.transparent).toBe(true);
  expect(root.children[0].material.opacity).toBeLessThan(1);
  expect(root.children[2].material).toBe(metal);
  disposeScene(root);
});
