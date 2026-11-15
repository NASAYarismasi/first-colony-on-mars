import {createTransitPreview} from './transitPreview.js';
import {createWorldScene} from './worldScene.js';
import {createMapScene} from './mapScene.js';

export function createSceneManager(ctx) {
  let active=null;
  const scenes=new Map();
  function getScene(key) {
    if(!scenes.has(key)){
      const scene=key==='transit'?createTransitPreview():key==='map'?createMapScene():createWorldScene();
      scene.enter(ctx);
      scene.suspend?.();
      scenes.set(key,scene);
    }
    return scenes.get(key);
  }
  return {
    update(state,alpha) {
      const map=ctx.cameras.selected===5;
      const transit=!map&&['PARKING_ORBIT','TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT'].includes(state.current.phase);
      const key=transit?'transit':map?'map':'world';
      // Prepare both flight scenes during loading, before any orbital transition.
      getScene('world');
      getScene('transit');
      const next=getScene(key);
      if(active!==next){active?.suspend?.();active=next;}
      active.update(state,alpha);
      return active;
    },
    get active(){return active;},
    exit(){for(const scene of scenes.values())scene.exit();scenes.clear();active=null;}
  };
}
