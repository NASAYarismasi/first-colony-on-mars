/** Procedural inside-helmet audio, no external assets. Artistic mix: GAME ASSUMPTION. */
export function createSuitAudio({muted=false,volume=1}={}) {
  let context, master, fan, breath, noise, buffer, enabled = !muted, active = false
  const sources = []
  const onGesture = () => {
    if (!enabled || !active) return
    const Audio = window.AudioContext || window.webkitAudioContext
    if (!Audio) return
    try {
      if (!context) {
        context = new Audio()
        master = context.createGain(); master.gain.value = .22*volume; master.connect(context.destination)
        buffer = context.createBuffer(1, context.sampleRate*3, context.sampleRate)
        const samples = buffer.getChannelData(0)
        let seed = 9103, smooth = 0
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
          smooth = .97*smooth + .03*(seed/2147483648 - 1)
          samples[i] = smooth * 4
        }
        noise = context.createBufferSource(); noise.buffer = buffer; noise.loop = true
        const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 540
        breath = context.createGain(); breath.gain.value = .1
        noise.connect(filter); filter.connect(breath); breath.connect(master); noise.start(); sources.push(noise)
        fan = context.createOscillator(); fan.type = 'sine'; fan.frequency.value = 112
        const fanGain = context.createGain(); fanGain.gain.value = .018
        fan.connect(fanGain); fanGain.connect(master); fan.start(); sources.push(fan)
      }
      context.resume().catch(() => {})
    } catch { /* Audio support is optional; exploration remains available. */ }
  }
  const controller = new AbortController()
  window.addEventListener('pointerdown', onGesture, { signal: controller.signal })
  window.addEventListener('keydown', onGesture, { signal: controller.signal })
  return {
    get enabled() { return enabled },
    toggle() { enabled = !enabled; if (enabled) onGesture(); if (master) master.gain.value = enabled && active ? .22*volume : 0; return enabled },
    setActive(value) { active = value; if (master) master.gain.value = enabled && active ? .22*volume : 0 },
    update(time) {
      if (context && breath && active && enabled) {
        const cycle = Math.sin(time*2*Math.PI/5.4)
        breath.gain.setTargetAtTime(.04 + .11*Math.max(0, cycle)**2, context.currentTime, .08)
      }
    },
    step(running = false) {
      if (!context || !enabled || !active || context.state !== 'running') return
      const source = context.createBufferSource(); source.buffer = buffer
      const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 230
      const gain = context.createGain(); const now = context.currentTime
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(running ? .35 : .23, now+.018)
      gain.gain.exponentialRampToValueAtTime(.0001, now+.19)
      source.connect(filter); filter.connect(gain); gain.connect(master)
      source.start(now, .35); source.stop(now+.22)
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
    },
    dispose() { controller.abort(); for (const source of sources) { source.stop(); source.disconnect() }; context?.close().catch(() => {}) },
  }
}
