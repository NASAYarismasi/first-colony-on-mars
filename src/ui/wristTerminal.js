import { GRID, TANK_L } from '../colony/ihan/power/mars-power.mjs';
import { MOXIE_TANK_KG } from '../colony/ihan/power/live-grid.mjs';
/**
 * KERK Mark-IV wrist terminal — original arm, case and orange display design by Samet.
 * DOM/CSS adaptation shares one lightweight overlay between flight and colony.
 * No extra renderer, texture, simulated medical readings or independent mission clock.
 */
import './wrist.css';

const format = (value, digits = 1) => Number.isFinite(value)
  ? value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
const reading = (value, unit, digits = 1) => Number.isFinite(value) ? `${format(value, digits)} ${unit}` : '—';
const escape = value => String(value ?? '—').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const row = (label, value) => `<div class="ares-row"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`;
const card = (label, value, note = '') => `<div class="ares-card"><small>${escape(label)}</small><strong>${escape(value)}</strong>${note ? `<span>${escape(note)}</span>` : ''}</div>`;
const resourceNames = { oxygen: "O₂ / OXYGEN", water: "WATER", food: "FOOD" };

function screenMarkup(data, screen) {
  const colony = data.mode === 'colony';
  if(colony) return colonyDashboard(data,screen);
  if (screen === 1) {
    return `<div class="ares-resource-grid">${Object.entries(resourceNames).map(([key, label]) => {
      const resource = data.resources?.[key] ?? {};
      return card(label, reading(colony ? resource.sols : resource.days, colony ? 'sol' : "days"),
        colony ? `${reading(resource.personSols, "person-sols")} · ${reading(resource.days, "Earth days")}` : reading(resource.kg, 'kg'));
    }).join('')}</div><p class="ares-note">${colony ? `${data.livingCrew} based on living crew consumption. Production credits are not included.` : `${data.crew?.length ?? 0} people · NASA Ames daily consumption reference · no recovery credit.`}</p>`;
  }
  if (screen === 2) {
    if (colony) {
      const energy = data.energy ?? {};
      return `<dl>${row("Active mission", data.activeTask)}${row("Weather", data.stormLabel)}${row("Last sol production / consumption", `${reading(energy.generation, "units")} / ${reading(energy.used, "units")}`)}${row("Battery / capacity", `${reading(energy.battery, "units")} / ${reading(energy.capacity, "units")}`)}${row("Initial energy", reading(energy.startup, "units"))}${row("Sun elevation", reading(data.sunElevationDeg, '°'))}${row("Headlamp / L", data.headlamp === null ? "Awaiting data" : data.headlamp ? "On" : "Off")}</dl>`;
    }
    const nav = data.navigation ?? {};
    return `<div class="ares-nav-grid">${card(nav.distanceLabel, reading(nav.distance, nav.distanceUnit, nav.distanceUnit === 'AU' ? 3 : 1))}${card(nav.velocityLabel, reading(nav.velocity, nav.velocityUnit, 2))}</div><dl>${row("Flight phase", data.phaseLabel)}${row("Next event", data.nextEvent)}</dl>`;
  }
  if (screen === 3) {
    return `<div class="ares-crew">${(data.crew ?? []).map(person => `<article><div><b>${escape(person.name)}</b><span>${escape(person.roleLabel)}</span></div><strong>${person.alive ? reading(person.health, '%', 0) : "NO VITAL SIGNS"}</strong></article>`).join('') || "<p class=\"ares-note\">Awaiting crew data.</p>"}</div><p class="ares-note">${data.livingCrew ?? 0} living crew · health comes from the mission simulation.</p>`;
  }
  const remaining = Object.values(data.resources ?? {}).map(resource => colony ? resource.sols : resource.days).filter(Number.isFinite);
  const limit = remaining.length ? Math.min(...remaining) : null;
  return `<div class="ares-status-grid">${card(colony ? "MARS LOCAL TIME / LMST" : "MISSION TIME / MET", colony ? data.lmst ?? '—' : data.met,
    colony ? `SOL ${format(data.sol, 0)}` : data.phaseLabel)}${card("LIFE SUPPORT / MINIMUM", reading(limit, colony ? 'sol' : "days"), `${data.livingCrew ?? 0} living crew`)}</div>
    <dl>${row(colony ? "Weather" : "Cabin power bus", colony ? data.stormLabel : data.power?.enabled === null ? "Awaiting data" : data.power?.enabled ? "Online" : "Off")}${row(colony ? "Active mission" : "Next event", data.nextEvent)}</dl>`;
}

