import { it, expect, vi } from 'vitest';
import { createLoop, SIM_DT, WARPS } from '../src/core/loop.js';
import { createStore } from '../src/core/store.js';
import { createInput } from '../src/core/input.js';
it('accumulates fixed 1/50-second ticks, interpolates and pauses', () => {
  const step = vi.fn(), render = vi.fn();
  const loop = createLoop({ step, render });
  expect(loop.advance(.03)).toBeCloseTo(.5, 12);
  expect(step).toHaveBeenCalledExactlyOnceWith(SIM_DT);
  loop.setPaused(true); loop.advance(10); expect(step).toHaveBeenCalledTimes(1);
  loop.setPaused(false); loop.advance(.01); expect(step).toHaveBeenCalledTimes(2);
  expect(render).toHaveBeenCalledTimes(3);
});
it('allows every requested warp only in the allowed flight environment', () => {
  const state = { engineFiring: false, inAtmosphere: false }, step = vi.fn();
  const loop = createLoop({ step, getState: () => state });
  for (const warp of WARPS) expect(loop.setWarp(warp)).toBe(true);
  state.engineFiring = true; expect(loop.setWarp(100000)).toBe(false); expect(loop.setWarp(1000)).toBe(true); expect(loop.setWarp(10)).toBe(true); // vacuum burn ≤ ×1000
  state.engineFiring = false; state.inAtmosphere = true; expect(loop.setWarp(1000)).toBe(false); expect(loop.setWarp(50)).toBe(true);
  expect(loop.setWarp(3)).toBe(false);
});
it('batches only safe fixed coast ticks, then reduces warp before firing engines', () => {
  const state = { engineFiring: false, inAtmosphere: false }, burn = vi.fn();
  const loop = createLoop({ step: burn, getState: () => state, advanceCoast: () => { state.engineFiring = true; return 2; } });
  loop.setWarp(100000); loop.advance(.1);
  expect(loop.warp).toBe(10);
  // 2 seconds coast + remaining .09998 real seconds * 10 -> 49 engine ticks.
  expect(burn).toHaveBeenCalledTimes(49);
});
it('retains work backlog instead of silently dropping physical ticks', () => {
  const step = vi.fn(), loop = createLoop({ step, maxSteps: 2 });
  loop.advance(.1); expect(step).toHaveBeenCalledTimes(2); expect(loop.backlog).toBeCloseTo(.06, 12);
  loop.advance(0); loop.advance(0); expect(step).toHaveBeenCalledTimes(5);
});
it('does not issue an extra engine tick when a warp safety transition leaves less than one tick', () => {
  const state = { engineFiring: false, inAtmosphere: false }, step = vi.fn();
  const loop = createLoop({ step, getState: () => state, advanceCoast: () => { state.engineFiring = true; return 9999.98; } });
  loop.setWarp(100000); loop.advance(.1);
  expect(step).not.toHaveBeenCalled(); expect(loop.backlog).toBeLessThan(SIM_DT);
});
it('unsubscribes state subscribers and event listeners', () => {
  const store = createStore({ a: 1 }), state = vi.fn(), event = vi.fn();
  const unsub = store.subscribe(state), off = store.on('launch', event);
  store.setState({ a: 2 }); store.emit('launch', 123);
  expect(state).toHaveBeenCalledWith({ a: 2 }); expect(event).toHaveBeenCalledWith(123);
  unsub(); off(); store.setState({ a: 3 }); store.emit('launch', 0);
  expect(state).toHaveBeenCalledTimes(1); expect(event).toHaveBeenCalledTimes(1);
});
it('uses a rebindable keyboard table and removes listeners at teardown', () => {
  const target = new EventTarget(), action = vi.fn(), input = createInput(target, action);
  const send = (type, code) => { const e = new Event(type, { cancelable: true }); Object.defineProperty(e, 'code', { value: code }); target.dispatchEvent(e); };
  send('keydown', 'KeyW'); expect(input.isDown('forward')).toBe(true);
  input.rebind('forward', 'KeyZ'); expect(input.isDown('forward')).toBe(false);
  send('keydown', 'KeyZ'); expect(input.isDown('forward')).toBe(true);
  send('keyup', 'KeyZ'); expect(input.isDown('forward')).toBe(false);
  send('keydown', 'Tab'); expect(action).toHaveBeenCalledWith('watch', expect.any(Event));
  input.dispose(); action.mockClear(); send('keydown', 'Tab'); expect(action).not.toHaveBeenCalled();
});
