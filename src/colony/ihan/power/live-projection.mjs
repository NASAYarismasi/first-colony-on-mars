import {advanceFacilityWater} from "./facility-water.mjs"
import { SOL_HOURS, solarDay } from "./mars-power.mjs"
import { stepMicrogrid } from "./live-grid.mjs"
import { createAutomaticRecovery } from "./black-start.mjs"

import {advanceSolarWeather,cleanSolarRows,solarWeatherReadings} from './solar-weather.mjs'
import {supplyHabitatOxygen} from './habitat-oxygen.mjs'

export function projectPower(snapshot, drill) {
  const state=structuredClone(snapshot.state)
  const recovery=createAutomaticRecovery(structuredClone(snapshot.recovery))
  let water=snapshot.facility?structuredClone(snapshot.facility.water):null
  let air=snapshot.facility?.air?structuredClone(snapshot.facility.air):null
  const weather=snapshot.solarWeather?structuredClone(snapshot.solarWeather):null
  const applyFacilities=(live,dt)=>{
    if(air)air=supplyHabitatOxygen(air,dt,live,state,snapshot.facility.crew)
    if(!water)return
    water=advanceFacilityWater(water,dt,live,snapshot.facility.crew)
    state.water=water.cleanL
    state.iceKg=water.iceKg
  }
  const waterBeforeDrilling=water?(habitat,dt)=>advanceFacilityWater(water,dt,{habitat},snapshot.facility.crew).cleanL:undefined
  const rows=[]
  const day=solarDay(snapshot.season)
  for(let index=0;index<3;index++) {
    let hour=index===0?snapshot.hour:0
    const beforeGap=state.dailyShortfall
    const beforeWater=water?.extractedL??state.water
    const beforeOxygen=state.oxygenProduced??0
    let solar=0, led=0, drillHours=0
    while(hour<SOL_HOURS-1e-9) {
      const untilTransition=hour<day.daylight?day.daylight:SOL_HOURS
      const dt=Math.min(30/3600,untilTransition-hour)
      const midpoint=hour+dt/2
      let live
      // Resolve the short protection sequence in one-second steps.
      if(snapshot.blackStart!==false && midpoint>=day.daylight && recovery.needsFastStep) {
        const duration=Math.min(dt,1/3600)
        live=recovery.step(state,false,duration*3600,()=>{})
        if(weather)advanceSolarWeather(weather,duration*3600)
        applyFacilities(live,duration)
        if(weather)cleanSolarRows(weather,duration*3600,false,state,live)
        hour+=duration
        led+=(live.greenhouse.ledKW>0?1:0)*duration
        continue
      }
      if(weather)advanceSolarWeather(weather,dt*3600)
      const conditions=weather?solarWeatherReadings(weather):snapshot.weather[index]
      live=(snapshot.blackStart!==false?recovery.step(state,midpoint<day.daylight,dt*3600,()=>{}):null) ??
        stepMicrogrid(state,midpoint,dt,{...snapshot,...conditions,panelDust:conditions.dust??snapshot.panelDust,drill,waterBeforeDrilling})
      applyFacilities(live,dt)
      if(weather)cleanSolarRows(weather,dt*3600,midpoint<day.daylight,state,live)
      solar+=live.production*dt
      led+=(live.greenhouse.ledKW>0?1:0)*dt
      drillHours+=live.water.duty*dt
      hour+=dt
    }
    rows.push({solar,led,drillHours,stored:state.battery,gap:state.dailyShortfall-beforeGap,water:(water?.extractedL??state.water)-beforeWater,oxygen:(state.oxygenProduced??0)-beforeOxygen})
  }
  return rows
}

export function bindProjection(panel,capture) {
  if(!panel) return
  const form=panel.querySelector("form")
  const report=panel.querySelector("output")
  const fmt=new Intl.NumberFormat("en-US",{maximumFractionDigits:2})
  let running=false
  form.addEventListener("submit",async event=>{
    event.preventDefault()
    if(running) return
    const snapshot=capture()
    running=true
    report.textContent="Calculating two scenarios from the same starting state…"
    await new Promise(resolve=>setTimeout(resolve,25))
    try {
      const fields=["solar","stored","gap","water","oxygen","led"]
      const units=["kWh","kWh","kWh","L","kg","h"]
      const table=document.createElement("table")
      const head=table.createTHead().insertRow()
      for(const name of ["Sol","Drilling","PV generation","Morning storage","Habitat shortfall","Extracted water","Produced O₂","Greenhouse lighting"]){
        const th=document.createElement("th")
        th.scope="col"
        th.textContent=name
        head.append(th)
      }
      const body=table.createTBody()
      for(const drill of [true,false]) projectPower(snapshot,drill).forEach((data,i)=>{
        const row=body.insertRow()
        const values=[snapshot.sol+i+1,drill?"On":"Off",
          ...fields.map((field,index)=>fmt.format(data[field])+" "+units[index])]
        for(const value of values) row.insertCell().textContent=value
      })
      const start=document.createElement("p")
      start.textContent="Initial · Sol "+(snapshot.sol+1)+" · "+fmt.format(snapshot.hour)+
        " hours · "+fmt.format(snapshot.state.battery)+" kWh · banks "+
        snapshot.state.banks.map(value=>fmt.format(value)).join(" / ")+" kWh"
      const scroll=document.createElement("div")
      scroll.className="power-table"
      scroll.append(table)
      report.replaceChildren(start,scroll)
    } finally {
      running=false
    }
  })
  panel.querySelector("#power-farm")?.addEventListener("click",()=>{
    document.querySelector('[data-view="solar"]')?.click()
    document.getElementById("viewport")?.scrollIntoView({block:"start"})
  })
}
