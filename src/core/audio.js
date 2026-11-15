/** Procedural brown-noise rumble / crackle; distance and sound delay use SI. */
export function createAudio(){let context,master,filter,lowGain,highGain,source,muted=false,volume=.4;const history=[];
  function start(){
    if(context){context.resume();return;}
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    context=new Audio();master=context.createGain();master.gain.value=muted?0:volume;master.connect(context.destination);
    const buffer=context.createBuffer(2,context.sampleRate*4,context.sampleRate);
    let seed=77;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296)*2-1;
    for(let ch=0;ch<2;ch++){const d=buffer.getChannelData(ch);let brown=0;for(let i=0;i<d.length;i++){brown=(brown+.025*random())/1.025;d[i]=brown*4+random()*.08;}}
    source=context.createBufferSource();source.buffer=buffer;source.loop=true;
    const rumble=context.createBiquadFilter();rumble.type='lowpass';rumble.frequency.value=130;
    const crackle=context.createBiquadFilter();crackle.type='bandpass';crackle.frequency.value=850;crackle.Q.value=.5;
    filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1600;
    lowGain=context.createGain();highGain=context.createGain();lowGain.gain.value=highGain.gain.value=0;
    source.connect(rumble);source.connect(crackle);rumble.connect(lowGain);crackle.connect(highGain);lowGain.connect(filter);highGain.connect(filter);filter.connect(master);source.start();
  }
  return {start,get muted(){return muted;},setVolume(v){volume=v;if(master)master.gain.setTargetAtTime(muted?0:volume,context.currentTime,.05);},toggleMute(){muted=!muted;this.setVolume(volume);},
    update(s,camera,distance){
      if(!context)return;const clock=s.missionTime+(s.phase==='PRELAUNCH'?s.countdown.time:0);
      const thrust=s.engineFiring?Math.min(1,(s.thrust??5e6)/3.8e7):s.countdown.running&&s.countdown.time>=-6.5?.18:0;
      if(history.length&&clock<history.at(-1).t)history.length=0;
      history.push({t:clock,p:thrust});while(history.length>1&&history[1].t<clock-60)history.shift();
      let power=thrust;if(camera===2){const heard=clock-distance/343;power=0;for(const sample of history)if(sample.t<=heard)power=sample.p;}
      const cabin=camera===1,vacuum=s.density<1e-5,gain=cabin?.18:vacuum?0:Math.min(1,1200/Math.max(150,distance));
      lowGain.gain.setTargetAtTime(power*gain*.7,context.currentTime,.08);highGain.gain.setTargetAtTime(power*gain*(cabin?.04:.3),context.currentTime,.08);filter.frequency.setTargetAtTime(cabin?180:1800,context.currentTime,.1);
    },reset(){history.length=0;},dispose(){source?.stop();context?.close();history.length=0;}
  };
}
