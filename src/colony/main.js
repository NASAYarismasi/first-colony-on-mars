import { mountFieldTablet } from './field-tablet.js';
import {mountPowerTablet} from './power-tablet.js';
import '../ui/fullscreen.js';
import { bindEclss } from './ihan/eclss.mjs';
// Colony page entry. Scene, FPS and colony rules: İhan (src/colony/scene, mars-koloni.mjs, mars-atolye.mjs).
import { createColony, createColonyFromFlight, exampleLanding } from './mars-koloni.mjs';
import { readLandingPayload } from './handoff.js';
import { mountWristTerminal } from '../ui/wristTerminal.js';
import { colonyWristData } from '../ui/wristData.js';
import { REALISM_NOTES, REALISM_SOURCES } from './realism.js';

const landing = readLandingPayload(exampleLanding);
// KERK integration: subscribe before the scene emits its first colony:state snapshot.
// The initial projection is read-only; the scene remains the sole colony state owner.
// Flight payload supplies are crew-sols; İhan's createColonyFromFlight converts them to person-sols.
let wristDetail = { state: landing.source === 'flight' ? createColonyFromFlight(landing) : createColony(landing) };
const settings = document.getElementById('surface-settings');
const wrist = mountWristTerminal({ root: document.querySelector('main') ?? document.body,
  surfaceShortcuts: true, canToggle: () => !settings.open,
  getData: () => colonyWristData(wristDetail),
  onToggle(raised) {
    document.body.classList.toggle('tablet-active',raised);
    if(raised) {
      document.exitPointerLock?.();
      document.querySelector('.ares-close').focus({preventScroll:true});
    } else {
      showDrawer(null);
      window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));
      canvas.focus({preventScroll:true});
    }
  }
});
let lastWristTask=null;
const setSurfaceOption=(action,value,on,off)=>{
  const button=settings.querySelector(`[data-surface="${action}"]`);
  button.textContent=value?on:off;
};
function onColonyState(event) {
  if (!event.detail || typeof event.detail !== 'object') return;
  wristDetail = { ...wristDetail, ...event.detail, state: event.detail.state ?? wristDetail.state };
  setSurfaceOption('audio',wristDetail.audio,"Mute","Unmute");
  setSurfaceOption('lamp',wristDetail.headlamp,"Turn headlamp off","Turn headlamp on");
  const task=event.detail.activeTask;if(typeof task==='string'&&task&&task!==lastWristTask){if(lastWristTask!==null)wrist.notify(task);lastWristTask=task;}
  // The terminal samples at 4 Hz while raised, even if the scene publishes every frame.
}
window.addEventListener('colony:state', onColonyState);
const onNotice=e=>wrist.notify(e.detail?.message);window.addEventListener('colony:notification',onNotice);
function disposeWrist() {
  restorePanelParents();labPanel.remove();wrist.dispose();window.removeEventListener('colony:notification',onNotice);
  window.removeEventListener('colony:state', onColonyState);
  window.removeEventListener('pagehide', onPageHide);
}
function onPageHide(event) { if (!event.persisted) disposeWrist(); }
window.addEventListener('pagehide', onPageHide);
if (import.meta.hot) import.meta.hot.dispose(disposeWrist);
// Dynamic import ensures the event listener above exists before scene initialization.
void import('./scene/mars-demo.mjs');
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const target = document.getElementById('landing-source');
if (target) {
  const s = landing.supplies;
  const source = document.createElement('b');
  source.textContent = landing.source === 'flight' ? "Landing data from flight" : "Example landing data";
  target.replaceChildren(source, document.createTextNode(" · Jezero Crater"));
  target.title = `Landing supplies · O₂ ${number.format(s.oxygen)} · Water ${number.format(s.water)} · Food ${number.format(s.food)} ${landing.source === 'flight' ? "crew-sols" : "person-sols"} · Spare parts ${number.format(s.spareParts)} units`;
}

// UI-only drawer controller. Scene controls keep their original IDs and handlers.
const canvas = document.getElementById('scene');
const toggles = [...document.querySelectorAll('[data-drawer]')];
const drawers = [...document.querySelectorAll('.colony-drawer')];
const events = new AbortController();
const disposeEclss = bindEclss();
const listen = (element, type, handler, options = {}) => element.addEventListener(type, handler, { ...options, signal: events.signal });
let activeDrawer = null;

