import { AU } from '../sim/constants.js';
import { TRANSFER, heliocentricAt } from '../sim/transfer.js';
/** Legacy map uses AU-sized drawing units. Only the UI adapter converts SI. */
export function transferAt(progress) {
  const state = heliocentricAt(progress * TRANSFER.duration);
  return { ...state, ship: state.ship.map(x => x / AU), earth: state.earth.map(x => x / AU), mars: state.mars.map(x => x / AU) };
}
export const phaseStage = phase => ({ PRELAUNCH: 'ready', ASCENT: 'launch', PARKING_ORBIT: 'orbit', TMI_BURN: 'orbit',
  CRUISE: 'cruise', MOI_BURN: 'entry', MARS_ORBIT: 'entry', DEORBIT: 'entry', EDL: 'descent', LANDED: 'landed', FAILED: 'failed' })[phase];
export const PHASE_LABELS = { PRELAUNCH: "EARTH / LAUNCH PAD", ASCENT: "01 / LAUNCH FROM EARTH",
  PARKING_ORBIT: "02 / EARTH PARKING ORBIT", TMI_BURN: "MARS TRANSFER BURN", CRUISE: "03 / MARS TRANSFER",
  MOI_BURN: "MARS CAPTURE BURN", MARS_ORBIT: "04 / MARS ORBIT", DEORBIT: "DEORBIT",
  EDL: "05 / MARS LANDING", LANDED: "06 / MARS SURFACE", FAILED: "MISSION FAILED" };
