import { AU, DAY, EARTH, MARS, SUN } from './constants.js';
import { eccentricAnomaly } from './orbit.js';
import { propellantForDeltaV } from './vehicle.js';

// APPROX mean circular Mars orbit, https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
const earthRadius = AU, marsRadius = 1.523679 * AU;
export function hohmannTransfer({ earthAltitude = 200000, marsAltitude = 250000 } = {}) {
  const a = (earthRadius + marsRadius) / 2, e = (marsRadius - earthRadius) / (marsRadius + earthRadius);
  const duration = Math.PI * Math.sqrt(a ** 3 / SUN.mu);
  const marsRate = Math.sqrt(SUN.mu / marsRadius ** 3);
  const earthVInfinity = Math.sqrt(SUN.mu * (2 / earthRadius - 1 / a)) - Math.sqrt(SUN.mu / earthRadius);
  const marsVInfinity = Math.sqrt(SUN.mu / marsRadius) - Math.sqrt(SUN.mu * (2 / marsRadius - 1 / a));
  const burn = (mu, r, excess) => Math.sqrt(excess ** 2 + 2 * mu / r) - Math.sqrt(mu / r);
  return { a, e, duration, phaseAngle: Math.PI - marsRate * duration, earthVInfinity, marsVInfinity,
    departureDeltaV: burn(EARTH.mu, EARTH.radius + earthAltitude, earthVInfinity),
    captureDeltaV: burn(MARS.mu, MARS.radius + marsAltitude, marsVInfinity) };
}
export const TRANSFER = Object.freeze(hohmannTransfer());
/** SI heliocentric positions at elapsed transfer time; circular coplanar planets. */
export function heliocentricAt(time, transfer = TRANSFER) {
  const E = eccentricAnomaly(Math.PI * time / transfer.duration, transfer.e);
  const r = transfer.a * (1 - transfer.e * Math.cos(E));
  const earthAngle = Math.sqrt(SUN.mu / earthRadius ** 3) * time;
  const marsAngle = transfer.phaseAngle + Math.sqrt(SUN.mu / marsRadius ** 3) * time;
  return { ship: [transfer.a * (Math.cos(E) - transfer.e), transfer.a * Math.sqrt(1 - transfer.e ** 2) * Math.sin(E)],
    earth: [earthRadius * Math.cos(earthAngle), earthRadius * Math.sin(earthAngle)],
    mars: [marsRadius * Math.cos(marsAngle), marsRadius * Math.sin(marsAngle)], speed: Math.sqrt(SUN.mu * (2 / r - 1 / transfer.a)), time };
}
export function consumeManeuver(vehicle, deltaV) {
  const mass = vehicle.dryMass + vehicle.payloadMass + vehicle.propellant;
  const used = propellantForDeltaV(mass, deltaV, vehicle.isp);
  if (used > vehicle.propellant + 1e-8) throw new RangeError('Insufficient maneuver propellant');
  vehicle.propellant = Math.max(0, vehicle.propellant - used);
  return used;
}
// Presentation adapters deliberately live outside the pure simulation; all values here remain SI.
export const travelTime = TRANSFER.duration;
