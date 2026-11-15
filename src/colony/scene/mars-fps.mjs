import * as T from "three"
import { SUIT, createSuitMotion, stepSuitMotion } from "../../sim/surfaceMotion.js"
export { addSurface } from "./surface.mjs"

export function createFirstPerson(canvas, camera, { onMode, onAim, interact, accessRoof, collides, groundY, onStep = () => {} }) {
  const keys = new Set(), motion = new T.Vector2(), look = new T.Euler(0, 0, 0, "YXZ")
  const spawn = new T.Vector3(0, SUIT.eyeHeight, 15)
  const savedPosition = new T.Vector3(), savedRotation = new T.Quaternion()
  const abort = new AbortController(), options = { signal: abort.signal }
  let active = false, walkingTime = 0, distanceSinceStep = 0, accumulator = 0, aimTime = 0
  let savedFov = camera.fov
  let jump = false, vertical = createSuitMotion()
  let spawnYaw = 0
  

  let freeLook=false, headYaw=0;
  const clearKeys = () => { keys.clear(); jump = false; freeLook=false; headYaw=0 }
  const applyLook=()=>camera.quaternion.setFromEuler(new T.Euler(look.x,look.y+headYaw,look.z,"YXZ"));
  function turn(dx, dy) {
    if(freeLook){
      headYaw=T.MathUtils.clamp(headYaw-dx*.0022,-Math.PI/2,Math.PI/2);
      applyLook();
      return;
    }
    look.y -= dx * .0022
    look.x = T.MathUtils.clamp(look.x - dy * .0022, -1.47, 1.47)
    applyLook()
  }
  function respawn(position, yaw = 0) {
    // Caller supplies an exact, collision-free ground position (no hidden offset).
    spawn.set(position.x, groundY(position.x, position.z) + SUIT.eyeHeight, position.z)
    spawnYaw = yaw
    vertical = createSuitMotion(); walkingTime = 0; distanceSinceStep = 0
    if (active) { camera.position.copy(spawn); look.set(-.04, spawnYaw, 0); turn(0,0) }
  }
  function lookFrom(position, pitch, yaw = look.y) {
    camera.position.copy(position); look.x = pitch; look.y = yaw; vertical = createSuitMotion(); turn(0,0); camera.updateMatrixWorld()
  }
  function setActive(value) {
    if (active === value) return
    active = value; clearKeys(); accumulator = 0
    if (value) {
      savedFov = camera.fov
      savedPosition.copy(camera.position); savedRotation.copy(camera.quaternion)
      camera.position.copy(spawn); look.set(-.04, spawnYaw, 0); turn(0,0)
      canvas.focus({ preventScroll: true })
    } else {
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      spawn.copy(camera.position); spawnYaw = look.y
      camera.position.copy(savedPosition); camera.quaternion.copy(savedRotation)
    }
    camera.fov = value ? 66 : savedFov; camera.updateProjectionMatrix(); onMode(value)
  }
  canvas.addEventListener("click", () => {
    if(active)canvas.focus({preventScroll:true});
  },options)
  document.addEventListener("mousemove", event => {
    if (active && event.target===canvas && event.buttons===1) turn(event.movementX,event.movementY)
  }, options)
  document.addEventListener("keydown", event => {
    if(active && document.activeElement===canvas && event.code==="KeyV"){
      freeLook=true;event.preventDefault();return;
    }
    // Tablet keys belong to the wrist worker: release movement and pointer, leave the event available.
    if (["Tab","Escape"].includes(event.code)) {
      clearKeys()
      canvas.style.cursor="";
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      return
    }
    if (!active || event.ctrlKey || event.metaKey ||
      (document.activeElement !== canvas && document.pointerLockElement !== canvas)) return
    if (event.code === "KeyE" && !event.repeat) interact()
    if (event.code === "KeyR" && !event.repeat) accessRoof(lookFrom)
    if (event.code === "Space" && !event.repeat) { jump = true; event.preventDefault() }
    if (["KeyW","KeyS","KeyA","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","ShiftLeft","ShiftRight"].includes(event.code)) {
      keys.add(event.code); event.preventDefault()
    }
  }, options)
  document.addEventListener("keyup", event => {
    keys.delete(event.code);
    if(event.code==="KeyV"){freeLook=false;event.preventDefault();}
  }, options)
  document.addEventListener("pointerlockchange", () => {
    clearKeys();
    const locked=document.pointerLockElement===canvas;

    canvas.style.cursor=locked?"none":"";

  }, options)
  canvas.addEventListener("blur", clearKeys, options); window.addEventListener("blur", clearKeys, options)
  function step(dt) {
    if(!freeLook){headYaw*=Math.exp(-dt*15);if(Math.abs(headYaw)<.0001)headYaw=0;}
    applyLook();
    const right = Number(keys.has("KeyD")) - Number(keys.has("KeyA"))
    const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"))
    const tx = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"))
    const ty = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"))
    if (tx || ty) turn(tx*dt*620,ty*dt*620)
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight")
    motion.set(right,forward).normalize().multiplyScalar(dt*(running?SUIT.runSpeed:SUIT.walkSpeed))
    const sin = Math.sin(look.y), cos = Math.cos(look.y)
    const x = camera.position.x + cos*motion.x - sin*motion.y
    const z = camera.position.z - sin*motion.x - cos*motion.y
    const oldX = camera.position.x, oldZ = camera.position.z
    if (!collides(x,camera.position.z)) camera.position.x = x
    if (!collides(camera.position.x,z)) camera.position.z = z
    const travelled = Math.hypot(camera.position.x-oldX,camera.position.z-oldZ)
    vertical = stepSuitMotion(vertical,dt,jump); jump = false
    // GAME ASSUMPTION: slow 0.38-g suit gait, 1.4 cm vertical bob at walking speed.
    if (travelled > 0 && vertical.grounded) {
      walkingTime += travelled*6.5; distanceSinceStep += travelled
      if (distanceSinceStep > (running ? .82 : .68)) { distanceSinceStep = 0; onStep(camera.position.x,camera.position.z,look.y,running) }
    }
    const bob = travelled > 0 && vertical.grounded ? Math.sin(walkingTime)*.014 : 0
    camera.position.y = groundY(camera.position.x,camera.position.z) + SUIT.eyeHeight + vertical.height + bob
  }
  return {
    get active() { return active },
    get telemetry() { return {x:camera.position.x,y:camera.position.y,z:camera.position.z,grounded:vertical.grounded} },
    setActive, respawn, clearKeys, teleport: lookFrom,
    update(delta, updateAim = true) {
      if (!active) return
      accumulator += delta
      while (accumulator + 1e-10 >= 1/60) { step(1/60); accumulator = Math.max(0, accumulator - 1/60) }
      camera.updateMatrixWorld()
      // GPU-independent aim picking is capped; E/click still raycast immediately at the current view.
      aimTime += delta
      if (updateAim && aimTime >= 1/15) { aimTime %= 1/15; onAim() }
    },
    dispose() { clearKeys(); abort.abort(); if (document.pointerLockElement === canvas) document.exitPointerLock() },
  }
}

