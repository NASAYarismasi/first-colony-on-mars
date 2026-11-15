export const SOL_HOURS=24+(39*60+35.244)/3600
const RAD=Math.PI/180
const latitude=18.44*RAD
export function solarDay(season=0) {
  const longitude=season*RAD
  const declination=Math.asin(Math.sin(25.19*RAD)*Math.sin(longitude))
  const sunset=Math.acos(-Math.tan(latitude)*Math.tan(declination))
  const daylight=SOL_HOURS*sunset/Math.PI
  const distance=1.5237*(1-.0934**2)/(1+.0934*Math.cos((season-251)*RAD))
  const irradiance=1361/distance**2
  const horizontal=irradiance*SOL_HOURS/Math.PI/1000*
    (sunset*Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.sin(sunset))
  return {daylight,night:SOL_HOURS-daylight,sunset,declination,irradiance,clearIrradiation:horizontal*.70}
}
export const DAYLIGHT_HOURS=solarDay().daylight
// Six 1.28 ï¿½ 2.37 m growing trays; algae lights are a separate auxiliary load.
export const LED_KW=6*1.28*2.37*350/(2.5*.8*1000)+.18
export const IRRIGATION_L_PER_H=.6 // GAME ASSUMPTION: six beds, 14.8 L per Mars sol at full duty.
export const IRRIGATION_KW=.12 // GAME ASSUMPTION: greenhouse circulation pump.
export const LED_KWH=LED_KW*DAYLIGHT_HOURS
export const TANK_L=100
export const ICE_FRACTION=.10
export const CAPTURE=.80
// Sealed sublimation: sensible heat to 253 K plus phase change and auxiliaries.
export const WATER_KWH_PER_L=((.9*.8+.1*2.05)*43/.1+2834)/(3600*CAPTURE*.65)+.15
export const DRILL_KW=2
export const DRILL_HOURS=TANK_L*WATER_KWH_PER_L/DRILL_KW
export function solarEnergy(tables, transmission, season=0) {
  return tables*20*solarDay(season).clearIrradiation*.25*.8*transmission
}
// Design assumptions for the isolated AC microgrid.
export const GRID={capacity:180,chargeKW:25,dischargeKW:12,chargeEfficiency:.90,
  dischargeEfficiency:.95,habitatKW:6,voltage:400,powerFactor:.95}

export const LOAD_PF={water:.85,greenhouse:.96,moxie:.95,habitat:.95,heater:1}
export const PV_GROUP_KVA=12.5
export const BATTERY_GROUP_KVA=4

export function reactiveRatio(pf) {
  return Math.sqrt(1-pf*pf)/pf
}

export function remainingActiveKW(active,reactive,limit,ratio) {
  const residual=limit**2-active**2-reactive**2
  if(residual<=0) return 0
  const linear=active+reactive*ratio
  return residual/(Math.sqrt(linear**2+(1+ratio**2)*residual)+linear)
}

export function feederLoss(kw,length,area,pf=GRID.powerFactor) {
  const current=kw*1000/(Math.sqrt(3)*GRID.voltage*pf)
  return 3*current**2*(.0175*length/area)/1000
}

export const CABINET_HEATER_KW=1.25
export const HABITAT_FEEDER_M=90

export function nightReserveFor(hours,greenhouseKW=0) {
  const habitat=GRID.habitatKW*hours
  const heating=CABINET_HEATER_KW*hours
  const greenhouse=greenhouseKW*hours
  const cable=(feederLoss(GRID.habitatKW,HABITAT_FEEDER_M,4,LOAD_PF.habitat)+feederLoss(greenhouseKW,105,4,LOAD_PF.greenhouse))*hours
  const load=habitat+heating+greenhouse+cable
  const total=load/GRID.dischargeEfficiency
  return {habitat,heating,greenhouse,cable,conversion:total-load,total}
}

