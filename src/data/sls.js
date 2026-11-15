// Artemis-I Block 1 reference, all masses kg, thrust N, Isp s, times s.
// Published dimensions/performance are approximate: https://www.nasa.gov/wp-content/uploads/2021/12/sls_reference_guide_2022_web_0.pdf
export const SLS = {
  payloadMass: 26520, // APPROX Orion + service module/adapters; same NASA guide.
  referenceArea: Math.PI * 8.4 ** 2 / 4, // Core diameter 8.4 m; same NASA guide.
  lasMass: 7600, // APPROX LAS + protective cover; https://www.nasa.gov/reference/orion-launch-abort-system/
  stages: [
    {
      id: 'srb', dryMass: 198000, propellantMass: 1252000, // APPROX combined pair, NASA SLS guide booster section (PDF pp. 47–48).
      burnTime: 126, // APPROX; NASA SLS guide booster burn ~2 min.
      engine: {
        count: 2, thrustSL: 14.7e6, thrustVac: 16e6, // APPROX each, ~3.6 Mlbf peak; NASA SLS guide.
        ispSL: 242, ispVac: 268, // APPROX shuttle-derived five-segment performance, https://ntrs.nasa.gov/citations/20120001536
        // APPROX normalized thrust envelope; not measured flight data. Dip near max-Q, tail-off at 126 s.
        thrustCurve: [[0, .9], [10, 1], [25, 1], [40, .84], [55, .72], [70, .77], [90, .86], [105, .8], [115, .7], [120, .5], [126, 0]]
      }
    },
    {
      id: 'core', dryMass: 85275, propellantMass: 987000, // APPROX NASA core stage fact sheet / guide.
      burnTime: 480, // APPROX nominal; actual duration follows mass flow and guidance, not this number.
      engine: {
        count: 4, thrustSL: 1.86e6, thrustVac: 2.279e6, // APPROX 109% RS-25, NASA guide.
        ispSL: 366, ispVac: 452, // https://www.l3harris.com/all-capabilities/rs-25-engine
        minThrottle: .615 // APPROX 67/109 rated power, same manufacturer RS-25 page.
      }
    },
    {
      id: 'icps', dryMass: 3700, propellantMass: 29048, // APPROX wet mass 32748 kg, NASA guide p. 9.
      engine: {
        count: 1, thrustSL: 110000, thrustVac: 110000, // APPROX vacuum-only RL10B-2; NASA guide.
        ispSL: 465.5, ispVac: 465.5 // https://www.l3harris.com/sites/default/files/2024-07/l3harris-ar-rl10-spec-sheet.pdf
      }
    }
  ]
};

// GAME ASSUMPTION: separately assembled/prepositioned in LEO, NOT lifted by this crew SLS.
// DRA 5.0 concept context: https://ntrs.nasa.gov/citations/20120012928 (3 x 25 klbf, Isp ~900 s).
// Habitat benchmark 27.5 t dry: https://ntrs.nasa.gov/citations/20180008683
export const TRANSIT = {
  dryMass: 40000, propellantMass: 120000, landerMass: 40000,
  isp: 900, thrust: 333600 // APPROX engine performance from DRA study; selected masses are GAME ASSUMPTION.
};

// GAME ASSUMPTION: human-scale lifting lander, NOT Orion. Study context / mass order of magnitude:
// https://ntrs.nasa.gov/citations/20210010609 ; https://www.nas.nasa.gov/SC21/research/project13.html
export const LANDER = {
  dryMass: 24000, propellantMass: 16000, thrust: 800000, isp: 360,
  area: Math.PI * 7.5 ** 2, cd: 1.5, liftToDrag: .24, noseRadius: 7.5,
  entryAltitude: 125000, safeTouchdownSpeed: 2.5
};

// Metabolic rates kg/person/day; dry food and potable/food-preparation water, no recycling credit.
// Exact daily values: NASA Ames NTRS 20160005782, Table 1. https://ntrs.nasa.gov/citations/20160005782
export const CREW_RATES = Object.freeze({ oxygen: .84, water: 3.52, food: .62 });
