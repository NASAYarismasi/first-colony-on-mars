// Artemis terminal count: https://www.nasa.gov/missions/artemis/artemis-i/artemis-i-launch-countdown-101/
/** Pure terminal sequencer. The mission receives launch only after solid ignition. */
export function createCountdown() {
  const state = { time: -10, running: false, complete: false, events: [] };
  return { state,
    start() { if (state.running || state.complete) return false; state.running = true; return true; },
    step(dt) {
      if (!state.running || state.complete) return false;
      const old = state.time;
      state.time = Math.min(0, old + dt);
      if (old < -6.5 && state.time >= -6.5) state.events.push({ type: 'RS25_START', time: -6.5 });
      if (state.time >= -1e-10) {
        state.time = 0; state.running = false; state.complete = true;
        state.events.push({ type: 'SRB_IGNITION', time: 0 }); return true;
      }
      return false;
    }
  };
}
