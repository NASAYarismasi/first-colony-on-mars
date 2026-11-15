/** Shared presentation clock. Mission time stops at touchdown; warp must not
 * accelerate the six-second hatch approach, fade, or settling dust. No sim writes.
 * HUD supplies pause state; cameras advance this clock once per rendered frame.
 * GAME ASSUMPTION: six seconds of presentation, final 1.5 seconds fade to black.
 */
export function createLandingSequence() {
  return {
    elapsed: null,
    paused: false,
    update(phase, dt) {
      if (phase !== 'LANDED') { this.elapsed = null; return; }
      if (this.elapsed === null) { this.elapsed = 0; return; }
      if (!this.paused) this.elapsed += Math.max(0, Math.min(.1, dt));
    },
    get fade() { return Math.max(0, Math.min(1, ((this.elapsed ?? 0)-4.5)/1.5)); },
    get complete() { return this.elapsed !== null && this.elapsed >= 6; }
  };
}

export const landingSequence = createLandingSequence();