const panelSlot=document.querySelector('.ares-panel-slot');
const content=document.querySelector('.ares-content'),tabletTabs=document.querySelector('.ares-tabs');
const panelParents=new Map(drawers.map(node=>[node,node.parentNode]));
let activeTabletPanel=null;
function restorePanelParents(){for(const [node,parent]of panelParents)parent?.append(node);}
function tabletPage(node){
  if(!panelParents.has(node))panelParents.set(node,node.parentNode);
  if(activeTabletPanel&&activeTabletPanel!==node)activeTabletPanel.hidden=true;
  panelSlot.append(node);node.hidden=false;panelSlot.hidden=false;activeTabletPanel=node;
  document.querySelector('.ares-screen').classList.add('has-panel');content.hidden=true;tabletTabs.hidden=true;
  watchActions.hidden=true;managementToggle.textContent="APPS";
  document.body.classList.add('tablet-active');document.exitPointerLock?.();
  if(!wrist.raised){
    wrist.setRaised(true);
    document.querySelector('.ares-close').focus({preventScroll:true});
  }
}
function tabletHome(){if(activeTabletPanel)activeTabletPanel.hidden=true;activeTabletPanel=null;panelSlot.hidden=true;document.querySelector('.ares-screen').classList.remove('has-panel');tabletTabs.hidden=false;content.hidden=false;}
function showDrawer(id) {
  activeDrawer=id;document.body.classList.toggle('drawer-open',Boolean(id));
  for(const drawer of drawers)drawer.hidden=drawer.id!==id;
  for(const toggle of toggles)toggle.setAttribute('aria-expanded',String(toggle.dataset.drawer===id));
  if(id)tabletPage(document.getElementById(id));else tabletHome();
}

function closeDrawer(returnFocus = true) {
  const previous = activeDrawer;
  showDrawer(null);
  if (returnFocus) toggles.find(toggle => toggle.dataset.drawer === previous)?.focus({ preventScroll: true });
}

for (const toggle of toggles) listen(toggle, 'click', () => {
  showDrawer(activeDrawer === toggle.dataset.drawer ? null : toggle.dataset.drawer);
});
// Management remains accessible from the manually raised wrist, without a screen-edge sidebar.
const watchActions=document.createElement('nav');watchActions.className='ares-colony-actions';watchActions.hidden=true;watchActions.setAttribute('aria-label',"Colony management");
for(const [id,title,subtitle] of [['rover',"Rover control","Mission · recall · charge"],['water',"Water plant","Ice extraction · recovery"],['air',"Air plant","O₂ production · CO₂ removal"],['solar',"Solar & energy","Solar farm console"],['greenhouse',"Greenhouse","Grow lights · irrigation"],['habitat',"Habitat","Crew · life support"]]){
  const button=document.createElement('button');button.type='button';const label=document.createElement('b');label.textContent=title;const sub=document.createElement('small');sub.textContent=subtitle;button.append(label,sub);listen(button,'click',()=>window.dispatchEvent(new CustomEvent('colony:open-system',{detail:{id}})));watchActions.append(button);
}
const eclssApp=document.createElement('button');eclssApp.type='button';eclssApp.textContent="ECLSS · life support balance";listen(eclssApp,'click',()=>{window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));showDrawer('eclss-drawer');});watchActions.append(eclssApp);
const powerTablet=mountPowerTablet(tabletPage);
const powerApp=document.createElement('button');powerApp.type='button';powerApp.textContent="Electricity and energy consumption";listen(powerApp,'click',()=>{window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));showDrawer(null);powerTablet.open();});watchActions.append(powerApp);
listen(window,'pagehide',()=>powerTablet.dispose());
const labApp=document.createElement('button');labApp.type='button';labApp.textContent="Laboratory · soil analysis";listen(labApp,'click',()=>{showDrawer(null);tabletPage(labPanel);});watchActions.append(labApp);
const labPanel=document.createElement('section');labPanel.className='colony-drawer ops-lab';labPanel.hidden=true;document.body.append(labPanel);
let lastLabPhase;
listen(window,'colony:state',()=>{if(activeTabletPanel!==labPanel)return;const lab=wristDetail.lifeSupport?.lab;if(lastLabPhase===lab?.phase&&labPanel.childElementCount)return;lastLabPhase=lab?.phase;labPanel.replaceChildren();const title=document.createElement('h2');title.textContent="Soil analysis laboratory";const status=document.createElement('p');status.textContent=lab?.phase==='scanning'?"Scanning sample…":lab?.phase==='complete'?"Analysis complete":"REG-01 sample ready";labPanel.append(title,status);if(lab?.result){const result=document.createElement('p');result.textContent=`Water ice %${lab.result.waterIcePercent} · Iron oxide %${lab.result.ironOxidePercent} · Perchlorate detected. Treatment and nutrient supplementation required. Illustrative game data.`;labPanel.append(result);}const button=document.createElement('button');button.type='button';button.textContent=lab?.phase==='complete'?"Analyze again":"Start analysis";button.disabled=lab?.phase==='scanning';button.onclick=()=>window.dispatchEvent(new CustomEvent('colony:analyze-soil'));labPanel.append(button);});
const fieldTablet=mountFieldTablet({getDetail:()=>wristDetail,onOpen:tabletPage});
for(const [page,title] of [['radiation',"Radiation"],['vision',"Image analysis"],['ai',"Local AI"]]){
  const button=document.createElement('button');
  button.type='button';
  button.textContent=title;
  listen(button,'click',()=>{
    window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));
    showDrawer(null);
    fieldTablet.open(page);
  });
  watchActions.append(button);
}
listen(window,'pagehide',event=>{if(!event.persisted)fieldTablet.dispose();});
if(import.meta.hot)import.meta.hot.dispose(()=>fieldTablet.dispose());
const sourcesApp=document.createElement('button');
sourcesApp.type='button';
sourcesApp.textContent="NASA data and sources";
listen(sourcesApp,'click',()=>{
  window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));
  showDrawer('realism-drawer');
});
watchActions.append(sourcesApp);
document.querySelector('.ares-screen').append(watchActions);
const managementToggle=document.createElement('button');managementToggle.type='button';managementToggle.className='ares-management-toggle';managementToggle.textContent="APPS";document.querySelector('.ares-footer').append(managementToggle);listen(managementToggle,'click',()=>{if(activeTabletPanel){window.dispatchEvent(new CustomEvent('colony:tablet-dismiss'));showDrawer(null);watchActions.hidden=false;content.hidden=true;managementToggle.textContent="BACK TO STATUS";return;}watchActions.hidden=!watchActions.hidden;content.hidden=!watchActions.hidden;managementToggle.textContent=watchActions.hidden?"APPS":"BACK TO STATUS";});
listen(window,'colony:tablet-panel',e=>{if(!e.detail?.panel)return;showDrawer(null);tabletPage(e.detail.panel);});
listen(window,'colony:tablet-panel-closed',()=>{showDrawer(null);watchActions.hidden=false;content.hidden=true;managementToggle.textContent="BACK TO STATUS";});
for (const button of document.querySelectorAll('[data-close-drawer]')) listen(button, 'click', () => closeDrawer());