function colonyDashboard(data,screen) {
  const t=data.lifeSupport??{}, air=t.air??{},water=t.water??{};
  const grid=t.electrical, flow=grid?.flow, battery=grid?.state?.battery;
  const tile=(label,value,note,tone='')=>`<article class="ops-metric ${tone}"><small>${escape(label)}</small><strong>${escape(value)}</strong><span>${escape(note)}</span></article>`;
  const waterReserve=Number.isFinite(t.waterL)?reading(Math.floor(t.waterL/TANK_L*1000)/10,'%',1):'—';
  const oxygen=grid?.state?.oxygen;
  const oxygenLevel=Math.floor(oxygen/MOXIE_TANK_KG*1000)/100;
  const oxygenReserve=Number.isFinite(oxygenLevel)?`${format(oxygenLevel,oxygenLevel===10?0:2)} / 10`:'—';
  if(screen===3)return `<div class="ops-heading"><b>CREW</b><span>${data.livingCrew} crew on duty</span></div><div class="ares-crew">${(data.crew??[]).map(p=>`<article><div><b>${escape(p.name)}</b><span>${escape(p.roleLabel)}</span></div><strong>${p.alive?reading(p.health,'%',0):"NO VITAL SIGNS"}</strong></article>`).join('')}</div>`;
  if(screen===2)return `<div class="ops-heading"><b>ELECTRICITY AND ENERGY CONSUMPTION</b></div>
    <div class="ops-grid">
      ${tile("SOLAR INPUT",reading(flow?.solar,'kW',2),`To bus ${reading(flow?.solarToBus,'kW',2)}`)}
      ${tile("CURRENT CONSUMPTION",reading(flow?.totalConsumption,'kW',2),`Total consumed ${reading(t.spentKWh,'kWh',2)}`)}
      ${tile("BATTERY RESERVE",reading(battery,'kWh',2),`Capacity ${GRID.capacity} kWh`,'amber')}
      ${tile("REQUIRED NIGHT RESERVE",reading(grid?.live?.reserve,'kWh',2), "Habitat, heating and greenhouse",'amber')}
    </div><dl>
      ${row("Battery charge / discharge",`${reading(flow?.charging,'kW',2)} / ${reading(flow?.totalDischarge,'kW',2)}`)}
      ${row("Cable / conversion loss",`${reading(flow?.feederLoss,'kW',2)} / ${reading(flow?.totalConversionLoss,'kW',2)}`)}
      ${row("Curtailed solar power",reading(flow?.curtailed,'kW',2))}
    </dl>`;
  if(screen===1)return `<div class="ops-heading"><b>LIFE SUPPORT</b></div><div class="ops-grid">
    ${tile("WATER EXTRACTED FROM ICE",reading(water.extractedL,'L'),"Mission total",'blue')}
    ${tile("CLEAN WATER RESERVE",waterReserve,`${reading(t.waterL,'L')} / ${TANK_L} L`,'blue')}
    ${tile("TOTAL O₂ PRODUCED",reading(grid?.state?.oxygenProduced,'kg',3),"MOXIE · Mission total")}
    ${tile("CURRENT MOXIE O₂",reading((grid?.live?.gas?.oxygenKgHour??0)*1000,"g/h",1),"27 units · 3 × 9")}
    ${tile("MOXIE O₂ RESERVE",oxygenReserve,`${reading(oxygen,'kg',3)} / ${MOXIE_TANK_KG} kg`)}
    </div><dl>${row("Habitat oxygen reserve",reading(t.oxygenKg,'kg',3))}${row("Recovered water",reading(water.recoveredL,'L'))}${row("Wastewater",reading(water.wasteL,'L'))}${row("CO₂ removed",reading(air.removedCO2Kg,'kg'))}</dl>`;
  return `<div class="ops-heading"><b>BASE CONTROL CENTER</b><span>LMST ${escape(data.lmst??'—')}</span></div><div class="ops-grid">${tile("WATER RESERVE",reading(t.waterL,'L'),`Produced ${reading(water.extractedL,'L')}`,'blue')}${tile("OXYGEN RESERVE",reading(t.oxygenKg,'kg'),`Produced ${reading(air.generatedKg,'kg')}`)}${tile("FACILITY POWER",reading(t.powerKW,'kW'),`Budget ${reading(t.availableKW,'kW')}`,'amber')}${tile("BATTERY",reading(battery,'kWh'),`Capacity ${GRID.capacity} kWh`,'amber')}</div><div class="ops-task"><small>ACTIVE MISSION</small><b>${escape(data.activeTask)}</b></div>`;
}

