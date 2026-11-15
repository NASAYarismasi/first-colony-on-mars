import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bootstrap } from '../src/core/app.js';

// Exercise the real HUD bindings, input, commands, fixed loop and mission in Node.
// Only hardware/browser presentation adapters are replaced; no browser is opened.
vi.mock('../src/render/assets.js',()=>({loadAssets:async()=>({failures:[],dispose(){}})}));
vi.mock('../src/core/audio.js',()=>({createAudio:()=>({setVolume:vi.fn(),start(){},reset(){},update(){},dispose(){},muted:true})}));
vi.mock('../src/render/renderer.js',()=>({createRenderer:()=>({
  canvas:{},height:720,quality:"Medium",ratio:1,draw(){},dispose(){},
  renderer:{setAnimationLoop(){},info:{render:{calls:0,triangles:0},memory:{}}}
})}));
vi.mock('../src/render/cameras.js',()=>({createCameras:()=>({
  selected:0,effective:0,name:"Follow",select(i){this.selected=i;},cycle(){this.selected=(this.selected+1)%6;},dispose(){}
})}));
vi.mock('../src/render/sceneManager.js',()=>({createSceneManager:()=>({
  active:null,update(pair){this.active={scene:{},state:pair.current};return this.active;},exit(){this.active=null;}
})}));
vi.mock('../src/ui/wristTerminal.js',()=>({mountWristTerminal:()=>({setRaised(){},dispose(){}})}));

class ElementStub extends EventTarget {
  constructor(id='') { super();this.id=id;this.textContent='';this.style={};this.dataset={};this.classList={toggle(){}}; }
  set innerHTML(value) {
    this.html=value;
    this.nodes=Object.fromEntries([...value.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,new ElementStub(id)]));
    this.cameras=Array.from({length:6},(_,i)=>{const node=new ElementStub();node.dataset.camera=String(i);return node;});
  }
  get innerHTML(){return this.html;}
  querySelectorAll(selector){return selector==='[id]'?Object.values(this.nodes):selector==='[data-camera]'?this.cameras:[];}
  setAttribute(){}
  replaceChildren(){}
  click(){this.dispatchEvent(new Event('click'));}
}

let root,storage;
const state=()=>JSON.parse(window.render_game_to_text());
const key=code=>{const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'code',{value:code});window.dispatchEvent(event);};
beforeEach(()=>{
  root=new ElementStub('hud');storage=new Map();
  const target=new EventTarget();target.location={search:'',href:'index.html'};
  vi.stubGlobal('window',target);vi.stubGlobal('location',target.location);
  vi.stubGlobal('document',{getElementById:id=>id==='hud'?root:new ElementStub(id)});
  vi.stubGlobal('sessionStorage',{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null,removeItem:k=>storage.delete(k)});
});
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();});

it('starts either flight chapter from the real title buttons and resets a running chapter to the title',async()=>{
  await bootstrap();
  expect(state().titleScreen).toBe(true);
  expect(root.nodes['start-btn'].disabled).toBe(false);
  expect(root.nodes['landing-chapter'].disabled).toBe(false);
  root.nodes['landing-chapter'].click();
  expect(state()).toMatchObject({chapter:'mars-orbit',titleScreen:false,phase:'MARS_ORBIT',warp:1,paused:false});
  expect(state().countdown.running).toBe(false);
  const met=state().telemetry.missionTime;
  window.advanceTime(1000);
  expect(state().telemetry.missionTime).toBeCloseTo(met+1,5);
  key('KeyB');
  expect(state().phase).toBe('DEORBIT');
  window.missionControl.pause();window.missionControl.watch();window.missionControl.camera(5);
  window.missionControl.reset();
  expect(state()).toMatchObject({titleScreen:true,phase:'PRELAUNCH',paused:false,watch:false,cameraIndex:0,warp:1,backlogSeconds:0});
  expect(state().telemetry.trajectory).toEqual([]);
  root.nodes['start-btn'].click();
  expect(state().titleScreen).toBe(false);
  expect(state().countdown.running).toBe(true);
  window.advanceTime(10020);
  expect(state().phase).toBe('ASCENT');
});

it('opens ?bolum=inis once, keeps reset on the title, and preserves the direct colony button behaviour',async()=>{
  window.location.search='?bolum=inis';
  await bootstrap();
  expect(state()).toMatchObject({chapter:'mars-orbit',titleScreen:false,phase:'MARS_ORBIT'});
  expect(root.innerHTML).toContain("<section id=\"launch-card\" aria-label=\"Main menu\" hidden>");
  expect(typeof window.missionControl.startChapter).toBe('function');
  expect(()=>window.missionControl.startChapter('invalid')).toThrow(RangeError);
  expect(state().phase).toBe('MARS_ORBIT');
  window.missionControl.reset();window.advanceTime(1000);
  expect(state().titleScreen).toBe(true);
  expect(state().telemetry.missionTime).toBe(0);
  window.missionControl.startChapter('launch');
  expect(state().countdown.running).toBe(true);
  window.missionControl.reset();
  sessionStorage.setItem('mars-ilk-koloni:landing','stale flight');
  root.nodes['colony-chapter'].click();
  expect(window.location.href).toBe('colony.html');
  expect(storage.has('mars-ilk-koloni:landing')).toBe(false);
});
