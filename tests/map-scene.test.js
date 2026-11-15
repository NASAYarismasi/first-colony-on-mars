import { expect, it } from 'vitest';
import { layoutMapLabels, sampleTransferArc } from '../src/render/mapScene.js';
import { hohmannTransfer, heliocentricAt } from '../src/sim/transfer.js';
import { AU } from '../src/sim/constants.js';

it('draws the sim Hohmann half-ellipse with the Sun at a focus and tangent endpoints at departure/arrival', () => {
  const transfer=hohmannTransfer({earthAltitude:185000}),points=sampleTransferArc(transfer),scale=points[0].x/AU;
  const a=transfer.a*scale,e=transfer.e,b=a*Math.sqrt(1-e*e);
  expect(points).toHaveLength(257);
  for (const p of points) {
    expect(((p.x+a*e)/a)**2+(p.z/b)**2).toBeCloseTo(1,12);
    expect(p.z).toBeGreaterThanOrEqual(-1e-10);
  }
  const start=heliocentricAt(0,transfer),end=heliocentricAt(transfer.duration,transfer);
  expect(points[0].x/scale).toBeCloseTo(start.earth[0],3);
  expect(points.at(-1).x/scale).toBeCloseTo(end.mars[0],3);
  expect(points.at(-1).z/scale).toBeCloseTo(end.mars[1],3);
  // Secants converge to the circular-orbit tangents (radial derivative is zero).
  const fine=sampleTransferArc(transfer,1,8192),departure=fine[1].clone().sub(fine[0]),arrival=fine.at(-1).clone().sub(fine.at(-2));
  expect(Math.abs(departure.x/departure.z)).toBeLessThan(.001);
  expect(Math.abs(arrival.x/arrival.z)).toBeLessThan(.001);
  const halfway=sampleTransferArc(transfer,.5).at(-1),ship=heliocentricAt(transfer.duration*.5,transfer).ship;
  expect(halfway.x/scale).toBeCloseTo(ship[0],3);
  expect(halfway.z/scale).toBeCloseTo(ship[1],3);
});

it.each([[1920,1080],[1280,720],[1024,768],[800,600],[640,360],[390,844]])('keeps conjunction labels separate and onscreen at %i × %i', (width,height) => {
  for (const [x,y] of [[width/2,height/2],[width-5,10],[-100,height+100]]) {
    const items=[180,85,70,140].map((w,id)=>({id,x,y,w,h:34}));
    const layout=layoutMapLabels(items,width,height);
    expect(layout.labels).toHaveLength(4);
    const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for (const [i,rect] of layout.labels.entries()) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x+rect.w).toBeLessThanOrEqual(width);
      expect(rect.y+rect.h).toBeLessThanOrEqual(height);
      expect(layout.labels.slice(i+1).some(other=>overlaps(rect,other))).toBe(false);
      expect(layout.markers.some(other=>overlaps(rect,other))).toBe(false);
    }
  }
});
