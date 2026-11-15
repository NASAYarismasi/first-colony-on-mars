import * as T from "three"

// Adapted from Ilhan's crater-ecosystem.mjs. Seeded procedural texture, no image asset.
export function generateSurfaceDetailTexture() {
  const size = 512
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = size
  const ctx = canvas.getContext("2d")

  let seed = 13177
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }

  // Base sand noise.
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

  // Soft dust patches.
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

  // Light and dark pebbles with subtle edge shading.
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

      // Subtle upper-edge highlight.
      ctx.strokeStyle = "rgba(255,255,255,0.16)"
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(x + ox, y + oy, r * 1.02, Math.PI * 1.05, Math.PI * 1.85)
      ctx.stroke()
    })
  }

  // Fine sand ridges.
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
  texture.anisotropy = 4
  return texture
}

