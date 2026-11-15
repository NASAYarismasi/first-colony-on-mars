/** Classical fourth-order Runge–Kutta; derivative must be pure. */
export function rk4(state, time, dt, derivative) {
  const a = derivative(state, time);
  const b = derivative(state.map((v, i) => v + dt * a[i] / 2), time + dt / 2);
  const c = derivative(state.map((v, i) => v + dt * b[i] / 2), time + dt / 2);
  const d = derivative(state.map((v, i) => v + dt * c[i]), time + dt);
  return state.map((v, i) => v + dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6);
}
export const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
export function interpolate(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    const [x0, y0] = table[i - 1];
    if (x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return table.at(-1)[1];
}
