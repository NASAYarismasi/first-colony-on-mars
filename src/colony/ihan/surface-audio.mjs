export function createSurfaceAudio() {
  let context
  let noise
  function enable() {
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    if (!context) {
      context = new Audio()
      noise = context.createBuffer(1,context.sampleRate,context.sampleRate)
      const samples = noise.getChannelData(0)
      for(let i=0;i<samples.length;i++) samples[i]=Math.random()*2-1
    }
    if (context.state==="suspended") context.resume().catch(()=>{})
  }
  function burst(duration, frequency, volume, delay=0) {
    if (context?.state!=="running") return
    const start=context.currentTime+delay
    const source=context.createBufferSource()
    source.buffer=noise
    const filter=context.createBiquadFilter()
    filter.type="bandpass"
    filter.frequency.value=frequency
    const gain=context.createGain()
    gain.gain.setValueAtTime(.0001,start)
    gain.gain.exponentialRampToValueAtTime(volume,start+.012)
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration)
    source.connect(filter).connect(gain).connect(context.destination)
    source.start(start,Math.random()*.4,duration)
  }
  return {
    enable,
    step(indoors) {
      burst(.11,indoors?235:760,indoors?.11:.15)
      if (!indoors) burst(.10,1750,.055,.025)
    },
    landing(indoors) { burst(.17,indoors?180:540,.18) },
    door(open) {
      burst(.26,open?320:220,.12)
      burst(.085,650,.18,.20)
    },
    pressure() { burst(.48,1100,.075) }
  }
}
