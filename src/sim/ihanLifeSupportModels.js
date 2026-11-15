/** ?han air/water calculations, a7d5ce6; unchanged bodies. Hours/kW/kg/L at vendor boundary. */
export const AIR_DEFAULTS=Object.freeze({crew:3,oxygenPerPersonDay:.84,co2PerPersonDay:1,productionKgHour:.108,productionPowerKW:2.7,scrubberKgHour:.16,scrubberPowerKW:.5,fanPowerKW:.3,tankCapacityKg:15});
export function createAirState(){return {oxygenKg:8,co2Kg:.08,generatedKg:0,consumedKg:0,removedCO2Kg:0,energyKWh:0,unservedOxygenKg:0,elapsedHours:0};}
export function stepAir(state,hours,{powerKW=3.5,plantsKgHour=0}={},config=AIR_DEFAULTS){
 if(!Number.isFinite(hours)||hours<0||hours>24.66)throw Error('Step must be 0–24.66 hours');
 if(!Number.isFinite(powerKW)||powerKW<0||!Number.isFinite(plantsKgHour)||plantsKgHour<0)throw Error('Invalid power or plant contribution');
 const s={...state};let remaining=powerKW;
 const fans=remaining+1e-9>=config.fanPowerKW;if(fans)remaining-=config.fanPowerKW;
 const scrubber=fans&&remaining+1e-9>=config.scrubberPowerKW;if(scrubber)remaining-=config.scrubberPowerKW;
 const producer=fans&&remaining+1e-9>=config.productionPowerKW;
 const demand=config.crew*config.oxygenPerPersonDay/24*hours;
 const production=producer?config.productionKgHour*hours:0;
 const available=s.oxygenKg+production+plantsKgHour*hours;
 s.oxygenKg=Math.min(config.tankCapacityKg,Math.max(0,available-demand));s.unservedOxygenKg+=Math.max(0,demand-available);
 s.co2Kg+=config.crew*config.co2PerPersonDay/24*hours;
 const removed=scrubber?Math.min(s.co2Kg,config.scrubberKgHour*hours):0;s.co2Kg-=removed;s.removedCO2Kg+=removed;
 s.generatedKg+=production;s.consumedKg+=demand;s.energyKWh+=((fans?config.fanPowerKW:0)+(scrubber?config.scrubberPowerKW:0)+(producer?config.productionPowerKW:0))*hours;s.elapsedHours+=hours;
 return {...s,fans,scrubber,producer,powerUsedKW:(fans?config.fanPowerKW:0)+(scrubber?config.scrubberPowerKW:0)+(producer?config.productionPowerKW:0)};
}

export const WATER_DEFAULTS=Object.freeze({extractionKW:2,litersPerHour:20/6,recoveryKW:.3,recoveryLitersHour:5,recoveryFraction:.85,tankCapacityL:100,iceWaterFraction:.5,captureEfficiency:.8,crew:3,waterPersonDay:3.52});
export function createWaterState(){return{cleanL:30,wasteL:0,iceKg:1000,extractedL:0,recoveredL:0,irrigatedL:0,consumedL:0,unservedL:0,energyKWh:0,elapsedHours:0};}
export function stepWater(state,hours,{powerKW=2.3,extract=true,recycle=true,extractionDuty=1,irrigationLiters=0}={},config=WATER_DEFAULTS){
 if(!Number.isFinite(hours)||hours<0||hours>24.66)throw Error('Step must be 0–24.66 hours');if(!Number.isFinite(powerKW)||powerKW<0)throw Error('Invalid power');
 const s={...state};let remaining=powerKW;
 const roomAtStart=s.cleanL<config.tankCapacityL;
 const recycler=roomAtStart&&recycle&&remaining+1e-9>=config.recoveryKW;if(recycler)remaining-=config.recoveryKW;
 const extractor=roomAtStart&&extract&&extractionDuty>0&&remaining+1e-9>=config.extractionKW*extractionDuty;
 const demand=config.crew*config.waterPersonDay/24*hours,consumed=Math.min(s.cleanL,demand);s.cleanL-=consumed;s.consumedL+=consumed;s.unservedL+=demand-consumed;s.wasteL+=consumed;
 const processed=recycler?Math.min(s.wasteL,config.recoveryLitersHour*hours,(config.tankCapacityL-s.cleanL)/config.recoveryFraction):0;
 const recovered=processed*config.recoveryFraction;s.wasteL-=processed;s.cleanL+=recovered;s.recoveredL+=recovered;
 const irrigated=Math.min(s.cleanL,Math.max(0,irrigationLiters));
 s.cleanL-=irrigated;s.irrigatedL=(s.irrigatedL??0)+irrigated;
 const recoveredPerKg=config.iceWaterFraction*config.captureEfficiency;
 const water=extractor?Math.min(config.litersPerHour*hours*extractionDuty,s.iceKg*recoveredPerKg,config.tankCapacityL-s.cleanL):0;s.iceKg-=water/recoveredPerKg;s.cleanL+=water;s.extractedL+=water;
 const extractionEnergy=water/config.litersPerHour*config.extractionKW;
 const recyclingEnergy=processed/config.recoveryLitersHour*config.recoveryKW;
 s.energyKWh+=extractionEnergy+recyclingEnergy;s.elapsedHours+=hours;
 return{...s,extractor:extractor&&water>0,recycler:recycler&&processed>0,powerUsedKW:hours?(extractionEnergy+recyclingEnergy)/hours:0};
}

