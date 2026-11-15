// Reference data for UI explanations only. Never drives İhan's colony rules.
import { CREW_RATES } from '../data/sls.js';
import { SOL } from '../sim/landingPayload.js';

export const REALISM_SOURCES = Object.freeze({
  bvad: { label: 'NASA BVAD · 2022 Rev. 2', url: 'https://ntrs.nasa.gov/citations/20210024855' },
  consumables: { label: "NASA Ames · Daily life support, Table 1", url: 'https://ntrs.nasa.gov/citations/20160005782' },
  mars24: {label:'NASA GISS · Mars24',url:'https://www.giss.nasa.gov/tools/mars24/help/algorithm.html'},
  jezero: {label:"NASA GISS · Perseverance landing site",url:'https://www.giss.nasa.gov/tools/mars24/help/landers.html'},
  rover: {label:"NASA/JPL · Perseverance power system",url:'https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power/'},
  sls: {label:'NASA · Space Launch System',url:'https://www.nasa.gov/reference/space-launch-system/'},
  astronaut: {label:'NASA 3D Resources · Astronaut',url:'https://science.nasa.gov/3d-resources/astronaut/'},
  dra: {label:'NASA · Mars Design Reference Architecture 5.0',url:'https://ntrs.nasa.gov/citations/20120012928'},
  moxie: { label: "NASA/JPL · MOXIE, 6 September 2023", url: 'https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/' },
  solar: { label: "NASA · Mars Fact Sheet / solar irradiance", url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html?level=1' },
  earth: { label: "NASA · Earth fact sheet", url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
  storm: { label: "NASA · Opportunity and the 2018 storm", url: 'https://science.nasa.gov/mission/mer-opportunity/' },
  mars: { label: "NASA · Mars fact sheet", url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
  gravity: { label: "NASA/JPL · Planetary physical parameters", url: 'https://ssd.jpl.nasa.gov/planets/phys_par.html' },
  rems: { label: "NASA/JPL · Curiosity REMS, Gale seasons", url: 'https://www.jpl.nasa.gov/news/second-cycle-of-martian-seasons-completing-for-curiosity-rover/' },
});

export const REALISM = Object.freeze({
  // kg per person per Earth day; drinking/food-preparation water and dry food.
  // NASA Ames NTRS 20160005782, Table 1.
  crewKgPerEarthDay: CREW_RATES,
  // Mean sol, seconds; source and precision are shared with the handoff conversion.
  solSeconds: SOL,
  // https://www.nasa.gov/solar-system/nasas-oxygen-generating-experiment-moxie-completes-mars-mission/
  moxiePeakOxygenKgPerHour: 0.012,
  // Atmosphere-top mean irradiance, W/m²; not surface panel electrical output.
  // NASA Mars Fact Sheet.
  marsSolarIrradiance: 586.2,
  // https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
  earthSolarIrradiance: 1361,
  // Approximate equatorial surface gravity, m/s² (GM / equatorial radius²).
  // https://ssd.jpl.nasa.gov/planets/phys_par.html
  marsGravity: 3.71,
  // Rounded representative surface pressure, Pa; varies by altitude and season.
  // https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
  marsSurfacePressure: 600,
  // Observed air-temperature range during Curiosity's first two Mars years, °C.
  // UI reference only, not a thermal simulation or a global Mars range.
  // https://www.jpl.nasa.gov/news/second-cycle-of-martian-seasons-completing-for-curiosity-rover/
  galeObservedAirCelsius: Object.freeze({ min: -100, max: 15.9 }),
});

const number = (value, digits = 2) => value.toLocaleString("en-US", { maximumFractionDigits: digits });

export const REALISM_NOTES = Object.freeze([
  {
    id: 'supplies', title: "Supplies: person-sols and kilograms", sources: ['consumables', 'bvad', 'mars'],
    // GAME ASSUMPTION: one colony supply unit is one person's requirement for one sol.
    text: `1 game supply unit = 1 person’s needs for 1 sol. NASA Ames Table 1 daily reference per person: ${number(REALISM.crewKgPerEarthDay.oxygen)} kg O₂, ${number(REALISM.crewKgPerEarthDay.water)} kg of drinking/food preparation water and ${number(REALISM.crewKgPerEarthDay.food)} kg of dry food. These rates apply to Earth days; the longer Mars sol is accounted for during the flight–colony handoff. Spare parts are individual units; production and recycling capacities are game values.`,
  },
  {
    id: 'moxie', title: "Oxygen: MOXIE scale", sources: ['moxie'],
    text: `MOXIE aboard Perseverance reached a peak production rate of approximately ${number(REALISM.moxiePeakOxygenKgPerHour * 1000)} g O₂/h. NASA reported a total of 122 g across 16 runs. The colony models 3 banks of 9 MOXIE modules and 15 kg of total storage. At the 6 g/h design reference per unit, full-power output is 162 g/h at 8.1 kW. This layout and operating schedule are game assumptions.`,
  },
  {
    id: 'solar', title: "Sunlight and dust storms", sources: ['solar', 'earth', 'storm'],
    text: `Mean solar irradiance above the atmosphere is approximately ${number(REALISM.marsSolarIrradiance)} W/m² on Mars and ${number(REALISM.earthSolarIrradiance)} W/m² on Earth. Surface light and electrical output are lower and depend on angle, season, dust and efficiency. Solar power fell sharply during Opportunity’s 2018 global dust storm. Game energy/battery units and storm factors are simplified.`,
  },
  {
    id: 'environment', title: "A sol on Mars", sources: ['mars', 'gravity', 'mars24', 'jezero'],
    text: `Surface gravity is approximately ${number(REALISM.marsGravity)} m/s²; representative surface pressure is approximately ${number(REALISM.marsSurfacePressure / 1000)} kPa. One sol is about 24 hours 39 minutes 35 seconds. Solar angles use NASA Mars24 at Perseverance’s landing site, 18.44° N / 77.45° E. Pressure varies with location and season; these values are not live Jezero weather data.`,
  },
  {
    id:'hardware', title:"Flight and surface hardware", sources:['sls','dra','rover','astronaut'],
    text:"SLS Block 1 uses four RS-25 engines and two solid rocket boosters. Perseverance’s MMRTG initially provided about 110 W. Rover and astronaut assets come from NASA’s published 3D models. The transfer vehicle and crewed Mars lander are concepts. The rover dock, water drill, greenhouse, 420 panels, 180 kWh storage and dust schedule are game designs.",
  },
  {
    id: 'temperature', title: "Temperature at Gale: Curiosity / REMS", sources: ['rems'],
    // https://www.jpl.nasa.gov/news/second-cycle-of-martian-seasons-completing-for-curiosity-rover/
    text: `During Curiosity’s first two Mars years, REMS measured air temperatures at Gale from ${number(REALISM.galeObservedAirCelsius.min)} °C to +${number(REALISM.galeObservedAirCelsius.max)} °C. Daytime temperatures can rise above freezing and fall below −90 °C at night. This observed range is not a planet-wide limit or Jezero forecast. Air and ground temperatures differ; colony health and greenhouse rules do not include a detailed thermal model.`,
  },
]);
