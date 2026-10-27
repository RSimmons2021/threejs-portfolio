import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'

// Megacity's sky and light on every tier: the original HDR sky as the daytime
// dome and image-based light, a sun and sky fill for the Megacity PBR ring,
// and window emission that follows the visitor's clock. The district's own
// shader keeps reading the shared palette in CyberMaterials.
//
// The portfolio is Z-up; the HDR (like every three.js environment) is Y-up.
// SKY_AZIMUTH turns the HDR so its sun sits over the baked sun direction.
const SKY_URL = './models/megacity/sky.hdr'
export const SKY_AZIMUTH = THREE.MathUtils.degToRad(-12.8)
// District centre: the sun and its static shadow frame are anchored here.
export const SHADOW_CENTER = new THREE.Vector3(47.5, -26, 0)
// The ring's sun keeps the baked azimuth but rises to the HDR sun's height:
// at the district's 36 degrees the 450 m blocks would bury every facade in shade.
export const RING_SUN_ELEVATION = THREE.MathUtils.degToRad(55)

export function ringSunDirection(sunDir, target = new THREE.Vector3())
{
    const azimuth = Math.atan2(sunDir.y, sunDir.x)
    return target.set(Math.cos(azimuth) * Math.cos(RING_SUN_ELEVATION), Math.sin(azimuth) * Math.cos(RING_SUN_ELEVATION), Math.sin(RING_SUN_ELEVATION))
}

// Z-up world direction -> Y-up environment direction (a proper rotation, so the
// clouds are not mirrored). Shared by the dome shader and scene.environment.
export function skyRotation(azimuth = SKY_AZIMUTH)
{
    const c = Math.cos(azimuth), s = Math.sin(azimuth)
    return new THREE.Matrix3().set(
        c, -s, 0,
        0, 0, 1,
        -s, -c, 0)
}

// three.js negates environmentRotation's Euler angles before building the lookup
// matrix (WebGLMaterials), so hand it the negated Euler of the wanted rotation.
export function environmentEuler(rotation)
{
    const euler = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().setFromMatrix3(rotation), 'XYZ')
    return new THREE.Euler(-euler.x, -euler.y, -euler.z, 'XYZ')
}

export default class MegacityAtmosphere
{
    constructor(world)
    {
        this.world = world
        const shared = world.materials.cyber.shared
        this.rotation = skyRotation()
        Object.assign(shared, {
            uSkyHdr: { value: null },
            uSkyRotation: { value: this.rotation },
            uSkyMix: { value: 0 }
        })
        this.container = new THREE.Group()
        this.container.name = 'Megacity atmosphere'
        this.sun = new THREE.DirectionalLight(0xffffff, 1)
        this.sun.target.position.set(0, 0, 0)
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1)
        this.hemi.position.set(0, 0, 1)
        this.container.add(this.sun, this.sun.target, this.hemi)
        this.color = new THREE.Color()
        this.sunDirection = new THREE.Vector3()
        world.scene.environmentRotation.copy(environmentEuler(this.rotation))
        new RGBELoader().load(SKY_URL, (texture) =>
        {
            texture.mapping = THREE.EquirectangularReflectionMapping
            texture.minFilter = THREE.LinearFilter
            texture.magFilter = THREE.LinearFilter
            texture.generateMipmaps = false
            shared.uSkyHdr.value = texture
            const pmrem = new THREE.PMREMGenerator(world.renderer)
            this.environment = pmrem.fromEquirectangular(texture).texture
            pmrem.dispose()
            world.scene.environment = this.environment
        }, undefined, (error) => console.warn('Megacity sky unavailable; keeping the procedural sky.', error))
        world.time.on('tick', () => this.update())
    }

    update()
    {
        const w = this.world, s = w.materials.cyber.shared, daylight = s.uDaylight.value
        // HDR dome by day, the procedural night sky after dark.
        s.uSkyMix.value = s.uSkyHdr.value ? THREE.MathUtils.smoothstep(daylight, 0.15, 0.75) : 0
        // Sun for the PBR ring: same direction and colour as the district's key.
        const sun = s.uSunColor.value
        // Fixed on the district, not the camera: the ring's shadow map is
        // rendered once in this frame (MegacityRing.renderShadow).
        this.sun.position.copy(ringSunDirection(s.uSunDir.value, this.sunDirection)).multiplyScalar(1500).add(SHADOW_CENTER)
        this.sun.target.position.copy(SHADOW_CENTER)
        this.sun.target.updateMatrixWorld()
        this.sun.color.setRGB(sun.r, sun.g, sun.b)
        this.sun.intensity = 0.85
        this.hemi.color.copy(s.uSkyColor.value)
        this.hemi.groundColor.copy(s.uGroundColor.value)
        this.hemi.intensity = 0.12 + 0.1 * daylight
        // More sky fill where real shadows exist, so shaded facades keep their texture.
        w.scene.environmentIntensity = THREE.MathUtils.lerp(0.05, w.megacity?.profile?.shadow ? 0.55 : 0.3, daylight)
        // Megacity window emission: bright at night, a faint glow by day.
        if(w.megacity) w.megacity.uniforms.uRingEmissive.value = THREE.MathUtils.lerp(1.25, 0.18, daylight)
    }
}
