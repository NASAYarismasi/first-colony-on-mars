import { updateWaterTankHold } from "./facility-water.mjs"
import { stepGreenhouseGas } from "./greenhouse-gas.mjs"
import { panelProduction } from "./panel-production.mjs"
import {GRID, SOL_HOURS, solarDay, feederLoss, LED_KW, IRRIGATION_KW, IRRIGATION_L_PER_H, DRILL_KW, ICE_FRACTION, CAPTURE, TANK_L, WATER_KWH_PER_L, CABINET_HEATER_KW, HABITAT_FEEDER_M, nightReserveFor, LOAD_PF, PV_GROUP_KVA, BATTERY_GROUP_KVA, reactiveRatio, remainingActiveKW} from "./mars-power.mjs"

const BANK_CAPACITY=GRID.capacity/5
const TIE_LIMIT_KW=8
export const MOXIE_BANKS=3
export const MOXIE_MODULES_PER_BANK=9
const MOXIE_MODULES=MOXIE_BANKS*MOXIE_MODULES_PER_BANK
// https://pmc.ncbi.nlm.nih.gov/articles/PMC9432831/
export const MOXIE_KW=MOXIE_MODULES*.3
export const MOXIE_KG_PER_HOUR=MOXIE_MODULES*.006
export const MOXIE_TANK_PER_BANK_KG=5
export const MOXIE_TANK_KG=MOXIE_BANKS*MOXIE_TANK_PER_BANK_KG
export const moxieTankFull=kg=>kg>=MOXIE_TANK_KG
const MOXIE_INTAKE_CO2_KG_H=MOXIE_MODULES*.055*.97

export function stepMoxieGas(state,powered,dt) {
  const oxygen=Math.min(Math.max(0,MOXIE_TANK_KG-state.oxygen),powered?MOXIE_KG_PER_HOUR*dt:0)
  const runHours=oxygen/MOXIE_KG_PER_HOUR
  const intake=MOXIE_INTAKE_CO2_KG_H*runHours
  state.oxygen+=oxygen
  state.oxygenProduced=(state.oxygenProduced??0)+oxygen
  state.co2Intake+=intake
  return {intakeKgHour:intake/dt,oxygenKgHour:oxygen/dt,tankKg:state.oxygen,tanksKg:Array(MOXIE_BANKS).fill(state.oxygen/MOXIE_BANKS),
    intakeTotalKg:state.co2Intake,reactedKgHour:oxygen/dt*88/32}
}

export function createGridState(initialEnergy=8) {
  const battery=Math.max(0,Math.min(GRID.capacity,initialEnergy))
  const primary=Math.min(battery,3*BANK_CAPACITY)/3
  const backup=(battery-3*primary)/2
  return {battery,banks:[backup,backup,primary,primary,primary], temperature:10, heaterOn:false, branches:{}, water:0, waterTankHold:false, oxygen:0, oxygenProduced:0, oxygenTankHold:false, oxygenToHabitat:0, oxygenTransferKgHour:0, co2Intake:0, greenhouseOxygenKg:0, greenhouseNetKg:0, dawn:8, dailyShortfall:0,nightDraw:{greenhouse:0,water:0,moxie:0},loadEnergy:{greenhouse:0,water:0,moxie:0,habitat:0,heater:0,rover:0,cleaning:0},initialEnergy:battery,energy:{solar:0,curtailed:0,feederLoss:0,conversionLoss:0}}
}

