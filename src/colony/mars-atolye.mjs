export const materialNames = {
  mineral: "Ore", ice: "Ice", water: "Purified water", waste: "Separated urine",
  nitrate: "Recovered nitrogen", nutrients: "Nutrient solution", mineralMix: "Mineral mix",
  tubers: "Seed tuber", seeds: "Bean seeds", saplings: "Grafted apple sapling",
  potato: "Potatoes", bean: "Beans", apple: "Apple",
  credits: "Credits",
}

export const nodes = [
  { id: "ore-west", x: -10, z: 8, material: "mineral", amount: 4 },
  { id: "ore-east", x: 5, z: 5, material: "mineral", amount: 4 },
  { id: "ore-north", x: -4, z: -7, material: "mineral", amount: 4 },
  { id: "ice-west", x: -8, z: 2, material: "ice", amount: 3 },
  { id: "ice-east", x: 10, z: 10, material: "ice", amount: 3 },
  { id: "ice-north", x: 5, z: -9, material: "ice", amount: 3 },
]

export const crops = {
  potatoPod: { yield: "potato", sols: 2, amount: 4, price: 4, xp: 5 },
  beanPod: { yield: "bean", sols: 2, amount: 4, price: 6, xp: 7 },
  treePod: { yield: "apple", sols: 3, amount: 5, price: 8, xp: 10 },
}

export const recipes = [
  { id: "water", name: "Purify ice", skill: "mining", level: 1, cost: { ice: 1 }, reward: { water: 3 } },
  { id: "nitrate", name: "Treat urine, recover nitrogen", skill: "farming", level: 1,
    cost: { waste: 2 }, reward: { nitrate: 2 } },
  { id: "nutrients", name: "Prepare nutrient solution", skill: "farming", level: 1,
    cost: { nitrate: 1, water: 1, mineralMix: 1 }, reward: { nutrients: 2 } },
  { id: "potatoPod", name: "Build potato pod", skill: "farming", level: 1,
    cost: { mineral: 2, credits: 4, nutrients: 1, tubers: 1 } },
  { id: "beanPod", name: "Build bean pod", skill: "farming", level: 2,
    cost: { mineral: 2, credits: 9, nutrients: 1, seeds: 1 } },
  { id: "treePod", name: "Build dwarf apple pod", skill: "farming", level: 3,
    cost: { mineral: 3, credits: 16, nutrients: 2, saplings: 1 } },
  { id: "battery", name: "Build additional battery", skill: "mining", level: 1, cost: { mineral: 4, credits: 12 } },
  { id: "solarPanel", name: "Build additional solar panel", skill: "mining", level: 2, cost: { mineral: 4, credits: 16 } },
]

export const levelOf = xp => xp >= 14 ? 3 : xp >= 5 ? 2 : 1

export function startWorkshop() {
  return {
    stock: { mineral: 2, ice: 1, water: 0, waste: 2, nitrate: 0, nutrients: 0, mineralMix: 8,
      tubers: 3, seeds: 2, saplings: 1, potato: 0, bean: 0, apple: 0, credits: 6 },
    xp: { mining: 0, farming: 0 },
    collected: {}, growing: {}, crafted: 0,
  }
}

export function recipeError(workshop, recipe) {
  if (levelOf(workshop.xp[recipe.skill]) < recipe.level) {
    return (recipe.skill === "mining" ? "Mining" : "Farming") + " level " + recipe.level + " required."
  }
  const missing = Object.entries(recipe.cost).filter(([id, amount]) => workshop.stock[id] < amount)
  return missing.length ? "Missing: " + missing.map(([id, amount]) => (amount - workshop.stock[id]) + " " + materialNames[id]).join(", ") : ""
}

export function craft(workshop, id) {
  const recipe = recipes.find(recipe => recipe.id === id)
  if (!recipe) throw new RangeError("Recipe not found.")
  const error = recipeError(workshop, recipe)
  if (error) throw new RangeError(error)
  const stock = { ...workshop.stock }
  for (const [id, amount] of Object.entries(recipe.cost)) stock[id] -= amount
  for (const [id, amount] of Object.entries(recipe.reward ?? {})) stock[id] += amount
  return { ...workshop, stock, crafted: workshop.crafted + 1 }
}

export function collect(workshop, id, sol) {
  const node = nodes.find(node => node.id === id)
  if (!node || workshop.collected[id] === sol) throw new RangeError("This deposit can be surveyed again next sol.")
  return {
    ...workshop,
    collected: { ...workshop.collected, [id]: sol },
    stock: { ...workshop.stock, [node.material]: workshop.stock[node.material] + node.amount },
    xp: { ...workshop.xp, mining: workshop.xp.mining + 2 },
  }
}

export function grow(workshop, colony) {
  const day = colony.timeline.at(-1)
  const growing = { ...workshop.growing }
  if (day.cropPower ?? day.produced.food > 0) {
    for (const unit of colony.placed) {
      const crop = crops[unit.type]
      if (crop && unit.active && growing[unit.id] !== null) {
        growing[unit.id] = Math.min(crop.sols, (growing[unit.id] ?? 0) + 1)
      }
    }
  }
  const waste = day.needs.habitat ? colony.crew.filter(person => person.health > 0).length : 0
  return { ...workshop, growing, stock: { ...workshop.stock, waste: workshop.stock.waste + waste } }
}

export function harvest(workshop, unit) {
  const crop = crops[unit.type]
  if (!crop || (workshop.growing[unit.id] ?? 0) < crop.sols) throw new RangeError("Crop not yet mature.")
  return {
    ...workshop,
    growing: { ...workshop.growing, [unit.id]: null },
    stock: { ...workshop.stock, [crop.yield]: workshop.stock[crop.yield] + crop.amount },
    xp: { ...workshop.xp, farming: workshop.xp.farming + crop.xp },
  }
}

export function replant(workshop, unit) {
  if (workshop.growing[unit.id] !== null) throw new RangeError("Complete the harvest first.")
  const plant = { potatoPod: "tubers", beanPod: "seeds" }[unit.type]
  if (workshop.stock.nutrients < 1 || (plant && workshop.stock[plant] < 1)) {
    throw new RangeError("For the next cycle, prepare 1 nutrient solution" +
      (plant ? " and 1 " + materialNames[plant].toLowerCase() + " prepare." : " prepare."))
  }
  const stock = { ...workshop.stock, nutrients: workshop.stock.nutrients - 1 }
  if (plant) stock[plant] -= 1
  return { ...workshop, stock, growing: { ...workshop.growing, [unit.id]: 0 } }
}

export function sell(workshop, id) {
  const crop = Object.values(crops).find(crop => crop.yield === id)
  const price = crop?.price ?? (id === "mineral" ? 2 : 0)
  if (!price || !workshop.stock[id]) throw new RangeError("No produce to deliver.")
  return { ...workshop, stock: { ...workshop.stock, [id]: workshop.stock[id] - 1, credits: workshop.stock.credits + price } }
}
