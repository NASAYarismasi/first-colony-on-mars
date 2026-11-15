/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
import * as T from 'three';
import { makeKit } from './equipment-kit.mjs';
export function createGreenhouse(scene){
 const group=new T.Group();group.name='AlgaeGreenhouse';scene.add(group);const k=makeKit(group);
 const transparent=new T.MeshPhysicalMaterial({color:0xb0d0d2,transparent:true,opacity:.18,roughness:.20,metalness:.05,side:T.DoubleSide,depthWrite:false});
 const fabricCanvas=document.createElement('canvas');fabricCanvas.width=fabricCanvas.height=256;const fc=fabricCanvas.getContext('2d');fc.fillStyle='#d9dfcf';fc.fillRect(0,0,256,256);fc.strokeStyle='rgba(90,105,85,.28)';fc.lineWidth=1;for(let i=0;i<=256;i+=16){fc.beginPath();fc.moveTo(i,0);fc.lineTo(i,256);fc.moveTo(0,i);fc.lineTo(256,i);fc.stroke();}const fabricTexture=new T.CanvasTexture(fabricCanvas);fabricTexture.wrapS=fabricTexture.wrapT=T.RepeatWrapping;fabricTexture.repeat.set(12,16);
 const membrane=new T.MeshPhysicalMaterial({color:0xe2e3d0,map:fabricTexture,bumpMap:fabricTexture,bumpScale:.012,transparent:true,opacity:.57,roughness:.78,metalness:0,side:T.DoubleSide,depthWrite:false});
 const liquid=new T.MeshPhysicalMaterial({color:0x234a26,roughness:.45,metalness:0,clearcoat:.25});
 const green=new T.MeshStandardMaterial({color:0x447f2d,roughness:.7,side:T.DoubleSide});
 const darkGreen=new T.MeshStandardMaterial({color:0x294e1d,roughness:.8,side:T.DoubleSide});
 const red=new T.MeshStandardMaterial({color:0xbb4327,roughness:.45});
 const leds=[];const shell=new T.Group();group.add(shell);let night=false;let irrigation=false;
 k.box(10.6,.25,12.6,0,.08,0,'dark');k.box(2.1,.04,12.1,0,.23,0,'steel');
 for(const x of [-5,5])k.box(.2,1.2,12.2,x,.75,0,'white',shell);
 const arc=z=>Array.from({length:49},(_,i)=>{const a=i/48*Math.PI;return [Math.cos(a)*5,1.35+Math.sin(a)*3.5,z]});
 for(let z=-6;z<=6;z+=2){k.pipe(arc(z),.065,'steel',shell);for(const x of [-5,5])k.box(.16,1.3,.16,x,.7,z,'steel',shell);}
 for(const a of [Math.PI*.18,Math.PI*.36,Math.PI*.5,Math.PI*.64,Math.PI*.82])k.pipe([[Math.cos(a)*5,1.35+Math.sin(a)*3.5,-6],[Math.cos(a)*5,1.35+Math.sin(a)*3.5,6]],.04,'steel',shell);
 const vertices=[],indices=[];for(let j=0;j<=12;j++)for(let i=0;i<=48;i++){const a=i/48*Math.PI;const bulge=.09*Math.sin(j/2*Math.PI)**2;vertices.push(5*Math.cos(a),1.35+(3.5+bulge)*Math.sin(a),-6+j)}for(let j=0;j<12;j++)for(let i=0;i<48;i++){const q=j*49+i;indices.push(q,q+1,q+50,q,q+50,q+49)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(Array.from({length:13*49},(_,q)=>[q%49/48,Math.floor(q/49)/12]).flat(),2));geo.setIndex(indices);geo.computeVertexNormals();k.mesh(geo,membrane,0,0,0,shell);
 // Continuous end membranes, shaped to the complete arch. Only the airlock has an opening.
 for(const z of [-6,6]){
  const end=new T.Shape();end.moveTo(-5,.22);end.lineTo(-5,1.35);
  for(let i=0;i<=64;i++){const a=Math.PI-i/64*Math.PI;end.lineTo(5*Math.cos(a),1.35+3.5*Math.sin(a));}
  end.lineTo(5,.22);
  if(z===6){end.lineTo(.98,.22);end.lineTo(.98,2.55);end.lineTo(-.98,2.55);end.lineTo(-.98,.22);}
  end.lineTo(-5,.22);const endGeo=new T.ShapeGeometry(end);const ep=endGeo.attributes.position;endGeo.setAttribute('uv',new T.Float32BufferAttribute(Array.from({length:ep.count},(_,i)=>[(ep.getX(i)+5)/10,ep.getY(i)/5]).flat(),2));k.mesh(endGeo,membrane,0,0,z,shell);
  if(z===-6)for(const x of [-1.65,1.65]){k.box(.12,4.28,.12,x,2.36,z,'steel',shell);k.box(.32,.08,.32,x,.28,z,'steel',shell);}
 }
 shell.traverse(o=>{if(o.isMesh&&(o.material===transparent||o.material===membrane))o.castShadow=false});
 for(const x of [-1.06,1.06])k.box(.16,2.52,.24,x,1.48,6.08,'steel');k.box(2.28,.18,.24,0,2.65,6.08,'steel');
 const metalCanvas=document.createElement('canvas');metalCanvas.width=metalCanvas.height=256;const mc=metalCanvas.getContext('2d');mc.fillStyle='#89959b';mc.fillRect(0,0,256,256);for(let i=0;i<256;i++){mc.fillStyle=i%3?'rgba(225,235,240,.09)':'rgba(25,35,45,.12)';mc.fillRect(0,i,256,1);}const metalTexture=new T.CanvasTexture(metalCanvas);metalTexture.colorSpace=T.SRGBColorSpace;
 const hatchMaterial=new T.MeshStandardMaterial({color:0xa9b7bf,map:metalTexture,metalness:.72,roughness:.42});
 function makeHatch(width,height,z,parent){
  const hatch=new T.Group();parent.add(hatch);const bottom=.29,top=bottom+height,windowY=1.94,windowH=.52,windowW=.72,lo=windowY-windowH/2,hi=windowY+windowH/2;
  // Four solid panels leave a real opening through both faces of the hatch.
  k.box(width,lo-bottom,.16,0,(lo+bottom)/2,z,hatchMaterial,hatch);
  k.box(width,top-hi,.16,0,(top+hi)/2,z,hatchMaterial,hatch);
  for(const side of [-1,1])k.box((width-windowW)/2,windowH,.16,side*(width+windowW)/4,windowY,z,hatchMaterial,hatch);
  const insert=new T.Shape();insert.moveTo(-windowW/2,-windowH/2);insert.lineTo(windowW/2,-windowH/2);insert.lineTo(windowW/2,windowH/2);insert.lineTo(-windowW/2,windowH/2);insert.closePath();const aperture=new T.Path();aperture.absarc(0,0,.22,0,Math.PI*2,true);insert.holes.push(aperture);const insertMat=hatchMaterial.clone();insertMat.side=T.DoubleSide;k.mesh(new T.ExtrudeGeometry(insert,{depth:.16,bevelEnabled:false}),insertMat,0,windowY,z-.08,hatch);
  for(const face of [-1,1]){const disc=k.mesh(new T.CircleGeometry(.22,48),transparent,0,windowY,z+face*.09,hatch);disc.rotation.y=face<0?Math.PI:0;const rim=k.mesh(new T.TorusGeometry(.235,.025,10,48),'steel',0,windowY,z+face*.12,hatch);}
  for(const face of [-1,1]){
   const zz=z+face*.105;
   for(const x of [-width/2+.045,width/2-.045])k.box(.065,height,.045,x,bottom+height/2,zz,'steel',hatch);
   for(const y of [bottom+.04,top-.04])k.box(width,.065,.045,0,y,zz,'steel',hatch);
   
   
   k.box(.065,.42,.10,width*.34,1.27,zz+face*.07,'steel',hatch);
   for(const y of [1.06,1.48])k.box(.10,.065,.13,width*.34,y,zz+face*.025,'dark',hatch);
   k.box(width*.68,.20,.025,0,.58,zz,'dark',hatch);
   for(let i=0;i<8;i++){const stripe=k.box(.09,.16,.012,-width*.28+i*width*.08,.58,zz+face*.02,new T.MeshStandardMaterial({color:0xd6a639,roughness:.7}),hatch);stripe.rotation.z=-.35;}
  }
  return hatch;
 }
 const door=makeHatch(1.92,2.25,6.07,group);
 // Sealed two-door airlock: glazing sits in framed openings, never over solid walls.
 const lock=new T.Group();group.add(lock);
 k.box(2.65,.24,2.8,0,.12,7.4,'dark',lock);
 k.box(1.85,.035,2.7,0,.26,7.4,'steel',lock);
 for(const x of [-1.25,1.25]){
  k.box(.16,.9,2.8,x,.7,7.4,'white',lock);k.box(.16,.48,2.8,x,2.76,7.4,'white',lock);
  const wallShape=new T.Shape();wallShape.moveTo(-1.19,-.67);wallShape.lineTo(1.19,-.67);wallShape.lineTo(1.19,.67);wallShape.lineTo(-1.19,.67);wallShape.closePath();const hole=new T.Path();hole.absarc(0,.08,.28,0,Math.PI*2,true);wallShape.holes.push(hole);const sideWall=k.mesh(new T.ExtrudeGeometry(wallShape,{depth:.065,bevelEnabled:false}),'white',x-.0325,1.82,7.4,lock);sideWall.rotation.y=Math.PI/2;for(const face of [-1,1]){const cover=k.mesh(new T.CircleGeometry(.28,48),transparent,x+face*.045,1.9,7.4,lock);cover.rotation.y=face*Math.PI/2;const rim=k.mesh(new T.TorusGeometry(.29,.035,10,48),'steel',x+face*.06,1.9,7.4,lock);rim.rotation.y=Math.PI/2;}
  for(const z of [6.04,7.4,8.76])k.box(.18,2.7,.10,x,1.62,z,'steel',lock);
  k.pipe([[x*.8,.7,6.35],[x*.8,.7,8.4]],.035,'steel',lock);
 }
 k.box(2.66,.18,2.85,0,3.08,7.4,'white',lock);
 for(const x of [-1.1,1.1])k.box(.18,2.65,.3,x,1.58,8.8,'steel',lock);
 k.box(2.4,.28,.3,0,2.97,8.8,'steel',lock);
 const outerDoor=makeHatch(1.98,2.52,8.81,lock);
 for(const z of [6.05,8.81]){k.box(2.03,.04,.32,0,.285,z,'steel',lock);}
 k.box(.22,.28,.04,.94,1.5,6.28,'dark',lock);
 k.vents(0,2.68,6.23,.65,4,lock);
 const indicator=new T.MeshStandardMaterial({color:0x63b8a2,emissive:0x36b888,emissiveIntensity:1});
 k.box(.65,.06,.08,0,2.88,8.99,indicator,lock);
 const lockLight=new T.PointLight(0xc6e3ef,3,4,2);lockLight.position.set(0,2.8,7.4);group.add(lockLight);
 // Air handling skid, buffer tanks and closed supply/return circuits.
 const pressure=new T.Group();group.add(pressure);pressure.name='PressureAndAirRecovery';
 k.box(1.8,.15,1.2,-3.65,.32,6.95,'dark',pressure);
 k.box(.85,1.25,1.0,-3.15,1.02,6.95,'white',pressure);
 k.vents(-3.15,.65,7.47,.62,7,pressure);k.gauge(-3.15,1.32,7.48);
 for(const x of [-4.18,-3.77]){k.cylinder(.17,1.25,x,1.02,6.95,'steel',pressure);for(const y of [.48,1.54])k.ring(.18,.025,x,y,6.95,'dark',pressure);k.box(.34,.08,.35,x,.4,6.95,'dark',pressure);k.pipe([[x,1.67,6.95],[x,1.86,6.95],[-3.15,1.86,6.95],[-3.15,1.65,6.95]],.035,'steel',pressure);}
 k.pipe([[-2.72,1.15,6.95],[-1.34,1.15,6.95]],.055,'blue',pressure);k.flange(-1.34,1.15,6.95,'x',pressure);
 k.pipe([[-1.34,.67,7.95],[-2.6,.67,7.95],[-2.6,.67,6.95],[-2.72,.67,6.95]],.055,'steel',pressure);k.flange(-1.34,.67,7.95,'x',pressure);
 for(const z of [6.95,7.95]){k.box(.06,.32,.32,-1.16,z===6.95?1.15:.67,z,'dark',pressure);}
 k.pipe([[-3.15,1.65,6.55],[-3.15,2.8,6.55],[-4.4,2.8,6.55],[-4.4,2.8,-4.8]],.08,'steel',pressure);
 k.pipe([[-4.4,2.8,-4.8],[-4.4,.95,-4.8],[-4.4,.95,5.7],[-3.5,.95,5.7],[-3.5,.95,6.55],[-3.15,.95,6.55]],.065,'blue',pressure);
 k.flange(-4.4,2.8,6.0,'z',pressure);k.flange(-3.5,.95,6.0,'z',pressure);
 for(const z of [-4,-1,2,5]){k.box(.34,.24,.5,-4.4,2.8,z,'dark',pressure);k.vents(-4.4,2.72,z+.26,.25,3,pressure);}
 // Uprights connect the sill to the arched ribs; short knee braces avoid crop aisles.
 for(const x of [-4.82,4.82])for(const z of [-4,-2,0,2,4]){const top=1.35+3.5*Math.sqrt(1-(x/5)**2);k.box(.11,top-.26,.11,x,(top+.26)/2,z,'steel',shell);k.box(.3,.08,.3,x,.29,z,'steel',shell);k.pipe([[x,.75,z],[x,1.25,z+.38]],.035,'steel',shell);}
 const algae=new T.Group();group.add(algae);const bubbles=[];
 for(let i=0;i<6;i++){
  const z=-4.4+i*1.75,x=-3.25;
  k.cylinder(.54,.2,x,.44,z,'dark',algae);k.cylinder(.43,2.25,x,1.65,z,liquid,algae);
  k.cylinder(.49,2.45,x,1.67,z,transparent,algae);
  for(const y of [.48,2.85]){k.ring(.50,.055,x,y,z,'steel',algae);k.cylinder(.50,.10,x,y,z,'white',algae)}
  k.cylinder(.09,.20,x,3,z,'steel',algae);k.pipe([[x,3.1,z],[x,3.35,z],[-4.2,3.35,z]],.04,'steel',algae);
  k.pipe([[x,.58,z],[-4.15,.58,z]],.045,'blue',algae);k.flange(x-.45,.58,z,'x',algae);
  for(const dx of [-.56,.56]){const mat=new T.MeshStandardMaterial({color:0xc6cbc5,emissive:0x8646c4,emissiveIntensity:0});k.box(.055,2.1,.08,x+dx,1.68,z,mat,algae);leds.push(mat);}
  const bb=new T.InstancedMesh(new T.SphereGeometry(.018,8,6),new T.MeshBasicMaterial({color:0x97c38c,transparent:true,opacity:.45})),d=new T.Object3D();bb.count=28;algae.add(bb);for(let b=0;b<28;b++){d.position.set(x+Math.sin(b*7)*.39,.65+(b/28)*1.95,z+Math.cos(b*9)*.39);d.updateMatrix();bb.setMatrixAt(b,d.matrix)}bubbles.push({mesh:bb,x,z});
 }
 k.pipe([[-4.2,3.35,-4.4],[-4.2,3.35,4.35]],.055,'steel',algae);k.pipe([[-4.15,.58,-4.4],[-4.15,.58,4.35]],.055,'blue',algae);
 k.box(1.2,1.35,.9,-2.9,.92,5.1,'white');k.box(.65,.42,.05,-2.9,1.05,5.59,'dark');k.gauge(-3.1,1.1,5.65);k.valve(-2.65,1.1,5.65);
 k.pipe([[-4.15,.58,4.35],[-4.15,.58,5.1],[-3.52,.58,5.1]],.055,'blue');k.flange(-3.52,.58,5.1,'x');
 // Dwarf wheat: curved, tapered blades instead of spherical vegetable leaves.
 const leafCanvas=document.createElement('canvas');leafCanvas.width=128;leafCanvas.height=512;const lc=leafCanvas.getContext('2d');const grad=lc.createLinearGradient(0,0,128,0);grad.addColorStop(0,'#29461c');grad.addColorStop(.44,'#65823a');grad.addColorStop(.51,'#97a75c');grad.addColorStop(.58,'#638438');grad.addColorStop(1,'#243c19');lc.fillStyle=grad;lc.fillRect(0,0,128,512);for(let v=0;v<12;v++){lc.strokeStyle='rgba(191,200,123,.15)';lc.lineWidth=.7;lc.beginPath();lc.moveTo(v*11,0);lc.lineTo(v*11,512);lc.stroke();}
 const leafTexture=new T.CanvasTexture(leafCanvas);leafTexture.colorSpace=T.SRGBColorSpace;
 const wheatMaterial=new T.MeshStandardMaterial({map:leafTexture,roughness:.84,side:T.DoubleSide});
 const bladePositions=[],bladeUV=[],bladeIndex=[];for(let i=0;i<=14;i++){const t=i/14,w=Math.sin(Math.PI*t)*.022+.0005;bladePositions.push(-w,t*.40,-t*t*.15,w,t*.40,-t*t*.15);bladeUV.push(0,t,1,t);if(i<14){const q=i*2;bladeIndex.push(q,q+1,q+2,q+1,q+3,q+2)}}
 const leafGeo=new T.BufferGeometry();leafGeo.setAttribute('position',new T.Float32BufferAttribute(bladePositions,3));leafGeo.setAttribute('uv',new T.Float32BufferAttribute(bladeUV,2));leafGeo.setIndex(bladeIndex);leafGeo.computeVertexNormals();
 const leaves=new T.InstancedMesh(leafGeo,wheatMaterial,4200),stems=new T.InstancedMesh(new T.CylinderGeometry(.004,.006,1,6),darkGreen,600),grains=new T.InstancedMesh(new T.SphereGeometry(1,6,5),new T.MeshStandardMaterial({color:0x9b9b50,roughness:.9}),2200),plugs=new T.InstancedMesh(new T.CylinderGeometry(.028,.025,.035,8),k.mats.black,600);
 const dummy=new T.Object3D();let leafCount=0,stemCount=0,grainCount=0,plugCount=0;let seed=631;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
 const plantLights=[];
 for(let row=0;row<3;row++)for(let col=0;col<2;col++){
  const x=1.85+col*1.65,z=-3.8+row*3.35;
  k.box(1.45,.18,2.55,x,1,z,'white');k.box(1.28,.04,2.37,x,1.1,z,'black');for(const dx of [-.57,.57])for(const dz of [-1.05,1.05])k.box(.07,.8,.07,x+dx,.6,z+dz,'steel');
  k.pipe([[x,.83,z-1.2],[x,.83,z+1.2]],.035,'blue');
  for(let p=0;p<84;p++){
   const xx=x+(p%7-3)*.17+(rand()-.5)*.035,zz=z+(Math.floor(p/7)-5.5)*.19+(rand()-.5)*.035;
   const height=.27+rand()*.18;dummy.position.set(xx,1.14+height/2,zz);dummy.rotation.set((rand()-.5)*.12,rand()*6,(rand()-.5)*.12);dummy.scale.set(1,height,1);dummy.updateMatrix();stems.setMatrixAt(stemCount++,dummy.matrix);
   dummy.position.set(xx,1.135,zz);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();plugs.setMatrixAt(plugCount++,dummy.matrix);
   for(let l=0;l<6;l++){
    dummy.position.set(xx,1.14+(l%3)*height*.18,zz);dummy.rotation.set(.1+rand()*.55,rand()*Math.PI*2,(rand()-.5)*.2);const scale=.55+rand()*.55;dummy.scale.set(.75+rand()*.55,scale,scale);dummy.updateMatrix();leaves.setMatrixAt(leafCount,dummy.matrix);leaves.setColorAt(leafCount++,new T.Color().setHSL(.21+rand()*.045,.35,.66+rand()*.20));
   }
   if(rand()>.6){for(let g=0;g<10;g++){const side=g%2?1:-1;dummy.position.set(xx+side*.013,1.14+height+g*.008,zz);dummy.rotation.set(.2,0,side*-.4);dummy.scale.set(.012,.025,.009);dummy.updateMatrix();grains.setMatrixAt(grainCount++,dummy.matrix);}}
  }
  k.box(1.35,.06,2.4,x,2.5,z,'dark');const lm=new T.MeshStandardMaterial({color:0xc6cbc5,emissive:0xa548dc,emissiveIntensity:0});k.box(1.22,.022,2.22,x,2.46,z,lm);leds.push(lm);
  for(const dz of [-1.05,1.05])k.pipe([[x-.65,1,z+dz],[x-.65,2.5,z+dz],[x+.65,2.5,z+dz],[x+.65,1,z+dz]],.025,'steel');
  /* Host perf: no per-bed point light (each extra light is shaded on every surface); the emissive LED panel above shows the grow light. */
 }
 leaves.count=leafCount;stems.count=stemCount;grains.count=grainCount;plugs.count=plugCount;for(const o of [leaves,stems,grains,plugs]){o.castShadow=true;o.receiveShadow=true;group.add(o);}
 for(let row=0;row<3;row++){const rz=-3.8+row*3.35-1.1;k.pipe([[1.85,.83,rz],[4.25,.83,rz]],.035,'blue');}k.pipe([[4.25,.83,-5],[4.25,.83,4.8]],.045,'blue');k.box(1.2,1.2,.9,2.85,.88,5.2,'white');k.pipe([[4.25,.83,4.8],[4.25,.83,5.2],[3.46,.83,5.2]],.045,'blue');k.flange(3.46,.83,5.2,'x');
 const light=new T.PointLight(0xb46eff,0,12,2);light.position.set(-3.2,2.4,0);group.add(light);
 return {group,door,setAirlock(innerOpen,outerOpen,cycling=false){door.position.x=innerOpen?-1.96:0;outerDoor.position.x=outerOpen?2.1:0;indicator.color.set(cycling?0xe5a44b:0x63b8a2);indicator.emissive.set(cycling?0xda7a16:0x36b888)},setNight(value){night=value;leds.forEach(m=>{m.emissiveIntensity=value?2.5:0;m.color.set(value?0xd3b7eb:0xc6cbc5)});plantLights.forEach(l=>l.intensity=value?4:0);light.intensity=value?8:0},setIrrigation(value){irrigation=Boolean(value)},get irrigation(){return irrigation},get lightsOn(){return night},setRoof(value){shell.visible=value},setDoor(open){door.position.x=open?-1.96:0},frame(time){const d=new T.Object3D();for(const b of bubbles){for(let i=0;i<28;i++){d.position.set(b.x+Math.sin(i*7)*.39,.65+((i/28+time*.05)%1)*1.95,b.z+Math.cos(i*9)*.39);d.updateMatrix();b.mesh.setMatrixAt(i,d.matrix)}b.mesh.instanceMatrix.needsUpdate=true;}},dispose(){metalTexture.dispose();hatchMaterial.dispose();fabricTexture.dispose();membrane.dispose();leafTexture.dispose();k.dispose()}};
}

