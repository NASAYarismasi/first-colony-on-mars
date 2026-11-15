import {toggleFullscreen} from '../ui/fullscreen.js';
import { createMarsBackdrop } from './mars-backdrop.js';
import { createGameAudio } from './game-audio.js';
import { clearLandingPayload } from '../colony/handoff.js';
import { readMenuPreferences } from './preferences.js';

const mission=new URLSearchParams(location.search).get('bolum');
if(['kalkis','transfer','inis'].includes(mission))location.replace(`./flight.html?bolum=${mission}`);
else mountMenu();

function mountMenu(){
  const $=s=>document.querySelector(s);
  const prefs=readMenuPreferences();
  let {selected,muted,...settings}=prefs;
  let screen='menu',introTimer,backdrop,saved=true;
  const audio=createGameAudio();audio.update(settings);audio.mute(muted);
  function persist(){try{localStorage.setItem('mars-menu-settings',JSON.stringify({...settings,muted}));localStorage.setItem('mars-appearance',selected);saved=true}catch{saved=false}$('#save-state').textContent=saved?"Settings saved.":"Browser storage is unavailable; settings apply to this session only.";}
  function show(next,focus=true){clearTimeout(introTimer);screen=next;document.body.dataset.screen=next;document.querySelectorAll('main>.screen').forEach(el=>el.hidden=el.id!==next);backdrop?.setIntro(next==='intro');window.scrollTo(0,0);audio.setActive(next!=='ended');if(focus){const el=$('#'+next).querySelector('h1,h2');if(el){el.setAttribute('tabindex','-1');el.focus({preventScroll:true})}}}
  function playIntro(){show('intro',false);introTimer=setTimeout(()=>show('menu'),5000)}
  function select(id){selected=id;const index=Number(id.at(-1));document.querySelectorAll('.character').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.astronaut===id)));$('#selection-summary').textContent=`Astronaut 0${index} selected.`;persist();}
  try{backdrop=createMarsBackdrop($('#cosmos'),failed=>{$('#background-error').hidden=!failed});backdrop.setResolution(settings.resolution)}catch{$('#background-error').hidden=false;$('#background-error').firstChild.textContent="The 3D Mars background could not start on this device. ";}
  $('#retry-background').onclick=()=>{if(backdrop)backdrop.retry();else location.reload()};
  for(const key of ['master','ambient','effects']){const input=$('#'+key+'-volume');input.value=settings[key];$('#'+key+'-output').value=settings[key]+'%';input.addEventListener('input',()=>{settings[key]=Number(input.value);$('#'+key+'-output').value=settings[key]+'%';audio.update(settings);persist()});}
  $('#resolution').value=settings.resolution;$('#resolution').onchange=e=>{settings.resolution=e.target.value;backdrop?.setResolution(settings.resolution);persist()};
  async function unlock(){try{await audio.unlock()}catch{$('#app-status').textContent="Audio could not start in this browser."}}
  document.addEventListener('pointerdown',unlock,{once:true});document.addEventListener('keydown',unlock,{once:true});
  document.addEventListener('click',e=>{if(e.target.closest('button'))audio.tick();const back=e.target.closest('[data-back]');if(back)show(back.dataset.back)});
  $('#skip-intro').onclick=()=>show('menu');$('#replay-intro').onclick=playIntro;
  $('#home').onclick=e=>{e.preventDefault();show('menu')};$('#new-game').onclick=()=>show('astronauts');$('#settings-open').onclick=()=>show('settings');
  $('.characters').onclick=e=>{const card=e.target.closest('[data-astronaut]');if(card)select(card.dataset.astronaut)};
  $('#confirm-astronaut').onclick=()=>show('chapters');
  $('#menu-colony').onclick=()=>clearLandingPayload();
  function updateMute(){
    audio.mute(muted);
    const toggle=$('#sound-toggle');
    toggle.setAttribute('aria-pressed',String(muted));
    toggle.setAttribute('aria-label',muted?"Unmute":"Mute");
    toggle.innerHTML=muted?"SOUND OFF <span>◖×</span>":"SOUND ON <span>◖))</span>";
  }
  $('#sound-toggle').onclick=()=>{muted=!muted;updateMute();persist();};
  $('#test-sound').onclick=async()=>{await unlock();audio.tick(true)};
  $('#fullscreen').onclick=toggleFullscreen;
  document.addEventListener('fullscreenchange',()=>{$('#fullscreen').textContent=document.fullscreenElement?"Exit fullscreen ↙":"Fullscreen ↗"});
  $('#exit-open').onclick=()=>$('#exit-dialog').showModal();$('#exit-cancel').onclick=()=>$('#exit-dialog').close();$('#exit-confirm').onclick=()=>{$('#exit-dialog').close();show('ended');};$('#return-game').onclick=()=>show('menu');
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#exit-dialog').open){if(screen==='intro')show('menu');else if(['astronauts','settings','chapters'].includes(screen))show('menu')}});
  document.addEventListener('visibilitychange',()=>audio.setActive(!document.hidden&&screen!=='ended'));
  window.addEventListener('pagehide',()=>{clearTimeout(introTimer);backdrop?.dispose();audio.dispose()},{once:true});
  select(selected);
  updateMute();
  show('menu',false);
  window.render_game_to_text=()=>JSON.stringify({scene:'menu',screen,selected,muted});
}
