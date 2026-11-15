import {drawGroupHmi} from './power/group-hmi.mjs';
import {batchStaticLeaves} from '../scene/static-model.mjs';
import {addPowerCables} from './power-cables.mjs';
export function addSolarFarm(T, scene, terrainHeight, obstacles) {
  // Adapted from Samet's solar preview in 0e3352a87baebff83558045dcb539462d3ecf4f7.
  const farm = new T.Group()
  farm.name = "MarsSolarFarm"
  const x0 = -57, z0 = 46
  const level = terrainHeight(x0, z0)
  farm.position.set(x0, level, z0)
  scene.add(farm)
  const cells = document.createElement("canvas")
  cells.width = 500
  cells.height = 400
  const ctx = cells.getContext("2d")
  ctx.fillStyle = "#8a8981"
  ctx.fillRect(0, 0, 500, 400)
  for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
    const x = col * 100, y = row * 200
    ctx.fillStyle = (row + col) % 2 ? "#172b47" : "#1f3452"
    ctx.fillRect(x + 3, y + 3, 94, 194)
    ctx.fillStyle = "#4a607a"
    for (let line = 1; line < 16; line++) ctx.fillRect(x + 5, y + line * 12, 90, 1)
    ctx.fillRect(x + 49, y + 4, 1, 192)
  }
  const texture = new T.CanvasTexture(cells)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 8
  const frame = new T.MeshStandardMaterial({color:0x686b66, metalness:.58, roughness:.48})
  const panel = new T.MeshStandardMaterial({map:texture, metalness:.26, roughness:.34})
  const part = (parent, geometry, material, x, y, z) => {
    const mesh = new T.Mesh(geometry, material)
    mesh.position.set(x,y,z)
    mesh.receiveShadow = mesh.castShadow = true
    parent.add(mesh)
    return mesh
  }
  const back = new T.BoxGeometry(5,.09,4)
  const face = new T.PlaneGeometry(5,4).rotateX(-Math.PI/2)
  const column = new T.BoxGeometry(.13,1,.13)
  const footing = new T.BoxGeometry(.44,.14,.44)
  const tables=[];
  for (let row = 0; row < 6; row++) for (let col = 0; col < 7; col++) {
    const x = (col - 3) * 6, z = (row - 2.5) * 8
    const y = terrainHeight(x0 + x, z0 + z) - level
    tables.push({x,y,z,row});
    const table = new T.Group()
    table.position.set(x,y+2.25,z)
    table.rotation.x = .55
    farm.add(table)
    part(table,back,frame,0,0,0)
    part(table,face,panel,0,.052,0)
    for (const dx of [-1.9,1.9]) for (const dz of [-1.4,1.4]) {
      const groundZ = z + dz * Math.cos(table.rotation.x)
      const ground = terrainHeight(x0+x+dx,z0+groundZ)-level
      const top = y + 2.2 - dz * Math.sin(table.rotation.x)
      const height = Math.max(.1,top-ground)
      part(farm,column,frame,x+dx,ground+height/2,groundZ).scale.y = height
      part(farm,footing,frame,x+dx,ground+.035,groundZ)
    }
    obstacles.push(new T.Box3(
      new T.Vector3(x0+x-2.68,level+y,z0+z-1.93),
      new T.Vector3(x0+x+2.68,level+y+3.4,z0+z+1.93)))
  }
  instanceByGeometry(T,farm);
  const brushes=new T.InstancedMesh(new T.BoxGeometry(4.95,.08,.13),new T.MeshStandardMaterial({color:0x4b5150,roughness:.8}),42);
  brushes.name="SolarCleaningBrushes";
  brushes.instanceMatrix.setUsage(T.DynamicDrawUsage);farm.add(brushes);
  const brushTransform=new T.Object3D();
  const cabinet=new T.BoxGeometry(2.8,2.3,1.6)
  const enclosure=new T.MeshStandardMaterial({color:0xa4aa9e,metalness:.42,roughness:.66})
  const terminal=new T.MeshStandardMaterial({color:0x252d32,roughness:.76})
  const hazard=new T.MeshStandardMaterial({color:0xd0a14a,roughness:.71})
  const display=document.createElement("canvas")
  display.width=512
  display.height=256
  const screen=display.getContext("2d")
  const displayTexture=new T.CanvasTexture(display)
  displayTexture.colorSpace=T.SRGBColorSpace
  const displayMaterial=new T.MeshBasicMaterial({map:displayTexture})
  const hmi=[];
  const screens=[];
  let groupReadings=[], groupDaylight;
  const inverters=[]
  for(let i=0;i<10;i++) {
    const x=23+4*Math.floor(i/5),z=(i%5-2)*4.5
    const ground=terrainHeight(x0+x,z0+z)
    const rack=new T.Group()
    inverters.push({x,y:ground-level,z})
    rack.position.set(x,ground-level,z)
    farm.add(rack)
    part(rack,cabinet,enclosure,0,1.34,0)
    part(rack,new T.BoxGeometry(2.9,.19,1.71),terminal,0,.17,0)
    part(rack,new T.BoxGeometry(2.72,2.12,.06),terminal,0,1.34,.81)
    for(const side of [-.68,.68]) {
      part(rack,new T.BoxGeometry(1.29,2.05,.07),enclosure,side,1.34,.856)
      part(rack,new T.BoxGeometry(.06,.32,.07),terminal,side*.28,1.25,.91)
      for(let slot=0;slot<6;slot++) part(rack,new T.BoxGeometry(.85,.035,.025),terminal,side,.50+slot*.083,.903)
    }
    part(rack,new T.BoxGeometry(.18,.14,.04),hazard,-.88,1.76,.91)
    if(i%2===0){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;
      const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
      hmi.push({canvas,texture,detail:false,material:new T.MeshBasicMaterial({map:texture})});
    }
    const monitor=part(rack,new T.PlaneGeometry(.91,.455),hmi[Math.floor(i/2)].material,.67,1.91,.908);
    monitor.castShadow=false
    monitor.userData.groupIndex=Math.floor(i/2);
    screens.push(monitor);
    part(rack,new T.BoxGeometry(1.05,1.25,.56),terminal,-.63,.68,1.51)
    part(rack,new T.BoxGeometry(.94,1.13,.06),enclosure,-.63,.68,1.82)
    part(rack,new T.BoxGeometry(.64,.075,.035),hazard,-.63,1.1,1.86)
    for(let vent=0;vent<6;vent++) part(rack,new T.BoxGeometry(.68,.04,.035),terminal,-.63,.45+vent*.07,1.86)
    const label=document.createElement("canvas")
    label.width=256; label.height=80
    const ctx=label.getContext("2d")
    ctx.fillStyle="#263033";ctx.fillRect(0,0,256,80)
    ctx.fillStyle="#ddf1ed";ctx.font="bold 30px monospace";ctx.fillText((i+1)+" / DC > AC",18,35)
    ctx.font="23px monospace";ctx.fillText(i<2?"42 / AC BUS":"42 / AC BUS",25,66)
    const texture=new T.CanvasTexture(label)
    texture.colorSpace=T.SRGBColorSpace
    part(rack,new T.PlaneGeometry(.68,.21),new T.MeshBasicMaterial({map:texture}),-.63,.93,1.87)
    rack.updateWorldMatrix(true,true)
    obstacles.push(new T.Box3().setFromObject(rack).expandByScalar(.12))
  }
  screen.fillStyle='#101b22';screen.fillRect(0,0,512,256);screen.fillStyle='#d6f0ed';screen.font='28px monospace';screen.fillText("COLONY BATTERY",24,48);screen.fillText("UNDERGROUND SUPPLY",24,100);displayTexture.needsUpdate=true;
  const wiring=addPowerCables(T,farm,(x,z)=>terrainHeight(x0+x,z0+z)-level,{greenhouse:{x:26-x0,z:-11-z0},water:{x:64-x0,z:-26-z0},moxie:{x:19-x0,z:6-z0},habitat:{x:-x0,z:-z0}},tables,inverters);
  wiring.setClosed(true);
  farm.updateMatrixWorld(true);
  const hitTargets=screens.map(screen=>{
    const target=new T.Mesh(screen.geometry,screen.material);
    target.matrixWorld.copy(screen.matrixWorld);
    target.userData.groupIndex=screen.userData.groupIndex;
    return target;
  });
  batchStaticLeaves(farm,new Set([wiring.lever]));
  // Host adaptation: the weather buttons only exist on İhan's stand-alone page (and not in node tests).
  const weatherButtons = typeof document?.querySelectorAll === "function" ? document.querySelectorAll("[data-solar-weather]") : []
  const update = (factor) => {
    const produced = 42 * 10 * 2 * 2.5 * .25 * .8 * factor
    const balance = produced - 413
    document.getElementById("solar-generated").textContent = produced + " kWh/sol"
    document.getElementById("solar-balance").textContent = (balance >= 0 ? "+" : "") + balance + " kWh/sol"
    for (const button of weatherButtons) button.setAttribute("aria-pressed", String(Number(button.dataset.solarWeather) === factor))
  }
  if (weatherButtons.length) {
    for (const button of weatherButtons) button.addEventListener("click", () => update(Number(button.dataset.solarWeather)))
    update(1)
  }
  const ray=new T.Raycaster(),pointer=new T.Vector2()
  return {farm,level,x0,z0,setClosed:wiring.setClosed,
    interact(camera,event,canvas){
      const rect=canvas.getBoundingClientRect()
      pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2)
      ray.setFromCamera(pointer,camera)
      ray.far=18
      const hit=ray.intersectObjects(hitTargets,false)[0]
      if(!hit)return false
      const index=hit.object.userData.groupIndex
      hmi[index].detail=!hmi[index].detail
      this.updatePowerDisplay(groupReadings,groupDaylight)
      return true
    },
    framePower(strokes){
    tables.forEach((table,index)=>{
      brushTransform.position.set(table.x,table.y+2.25,table.z);
      brushTransform.rotation.set(.55,0,0);
      brushTransform.translateY(.12);brushTransform.translateZ(-1.95+(strokes[table.row]??0)*3.9);
      brushTransform.updateMatrix();brushes.setMatrixAt(index,brushTransform.matrix);
    });
    brushes.instanceMatrix.needsUpdate=true;
  },updatePowerDisplay(groups,daylight){
    groupReadings=groups;
    groupDaylight=daylight;
    hmi.forEach((screen,i)=>{const index=i%5;const g=groups[index];if(!g)return;
      drawGroupHmi(screen.canvas.getContext('2d'),index,{...g,energy:g.stored,daylight},screen.detail);screen.texture.needsUpdate=true;});
  },updateBatteryDisplay(battery){screen.fillStyle='#101b22';screen.fillRect(0,0,512,256);screen.fillStyle='#d6f0ed';screen.font='30px monospace';screen.fillText("COLONY BATTERY",24,48);screen.font='42px monospace';screen.fillText(battery.toFixed(1)+" game units",24,120);screen.font='24px monospace';screen.fillText("DC / AC - UNDERGROUND LINE",24,190);displayTexture.needsUpdate=true;}}
}

// Host optimisation (Emre/Claude): the farm is static, so the ~390 meshes above (42 tables × back,
// face, 4 columns, 4 footings + 10 cabinets) collapse into one InstancedMesh per geometry/material
// pair — same geometry and placement, ~5 draw calls instead of ~390.
function instanceByGeometry(T, root) {
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map()
  root.traverse(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh) return
    const key = mesh.geometry.uuid + "|" + mesh.material.uuid
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(mesh)
  })
  for (const meshes of groups.values()) {
    const [first] = meshes
    const batch = new T.InstancedMesh(first.geometry, first.material, meshes.length)
    meshes.forEach((mesh, i) => batch.setMatrixAt(i, inverse.clone().multiply(mesh.matrixWorld)))
    batch.castShadow = batch.receiveShadow = true
    batch.computeBoundingSphere()
    for (const mesh of meshes) mesh.removeFromParent()
    root.add(batch)
  }
  for (const child of [...root.children]) if (child.isGroup && !child.children.length) root.remove(child)
}
