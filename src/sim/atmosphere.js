import { G0, P0 } from './constants.js';

// US Standard Atmosphere 1976, geopotential layers: https://ntrs.nasa.gov/citations/19770009539
const R = 287.05287;
/** @typedef {{density: number, pressure: number, temperature: number, speedOfSound: number}} Atmosphere */
const layers = [[0, -.0065], [11000, 0], [20000, .001], [32000, .0028], [47000, 0], [51000, -.0028], [71000, -.002], [84852, 0]];
let temperature = 288.15;
let pressure = P0;
for (let i = 0; i < layers.length; i++) {
  const layer = layers[i];
  if (i) {
    const [base, lapse, t, p] = layers[i - 1];
    const dh = layer[0] - base;
    temperature = t + lapse * dh;
    pressure = lapse === 0 ? p * Math.exp(-G0 * dh / (R * t)) : p * (t / temperature) ** (G0 / (R * lapse));
  }
  layer.push(temperature, pressure);
}
/** @param {number} altitude Geometric metres above surface. @returns {Atmosphere} */
export function earthAtmosphere(altitude) {
  const z = Math.max(0, altitude);
  const h = 6356766 * z / (6356766 + z); // USSA geopotential conversion.
  let layer = layers[0];
  for (const candidate of layers) if (h >= candidate[0]) layer = candidate;
  const [base, lapse, t, p] = layer;
  const dh = h - base;
  let temperature = t + lapse * dh;
  let pressure = lapse === 0 ? p * Math.exp(-G0 * dh / (R * t)) : p * (t / temperature) ** (G0 / (R * lapse));
  if (z > 86000) {
    // APPROX: continuous isothermal tail, not a thermosphere/weather model.
    const edge = earthAtmosphere(86000);
    temperature = edge.temperature;
    pressure = edge.pressure * Math.exp(-(z - 86000) / (R * temperature / G0));
  }
  return { density: pressure / (R * temperature), pressure, temperature, speedOfSound: Math.sqrt(1.4 * R * temperature) };
}
/** @param {number} altitude Metres above the reference surface. @returns {Atmosphere} */
export function marsAtmosphere(altitude) {
  // NASA Glenn two-zone engineering fit: https://www.grc.nasa.gov/www/k-12/airplane/atmosmrm.html
  const h = Math.max(0, altitude);
  // APPROX: clamp temperature above the fit's useful range to avoid negative Kelvin at entry interface.
  const temperature = Math.max(130, (h < 7000 ? -31 - .000998 * h : -23.4 - .00222 * h) + 273.15);
  const pressure = 699 * Math.exp(-.00009 * h);
  const density = pressure / (192.1 * temperature);
  return { density, pressure, temperature, speedOfSound: Math.sqrt(1.29 * 192.1 * temperature) };
}
