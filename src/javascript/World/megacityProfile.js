// How much of Unity's Megacity each quality tier draws around the district.
//   bands    cumulative placement files to load (ring-0 phones, +1 desktop, +2 ultra)
//   texture  texture size in px (512 / 1024)
//   near/far LOD switch distances (m from the camera to a 50 m cell)
//   max      draw distance; small props (<3 m) stop at `small`
//   far plane for the camera while the ring is shown
//   shadow   static sun shadow map size (0 = none; phones use canyon darkening only)
//   proxyFar tile variants heavier than this (vertices) use the family proxy past `near`
//   skip     model families left out entirely (draw calls matter more than triangles)
//   explore  how far past the district the car may fly (m); stays inside what the tier draws
// The low tier keeps Megacity's sky, sun and haze but draws no ring geometry.
export const MEGACITY_PROFILES = Object.freeze({
    low: null,
    medium: { bands: 1, texture: 512, near: 55, far: 220, max: 620, small: 45, cameraFar: 800, normalMaps: false, shadow: 0,
        proxyFar: 0, skip: /^(Pagoda|Streetlight|Trash|Pent_Roof|Satellite|Floorlight|Floodlight)/, explore: 450 },
    high: { bands: 2, texture: 1024, near: 110, far: 380, max: 950, small: 110, cameraFar: 1150, normalMaps: true, shadow: 2048,
        proxyFar: 200, skip: /^(Trash|Floorlight)/, explore: 700 },
    ultra: { bands: 3, texture: 1024, near: 180, far: 520, max: 1350, small: 200, cameraFar: 1500, normalMaps: true, shadow: 4096,
        proxyFar: 400, skip: null, explore: 950 }
})

// Phones and tablets never get the outer band or 4096 shadows, whatever
// their GPU name says: thermal limits, not peak speed, set their frame rate.
export function megacityProfile(tier, { mobile = false } = {})
{
    const profile = MEGACITY_PROFILES[tier] ?? null
    if(!profile || !mobile) return profile
    return { ...profile, bands: Math.min(profile.bands, 2), texture: Math.min(profile.texture, 1024),
        max: Math.min(profile.max, 800), cameraFar: Math.min(profile.cameraFar, 1000), shadow: Math.min(profile.shadow, 2048),
        explore: Math.min(profile.explore, 600) }
}
