import * as THREE from 'three';
import { AU, EARTH, MARS } from '../sim/constants.js';
import { heliocentricAt } from '../sim/transfer.js';
import { createPlanet, createSky } from './planet.js';
import { label } from './primitives.js';
import { interpolateState } from './interpolate.js';
import { disposeScene } from './dispose.js';
import { vehicleConfiguration } from './vehiclePhases.js';

function line(points,color,dashed=false){const g=new THREE.BufferGeometry().setFromPoints(points);const m=dashed?new THREE.LineDashedMaterial({color,dashSize:2,gapSize:1,transparent:true,opacity:.6}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.85});const l=new THREE.Line(g,m);if(dashed)l.computeLineDistances();return l;}

const MAP_SCALE = 90; // Presentation units per AU; never upload SI interplanetary coordinates.
/** Sample only the flown/planned departure-to-arrival arc, with the Sun at the sim's focus. */
export function sampleTransferArc(transfer, progress = 1, segments = 256) {
  const fraction = THREE.MathUtils.clamp(progress, 0, 1);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const p = heliocentricAt(i / segments * fraction * transfer.duration, transfer).ship;
    return new THREE.Vector3(p[0] / AU * MAP_SCALE, 0, p[1] / AU * MAP_SCALE);
  });
}

const overlaps = (a,b,gap=8) => a.x < b.x+b.w+gap && a.x+a.w+gap > b.x && a.y < b.y+b.h+gap && a.y+a.h+gap > b.y;
/** Pure screen-space layout; sprite rectangles use actual projected pixel sizes. */
export function layoutMapLabels(items, width, height) {
  const margin = 12, placed = [];
  const side = width > 1050 ? 245 : width > 750 ? 195 : 16;
  // Prefer the map's clear centre. Compact viewports may also use the outer area.
  const bounds = [
    { left: side, right: width-side, top: Math.min(185,height*.24), bottom: height-Math.min(190,height*.25) },
    { left: margin, right: width-margin, top: margin, bottom: height-margin }
  ];
  const markers = items.map(item=>({x:item.x-14,y:item.y-14,w:28,h:28}));
  for (const item of items) {
    const w = Math.min(item.w,width-2*margin), h = item.h;
    let selected;
    for (const area of bounds) {
      if (area.right-area.left < w || area.bottom-area.top < h) continue;
      const tryAt = (x,y) => {
        const rect={x:THREE.MathUtils.clamp(x-w/2,area.left,area.right-w),
          y:THREE.MathUtils.clamp(y-h/2,area.top,area.bottom-h),w,h,id:item.id};
        if (![...placed,...markers].some(other=>overlaps(rect,other))) selected=rect;
      };
      for (let radius=46;radius<=360&&!selected;radius+=28) {
        for (let i=0;i<16&&!selected;i++) tryAt(item.x+Math.cos(i*Math.PI/8)*radius,item.y+Math.sin(i*Math.PI/8)*radius);
      }
      // A bounded grid also finds free space when all anchors are in conjunction
      // or projected outside the viewport; never accept an unchecked offset.
      for (let y=area.top+h/2;y<=area.bottom-h/2&&!selected;y+=h+12) {
        for (let x=area.left+w/2;x<=area.right-w/2&&!selected;x+=24) tryAt(x,y);
      }
      if (selected) break;
    }
    // Extremely small windows cannot fit every label: omit rather than overlap.
    if (selected) placed.push(selected);
  }
  return { labels:placed, markers, width, height };
}

