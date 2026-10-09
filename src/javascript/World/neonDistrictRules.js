export const LOOK_SLICE = Object.freeze({ x: 0, y: -30, radius: 35 })

// The normal site URL must show the work under review. Only an explicit zero
// selects the legacy city, so lighting/performance links also keep Neon on.
export function neonEnabled(search = '')
{
    return new URLSearchParams(search).get('neon') !== '0'
}

export function entryPosition(neon)
{
    return { x: neon ? LOOK_SLICE.x : 0, y: neon ? LOOK_SLICE.y : 0, z: 12 }
}

export function inLookSlice(x, y)
{
    return Math.hypot(x - LOOK_SLICE.x, y - LOOK_SLICE.y) <= LOOK_SLICE.radius
}

export function previewTime(value)
{
    const match = /^(\d{1,2}):(\d{2})$/.exec(value || '')
    if(!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null
    return (Number(match[1]) + Number(match[2]) / 60) / 24
}
