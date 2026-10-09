import * as THREE from 'three'

export const MAX_SPILL_LIGHTS = 8

export function spillBudget(settings)
{
    return Math.min(MAX_SPILL_LIGHTS, settings.lights,
        settings.bloom === 0 ? 2 : settings.bloom <= 3 ? 4 : MAX_SPILL_LIGHTS)
}

// Small near-field additions to the baked bounce volume. No Three.js light
// objects, shadow maps or additional render passes. The same source lights
// supply diffuse spill, glass highlights and wet-street reflections.
export default class NeonLightRig
{
    constructor(world, shared)
    {
        this.world = world
        this.shared = shared
        this.sources = []
        this.lastSelection = -Infinity
        const layout = world.resources.items.cyberLayout
        const designs = world.resources.items.cyberSigns.designs
        const add = (p, hex, radius, strength, normal = [0, 0, 0]) => this.sources.push({
            position: new THREE.Vector3(...p), color: new THREE.Color(hex), radius, strength,
            normal: new THREE.Vector3(...normal), score: 0
        })
        for(const sign of layout.signSlots)
        {
            if(sign.module === 'crown_billboard') continue
            const normal = [Math.sin(sign.rotZ || 0), -Math.cos(sign.rotZ || 0), 0]
            const blade = sign.module === 'sign_blade'
            add([sign.p[0] + normal[0] * 0.7, sign.p[1] + normal[1] * 0.7, sign.p[2] + (blade ? 1.6 : 0)],
                designs[sign.design % designs.length].color, blade ? 12 : 9, blade ? 1.6 : 1.2,
                blade ? [0, 0, 0] : normal)
        }
        for(const beam of layout.beams)
            if(beam.p[2] < 35) add(beam.p.map((v, i) => v + beam.dir[i] * 1.2), '#d6e5eb', 10, 0.7)
        this.forward = new THREE.Vector3()
    }

    update()
    {
        const w = this.world, s = this.shared
        const quality = w.quality.settings
        // Tier is a ceiling; shed these lights with bloom before sacrificing FPS.
        const budget = spillBudget(quality)
        const camera = w.camera.instance
        if(w.time.elapsed - this.lastSelection > 350 || budget !== this.budget)
        {
            this.lastSelection = w.time.elapsed
            this.budget = budget
            camera.getWorldDirection(this.forward)
            const nearby = []
            for(const source of this.sources)
            {
                const dx = source.position.x - camera.position.x, dy = source.position.y - camera.position.y, dz = source.position.z - camera.position.z
                const distance = Math.hypot(dx, dy, dz)
                if(distance > 42) continue
                const ahead = (dx * this.forward.x + dy * this.forward.y + dz * this.forward.z) / Math.max(1, distance)
                if(ahead < -0.35 && distance > 10) continue
                source.score = distance - ahead * 8
                nearby.push(source)
            }
            nearby.sort((a, b) => a.score - b.score)
            const count = Math.min(budget, nearby.length)
            s.uSpillCount.value = count
            for(let i = 0; i < MAX_SPILL_LIGHTS; i++)
            {
                const light = nearby[i]
                if(i >= count) { s.uSpillPosition.value[i].w = 0; continue }
                s.uSpillPosition.value[i].set(light.position.x, light.position.y, light.position.z, light.radius)
                s.uSpillColor.value[i].set(light.color.r, light.color.g, light.color.b, light.strength)
                s.uSpillNormal.value[i].copy(light.normal)
            }
        }
        const body = w.physics.car.chassis.body
        s.uCarGlow.value.set(body.position.x, body.position.y, body.position.z - 0.3,
            w.hoverFlight?.airborne ? 0.8 + (w.hoverFlight.fold || 0) : 0.12)
    }
}
