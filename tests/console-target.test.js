import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {createConsoleTargeter} from '../src/colony/scene/console-target.mjs';
describe('physical console crosshair targeting',()=>{
  const fixture=()=>{const group=new T.Group(),display=new T.Mesh(new T.PlaneGeometry(.84,.525),new T.MeshBasicMaterial());group.add(display);const camera=new T.PerspectiveCamera(60,1,.1,100);camera.position.set(0,0,2);camera.lookAt(0,0,0);return {console:{group,display},camera};};
  it('requires aiming at the actual display, including vertical aim',()=>{const {console:c,camera}=fixture(),target=createConsoleTargeter();expect(target([c],camera)).toBe(c);camera.lookAt(.7,0,0);expect(target([c],camera)).toBeNull();camera.lookAt(0,1,0);expect(target([c],camera)).toBeNull();c.display.geometry.dispose();c.display.material.dispose();});
  it('rejects distant screens and the back of the panel',()=>{const {console:c,camera}=fixture(),target=createConsoleTargeter();camera.position.z=3;camera.lookAt(0,0,0);expect(target([c],camera)).toBeNull();camera.position.z=-2;camera.lookAt(0,0,0);expect(target([c],camera)).toBeNull();c.display.geometry.dispose();c.display.material.dispose();});
});