export function powerForecast(transmission,closed=true,options={}) {
  const {tables=42,capacity=GRID.capacity,initial=0,ledKW=LED_KW,nightDrill=false,dayDrill=true,season=0,panelDust=0,cleaningKWh=0}=options
  const energy=solarEnergy(tables,transmission,season)*(1-panelDust)
  const {daylight,night,sunset,declination,clearIrradiation}=solarDay(season)
  const nightReserve=nightReserveFor(night).total
  const steps=120, dt=daylight/steps
  const profile=Array.from({length:steps},(_,i)=>{
    const angle=sunset*(2*(i+.5)/steps-1)
    return Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(angle)
  })
  const normalization=profile.reduce((sum,value)=>sum+value,0)
  const drillKW=DRILL_KW+feederLoss(DRILL_KW,190,4)
  const lampKW=ledKW+feederLoss(ledKW,105,4)
  let battery=Math.min(capacity,initial), direct=0, backup=0, drilling=0, dayLed=0, charged=0, dayGap=0, cableLoss=0, unused=0
  const samples=[]
  for(const weight of profile) {
    let greenhouseDuty=0, drillDuty=0
    let pv=energy*weight/normalization
    let dischargeBudget=GRID.dischargeKW*dt
    const discharge=(need,floor=0)=>{
      const delivered=Math.min(need,dischargeBudget,Math.max(0,battery-floor)*GRID.dischargeEfficiency)
      battery-=delivered/GRID.dischargeEfficiency
      dischargeBudget-=delivered
      return delivered
    }
    const habitat=(60/(SOL_HOURS/2))*dt+cleaningKWh/steps
    const pvHabitat=Math.min(pv,habitat)
    pv-=pvHabitat
    dayGap+=Math.max(0,habitat-pvHabitat-discharge(habitat-pvHabitat))
    const reserveInput=Math.min(pv,GRID.chargeKW*dt,
      Math.max(0,Math.min(capacity,nightReserve)-battery)/GRID.chargeEfficiency)
    pv-=reserveInput
    battery+=reserveInput*GRID.chargeEfficiency
    charged+=reserveInput*GRID.chargeEfficiency
    if(closed) {
      // Keep the night reserve intact. Flexible loads share the common AC bus.
      const use=(kw)=>{
        const need=kw*dt
        const fromPV=Math.min(pv,need)
        pv-=fromPV
        const fromBattery=discharge(need-fromPV,nightReserve)
        direct+=fromPV
        backup+=fromBattery
        return (fromPV+fromBattery)/kw
      }
      if(lampKW>0) {
        const lit=use(lampKW)
        greenhouseDuty=lit/dt
        dayLed+=lit
        cableLoss+=lit*(lampKW-ledKW)
      }
      const drillTime=dayDrill?use(drillKW):0
      drillDuty=drillTime/dt
      drilling+=drillTime
      cableLoss+=drillTime*(drillKW-DRILL_KW)
    }
    // Avoid charging and discharging the same bank within a step.
    const chargeInput=dischargeBudget<GRID.dischargeKW*dt?0:
      Math.min(pv,GRID.chargeKW*dt-reserveInput,(capacity-battery)/GRID.chargeEfficiency)
    const added=chargeInput*GRID.chargeEfficiency
    charged+=added
    battery+=added
    unused+=pv-chargeInput
    samples.push({greenhouseDuty,drillDuty})
  }
  const dusk=battery
  const life=nightReserve*GRID.dischargeEfficiency
  const served=Math.min(life,battery*GRID.dischargeEfficiency,GRID.dischargeKW*night)
  let nightExtra=Math.max(0,battery*GRID.dischargeEfficiency-served)
  const nightDrilling=closed&&nightDrill?Math.min(night,nightExtra/drillKW):0
  nightExtra-=nightDrilling*drillKW
  const lit=closed&&lampKW>0?Math.min(night,nightExtra/lampKW):0
  cableLoss+=lit*(lampKW-ledKW)+nightDrilling*(drillKW-DRILL_KW)
  const dawn=Math.max(0,dusk-(served+nightDrilling*drillKW+lit*lampKW)/GRID.dischargeEfficiency)
  const readMeters=hour=>{
    const nightHour=hour-daylight
    const sample=samples[Math.min(steps-1,Math.max(0,Math.floor(hour/dt)))]
    const greenhouseDuty=nightHour<0?sample.greenhouseDuty:Number(nightHour<lit)
    const drillDuty=nightHour<0?sample.drillDuty:Number(nightHour<nightDrilling)
    const meter=(load,loss,duty)=>({
      consumption:load*duty, loss:loss*duty, supply:(load+loss)*duty,
      current:load*1000*duty/(Math.sqrt(3)*GRID.voltage*pf), duty
    })
    return {greenhouse:meter(ledKW,lampKW-ledKW,greenhouseDuty),water:meter(DRILL_KW,drillKW-DRILL_KW,drillDuty)}
  }
  return {readMeters,energy,average:energy/daylight,daylight,night,nightReserve,irradiation:clearIrradiation*transmission,direct,backup,charged,dayLed,dayGap,drilling,
    nightDrilling,waterLiters:(drilling+nightDrilling)*DRILL_KW/WATER_KWH_PER_L,dusk,lit,
    lifeGap:life-served,dawn,cableLoss,unused}
}