export function stepMicrogrid(state, hour, dt, options) {
  const {season, transmission, panelDust, rowDust=Array(6).fill(panelDust), closed, lamp, drill, faults, geometry}=options
  const day=solarDay(season)
  const daylight=geometry?.daylight??hour<day.daylight
  const latitude=18.44*Math.PI/180
  const hourAngle=day.sunset*(2*hour/day.daylight-1)
  const east=geometry?.east??-Math.cos(day.declination)*Math.sin(hourAngle)
  const north=Math.cos(latitude)*Math.sin(day.declination)-
    Math.sin(latitude)*Math.cos(day.declination)*Math.cos(hourAngle)
  const elevation=daylight?(geometry?.elevation??(Math.sin(latitude)*Math.sin(day.declination)+
    Math.cos(latitude)*Math.cos(day.declination)*Math.cos(hourAngle))):0
  // 42 tables × 20 m², 70% clear atmosphere, 25% PV efficiency and 80% array performance.
  const idealProduction=42*20*(geometry?.irradiance??day.irradiance)*.70*.25*.8*transmission*elevation/1000
  const generation=panelProduction(idealProduction,elevation,east,rowDust)
  const groups=state.banks.map((stored,index)=>({index,stored,...generation[index],charge:0,draw:0,output:0,kvar:0,batteryKvar:0}))
  const production=groups.reduce((sum,group)=>sum+group.pv,0)
  const reserveHours=geometry?(daylight?geometry.nightHours:geometry.nightHours+dt/2):daylight?day.night:Math.max(0,SOL_HOURS-hour+dt/2)
  const ledCapacity=options.ledMode==='off'?0:lamp*LED_KW
  const nightGreenhouse=closed&&!faults.greenhouse?ledCapacity+(options.irrigation?IRRIGATION_KW:0):0
  const reserveDetails=nightReserveFor(reserveHours,nightGreenhouse)
  const reserve=reserveDetails.total
  const remainingNight=daylight?reserveHours:Math.max(0,reserveHours-dt)
  const reserveAfterStep=nightReserveFor(remainingNight,nightGreenhouse).total
  const essentialReserve=nightReserveFor(remainingNight).total
  const storage=[groups[4],groups[3],groups[2]]
  const direct=groups.slice(0,2)
  const dischargeOrder=[...storage,...direct]
  const headroom=(bank,ratio)=>remainingActiveKW(bank.output,bank.kvar,daylight?PV_GROUP_KVA:BATTERY_GROUP_KVA,ratio)
  const storedTotal=()=>groups.reduce((sum,bank)=>sum+bank.stored,0)
  const batteryOutput=()=>groups.reduce((sum,bank)=>sum+bank.draw*GRID.dischargeEfficiency,0)
  const bankPower=(bank,ratio)=>Math.min(
    headroom(bank,ratio),
    remainingActiveKW(bank.draw*GRID.dischargeEfficiency,bank.batteryKvar,BATTERY_GROUP_KVA,ratio),
    bank.stored*GRID.dischargeEfficiency/dt)
  const batteryBudget=minimum=>Math.min(Math.max(0,GRID.dischargeKW-batteryOutput()),
    Math.max(0,storedTotal()-minimum)*GRID.dischargeEfficiency/dt)
  const draw=(demand,minimum=0,ratio=0)=>{
    const limits=dischargeOrder.map(bank=>bankPower(bank,ratio))
    const totalLimit=limits.reduce((sum,limit)=>sum+limit,0)
    const delivered=Math.min(demand,batteryBudget(minimum),totalLimit)
    if(delivered<=0)return 0
    // Share load across the banks so spare energy is not stranded behind too few inverters at dawn.
    dischargeOrder.forEach((bank,index)=>{
      const power=delivered*limits[index]/totalLimit
      const drawKW=power/GRID.dischargeEfficiency
      bank.draw+=drawKW
      bank.output+=power
      bank.kvar+=power*ratio
      bank.batteryKvar+=power*ratio
      bank.stored=Math.max(0,bank.stored-drawKW*dt)
    })
    return delivered
  }
  const habitatGroup=groups[3]
  const lampDemand=!daylight||options.ledMode==='on'?ledCapacity:0
  const pumpRequested=options.irrigation&&state.water>0?IRRIGATION_KW:0
  const greenhouseDemand=lampDemand+pumpRequested
  const tankHold=updateWaterTankHold(state)
  const drillDemand=daylight&&drill&&!tankHold&&(state.iceKg??1)>0?DRILL_KW:0
  // GAME ASSUMPTION: restart at 99% so the habitat regulator can draw from a full reserve.
  state.oxygenTankHold=moxieTankFull(state.oxygen)||(state.oxygenTankHold&&state.oxygen>MOXIE_TANK_KG*.99)
  const fullTank=state.oxygenTankHold
  const moxieDemand=daylight&&!fullTank?MOXIE_KW:0
  const moxieFraction=Math.min(1,Math.max(0,MOXIE_TANK_KG-state.oxygen)/(MOXIE_KG_PER_HOUR*dt))
  const habitatDemand=daylight?60/(geometry?.daylightHours??day.daylight):GRID.habitatKW
  const withLoss=(kw,length,pf)=>kw+feederLoss(kw,length,4,pf)
  const localNeeds=[
    closed&&!faults.water?withLoss(drillDemand,190,LOAD_PF.water):0,
    closed&&!faults.greenhouse?withLoss(greenhouseDemand,105,LOAD_PF.greenhouse):0,
    !faults.moxie?withLoss(moxieDemand,90,LOAD_PF.moxie)*moxieFraction:0,
    withLoss(habitatDemand,HABITAT_FEEDER_M,LOAD_PF.habitat)+CABINET_HEATER_KW,
    0
  ]
  let transferKW=0
  const transfers=[]
  const pvLeft=bank=>Math.max(0,bank.pv-bank.output+bank.draw*GRID.dischargeEfficiency)
  const donorSurplus=(bank,critical,ratio)=>{
    const chargeFirst=bank.index===4||(bank.index===0&&tankHold)
    const reservedCharge=chargeFirst&&!critical&&state.temperature>=0&&bank.stored<BANK_CAPACITY
      ?Math.min(GRID.chargeKW/5,(BANK_CAPACITY-bank.stored)/(dt*GRID.chargeEfficiency)):0
    const localRemaining=Math.max(0,localNeeds[bank.index]-bank.localServed)
    return Math.min(headroom(bank,ratio),Math.max(0,pvLeft(bank)-localRemaining-reservedCharge))
  }
  groups.forEach(bank=>{bank.localServed=0})
  const availablePV=(target,critical,ratio)=>Math.min(pvLeft(target),headroom(target,ratio))+Math.min(TIE_LIMIT_KW-transferKW,
    groups.reduce((sum,bank)=>sum+(bank===target?0:donorSurplus(bank,critical,ratio)),0))
  const servePV=(target,demand,critical=false,ratio=0)=>{
    const own=Math.min(demand,pvLeft(target),headroom(target,ratio))
    target.output+=own
    target.kvar+=own*ratio
    let delivered=own
    for(const bank of groups) {
      if(bank===target) continue
      const shared=Math.min(demand-delivered,donorSurplus(bank,critical,ratio),TIE_LIMIT_KW-transferKW)
      if(shared<=1e-9) continue
      bank.output+=shared
      bank.kvar+=shared*ratio
      delivered+=shared
      transferKW+=shared
      transfers.push({from:bank.index+1,to:target.index+1,kw:shared})
    }
    target.localServed+=delivered
    return delivered
  }
  const fromHabitatGroup=(demand,ratio=0)=>{
    const fromPV=servePV(habitatGroup,demand,true,ratio)
    const fromBattery=draw(demand-fromPV,0,ratio)
    habitatGroup.localServed+=fromBattery
    return fromPV+fromBattery
  }
  const branch=(key,load,length,fault,group,connected=closed,fraction=1)=>{
    const pf=LOAD_PF[key]
    const consumption=load*fraction
    const q=consumption*reactiveRatio(pf)
    const loss=feederLoss(load,length,4,pf)*fraction
    const need=consumption+loss
    const ratio=need>0?q/need:0
    const minimum=key==="greenhouse"&&!daylight?essentialReserve:reserveAfterStep
    const bankOutputBefore=groups.map(bank=>bank.output)
    const bankDrawBefore=groups.reduce((sum,bank)=>sum+bank.draw,0)
    const batteryAvailable=Math.min(batteryBudget(minimum),
      dischargeOrder.reduce((sum,bank)=>sum+bankPower(bank,ratio),0))
    const pvAvailable=daylight?availablePV(group,false,ratio):0
    const allowBattery=!daylight||key==="greenhouse"
    const useBattery=allowBattery&&pvAvailable<need*1.03&&batteryAvailable>pvAvailable
    const available=useBattery?batteryAvailable:pvAvailable
    const branchState=state.branches[key] ??= {on:false,restart:0}
    branchState.restart=Math.max(0,branchState.restart-dt)
    const enabled=connected&&!fault&&need>0
    const on=enabled && (branchState.on
      ? available>=need
      : branchState.restart===0 && available>=need*1.03)
    if(branchState.on&&!on) branchState.restart=30/3600
    branchState.on=on
    if(on) {
      if(useBattery)draw(need,minimum,ratio)
      else servePV(group,need,false,ratio)
    }
    const sources=groups.filter(bank=>bank.output-bankOutputBefore[bank.index]>1e-8).map(bank=>bank.index+1)
    const batteryPower=groups.reduce((sum,bank)=>sum+bank.draw,0)-bankDrawBefore
    if(!daylight) state.nightDraw[key]+=batteryPower*dt
    return {consumption:on?consumption:0,loss:on?loss:0,supply:on?need:0,duty:on?fraction:0,
      batteryPower,nightEnergy:state.nightDraw[key],demand:load,fault,sources,kvar:on?q:0,kva:on?consumption/pf:0,pf:on?pf:null,
      current:on?consumption*1000/(Math.sqrt(3)*GRID.voltage*pf):0}
  }
  const habitat=habitatDemand
  const habitatLoss=feederLoss(habitat,HABITAT_FEEDER_M,4,LOAD_PF.habitat)
  const habitatInput=habitat+habitatLoss
  const outputsBefore=groups.map(group=>group.output)
  const habitatRatio=habitat*reactiveRatio(LOAD_PF.habitat)/habitatInput
  const habitatDrawBefore=batteryOutput()
  const delivered=daylight?fromHabitatGroup(habitatInput,habitatRatio):draw(habitatInput,0,habitatRatio)
  const life=delivered*habitat/habitatInput
  const habitatMeter={consumption:life,loss:delivered-life,supply:delivered,duty:life/habitat,
    batteryPower:(batteryOutput()-habitatDrawBefore)/GRID.dischargeEfficiency,nightEnergy:0,demand:habitat,kvar:life*reactiveRatio(LOAD_PF.habitat),kva:life/LOAD_PF.habitat,pf:life>0?LOAD_PF.habitat:null,
    current:life*1000/(Math.sqrt(3)*GRID.voltage*LOAD_PF.habitat),
    sources:groups.filter(group=>group.output-outputsBefore[group.index]>1e-8).map(group=>group.index+1)}
  const ambient=-60+38*Math.max(0,elevation)
  if(state.temperature<=7) state.heaterOn=true
  else if(state.temperature>=9) state.heaterOn=false
  let heater=!daylight&&state.heaterOn?draw(CABINET_HEATER_KW,0,0):0
  if(daylight&&state.heaterOn) heater=fromHabitatGroup(CABINET_HEATER_KW)
  const recoveredWater=options.waterBeforeDrilling?.(habitatMeter,dt)??state.water
  const requestedLiters=options.irrigation?Math.min(recoveredWater,IRRIGATION_L_PER_H*dt):0
  const pumpDemand=requestedLiters/(IRRIGATION_L_PER_H*dt)*IRRIGATION_KW
  localNeeds[1]=closed&&!faults.greenhouse?withLoss(lampDemand+pumpDemand,105,LOAD_PF.greenhouse):0
  const greenhouse=branch("greenhouse",lampDemand+pumpDemand,105,faults.greenhouse,direct[1])
  greenhouse.ledKW=greenhouse.duty*lampDemand
  greenhouse.pumpKW=greenhouse.duty*pumpDemand
  greenhouse.irrigationL=greenhouse.duty*requestedLiters
  greenhouse.irrigationLph=greenhouse.irrigationL/dt
  const moxie=branch("moxie",moxieDemand,90,faults.moxie,groups[2],closed,moxieFraction)
  const plantGas=stepGreenhouseGas(state,{elevation,transmission,ledFraction:greenhouse.ledKW/LED_KW},dt)
  const gas=stepMoxieGas(state,moxie.duty>0,dt)
  gas.tankFull=moxieTankFull(state.oxygen)
  if(gas.tankFull)state.oxygenTankHold=true
  const waterBeforeDrilling=recoveredWater-greenhouse.irrigationL
  const drillFraction=Math.min(1,Math.max(0,TANK_L-waterBeforeDrilling)*WATER_KWH_PER_L/(DRILL_KW*dt),
    (state.iceKg??Infinity)*ICE_FRACTION*CAPTURE*WATER_KWH_PER_L/(DRILL_KW*dt))
  const water=branch("water",drillDemand,190,faults.water,direct[0],closed,drillFraction)
  for(const [key,power] of Object.entries({habitat:life,greenhouse:greenhouse.consumption,moxie:moxie.consumption,water:water.consumption,heater}))
    state.loadEnergy[key]+=power*dt
  state.dailyShortfall+=(habitat-life)*dt
  state.temperature+=(heater-.016*(state.temperature-ambient))*dt/.25
  if(daylight&&state.temperature>=0) for(const group of groups) {
    if(group.draw>0) continue
    const input=Math.min(Math.max(0,group.pv-group.output),GRID.chargeKW/5,Math.max(0,BANK_CAPACITY-group.stored)/(dt*GRID.chargeEfficiency))
    group.charge=input*GRID.chargeEfficiency
    group.stored+=group.charge*dt
  }
  water.lineEnergized=closed&&!faults.water&&(production>0||groups.some(group=>group.output>0))
  groups[0].waterLineEnergized=water.lineEnergized
  state.water=Math.min(TANK_L,waterBeforeDrilling+water.consumption*dt/WATER_KWH_PER_L)
  water.tankHold=updateWaterTankHold(state)
  groups[0].waterTankHold=water.tankHold
  state.banks=groups.map(group=>group.stored)
  state.battery=state.banks.reduce((sum,stored)=>sum+stored,0)
  const live={groups,transfers,transferKW,backupActive:!daylight&&direct.some(group=>group.draw>0),daylight,elevation,east,north,production,heater,reserve,reserveDetails,life,habitat:habitatMeter,moxie,gas,plantGas,greenhouse,water}
  const balance=gridPowerBalance(live)
  for(const key of Object.keys(state.energy))state.energy[key]+=balance[key]*dt
  return live
}

