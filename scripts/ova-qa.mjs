import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'file:///C:/Users/Emre/.codex/skills/develop-web-game/node_modules/playwright/index.mjs';
// Real keyboard/UI commands; no scene-state injection.
fs.mkdirSync('output/ova',{recursive:true});
fs.mkdirSync('docs/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
try {
const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(120000);
page.on('pageerror',e=>{errors.push(String(e));console.log('ERROR',String(e))});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE',m.text())}});
await page.goto(process.env.COLONY_URL ?? 'http://127.0.0.1:5175/colony.html',{waitUntil:'networkidle',timeout:120000});
await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).assets.crew&&JSON.parse(window.render_game_to_text()).assets.rover);
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const step=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const shot=async name=>{await page.screenshot({path:`docs/screenshots/ova-${name}.png`,timeout:120000});console.log('screenshot',name);};
const move=async(keys,seconds)=>{for(const key of keys)await page.keyboard.down(key);await step(seconds*1000);for(const key of keys)await page.keyboard.up(key);console.log('moved',keys,(await state()).player);};
await step(0);let current=await state();assert.equal(current.world,'duz-ova');assert.equal(current.fps,true);assert.ok(current.player.z>21);checks.push({spawn:current});await shot('spawn');
await page.locator('#scene').focus();
// Walk around the lander's front feet, east to the airlock centreline, then north.
await move(['ArrowRight'],(Math.PI/2-.65)/(620*.0022));
await move(['Shift','w'],17.3/2.2);
await move(['ArrowLeft'],(Math.PI/2)/(620*.0022));
current=await state();await move(['Shift','w'],(current.player.z-7.7)/2.2);
current=await state();assert.ok(Math.abs(current.player.x)<.25,JSON.stringify(current.player));assert.ok(Math.abs(current.player.z-7.7)<.25);
await page.keyboard.press('e');await step(100);current=await state();assert.equal(current.insideHabitat,true);checks.push({entry:current});await shot('interior');
await move(['w'],2.45/1.2);await move(['d'],9/1.2);current=await state();assert.ok(current.player.x>8.7);assert.equal(current.insideHabitat,true);checks.push({rightDome:current});
await move(['a'],18/1.2);current=await state();assert.ok(current.player.x< -8.7);assert.equal(current.insideHabitat,true);checks.push({leftDome:current});
await page.keyboard.press('e');assert.equal((await state()).insideHabitat,true);
await move(['d'],9/1.2);await move(['s'],1);await page.keyboard.press('e');await step(100);assert.equal((await state()).insideHabitat,false);checks.push({exit:await state()});
await page.keyboard.press('q');assert.equal(await page.locator('.ares-wrist').getAttribute('aria-hidden'),'false');await shot('wrist');await page.keyboard.press('q');
const view=async name=>{await page.click('#view-toggle');await page.click(`[data-ova-view=${name}]`);await page.locator('#view-drawer [data-close-drawer]').click();await step(100);assert.equal((await state()).view,name);};
await view('panorama');await shot('panorama');await view('solar');checks.push({solar:await state()});await shot('solar');await view('base');await shot('base');await view('pad');
// Project a clear construction point with the documented pad camera. Place a real gameplay module by click.
const pixel=await page.evaluate(()=>{
  // Project the documented camera/point directly; avoid loading a second Three.js in QA.
  const normalize=v=>{const length=Math.hypot(...v);return v.map(n=>n/length);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
  const forward=normalize([-29,-35,-17]),right=normalize(cross(forward,[0,1,0]));
  const up=cross(right,forward),relative=[15-29,.1-35,27-35];
  const depth=dot(relative,forward),fov=Math.tan(48*Math.PI/360);
  return {x:(dot(relative,right)/(depth*fov*1.6)+1)*640,y:(1-dot(relative,up)/(depth*fov))*400};
});
await page.mouse.click(pixel.x,pixel.y);current=await state();assert.equal(current.state.placed.length,1,JSON.stringify({pixel,current}));checks.push({placed:current});await shot('placement');
await page.click('#crew-toggle');for(const select of await page.locator('#crew select').all())await select.selectOption('construction');await page.locator('#crew-drawer [data-close-drawer]').click();
await page.click('#resources-toggle');await page.click('#advance');await step(100);current=await state();assert.equal(current.state.sol,1);checks.push({sol:current});await page.locator('#resources-drawer [data-close-drawer]').click();
await page.click('#eclss-toggle');assert.match(await page.locator('#eclss-water').textContent(),/44,2/);assert.match(await page.locator('#eclss-savedWater').textContent(),/89,8/);await page.locator('#eclss-electrolysis').uncheck();assert.match(await page.locator('#eclss-oxygen').textContent(),/25,2/);await page.selectOption('#eclss-weather','0.1');await shot('eclss');await page.locator('#eclss-drawer [data-close-drawer]').click();
assert.equal(errors.length,0,JSON.stringify(errors));console.log('ALL BROWSER CHECKS PASSED');
} finally {fs.writeFileSync('output/ova/browser-checks.json',JSON.stringify({errors,checks},null,2));await browser.close();}
