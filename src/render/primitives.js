import * as THREE from 'three';

export function material(color, roughness = .75, metalness = .15) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
export function mesh(parent, geometry, mat, position = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, mat); m.position.fromArray(position);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
export const box = (p, size, mat, pos) => mesh(p, new THREE.BoxGeometry(...size), mat, pos);
export const cylinder = (p, top, bottom, h, mat, pos, sides = 32) => mesh(p, new THREE.CylinderGeometry(top, bottom, h, sides), mat, pos);
export function beam(parent, a, b, width, mat) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), delta = vb.clone().sub(va);
  const m = cylinder(parent, width, width, delta.length(), mat, va.clone().add(vb).multiplyScalar(.5).toArray(), 6);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
export function canvasTexture(w, h, draw, color = true) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function seeded(seed = 52) { return () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296; }
export function noiseTexture(color, seed = 7) {
  const rand = seeded(seed);
  const texture = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = color; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 22000; i++) {
      c.fillStyle = rand() > .5 ? `rgba(0,0,0,${rand() * .17})` : `rgba(255,255,255,${rand() * .12})`;
      c.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(20, 20); return texture;
}
export function label(text, color = '#d4eaff', width = 320) {
  width=Math.ceil(text.length*16+32);
  const texture = canvasTexture(width, 64, c => {
    c.font = '500 26px monospace'; c.fillStyle = color;c.textAlign='center';c.fillText(text, width/2, 42);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(width / 20, 3.2, 1); return sprite;
}
