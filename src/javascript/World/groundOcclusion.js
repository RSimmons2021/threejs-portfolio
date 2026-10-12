import * as THREE from 'three'

// Top-down contact occlusion for the street, baked once at load from the
// district layout. Stands in for Megacity's SSAO + contact shadows at the cost
// of one texture read: towers darken the pavement at their base, street props
// (kiosks, dumpsters, planters...) get a soft footprint.
const BOUNDS = { x: -112, y: -88, w: 316, h: 124 }
const SIZE = { w: 1024, h: 400 }
const PROPS = { vending: 0.7, kiosk: 1.4, dumpster: 1.1, planter_tree: 1.2, clutter_boxes: 0.8, bollard: 0.25, street_lamp: 0.3, steam_vent: 0.6 }

function boxPass(src, dst, w, h, radius, horizontal)
{
    const lines = horizontal ? h : w, length = horizontal ? w : h
    const at = horizontal ? (line, k) => line * w + k : (line, k) => k * w + line
    for(let line = 0; line < lines; line++)
    {
        let sum = 0
        for(let k = -radius; k <= radius; k++) sum += src[at(line, Math.min(length - 1, Math.max(0, k)))]
        for(let k = 0; k < length; k++)
        {
            dst[at(line, k)] = sum / (radius * 2 + 1)
            sum += src[at(line, Math.min(length - 1, k + radius + 1))] - src[at(line, Math.max(0, k - radius))]
        }
    }
}

// Separable box blur, run twice (close to a Gaussian).
function blur(src, w, h, radius)
{
    const a = Float32Array.from(src), b = new Float32Array(src.length)
    for(let pass = 0; pass < 2; pass++)
    {
        boxPass(a, b, w, h, radius, true)
        boxPass(b, a, w, h, radius, false)
    }
    return a
}

export function buildGroundOcclusion(layout)
{
    const { w, h } = SIZE
    const sx = w / BOUNDS.w, sy = h / BOUNDS.h
    const occupancy = new Float32Array(w * h)
    const fill = (x0, y0, x1, y1, value = 1) =>
    {
        const i0 = Math.max(0, Math.floor((x0 - BOUNDS.x) * sx)), i1 = Math.min(w - 1, Math.ceil((x1 - BOUNDS.x) * sx))
        const j0 = Math.max(0, Math.floor((y0 - BOUNDS.y) * sy)), j1 = Math.min(h - 1, Math.ceil((y1 - BOUNDS.y) * sy))
        for(let j = j0; j <= j1; j++) for(let i = i0; i <= i1; i++) occupancy[j * w + i] = Math.max(occupancy[j * w + i], value)
    }
    for(const tower of layout.towers) fill(...tower.footprint)
    for(const [module, radius] of Object.entries(PROPS))
        for(const p of layout.instances[module] || []) if(p[2] < 1) fill(p[0] - radius, p[1] - radius, p[0] + radius, p[1] + radius, 0.8)
    // Tight contact band (~0.6 m) plus a wide skirt (~3 m).
    const tight = blur(occupancy, w, h, 2)
    const wide = blur(occupancy, w, h, 7)
    const data = new Uint8Array(w * h)
    for(let i = 0; i < data.length; i++)
        data[i] = Math.round(255 * Math.min(1, Math.max(0.2, 1 - tight[i] * 0.55 - wide[i] * 0.35)))
    const texture = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType)
    texture.minFilter = texture.magFilter = THREE.LinearFilter
    texture.colorSpace = THREE.NoColorSpace
    texture.needsUpdate = true
    return { texture, bounds: new THREE.Vector4(BOUNDS.x, BOUNDS.y, BOUNDS.w, BOUNDS.h) }
}
