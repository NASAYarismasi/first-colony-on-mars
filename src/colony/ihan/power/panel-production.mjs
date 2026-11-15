const PANEL_COUNT=420
const GROUP_SIZE=84
const PANELS_PER_ROW=70
const installationYield=[.985,.965,1,.945,.975]
const fraction=value=>value-Math.floor(value)
const panels=Array.from({length:PANEL_COUNT},(_,index)=>({
  row:Math.floor(index/PANELS_PER_ROW),
  tolerance:.975+.05*fraction(Math.sin((index+1)*12.9898)*43758.5453),
  dustBias:.82+.36*fraction(Math.sin((index+1)*8.731)*34501.7),
  nearStructure:index%29===0 || index%47===0
}))

export function panelProduction(idealKW,elevation,east,rowDust) {
  const perPanel=idealKW/PANEL_COUNT
  const groups=Array.from({length:5},()=>({pv:0,weakest:Infinity,strongest:0,lowPanels:0}))
  for(const [index,panel] of panels.entries()){
    const groupIndex=Math.floor(index/GROUP_SIZE)
    const group=groups[groupIndex]
    const lowSun=Math.max(0,1-elevation/.26)
    const edgeRow=east>=0?panel.row===0:panel.row===5
    const shade=1-lowSun*((edgeRow?.015:.10)+(panel.nearStructure?.33:0))
    const soiling=1-Math.min(.9,rowDust[panel.row]*panel.dustBias)
    const power=perPanel*installationYield[groupIndex]*panel.tolerance*shade*soiling
    group.pv+=power
    group.weakest=Math.min(group.weakest,power)
    group.strongest=Math.max(group.strongest,power)
    if(perPanel>0&&power<perPanel*.8) group.lowPanels++
  }
  return groups
}
