import { CREW_RATES } from '../data/sls.js';

export function missionCalendar(t) {
  if(t.phase==='CRUISE')return `Cruise · Day ${Math.min(Math.ceil(t.transfer.duration/86400),Math.floor(t.cruiseProgress*t.transfer.duration/86400)+1)} / ${Math.ceil(t.transfer.duration/86400)}`;
  return ({PRELAUNCH:"Launch preparation",ASCENT:"Launch from Earth",PARKING_ORBIT:"Earth parking orbit",TMI_BURN:"Mars transfer burn",MOI_BURN:"Mars capture burn",MARS_ORBIT:"Mars parking orbit",DEORBIT:"Approaching Mars",EDL:"Atmospheric entry and landing",LANDED:"Mars surface",FAILED:"Mission assessment"})[t.phase]??"Mission tracking";
}

export function missionElapsed(seconds) {
  const value=Math.max(0,Math.floor(seconds)),days=Math.floor(value/86400),hours=Math.floor(value/3600)%24,minutes=Math.floor(value/60)%60;
  return days?`T+ ${days} d ${hours} h ${minutes} min`:`T+ ${hours} h ${minutes} min ${value%60} s`;
}

export const EVENT_CAPTIONS=Object.freeze({LIFTOFF:"Liftoff · Journey to Mars begins",MAX_Q:"Max Q · Peak aerodynamic load",SRB_SEPARATION:"Solid boosters separated",LAS_JETTISON:"Escape tower jettisoned",MECO:"Main engine cutoff · Stage separation",ICPS_IGNITION:"Upper stage ignited",ORBIT_INSERTION:"Earth parking orbit achieved",TMI_BURN:"Mars transfer burn started",CRUISE:"Earth departure · Interplanetary cruise",MOI_BURN:"Mars capture burn started",MARS_ORBIT:"Mars parking orbit achieved",DEORBIT:"Deorbit · Approaching entry corridor",EDL:"Mars atmospheric entry",HEATSHIELD_JETTISON:"Heat shield jettisoned · Descent engines ignited",LEGS_DEPLOYED:"Deploying landing gear",TOUCHDOWN:"Touchdown · Welcome to Mars"});

/** UI projections only: all quantities originate in the mission snapshot. */
export function vehicleConfiguration(t) {
  if (['DEORBIT','EDL','LANDED'].includes(t.phase) || t.mars && t.phase==='FAILED') return 'lander';
  if (['TMI_BURN','CRUISE','MOI_BURN','MARS_ORBIT'].includes(t.phase)) return 'transit';
  if (t.stages.find(s=>s.id==='srb')?.attached) return 'boosters';
  return t.stages.find(s=>s.id==='core')?.attached ? 'core' : 'upper';
}

export function apsisReadout(value, eccentricity, kind) {
  if (kind==='apo' && (eccentricity>=1 || value===Infinity)) return {value:'—',unit:"open trajectory"};
  if (Number.isFinite(value) && value<0) return {value:'—',unit:"suborbital"};
  return {value:Number.isFinite(value)?(value/1000).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1}):'—',unit:Number.isFinite(value)?'km':''};
}

export function resourceDays(t, resource) {
  const consumption=CREW_RATES[resource]*t.crew.length;
  return consumption>0 ? t.supplies[resource]/consumption : Infinity;
}

export function nextEvent(t) {
  if (t.phase==='PRELAUNCH') return t.countdown.running ? t.countdown.time < -6.5 ? "Main engine ignition" : "Liftoff / T−0" : "Start countdown";
  if (t.phase==='ASCENT') {
    if(t.stages.find(s=>s.id==='srb').attached) return "Solid booster separation";
    if(t.lasAttached) return "Escape tower jettison";
    return t.stages.find(s=>s.id==='core').attached ? "Core stage separation" : "Parking orbit insertion";
  }
  return {PARKING_ORBIT:"Mars transfer / B",TMI_BURN:"Start of cruise",CRUISE:"Mars capture burn",MOI_BURN:"Mars parking orbit",MARS_ORBIT:"Start descent / B",DEORBIT:"Atmospheric entry",EDL:t.engineFiring?"Touchdown":"Descent engine ignition",LANDED:"Handoff to colony",FAILED:"Mission assessment"}[t.phase]??"Mission tracking";
}