export function placeholderAstronaut(color) {
  const astronaut = new T.Group()
  const suit = new T.MeshStandardMaterial({ color, roughness: .76 })
  const joint = new T.MeshStandardMaterial({ color: 0x323e48, roughness: .88 })
  const visor = new T.MeshStandardMaterial({ color: 0x806f4d, metalness: .48, roughness: .22 })
  const add = (geometry, material, x, y, z) => {
    const part = new T.Mesh(geometry, material)
    part.position.set(x, y, z)
    part.castShadow = true
    astronaut.add(part)
    return part
  }
  add(new T.CapsuleGeometry(.245, .33, 5, 10), suit, 0, 1.13, 0)
  add(new T.BoxGeometry(.39, .53, .24), joint, 0, 1.22, -.25)
  add(new T.SphereGeometry(.215, 18, 14), suit, 0, 1.64, 0)
  add(new T.SphereGeometry(.178, 20, 14), visor, 0, 1.65, .12).scale.set(1, .79, .59)
  for (const side of [-1, 1]) {
    add(new T.CapsuleGeometry(.1, .30, 4, 9), suit, side * .33, 1.04, 0).rotation.z = side * .16
    add(new T.CapsuleGeometry(.112, .46, 4, 9), suit, side * .13, .49, 0)
    add(new T.BoxGeometry(.23, .15, .33), joint, side * .13, .095, .07)
  }
  return astronaut
}
