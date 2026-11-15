import { GRID } from './ihan/power/mars-power.mjs';
import { MOXIE_TANK_KG, moxieTankFull } from './ihan/power/live-grid.mjs';

const format=value=>Number.isFinite(value)?value.toLocaleString("en-US",{maximumFractionDigits:3}):'—';
const read=(value,unit)=>format(value)+' '+unit;

function appendTable(root,headers,rows){
  const scroll=document.createElement('div');
  scroll.className='power-detail-table';
  const table=document.createElement('table');
  const head=table.createTHead().insertRow();
  for(const heading of headers){
    const th=document.createElement('th');
    th.scope='col';th.textContent=heading;head.append(th);
  }
  const body=table.createTBody();
  for(const values of rows){
    const tr=body.insertRow();
    for(const value of values)tr.insertCell().textContent=value;
  }
  scroll.append(table);
  root.append(scroll);
}

export function mountPowerTablet(onOpen){
  const panel=document.createElement('section');
  panel.className='colony-drawer';panel.hidden=true;
  panel.innerHTML="<h2>Electricity and energy consumption</h2><div data-readings></div><h3>Grid settings</h3><div data-controls></div><button data-report>Compare two drilling decisions</button><div data-results></div>";
  document.body.append(panel);
  const controller=new AbortController();
  const on=(node,type,fn)=>node.addEventListener(type,fn,{signal:controller.signal});
  const command=(key,value)=>window.dispatchEvent(new CustomEvent('colony:power-command',{detail:{key,value}}));
  let latest;
  const controls=panel.querySelector('[data-controls]');
  for(const [key,label] of [['closed',"Plant breaker"],['drill',"Drilling"],['blackStart',"First-night failure drill"]]){
    const button=document.createElement('button');
    button.type='button';button.dataset.control=key;button.textContent=label;
    on(button,'click',()=>command(key,!latest?.controls[key]));
    controls.append(button);
  }
  const select=document.createElement('select');
  select.setAttribute('aria-label',"Forecast season");
  for(const [value,label] of [[0,"Equinox"],[90,"Northern summer"],[180,"Autumn"],[270,"Northern winter"]]){
    const option=document.createElement('option');option.value=value;option.textContent="Forecast · "+label;select.append(option);
  }
  on(select,'change',()=>command('season',Number(select.value)));
  controls.append(select);
  const sweep=document.createElement('button');
  sweep.type='button';sweep.textContent="Run wipers";
  const sweepStatus=document.createElement('p');
  sweepStatus.setAttribute('role','status');
  on(sweep,'click',()=>command('sweep'));
  on(window,'colony:sweep-status',event=>{sweepStatus.textContent=event.detail;});
  controls.after(sweep,sweepStatus);

  function render(){
    if(panel.hidden||!latest)return;
    for(const button of controls.querySelectorAll('button')){
      button.setAttribute('aria-pressed',String(latest.controls[button.dataset.control]));
    }
    if(document.activeElement!==select)select.value=latest.controls.season;
    const {live,state,flow}=latest;
    const root=panel.querySelector('[data-readings]');
    const scrollOffsets=[...root.querySelectorAll('.power-detail-table')].map(node=>node.scrollLeft);
    root.replaceChildren();
    const add=(tag,content)=>{
      const element=document.createElement(tag);element.textContent=content;root.append(element);
    };
    add('p',live?.recovering?"Emergency grid":live?.daylight?"Daytime · Solar farm":"Nighttime · Battery supply");
    add('p',"Solar generation "+read(flow.solar,'kW')+" · Solar to bus "+read(flow.solarToBus,'kW')+" · Curtailed "+read(flow.curtailed,'kW'));
    add('p',"Instantaneous device consumption "+read(flow.totalConsumption,'kW')+" · Cable loss "+read(flow.feederLoss,'kW')+" · Conversion loss "+read(flow.totalConversionLoss,'kW'));
    add('p',"Battery "+read(state.battery,'kWh')+' / '+read(GRID.capacity,'kWh')+" · Required night reserve "+read(live?.reserve,'kWh')+" · Delivered at landing "+read(state.initialEnergy,'kWh'));
    add('p',"Battery charging "+read(flow.charging,'kW')+" · Battery discharging "+read(flow.totalDischarge,'kW')+" · Battery to AC bus "+read(flow.batteryToBus,'kW'));
    add('p',"Mission total · Solar "+read(state.energy.solar,'kWh')+" · Curtailed solar "+read(state.energy.curtailed,'kWh')+" · Cable and conversion loss "+read(state.energy.feederLoss+state.energy.conversionLoss,'kWh'));
    add('h3',"Device consumption");
    const loadRows=[['habitat',"Habitat"],['water',"Ice drilling"],['moxie','MOXIE'],['greenhouse',"Greenhouse"]].map(([key,name])=>{
      const meter=live?.[key];
      return [name,read(meter?.consumption,'kW'),read(state.loadEnergy[key],'kWh'),read(meter?.loss,'kW'),meter?.sources?.map(id=>'G'+id).join(', ')||'—'];
    });
    loadRows.push(["Battery heater",read(live?.heater,'kW'),read(state.loadEnergy.heater,'kWh'),'—','—'],
      ["Rover charging",read(flow.roverKW,'kW'),read(state.loadEnergy.rover,'kWh'),'—',"Battery"],
      ["Panel cleaning",latest.cleaning?"Cleaning in progress":"Standby",read(state.loadEnergy.cleaning,'kWh'),'—',"Battery"]);
    appendTable(root,["Device","Instantaneous","Total","Line loss","Source"],loadRows);
    add('p',"Greenhouse · Purple light "+read(live?.greenhouse?.ledKW??0,'kW')+" · Irrigation pump "+read(live?.greenhouse?.pumpKW??0,'kW'));
    if(state.waterTankHold)add('p',"Water tank reached its fill limit. Drilling resumes at 95 L.");
    add('p','MOXIE O₂ · '+read(state.oxygen,'kg')+' / '+read(MOXIE_TANK_KG,'kg')+
      (moxieTankFull(state.oxygen)?" · Full":state.oxygenTankHold?" · Awaiting restart level":''));
    add('p',"MOXIE · 3 banks × 9 = 27 units · Instantaneous O₂ "+read((live?.gas?.oxygenKgHour??0)*1000,"g/h")+" · Total O₂ produced "+read((state.oxygenProduced??0)*1000,'g'));
    add('h3',"Solar and battery banks");
    appendTable(root,["Bank","Storage",'PV',"Charge","Discharge","AC output","Reactive power","Apparent power"],
      (live?.groups??[]).map((g,index)=>['G'+(index+1),read(g.stored,'kWh'),read(g.pv,'kW'),
        read(g.charge,'kW'),read(g.draw,'kW'),read(g.output,'kW'),read(g.kvar??0,'kvar'),read(Math.hypot(g.output,g.kvar??0),'kVA')]));
    add('p',"Inter-bank AC transfer "+read(live?.transferKW??0,'kW'));
    for(const transfer of live?.transfers??[])add('p','G'+transfer.from+' → G'+transfer.to+' · '+read(transfer.kw,'kW'));
    add('p',"Wipers · "+(latest.cleaning?"Running":"Ready"));
    add('p',"Light reaching panels %"+format(latest.transmission*100)+" · Panel surface dust %"+format(latest.dust*100));
    if(latest.log.length)add('h3',"Grid events");
    for(const message of latest.log)add('p',message);
    root.querySelectorAll('.power-detail-table').forEach((node,index)=>node.scrollLeft=scrollOffsets[index]??0);
  }

  on(window,'colony:state',event=>{latest=event.detail?.lifeSupport?.electrical;render();});
  on(panel.querySelector('[data-report]'),'click',()=>command('forecast'));
  on(window,'colony:power-report',event=>{
    const results=panel.querySelector('[data-results]');results.replaceChildren();
    for(const [name,rows] of Object.entries(event.detail)){
      const p=document.createElement('p');
      p.textContent=(name==='drillOn'?"Drilling on":"Drilling off")+' · '+rows.map((row,index)=>
        'Sol '+(index+1)+": storage "+read(row.stored,'kWh')+" / habitat shortfall "+read(row.gap,'kWh')+
        " / water "+read(row.water,'L')+' / O₂ '+read(row.oxygen,'kg')+" / light "+read(row.led,"h")).join(' | ');
      results.append(p);
    }
  });
  return {open(){onOpen(panel);render();},dispose(){controller.abort();panel.remove();}};
}
