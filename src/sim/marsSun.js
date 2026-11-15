/**
 * NASA GISS Mars24 / Allison & McEwen (2000), equations A–D.
 * https://www.giss.nasa.gov/tools/mars24/help/algorithm.html
 * Public interface: seconds and radians (LMST uses a 86400-second Mars clock).
 * Azimuth is clockwise from north; east longitude is positive.
 */
import { AU } from './constants.js';

const RAD = Math.PI / 180;
const DAY = 86400;
export const MARS_SOL_SECONDS = 1.0274912517 * DAY;
// Octavia E. Butler Landing, NASA GISS: https://www.giss.nasa.gov/tools/mars24/help/landers.html
export const JEZERO = Object.freeze({ latitude: 18.44 * RAD, longitude: 77.45 * RAD });
const wrap = (n, period) => ((n % period) + period) % period;
const sin = deg => Math.sin(deg * RAD);
const cos = deg => Math.cos(deg * RAD);
// Mars24 B-3: amplitude (degrees), period (Julian years), phase (degrees).
const PERTURBERS = [[.0071, 2.2353, 49.409], [.0057, 2.7543, 168.173],
  [.0039, 1.1177, 191.837], [.0037, 15.7866, 21.736], [.0021, 2.1354, 15.704],
  [.0020, 2.4694, 95.528], [.0018, 32.8493, 49.095]];
// TAI−UTC effective dates, NASA/USNO: https://maia.usno.navy.mil/ser7/tai-utc.dat
const LEAPS = [
  ['1972-01-01',10],['1972-07-01',11],['1973-01-01',12],['1974-01-01',13],
  ['1975-01-01',14],['1976-01-01',15],['1977-01-01',16],['1978-01-01',17],
  ['1979-01-01',18],['1980-01-01',19],['1981-07-01',20],['1982-07-01',21],
  ['1983-07-01',22],['1985-07-01',23],['1988-01-01',24],['1990-01-01',25],
  ['1991-01-01',26],['1992-07-01',27],['1993-07-01',28],['1994-07-01',29],
  ['1996-01-01',30],['1997-07-01',31],['1999-01-01',32],['2006-01-01',33],
  ['2009-01-01',34],['2012-07-01',35],['2015-07-01',36],['2017-01-01',37],
].map(([date, offset]) => [Date.parse(date + 'T00:00:00Z') / 1000, offset]);

export function terrestrialOffset(unixSeconds) {
  for (let i = LEAPS.length - 1; i >= 0; i--) {
    if (unixSeconds >= LEAPS[i][0]) return 32.184 + LEAPS[i][1];
  }
  const t = (2440587.5 + unixSeconds / DAY - 2451545) / 36525;
  return 64.184 + 59*t - 51.2*t**2 - 67.1*t**3 - 16.4*t**4;
}

/** @param {number} unixSeconds UTC Unix time, seconds; leap seconds are POSIX-style. */
export function marsSun(unixSeconds, { latitude = JEZERO.latitude, longitude = JEZERO.longitude,
  ttMinusUtc = terrestrialOffset(unixSeconds) } = {}) {
  if (![unixSeconds, latitude, longitude, ttMinusUtc].every(Number.isFinite) || Math.abs(latitude) > Math.PI / 2) {
    throw new RangeError('Invalid Mars solar coordinates or time');
  }
  const julianDateTT = 2440587.5 + (unixSeconds + ttMinusUtc) / DAY;
  const d = julianDateTT - 2451545;
  const meanAnomaly = 19.3871 + .52402073 * d;
  const fictitiousMeanSun = 270.3871 + .524038496 * d;
  const perturbation = PERTURBERS.reduce((sum, [a, period, phase]) => sum + a*cos(.985626*d/period + phase), 0);
  const center = (10.691 + 3e-7*d)*sin(meanAnomaly) + .623*sin(2*meanAnomaly) +
    .050*sin(3*meanAnomaly) + .005*sin(4*meanAnomaly) + .0005*sin(5*meanAnomaly) + perturbation;
  const lsDeg = fictitiousMeanSun + center;
  const equationOfTime = (2.861*sin(2*lsDeg) - .071*sin(4*lsDeg) + .002*sin(6*lsDeg) - center)*RAD;
  const marsSolDate = (julianDateTT - 2451549.5) / 1.0274912517 + 44796 - .0009626;
  const lmst = wrap(marsSolDate * DAY + longitude * DAY / (2*Math.PI), DAY);
  const ltst = wrap(lmst + equationOfTime * DAY / (2*Math.PI), DAY);
  const declination = Math.asin(.42565*sin(lsDeg)) + .25*RAD*sin(lsDeg);
  const hourAngle = (ltst / DAY - .5)*2*Math.PI;
  const elevation = Math.asin(Math.max(-1, Math.min(1,
    Math.sin(latitude)*Math.sin(declination) + Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle))));
  // East component is −sin(H): an afternoon sun must be in the western sky.
  const azimuth = wrap(Math.atan2(-Math.sin(hourAngle),
    Math.cos(latitude)*Math.tan(declination) - Math.sin(latitude)*Math.cos(hourAngle)), 2*Math.PI);
  const distanceAU = 1.52367934*(1.00436 - .09309*cos(meanAnomaly) - .004336*cos(2*meanAnomaly) -
    .00031*cos(3*meanAnomaly) - .00003*cos(4*meanAnomaly));
  return { unixSeconds, julianDateTT, marsSolDate, ls: wrap(lsDeg, 360)*RAD, lmst, ltst,
    declination, elevation, azimuth, equationOfTime, distance: distanceAU * AU };
}

// GAME ASSUMPTION: one sol elapses in ten real minutes; warp never changes colony resource rules.
export const SURFACE_SOL_REAL_SECONDS = 600;
export function advanceSurfaceTime(unixSeconds, realSeconds, warp = 1) {
  if (!Number.isFinite(unixSeconds) || !Number.isFinite(realSeconds) || realSeconds < 0 || ![1, 10, 60].includes(warp)) {
    throw new RangeError('Invalid surface clock step');
  }
  return unixSeconds + realSeconds * MARS_SOL_SECONDS / SURFACE_SOL_REAL_SECONDS * warp;
}

/** Move to 07:00 on the following local Mars calendar day, including from before 07:00. */
export function nextMarsMorning(unixSeconds, longitude = JEZERO.longitude) {
  const { lmst } = marsSun(unixSeconds, { longitude });
  return unixSeconds + (DAY - lmst + 7*3600) / DAY * MARS_SOL_SECONDS;
}

/** Same local day, chosen LMST. Used only for the deterministic demo epoch/reset. */
export function atLocalTime(unixSeconds, clockSeconds, longitude = JEZERO.longitude) {
  if (!Number.isFinite(clockSeconds) || clockSeconds < 0 || clockSeconds >= DAY) throw new RangeError('Invalid LMST');
  return unixSeconds + (clockSeconds - marsSun(unixSeconds, { longitude }).lmst) / DAY * MARS_SOL_SECONDS;
}