export function createMapScene(){let ctx,scene,sky,earth,mars,sun,marker,arrival,arrivalLabel,trajectory,prediction,earthLabel,marsLabel,shipLabel,shipLabels,transitIcon,landerIcon,mode,lastPath='';
  return {enter(context){ctx=context;scene=new THREE.Scene();this.scene=scene;scene.add(new THREE.AmbientLight(0xffffff,.6));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(0,200,0);scene.add(light);
    sky=createSky(ctx.assets);scene.add(sky.mesh);earth=createPlanet(1,false,ctx.assets);mars=createPlanet(1,true,ctx.assets);scene.add(earth.group,mars.group);
    sun=new THREE.Mesh(new THREE.SphereGeometry(4,32,24),new THREE.MeshBasicMaterial({color:new THREE.Color(5,3.2,1.2)}));scene.add(sun);
    // GAME ASSUMPTION: enlarged symbolic silhouette, not map-distance scale.
    marker=new THREE.Group();transitIcon=new THREE.Group();landerIcon=new THREE.Group();marker.add(transitIcon,landerIcon);scene.add(marker);
    const white=new THREE.MeshBasicMaterial({color:0xdedfd7}),tan=new THREE.MeshBasicMaterial({color:0xb99752}),blue=new THREE.MeshBasicMaterial({color:0x6eabbc});
    const iconPart=(parent,geometry,mat,x,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,1,z);parent.add(mesh);return mesh;};
    iconPart(transitIcon,new THREE.BoxGeometry(1.2,.5,5),white,0,1.6);
    iconPart(transitIcon,new THREE.BoxGeometry(7,.15,1.8),blue,0,1.2);
    iconPart(transitIcon,new THREE.ConeGeometry(.8,1.6,12),tan,0,-3.2).rotation.x=-Math.PI/2;
    iconPart(transitIcon,new THREE.ConeGeometry(.8,1,12),tan,0,4.4).rotation.x=-Math.PI/2;
    iconPart(landerIcon,new THREE.CylinderGeometry(1.35,1.5,.5,16),tan,0,-1.3);
    arrival=new THREE.Mesh(new THREE.TorusGeometry(3,.3,8,40),new THREE.MeshBasicMaterial({color:0xf0bd8a}));arrival.rotation.x=Math.PI/2;scene.add(arrival);arrivalLabel=label("MARS ARRIVAL",'#f0bd8a');arrivalLabel.scale.multiplyScalar(3);scene.add(arrivalLabel);
    earthLabel=label("EARTH",'#86c8eb');marsLabel=label('MARS','#edaf84');
    shipLabels={launch:label('SLS / ORION','#9ce7d7'),transit:label("MTV / ORION + PIONEER",'#9ce7d7'),lander:label("PIONEER / LANDER",'#9ce7d7')};
    for(const l of [earthLabel,marsLabel,...Object.values(shipLabels)])l.scale.multiplyScalar(3);scene.add(earthLabel,marsLabel,...Object.values(shipLabels));
  },update(pair,alpha){const s=interpolateState(pair.previous,pair.current,alpha),solar=s.phase==='CRUISE'||s.phase==='MOI_BURN';const nextMode=solar?'solar':s.mars?'mars':'earth';const camera=ctx.cameras.camera;ctx.cameras.update(s,ctx.frameDelta);camera.position.set(0,solar?260:210,solar?340:250);camera.lookAt(0,0,0);camera.fov=46;camera.updateProjectionMatrix();
    const config=vehicleConfiguration(s);
    for(const sprite of Object.values(shipLabels))sprite.visible=false;
    shipLabel=shipLabels[config.launch?'launch':config.docked?'transit':'lander'];
    transitIcon.visible=!config.separated;landerIcon.visible=!config.launch;
    if(solar){
      const halfFov=Math.min(camera.fov*Math.PI/360,Math.atan(Math.tan(camera.fov*Math.PI/360)*camera.aspect));
      const radius=Math.hypot(...s.heliocentric.mars)/AU*MAP_SCALE+15;
      camera.position.setLength(Math.max(camera.position.length(),radius/Math.sin(halfFov)));
      camera.lookAt(0,0,0);
    }
    sky.update({...s,density:0},camera);sun.visible=solar;
    if(mode!==nextMode){mode=nextMode;for(const child of [...scene.children])if(child.userData.path){scene.remove(child);disposeScene(child);}
      if(prediction){scene.remove(prediction);disposeScene(prediction);prediction=null;}if(trajectory){scene.remove(trajectory);disposeScene(trajectory);trajectory=null;}
      if(solar){const start=heliocentricAt(0,s.transfer);for(const planet of [start.earth,start.mars]){const r=Math.hypot(...planet)/AU*MAP_SCALE;const l=line(Array.from({length:257},(_,i)=>new THREE.Vector3(Math.cos(i/256*Math.PI*2)*r,0,Math.sin(i/256*Math.PI*2)*r)),0x365261);l.userData.path=true;scene.add(l);}
        // The planned half-ellipse ends at Mars at arrival, not today's Mars.
        const transfer=line(sampleTransferArc(s.transfer).map(p=>p.setY(.15)),0xdac89c,true);transfer.userData.path=true;scene.add(transfer);
      }lastPath='';
    }
    arrival.visible=arrivalLabel.visible=solar;
    if(solar){earth.group.visible=mars.group.visible=true;earth.group.scale.setScalar(4.5);mars.group.scale.setScalar(3.3);earth.group.position.set(s.heliocentric.earth[0]/AU*MAP_SCALE,0,s.heliocentric.earth[1]/AU*MAP_SCALE);mars.group.position.set(s.heliocentric.mars[0]/AU*MAP_SCALE,0,s.heliocentric.mars[1]/AU*MAP_SCALE);marker.position.set(s.heliocentric.ship[0]/AU*MAP_SCALE,0,s.heliocentric.ship[1]/AU*MAP_SCALE);
      const p=heliocentricAt(s.transfer.duration,s.transfer).ship;arrival.position.set(p[0]/AU*MAP_SCALE,.5,p[1]/AU*MAP_SCALE);
      const pathKey=`solar-${Math.floor(s.cruiseProgress*3000)}`;
      if(lastPath!==pathKey){lastPath=pathKey;if(trajectory){scene.remove(trajectory);disposeScene(trajectory);}trajectory=line(sampleTransferArc(s.transfer,s.cruiseProgress).map(p=>p.setY(.3)),0x9aebd3);scene.add(trajectory);}
    }
    else {const body=s.mars?mars:earth;earth.group.visible=!s.mars;mars.group.visible=s.mars;body.group.position.set(0,0,0);body.group.scale.setScalar(s.radius/100000);body.surface.rotation.y=s.rotation;
      const [r,theta]=s.polar;marker.position.set(r*Math.cos(theta)/100000,0,r*Math.sin(theta)/100000);
      const pathKey=`${Math.floor(s.missionTime)}-${s.phase}`;
      if(lastPath!==pathKey){lastPath=pathKey;
        if(prediction){scene.remove(prediction);disposeScene(prediction);prediction=null;}
        if(s.orbit&&s.orbit.e<1&&Number.isFinite(s.orbit.a)&&s.orbit.a>0){const {a,e}=s.orbit,angle=s.orbit.argumentOfPeriapsis??0;prediction=line(Array.from({length:257},(_,i)=>{const nu=i/256*Math.PI*2,rad=a*(1-e*e)/(1+e*Math.cos(nu))/100000;return new THREE.Vector3(rad*Math.cos(nu+angle),0,rad*Math.sin(nu+angle));}),0xd5c79d,true);scene.add(prediction);}
        if(trajectory){scene.remove(trajectory);disposeScene(trajectory);trajectory=null;}
        if(s.trajectory?.length>1){trajectory=line(s.trajectory.map(p=>new THREE.Vector3(p[0]/100000,0,p[1]/100000)),0x8ee5dc);scene.add(trajectory);}
      }
    }
    shipLabel.visible=true;earthLabel.visible=earth.group.visible;marsLabel.visible=mars.group.visible;
    // Place labels in projected screen coordinates so conjunctions never merge
    // the crew label with a planet label. Sprites stay a readable fixed size.
    camera.updateMatrixWorld();const width=ctx.cameras.camera.aspect*ctx.height,height=ctx.height;
    const items=[[shipLabel,marker],[earthLabel,earth.group],[marsLabel,mars.group],[arrivalLabel,arrival]];
    const projected=items.flatMap(([sprite,anchor],id)=>{
      if(!sprite.visible)return [];
      const p=anchor.position.clone().project(camera),h=width<750?30:34;
      return [{id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,w:sprite.material.map.image.width/64*h,h,depth:p.z}];
    });
    this.labelLayout=layoutMapLabels(projected,width,height);
    for(const item of projected){const sprite=items[item.id][0],rect=this.labelLayout.labels.find(rect=>rect.id===item.id);
      sprite.visible=Boolean(rect);if(!rect)continue;
      const px=rect.x+rect.w/2,py=rect.y+rect.h/2;
      sprite.position.set(px/width*2-1,1-py/height*2,item.depth).unproject(camera);
      // Perspective size depends on camera-space depth, not Euclidean distance.
      const depth=-sprite.position.clone().applyMatrix4(camera.matrixWorldInverse).z,units=2*depth*Math.tan(camera.fov*Math.PI/360)/height;
      sprite.scale.set(rect.w*units,rect.h*units,1);
    }
    this.state=s;this.audioDistance=1e9;
  },exit(){disposeScene(scene);scene=null;}};
}
