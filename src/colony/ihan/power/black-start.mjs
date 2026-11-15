import { stepGreenhouseGas } from "./greenhouse-gas.mjs"
import { updateWaterTankHold } from "./facility-water.mjs"
import { GRID } from "./mars-power.mjs"

const HABITAT_KW=3
const STANDBY_KW=.12
const START_KWH=.05
const FORM_SECONDS=4

export function createBlackStart(bank=24) {
  return {phase:"outage",bank,voltage:0,frequency:0,habitatKW:0,isolated:false,elapsed:0}
}

export function commandBlackStart(state,command) {
  if(command==="isolate") {
    state.isolated=true
    return "Drill breaker opened. Faulty feeder isolated."
  }
  if(command==="inverter") {
    if(!state.isolated) return "Blocked · Isolate the faulty drill feeder first."
    if(state.phase!=="outage") return "G4 inverter already started."
    if(state.bank<START_KWH) return "Blocked · Insufficient G4 battery reserve."
    state.bank-=START_KWH
    state.phase="forming"
    state.elapsed=0
    return "G4 inverter is establishing bus voltage and frequency."
  }
  if(command==="habitat") {
    if(state.phase==="restored") return "Emergency life support already connected."
    if(state.phase!=="ready") return "Blocked · Bus not ready."
    if(HABITAT_KW+STANDBY_KW>GRID.dischargeKW/3) return "Blocked · G4 inverter limit exceeded."
    state.phase="restored"
    state.habitatKW=HABITAT_KW
    return "Mission successful · Emergency habitat life support restored."
  }
  return ""
}

export function stepBlackStart(state,seconds) {
  if(state.phase==="forming") {
    state.elapsed+=seconds
    const progress=Math.min(1,state.elapsed/FORM_SECONDS)
    state.voltage=Math.round(400*progress)
    state.frequency=progress>0?50:0
    if(progress===1) {
      state.phase="ready"
      return "Bus ready · 400 V / 50 Hz. Emergency habitat circuit can be connected."
    }
  }
  if(state.phase==="ready"||state.phase==="restored") {
    const demand=(STANDBY_KW+state.habitatKW)*seconds/3600/GRID.dischargeEfficiency
    if(demand>=state.bank) {
      Object.assign(state,{bank:0,phase:"outage",voltage:0,frequency:0,habitatKW:0})
      return "G4 reserve depleted · Bus de-energized."
    }
    state.bank-=demand
  }
  return ""
}

export function createAutomaticRecovery(snapshot={}) {
  let {state=null,triggered=false,secondsSinceTrip=0,stableSeconds=0}=snapshot
  return {
    get state(){return state},
    get needsFastStep(){return !triggered || (state && !state.attempted) || state?.phase==="forming" || state?.phase==="ready"},
    snapshot(){return structuredClone({state,triggered,secondsSinceTrip,stableSeconds})},
    step(grid,daylight,seconds,log) {
      if(daylight) {
        if(state) log("Sunrise · PV online again; emergency circuit returned to normal supply.")
        state=null
        return null
      }
      if(!state && !triggered) {
        state=createBlackStart(grid.banks[3])
        triggered=true
        log("Main battery inverter protection tripped · AC bus de-energized.")
      }
      if(!state) return null
      secondsSinceTrip+=seconds
      if(!state.isolated && secondsSinceTrip>=2) log(commandBlackStart(state,"isolate"))
      const bankBefore=state.bank
      if(state.phase==="outage" && state.isolated && secondsSinceTrip>=4 && !state.attempted) {
        state.attempted=true
        log(commandBlackStart(state,"inverter"))
      }
      const wasReady=state.phase==="ready"
      const wasRestored=state.phase==="restored"
      log(stepBlackStart(state,seconds))
      const drawKW=Math.max(0,bankBefore-state.bank)*3600/seconds
      if(wasReady && state.phase==="ready") {
        stableSeconds+=seconds
        if(stableSeconds>=2) log(commandBlackStart(state,"habitat"))
      }
      grid.banks[3]=state.bank
      grid.battery=grid.banks.reduce((sum,value)=>sum+value,0)
      const life=wasRestored?Math.min(HABITAT_KW,drawKW*GRID.dischargeEfficiency*HABITAT_KW/(HABITAT_KW+STANDBY_KW)):0
      grid.energy.conversionLoss+=Math.max(0,drawKW-life)*seconds/3600
      grid.loadEnergy.habitat+=life*seconds/3600
      grid.dailyShortfall+=(6-life)*seconds/3600
      const plantGas=stepGreenhouseGas(grid,{elevation:0,transmission:0,ledFraction:0},seconds/3600)
      const meter={consumption:0,loss:0,supply:0,current:0,duty:0,batteryPower:0,nightEnergy:0,sources:[]}
      const tankHold=updateWaterTankHold(grid)
      return {recovering:true,daylight:false,elevation:0,production:0,heater:0,reserve:0,life,
        backupActive:false,plantGas,greenhouse:meter,moxie:meter,habitat:{...meter,consumption:life,supply:life,duty:life/6,sources:life?[4]:[]},water:{...meter,fault:true,tankHold,lineEnergized:false},
        groups:grid.banks.map((stored,index)=>({
          stored,pv:0,charge:0,waterTankHold:index===0&&tankHold,output:index===3?life:0,draw:index===3?drawKW:0
        }))}
    }
  }
}

export function bindBlackStart(panel) {
  if(!panel) return null
  const recovery=createAutomaticRecovery()
  const output=panel.querySelector("output")
  const log=panel.querySelector("ol")
  const status=panel.querySelector("[data-mission-state]")
  const fmt=new Intl.NumberFormat("en-US",{maximumFractionDigits:2})
  const append=message=>{
    if(!message) return
    const item=document.createElement("li")
    item.textContent=message
    log.append(item)
  }
  return {
    snapshot:()=>recovery.snapshot(),
    step(grid,daylight,seconds) {
      const live=recovery.step(grid,daylight,seconds,append)
      const state=recovery.state
      const text=state?
        "Bus "+state.voltage+" V · "+state.frequency+" Hz · G4 reserve "+fmt.format(state.bank)+
        " kWh · Emergency habitat "+state.habitatKW+" kW":"Normal grid operating."
      if(output.textContent!==text) output.textContent=text
      const phase=state?.phase==="restored"?"Emergency supply restored":state?"Automatic recovery enabled":"Automatic protection ready"
      if(status.textContent!==phase) status.textContent=phase
      return live
    }
  }
}
