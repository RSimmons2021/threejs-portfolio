import * as THREE from 'three'
import vertexShader from '../../shaders/cyber/vertex.glsl'
import fragmentShader from '../../shaders/cyber/fragment.glsl'

// Day/night palette. Colours are written as sRGB hex and converted to linear by
// THREE.Color; light intensities are linear multipliers. 'daylight' runs 0..1.
const PALETTE = {
    night: { sky: [0.17, 0.2, 0.3], ground: [0.025, 0.025, 0.04], sun: [0, 0, 0], fogLow: '#0d1119', fogHigh: '#1a2030',
        zenith: '#05070b', horizon: '#1a1a2c', glow: '#3a1d3e', density: 0.0125, neon: 3.0, lit: 0.16 },
    // Day: blue sky fill + a warm key sun (baked sun-shadow volume), light haze.
    day: { sky: [0.5, 0.62, 0.9], ground: [0.2, 0.17, 0.14], sun: [6.4, 5.2, 3.9], fogLow: '#7f8f9c', fogHigh: '#aebfcc',
        zenith: '#3d6eae', horizon: '#bccbd6', glow: '#e8d6bc', density: 0.0056, neon: 0.75, lit: 0.05 }
}

export default class CyberMaterials
{
    constructor(materials)
    {
        this.materials = materials
        this.cache = new Map()
        const items = materials.resources.items
        this.atlas = items.cyber_kit_colorTexture
        this.mask = items.cyber_kit_maskTexture
        this.volume = items.cyber_light_volumeTexture
        this.sunVolume = items.cyber_light_sunTexture
        this.atlas.colorSpace = THREE.SRGBColorSpace
        // GLTFLoader's UVs use glTF's top-left convention: sample the atlases unflipped.
        this.atlas.flipY = false
        this.mask.flipY = false
        this.atlas.magFilter = THREE.NearestFilter
        this.atlas.minFilter = THREE.LinearMipmapLinearFilter
        this.mask.magFilter = THREE.NearestFilter
        this.mask.colorSpace = THREE.NoColorSpace
        this.volume.colorSpace = THREE.NoColorSpace
        this.volume.minFilter = this.volume.magFilter = THREE.LinearFilter
        this.volume.generateMipmaps = false
        this.sunVolume.colorSpace = THREE.NoColorSpace
        this.sunVolume.minFilter = this.sunVolume.magFilter = THREE.LinearFilter
        this.sunVolume.generateMipmaps = false
        for(const t of [this.atlas, this.mask, this.volume, this.sunVolume]) t.needsUpdate = true
        const volume = items.cyberLightVolume
        const c = (hex) => new THREE.Color(hex)
        this.night = { ...PALETTE.night, fogLow: c(PALETTE.night.fogLow), fogHigh: c(PALETTE.night.fogHigh),
            zenith: c(PALETTE.night.zenith), horizon: c(PALETTE.night.horizon), glow: c(PALETTE.night.glow) }
        this.day = { ...PALETTE.day, fogLow: c(PALETTE.day.fogLow), fogHigh: c(PALETTE.day.fogHigh),
            zenith: c(PALETTE.day.zenith), horizon: c(PALETTE.day.horizon), glow: c(PALETTE.day.glow) }
        this.shared = {
            uSkyColor: { value: new THREE.Color() },
            uGroundColor: { value: new THREE.Color() },
            uFogColor: { value: new THREE.Color() },
            uFogHighColor: { value: new THREE.Color() },
            uFogDensity: { value: 0.011 },
            uFogHeight: { value: 26 },
            uNeonIntensity: { value: 1 },
            uLitFraction: { value: 0.1 },
            uDaylight: { value: 1 },
            uWetness: { value: 0.3 },
            uReducedMotion: { value: materials.resources.config.reducedMotion ? 1 : 0 },
            uLightVolume: { value: this.volume },
            uVolumeMin: { value: new THREE.Vector3(...volume.grid.min) },
            uVolumeMax: { value: new THREE.Vector3(...volume.grid.max) },
            uVolumeCell: { value: new THREE.Vector3(...volume.grid.cell) },
            uVolumeDims: { value: new THREE.Vector3(...volume.grid.dims) },
            uVolumeTiles: { value: new THREE.Vector2(...volume.grid.tiles) },
            uVolumeZOffset: { value: volume.grid.sampleZOffset },
            uBounceScale: { value: volume.encoding.bounceScale },
            uSunVolume: { value: this.sunVolume },
            uSunDir: { value: new THREE.Vector3(...(volume.sun?.direction || [-0.28, -0.76, 0.59])).normalize() },
            uSunColor: { value: new THREE.Color(0, 0, 0) },
            uDusk: { value: 0 },
            uZenith: { value: new THREE.Color() },
            uHorizon: { value: new THREE.Color() },
            uGlow: { value: new THREE.Color() }
        }
        this.update(null, 0.5)
    }

