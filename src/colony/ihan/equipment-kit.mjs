/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function makeKit(group){
 const textures=[];
 function texture(kind){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle=kind==='foil'?'#b4b5ae':'#c6c9c7';x.fillRect(0,0,512,512);let seed=41;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};for(let i=0;i<9000;i++){const p=rnd()*512,q=rnd()*512,a=rnd()*.13;x.fillStyle=`rgba(${rnd()>.5?'255,255,255':'20,30,35'},${a})`;if(kind==='foil'){x.beginPath();x.moveTo(p,q);x.lineTo(p+rnd()*50,q+rnd()*18);x.lineTo(p+rnd()*25,q-rnd()*14);x.fill()}else x.fillRect(p,q,rnd()*60,.4)}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;textures.push(t);return t;}
 const metalTex=texture('metal'),foilTex=texture('foil');
 const mats={white:new T.MeshStandardMaterial({color:0xd8d4c7,roughness:.52,metalness:.25,map:metalTex}),steel:new T.MeshStandardMaterial({color:0x9da8ac,metalness:.83,roughness:.3,map:metalTex}),dark:new T.MeshStandardMaterial({color:0x24313a,metalness:.65,roughness:.4}),black:new T.MeshStandardMaterial({color:0x111a20,roughness:.82}),blue:new T.MeshStandardMaterial({color:0x346777,roughness:.37,metalness:.55}),orange:new T.MeshStandardMaterial({color:0xcc7f36,metalness:.35,roughness:.5}),foil:new T.MeshStandardMaterial({color:0xc2c2b5,metalness:.86,roughness:.4,map:foilTex}),glass:new T.MeshPhysicalMaterial({color:0x264548,metalness:.1,roughness:.18,clearcoat:1}),lamp:new T.MeshStandardMaterial({color:0x7edac2,emissive:0x4ab99a,emissiveIntensity:1})};
 function mesh(g,m,x,y,z,parent=group){const o=new T.Mesh(g,typeof m==='string'?mats[m]:m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function box(w,h,d,x,y,z,m='white',parent=group,r=.045){return mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)),m,x,y,z,parent)}
 function cylinder(r,h,x,y,z,m='steel',parent=group){return mesh(new T.CylinderGeometry(r,r,h,32),m,x,y,z,parent)}
 function pipe(points,r=.055,m='steel',parent=group){
  const pts=points.map(p=>new T.Vector3(...p));const curve=new T.CurvePath();let start=pts[0];
  for(let i=1;i<pts.length-1;i++){
   const previous=pts[i-1],corner=pts[i],next=pts[i+1];
   const radius=Math.min(.14,corner.distanceTo(previous)*.22,corner.distanceTo(next)*.22);
   const before=corner.clone().add(previous.clone().sub(corner).normalize().multiplyScalar(radius));
   const after=corner.clone().add(next.clone().sub(corner).normalize().multiplyScalar(radius));
   curve.add(new T.LineCurve3(start,before));curve.add(new T.QuadraticBezierCurve3(before,corner,after));start=after;
  }
  curve.add(new T.LineCurve3(start,pts.at(-1)));
  return mesh(new T.TubeGeometry(curve,Math.max(24,points.length*12),r,10,false),m,0,0,0,parent);
 }
 function flange(x,y,z,axis='z',parent=group){
  const f=cylinder(.12,.055,x,y,z,'steel',parent);if(axis==='z')f.rotation.x=Math.PI/2;if(axis==='x')f.rotation.z=Math.PI/2;
  const collar=cylinder(.075,.10,x,y,z,'dark',parent);collar.rotation.copy(f.rotation);
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2,r=.092;let bx=x,by=y,bz=z;if(axis==='z'){bx+=Math.cos(a)*r;by+=Math.sin(a)*r;bz+=.034;}else if(axis==='x'){by+=Math.cos(a)*r;bz+=Math.sin(a)*r;bx+=.034;}else{bx+=Math.cos(a)*r;bz+=Math.sin(a)*r;by+=.034;}const bolt=mesh(new T.CylinderGeometry(.012,.012,.025,6),'dark',bx,by,bz,parent);if(axis==='z')bolt.rotation.x=Math.PI/2;if(axis==='x')bolt.rotation.z=Math.PI/2;}
  return f;
 }
 function ring(r,t,x,y,z,m='steel',parent=group){const o=mesh(new T.TorusGeometry(r,t,8,40),m,x,y,z,parent);o.rotation.x=Math.PI/2;return o;}
 function bolt(x,y,z,parent=group){const o=mesh(new T.CylinderGeometry(.022,.022,.025,6),'steel',x,y,z,parent);o.rotation.x=Math.PI/2;return o;}
 function panel(w,h,x,y,z,parent=group){box(w,h,.045,x,y,z,'dark',parent,.015);for(const dx of [-w/2+.07,w/2-.07])for(const dy of [-h/2+.07,h/2-.07])bolt(x+dx,y+dy,z+.035,parent);}
 function label(text,w,h,x,y,z,parent=group,tone='#d7c19e'){const c=document.createElement('canvas');c.width=768;c.height=Math.round(768*h/w);const ctx=c.getContext('2d');ctx.fillStyle='#17242c';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=tone;ctx.fillRect(0,0,15,c.height);ctx.font=`500 ${Math.min(80,c.height*.4)}px monospace`;ctx.textBaseline='middle';ctx.fillText(text,35,c.height/2,c.width-60);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);return mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t}),x,y,z,parent);}
 function gauge(x,y,z,parent=group){const body=cylinder(.105,.06,x,y,z,'steel',parent);body.rotation.x=Math.PI/2;const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#d4d7cc';ctx.beginPath();ctx.arc(128,128,119,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#273a41';ctx.lineWidth=4;for(let a=0;a<11;a++){const t=(a/10*1.5+.75)*Math.PI;ctx.beginPath();ctx.moveTo(128+Math.cos(t)*90,128+Math.sin(t)*90);ctx.lineTo(128+Math.cos(t)*104,128+Math.sin(t)*104);ctx.stroke()}ctx.strokeStyle='#b44e33';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(179,79);ctx.stroke();const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;textures.push(t);mesh(new T.CircleGeometry(.092,32),new T.MeshBasicMaterial({map:t}),x,y,z+.034,parent);}
 function valve(x,y,z,parent=group){const v=mesh(new T.TorusGeometry(.14,.025,8,24),'orange',x,y,z,parent);for(let i=0;i<3;i++){const b=box(.26,.022,.025,0,0,0,'orange',v,.005);b.rotation.z=i*Math.PI/3}return v;}
 function skid(w,d){for(const x of [-w/2+.18,w/2-.18])box(.20,.22,d,x,.24,0,'dark');for(const z of [-d/2+.2,0,d/2-.2])box(w,.12,.16,0,.37,z,'steel');for(const x of [-w/2+.18,w/2-.18])for(const z of [-d/2+.3,d/2-.3])box(.6,.12,.55,x,.08,z,'steel');}
 function tank(x,z,r=.55,h=2.2,material='foil',parent=group){const base=.55;const body=cylinder(r,h,x,base+h/2,z,material,parent);for(const y of [base,base+h]){const cap=mesh(new T.SphereGeometry(r,32,16),material,x,y,z,parent);cap.scale.y=.43}for(const y of [base+.25,base+h-.25])ring(r+.015,.035,x,y,z,'steel',parent);for(const dx of [-r*.65,r*.65])box(.10,.55,.16,x+dx,.27,z,'dark',parent);cylinder(.075,.2,x,base+h+r*.43+.08,z,'steel',parent);gauge(x+.2,base+h-.20,z+r+.06,parent);valve(x-.2,base+h-.20,z+r+.1,parent);return body;}
 function vents(x,y,z,width=1,count=9,parent=group){for(let i=0;i<count;i++)box(width,.026,.06,x,y+i*.075,z,'steel',parent,.008);}
 function dispose(){const ms=new Set();group.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [o.material].flat())ms.add(m)});ms.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());group.removeFromParent()}
 return{mats,mesh,box,cylinder,pipe,ring,bolt,panel,label,gauge,valve,skid,tank,vents,flange,dispose};
}
