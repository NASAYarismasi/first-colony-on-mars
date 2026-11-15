// Illustrative sizing inputs. Hardware masses and loop efficiencies are scenario values.
export const rates = { water: 3.52, oxygen: .84, food: .8 }
export const transitDays = 259
const oxygenReserveDays = 2
const solDays = 1.0275
export const cargoOptions = {
  waterRecycler: { name: "Wastewater treatment unit", kg: 280, description: "Recovers water from condensed vapor and liquid waste." },
  oxygenUnit: { name: "Water electrolysis unit", kg: 160, description: "Generates oxygen using electricity and water." },
  greenhouse: { name: "Enclosed greenhouse", kg: 330, description: "Provides lighting and climate control. Crops are planted separately." },
  backupPower: { name: "Spare solar panel", kg: 115, description: "Generates during storms too. Dust reduces output." },
  backupBattery: { name: "Additional battery", kg: 95, description: "Covers the energy shortfall when solar generation falls." },
}
export const defaultManifest = {
  mealDays: 14, waterDays: 8, oxygenDays: 8, spareParts: 2, driedMealShare: .5,
  equipment: Object.keys(cargoOptions),
}
const baseHardware = [
  { name: "Pressurized habitat, airlock and cabin controls", kg: 1800, module: "habitat" },
  { name: "CO₂ scrubber, filters and cabin ventilation", kg: 155, module: "airScrubber" },
  { name: "Solar panel", kg: 115, module: "solarPanel" },
  { name: "Battery", kg: 95, module: "battery" },
  { name: "Water and oxygen tanks, food heater and dispenser", kg: 160 },
  { name: "Spacesuits, airlock service kit and personal equipment", kg: 320 },
  { name: "Medical kit, communications and repair tools", kg: 105 },
]
export const cargoLimitKg = 4000

export function planMission(manifest) {
  const { mealDays, waterDays, oxygenDays, spareParts, driedMealShare, equipment } = manifest
  if (![mealDays, waterDays, oxygenDays, spareParts].every(Number.isInteger) ||
      mealDays < 2 || mealDays > 20 || waterDays < 2 || waterDays > 20 ||
      oxygenDays < 2 || oxygenDays > 20 || spareParts < 0 || spareParts > 6 ||
      ![0, .5, 1].includes(driedMealShare) || !Array.isArray(equipment) ||
      new Set(equipment).size !== equipment.length || !equipment.every(id => Object.hasOwn(cargoOptions, id))) {
    throw new RangeError("Check your supply and equipment selections.")
  }

  const crew = [1, 2, 3].map(index => ({ id: "astronaut-" + index, health: 100 }))
  const transitPersonDays = transitDays * crew.length
  const transitOxygenKg = transitPersonDays * rates.oxygen
  const transit = {
    // Regenerative flight hardware is on the transfer vehicle.
    foodKg: transitPersonDays * rates.food,
    waterKg: transitPersonDays * rates.water * .15 + transitOxygenKg * (9 / 8),
    oxygenReserveKg: oxygenReserveDays * crew.length * rates.oxygen,
  }
  const cargo = [
    ...baseHardware,
    ...equipment.map(id => ({ ...cargoOptions[id], module: ({ backupPower: "solarPanel", backupBattery: "battery" })[id] ?? id })),
    { name: "Packaged meals", kg: mealDays * crew.length * solDays * (.95 - .3 * driedMealShare) },
    { name: "Drinking and food preparation water", kg: waterDays * crew.length * solDays * rates.water },
    { name: "Stored oxygen", kg: oxygenDays * crew.length * solDays * rates.oxygen },
    { name: "Spare parts", kg: spareParts * 16 },
  ]
  const massKg = cargo.reduce((total, item) => total + item.kg, 0)
  return {
    transit, cargo, massKg, withinLimit: massKg <= cargoLimitKg,
    landing: {
      crew,
      supplies: { food: mealDays, water: waterDays, oxygen: oxygenDays, spareParts },
      modules: cargo.flatMap(item => item.module ? [item.module] : []),
      landingSite: "flat", surfaceEnergy: 10,
    },
    operations: { driedMealShare },
  }
}
