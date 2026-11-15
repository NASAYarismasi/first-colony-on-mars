import {WATER_DEFAULTS,stepWater} from '../../../sim/ihanLifeSupportModels.js'
import {DRILL_KW,WATER_KWH_PER_L,ICE_FRACTION,CAPTURE,TANK_L} from './mars-power.mjs'

// GAME ASSUMPTION: the high-level interlock clears at 95 L to avoid repeated motor starts.
export const WATER_RESTART_L=TANK_L-5

export function updateWaterTankHold(grid) {
  grid.waterTankHold=grid.water>=TANK_L||(Boolean(grid.waterTankHold)&&grid.water>WATER_RESTART_L)
  return grid.waterTankHold
}

export function advanceFacilityWater(state,hours,live,crew) {
  const drillKW=live.water?.consumption??0
  const extractionDuty=drillKW/DRILL_KW
  const recycleKW=.3*(live.habitat?.duty??0)
  return stepWater(state,hours,{powerKW:drillKW+recycleKW,extract:drillKW>0,extractionDuty,irrigationLiters:live.greenhouse?.irrigationL??0},{
    ...WATER_DEFAULTS,crew,tankCapacityL:TANK_L,litersPerHour:DRILL_KW/WATER_KWH_PER_L,
    iceWaterFraction:ICE_FRACTION,captureEfficiency:CAPTURE
  })
}