    // Options: color, emission, atlas, ao, seed, sign, screen, tinted, ground, alpha
    create(options = {})
    {
        const { color = new THREE.Color('#ffffff'), emission = 0, atlas = false, ao = false, seed = false,
            sign = false, screen = false, tinted = false, ground = false, alpha = 1 } = options
        const key = [color.getHexString(), emission, atlas, ao, seed, sign, screen, tinted, ground, alpha, !!options.doubleSide].join(':')
        if(this.cache.has(key)) return this.cache.get(key)
        const defines = {}
        if(atlas) defines.KIT_ATLAS = 1
        if(ao) defines.HAS_AO = 1
        if(seed) defines.HAS_SEED = 1
        if(sign) defines.SIGN_ATLAS = 1
        if(screen) defines.SCREEN = 1
        if(tinted) defines.TINTED = 1
        if(ground) defines.WET_GROUND = 1
        const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, defines,
            uniforms: { ...this.materials.shades.lightUniforms, ...this.shared,
                uAtlas: { value: this.atlas }, uMask: { value: this.mask },
                uCelColor: { value: color.clone() }, uCelEmission: { value: emission },
                uAlpha: { value: alpha }, uRevealProgress: { value: 1 }, uAllowBelowGround: { value: 1 } },
            transparent: alpha < 1, depthWrite: alpha === 1, side: options.doubleSide ? THREE.DoubleSide : THREE.FrontSide })
        this.cache.set(key, material)
        this.materials.shades.items[`cyber:${key}`] = material
        return material
    }

    // Materials for props / vehicles exported with nd_* slot names (no per-instance seed).
    forSlot(slot)
    {
        if(slot === 'nd_glass') return this.create({ color: new THREE.Color('#6fa7b5'), alpha: 0.22 })
        if(slot === 'nd_thruster')
        {
            // Not cached: the car drives its glow (0 in drive mode, 1+ in flight).
            this.thruster ||= this.create({ color: new THREE.Color('#58b6ff'), emission: 0.0001 })
            return this.thruster
        }
        // The dashboard is a live canvas (CockpitDash fills in the map later).
        if(slot === 'nd_dash') return (this.dashMaterial ||= new THREE.MeshBasicMaterial({ color: '#05080b', toneMapped: false }))
        // Mirror: dark reflective glass. HUD: nothing until something is drawn on it.
        if(slot === 'nd_mirror') return this.create({ color: new THREE.Color('#141d24'), emission: 0.15 })
        if(slot === 'nd_screen' || slot === 'nd_card') return this.create({ screen: true })
        if(slot === 'nd_hud') return (this.hudMaterial ||= new THREE.MeshBasicMaterial({ visible: false }))
        return this.create({ atlas: true, ao: true })
    }

    // daylight: 0 night .. 1 day. Called every frame by Application with the world.
    update(world, forcedDaylight)
    {
        let daylight = forcedDaylight
        if(world)
        {
            const at = world.dayNightCycle.settings.currentTime
            daylight = THREE.MathUtils.smoothstep(Math.sin((at - 0.25) * Math.PI * 2), -0.18, 0.3)
        }
        const n = this.night, d = this.day, s = this.shared
        const mix = (a, b) => a + (b - a) * daylight
        s.uDaylight.value = daylight
        s.uSkyColor.value.setRGB(mix(n.sky[0], d.sky[0]), mix(n.sky[1], d.sky[1]), mix(n.sky[2], d.sky[2]))
        s.uGroundColor.value.setRGB(mix(n.ground[0], d.ground[0]), mix(n.ground[1], d.ground[1]), mix(n.ground[2], d.ground[2]))
        s.uFogColor.value.copy(n.fogLow).lerp(d.fogLow, daylight)
        s.uFogHighColor.value.copy(n.fogHigh).lerp(d.fogHigh, daylight)
        s.uZenith.value.copy(n.zenith).lerp(d.zenith, daylight)
        s.uHorizon.value.copy(n.horizon).lerp(d.horizon, daylight)
        s.uGlow.value.copy(n.glow).lerp(d.glow, daylight)
        // The key sun warms and reddens toward dawn/dusk, and is off at night.
        const dusk = Math.max(0, 1 - Math.abs(daylight - 0.45) / 0.45) * (daylight < 0.98 ? 1 : 0)
        const warm = THREE.MathUtils.smoothstep(daylight, 0.25, 0.85)
        s.uSunColor.value.setRGB(
            daylight * (d.sun[0] * warm + 5.0 * (1 - warm)),
            daylight * (d.sun[1] * warm + 2.4 * (1 - warm)),
            daylight * (d.sun[2] * warm + 1.0 * (1 - warm)))
        s.uDusk.value = dusk
        s.uNeonIntensity.value = mix(n.neon, d.neon)
        s.uLitFraction.value = mix(n.lit, d.lit)
        let density = mix(n.density, d.density)
        let wet = 0.3
        const weather = world?.weather?.state
        if(weather === 'rain') { density *= 1.25; wet = 1 }
        if(weather === 'fog') density *= 1.8
        if(weather === 'snow') { density *= 1.35; wet = 0.5 }
        s.uFogDensity.value += (density - s.uFogDensity.value) * (world ? 0.02 : 1)
        s.uWetness.value += (wet - s.uWetness.value) * (world ? 0.01 : 1)
        this.daylight = daylight
    }
}
