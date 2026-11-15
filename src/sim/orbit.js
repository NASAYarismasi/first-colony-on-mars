/** Cartesian vectors in metres and m/s; angles in radians. Elliptic elements use a prograde reference plane.
 * @typedef {{position: number[], velocity: number[]}} OrbitalState
 * @typedef {{a: number, e: number, inclination?: number, raan?: number, argumentOfPeriapsis?: number, trueAnomaly?: number}} OrbitalElements
 */
export const norm = v => Math.hypot(...v);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = x => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
const safeAcos = x => Math.acos(Math.max(-1, Math.min(1, x)));
export const visViva = (mu, r, a) => Math.sqrt(mu * (2 / r - 1 / a));
export const orbitalPeriod = (mu, a) => 2 * Math.PI * Math.sqrt(a ** 3 / mu);
export const specificEnergy = ({ position, velocity }, mu) => dot(velocity, velocity) / 2 - mu / norm(position);

/** @param {OrbitalState} state @param {number} mu Gravitational parameter in m³/s². */
export function stateToElements({ position: r, velocity: v }, mu) {
  const radius = norm(r), h = cross(r, v), hn = norm(h);
  const node = [-h[1], h[0], 0], nn = norm(node);
  const vxh = cross(v, h);
  const ev = r.map((x, i) => vxh[i] / mu - x / radius);
  const e = norm(ev), energy = specificEnergy({ position: r, velocity: v }, mu);
  const a = -mu / (2 * energy);
  const inclination = safeAcos(h[2] / hn);
  const raan = nn > 1e-8 ? angle(Math.atan2(node[1], node[0])) : 0;
  let argumentOfPeriapsis = e > 1e-10 ? angle(Math.atan2(ev[1], ev[0])) : 0;
  if (nn > 1e-8 && e > 1e-10) {
    argumentOfPeriapsis = safeAcos(dot(node, ev) / (nn * e));
    if (ev[2] < 0) argumentOfPeriapsis = 2 * Math.PI - argumentOfPeriapsis;
  }
  let trueAnomaly;
  if (e > 1e-10) {
    trueAnomaly = safeAcos(dot(ev, r) / (e * radius));
    if (dot(r, v) < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  } else if (nn > 1e-8) {
    trueAnomaly = safeAcos(dot(node, r) / (nn * radius));
    if (r[2] < 0) trueAnomaly = 2 * Math.PI - trueAnomaly;
  } else trueAnomaly = angle(Math.atan2(r[1], r[0]));
  const p = hn ** 2 / mu;
  return { a, e, inclination, raan, argumentOfPeriapsis, trueAnomaly, periapsis: p / (1 + e), apoapsis: e < 1 ? p / (1 - e) : Infinity, energy };
}
/** @param {OrbitalElements} elements @param {number} mu @returns {OrbitalState} */
export function elementsToState({ a, e = 0, inclination = 0, raan = 0, argumentOfPeriapsis = 0, trueAnomaly = 0 }, mu) {
  const p = a * (1 - e * e), r = p / (1 + e * Math.cos(trueAnomaly));
  const cO = Math.cos(raan), sO = Math.sin(raan), ci = Math.cos(inclination), si = Math.sin(inclination);
  const cw = Math.cos(argumentOfPeriapsis), sw = Math.sin(argumentOfPeriapsis);
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const c = Math.cos(trueAnomaly), s = Math.sin(trueAnomaly), k = Math.sqrt(mu / p);
  return { position: P.map((x, i) => r * (c * x + s * Q[i])), velocity: P.map((x, i) => k * (-s * x + (e + c) * Q[i])) };
}
export function eccentricAnomaly(mean, e) {
  let E = e < .8 ? mean : Math.PI;
  for (let i = 0; i < 40; i++) {
    const correction = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
    E -= correction;
    if (Math.abs(correction) < 1e-14) break;
  }
  return E;
}
/** Exact two-body elliptic Kepler propagation (no accumulated numerical integration drift). */
export function propagateKepler(state, dt, mu) {
  const elements = stateToElements(state, mu);
  const { e, a, trueAnomaly: nu } = elements;
  if (!(e < 1) || !(a > 0)) throw new RangeError('Kepler propagation requires a bound elliptic orbit');
  const E0 = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2));
  const mean = angle(E0 - e * Math.sin(E0) + Math.sqrt(mu / a ** 3) * dt);
  const E = eccentricAnomaly(mean, e);
  return elementsToState({ ...elements, trueAnomaly: 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2)) }, mu);
}
/** Convert planar polar position/velocity to an inertial Cartesian state. */
export function polarState([r, theta, vr, vt]) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return { position: [r * c, r * s, 0], velocity: [vr * c - vt * s, vr * s + vt * c, 0] };
}
