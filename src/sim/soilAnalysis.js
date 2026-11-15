// GAME ASSUMPTION: illustrative sealed laboratory sample, not measured Mars chemistry.
export const SOIL_SCAN_SECONDS=6;
export function createSoilAnalysis(){return {phase:'ready',elapsed:0,result:null};}
export function startSoilAnalysis(state){return state.phase==='scanning'?state:{phase:'scanning',elapsed:0,result:null};}
export function stepSoilAnalysis(state,seconds){
 if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid analysis duration');
 if(state.phase!=='scanning')return state;
 const elapsed=Math.min(SOIL_SCAN_SECONDS,state.elapsed+seconds);
 return {phase:elapsed===SOIL_SCAN_SECONDS?'complete':'scanning',elapsed,result:elapsed===SOIL_SCAN_SECONDS?{sample:'REG-01',waterIcePercent:2.4,ironOxidePercent:14.2,perchlorateDetected:true,planting:"Treatment and nutrient supplementation required",illustrative:true}:null};
}
