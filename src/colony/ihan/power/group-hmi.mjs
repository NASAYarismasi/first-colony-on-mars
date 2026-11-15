export function groupStatus({daylight,pv,charge,draw}){
  // Use the same precision as the kW cards.
  if(draw>=.005)return "Battery supplying power";
  if(daylight===false)return "Night · No solar generation";
  if(charge>=.005)return "Battery charging";
  if(pv>=.005)return "Panels generating electricity";
  return "No solar generation";
}

export function drawGroupHmi(ctx,index,metrics,detail) {
  const {energy,pv,charge,draw,output,kvar,weakest,strongest,lowPanels}=metrics
  const format=new Intl.NumberFormat("en-US",{maximumFractionDigits:2})
  const f=value=>Number.isFinite(value)?format.format(value):"—"
  const color=(hex)=>{ctx.fillStyle=hex}
  const text=(value,x,y,size,shade="#eff9fa",weight=400)=>{
    color(shade)
    ctx.font=weight+" "+size+"px Segoe UI, sans-serif"
    ctx.fillText(value,x,y)
  }
  color("#11212a");ctx.fillRect(0,0,768,384)
  color("#164654");ctx.fillRect(0,0,768,68)
  text("MARS MICROGRID",23,42,24,"#d5f5f5",700)
  text("G"+(index+1)+"  /  "+(["DRILLING","GREENHOUSE","MOXIE","HABITAT"][index]??"STORAGE"),420,42,25,"#ffffff",700)
  const level=Math.min(1,Math.max(0,energy/36))
  color("#1d333e");ctx.fillRect(22,86,724,82)
  text("BATTERY REMAINING  "+f(energy)+" / 36 kWh",37,119,27)
  text(f(level*100)+"%",630,119,25,"#7de3d5",700)
  color("#354b54");ctx.fillRect(37,135,692,13)
  color("#58d6c1");ctx.fillRect(37,135,692*level,13)
  const cards=detail?
    [["SUPPLIED TO GRID",output,"kW"],["REACTIVE POWER",kvar,"kvar"],["DEVICE LOAD",Math.hypot(output,kvar),"kVA"]]:
    [["SOLAR GENERATION",pv],["BATTERY CHARGING",charge],["BATTERY DISCHARGING",draw]]
  cards.forEach(([label,value,unit="kW"],i)=>{
    const x=22+i*244
    color("#1d333e");ctx.fillRect(x,185,236,107)
    text(label,x+15,216,19,"#a5bbc4",600)
    text(f(value)+" "+unit,x+15,261,34,"#ffffff",700)
  })
  const status=groupStatus(metrics)
  const waterStatus=metrics.waterTankHold?"Water tank limit · Drilling on standby":null
  const lineStatus=metrics.waterLineEnergized?"Feeder open":"Feeder de-energized"
  if(detail) {
    text("●  "+(waterStatus??status),25,327,21,"#d5f5f5",700)
    text(waterStatus?lineStatus+" · "+status:"Panel "+f(weakest*1000)+"–"+f(strongest*1000)+" W · Low: "+(lowPanels??0)+" / 84",25,352,17,"#a5bbc4")
  } else {
    text("●  "+(waterStatus??status),25,327,21,draw||charge?"#74e2c1":"#a5bbc4",700)
    text(waterStatus?lineStatus+" · "+status:"kW: instantaneous power   ·   kWh: stored energy",25,353,17,"#a5bbc4")
  }
  color("#1c5360");ctx.fillRect(492,306,254,58)
  text(detail?"OVERVIEW  ›":"CIRCUIT DETAILS  ›",509,343,22,"#e5ffff",700)
}
