import {it,expect,vi} from 'vitest';
vi.mock('../src/render/worldScene.js',()=>({createWorldScene:()=>({kind:'world',enter(){},update(){},exit(){}})}));
vi.mock('../src/render/mapScene.js',()=>({createMapScene:()=>({kind:'map',enter(){},update(){},exit(){}})}));
vi.mock('../src/render/transitPreview.js',()=>({createTransitPreview:()=>({kind:'transit',enter(){},update(){},exit(){}})}));
import {createSceneManager} from '../src/render/sceneManager.js';
import {createCameras} from '../src/render/cameras.js';
it('retains 3D cinematic cruise; map requires explicit selection',()=>{const ctx={cameras:{selected:4}};const manager=createSceneManager(ctx),state={current:{phase:'CRUISE'}};expect(manager.update(state,1).kind).toBe('transit');ctx.cameras.selected=5;expect(manager.update(state,1).kind).toBe('map');manager.exit();const camera=createCameras(new EventTarget());camera.select(4);camera.update({phase:'CRUISE',events:[],stages:[],mars:false,missionTime:1,phaseTime:1,altitude:1e7,position:[0,0],theta:0},.016);expect(camera.effective).toBe(0);camera.dispose();});
