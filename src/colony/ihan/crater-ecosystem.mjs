import {createEarthMessages} from './earth-messages.mjs';
import {createSoilAnalysis,startSoilAnalysis,stepSoilAnalysis,SOIL_SCAN_SECONDS} from '../../sim/soilAnalysis.js';
/** Original source: ?han, NASAYarismasi/-lhan a7d5ce6. Host integration: IHAN-SRC. */
// Source visual dimensions are GAME ASSUMPTIONS, not surveyed Mars terrain.
import * as T from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {addSolarFarm} from "./solar-farm.mjs";
export function getTerrainHeight(x, z) {
  return .09 * Math.sin(x * .054 + z * .025)
       + .07 * Math.sin(z * .067 - x * .034)
}

// ============================================================================
// DYNAMIC PROCEDURAL TEXTURE GENERATION (HIGH-RESOLUTION REGOLITH)
// ============================================================================
// Kusursuz (seamless) tiling yüzey detayı: kum tanesi, çakıl ve mikro çukur.
// 2048px genel albedo 620m'yi kapladığı için yakın planda bulanık kalıyor;
// bu doku shader içinde çarpılarak gerçek regolit tanesini geri getirir.
function generateSurfaceDetailTexture() {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")

  let seed = 13177
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  // Temel kum gürültüsü (ortalama 0.5)
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 96 + (rnd() - 0.5) * 120
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v))
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const wrapped = (draw) => {
    for (let ox = -size; ox <= size; ox += size) {
      for (let oy = -size; oy <= size; oy += size) draw(ox, oy)
    }
  }

  // Yumuşak toz lekeleri
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 18 + rnd() * 70
    wrapped((ox, oy) => {
      const grad = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r)
      const tone = rnd() < 0.5 ? 255 : 0
      grad.addColorStop(0, "rgba(" + tone + "," + tone + "," + tone + ",0.10)")
      grad.addColorStop(1, "rgba(" + tone + "," + tone + "," + tone + ",0)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Çakıl taneleri: açık ve koyu, hafif gölgeli
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 0.7 + Math.pow(rnd(), 2.4) * 5.2
    const rot = rnd() * Math.PI
    const light = rnd() < 0.55
    const value = light ? 175 + rnd() * 70 : 45 + rnd() * 55
    wrapped((ox, oy) => {
      ctx.fillStyle = "rgba(" + Math.round(value) + "," + Math.round(value) + "," + Math.round(value) + "," + (0.28 + rnd() * 0.35) + ")"
      ctx.beginPath()
      ctx.ellipse(x + ox, y + oy, r, r * (0.55 + rnd() * 0.5), rot, 0, Math.PI * 2)
      ctx.fill()

      // ışık yönü hissi: üst kenarı aydınlat
      ctx.strokeStyle = "rgba(255,255,255,0.16)"
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(x + ox, y + oy, r * 1.02, Math.PI * 1.05, Math.PI * 1.85)
      ctx.stroke()
    })
  }

  // İnce kum sırtları
  ctx.lineWidth = 1
  for (let i = 0; i < 40; i++) {
    const y0 = rnd() * size
    const amp = 2 + rnd() * 6
    const freq = 0.02 + rnd() * 0.05
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"
    ctx.beginPath()
    for (let x = 0; x <= size; x += 4) {
      const y = y0 + Math.sin(x * freq + i) * amp
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const texture = new T.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.colorSpace = T.NoColorSpace
  texture.anisotropy = 16
  return texture
}

function generateRegolithTextures(isMoonMode = false, extent = 450) {
  const size = 2048
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")

  // Tozlu Mars regoliti: kızıl toprak, açık toz lekeleri, bazalt çakıl.
  // Ay modu aynı üreticiyi monokrom paletle kullanır (karşılaştırma görünümü).
  const pal = isMoonMode
    ? { base: [146, 147, 152], light: [216, 217, 221], dark: [76, 77, 82], rock: [118, 119, 125], ray: [238, 240, 244] }
    : { base: [148, 95, 72], light: [203, 158, 126], dark: [88, 54, 43], rock: [121, 82, 64], ray: [212, 160, 122] }

  const css = (tone, alpha) => "rgba(" + tone[0] + ", " + tone[1] + ", " + tone[2] + ", " + alpha + ")"

  ctx.fillStyle = css(pal.base, 1)
  ctx.fillRect(0, 0, size, size)

  let seed = 4921
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  const worldToTex = (wx, wz) => ({
    u: ((wx + extent) / (2 * extent)) * size,
    v: ((wz + extent) / (2 * extent)) * size
  })

  // 1. Büyük toz ve toprak lekeleri: yumuşak, doğal renk geçişleri
  for (let i = 0; i < 360; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 26 + Math.pow(rnd(), 2.1) * 165
    const tone = rnd() < 0.55 ? pal.light : pal.dark
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, css(tone, 0.14 + rnd() * 0.24))
    grad.addColorStop(1, css(tone, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Orta ölçek: toz birikintileri ve çakıl cepleri (yakın planda okunur)
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 2 + Math.pow(rnd(), 1.6) * 15
    const tone = rnd() < 0.5 ? pal.light : pal.dark
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, css(tone, 0.10 + rnd() * 0.18))
    grad.addColorStop(1, css(tone, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 2. Rüzgâr dalgaları: ince kum sırtları
  ctx.lineWidth = 2
  for (let band = 0; band < 90; band++) {
    const y0 = rnd() * size
    const amp = 2 + rnd() * 8
    const freq = 0.004 + rnd() * 0.012
    const tone = rnd() < 0.5 ? pal.light : pal.dark
    ctx.strokeStyle = css(tone, 0.03 + rnd() * 0.05)
    ctx.beginPath()
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + band) * amp + Math.sin(x * freq * 2.7) * amp * 0.4
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // 5. Çakıl, taş ve toz taneleri (Mars yüzeyinin karakteristik dokusu)
  for (let i = 0; i < 18000; i++) {
    const mx = rnd() * size
    const my = rnd() * size
    const mr = 0.5 + Math.pow(rnd(), 2) * 3.6
    const pick = rnd()
    const tone = pick < 0.45 ? pal.rock : pick < 0.8 ? pal.dark : pal.light
    ctx.fillStyle = css(tone, 0.16 + rnd() * 0.46)
    ctx.beginPath()
    ctx.ellipse(mx, my, mr, mr * (0.55 + rnd() * 0.5), rnd() * Math.PI, 0, Math.PI * 2)
    ctx.fill()
  }

  // 6. İnce gren
  const imgData = ctx.getImageData(0, 0, size, size)
  const d = imgData.data
  for (let i = 0; i < d.length; i += 4) {
    const grain = (rnd() - 0.5) * (isMoonMode ? 26 : 18)
    d[i] = Math.min(255, Math.max(0, d[i] + grain))
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + grain))
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + grain))
  }
  ctx.putImageData(imgData, 0, 0)

  const albedoTexture = new T.CanvasTexture(canvas)
  albedoTexture.colorSpace = T.SRGBColorSpace
  albedoTexture.wrapS = albedoTexture.wrapT = T.ClampToEdgeWrapping
  albedoTexture.anisotropy = 16

  // Yakın plan için tekrar eden ince taneli kabartma dokusu
  const detail = document.createElement("canvas")
  detail.width = detail.height = 256
  const dCtx = detail.getContext("2d")
  const dImg = dCtx.createImageData(256, 256)
  for (let i = 0; i < dImg.data.length; i += 4) {
    const v = 96 + rnd() * 96
    dImg.data[i] = dImg.data[i + 1] = dImg.data[i + 2] = v
    dImg.data[i + 3] = 255
  }
  dCtx.putImageData(dImg, 0, 0)
  const bumpTexture = new T.CanvasTexture(detail)
  bumpTexture.wrapS = bumpTexture.wrapT = T.RepeatWrapping
  bumpTexture.repeat.set(extent * 0.85, extent * 0.85)
  bumpTexture.anisotropy = 8

  return { albedoTexture, bumpTexture }
}

export function createOvaWorld(scene){
  const terrainSize = 620 // 620m x 620m: kesintisiz Mars ovası ve uzak sırtlar
  const segments = 96 // IHAN-SRC: retain host terrain budget; original 320    // ~2m çözünürlük
  const terrainGeo = new T.PlaneGeometry(terrainSize, terrainSize, segments, segments)
  terrainGeo.rotateX(-Math.PI / 2) // Orient to X-Z plane

  const posAttr = terrainGeo.attributes.position
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i)
    const z = posAttr.getZ(i)
    const y = getTerrainHeight(x, z)
    posAttr.setY(i, y)
  }
  terrainGeo.computeVertexNormals()

  // Mars regolit dokuları (tema ile Ay referansına çevrilebilir)
  let currentTheme = "mars"
  const terrainExtent = terrainSize / 2
  let { albedoTexture, bumpTexture } = generateRegolithTextures(false, terrainExtent)

  const terrainMat = new T.MeshStandardMaterial({
    map: albedoTexture,
    bumpMap: bumpTexture,
    bumpScale: 0.045,
    roughness: 1.0,
    metalness: 0.02
  })

  // Yakın planda kum/çakıl tanesini geri getiren tiling detay katmanı.
  // İki farklı ölçekte örneklenir; tekrar deseni böylece görünmez olur.
  const surfaceDetail = generateSurfaceDetailTexture()
  const photoSource = true // IHAN-SRC: Vite URL, no embedded base64
  const regolithPhoto = photoSource
    ? new T.TextureLoader().load(import.meta.env.BASE_URL + "models/colony/three-forks-regolith.jpg")
    : surfaceDetail
  if (photoSource) {
    regolithPhoto.colorSpace = T.SRGBColorSpace
    regolithPhoto.wrapS = regolithPhoto.wrapT = T.MirroredRepeatWrapping
    regolithPhoto.anisotropy = 8
  }
  const photoWeight = {value:photoSource ? 1 : 0}
  terrainMat.onBeforeCompile = (shader) => {
    shader.uniforms.uRegolith = {value:regolithPhoto}
    shader.uniforms.uPhotoWeight = photoWeight
    shader.uniforms.uDetailMap = { value: surfaceDetail }
    shader.uniforms.uDetailScale = { value: 84 }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uDetailMap;\nuniform float uDetailScale;\nuniform sampler2D uRegolith;\nuniform float uPhotoWeight;"
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float dA = texture2D(uDetailMap, vMapUv * uDetailScale).r;
        float dB = texture2D(uDetailMap, vMapUv * uDetailScale * 3.17 + vec2(0.37, 0.11)).r;
        float dGrain = dA * 0.66 + dB * 0.34;
        diffuseColor.rgb *= 0.71 + dGrain * 0.60;
        vec2 meters = (vMapUv - .5) * vec2(620.,-620.);
        vec2 photoUv = meters / vec2(2.8,2.5) + .10 * sin(meters.yx * .81);
        vec3 photo = texture2D(uRegolith,photoUv).rgb;
        vec3 photoWide = texture2D(uRegolith,vec2(.6*meters.x+.8*meters.y,-.8*meters.x+.6*meters.y)/6.1).rgb;
        float drift = sin(meters.x*.31+sin(meters.y*.19))*sin(meters.y*.22+meters.x*.07);
        vec3 soil = mix(photo,photoWide,.28)*(1.22 + .16*drift);
        soil *= .90 + .22*dGrain;
        float along = meters.y-14.5;
        float center = 5.75 + along*.20 + .006*along*along;
        float wheels = abs(abs(meters.x-center)-1.03);
        float trace = 1.-smoothstep(.10,.26,wheels);
        float tread = smoothstep(.22,.76,sin(along*48.+meters.x*11.));
        trace *= smoothstep(-1.,.25,along)*(1.-smoothstep(23.,29.,along));
        soil *= 1.-trace*(.095 + tread*.11);
        vec2 drill = meters - vec2(60.7,-26.8);
        float outline = length(drill/vec2(3.8,2.6)) + .10*sin(drill.x*6.+drill.y*4.) + .10*dGrain;
        float icePatch = 1.-smoothstep(.52,1.03,outline);
        float veins = sin(drill.x*8.+sin(drill.y*6.)*1.65+drill.y*3.);
        float frost = smoothstep(.11,.78,veins*.38 + photo.r*.85 + .28);
        vec3 icySoil = mix(soil*.83,vec3(.58,.65,.69),frost*.72);
        soil = mix(soil,icySoil,icePatch);
        diffuseColor.rgb = mix(diffuseColor.rgb,soil,uPhotoWeight);`
      )
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float fineSoil=dGrain;
      roughnessFactor=clamp(.89+fineSoil*.11,.89,1.0);
    `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float grainHeight=dGrain*.006;
      normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(grainHeight),dFdy(grainHeight)),faceDirection);
    `);
  }
  terrainMat.customProgramCacheKey = () => "mars-regolith-detail-v2"

  const terrainMesh = new T.Mesh(terrainGeo, terrainMat)
  terrainMesh.receiveShadow = true
  terrainMesh.castShadow = true
  scene.add(terrainMesh)

  // ==========================================================================
  // UZAK TEPELER (MARS UFUK SIRTLARI)
  // ==========================================================================
  const hills = new T.Group()
  const hillMat = new T.MeshStandardMaterial({ color: 0x9d6b53, roughness: 1, metalness: 0, flatShading: true })
  const hillMatFar = new T.MeshStandardMaterial({ color: 0xb08a6f, roughness: 1, metalness: 0, flatShading: true })
  const moundGeo = new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)

  let hSeed = 4711
  const hRnd = () => {
    hSeed = (Math.imul(hSeed, 1664525) + 1013904223) >>> 0
    return hSeed / 4294967296
  }

  for (let ring = 0; ring < 2; ring++) {
    const baseRadius = ring === 0 ? 250 : 390
    for (let i = 0; i < 54; i++) {
      const angle = (i / 54) * Math.PI * 2 + hRnd() * 0.09
      const radius = baseRadius + hRnd() * (ring === 0 ? 55 : 90)
      const width = (ring === 0 ? 34 : 60) + hRnd() * (ring === 0 ? 45 : 80)
      const height = (ring === 0 ? 3 : 6) + hRnd() * (ring === 0 ? 5 : 11)
      const mound = new T.Mesh(moundGeo, ring === 0 ? hillMat : hillMatFar)
      mound.scale.set(width, height, width * (0.5 + hRnd() * 0.5))
      mound.position.set(Math.cos(angle) * radius, -height * 0.18, Math.sin(angle) * radius)
      mound.rotation.y = hRnd() * Math.PI
      mound.receiveShadow = true
      hills.add(mound)
    }
  }
  scene.add(hills)

  // ==========================================================================
  // INSTANCED BOULDERS & IMPACT BRECCIA FIELDS
  // ==========================================================================
  // Mars taş tarlası: iri kayalar, yassı tabakalar ve çakıl
  const rockMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .97, metalness: 0, flatShading: false })
  function fracturedRock(seed, flat, detail=2) {
    const geometry = new T.IcosahedronGeometry(1,detail)
    const position = geometry.attributes.position
    for (let i=0;i<position.count;i++) {
      const x=position.getX(i), y=position.getY(i), z=position.getZ(i)
      const wear=1+.22*Math.sin(x*4.3+y*3.7+seed)*Math.cos(z*5.7-y*3.1)+.065*Math.sin(x*13.1-z*11.3+seed)
      const top=flat ? .68+.12*x-.06*z : .95+.19*x+.12*z
      position.setXYZ(i,x*wear+.16*y,Math.max(-.73,Math.min(y*wear,top)),z*wear)
    }
    geometry.deleteAttribute("normal");geometry.deleteAttribute("uv");const welded=mergeVertices(geometry,.0001);welded.computeVertexNormals();const wp=welded.attributes.position,uv=[];for(let i=0;i<wp.count;i++)uv.push((Math.atan2(wp.getZ(i),wp.getX(i))+Math.PI)/(2*Math.PI),wp.getY(i)*.5+.5);welded.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.dispose();return welded
  }

  rockMat.onBeforeCompile = shader => {
    shader.vertexShader="varying vec3 rockPoint;\n"+shader.vertexShader
    shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nrockPoint=position;")
    shader.uniforms.uRockGrain={value:surfaceDetail};shader.uniforms.uRockPhoto={value:regolithPhoto};
    shader.fragmentShader="uniform sampler2D uRockPhoto;uniform sampler2D uRockGrain;varying vec3 rockPoint;\n"+shader.fragmentShader
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`
      #include <color_fragment>
      vec3 p = rockPoint;
      float erosion=sin(p.y*43.+sin(p.x*8.+p.z*7.)*.62);
      float grains=sin(dot(p,vec3(87.,131.,111.)))*sin(dot(p,vec3(153.,-123.,187.)));
      float bed=smoothstep(.58,.98,erosion);
      vec3 stoneTex=texture2D(uRockPhoto,p.xz*.7+vec2(p.y*.13)).rgb;
      float stoneTone=dot(stoneTex,vec3(.299,.587,.114));
      diffuseColor.rgb*=mix(vec3(.65),vec3(1.3),clamp(stoneTone*1.65,0.,1.));
      float pores=.5+grains*.25;
      float fracture=abs(sin(p.x*7.4+p.z*4.2+sin(p.y*9.)*.4));
      diffuseColor.rgb *= .87 + bed*.13 + grains*.045 + pores*.16;
      diffuseColor.rgb *= .93+.07*smoothstep(.025,.12,fracture);
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.31,1.18,1.03),
        .38*(1.-smoothstep(-.72,.05,p.y)));
    `)
  }
  const pebbleMat = new T.MeshStandardMaterial({color:0xffffff,roughness:.98,flatShading:true})

  const dummy = new T.Object3D()
  const tint = new T.Color()
  const rockLayers = []
  const rockObstacles = []

  let rSeed = 8831
  function rRnd() {
    rSeed = (Math.imul(rSeed, 1664525) + 1013904223) >>> 0
    return rSeed / 4294967296
  }

  function scatterRocks(mesh, count, options) {
    mesh.geometry.computeBoundingBox()
    const geometryBounds=mesh.geometry.boundingBox
    const tints = []
    let placed = 0
    let guard = 0
    while (placed < count && guard < count * 20) {
      guard++
      const angle = rRnd() * Math.PI * 2
      const radius = Math.sqrt(rRnd()) * options.radius
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      const patches=.5+.5*Math.sin(x*.17+Math.sin(z*.14)*1.7)*Math.cos(z*.16-x*.11)
      if (rRnd() > .32+.68*patches) continue
      // Üssün oturduğu alanı boş bırak
      if (Math.hypot(x, z) < options.pad) continue

      const scale = options.minScale + Math.pow(rRnd(), 2.6) * (options.maxScale - options.minScale)
      dummy.position.set(x, getTerrainHeight(x, z) + scale * (0.51 * options.flat - options.bury), z)
      const tilt = options.tilt === undefined ? Math.PI : options.tilt
      dummy.rotation.set((rRnd() - 0.5) * tilt, rRnd() * Math.PI * 2, (rRnd() - 0.5) * tilt)
      dummy.scale.set(scale, scale * options.flat * (0.5 + rRnd() * 0.6), scale * (0.7 + rRnd() * 0.6))
      dummy.updateMatrix()
      mesh.setMatrixAt(placed, dummy.matrix)
      if (scale>.32 && options.maxScale>.26) {
        const bounds=geometryBounds.clone().applyMatrix4(dummy.matrix)
        if(bounds.max.y-getTerrainHeight(x,z)>.095) rockObstacles.push(bounds)
      }
      tints.push({ pick: Math.floor(rRnd() * options.palette.length), light: (rRnd() - 0.5) * 0.12 })
      placed++
    }
    mesh.count = placed
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = false // Dense rubble uses received lighting; avoid thousands of shadow-pass triangles.
    mesh.receiveShadow = true
    mesh.userData.tints = tints
    mesh.userData.palette = options.palette
    rockLayers.push(mesh)
    scene.add(mesh)
  }

  function paintRocks(isMoonMode) {
    for (const mesh of rockLayers) {
      const palette = isMoonMode
        ? [0x6f7076, 0x83848a, 0x9a9ba1, 0x5c5d63, 0x8a8b91]
        : mesh.userData.palette
      mesh.userData.tints.forEach((entry, index) => {
        tint.setHex(palette[entry.pick % palette.length])
        tint.offsetHSL(0, 0, entry.light)
        mesh.setColorAt(index, tint)
      })
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }

  const MARS_ROCK_COLORS = [0x65534b, 0x806352, 0x917761, 0x594b43, 0x9f8d77]
  const MARS_SLAB_COLORS = [0x8f6a56, 0xa07c65, 0x7a5746, 0xb19079, 0x6d4d3f]
  const MARS_PEBBLE_COLORS = [0x7d5747, 0x96705a, 0xa9876d, 0x6a4a3c]

  for (const seed of [2,7,12]) {
    const slabs=seed!==7
    const count=slabs?380:680
    scatterRocks(new T.InstancedMesh(fracturedRock(seed,slabs),rockMat,count),count,{
      minScale:slabs?.15:.18, maxScale:slabs?1.75:1.5,
      flat:slabs?.33:.72, radius:seed===12?112:245,
      bury:.25, pad:slabs?15:25,
      palette:slabs?MARS_SLAB_COLORS:MARS_ROCK_COLORS, tilt:slabs?.45:.65
    })
  }
  scatterRocks(new T.InstancedMesh(new T.DodecahedronGeometry(1,0), pebbleMat, 2200), 2200, {
    minScale: 0.035, maxScale: 0.26, flat: 0.7, radius: 140, bury: 0.42, pad: 12, palette: MARS_PEBBLE_COLORS, tilt: 1.1,
  })
  // Koloni sahasının çevresindeki ince çakıl halısı (yakın plan dokusu)
  scatterRocks(new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), pebbleMat, 3500), 3500, {
    minScale: 0.02, maxScale: 0.11, flat: 0.65, radius: 58, bury: 0.45, pad: 8, palette: MARS_PEBBLE_COLORS, tilt: 1.3,
  })
  paintRocks(false)

  // ==========================================================================
  // RESEARCH BASE MODULES & LIFE SUPPORT COLONY (LOCATED ON TERRACE AT X=0, Z=0)
  // ==========================================================================
  const colonyGroup = new T.Group()
  const baseObstacles = []
  const indoorObstacles = []

  function placeBaseItem(object, x, z, yaw = 0) {
    const y = getTerrainHeight(x, z)
    object.position.set(x, y, z)
    object.rotation.y = yaw
    object.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    colonyGroup.add(object)
    
    // Add collision bounding box for FPS
    const box = new T.Box3().setFromObject(object).expandByScalar(0.4)
    baseObstacles.push(box)
    return object
  }

  // Panelized weather covers, low service decks and recessed airlocks.
  const sand = new T.MeshStandardMaterial({vertexColors:true, roughness:.82})
  const steel = new T.MeshStandardMaterial({color:0x686056, metalness:.45, roughness:.58})
  const deckMat = new T.MeshStandardMaterial({color:0x76634e, roughness:.94})
  const hatchMat = new T.MeshStandardMaterial({color:0x9cabb3, roughness:.42, metalness:.72})
  const seal = new T.MeshStandardMaterial({color:0xc0a688, roughness:.7})
  function mesh(group, geometry, material, x,y,z){
    const part = new T.Mesh(geometry,material)
    part.position.set(x,y,z)
    group.add(part)
    return part
  }

  const screenTextures=[];
  function display(parent,x,y,z,title,lines,w=1.0,h=.57){
    const c=document.createElement('canvas');c.width=512;c.height=288;const ctx=c.getContext('2d');
    const paint=rows=>{ctx.fillStyle='#081c24';ctx.fillRect(0,0,512,288);ctx.fillStyle='#68d6c2';ctx.font='bold 26px sans-serif';ctx.fillText(title,24,44);ctx.fillStyle='#d7e7e5';ctx.font='24px monospace';rows.forEach((line,i)=>ctx.fillText(line,24,94+i*40));};paint(lines);
    const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;screenTextures.push(texture);
    block(parent,w+.10,h+.10,.10,rack,x,y,z);const screen=mesh(parent,new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture}),x,y,z+.057);
    return rows=>{paint(rows);texture.needsUpdate=true;};
  }
  const earthMessages=createEarthMessages(); const lifeDisplays=[];let soilAnalysis=createSoilAnalysis(),labDisplay,lastLabFrame=-1;
  const points = []
  const colors = []
  const panelColor = new T.Color()
  const sectors = 28
  const rings = [[3.65,0],[3.65,.50],[3.56,.92],[3.33,1.51],[3.02,2.12],[2.55,2.65],[1.87,3.05],[1.03,3.31]]
  function vertex(row,index){
    const [radius,y] = rings[row]
    const angle = index*Math.PI*2/sectors
    return [radius*Math.cos(angle),y,radius*Math.sin(angle)]
  }
  function panel(a,b,c){
    panelColor.setHex(0xbeb2a1).multiplyScalar(.975+.025*(.5+.5*Math.sin(points.length*13.19)))
    points.push(...a,...b,...c)
    for(let i=0;i<3;i++) colors.push(panelColor.r,panelColor.g,panelColor.b)
  }
  for(let row=0;row<rings.length-1;row++){
    for(let col=0;col<sectors;col++){
      const lower=vertex(row,col)
      const next=vertex(row,col+1)
      const upper=vertex(row+1,col)
      const upperNext=vertex(row+1,col+1)
      panel(lower,upper,next)
      panel(next,upper,upperNext)
    }
  }
  for(let col=0;col<sectors;col++) panel(vertex(rings.length-1,col),[0,3.49,0],vertex(rings.length-1,col+1))
  const shell = new T.BufferGeometry()
  shell.setAttribute("position",new T.Float32BufferAttribute(points,3))
  shell.setAttribute("color",new T.Float32BufferAttribute(colors,3))
  const normals = []
  for (let i=0;i<points.length;i+=3) {
    const normal = new T.Vector3(points[i],points[i+1]*1.16,points[i+2]).normalize()
    normals.push(normal.x,normal.y,normal.z)
  }
  shell.setAttribute("normal",new T.Float32BufferAttribute(normals,3))

  const leg=new T.BoxGeometry(.25,1,.25)
  const foot=new T.BoxGeometry(.65,.12,.65)
  const collar=new T.CylinderGeometry(3.65,3.66,.24,32)
  const centers = [-9, 0, 9]
  const radius = 3.65
  const locks = []
  const waterSite = {x:64,z:-26}
  const floorY = Math.max(...centers.flatMap(x => [-3.8,3.8].flatMap(dx =>
    [-3.65,3.65].map(z => getTerrainHeight(x+dx,z))))) + .34
  const interior = new T.MeshStandardMaterial({color:0xcac2b1,roughness:.86})
  const fabric = new T.MeshStandardMaterial({color:0x87948f,roughness:1})
  const rack = new T.MeshStandardMaterial({color:0x666e70,roughness:.49,metalness:.36})
  const glazing = new T.MeshPhysicalMaterial({
    color:0x97bdc4,transparent:true,opacity:.34,roughness:.12,metalness:.15,side:T.DoubleSide,depthWrite:false
  })
  const interiorLamps=[]
  const ceilingDiffuser=new T.MeshBasicMaterial({color:0x817d6d});
  let habitatLightsOn=false;
  const light = new T.MeshBasicMaterial({color:0xffe9bd})
  function block(group,w,h,d,material,x,y,z){
    return mesh(group,new T.BoxGeometry(w,h,d),material,x,y,z)
  }
  function wallWithPorts(index){
    const material=sand.clone()
    material.side=T.DoubleSide
    material.onBeforeCompile=shader=>{
      shader.vertexShader="varying vec3 habitatPosition;\n"+shader.vertexShader
      shader.vertexShader=shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nhabitatPosition=position;")
      const sy=index===1?1.28:.94
      const ports=index===1?[`(habitatPosition.z > 2.15 && abs(habitatPosition.x) < .79 && habitatPosition.y*${sy} < 2.06)`]:[]
      if(index===2)ports.push(`(habitatPosition.z < -2.4 && abs(habitatPosition.x)<.72 && habitatPosition.y*${sy}<2.2)`);
      if(index>0) ports.push(`(habitatPosition.x < -2.4 && habitatPosition.z*habitatPosition.z + pow(habitatPosition.y*${sy}-1.19,2.0) < 1.25*1.25)`)
      if(index<2) ports.push(`(habitatPosition.x > 2.4 && habitatPosition.z*habitatPosition.z + pow(habitatPosition.y*${sy}-1.19,2.0) < 1.25*1.25)`)
      shader.fragmentShader="varying vec3 habitatPosition;\n"+shader.fragmentShader
      shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`
        #include <color_fragment>
        vec3 p=habitatPosition;
        float grit=sin(dot(p,vec3(212.,331.,177.)))*sin(dot(p,vec3(153.,-287.,227.)));
        float runoff=sin(29.*p.x+31.*p.z+sin(7.*p.z))*.5+.5;
        float dust=(1.-smoothstep(.17,1.4,p.y))*(.38+.62*runoff);
        diffuseColor.rgb *= 1. + grit*.047 - dust*.16;
        diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.13,.94,.78),dust*.42);
      `)
      shader.fragmentShader=shader.fragmentShader.replace("#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif("+ports.join(" || ")+")discard;")
    }
    material.customProgramCacheKey=()=> "habitat-"+index
    return material
  }
  for(const [index,x] of centers.entries()){
    const group=new T.Group()
    group.position.set(x,floorY,0)
    block(group,8.2,.18,8.2,deckMat,0,-.11,0)

    mesh(group,shell,wallWithPorts(index),0,0,0).scale.y = index===1 ? 1.28 : .94
    for(const dx of [-3.75,3.75]) for(const z of [-3.75,3.75]){
      const base=getTerrainHeight(x+dx,z)-floorY
      const height=Math.max(.08,-base-.14)
      mesh(group,leg,steel,dx,base+height/2,z).scale.y=height
      mesh(group,foot,deckMat,dx,base+.035,z)
    }
    const shellHeight = index===1 ? 1.28 : .94
    // Suspension cables terminate on the actual polygonal dome roof.
    function roofY(px,pz){const radius=Math.hypot(px,pz);let h=3.49;for(let i=0;i<rings.length-1;i++){if(radius<=rings[i][0]&&radius>=rings[i+1][0]){const t=(rings[i][0]-radius)/(rings[i][0]-rings[i+1][0]);h=rings[i][1]+t*(rings[i+1][1]-rings[i][1]);break;}}return h*shellHeight;}
    for(const xx of [-.67,.67]){const roof=roofY(xx,-.5),bottom=2.88;const cable=mesh(group,new T.CylinderGeometry(.009,.009,Math.max(.01,roof-bottom),8),steel,xx,(roof+bottom)/2,-.5);mesh(group,new T.CylinderGeometry(.045,.045,.025,12),steel,xx,roof-.015,-.5);block(group,.09,.04,.11,steel,xx,2.87,-.5);}
    block(group,1.78,.045,.28,rack,0,2.87,-.5)
    block(group,1.7,.055,.22,ceilingDiffuser,0,2.83,-.5)
    const lamp=new T.PointLight(0xffe6b8,0,6)
    lamp.position.set(0,2.65,-.35)
    group.add(lamp);interiorLamps.push([lamp,22]);
    const furnishingsStart=group.children.length
    if(index===2){
      // Three compact sleeping berths, with a clear central aisle.
      for(const xx of [-1.25,0,1.25]){
        block(group,.94,.38,1.9,rack,xx,.34,1.25);block(group,.88,.14,1.8,fabric,xx,.60,1.25);
        block(group,.68,.12,.4,interior,xx,.73,1.91);block(group,.88,.06,1.2,seal,xx,.70,1.0);
      }
      for(const xx of [-1.75,1.75]){
        block(group,.65,1.75,.6,interior,xx,.88,-1.5);
        for(const dx of [-.16,.16]){block(group,.29,1.65,.04,rack,xx+dx,.88,-1.18);block(group,.025,.22,.05,steel,xx+dx+.07,.92,-1.14);}
      }
    }else if(index===1){
      block(group,2.5,.85,.65,interior,0,.44,-2.25);
      lifeDisplays.push(display(group,-.72,1.58,-2.0,"EARTH / INBOX",earthMessages.rows(0),1.2,.7));
      lifeDisplays.push(display(group,.72,1.58,-2.0,"EARTH / OUTBOX",earthMessages.rows(1),1.2,.7));
      for(let i=0;i<6;i++)block(group,.13,.025,.10,i%2?light:steel,-.8+i*.32,.89,-1.98);
    }else{
      block(group,2.7,.12,.72,interior,0,.95,-2.0);
      for(const xx of [-1.1,1.1])block(group,.08,.9,.55,rack,xx,.45,-2.0);
      labDisplay=display(group,-.65,1.58,-2.15,"SOIL ANALYSIS",["REG-01 / SAMPLE","E: START ANALYSIS","ILLUSTRATIVE GAME DATA"],1.55,.86);
      block(group,.62,.38,.52,rack,.75,1.2,-2.0);mesh(group,new T.CylinderGeometry(.19,.19,.04,24),steel,.75,1.42,-1.95);mesh(group,new T.DodecahedronGeometry(.12,0),new T.MeshStandardMaterial({color:0x805b43,roughness:1}),.75,1.53,-1.95);
      mesh(group,new T.CylinderGeometry(.08,.10,.30,20),glazing,.6,1.54,-1.95);
      for(let i=0;i<6;i++)mesh(group,new T.CylinderGeometry(.025,.025,.17,12),glazing,-.1+i*.14,1.1,-1.78);
      block(group,.7,1.6,.6,interior,-2,.8,-.9);
    }
    group.updateMatrixWorld(true)
    for(const furniture of group.children.slice(furnishingsStart)) {
      indoorObstacles.push(new T.Box3().setFromObject(furniture))
    }
    if(index===1){
      mesh(group,new T.CylinderGeometry(.025,.038,1.58,12),steel,-.5,5.08,-.18)
      mesh(group,new T.CylinderGeometry(.05,.064,.81,12),steel,.42,4.7,-.35)
    }
    if(index!==1){colonyGroup.add(group);continue;}
    const chamber = new T.Group()
    group.add(chamber)
    block(chamber,1.94,.16,2.28,deckMat,0,-.08,4.01)
    block(chamber,1.94,.16,2.28,seal,0,2.13,4.01)
    for (const side of [-1,1]) {
      block(chamber,.14,2.12,2.28,seal,side*.91,1.06,4.01)
    }
    const makeHatch = z => {
      const frame = new T.Group()
      frame.position.z = z
      chamber.add(frame)
      for (const side of [-1,1]) block(frame,.16,2.13,.18,steel,side*.81,1.07,0)
      block(frame,1.79,.15,.18,steel,0,2.08,0)
      const leaf = new T.Group()
      frame.add(leaf)
      const leafShape=new T.Shape();leafShape.moveTo(-.79,.02);leafShape.lineTo(.79,.02);leafShape.lineTo(.79,2.0);leafShape.lineTo(-.79,2.0);leafShape.closePath();const hole=new T.Path();hole.absarc(0,1.36,.22,0,Math.PI*2,true);leafShape.holes.push(hole);
      mesh(leaf,new T.ExtrudeGeometry(leafShape,{depth:.12,bevelEnabled:false}),hatchMat,0,0,-.06);
      mesh(leaf,new T.CircleGeometry(.22,40),glazing,0,1.36,.002);
      for(const face of [-1,1]){
        mesh(leaf,new T.TorusGeometry(.24,.032,10,40),steel,0,1.36,face*.085);
        for(const xx of [-.73,.73])block(leaf,.05,1.9,.04,steel,xx,1.0,face*.085);
        for(const yy of [.08,1.94])block(leaf,1.5,.05,.04,steel,0,yy,face*.085);
        block(leaf,.07,.35,.10,steel,.57,.9,face*.12);
        block(leaf,1.15,.15,.025,rack,0,.25,face*.08);
        for(let i=0;i<7;i++)block(leaf,.07,.12,.028,seal,-.48+i*.16,.25,face*.10);
      }
      return leaf
    }
    const lock = { x, inner:makeHatch(2.92), outer:makeHatch(5.12) }
    locks.push(lock)
    for(const z of [3.24,4.86]) block(chamber,.45,.05,.14,ceilingDiffuser,0,2.03,z)
    const chamberLight = new T.PointLight(0xffdeb0,0,3.6)
    chamberLight.position.set(0,1.95,4)
    chamber.add(chamberLight);interiorLamps.push([chamberLight,8]);
    const footY=getTerrainHeight(x,6.65)+.02
    lock.rampFootY=footY
    const ramp=block(colonyGroup,1.55,.12,Math.hypot(1.53,floorY-footY),deckMat,x,(floorY+footY)/2,5.885)
    ramp.rotation.x=Math.atan2(floorY-footY,1.53)
    ramp.castShadow=ramp.receiveShadow=true
    group.traverse(part=>{if(part.isMesh && part.material!==glazing){part.castShadow=true;part.receiveShadow=true}})
    colonyGroup.add(group)
  }
  const tunnelMaterial=new T.MeshStandardMaterial({color:0xa5a59c,roughness:.66,metalness:.26,side:T.DoubleSide})
  // Trim connector walls against each dome's actual radius at this height.
  // Geometry stays overlapped externally so no cracks appear at curved junctions.
  tunnelMaterial.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 connectorWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nconnectorWorld=(modelMatrix*vec4(position,1.0)).xyz;');
    shader.fragmentShader='varying vec3 connectorWorld;\n'+shader.fragmentShader;
    const cuts=centers.map((cx,index)=>{const sy=index===1?1.28:.94;let code=`{float h=(connectorWorld.y-${floorY.toFixed(8)})/${sy};float r=0.0;`;
      for(let i=0;i<rings.length-1;i++){const [r0,y0]=rings[i],[r1,y1]=rings[i+1];code+=`if(h>=${y0.toFixed(6)}&&h<${y1.toFixed(6)})r=mix(${r0.toFixed(6)},${r1.toFixed(6)},(h-${y0.toFixed(6)})/${(y1-y0).toFixed(6)});`;}
      return code+`if(length(connectorWorld.xz-vec2(${cx.toFixed(1)},0.0))<r-0.025)discard;}`;}).join('\n');
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+cuts);
  };
  tunnelMaterial.customProgramCacheKey=()=> 'connector-boundary-trim-v1';
  for(const x of [-4.5,4.5]){
    const tube=mesh(colonyGroup,new T.CylinderGeometry(1.27,1.27,4.05,32,1,true),tunnelMaterial,x,floorY+1.19,0)
    tube.rotation.z=Math.PI/2
    tube.castShadow=tube.receiveShadow=true
    block(colonyGroup,4.1,.14,1.57,deckMat,x,floorY-.025,0)

  }
  // Flexible strip curtain, deliberately excluded from rigid collision obstacles.
  const stripMat=new T.MeshPhysicalMaterial({color:0x9bbdc0,transparent:true,opacity:.27,roughness:.32,side:T.DoubleSide,depthWrite:false});
  block(colonyGroup,.09,.08,1.45,steel,-5.9,floorY+2.22,0);
  for(let i=0;i<9;i++){const strip=mesh(colonyGroup,new T.PlaneGeometry(.16,2.03),stripMat,-5.9,floorY+1.17,-.64+i*.16);strip.rotation.y=Math.PI/2;strip.rotation.x=(i%2?1:-1)*.025;}
  // Separate sanitary compartment behind the sleeping dome.
  const sanitary=new T.Group();sanitary.name="SanitaryRoom";sanitary.position.set(9,floorY,0);colonyGroup.add(sanitary);
  block(sanitary,2.7,.16,4.0,deckMat,0,-.08,-5);
  for(const xx of [-1.08,1.08])for(const zz of [-3.35,-5,-6.65]){
    const ground=getTerrainHeight(9+xx,zz),height=Math.max(.08,floorY-.16-ground);
    block(colonyGroup,.14,height,.14,steel,9+xx,ground+height/2,zz);
    block(colonyGroup,.45,.08,.45,deckMat,9+xx,ground+.02,zz);
    block(colonyGroup,.3,.04,.3,steel,9+xx,floorY-.17,zz);
  }
  block(sanitary,2.7,.14,4.0,interior,0,2.5,-5);
  block(sanitary,.82,.045,.18,ceilingDiffuser,0,2.405,-5);
  const sanitaryLamp=new T.PointLight(0xffe6b8,0,3.8);
  sanitaryLamp.position.set(0,2.31,-5);
  sanitary.add(sanitaryLamp);interiorLamps.push([sanitaryLamp,9]);
  for(const xx of [-1.3,1.3])block(sanitary,.14,2.5,4,interior,xx,1.25,-5);
  block(sanitary,2.7,2.5,.14,interior,0,1.25,-6.93);
  for(const xx of [-1.05,1.05])block(sanitary,.5,2.5,.14,interior,xx,1.25,-3.07);
  block(sanitary,1.6,.35,.18,interior,0,2.325,-3.07);
  // Sealed vestibule overlaps the curved dome aperture and the sanitary front wall.
  // Its side returns and ceiling close the wedge-shaped gaps beside the door.
  for(const xx of [-.83,.83])block(sanitary,.18,2.3,1.08,interior,xx,1.15,-2.72);
  block(sanitary,1.84,.15,1.08,interior,0,2.275,-2.72);
  block(sanitary,1.84,.10,1.08,deckMat,0,-.025,-2.72);
  for(const xx of [-.755,.755])block(sanitary,.045,2.18,.12,rack,xx,1.10,-3.02);
  block(sanitary,1.55,.045,.12,rack,0,2.17,-3.02);
  const toilet=new T.Group();toilet.position.x=.65;sanitary.add(toilet);
  block(toilet,.56,.43,.62,interior,0,.25,-5.9);
  mesh(toilet,new T.LatheGeometry([new T.Vector2(.10,0),new T.Vector2(.14,.08),new T.Vector2(.26,.18)],32),interior,0,.43,-5.86);mesh(toilet,new T.CircleGeometry(.10,24),rack,0,.435,-5.86).rotation.x=-Math.PI/2;
  const seat=mesh(toilet,new T.TorusGeometry(.21,.055,12,40),rack,0,.65,-5.86);seat.rotation.x=Math.PI/2;
  block(toilet,.52,.64,.20,rack,0,.65,-6.25);
  const washstand=new T.Group();washstand.position.set(.8,0,-4.2);sanitary.add(washstand);
  block(washstand,.6,.10,.45,interior,0,.85,0);
  mesh(washstand,new T.CylinderGeometry(.16,.13,.035,24),rack,0,.91,0);
  const tapPath=new T.CatmullRomCurve3([new T.Vector3(-.24,.91,0),new T.Vector3(-.24,1.12,0),new T.Vector3(-.07,1.14,0),new T.Vector3(0,1.08,0)]);
  mesh(washstand,new T.TubeGeometry(tapPath,20,.018,8,false),steel,0,0,0);
  // Left shower bay: wall-mounted head, tray and a recessed grated drain.
  const shower=new T.Group();shower.position.set(-.65,0,-5.8);sanitary.add(shower);
  block(shower,1.08,.065,1.45,interior,0,.035,0);
  for(const xx of [-.52,.52])block(shower,.035,.055,1.45,rack,xx,.085,0);
  block(shower,1.08,.055,.035,rack,0,.085,.7);
  const showerPipe=new T.CatmullRomCurve3([new T.Vector3(0,.55,-.65),new T.Vector3(0,1.95,-.65),new T.Vector3(0,2.02,-.30),new T.Vector3(0,1.96,-.22)]);
  mesh(shower,new T.TubeGeometry(showerPipe,24,.018,8,false),steel,0,0,0);
  mesh(shower,new T.CylinderGeometry(.13,.13,.035,24),steel,0,1.93,-.22);
  mesh(shower,new T.CylinderGeometry(.115,.115,.012,24),rack,0,1.905,-.22);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;mesh(shower,new T.SphereGeometry(.008,5,4),interior,Math.cos(a)*.08,1.897,-.22+Math.sin(a)*.08);}
  block(shower,.14,.10,.065,rack,0,1.05,-.60);
  for(const xx of [-.045,.045])mesh(shower,new T.SphereGeometry(.025,8,6),steel,xx,1.05,-.55);
  block(shower,.24,.012,.24,rack,0,.075,.18);
  for(let i=0;i<6;i++)block(shower,.20,.008,.012,steel,0,.084,.09+i*.035);
  block(shower,.018,1.55,1.1,privacyMaterialForShower(),.53,.9,-.1);
  function privacyMaterialForShower(){return new T.MeshPhysicalMaterial({color:0xaec7c5,transparent:true,opacity:.25,roughness:.55,side:T.DoubleSide,depthWrite:false});}
  const privacyMaterial=new T.MeshStandardMaterial({color:0xc5d3cc,roughness:.78});
  const privacyDoor=new T.Group();privacyDoor.name="PrivacyDoor";privacyDoor.position.set(-.76,0,-3.07);sanitary.add(privacyDoor);
  block(privacyDoor,1.5,2.16,.055,privacyMaterial,.75,1.10,0);
  for(const face of [-1,1])block(privacyDoor,.05,.22,.065,rack,1.33,1.06,face*.06);
  for(const xx of [-.79,.79])block(sanitary,.06,2.25,.10,interior,xx,1.13,-3.07);
  let privacyOpen=false;
  display(sanitary,.65,1.65,-6.81,"HYGIENE",["VACUUM TOILET","WASTEWATER LINE"],.7,.4);
  // Buried wastewater route: render only the two exposed risers, not hidden pipework.
  function drainRiser(points){const curve=new T.CurvePath();for(let i=1;i<points.length;i++)curve.add(new T.LineCurve3(new T.Vector3(...points[i-1]),new T.Vector3(...points[i])));mesh(colonyGroup,new T.TubeGeometry(curve,12,.055,8,false),rack,0,0,0);}
  drainRiser([[9.65,floorY+.45,-6.25],[9.65,floorY+.15,-6.25],[9.65,getTerrainHeight(9.65,-6.25)-.2,-6.25]]);
  const treatmentGround=getTerrainHeight(64,-26);
  drainRiser([[63.2,treatmentGround-.2,-26],[63.2,treatmentGround+.7,-26],[64,treatmentGround+.7,-26]]);
  sanitary.updateMatrixWorld(true);toilet.updateMatrixWorld(true);indoorObstacles.push(new T.Box3().setFromObject(toilet));
  const insideZone=(x,z)=>(Math.abs(x-9)<1.12&&z< -2.45&&z> -6.7)||centers.some(cx=>Math.hypot(x-cx,z)<radius-.33)
    || (Math.abs(z)<.73 && Math.abs(x)<9)
  const outsideObstacle=(x,z)=>(Math.abs(x-9)<1.65&&z< -2.5&&z> -7.2)||centers.some(cx=>Math.hypot(x-cx,z)<radius+.25)
    || (Math.abs(z)<1.46 && Math.abs(x)<9)
    || locks.some(lock=>Math.abs(x-lock.x)<1.14 && z>2.85 && z<5.34)

  const solar = addSolarFarm(T, scene, getTerrainHeight, baseObstacles)

  scene.add(colonyGroup)

  terrainMesh.name='Ihan_plain'; colonyGroup.name='Ihan_pressurised_habitat';
  terrainMesh.userData.heightAt=getTerrainHeight;
  return {solar,ground:terrainMesh,habitat:colonyGroup,obstacles:baseObstacles,indoorObstacles,locks,floorY,entryZ:6.65,
    labPrompt(x,z,camera){
      if(Math.hypot(x+9,z+1.8)>2.25||z< -1.8)return '';
      if(camera){const d=camera.getWorldDirection(new T.Vector3());const t=(-1.9-z)/d.z;if(t<=0||t>2.8||Math.abs(x+d.x*t+9)>1.45)return '';}
      return soilAnalysis.phase==='scanning'?"Soil analysis in progress…":soilAnalysis.phase==='complete'?"E · Analyze sample again":"E · Analyze soil sample";
    },
    startLab(x,z,camera){if(!this.labPrompt(x,z,camera))return false;soilAnalysis=startSoilAnalysis(soilAnalysis);lastLabFrame=-1;globalThis.dispatchEvent?.(new CustomEvent('colony:notification',{detail:{message:"Soil analysis started · REG-01"}}));return true;},
    updateLab(dt){const previous=soilAnalysis.phase;soilAnalysis=stepSoilAnalysis(soilAnalysis,dt);if(previous==='scanning'&&soilAnalysis.phase==='complete')globalThis.dispatchEvent?.(new CustomEvent('colony:notification',{detail:{message:"Soil analysis complete · Results on the laboratory screen"}}));const frame=Math.floor(soilAnalysis.elapsed*5);if(frame===lastLabFrame)return;lastLabFrame=frame;
      if(soilAnalysis.phase==='scanning')labDisplay?.(["REG-01 / PROCESSING",`SCAN %${Math.floor(soilAnalysis.elapsed/SOIL_SCAN_SECONDS*100)}`,"PLEASE WAIT"]);
      if(soilAnalysis.phase==='complete')labDisplay?.(["ICE 2.4% / IRON OXIDE 14.2%","PERCHLORATE DETECTED / TREATMENT REQUIRED","ILLUSTRATIVE GAME DATA"]);
    },
    analyzeSoil(){if(soilAnalysis.phase!=='scanning'){soilAnalysis=startSoilAnalysis(soilAnalysis);lastLabFrame=-1;}},
    get soilAnalysis(){return soilAnalysis;},
    privacyPrompt(x,z){return Math.abs(x-9)<1.05&&Math.abs(z+3.07)<1.5?"E · Bathroom door: "+(privacyOpen?"close":"open"):'';},
    togglePrivacy(x,z){if(!this.privacyPrompt(x,z))return false;privacyOpen=!privacyOpen;privacyDoor.rotation.y=privacyOpen?-Math.PI/2:0;return true;},
    privacyBlocked(x,z){if(z> -3.3&&z< -2.18&&Math.abs(x-9)>.62&&Math.abs(x-9)<1.16)return true;return !privacyOpen&&Math.abs(x-9)<1.0&&Math.abs(z+3.07)<.28;},
    setHabitatLights(on){
      if(on===habitatLightsOn)return;
      habitatLightsOn=on;
      for(const [lamp,intensity] of interiorLamps)lamp.intensity=on?intensity:0;
      ceilingDiffuser.color.setHex(on?0xffe9bd:0x817d6d);
    },
    get habitatLightsOn(){return habitatLightsOn;},
    updateLifeDisplays(){lifeDisplays.forEach((paint,index)=>paint(earthMessages.rows(index)));},
    messageTarget(x,z,camera){
      if(!camera)return -1;
      const d=camera.getWorldDirection(new T.Vector3());
      if(Math.abs(d.z)<.001)return -1;
      const distance=(-1.943-z)/d.z;
      if(distance<=0||distance>2.8)return -1;
      const hitX=x+d.x*distance,hitY=camera.position.y+d.y*distance-floorY;
      if(Math.abs(hitY-1.58)>.35)return -1;
      return [-.72,.72].findIndex(center=>Math.abs(hitX-center)<.6);
    },
    messagePrompt(x,z,camera){const index=this.messageTarget(x,z,camera);return index<0?'':index===0?"E · Messages from Earth":"E · Write a message to Earth";},
    openMessages(x,z,camera){const index=this.messageTarget(x,z,camera);if(index<0)return false;earthMessages.open(index,()=>this.updateLifeDisplays());return true;},    isInsideFloor:insideZone,isHabitatBlocked:outsideObstacle,
    blocksFootprint(x,z,hx,hz){return centers.some(cx=>Math.abs(x-cx)<radius+hx && Math.abs(z)<radius+hz)
      || baseObstacles.some(b=>x+hx>b.min.x && x-hx<b.max.x && z+hz>b.min.z && z-hz<b.max.z)},
    views:{bedroom:{position:[9,floorY+1.65,-2.25],target:[9,floorY+.85,1.2]},laboratory:{position:[-9,floorY+1.65,2.1],target:[-9,floorY+1.25,-2]},controlRoom:{position:[0,floorY+1.65,2.15],target:[0,floorY+1.5,-2]},sanitary:{position:[9,floorY+1.65,-3.6],target:[9,floorY+.9,-6]},panorama:{position:[-2.2,getTerrainHeight(-2.2,28)+2,28],target:[0,floorY+2.35,1]},
      base:{position:[24,16,30],target:[4,1,0]},solar:{position:[solar.x0+30,solar.level+36,solar.z0+46],target:[solar.x0,solar.level,solar.z0]},
      pad:{position:[29,35,35],target:[0,0,18]}},
    dispose(){earthMessages.dispose();screenTextures.forEach(t=>t.dispose());surfaceDetail.dispose();regolithPhoto.dispose()}
  };
}
