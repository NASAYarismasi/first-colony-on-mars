import { DAY } from './constants.js';

// Curiosity RAD, Gale Crater. https://ntrs.nasa.gov/citations/20240009831
export const GALE_SURFACE_SV_PER_SECOND = .64e-3 / DAY;
export const GALE_SURFACE_GY_PER_SECOND = .21e-3 / DAY;
export const MSL_TRANSIT_SV_PER_SECOND = 1.7e-3 / DAY;

// GAME ASSUMPTION: the habitat halves exposure. The EVA suit, greenhouse
// and spacecraft receive no extra shielding credit in this surface model.
export const HABITAT_DOSE_FACTOR = .5;

export function radiationAt(sheltered) {
  const factor = sheltered ? HABITAT_DOSE_FACTOR : 1;
  return {
    sheltered,
    equivalentSvPerSecond: GALE_SURFACE_SV_PER_SECOND * factor,
    absorbedGyPerSecond: GALE_SURFACE_GY_PER_SECOND * factor,
  };
}

export function advanceRadiation(previous, seconds, sheltered) {
  const {equivalentSvPerSecond,absorbedGyPerSecond} = radiationAt(sheltered);
  return {
    equivalentSv: (previous?.equivalentSv ?? 0) + seconds * equivalentSvPerSecond,
    absorbedGy: (previous?.absorbedGy ?? 0) + seconds * absorbedGyPerSecond,
  };
}
