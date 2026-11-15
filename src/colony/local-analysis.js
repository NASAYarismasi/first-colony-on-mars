import {TANK_L} from './ihan/power/mars-power.mjs';

const LOCAL_API = 'http://127.0.0.1:11434/api';
const REQUEST_TIMEOUT = 120_000;

export async function localModels(signal) {
  const response = await fetch(LOCAL_API+'/tags',{signal});
  if(!response.ok)throw new Error('Ollama model listesi alınamadı.');
  const {models}=await response.json();
  return (models??[])
    .filter(model=>model.name&&!model.remote_host&&!model.remote_model&&!/-cloud(?=[:/]|$)|:cloud(?:$|[-/])/.test(model.name))
    .map(model=>model.name);
}

const rounded=value=>Number.isFinite(value)?Number(value.toFixed(2)):null;

export function analysisSnapshot(detail,frame) {
  const t=detail.lifeSupport;
  const grid=t?.electrical;
  const flow=grid?.flow;
  const dose=t?.radiation;
  return {
    sol:detail.state?.sol, marsSaati:rounded(detail.lmst),
    gunesAcisiDerece:rounded(detail.sunElevationDeg),
    suL:rounded(t?.waterL), habitatOksijeniKg:rounded(t?.oxygenKg), moxieKg:rounded(grid?.state?.oxygen),
    yasayanMurettebat:t?.crew,
    gunesKW:rounded(flow?.solar), tuketimKW:rounded(flow?.totalConsumption),
    bataryaKWh:rounded(grid?.state?.battery), gerekenGeceRezerviKWh:rounded(grid?.live?.reserve),
    panellereUlasanIsikYuzde:rounded(grid?.transmission*100),
    seraLedi:t?.greenhouse?.ledOn, sulama:t?.greenhouse?.pumpOn,
    radyasyon:dose?{habitatKorumasinda:dose.sheltered, mikroSvSaat:rounded(dose.equivalentSvPerSecond*3.6e9),
      birikimliMiliSv:rounded(dose.equivalentSv*1000)}:null,
    goruntu:frame?Object.fromEntries(Object.entries(frame).map(([key,value])=>[key,rounded(value)])):null,
  };
}

export function currentFinding(telemetry){
  const value=number=>number.toLocaleString('tr-TR',{maximumFractionDigits:2});
  const {suL,bataryaKWh,gerekenGeceRezerviKWh,panellereUlasanIsikYuzde}=telemetry;
  // GAME ASSUMPTION: flag the last 20% of the clean-water tank.
  if(suL!==null&&suL<TANK_L*.2){
    return {fact:`Temiz su ${value(suL)} / ${TANK_L} L.`,
      action:'Sera panelinden sulamayı duraklat ve su tesisinde sondajı denetle.'};
  }
  const gap=gerekenGeceRezerviKWh-bataryaKWh;
  if(bataryaKWh!==null&&gerekenGeceRezerviKWh!==null&&gap>.1){
    return {fact:`Batarya ${value(bataryaKWh)} kWh. Hesaplanan gece rezervine ${value(gap)} kWh eksik.`,
      action:'Enerji sayfasından şarjı izle ve isteğe bağlı tüketimi azalt.'};
  }
  // GAME ASSUMPTION: check the solar field when transmission falls below 75%.
  if(panellereUlasanIsikYuzde!==null&&panellereUlasanIsikYuzde<75){
    return {fact:`Panellere ulaşan ışık %${value(panellereUlasanIsikYuzde)}.`,
      action:'Güneş ve enerji panelinde hava durumunu ve panel yüzeyi tozunu kontrol et.'};
  }
  if(bataryaKWh!==null&&gerekenGeceRezerviKWh!==null){
    return {fact:`Batarya ${value(bataryaKWh)} kWh. Hesaplanan gece rezervi ${value(gerekenGeceRezerviKWh)} kWh.`,
      action:'Geceye yaklaşırken KERK üzerinden şarj ve tüketimi izle.'};
  }
  return {fact:'Şebeke telemetrisi hazırlanıyor.',action:'Bir sonraki okumada enerji ekranını kontrol et.'};
}

export async function analyzeWithLocalModel({model,question,telemetry,signal,onText}){
  const response=await fetch(LOCAL_API+'/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(REQUEST_TIMEOUT)]),
    body:JSON.stringify({
      model,stream:true,keep_alive:'2m',
      options:{num_ctx:1024,num_predict:170,temperature:.3,repeat_penalty:1.2,repeat_last_n:128,num_gpu:0},
      messages:[
        {role:'system',content:'Mars kolonisinin KERK danışmanısın. İki kısa Türkçe cümle yaz, giriş yapma. Varsayılan soruda verilen doğrulanmış durumu ve öneriyi açıkla. Özel bir soru varsa yalnızca ilgili telemetriyle yanıtla. Ölçüm birimlerini koru. Oyun için tanımlanmayan düşük, yüksek, güvenli veya tehlikeli eşikler çıkarma. Radyasyon Gale referanslı bir oyun tahminidir. Görüntü değerleri piksel ölçümleridir.'},
        {role:'user',content:JSON.stringify({soru:question||'Öncelikli durumu ve öneriyi iki cümlede açıkla.',dogrulanmisDurum:currentFinding(telemetry),telemetri:telemetry})},
      ],
    }),
  });
  if(!response.ok||!response.body)throw new Error('Ollama isteği tamamlayamadı.');
  let buffer='',result='';
  for await(const chunk of response.body.pipeThrough(new TextDecoderStream())){
    buffer+=chunk;
    const lines=buffer.split('\n');
    buffer=lines.pop();
    for(const line of lines){
      if(!line.trim())continue;
      const part=JSON.parse(line);
      if(part.error)throw new Error('Yerel model yanıtı tamamlayamadı.');
      result+=part.message?.content??'';
      onText(result);
    }
  }
  if(!result.trim())throw new Error('Yerel model boş yanıt verdi.');
}
