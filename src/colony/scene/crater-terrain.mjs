// Adapted from Ilhan's crater-ecosystem.mjs; GAME ASSUMPTION: illustrative morphology, not a registered DEM.
// Central pad reduced to 60 m diameter; regional Jezero context is provided separately.
const CRATERS = [
  // Primary giant impact basins (visible in wide panorama like BBC photo)
  { cx: -32, cz: -48, r: 72, depth: 18.5, rimH: 5.2, peak: true, rays: 14 },
  { cx: 48,  cz: 28,  r: 54, depth: 14.0, rimH: 4.2, peak: true, rays: 11 },
  { cx: -52, cz: 45,  r: 46, depth: 11.5, rimH: 3.6, peak: false, rays: 8 },
  { cx: 62,  cz: -52, r: 60, depth: 15.5, rimH: 4.6, peak: true, rays: 12 },
  
  // Secondary impact craters (scattered across the ridges and terraces)
  { cx: -12, cz: -14, r: 24, depth: 6.8, rimH: 2.1, peak: false, rays: 6 },
  { cx: 18,  cz: -28, r: 20, depth: 5.5, rimH: 1.7, peak: false, rays: 5 },
  { cx: -6,  cz: 32,  r: 22, depth: 5.8, rimH: 1.8, peak: false, rays: 6 },
  { cx: 32,  cz: -10, r: 18, depth: 4.8, rimH: 1.5, peak: false, rays: 4 },
  { cx: -68, cz: -8,  r: 28, depth: 7.5, rimH: 2.3, peak: false, rays: 7 },
  { cx: 14,  cz: 68,  r: 30, depth: 8.2, rimH: 2.5, peak: false, rays: 8 },
  { cx: 75,  cz: 12,  r: 25, depth: 6.9, rimH: 2.2, peak: false, rays: 6 },
  
  // Tertiary impact craters (prominent in midground & walking views)
  { cx: 6,   cz: -4,  r: 10, depth: 2.8, rimH: 0.95, peak: false },
  { cx: -20, cz: 14,  r: 13, depth: 3.4, rimH: 1.1, peak: false },
  { cx: 25,  cz: 40,  r: 14, depth: 3.7, rimH: 1.2, peak: false },
  { cx: -36, cz: -20, r: 9,  depth: 2.4, rimH: 0.8, peak: false },
  { cx: 46,  cz: 6,   r: 12, depth: 3.2, rimH: 1.0, peak: false },
  { cx: -10, cz: -62, r: 16, depth: 4.2, rimH: 1.3, peak: false },
  { cx: 70,  cz: -18, r: 17, depth: 4.5, rimH: 1.4, peak: false },
  { cx: -68, cz: 42,  r: 15, depth: 3.9, rimH: 1.2, peak: false },
  { cx: 0,   cz: 22,  r: 8,  depth: 2.2, rimH: 0.75, peak: false },
  { cx: -30, cz: 30,  r: 7,  depth: 1.9, rimH: 0.65, peak: false },
  { cx: 34,  cz: -36, r: 9,  depth: 2.5, rimH: 0.8, peak: false },
  { cx: 14,  cz: -46, r: 6,  depth: 1.6, rimH: 0.55, peak: false },
  { cx: -16, cz: -36, r: 8,  depth: 2.1, rimH: 0.7, peak: false },
  { cx: -50, cz: -56, r: 11, depth: 2.9, rimH: 0.95, peak: false },
  { cx: 42,  cz: 58,  r: 11, depth: 3.0, rimH: 0.95, peak: false },
  { cx: -3,  cz: -22, r: 7,  depth: 1.8, rimH: 0.6, peak: false },
  { cx: -24, cz: -2,  r: 8,  depth: 2.2, rimH: 0.7, peak: false },
  { cx: 18,  cz: 16,  r: 7,  depth: 1.9, rimH: 0.65, peak: false },
  { cx: -42, cz: 20,  r: 10, depth: 2.7, rimH: 0.85, peak: false },
  { cx: 55,  cz: 42,  r: 12, depth: 3.2, rimH: 1.0, peak: false },
  
  // Field of small pockmarks near the base
  { cx: 8,   cz: 8,   r: 4.2, depth: 1.1, rimH: 0.38, peak: false },
  { cx: -7,  cz: 5,   r: 3.8, depth: 0.95, rimH: 0.32, peak: false },
  { cx: 3,   cz: -12, r: 4.5, depth: 1.2, rimH: 0.4, peak: false },
  { cx: -14, cz: -4,  r: 4.0, depth: 1.0, rimH: 0.35, peak: false },
  { cx: 12,  cz: -2,  r: 3.5, depth: 0.85, rimH: 0.3, peak: false },
  { cx: -4,  cz: -16, r: 3.2, depth: 0.8, rimH: 0.28, peak: false },
  { cx: 7,   cz: 18,  r: 4.8, depth: 1.3, rimH: 0.42, peak: false }
]

