import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { findAnimatedObjects, batchStaticLeaves } from '../src/colony/scene/static-model.mjs';

const ctx = new Proxy({}, { get: (t, k) => k === 'getImageData' ? (x, y, w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) })
  : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(4 * w * h) }) : k === 'measureText' ? () => ({ width: 10 })
  : String(k).startsWith('create') ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
const element = () => ({ getContext: () => ctx, addEventListener() {}, removeEventListener() {}, style: {} });
beforeEach(() => vi.stubGlobal('document', { createElement: element, createElementNS: element, querySelectorAll: () => [], getElementById: () => null }));
afterEach(() => vi.unstubAllGlobals());

const meshes = root => { let n = 0; root.traverse(o => { if (o.isMesh) n++; }); return n; };

describe('static batching of İhan\'s facilities (host perf)', () => {
  it('detects moving parts by running the model API and restores every transform', () => {
    const root = new THREE.Group(), door = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const wall = new THREE.Mesh(new THREE.BoxGeometry(), door.material);
    root.add(door, wall);
    const animated = findAnimatedObjects(root, () => { door.position.x = 2; });
    expect([...animated]).toEqual([door]);
    expect(door.position.x).toBe(0);
  });

  it('keeps the greenhouse airlock doors and air-plant fans live while cutting draw calls', async () => {
    const { createGreenhouse } = await import('../src/colony/ihan/sera.mjs');
    const { createAirSystem } = await import('../src/colony/ihan/hava.mjs');
    const scene = new THREE.Scene();
    const greenhouse = createGreenhouse(scene), air = createAirSystem(scene, {});
    const keepG = findAnimatedObjects(greenhouse.group, () => { greenhouse.setAirlock(true, true, true); greenhouse.setNight(true); });
    greenhouse.setNight(false); greenhouse.setAirlock(false, false);
    const keepA = findAnimatedObjects(air.group, () => { air.update({ producer: true }); for (let i = 1; i < 4; i++) air.frame(i, .5); });
    expect(keepG.size).toBeGreaterThan(0); expect(keepA.size).toBeGreaterThan(0);
    const g = batchStaticLeaves(greenhouse.group, keepG), a = batchStaticLeaves(air.group, keepA);
    expect(g.after).toBeLessThan(g.before / 3); expect(a.after).toBeLessThan(a.before / 3);
    expect(meshes(greenhouse.group)).toBe(g.after);
    // The live parts are still attached and still respond to İhan's API.
    for (const o of keepG) expect(greenhouse.group.getObjectById(o.id)).toBe(o);
    greenhouse.setAirlock(true, true);
    expect(greenhouse.door.position.x).toBeCloseTo(-1.96);
    const fan = [...keepA][0], yaw = fan.rotation.y; air.update({ producer: true }); air.frame(5, 1);
    expect(fan.rotation.y).not.toBe(yaw);
  });
});