/**
 * @param {{root: HTMLElement, getData: () => object|null, onToggle?: (raised: boolean) => void, surfaceShortcuts?: boolean, canToggle?: () => boolean}} options
 * getData returns flightWristData()/colonyWristData(). onToggle is optional host UI synchronization.
 */
export function mountWristTerminal({ root, getData, onToggle = () => {}, surfaceShortcuts = false, canToggle = () => true }) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const host = doc.createElement('aside');
  host.className = 'ares-wrist';
  host.setAttribute('aria-label', "KERK wrist computer");
  host.setAttribute('aria-hidden', 'true');
  const artBase = `${import.meta.env.BASE_URL}art/`;
  host.innerHTML = `<div class="ares-arm" inert><div class="ares-hold">
    <section class="ares-case"><i class="ares-screw ares-screw-tl"></i><i class="ares-screw ares-screw-tr"></i><i class="ares-screw ares-screw-bl"></i><i class="ares-screw ares-screw-br"></i>
      <div class="ares-hardware" aria-hidden="true"><span>KERK / EVA</span><i></i><i></i><i></i><b>IV</b></div>
      <div class="ares-screen"><header class="ares-header"><b><i></i> KERK <span>MARK-IV</span></b><button type="button" class="ares-close" aria-label="Kolu indir">ESC ×</button></header>
      <div class="ares-location"><span data-ares-phase></span><time data-ares-clock></time></div>
      <nav class="ares-tabs" aria-label="Terminal screens">${["STATUS", "LIFE SUPPORT", "CRUISE", "CREW"].map((name, index) => `<button type="button" data-ares-tab="${index}" aria-pressed="${index === 0}">${name}</button>`).join('')}</nav>
      <p class="ares-notice" aria-live="polite"></p><div class="ares-content"></div><div class="ares-panel-slot" hidden></div><footer class="ares-footer"><span>TAB · CLOSE TABLET</span><span>WHEEL · PAGE</span><b data-ares-page>01 / 04</b></footer></div>
      <div class="ares-case-label" aria-hidden="true">EVA · MISSION TERMINAL <span>KERK—01</span></div>
    </section>
    <img class="ares-grip ares-grip-front" src="${artBase}eva-gloves.png" alt="" aria-hidden="true" draggable="false" width="900" height="620">
    </div></div>`;
  root.append(host);
  const arm = host.querySelector('.ares-arm'), content = host.querySelector('.ares-content');
  const phase = host.querySelector('[data-ares-phase]'), clock = host.querySelector('[data-ares-clock]');
  const page = host.querySelector('[data-ares-page]'), tabs = [...host.querySelectorAll('[data-ares-tab]')];
  let raised = false, screen = 0, disposed = false, timer = null, noticeTimer=null, lastMarkup = '';
  const notice=host.querySelector('.ares-notice');
  const removers = [];
  const on = (target, type, handler, options) => {
    const listenerOptions = typeof options === 'boolean' ? { capture: options } : options;
    target.addEventListener(type, handler, listenerOptions);
    removers.push(() => target.removeEventListener(type, handler, listenerOptions));
  };
  function update() {
    if (!raised || disposed) return;
    const data = getData();host.setAttribute('data-light',data?.mode==='colony'?'mars':'cabin');
    const markup = data ? screenMarkup(data, screen) : "<p class=\"ares-note\">Awaiting telemetry connection.</p>";
    if (markup !== lastMarkup) { content.innerHTML = markup; lastMarkup = markup; }
    phase.textContent = data?.mode === 'colony' ? `JEZERO · SOL ${format(data.sol, 0)}` : data?.phaseLabel ?? "AWAITING DATA";
    // Samet's live clock remains a clearly labelled Earth UTC clock, separate from MET / LMST.
    clock.textContent = `UTC ${new Date().toISOString().slice(11, 19)}`;
    tabs.forEach((tab,i)=>tab.textContent=(data?.mode==='colony'?["OVERVIEW","WATER & OXYGEN","ENERGY","CREW"]:["STATUS","LIFE SUPPORT","CRUISE","CREW"])[i]);
  }
  function setRaised(value, notify = false) {
    if (disposed || raised === Boolean(value)) return;
    win.clearTimeout(noticeTimer);host.classList.remove('is-peeking');
    raised = Boolean(value);
    host.classList.toggle('is-raised', raised);
    host.setAttribute('aria-hidden', String(!raised));
    arm.inert = !raised;
    if (raised) {
      update();
      timer = win.setInterval(update, 250); // UI sampling only; mission time comes from getData.
    } else {
      win.clearInterval(timer); timer = null;
      if (host.contains(doc.activeElement)) doc.activeElement.blur();
    }
    if (notify) onToggle(raised);
  }
  const toggle = () => setRaised(!raised, true);
  function selectPage(index) {
    screen = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === screen)));
    page.textContent = `0${screen + 1} / 04`;
    update();
  }
  on(win, 'keydown', event => {
    const editable = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable;
    const close = event.key === 'Escape' || event.code === 'Escape';
    const toggleKey = event.key === 'Tab' || event.code === 'Tab' ||
      surfaceShortcuts && ['KeyQ'].includes(event.code);
    if (!canToggle()) return;
    if (editable && !close || event.metaKey || event.ctrlKey) return;
    if (!(toggleKey || raised && close)) return;
    // The overlay owns its shortcuts before gameplay handles the same key.
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (toggleKey) toggle();
    else if (close) setRaised(false, true);

  }, true);
  on(win, 'wheel', event => {
    if (!raised) return;
    if(event.target?.closest?.('.ares-content,.ares-panel-slot,.ares-colony-actions'))return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.deltaY) selectPage(screen + Math.sign(event.deltaY));
  }, { capture: true, passive: false });
  on(host.querySelector('.ares-close'), 'click', () => setRaised(false, true));
  tabs.forEach((tab, index) => on(tab, 'click', () => selectPage(index)));
  return {
    toggle, setRaised, update,
    notify(message){if(disposed||!message)return;notice.textContent=message;win.clearTimeout(noticeTimer);host.classList.add('has-notice');if(!raised){host.classList.add('is-peeking');host.setAttribute('aria-hidden','false');}noticeTimer=win.setTimeout(()=>{host.classList.remove('is-peeking','has-notice');if(!raised)host.setAttribute('aria-hidden','true');},3800);},
    get raised() { return raised; },
    get screen() { return screen; },
    dispose() {
      if (disposed) return;
      disposed = true; win.clearInterval(timer);win.clearTimeout(noticeTimer);
      removers.forEach(remove => remove()); host.remove();
    },
  };
}
