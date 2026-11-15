import { chromium } from 'file:///C:/Users/Emre/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
await fs.mkdir('docs/screenshots',{recursive:true});
await page.goto(process.env.GAME_URL??'http://127.0.0.1:5177');await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).ready,{timeout:60000});
await page.evaluate(()=>{window.advanceTime(0);window.missionControl.quality('Orta',false);});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const command=(name,...args)=>page.evaluate(({name,args})=>window.missionControl[name](...args),{name,args});
async function screenshot(name){const s=await state();assert.equal(s.renderedMissionTime,s.telemetry.missionTime,'deterministic render must show the current state');if(s.mapLayout){const {labels,markers,height}=s.mapLayout,overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;for(const [i,label]of labels.entries()){assert.ok(label.y>185&&label.y+label.h<height-190,'map label clears HUD');assert.ok(!labels.slice(i+1).some(other=>overlap(label,other)),'map labels remain separate');assert.ok(!markers.some(marker=>overlap(label,marker)),'map label clears spacecraft/planet markers');}}await fs.writeFile(`docs/screenshots/${name}.json`,JSON.stringify(s,null,2));console.log('Capture',name,s.phase,s.telemetry.missionTime,s.telemetry.altitude);await page.waitForTimeout(450);const png=await page.screenshot({timeout:120000});for(let attempt=0;;attempt++){try{await fs.writeFile(`docs/screenshots/${name}.png`,png);break;}catch(error){if(attempt>=30)throw error;await page.waitForTimeout(500);}}console.log('Saved',name);}
await screenshot('00-title');
await page.click('#about-btn');assert.equal((await state()).about,true);await screenshot('00-about');await page.click('#about-close');
await page.click('#title-controls');assert.equal((await state()).help,true);await screenshot('00-controls');await page.click('#help-close');
await page.click('#start-btn');assert.equal((await state()).titleScreen,false);await screenshot('01-pad-chase');
// Core keyboard/UI interactions: pause/help/mute/camera/quality and mouse orbit.
await page.keyboard.press('h');assert.equal((await state()).help,true);await page.keyboard.press('h');
await page.keyboard.press('Escape');assert.equal((await state()).paused,true);await advance(1000);assert.equal((await state()).countdown.time,-10);
await page.selectOption('#quality','Düşük');assert.equal((await state()).quality,'Düşük');await page.selectOption('#quality','Yüksek');await page.selectOption('#quality','Orta');await page.keyboard.press('Escape');
await page.keyboard.press('m');assert.equal((await state()).muted,true);await page.keyboard.press('m');
await page.keyboard.press('c');assert.equal((await state()).cameraIndex,1);await page.keyboard.press('1');
await page.mouse.move(740,400);await page.mouse.down();await page.mouse.move(760,410,{steps:3});await page.mouse.up();await page.mouse.wheel(0,-100);
await advance(3600);assert.equal((await state()).countdown.events[0].type,'RS25_START');
await advance(14400);await page.keyboard.press('3');await screenshot('02-liftoff-ground');
assert.equal(await page.textContent('#peri'),'—');assert.equal(await page.textContent('#pe-unit'),'yörünge altı');
// Exercise the other mounted/director cameras before restoring chase.
await page.keyboard.press('4');assert.equal((await state()).cameraIndex,3);await page.keyboard.press('5');assert.equal((await state()).cameraIndex,4);
await page.keyboard.press('1');await advance(48580);await screenshot('03-max-q-chase');
await page.keyboard.press('a');assert.equal((await state()).manualThrottle,true);await page.keyboard.press('x');await advance(20);assert.equal((await state()).telemetry.throttle,0);
await page.keyboard.press('z');await advance(20);await page.keyboard.down('ControlLeft');await advance(100);await page.keyboard.up('ControlLeft');assert.ok((await state()).telemetry.commandedThrottle<1);
await page.keyboard.down('ShiftLeft');await advance(100);await page.keyboard.up('ShiftLeft');await page.keyboard.press('z');await page.keyboard.press('a');
await advance(72000);await screenshot('04-srb-separation');
assert.equal(await page.getAttribute('#stack-drawing','data-configuration'),'core');
await page.keyboard.press('q');assert.equal((await state()).watch,true);assert.equal((await state()).help,false);await screenshot('04-wrist-computer');await page.keyboard.press('q');
await command('warp',1);await command('warp',1);await command('warp',1);assert.equal((await state()).warp,10);
while((await state()).telemetry.stages.find(s=>s.id==='core').attached)await advance(1000);
assert.equal(await page.getAttribute('#stack-drawing','data-configuration'),'upper');await screenshot('11-core-separation');
while((await state()).phase==='ASCENT')await advance(1000);
await command('warp',-1);await command('warp',-1);await command('warp',-1);
await page.keyboard.press('2');await screenshot('05-orbit-onboard');
await page.keyboard.press('6');await screenshot('09-earth-orbit-map');
await page.keyboard.press('b');
// Burns use real 50 Hz physics; no phase/position injection for screenshots.
await command('warp',1);await command('warp',1);await command('warp',1);
for(let i=0;i<100&&(await state()).phase==='TMI_BURN';i++)await advance(10000);
assert.equal((await state()).phase,'CRUISE');await page.keyboard.press('6');
assert.equal(await page.getAttribute('#stack-drawing','data-configuration'),'transit');await screenshot('06-cruise-departure');
while((await state()).warp!==100000)await command('warp',1);
await advance(95000);await screenshot('06-cruise-map');
await page.keyboard.press('q');await screenshot('06-cruise-wrist');await page.keyboard.press('q');
while((await state()).phase==='CRUISE')await advance(100000);
assert.equal((await state()).phase,'MOI_BURN');assert.equal((await state()).warp,10);
for(let i=0;i<100&&(await state()).phase==='MOI_BURN';i++)await advance(10000);
assert.equal((await state()).phase,'MARS_ORBIT');await page.keyboard.press('b');
while((await state()).phase==='DEORBIT')await advance(5000);
await command('warp',-1);await command('warp',-1);await command('warp',-1);await page.keyboard.press('1');
for(let i=0;i<700&&(await state()).telemetry.heatFlux<18000;i++)await advance(1000);
assert.equal((await state()).phase,'EDL');assert.ok((await state()).telemetry.heatFlux>=18000);
await screenshot('07-edl-plasma');
while((await state()).phase==='EDL'&&(await state()).telemetry.altitude>40)await advance(2000);
await screenshot('10-powered-descent');
while((await state()).phase==='EDL')await advance(2000);
assert.equal((await state()).phase,'LANDED');assert.ok((await state()).telemetry.landingPayload);await screenshot('08-touchdown');
await page.keyboard.press('Escape');await page.click('#reset-btn');assert.equal((await state()).phase,'PRELAUNCH');assert.equal((await state()).cameraIndex,0);assert.equal((await state()).titleScreen,true);assert.equal((await state()).watch,false);
await fs.writeFile('docs/screenshots/browser-errors.json',JSON.stringify(errors,null,2));assert.deepEqual(errors,[]);
console.log('Mission and controls verified, no browser errors.');
} finally { await browser.close(); }
