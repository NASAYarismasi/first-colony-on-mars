/** Tiny observable state store and event bus. Returns unsubscribe closures for teardown. */
export function createStore(initial = {}) {
  let state = initial;
  const subscribers = new Set(), events = new Map();
  return {
    getState: () => state,
    setState(next) { state = typeof next === 'function' ? next(state) : { ...state, ...next }; for (const fn of subscribers) fn(state); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return () => events.get(name)?.delete(fn); },
    emit(name, payload) { for (const fn of events.get(name) ?? []) fn(payload); },
    dispose() { subscribers.clear(); events.clear(); }
  };
}
