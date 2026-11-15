// SI throughout. Planetary data: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
// Gravitational parameters: https://ssd.jpl.nasa.gov/astro_par.html
export const G = 6.67430e-11;
export const G0 = 9.80665; // Standard gravity, https://physics.nist.gov/cgi-bin/cuu/Value?gn
export const AU = 149597870700; // Exact IAU definition, https://ssd.jpl.nasa.gov/astro_par.html
export const DAY = 86400;
export const EARTH = Object.freeze({ mu: 3.986004418e14, radius: 6378137, rotation: 7.2921159e-5 });
export const MARS = Object.freeze({ mu: 4.282837e13, radius: 3389500, rotation: 7.088218e-5 });
export const SUN = Object.freeze({ mu: 1.32712440018e20 });
export const P0 = 101325; // USSA 1976, https://ntrs.nasa.gov/citations/19770009539
export const KSC_LATITUDE = 28.627 * Math.PI / 180; // APPROX LC-39B, https://www.nasa.gov/centers-and-facilities/kennedy/launch-pad-39b/
// GAME ASSUMPTION: project the KSC eastward rotation boost into a planar orbit.
export const EARTH_SURFACE_RATE = EARTH.rotation * Math.cos(KSC_LATITUDE);
