// Flight → colony handoff. The flight page stores the landing payload; the colony page reads it.
// sessionStorage keeps it per tab; every access is guarded (private mode / blocked storage).
const KEY = 'mars-ilk-koloni:landing';

export function saveLandingPayload(payload, storage = globalThis.sessionStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ savedAt: Date.now(), payload })); return true; } catch { return false; }
}

export function clearLandingPayload(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(KEY); } catch { /* storage unavailable */ }
}

/** Returns the stored flight payload, or `fallback` when missing/invalid. Adds `source` for the UI. */
export function readLandingPayload(fallback, storage = globalThis.sessionStorage) {
  try {
    const stored = JSON.parse(storage?.getItem(KEY) ?? 'null')?.payload;
    if (isLandingPayload(stored)) return { ...stored, source: 'flight' };
  } catch { /* fall through */ }
  return { ...fallback, source: 'example' };
}

export function isLandingPayload(p) {
  const finite = v => Number.isFinite(v) && v >= 0;
  return Boolean(p) && Array.isArray(p.crew) && p.crew.length === 3 &&
    p.crew.every(c => typeof c?.id === 'string' && finite(c.health) && c.health <= 100) &&
    ['food', 'water', 'oxygen', 'spareParts'].every(k => finite(p.supplies?.[k])) &&
    Array.isArray(p.modules) && typeof p.landingSite === 'string' && finite(p.surfaceEnergy);
}
