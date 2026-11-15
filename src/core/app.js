import {readMenuPreferences} from '../menu/preferences.js';
import { createScenario } from '../sim/scenarios.js';
import { createCountdown } from '../sim/countdown.js';
import { createDebris } from '../sim/debris.js';
import { createLoop, WARPS, SIM_DT } from './loop.js';
import { createInput } from './input.js';
import { createStore } from './store.js';
import { captureRenderState } from './renderState.js';
import { createAudio } from './audio.js';
import { loadAssets } from '../render/assets.js';
import { createRenderer } from '../render/renderer.js';
import { createCameras } from '../render/cameras.js';
import { createSceneManager } from '../render/sceneManager.js';
import { createHUD } from '../ui/hud.js';
import { createPacingDirector, createPacingPlan } from './pacing.js';

export async function bootstrap(){
  const entry=new URLSearchParams(window.location.search).get('bolum');
  const entryChapter=new Map([['kalkis','launch'],['transfer','transfer'],['inis','mars-orbit']]).get(entry);
  let mission=createScenario('launch'),countdown=createCountdown(),debris=createDebris(),trajectory=[],exhaustHistory=[],ready=false,chapter='launch';
  let previousState,currentState,manualTime=false,disposed=false,frameDelta=1/60,lastPhase='PRELAUNCH',fps=60,notice='';
  const ui={manual:false,help:false,about:false,watch:false,title:!entryChapter,notice:''},audio=createAudio(),store=createStore();
  const preferences=readMenuPreferences();
  audio.setVolume(preferences.master/100);
  if(preferences.muted)audio.toggleMute();
  const pacing=createPacingDirector(createPacingPlan());
  const snapshot=()=>({...captureRenderState(mission,countdown,debris),trajectory:[...trajectory],exhaust:exhaustHistory});
  const canManual=()=>['ASCENT','TMI_BURN','MOI_BURN'].includes(mission.state.phase);
  const commands={
    launch(){if(ready&&!loop.paused&&!ui.help&&!ui.about&&mission.state.phase==='PRELAUNCH') {if(ui.title)return commands.startChapter('launch');audio.start();countdown.start();sync();return true;}return false;},
    startChapter(name){
      if(!ready)return false;
      const next=createScenario(name);
      replaceMission(next,false);chapter=name;audio.start();
      if(name==='launch')countdown.start();
      sync();return true;
    },
    burn(){if(!loop.paused){audio.start();mission.burn();sync();}},
    pause(){if(ui.about)ui.about=false;else if(ui.help)ui.help=false;else loop.setPaused(!loop.paused);sync();},
    help(){ui.help=!ui.help;sync();},
    about(){ui.about=!ui.about;sync();},
    watch(){ui.watch=!ui.watch;sync();},
    camera(i){if(ready){cameras.select(i);sync();}},
    warp(direction=1){const start=direction>0?WARPS.findLastIndex(w=>w<=loop.warp):Math.max(0,WARPS.findIndex(w=>w>=loop.warp));for(let i=1;i<=WARPS.length;i++){const value=WARPS[(start+direction*i+WARPS.length*2)%WARPS.length];if(mission.setWarp(value)&&loop.setWarp(value))break;}pacing.setManual(loop.warp);sync();},
    automatic(){pacing.toggle(loop.warp);sync();},
    quality(value,adaptive){graphics.setQuality(value,adaptive);sync();},
    volume(value){audio.start();audio.setVolume(value);},mute(){audio.start();audio.toggleMute();sync();},
    reset(){replaceMission(createScenario('launch'),true);chapter='launch';sync();}
  };
  const hud=createHUD(commands,{showTitle:ui.title});
  const assets=await loadAssets((done,total)=>hud.progress(done,total));
  if(disposed){assets.dispose();return;}
  const graphics=createRenderer(document.getElementById('scene')),cameras=createCameras(graphics.canvas);
  const ctx={assets,cameras,frameDelta,quality:graphics.quality,height:graphics.height};
  const manager=createSceneManager(ctx);graphics.canvas.tabIndex=0;
  const input=createInput(window,action=>{
    if(!ready)return;
    const indices={outside:0,inside:1,ground:2,engine:3,director:4,map:5};
    if(action in indices)commands.camera(indices[action]);
    else if(action==='camera'){cameras.cycle();sync();}
    else if(action==='interact'||action==='stage'){if(mission.state.phase==='PRELAUNCH')commands.launch();else if(!loop.paused)mission.stage();}
    else if(action==='burn')commands.burn();else if(['pause','menu'].includes(action))commands.pause();
    else if(action==='help')commands.help();else if(action==='watch')commands.watch();
    else if(action==='mute')commands.mute();
    
    else if(action==='manual'&&canManual()){ui.manual=!ui.manual;if(!ui.manual)mission.setThrottle(1);sync();}
    else if(['fullThrottle','cutThrottle'].includes(action)&&canManual()&&ui.manual&&!loop.paused){mission.setThrottle(action==='fullThrottle'?1:0);sync();}
    else if(action==='fullscreen'){(document.fullscreenElement?document.exitFullscreen():document.querySelector('main').requestFullscreen()).catch(()=>{});}
  });
  function replaceMission(next,title){
    mission=next;countdown=createCountdown();debris=createDebris();trajectory=[];exhaustHistory=[];
    loop.reset();pacing.reset();input.keys.clear();audio.reset();
    Object.assign(ui,{manual:false,help:false,about:false,watch:false,title,notice:''});
    lastPhase=mission.state.phase;manager.exit();cameras.select(0);previousState=currentState=snapshot();
  }
  function release(id,side=0){
    const a=mission.state.ascent.state,[r,theta,vr,vt]=a.vector,angle=a.pitch-theta-Math.PI/2;
    const ox=id==='srbLeft'?-6.4:id==='srbRight'?6.4:0,oy=id.startsWith('srb')?27:id==='core'?33:94;
    const c=Math.cos(angle),s=Math.sin(angle),position=[r*Math.sin(theta)+ox*c-oy*s,r*Math.cos(theta)+ox*s+oy*c];
    const velocity=[vr*Math.sin(theta)+vt*Math.cos(theta),vr*Math.cos(theta)-vt*Math.sin(theta)];
    const ix=side*7,iy=id==='las'?22:id==='core'?-18:-5;debris.release(id,position,velocity,[ix*c-iy*s,ix*s+iy*c],angle,-side*.10+(id==='core'?.045:id==='las'?.06:0));
  }
  function updateTrajectory(){const s=mission.state,phase=s.phase;
    if(['ASCENT','PARKING_ORBIT','EDL','DEORBIT'].includes(phase)&&(trajectory.length===0||s.time-(trajectory.at(-1)[2]??0)>2)){
      if(phase==='ASCENT'){const[r,a]=s.ascent.state.vector;trajectory.push([r*Math.cos(a),r*Math.sin(a),s.time]);}
      else if(s.edl){const[r,a]=s.edl.state.vector;trajectory.push([r*Math.cos(a),r*Math.sin(a),s.time]);}
      else if(s.orbitState)trajectory.push([s.orbitState.position[0],s.orbitState.position[1],s.time]);
      if(trajectory.length>1000)trajectory.shift();
    }
  }
  const loop=createLoop({maxSteps:3000,getState:()=>mission.getTelemetry(),
    step(dt){previousState=currentState;
      if(mission.state.phase==='PRELAUNCH'){if(countdown.step(dt))mission.launch();}
      else{
        const a=mission.state.ascent.state,srb=a.vehicle.stages[0].attached,core=a.vehicle.stages[1].attached,las=a.lasAttached;
        if(ui.manual&&canManual()) {let value=mission.state.throttle;if(input.isDown('throttleUp'))value+=dt*.3;if(input.isDown('throttleDown'))value-=dt*.3;if(input.isDown('throttleUp')||input.isDown('throttleDown'))mission.setThrottle(value);}
        debris.step(dt);mission.step(dt);
        if(srb&&!a.vehicle.stages[0].attached){release('srbLeft',-1);release('srbRight',1);}
        if(core&&!a.vehicle.stages[1].attached)release('core');if(las&&!a.lasAttached)release('las');
      }
      if(mission.state.phase!==lastPhase){const phase=mission.state.phase;store.emit('phase',{previous:lastPhase,phase});if(phase==='MOI_BURN'&&cameras.selected===5)cameras.select(0);if(['DEORBIT','EDL'].includes(phase))trajectory=[];lastPhase=phase;ui.manual=false;}
      updateTrajectory();currentState=snapshot();
      const visualClock=currentState.missionTime+(currentState.phase==='PRELAUNCH'?countdown.state.time:0);
      if(visualClock-(exhaustHistory.at(-1)?.time??-100)>.2&&((currentState.phase==='ASCENT'&&currentState.stages[0].attached)||(countdown.state.running&&countdown.state.time>=-6.5))){
        exhaustHistory=[...exhaustHistory.filter(e=>e.time>visualClock-105),{time:visualClock,phase:currentState.phase,position:currentState.position,theta:currentState.theta,attitude:currentState.attitude,altitude:currentState.altitude}];currentState.exhaust=exhaustHistory;
      }
    },
    advanceCoast(seconds){previousState=currentState;const consumed=mission.advanceCoast(seconds);updateTrajectory();currentState=snapshot();return consumed;},
    render(alpha){if(!ready)return;currentState.warp=loop.warp;
      ctx.frameDelta=frameDelta;ctx.height=graphics.height;ctx.quality=graphics.quality;
      // Analytical coast samples already advance each RAF. Fixed-tick remainder
      // alpha would randomly rewind through that entire frame-sized coast.
      const coast=loop.warp>10&&!currentState.engineFiring&&!currentState.inAtmosphere;
      const active=manager.update({previous:{...previousState,titleScreen:ui.title},current:{...currentState,titleScreen:ui.title}},manualTime||coast?1:alpha);
      graphics.draw(active.scene,cameras.camera,currentState.missionTime,manualTime?0:frameDelta*1000);
      audio.update(currentState,cameras.effective,active.audioDistance??0);
      const display={...ui,pacing:{mode:pacing.mode,rate:loop.warp,targetRate:pacing.targetRate},warp:loop.warp,paused:loop.paused,camera:cameras.selected,cameraName:cameras.name,muted:audio.muted,quality:graphics.quality,pixelRatio:graphics.ratio,fps};
      hud.update(currentState,display);store.setState(currentState);
    }
  });
  function sync(){if(!ready)return;previousState=currentState=snapshot();loop.advance(0);}
  previousState=currentState=snapshot();ready=true;hud.ready(assets.failures);
  let landingCamDone=false;
  function direct(seconds){
    if(loop.paused||ui.title||manualTime)return;
    const choice=pacing.update(mission.getTelemetry(),seconds);
    if(pacing.mode!=='automatic')return;
    // Query the public API for an accepted discrete carrier. Interpolate only
    // inside that carrier's range; rejected rates gracefully fall back.
    const candidates=[...WARPS.filter(w=>w>=choice.rate),...WARPS.filter(w=>w<choice.rate).reverse()];
    const accepted=candidates.find(w=>mission.setWarp(w))??1;
    loop.setPlaybackRate(Math.min(choice.rate,accepted));
    if(choice.burn)mission.burn();
    // Cinematic flow: frame the final descent from the landing-site camera (dust plume, touchdown),
    // once per descent and only if the player is still on the default chase camera.
    const t=mission.getTelemetry();
    if(t.phase!=='EDL')landingCamDone=false;
    else if(!landingCamDone&&t.altitude<600){landingCamDone=true;if(cameras.selected===0)cameras.select(2);}
  }
  let previous=performance.now();graphics.renderer.setAnimationLoop(now=>{const elapsed=Math.max(0,(now-previous)/1000);frameDelta=Math.min(.1,Math.max(.001,elapsed));previous=now;fps=fps*.95+Math.min(120,1/Math.max(.001,elapsed))*.05;
    // Slice long browser frames so event anticipation sees intermediate states.
    if(manualTime||loop.paused)loop.advance(0);
    else {let left=Math.min(elapsed,.1);while(left>1e-9){const dt=Math.min(.05,left);direct(dt);left-=dt;loop.advance(dt,left<=1e-9);}if(!elapsed)loop.advance(0);}
  });
  window.advanceTime=ms=>{manualTime=true;loop.advance(ms/1000);while(!loop.paused&&loop.backlog+1e-12>=SIM_DT)loop.advance(0);};
  window.render_game_to_text=()=>JSON.stringify({ready,titleScreen:ui.title,chapter,watch:ui.watch,about:ui.about,phase:mission.state.phase,camera:cameras.name,cameraIndex:cameras.selected,paused:loop.paused,manualThrottle:ui.manual,help:ui.help,muted:audio.muted,quality:graphics.quality,warp:loop.warp,pacing:{mode:pacing.mode,rate:loop.warp,targetRate:pacing.targetRate},countdown:countdown.state,telemetry:currentState,renderedMissionTime:manager.active?.state?.missionTime,mapLayout:manager.active?.labelLayout,backlogSeconds:loop.backlog,performance:{fps:Math.round(fps),drawCalls:graphics.renderer.info.render.calls,triangles:graphics.renderer.info.render.triangles,...graphics.renderer.info.memory},coordinates:'SI metres; Y-up; floating origin at vehicle, radial tangent basis; maps use scaled distances'});
  // advanceTime intentionally bypasses the director and automatic burn commands;
  // it steps the currently selected playback rate and drains every fixed tick.
  // Command-only integration surface: no live sim state or phase/time setters.
  window.missionControl={...commands,resumeRealtime(){manualTime=false;previous=performance.now();}};
  function dispose(){if(disposed)return;disposed=true;ready=false;window.removeEventListener('pagehide',dispose);graphics.renderer.setAnimationLoop(null);input.dispose();manager.exit();cameras.dispose();graphics.dispose();assets.dispose();hud.dispose();store.dispose();audio.dispose();delete window.advanceTime;delete window.render_game_to_text;delete window.missionControl;}
  if(import.meta.hot)import.meta.hot.dispose(dispose);window.addEventListener('pagehide',dispose,{once:true});
  if(entryChapter)commands.startChapter(entryChapter);
  else loop.advance(0);
}
