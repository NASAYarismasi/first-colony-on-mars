// Pure suit locomotion; metres/seconds. Kept out of the Three.js FPS controller.
// Mars surface gravity: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
export const MARS_GRAVITY = 3.71;
// GAME ASSUMPTION: conservative pressurised-suit speeds, eye height and jump impulse.
export const SUIT = Object.freeze({ eyeHeight: 1.65, walkSpeed: 1.8, runSpeed: 4.5, jumpSpeed: 1.65 });
export const createSuitMotion = () => ({ height: 0, verticalSpeed: 0, grounded: true });
/** Analytic constant-gravity flight integrated at the controller's fixed 1/60-second step. */
export function stepSuitMotion(state, dt, jump = false) {
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid suit motion step');
  let v = jump && state.grounded ? SUIT.jumpSpeed : state.verticalSpeed;
  if (state.grounded && !jump) return { height: 0, verticalSpeed: 0, grounded: true };
  const height = state.height + v * dt - .5 * MARS_GRAVITY * dt * dt;
  v -= MARS_GRAVITY * dt;
  return height <= 0 ? createSuitMotion() : { height, verticalSpeed: v, grounded: false };
}
