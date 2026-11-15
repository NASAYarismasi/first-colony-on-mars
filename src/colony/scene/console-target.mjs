import * as T from 'three';
// Only the screen surface under the crosshair is interactive, within arm's reach.
export function createConsoleTargeter() {
  const ray=new T.Raycaster(),center=new T.Vector2();ray.far=2.6;
  return (consoles,camera)=>{
    camera.updateWorldMatrix(true,false);
    const candidates=consoles.filter(c=>c.group.position.distanceToSquared(camera.position)<12);
    if(!candidates.length)return null;
    for(const c of candidates)c.group.updateWorldMatrix(true,true);
    ray.setFromCamera(center,camera);
    const hit=ray.intersectObjects(candidates.map(c=>c.display),false)[0];
    return hit?candidates.find(c=>c.display===hit.object)??null:null;
  };
}
