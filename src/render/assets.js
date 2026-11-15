import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { canvasTexture, noiseTexture, seeded } from './primitives.js';
import { disposeScene } from './dispose.js';

/** Owns cached resources; scenes clone materials before changing them. */
export async function loadAssets(onProgress = () => {}) {
  const draco = new DRACOLoader().setDecoderPath('/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco), textureLoader = new THREE.TextureLoader();
  const assets = { models: {}, textures: {}, failures: [] }; let done = 0;
  await Promise.allSettled([
    ...['sls', 'orion', 'astronaut-seated'].map(async id => {
      try { assets.models[id] = (await loader.loadAsync(`/assets/${id}.glb`)).scene; }
      catch { assets.failures.push(id); }
      onProgress(++done, 8);
    }),
    ...['earth-day', 'earth-night', 'mars-color', 'stars', 'earth-florida-atlantic'].map(async id => {
      try {
        const t = await textureLoader.loadAsync(`/textures/${id}.jpg`);
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; assets.textures[id] = t;
      } catch { assets.failures.push(id); }
      onProgress(++done, 8);
    })
  ]);
  const rand = seeded(180);
  for (const id of ['earth-day', 'earth-night', 'mars-color', 'stars']) if (!assets.textures[id]) {
    assets.textures[id] = canvasTexture(1024, 512, (c, w, h) => {
      c.fillStyle = id === 'earth-day' ? '#143c62' : id === 'mars-color' ? '#a46c48' : '#000'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) {
        c.fillStyle = id === 'mars-color' ? `rgba(60,29,16,${rand() * .1})` : id === 'earth-day' ? `rgba(143,153,112,${rand() * .08})` : '#aabbd0';
        if (id === 'stars') c.fillRect(rand() * w, rand() * h, rand() < .05 ? 1 : .3, .7);
        else if (id !== 'earth-night') { c.beginPath(); c.ellipse(rand() * w, rand() * h, 1 + rand() * 20, 1 + rand() * 9, 0, 0, Math.PI * 2); c.fill(); }
      }
    });
  }
  if(!assets.textures['earth-florida-atlantic'])assets.textures['earth-florida-atlantic']=assets.textures['earth-day'];
  assets.textures.clouds = canvasTexture(2048, 1024, (c, w, h) => {
    const grid=Float32Array.from({length:2048},()=>rand()),pixels=c.createImageData(w,h);
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),sx=x-ix,sy=y-iy,u=sx*sx*(3-2*sx),v=sy*sy*(3-2*sy);const a=grid[(iy&31)*64+(ix&63)],b=grid[(iy&31)*64+((ix+1)&63)],d=grid[((iy+1)&31)*64+(ix&63)],e=grid[((iy+1)&31)*64+((ix+1)&63)];return (a+(b-a)*u)*(1-v)+(d+(e-d)*u)*v;};
    // Seeded multiscale weather-like filaments, not blurred circular stamps.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const n=noise(x/85,y/24)*.5+noise(x/31,y/15)*.28+noise(x/11,y/7)*.15+noise(x/4,y/3)*.07;
      const alpha=Math.round(Math.min(1,Math.max(0,(n-.54)*5))*255),i=(y*w+x)*4;
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=alpha;pixels.data[i+3]=255;
    }c.putImageData(pixels,0,0);
  }, false);
  assets.textures.earthDetail=noiseTexture('#858585',710);
  assets.textures.earthDetail.colorSpace=THREE.NoColorSpace;
  for (const t of Object.values(assets.textures)) t.userData.shared = true;
  for (const model of Object.values(assets.models)) model.traverse(m=>{
    if(m.geometry)m.geometry.userData.shared=true;
    for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])for(const t of Object.values(mat))if(t?.isTexture)t.userData.shared=true;
  });
  assets.dispose = () => {
    for (const model of Object.values(assets.models)) disposeScene(model,true);
    for (const texture of Object.values(assets.textures)) texture.dispose(); draco.dispose();
  };
  return assets;
}
