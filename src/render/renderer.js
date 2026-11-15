import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export function createRenderer(viewport){
  const renderer=new THREE.WebGLRenderer({antialias:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  // Three r187 uses physically correct lighting by default (legacy-light switch was removed).
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;viewport.appendChild(renderer.domElement);
  renderer.info.autoReset=false;
  const composer=new EffectComposer(renderer),renderPass=new RenderPass(new THREE.Scene(),new THREE.Camera()),bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.34,.55,1.25),fxaa=new ShaderPass(FXAAShader);
  const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;uniform float time;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float vignette=1.-.19*pow(length((vUv-.5)*1.4),1.6);float grain=fract(sin(dot(vUv+time,vec2(12.9898,78.233)))*43758.5453)-.5;gl_FragColor=vec4(c*vignette+grain*.006,1.);}`});
  composer.addPass(renderPass);composer.addPass(bloom);composer.addPass(new OutputPass());composer.addPass(fxaa);composer.addPass(finish);
  let quality="Medium",ratio=1,width=1,height=1,slow=0,fast=0,auto=true;
  function resize(){width=viewport.clientWidth;height=viewport.clientHeight;const cap=quality==="High"?1.6:quality==="Medium"?1.15:.8;ratio=Math.min(devicePixelRatio,cap);renderer.setPixelRatio(ratio);renderer.setSize(width,height);composer.setPixelRatio(ratio);composer.setSize(width,height);fxaa.material.uniforms.resolution.value.set(1/(width*ratio),1/(height*ratio));bloom.enabled=quality!=="Low";renderer.shadowMap.enabled=quality!=="Low";}
  window.addEventListener('resize',resize);resize();
  return {renderer,canvas:renderer.domElement,get width(){return width;},get height(){return height;},get quality(){return quality;},get ratio(){return ratio;},setQuality(value,adaptive=false){quality=value;auto=adaptive;resize();},
    draw(scene,camera,time,frameMs){renderer.info.reset();camera.aspect=width/height;camera.updateProjectionMatrix();renderPass.scene=scene;renderPass.camera=camera;finish.uniforms.time.value=time;composer.render();
      if(auto&&frameMs>0){slow=frameMs>30?slow+1:Math.max(0,slow-1);fast=frameMs<15?fast+1:0;if(slow>180&&quality!=="Low"){quality=quality==="High"?"Medium":"Low";slow=0;resize();}if(fast>1800&&quality==="Low"){quality="Medium";fast=0;resize();}}
    },dispose(){window.removeEventListener('resize',resize);for(const p of composer.passes)p.dispose?.();composer.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}
  };
}