const surfaceAction=action=>window.dispatchEvent(new CustomEvent('colony:surface-settings',{detail:action}));
function openSettings() {
  if (settings.open) return;
  wrist.setRaised(false,true);
  document.exitPointerLock?.();
  settings.showModal();
  surfaceAction('pause');
}
listen(document.getElementById('surface-settings-toggle'),'click',openSettings);
listen(settings,'click',event=>{
  const action=event.target.closest('[data-surface]')?.dataset.surface;
  if(action==='resume')settings.close();
  else if(action)surfaceAction(action);
});
listen(settings,'close',()=>{surfaceAction('resume');canvas.focus({preventScroll:true});});
listen(window,'keydown',event=>{
  if(event.code!=='Escape'||event.repeat||settings.open||wrist.raised)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openSettings();
},{capture:true});

listen(document, 'pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  document.body.classList.toggle('pointer-locked', locked);
  if (locked) closeDrawer(false);
});
// Clicking the world dismisses a drawer without cancelling the scene's own interaction.
listen(canvas, 'pointerdown', () => closeDrawer(false));
listen(document.getElementById('view-mode'), 'click', () => {
  closeDrawer(false);
  canvas.focus({ preventScroll: true });
});

const notesRoot = document.getElementById('realism-notes');
for (const note of REALISM_NOTES) {
  const article = document.createElement('article');
  article.id = `realism-${note.id}`;
  article.className = 'realism-note';
  article.tabIndex = -1;
  const title = document.createElement('h3');
  title.textContent = note.title;
  const text = document.createElement('p');
  text.textContent = note.text;
  const sources = document.createElement('p');
  note.sources.forEach((key, index) => {
    if (index) sources.append(' · ');
    const source = REALISM_SOURCES[key];
    const link = document.createElement('a');
    link.href = source.url;
    link.textContent = source.label;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    sources.append(link);
  });
  article.append(title, text, sources);
  notesRoot.append(article);
}
for (const button of document.querySelectorAll('[data-realism]')) {
  const note = REALISM_NOTES.find(item => item.id === button.dataset.realism);
  button.title = note.text;
  listen(button, 'click', () => {
    showDrawer('realism-drawer');
    const article = document.getElementById(`realism-${note.id}`);
    article.focus({ preventScroll: true });
    article.scrollIntoView({ block: 'nearest' });
  });
}

// Full-page navigation owns this controller; release listeners on teardown.
listen(window, 'pagehide', event => { if (!event.persisted) { events.abort(); disposeEclss(); } });
if (import.meta.hot) import.meta.hot.dispose(() => {events.abort(); disposeEclss();});
