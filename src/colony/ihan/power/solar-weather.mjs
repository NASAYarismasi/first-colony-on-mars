import {GRID,SOL_HOURS} from './mars-power.mjs';
import {payForSweep} from './live-grid.mjs';

const solSeconds=SOL_HOURS*3600;
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
// GAME ASSUMPTION: about 3.7 real seconds per full cycle at normal game speed.
const cleanSeconds=300, rowDelay=48, rowCount=6;
export const SOLAR_SWEEP_SECONDS=cleanSeconds+(rowCount-1)*rowDelay;
const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;

export function createSolarWeather(firstStormDelay=75){
  return {elapsed:0,firstStormDelay,opacity:0,rows:[.024,.028,.032,.036,.04,.044],sweepElapsed:null,solarCleaningCredit:0};
}

export function advanceSolarWeather(weather,seconds){
  weather.elapsed+=seconds;
  // GAME ASSUMPTION: local dust fronts with varying timing and strength per sol.
  const sol=Math.floor(weather.elapsed/solSeconds);
  const age=weather.elapsed%solSeconds-(sol===0?weather.firstStormDelay??75:75+(sol*7937)%42000);
  weather.opacity=(.80+(sol%4)*.05)*smooth(age/150)*smooth((510-age)/180);
  weather.rows=weather.rows.map((dust,row)=>Math.min(.75,
    dust+seconds*(.0001/3600+weather.opacity*(.00026+row*.00004))));
}

export function startSolarSweep(weather,state,live,append){
  if(weather.sweepElapsed!==null)return "Wipers already running."
  if(!live||live.recovering)return "Grid not ready for wipers."
  // Recently stored daylight PV can fund a sweep while the night reserve is still charging.
  const floor=live.daylight?Math.min(live.reserve,Math.max(0,state.battery-weather.solarCleaningCredit)):live.reserve
  if(!payForSweep(state,floor))return "Insufficient available battery energy for wipers."
  weather.solarCleaningCredit=0
  weather.sweepElapsed=0
  live.groups.forEach((group,index)=>{group.stored=state.banks[index];})
  append?.("Panel cleaning started. Rows are cleaned in sequence.")
  return null
}

export function cleanSolarRows(weather,seconds,daylight,state,live,append){
  const cost=.20/GRID.dischargeEfficiency;
  const charging=live.groups.reduce((sum,group)=>sum+group.charge,0);
  weather.solarCleaningCredit=daylight
    ? Math.min(cost,weather.solarCleaningCredit+charging*seconds/3600)
    : 0;
  if(weather.sweepElapsed===null){
    if(daylight&&weather.opacity<.26&&mean(weather.rows)>=.085)
      startSolarSweep(weather,state,live,append)
    return;
  }
  const before=weather.sweepElapsed;
  weather.sweepElapsed+=seconds;
  weather.rows=weather.rows.map((dust,row)=>{
    const start=row*rowDelay;
    const cleaned=clamp((weather.sweepElapsed-start)/cleanSeconds)-clamp((before-start)/cleanSeconds);
    return Math.max(.015,dust*Math.exp(-cleaned*(1.45-row*.075)));
  });
  if(weather.sweepElapsed>=SOLAR_SWEEP_SECONDS){
    weather.sweepElapsed=null;
    append?.("Panel cleaning complete.");
  }
}

export function solarWeatherReadings(weather){
  return {opacity:weather.opacity,transmission:1-.76*weather.opacity,rowDust:[...weather.rows],dust:mean(weather.rows),
    strokes:weather.rows.map((_,row)=>weather.sweepElapsed===null?0:
      Math.sin(Math.PI*clamp((weather.sweepElapsed-row*rowDelay)/cleanSeconds)))};
}
