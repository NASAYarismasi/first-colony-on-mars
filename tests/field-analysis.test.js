import {expect,it} from 'vitest';
import {DAY} from '../src/sim/constants.js';
import {advanceRadiation,radiationAt} from '../src/sim/marsRadiation.js';
import {analyzeFrame} from '../src/colony/frame-analysis.js';
import {analysisSnapshot} from '../src/colony/local-analysis.js';

it('integrates the NASA surface baseline and applies shielding only to the sheltered interval',()=>{
  const exterior=advanceRadiation(undefined,DAY,false);
  expect(exterior.equivalentSv).toBeCloseTo(.00064,12);
  expect(exterior.absorbedGy).toBeCloseTo(.00021,12);
  expect(radiationAt(true).equivalentSvPerSecond).toBe(radiationAt(false).equivalentSvPerSecond/2);
  const mixed=advanceRadiation(advanceRadiation(undefined,DAY/2,false),DAY/2,true);
  expect(mixed.equivalentSv).toBeCloseTo(exterior.equivalentSv*.75,12);
});

it('measures the actual luminance, contrast and edge density of RGBA pixels',()=>{
  const data=new Uint8ClampedArray([0,0,0,255,255,255,255,255,0,0,0,255,255,255,255,255]);
  const result=analyzeFrame({data,width:2,height:2});
  expect(result).toEqual({brightness:50,contrast:100,darkArea:50,edgeArea:100});
});

it('sends only explicit telemetry and local image measurements to the model',()=>{
  const report=analysisSnapshot({lifeSupport:{waterL:17.127,oxygenKg:2.1,radiation:{
    ...radiationAt(false),equivalentSv:.0001},unrelated:'not included'}},{contrast:52.456});
  expect(report.suL).toBe(17.13);
  expect(report.radyasyon.birikimliMiliSv).toBe(.1);
  expect(report.goruntu).toEqual({contrast:52.46});
  expect(report).not.toHaveProperty('unrelated');
});