export function gridPowerBalance(live) {
  const groups=live?.groups??[]
  const solar=live?.production??0
  const charging=groups.reduce((sum,group)=>sum+group.charge,0)
  const discharging=groups.reduce((sum,group)=>sum+group.draw,0)
  const toBus=groups.reduce((sum,group)=>sum+group.output,0)
  const loads=['habitat','water','moxie','greenhouse'].map(key=>live?.[key])
  const deviceKW=loads.reduce((sum,meter)=>sum+(meter?.consumption??0),live?.heater??0)
  const feederLoss=loads.reduce((sum,meter)=>sum+(meter?.loss??0),0)
  const batteryToBus=live?.recovering?toBus:discharging*GRID.dischargeEfficiency
  const solarToBus=Math.max(0,toBus-batteryToBus)
  const curtailed=Math.max(0,solar-solarToBus-charging/GRID.chargeEfficiency)
  const conversionLoss=discharging-batteryToBus+charging*(1/GRID.chargeEfficiency-1)
  return {solar,charging,discharging,toBus,deviceKW,feederLoss,batteryToBus,solarToBus,curtailed,conversionLoss}
}

export function payForSweep(state,reserve) {
  const cost=.20/GRID.dischargeEfficiency
  if(state.battery<reserve+cost || state.temperature<0) return false
  for(let i=0;i<5;i++) state.banks[i]-=cost*state.banks[i]/state.battery
  state.battery-=cost
  state.loadEnergy.cleaning+=.20
  state.energy.conversionLoss+=cost-.20
  return true
}
