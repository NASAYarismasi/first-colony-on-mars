import {stepAir,AIR_DEFAULTS} from '../../../sim/ihanLifeSupportModels.js';

export function supplyHabitatOxygen(air,hours,live,grid,crew){
  const config={...AIR_DEFAULTS,crew};
  const habitatPower=.8*(live.habitat?.duty??0);
  const next=stepAir(air,hours,{powerKW:habitatPower},config);
  // GAME ASSUMPTION: a powered regulator feeds the crew demand from the product tanks.
  const demand=crew*config.oxygenPerPersonDay/24;
  const tankFlow=.12*Math.min(1,grid.oxygen/.2);
  const amount=habitatPower>=config.fanPowerKW
    ? Math.max(0,Math.min(tankFlow*hours,demand*hours,grid.oxygen,
      config.tankCapacityKg-next.oxygenKg+next.unservedOxygenKg-air.unservedOxygenKg))
    : 0;
  const directlyConsumed=Math.min(amount,next.unservedOxygenKg-air.unservedOxygenKg);
  next.oxygenKg+=amount-directlyConsumed;
  next.unservedOxygenKg-=directlyConsumed;
  grid.oxygen-=amount;
  grid.oxygenToHabitat=(grid.oxygenToHabitat??0)+amount;
  grid.oxygenTransferKgHour=hours>0?amount/hours:0;
  return next;
}
