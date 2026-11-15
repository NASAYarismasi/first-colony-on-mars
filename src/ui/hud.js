import { G0, DAY, AU } from '../sim/constants.js';
import { SLS } from '../data/sls.js';
import { saveLandingPayload, clearLandingPayload } from '../colony/handoff.js';
import { landingSequence } from '../render/landingSequence.js';
import { apsisReadout, vehicleConfiguration, missionCalendar, missionElapsed, EVENT_CAPTIONS } from './presentation.js';
import { mountWristTerminal } from './wristTerminal.js';
import { flightWristData } from './wristData.js';
const CAMERAS=["Follow","Cabin / landing window","Ground tracking","Engine camera","Cinematic","Orbit map"];

export function formatMET(seconds){const t=Math.floor(Math.abs(seconds)+1e-6),days=Math.floor(t/DAY);return `${seconds<0?'T−':'T+'} ${days?`${days}d `:''}${String(Math.floor(t/3600)%24).padStart(2,'0')}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
const number=(n,d=1)=>Number.isFinite(n)?n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
// INIS: presentation only; callouts read SI telemetry and sim event times.
export function landingCallout(t) {
  if(t.phase==='LANDED')return '';
  if(t.phase!=='EDL')return '';
  const age=id=>{const e=t.events.find(e=>e.type===id);return e?t.missionTime-e.time:Infinity;};
  if(t.altitude<10)return "Awaiting touchdown · Descent engines nominal";
  if(t.altitude<30)return "Below 30 m · Surface dust · Landing site in sight";
  if(age('LEGS_DEPLOYED')<3)return "Altitude 1000 m · Deploying landing gear";
  if(age('LEGS_DEPLOYED')<7)return "Landing gear deployed · Locks confirmed";
  if(age('HEATSHIELD_JETTISON')<4)return "Heat shield jettisoned · Supersonic retropropulsion";
  if(t.engineFiring)return `Powered descent · Radar altitude ${number(t.altitude,0)} m`;
  return t.heatFlux>2000?"Atmospheric braking · Heat shield under load":"Mars atmospheric entry";
}
// END INIS callouts.

export function createHUD(commands,{showTitle=true}={}){
  const root=document.getElementById('hud');
  root.innerHTML=`
    <header class="topbar"><div class="identity"><span class="mission-mark">M<span>01</span></span><div><b>FIRST COLONY ON MARS</b><small>ARTEMIS / PIONEER CREW MISSION</small></div></div><div class="phase"><span class="live-dot"></span><span id="phase">Launch preparation</span></div><div class="clock"><small>Time spent in space</small><strong id="met">T+ 0 h 0 min 0 s</strong><div class="pacing-controls"><span id="playback-rate">Playback ×1 · automatic</span><button hidden id="auto-btn" title="R / Toggle cinematic pacing">Automatic pacing: ON</button><button hidden id="warp-btn" title="T / Manual speed · Hold for automatic pacing">×1</button></div></div></header>
    <div id="event-caption" role="status" aria-live="polite" hidden></div>
    <section class="telemetry instrument"><div class="section-label">FLIGHT TELEMETRY <span>LIVE</span></div><div class="main-value"><small id="alt-label">ALTITUDE</small><strong id="alt">0,0</strong><span id="alt-unit">km</span><div class="micro-line"></div></div><div class="main-value"><small id="velocity-label">SURFACE-RELATIVE SPEED</small><strong id="vel">0,00</strong><span>km/s</span></div><dl class="data-rows"><div><dt>Vertical speed</dt><dd id="vs">0 m/s</dd></div><div><dt>Mach</dt><dd id="mach">0,00</dd></div><div id="q-row"><dt>Dynamic pressure</dt><dd id="q">0 kPa</dd></div><div><dt>G load</dt><dd id="g">1,00 g</dd></div><div><dt>Flight path angle</dt><dd id="gamma">90°</dd></div></dl><div id="maxq" class="flag" hidden>MAX Q · AERODYNAMIC LOAD</div><div class="attitude"><div class="attitude-ring"><div id="horizon"></div><span>+</span></div><div><small>GUIDANCE</small><b id="guidance">AUTOPILOT</b><small id="thermal">GNC / NOMINAL</small></div></div></section>
    <section class="vehicle-panel instrument"><div class="section-label">VEHICLE SYSTEMS <span id="stage-name">SLS B1</span></div><div class="stack-layout"><div id="stack-drawing" class="stack-drawing"><i class="las"></i><i class="capsule"></i><i class="upper"></i><i class="core"></i><i class="booster left"></i><i class="booster right"></i><i class="engine"></i><i class="solar left"></i><i class="solar right"></i><i class="leg left"></i><i class="leg right"></i></div><div class="fuel-stack">${['icps','core','srb'].map(id=>`<div class="fuel" id="fuel-${id}"><div><b id="fuel-label-${id}">${id.toUpperCase()}</b><span id="fuel-value-${id}">100%</span></div><div class="bar"><i id="fuel-bar-${id}"></i></div><small id="fuel-status-${id}">ATTACHED</small></div>`).join('')}</div></div><div class="throttle"><span>THROTTLE</span><b id="throttle">100%</b><div class="bar"><i id="throttle-bar"></i></div></div><div class="engine-status"><span id="engine-label">RS-25 / 4</span><div>${Array.from({length:6},(_,i)=>`<i id="engine-${i}"></i>`).join('')}</div></div><div class="crew-status"><span>LIFE SUPPORT</span><b>03 / CREW</b><small id="supplies">O₂ · WATER · FOOD NOMINAL</small></div></section>
    <div class="view-caption"><span id="camera-name" hidden>01 / FOLLOW</span><small id="location">KENNEDY SPACE CENTER / LC-39B</small></div>
    <div id="map-legend" hidden><span class="legend-solid"></span>Actual trajectory <span class="legend-dashed"></span>Predicted orbit</div>
    <section id="launch-card" aria-label="Main menu"${showTitle?'':' hidden'}><div class="title-eyebrow">CREWED MARS MISSION / 01</div><h1>From Earth<br><em>To Mars</em></h1><p class="title-subtitle">FIRST COLONY ON MARS</p><div class="title-rule"></div><p class="title-intro">Three people. Two planets.<br>A new beginning, built together.</p>
      <!-- BOLUM: preserve the colony button ID and its existing handoff behaviour. -->
      <div class="title-actions"><button id="start-btn" disabled>Chapter 1 · Launch from Earth <span>↗</span></button><button id="landing-chapter" disabled>Chapter 2 · Mars landing <span>↗</span></button><button id="colony-chapter">Chapter 3 · Mars colony <span>↗</span></button><div class="title-utilities"><button id="title-controls">Controls <span>H</span></button><button id="about-btn">About / Sources <span>↗</span></button></div></div>
      <!-- END BOLUM. -->
      <span id="loading">Preparing NASA assets…</span><div class="title-team">EMRE · İHAN · SAMET <span>2026</span></div></section>
    <div id="about-overlay" class="overlay" hidden><section class="dialog"><small>BEHIND THE MISSION</small><h2>A first step inspired by science.</h2><p class="about-intro">First Colony on Mars · NASA Space Apps 2026<br>Space Mission Design · Mission design game</p><div class="team-cards"><p><b>Emre</b><span>Launch, flight and Mars landing</span></p><p><b>İhan</b><span>Colony and resource management</span></p><p><b>Samet</b><span>Integration, interface and demo</span></p></div><h3>Data and visual sources</h3><ul class="sources"><li><a href="https://ssd.jpl.nasa.gov/astro_par.html" target="_blank" rel="noopener">NASA / JPL</a> · Planets and astronomical constants</li><li><a href="https://ntrs.nasa.gov/citations/19770009539" target="_blank" rel="noopener">US Standard Atmosphere 1976</a> · Earth atmosphere model</li><li><a href="https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html" target="_blank" rel="noopener">NASA Glenn</a> · Mars atmosphere model</li><li><a href="https://ntrs.nasa.gov/citations/20160005782" target="_blank" rel="noopener">NASA Ames · Table 1</a> · Crew life support</li><li><a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noopener">NASA 3D Resources</a> · SLS, Orion and astronaut model</li><li>NASA Blue Marble / Black Marble · Earth surface and night lights</li><li>NASA / JPL / USGS Viking MDIM · Mars surface</li><li>NASA SVS / ESA Gaia · Star map; Barlow · OFL fonts</li></ul><p class="muted">Uses two-body orbits and a Hohmann transfer. The transit vehicle, crewed Mars lander and local terrain are game concepts. Full source and license records: ASSETS.md · docs/PHYSICS.md. No NASA endorsement is claimed.</p><button id="about-close">Return to main menu</button></section></div>
    <div id="countdown-banner" hidden><small>TERMINAL COUNTDOWN</small><strong id="countdown-number">10</strong><span id="countdown-status">CLEARED FOR LAUNCH</span></div>
    <div class="center-message" id="notice" role="status"></div><button id="colony-btn" class="mission-action colony-action" hidden>RETRY HANDOFF</button><button id="burn-btn" class="mission-action" hidden>B / START TRANSFER BURN ↗</button>
    <!-- INIS: pointer-transparent landing chapter fade; fallback remains clickable. -->
    <!-- END INIS landing chapter fade. -->
    <footer class="bottom"><div class="orbit-strip"><span>ORBIT SOLUTION</span><span><em id="ap-label">AP</em> <b id="apo">—</b> <small id="ap-unit">km</small></span><span><em id="pe-label">PE</em> <b id="peri">—</b> <small id="pe-unit">km</small></span><span id="extra-metric">LC-39B / 28,627° K</span></div><div class="timeline" id="timeline" hidden></div><nav class="camera-nav" aria-label="Cameras">${CAMERAS.map((name,i)=>`<button data-camera="${i}" title="${i+1} / ${name}"><kbd>${i+1}</kbd>${name}</button>`).join('')}<button id="watch-btn">TAB / TABLET</button><button id="help-btn" class="help-button">H / CONTROLS</button><button id="pause-btn" aria-label="Pause">Ⅱ</button></nav></footer>
    <div id="help-overlay" class="overlay" hidden><section class="dialog"><small>FLIGHT HANDBOOK</small><h2>The mission is in your hands.</h2><div class="help-grid"><p><kbd>Space / E</kbd>Countdown / safe stage separation</p><p><kbd>C / 1–6</kbd>Switch / select camera</p><p><kbd>Mouse / Wheel</kbd>Rotate / zoom follow camera</p><p><kbd>B</kbd>Start maneuver in parking orbit</p><p><kbd>, / . / T</kbd>Decrease / increase time speed</p><p><kbd>R</kbd>Toggle cinematic pacing</p><p><kbd>A</kbd>Manual throttle / autopilot</p><p><kbd>Shift / Ctrl · Z / X</kbd>Increase / decrease throttle · full / cut</p><p><kbd>M · F</kbd>Mute · tam ekran</p><p><kbd>Esc / P</kbd>Pause / resume</p><p><kbd>H</kbd>Toggle this guide</p><p><kbd>Q</kbd>Toggle wrist computer</p></div><p class="muted">Up to 10× in atmosphere and during burns. Autopilot is the default guidance mode; Mars landing is automatic.</p><button id="help-close">UNDERSTOOD / H</button></section></div>
    <div id="pause-overlay" class="overlay" hidden><section class="dialog pause-dialog"><small>MISSION ON HOLD</small><h2>Flight paused.</h2><label>Graphics quality<select id="quality"><option>Low</option><option selected>Medium</option><option>High</option></select></label><label class="check">Adaptive quality<input id="adaptive" type="checkbox" checked></label><label>Master volume<input id="volume" type="range" min="0" max="1" value=".4" step=".01"></label><button id="mute-btn">M / MUTE</button><div class="pause-actions"><button id="resume-btn">RESUME FLIGHT ↗</button><button id="reset-btn" class="secondary">RESET MISSION</button></div><p id="performance" class="muted"></p></section></div>
  `;
  const nodes=Object.fromEntries([...root.querySelectorAll('[id]')].map(n=>[n.id,n])),listeners=[];
  const on=(node,event,fn)=>{node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));};
  const bind=(id,fn)=>on(nodes[id],'click',fn);
  // INIS: every transition uses exactly the existing flight payload/storage contract.
  let latest=null,departing=false,landingViewQueued=false,handoffFailed=false;
  const handoff=()=>{
    if(departing||latest?.phase!=='LANDED'||!latest.landingPayload)return;
    let saved=false;
    try { saved=saveLandingPayload(latest.landingPayload); } catch { /* blocked session storage */ }
    if(!saved){handoffFailed=true;return;}
    handoffFailed=false;departing=true;location.href='colony.html';
  };
  bind('colony-btn',handoff);
  on(window,'keydown',event=>{
    if(latest?.phase!=='LANDED'||landingSequence.paused||event.repeat||event.altKey||event.ctrlKey||event.metaKey||/INPUT|TEXTAREA|SELECT/.test(event.target?.tagName))return;
    if(event.code==='Enter'||event.code==='Space'){event.preventDefault();handoff();}
  });
  // END INIS handoff.

  // ARES integration: terminal owns Tab/Esc; preserve ui.watch for automation and host commands.
  const wrist=mountWristTerminal({root,getData:()=>latest?flightWristData(latest):null,onToggle:()=>{if(latest)commands.watch();}});
  bind('colony-chapter',()=>{clearLandingPayload();location.href='colony.html';});
  // BOLUM: use the same command surface as automated chapter selection.
  bind('landing-chapter',()=>commands.startChapter('mars-orbit'));
  let warpHold,warpHeld=false;
  const cancelWarpHold=()=>{clearTimeout(warpHold);warpHold=undefined;};
  on(nodes['warp-btn'],'pointerdown',()=>{warpHeld=false;cancelWarpHold();warpHold=setTimeout(()=>{warpHeld=true;commands.automatic();},550);});
  for(const event of ['pointerup','pointerleave','pointercancel'])on(nodes['warp-btn'],event,cancelWarpHold);
  listeners.push(cancelWarpHold);
  bind('start-btn',()=>commands.startChapter('launch'));bind('title-controls',commands.help);bind('about-btn',commands.about);bind('about-close',commands.about);bind('watch-btn',commands.watch);bind('burn-btn',commands.burn);bind('warp-btn',()=>{if(!warpHeld)commands.warp(1);warpHeld=false;});bind('auto-btn',commands.automatic);bind('help-btn',commands.help);bind('help-close',commands.help);bind('pause-btn',commands.pause);bind('resume-btn',commands.pause);bind('reset-btn',commands.reset);bind('mute-btn',commands.mute);
  root.querySelectorAll('[data-camera]').forEach(b=>on(b,'click',()=>commands.camera(Number(b.dataset.camera))));
  on(nodes.quality,'change',()=>commands.quality(nodes.quality.value,nodes.adaptive.checked));on(nodes.adaptive,'change',()=>commands.quality(nodes.quality.value,nodes.adaptive.checked));on(nodes.volume,'input',()=>commands.volume(Number(nodes.volume.value)));
  let eventKey='',caption='',captionUntil=0,lastCaptionTime=-1,seenEvents=new Set();
  const text=(id,value)=>{if(nodes[id].textContent!==value)nodes[id].textContent=value;};
  return {ready(failures){nodes['start-btn'].disabled=false;nodes['landing-chapter'].disabled=false;text('loading',failures.length?"Systems ready / fallback textures active":"All flight systems ready");},progress(done,total){text('loading',`NASA ASSETS / ${done} / ${total}`);},
    update(t,ui){
      const launch=['PRELAUNCH','ASCENT'].includes(t.phase),stacked=launch||t.phase==='PARKING_ORBIT',cd=t.countdown;
      text('phase',missionCalendar(t));text('met',`${number(Math.max(0,t.missionTime)/86400,1)} days`);text('warp-btn',`×${number(ui.warp,0)}`);
      const automatic=ui.pacing?.mode!=='manual';
      text('playback-rate',`Playback ×${number(ui.warp,ui.warp<10?1:0)} · ${automatic?"automatic":"manual"}`);
      text('auto-btn',`Automatic pacing: ${automatic?"ON":"OFF"}`);nodes['auto-btn'].setAttribute('aria-pressed',String(automatic));
      const now=performance.now();
      if(t.missionTime<lastCaptionTime||ui.title){seenEvents.clear();caption='';captionUntil=0;}
      const captionEvents=[...t.events];
      if(t.maxQ?.time>0&&(t.time??0)>t.maxQ.time+1)captionEvents.push({type:'MAX_Q',time:t.maxQ.time});
      for(const event of captionEvents){
        const key=`${event.type}:${event.time}`;
        if(seenEvents.has(key))continue;
        seenEvents.add(key);
        if(EVENT_CAPTIONS[event.type]&&t.missionTime-event.time<Math.max(3,ui.warp*.15)){caption=EVENT_CAPTIONS[event.type];captionUntil=now+4500;}
      }
      lastCaptionTime=t.missionTime;
      text('event-caption',caption);nodes['event-caption'].hidden=ui.title||!caption||now>captionUntil;
      text('alt',number((t.altitude??0)/1000,t.altitude<1000?3:1));text('vel',number((t.surfaceVelocity??t.velocity??t.heliocentric.speed)/1000,2));text('velocity-label',t.phase==='CRUISE'?"SUN-RELATIVE SPEED":t.surfaceVelocity!==undefined?"SURFACE-RELATIVE SPEED":"ORBITAL SPEED");
      text('alt-label',t.phase==='CRUISE'?"DISTANCE TO SUN":"ALTITUDE");text('alt-unit',t.phase==='CRUISE'?'AU':'km');
      if(t.phase==='CRUISE')text('alt',number(Math.hypot(...t.heliocentric.ship)/AU,3));
      text('vs',`${number(t.verticalSpeed??0,0)} m/s`);text('mach',number(t.mach,2));text('q',`${number((t.dynamicPressure??0)/1000,2)} kPa`);text('g',`${number((t.acceleration??0)/G0,2)} g`);text('gamma',`${number((t.flightPathAngle??Math.PI/2)*180/Math.PI,1)}°`);
      const maxq=launch&&(t.dynamicPressure??0)>27000;nodes.maxq.hidden=!maxq;nodes['q-row'].classList.toggle('warning',maxq);
      text('guidance',ui.manual?"MANUAL THROTTLE":"AUTOPILOT");text('thermal',t.phase==='EDL'?`HEAT FLUX / ${number((t.heatFlux??0)/1000,0)} kW/m²`:"GUIDANCE / NOMINAL");nodes.horizon.style.transform=`rotate(${90-(t.pitch??Math.PI/2)*180/Math.PI}deg)`;
      for(const stage of SLS.stages){const s=t.stages.find(s=>s.id===stage.id);let fuel=s.attached?s.propellant/stage.propellantMass:0,name=stage.id==='core'?"CORE":stage.id.toUpperCase(),status=s.attached?"ATTACHED":"SEPARATED";
        if(!stacked){fuel=stage.id==='icps'?t.transitPropellant/120000:stage.id==='core'?typeof t.propellant==='number'?t.propellant/16000:1:t.supplies.oxygen/806.4;name=stage.id==='icps'?'NTR':stage.id==='core'?"DESCENT":"SUPPLIES";status=stage.id==='icps'?"TRANSIT":stage.id==='core'?t.mars?"LANDER":"READY":"LIFE SUPPORT";}
        text(`fuel-label-${stage.id}`,name);text(`fuel-value-${stage.id}`,`${number(fuel*100,0)}%`);nodes[`fuel-bar-${stage.id}`].style.width=`${Math.max(0,Math.min(1,fuel))*100}%`;text(`fuel-status-${stage.id}`,status);nodes[`fuel-${stage.id}`].classList.toggle('separated',stacked&&!s.attached);
      }
      const configuration=vehicleConfiguration(t);
      nodes['stack-drawing'].className=`stack-drawing ${configuration}`;nodes['stack-drawing'].dataset.configuration=configuration;
      nodes['stack-drawing'].classList.toggle('no-las',!t.lasAttached);
      nodes['stack-drawing'].setAttribute('aria-label',({boosters:"Solid boosters, core stage, ICPS and Orion",core:"Core stage, ICPS and Orion",upper:"ICPS and Orion",transit:"Mars transit vehicle",lander:"Mars lander"})[configuration]);
      const throttle=cd.running&&cd.time>=-6.5?Math.min(1,(cd.time+6.5)/5):t.engineFiring?(t.throttle??1):0;
      text('throttle',`${number(throttle*100,0)}%`);nodes['throttle-bar'].style.width=`${throttle*100}%`;
      const engineCount=configuration==='lander'?4:launch?(t.stages.find(s=>s.id==='core').attached?4:1):configuration==='upper'?0:3;
      for(let i=0;i<6;i++)nodes[`engine-${i}`].classList.toggle('on',i<engineCount&&throttle>0||i>=4&&t.phase==='ASCENT'&&t.stages.find(s=>s.id==='srb').attached);
      text('engine-label',configuration==='lander'?"DESCENT ENGINE / 4":launch?(t.stages.find(s=>s.id==='core').attached?'RS-25 / 4':'RL10 / 1'):configuration==='upper'?"RL10 / STANDBY":"NTR / TRANSIT");text('stage-name',({boosters:'SLS B1',core:"CORE / ICPS",upper:'ICPS / ORION',transit:"MARS TRANSIT",lander:"MARS LANDER"})[configuration]);
      text('supplies',`O₂ ${number(t.supplies.oxygen,0)} kg · WATER ${number(t.supplies.water,0)} kg`);
      text('camera-name',`${String(ui.camera+1).padStart(2,'0')} / ${ui.cameraName.toLocaleUpperCase("en-US")}`);
      nodes['map-legend'].hidden=ui.camera!==5||ui.title;
      text('location',ui.camera===5?(t.phase==='CRUISE'?"HELIOCENTRIC / HOHMANN TRANSFER":"PLANET-CENTERED / PREDICTED ORBIT"):t.mars?"MARS · ENTRY CORRIDOR":t.altitude>120000?"EARTH / LOW ORBIT":"KENNEDY SPACE CENTER / LC-39B");
      if(['PARKING_ORBIT','TMI_BURN','CRUISE'].includes(t.phase))text('location',"EARTH → MARS / 3D TRANSFER VIEW");
      if(['MOI_BURN','MARS_ORBIT'].includes(t.phase))text('location',"MARS / CAPTURE AND PARKING ORBIT");
      root.classList.toggle('title-screen',ui.title);nodes['launch-card'].hidden=!ui.title;nodes['countdown-banner'].hidden=!cd.running;
      text('countdown-number',String(Math.ceil(Math.abs(cd.time))).padStart(2,'0'));text('countdown-status',cd.time>=-6.5?"RS-25 ENGINES FIRING":"CLEARED FOR LAUNCH");
      nodes['burn-btn'].hidden=true;latest=t;text('burn-btn',t.phase==='PARKING_ORBIT'?"B / START MARS TRANSFER ↗":"B / START MARS DESCENT ↗");
      text('notice',landingCallout(t)||t.failureReason||ui.notice||'');
      // INIS: wall-clock cinematic; neither warp nor frozen post-touchdown MET changes it.
      landingSequence.paused=ui.paused;
      if(t.phase==='LANDED'){
        if(!landingViewQueued){landingViewQueued=true;queueMicrotask(()=>{if(latest?.phase==='LANDED')commands.camera(0);});}
        if(landingSequence.complete&&!ui.paused&&!departing&&!handoffFailed)handoff();
      }else{landingViewQueued=false;departing=false;handoffFailed=false;}
      nodes['colony-btn'].hidden=!handoffFailed||ui.title;
      if(handoffFailed)text('notice',"Could not save landing data. Enable session storage and retry the handoff.");
      // END INIS cinematic.
      const ap=apsisReadout(t.apoapsis??(t.orbit?t.orbit.apoapsis-t.radius:NaN),t.orbit?.e,'apo'),pe=apsisReadout(t.periapsis??(t.orbit?t.orbit.periapsis-t.radius:NaN),t.orbit?.e,'peri');
      text('apo',ap.value);text('peri',pe.value);text('ap-label','AP');text('pe-label','PE');text('ap-unit',ap.unit);text('pe-unit',pe.unit);
      if(t.phase==='PRELAUNCH'){text('apo','—');text('peri','—');text('ap-unit','');text('pe-unit','');}
      if(t.phase==='CRUISE'){text('ap-label',"EARTH");text('pe-label','MARS');text('ap-unit','AU');text('pe-unit','AU');text('apo',number(Math.hypot(...t.heliocentric.earth.map((v,i)=>v-t.heliocentric.ship[i]))/AU,3));text('peri',number(Math.hypot(...t.heliocentric.mars.map((v,i)=>v-t.heliocentric.ship[i]))/AU,3));}
      if(['EDL','LANDED'].includes(t.phase)){text('ap-label',"PEAK HEATING");text('pe-label',"FUEL");text('ap-unit','kW/m²');text('pe-unit','t');text('apo',number(t.peakHeating/1000,1));text('peri',number(t.propellant/1000,2));}
      text('extra-metric',t.phase==='CRUISE'?`CRUISE / ${number(t.cruiseProgress*100,1)}% · ${number((1-t.cruiseProgress)*t.transfer.duration/DAY,1)} DAYS REMAINING`:t.phase==='EDL'?`HEAT FLUX ${number((t.heatFlux??0)/1000,0)} kW/m²`:t.burnRemaining?`Δv REMAINING / ${number(t.burnRemaining,0)} m/s`:`CREW / 03 · ${ui.muted?"SOUND OFF":"SOUND ON"}`);
      const milestones=launch?['RS25_START','LIFTOFF','MAX_Q','SRB_SEPARATION','LAS_JETTISON','MECO','ORBIT_INSERTION']:t.mars?['MOI_BURN','MARS_ORBIT','DEORBIT','EDL','HEATSHIELD_JETTISON','SRP_IGNITION','LEGS_DEPLOYED','TOUCHDOWN']:['ORBIT_INSERTION','TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT'];
      const events=[...t.events];if((t.maxQ?.time??0)>0&&(t.time??0)>t.maxQ.time+1)events.push({type:'MAX_Q',time:t.maxQ.time});
      const key=milestones.join()+events.map(e=>e.type).join();if(key!==eventKey){eventKey=key;const labels={RS25_START:"ENGINE IGNITION",LIFTOFF:"LIFTOFF",MAX_Q:"MAX Q",SRB_SEPARATION:"BOOSTER SEPARATION",LAS_JETTISON:"TOWER JETTISON",MECO:"MAIN ENGINE CUTOFF",ORBIT_INSERTION:"ORBIT",TMI_BURN:'TRANSFER',CRUISE:"CRUISE",MOI_BURN:"CAPTURE",MARS_ORBIT:"MARS ORBIT",DEORBIT:"DEORBIT",EDL:"ENTRY",HEATSHIELD_JETTISON:"SHIELD JETTISONED",LEGS_DEPLOYED:"LANDING GEAR",SRP_IGNITION:"DESCENT ENGINE",TOUCHDOWN:"TOUCHDOWN"};nodes.timeline.innerHTML=milestones.map(id=>{const event=events.find(e=>e.type===id);return `<div class="event ${event?'complete':''}"><i></i><b>${labels[id]??id}</b><small>${event?formatMET(event.time).replace(/T[+−] /,''):"PENDING"}</small></div>`;}).join('');}
      root.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.camera)===ui.camera)));
      nodes['about-overlay'].hidden=!ui.about;wrist.setRaised(ui.watch&&!ui.title);
      nodes['help-overlay'].hidden=!ui.help;nodes['pause-overlay'].hidden=!ui.paused;text('performance',`${ui.quality} quality · ${number(ui.fps,0)} fps · ${ui.pixelRatio.toFixed(2)}× pixel ratio`);text('mute-btn',ui.muted?"M / UNMUTE":"M / MUTE");
    },dispose(){latest=null;wrist.dispose();for(const off of listeners)off();root.replaceChildren();}
  };
}
