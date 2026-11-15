export const WHEAT_AREA_M2=6*1.28*2.37
const REFERENCE_PPFD=350
const COMPENSATION_PPFD=200
const REFERENCE_NET_UMOL=7

export function stepGreenhouseGas(state,{elevation,transmission,ledFraction},hours) {
  // GAME ASSUMPTION: canopy daylight scaling and CO2:O2 equivalence.
  // Wheat reference: https://ntrs.nasa.gov/api/citations/20150022488/downloads/20150022488.pdf
  const daylightPPFD=350*Math.max(0,elevation)*transmission
  const ppfd=daylightPPFD+REFERENCE_PPFD*ledFraction
  const flux=Math.min(27,(ppfd-COMPENSATION_PPFD)*REFERENCE_NET_UMOL/(REFERENCE_PPFD-COMPENSATION_PPFD))
  const wheatKgHour=flux*WHEAT_AREA_M2*3600*32e-9
  // GAME ASSUMPTIONS: six lit tube faces, diffuse light and effective photon yield.
  // Chlorella photobioreactor experiments: https://pmc.ncbi.nlm.nih.gov/articles/PMC4210543/
  const tubeArea=6*.86*2.25
  const algalPhotons=tubeArea*20*Math.max(0,elevation)*transmission+180*2.5*.65*ledFraction
  const algaeKgHour=algalPhotons*.04*3600*32e-9-.00035
  const netKgHour=wheatKgHour+algaeKgHour
  state.greenhouseOxygenKg+=(Math.max(0,wheatKgHour)+Math.max(0,algaeKgHour))*hours
  state.greenhouseNetKg+=netKgHour*hours
  return {ppfd,wheatKgHour,algaeKgHour,netKgHour,generatedKg:state.greenhouseOxygenKg,netKg:state.greenhouseNetKg}
}
