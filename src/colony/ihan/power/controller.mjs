import {AU} from '../../../sim/constants.js';
import {marsSun,JEZERO} from '../../../sim/marsSun.js';
import {createGridState,stepMicrogrid,gridPowerBalance} from './live-grid.mjs';
import {GRID,SOL_HOURS,solarDay} from './mars-power.mjs';
import {createAutomaticRecovery} from './black-start.mjs';
import {projectPower} from './live-projection.mjs';
import {createSolarWeather,advanceSolarWeather,cleanSolarRows,solarWeatherReadings,startSolarSweep} from './solar-weather.mjs';

function solarGeometry(solar,daylight){
  const sunrise=12-Math.acos(-Math.tan(JEZERO.latitude)*Math.tan(solar.declination))*12/Math.PI;
  const localHour=solar.ltst/3600;
  const remainingNight=(24+sunrise-localHour)%24;
  return {
    daylight,
    irradiance:1361/(solar.distance/AU)**2,
    elevation:Math.max(0,Math.sin(solar.elevation)),
    east:Math.sin(solar.azimuth)*Math.cos(solar.elevation),
    north:Math.cos(solar.azimuth)*Math.cos(solar.elevation),
    daylightHours:(24-2*sunrise)*SOL_HOURS/24,
    nightHours:(daylight?2*sunrise:remainingNight)*SOL_HOURS/24,
  };
}

export function createPowerController({blackStart=true,firstStormDelay,initialEnergy}={}){
  let weather=createSolarWeather(firstStormDelay);
  let state=createGridState(initialEnergy),recovery=createAutomaticRecovery(),live=null,lastClock=null,sol=0,hour=0;
  const controls={closed:true,drill:true,season:0,lamp:true,blackStart};
  const log=[];
  let lastReservation=null, lastDaylight=null, roverKW=0;
  function append(message){if(message){log.push(message);if(log.length>30)log.shift();}}
  function options(lamp,irrigation,ledMode){const {transmission,dust,rowDust}=solarWeatherReadings(weather);return {...controls,transmission,panelDust:dust,rowDust,lamp:lamp?1:0,irrigation,ledMode,faults:{}};}
  return {
    controls,
    startSweep(){
      const message=startSolarSweep(weather,state,live,append);
      if(message)append(message);
      return message??"Wipers started.";
    },
    syncWater(water){state.water=water.cleanL;state.iceKg=water.iceKg;},
    beginRoverFrame(){roverKW=0;},
    finishRoverFrame(hours){roverKW=hours>0?Math.max(0,roverKW/hours):0;},
    consumeEnergy(requested){
      if(!Number.isFinite(requested))return 0;
      if(requested<0){
        if(!lastReservation)return 0;
        const refundable=Math.min(-requested,lastReservation.total);
        for(let i=0;i<state.banks.length;i++){
          state.banks[i]=Math.min(GRID.capacity/5,state.banks[i]+refundable/GRID.dischargeEfficiency*lastReservation.shares[i]);
        }
        state.loadEnergy.rover-=refundable;
        state.energy.conversionLoss-=refundable*(1/GRID.dischargeEfficiency-1);
        roverKW-=refundable;
        lastReservation=null;
        state.battery=state.banks.reduce((sum,value)=>sum+value,0);
        return 0;
      }
      if(requested===0||!live||live.recovering)return 0;
      const available=Math.max(0,state.battery-live.reserve);
      const accepted=Math.min(requested,available*GRID.dischargeEfficiency);
      if(accepted<=0)return 0;
      const shares=state.banks.map(value=>value/state.battery);
      lastReservation={total:accepted,shares};
      state.banks=state.banks.map((value,index)=>value-accepted/GRID.dischargeEfficiency*shares[index]);
      state.battery=state.banks.reduce((sum,value)=>sum+value,0);
      state.loadEnergy.rover+=accepted;
      state.energy.conversionLoss+=accepted*(1/GRID.dischargeEfficiency-1);
      roverKW+=accepted;
      return accepted;
    },
    update(environment,lamp,onStep,{irrigation,ledMode,waterBeforeDrilling}={}){
      const clock=environment.unixSeconds;
      if(lastClock===null){lastClock=clock;const daylight=solarDay(controls.season).daylight;hour=((environment.lmst??8)*SOL_HOURS/24-(SOL_HOURS-daylight)/2+SOL_HOURS)%SOL_HOURS;}
      const useSceneSun=Number.isFinite(environment.sunElevationDeg);
      let remaining=Math.max(0,clock-lastClock);lastClock=clock;
      while(remaining>1e-8){
        const day=solarDay(controls.season);
        const boundary=hour<day.daylight?day.daylight:SOL_HOURS;
        const seconds=Math.min(remaining,30,(boundary-hour)*3600);
        if(seconds<1e-7){
          hour=boundary===SOL_HOURS?0:day.daylight;
          if(boundary===SOL_HOURS)sol++;
          continue;
        }
        const midpoint=hour+seconds/7200;
        const previousOpacity=weather.opacity;
        advanceSolarWeather(weather,seconds);
        if(previousOpacity<.35&&weather.opacity>=.35)append("Dust front approaching. Panel generation is falling.");
        if(previousOpacity>=.35&&weather.opacity<.35)append("Dust front receding.");
        const solar=useSceneSun?marsSun(clock-remaining+seconds/2):null;
        const daylight=solar?solar.elevation>0:midpoint<day.daylight;
        const geometry=solar?solarGeometry(solar,daylight):null;
        if(lastDaylight!==null&&daylight!==lastDaylight)
          append(daylight?"Sunrise · PV generation started.":"Sunset · PV at zero, batteries supply the night loads.");
        lastDaylight=daylight;
        const opts={...options(controls.lamp&&lamp,irrigation,ledMode),geometry,waterBeforeDrilling};
        live=(controls.blackStart?recovery.step(state,daylight,seconds,append):null)
          ??stepMicrogrid(state,midpoint,seconds/3600,opts);
        onStep?.(live,seconds/3600,state);
        cleanSolarRows(weather,seconds,daylight,state,live,append);
        hour+=seconds/3600;remaining-=seconds;
        if(hour>=SOL_HOURS-1e-9){hour=0;sol++;}
      }
    },
    get meters(){return live;},
    get telemetry(){
      const snapshot=live?structuredClone(live):null;
      snapshot?.groups.forEach((group,index)=>{group.stored=state.banks[index];});
      const meter=gridPowerBalance(snapshot);
      return {state:structuredClone(state),live:snapshot,flow:{...meter,roverKW,
        totalConsumption:meter.deviceKW+roverKW,
        totalDischarge:meter.discharging+roverKW/GRID.dischargeEfficiency,
        totalConversionLoss:meter.conversionLoss+roverKW*(1/GRID.dischargeEfficiency-1)},sol,hour,...solarWeatherReadings(weather),cleaning:weather.sweepElapsed!==null,controls:{...controls},log:[...log]};},
    forecast(facility){
      const snapshot={...options(controls.lamp&&(facility?.lamp??true),facility?.irrigation,facility?.ledMode),facility,blackStart:controls.blackStart,state:structuredClone(state),recovery:recovery.snapshot(),hour,sol,
        solarWeather:structuredClone(weather)};
      return {drillOn:projectPower(snapshot,true),drillOff:projectPower(snapshot,false)};
    },
    reset(energy=initialEnergy){lastDaylight=null;lastReservation=null;roverKW=0;weather=createSolarWeather(firstStormDelay);log.length=0;state=createGridState(energy);recovery=createAutomaticRecovery();lastClock=null;hour=0;sol=0;live=null;}
  };
}
