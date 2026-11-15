/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
export function calculateEclss(days, recoveryPercent, electrolysis) {
  // Original reference rates: NASA BVAD, https://ntrs.nasa.gov/citations/20150019662
  // Fixed three-person scenario; 3035 kcal/day is İhan's planning assumption.
  const oxygen = 3 * days * .84;
  return {water:3*days*3.52*(1-recoveryPercent/100)+(electrolysis ? oxygen*9/8 : 0),
    savedWater:3*days*3.52*recoveryPercent/100, oxygen:electrolysis ? 0 : oxygen,
    foodKcal:3*days*3035};
}
export function bindEclss(root = document) {
  const abort = new AbortController();
  const byId = id => root.getElementById(id);
  const number = new Intl.NumberFormat("en-US",{maximumFractionDigits:1});
  function update() {
    const days=Number(byId('eclss-days').value), recovery=Number(byId('eclss-recovery').value);
    const result=calculateEclss(days,recovery,byId('eclss-electrolysis').checked);
    byId('eclss-days-value').textContent=days+" Earth days";
    byId('eclss-recovery-value').textContent='%'+recovery;
    for(const [key,value] of Object.entries(result)) byId('eclss-'+key).textContent=number.format(value)+(key==='foodKcal'?' kcal':' kg');
    const generation=420*Number(byId('eclss-weather').value);
    byId('eclss-solar').textContent=number.format(generation)+" kWh/sol · Balance "+number.format(generation-413)+' kWh/sol';
  }
  for(const id of ['days','recovery','electrolysis','weather']) byId('eclss-'+id).addEventListener('input',update,{signal:abort.signal});
  update();
  return () => abort.abort();
}