// Flat colony and landing zones; blend smoothly from inner to outer radius.
const FLAT_ZONES = [
  { cx: 0, cz: 0, inner: 30, outer: 60 },      // Colony pad
  { cx: -150, cz: 130, inner: 42, outer: 78 }, // Western landing plain
  { cx: 160, cz: -140, inner: 46, outer: 84 }, // Eastern landing plain
  { cx: 110, cz: 150, inner: 36, outer: 68 },  // Southern plain
]

// Reduced crater relief for the illustrative Mars plain.
const CRATER_DEPTH_SCALE = 0.66
const CRATER_RIM_SCALE = 0.8

function regionalHeight(x, z) {
  return 4.2 * Math.sin(x * 0.016 + z * 0.012) +
         2.8 * Math.cos(x * 0.009 - z * 0.021) +
         1.1 * Math.sin(x * 0.038 - z * 0.031)
}

// Unflattened elevation.
function rawTerrainHeight(x, z) {
  let y = regionalHeight(x, z)

  // 2. Accumulate impact crater morphologies
  for (let i = 0; i < CRATERS.length; i++) {
    const c = CRATERS[i]
    const dx = x - c.cx
    const dz = z - c.cz
    const d = Math.hypot(dx, dz)
    const rho = d / c.r

    if (rho < 2.8) {
      if (rho < 1.0) {
        const innerSlope = Math.pow(Math.max(0, 1.0 - rho * rho), 0.72)
        const bowl = -c.depth * innerSlope
        const rimInfluence = c.rimH * Math.exp(-Math.pow((rho - 1.0) / 0.15, 2))

        let peakH = 0
        if (c.peak && rho < 0.28) {
          peakH = (c.depth * 0.42) * Math.exp(-Math.pow(rho / 0.09, 2))
        }

        y += (bowl + peakH) * CRATER_DEPTH_SCALE + rimInfluence * CRATER_RIM_SCALE
      } else {
        const delta = rho - 1.0
        const angle = Math.atan2(dz, dx)
        const lobeNoise = 1.0 + 0.14 * Math.cos((c.rays || 7) * angle) +
                          0.07 * Math.sin((c.rays ? c.rays * 2 : 13) * angle)

        const ejecta = c.rimH * Math.exp(-3.2 * delta) * lobeNoise
        y += ejecta * CRATER_RIM_SCALE
      }
    }
  }

  // 3. Fine fractal regolith roughness
  const microNoise = 0.22 * Math.sin(x * 0.95 + z * 0.52) * Math.cos(z * 0.81 - x * 0.44) +
                     0.10 * Math.sin(x * 2.1 - z * 1.7) * Math.sin(z * 2.4 + x * 1.3) +
                     0.04 * Math.sin(x * 4.8 + z * 5.1)
  return y + microNoise
}

const flatLevels = new Array(FLAT_ZONES.length).fill(null)

// Each flat zone uses the unflattened elevation at its centre as its datum.
function zoneLevel(index) {
  if (flatLevels[index] === null) {
    const zone = FLAT_ZONES[index]
    flatLevels[index] = rawTerrainHeight(zone.cx, zone.cz)
  }
  return flatLevels[index]
}

export function getTerrainHeight(x, z) {
  let y = rawTerrainHeight(x, z)

  for (let i = 0; i < FLAT_ZONES.length; i++) {
    const zone = FLAT_ZONES[i]
    const distance = Math.hypot(x - zone.cx, z - zone.cz)
    if (distance >= zone.outer) continue
    const t = distance <= zone.inner ? 1 : 1 - (distance - zone.inner) / (zone.outer - zone.inner)
    const blend = t * t * (3 - 2 * t)
    y = y * (1 - blend) + zoneLevel(i) * blend
  }

  return y
}

