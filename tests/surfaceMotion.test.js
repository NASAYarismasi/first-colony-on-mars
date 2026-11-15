import { it, expect } from 'vitest';
import { SUIT, MARS_GRAVITY, createSuitMotion, stepSuitMotion } from '../src/sim/surfaceMotion.js';
it('has a stable ground state and SI suit speeds', () => {
  expect(stepSuitMotion(createSuitMotion(), 1/60)).toEqual(createSuitMotion());
  expect(SUIT.walkSpeed).toBe(1.8);
  expect(SUIT.runSpeed).toBe(4.5);
  expect(() => stepSuitMotion(createSuitMotion(), -1)).toThrow();
});
it('matches a Mars ballistic jump, ignores airborne retrigger and lands without sinking', () => {
  let state = stepSuitMotion(createSuitMotion(), 1/60, true);
  expect(state.grounded).toBe(false);
  expect(stepSuitMotion(state, 1/60, true)).toEqual(stepSuitMotion(state, 1/60, false));
  let apex = state.height;
  for (let i = 0; i < 59; i++) { state = stepSuitMotion(state, 1/60); apex = Math.max(apex, state.height); }
  expect(apex).toBeCloseTo(SUIT.jumpSpeed**2/(2*MARS_GRAVITY), 3);
  expect(state).toEqual(createSuitMotion());
});
it('is independent of step subdivision while airborne', () => {
  const initial = stepSuitMotion(createSuitMotion(), .01, true);
  const whole = stepSuitMotion(initial, .2);
  let split = initial;
  for (let i = 0; i < 20; i++) split = stepSuitMotion(split, .01);
  expect(split.height).toBeCloseTo(whole.height, 12);
  expect(split.verticalSpeed).toBeCloseTo(whole.verticalSpeed, 12);
});
