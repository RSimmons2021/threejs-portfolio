import * as THREE from 'three'

/**
 * Fireflies that fade in at night and drift gently above the ground.
 * (The camera looks down at the world, so a star field would never be seen —
 * fireflies live inside the view instead.)
 */
export default class Fireflies
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.config = _options.config
        this.dayNightCycle = _options.dayNightCycle
        this.weather = _options.weather
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.count = 90
        this.settings.areaCenter = new THREE.Vector2(- 5, - 25)
        this.settings.areaRadius = 55
        this.settings.minHeight = 0.4
        this.settings.maxHeight = 2.6
        this.settings.size = 0.35
        this.settings.driftEnabled = !(this.config && this.config.reducedMotion)

        this.setGeometry()
        this.setMaterial()
        this.setPoints()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('fireflies')
            this.debugFolder.add(this.settings, 'driftEnabled').name('drift')
            this.debugFolder.add(this.material, 'size').min(0.05).max(1).step(0.05).name('size')
        }
    }

    setGeometry()
    {
        this.geometry = new THREE.BufferGeometry()

        const positions = new Float32Array(this.settings.count * 3)
        this.basePositions = new Float32Array(this.settings.count * 3)
        this.phases = new Float32Array(this.settings.count)

        for(let i = 0; i < this.settings.count; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const radius = Math.sqrt(Math.random()) * this.settings.areaRadius

            const x = this.settings.areaCenter.x + Math.cos(angle) * radius
            const y = this.settings.areaCenter.y + Math.sin(angle) * radius
            const z = this.settings.minHeight + Math.random() * (this.settings.maxHeight - this.settings.minHeight)

            positions[i * 3 + 0] = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = z

            this.basePositions[i * 3 + 0] = x
            this.basePositions[i * 3 + 1] = y
            this.basePositions[i * 3 + 2] = z

            this.phases[i] = Math.random() * Math.PI * 2
        }

        this.positionAttribute = new THREE.BufferAttribute(positions, 3)
        this.geometry.setAttribute('position', this.positionAttribute)
    }

    setMaterial()
    {
        // Soft round sprite generated on a small canvas (no texture request)
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 64
        const context = canvas.getContext('2d')
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
        gradient.addColorStop(0, 'rgba(255, 244, 190, 1)')
        gradient.addColorStop(0.3, 'rgba(255, 228, 140, 0.6)')
        gradient.addColorStop(1, 'rgba(255, 220, 120, 0)')
        context.fillStyle = gradient
        context.fillRect(0, 0, 64, 64)

        this.texture = new THREE.CanvasTexture(canvas)

        this.material = new THREE.PointsMaterial({
            size: this.settings.size,
            map: this.texture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
        })
    }

    setPoints()
    {
        this.points = new THREE.Points(this.geometry, this.material)
        this.points.frustumCulled = false
        this.points.matrixAutoUpdate = false
        this.points.updateMatrix()
        this.points.visible = false
        this.container.add(this.points)
    }

    update()
    {
        const nightFactor = this.dayNightCycle ? this.dayNightCycle.nightFactor : 0

        // Fireflies hide in the rain
        const rainValue = this.weather ? this.weather.values.rain : 0

        // Fully invisible during the day: skip all work
        const targetOpacity = Math.max((nightFactor - 0.35) / 0.65, 0) * (1 - rainValue)
        this.material.opacity += (targetOpacity - this.material.opacity) * 0.05

        const visible = this.material.opacity > 0.01
        this.points.visible = visible

        if(!visible || !this.settings.driftEnabled)
        {
            return
        }

        // Gentle sinusoidal drift
        const elapsed = this.time.elapsed * 0.001
        const positions = this.positionAttribute.array

        for(let i = 0; i < this.settings.count; i++)
        {
            const phase = this.phases[i]
            positions[i * 3 + 0] = this.basePositions[i * 3 + 0] + Math.sin(elapsed * 0.4 + phase) * 0.8
            positions[i * 3 + 1] = this.basePositions[i * 3 + 1] + Math.cos(elapsed * 0.3 + phase * 1.7) * 0.8
            positions[i * 3 + 2] = this.basePositions[i * 3 + 2] + Math.sin(elapsed * 0.6 + phase * 2.3) * 0.3
        }

        this.positionAttribute.needsUpdate = true
    }
}
