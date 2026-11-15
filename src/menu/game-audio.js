export function createGameAudio(){
 let ctx,master,ambient,effects,oscillators=[],muted=false,active=true;
 let settings={master:70,ambient:50,effects:65};
 function apply(){if(!ctx)return;const t=ctx.currentTime;master.gain.setTargetAtTime(muted||!active?0:settings.master/100,t,.07);ambient.gain.setTargetAtTime(settings.ambient/100*.055,t,.07);effects.gain.setTargetAtTime(settings.effects/100*.12,t,.07);}
 async function unlock(){if(!ctx){ctx=new AudioContext();master=ctx.createGain();ambient=ctx.createGain();effects=ctx.createGain();ambient.connect(master);effects.connect(master);master.connect(ctx.destination);for(const freq of [48,72.05,96.1]){const osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=freq;osc.connect(ambient);osc.start();oscillators.push(osc)}apply()}if(ctx.state==='suspended')await ctx.resume();}
 function tick(test=false){if(!ctx||ctx.state!=='running')return;const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;osc.type='sine';osc.frequency.setValueAtTime(test?440:620,now);osc.frequency.exponentialRampToValueAtTime(test?660:400,now+.1);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.4,now+.015);gain.gain.exponentialRampToValueAtTime(.001,now+.18);osc.connect(gain);gain.connect(effects);osc.start(now);osc.stop(now+.2);osc.onended=()=>{osc.disconnect();gain.disconnect()};}
 return{unlock,tick,update(next){settings={...next};apply()},mute(value){muted=value;apply()},setActive(value){active=value;apply()},dispose(){oscillators.forEach(o=>{o.stop();o.disconnect()});ctx?.close()}};
}
