import * as THREE from 'three'
import particleTrailVertex from '../../shaders/particleTrail/vertex.glsl'
import particleTrailFragment from '../../shaders/particleTrail/fragment.glsl'

export default class ParticleTrails
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.car = _options.car
        this.physics = _options.physics
        this.camera = _options.camera
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.particlesPerSecond = 60
        this.settings.particleLifetime = 1.5 // seconds
        this.settings.particleSize = 0.3
        this.settings.speedThreshold = 0.001 // Minimum speed to emit particles
        this.settings.colorIntensity = 0.8
        this.settings.baseColor = new THREE.Color('#6B7F3F') // Olive green to match theme
        this.settings.boostColor = new THREE.Color('#800020') // Burgundy for boost

        // Particle pool
        this.particles = []
        this.maxParticles = 150
        this.activeCount = 0
        this.particleIndex = 0
        this.timeSinceLastEmit = 0
        this.emitInterval = 1000 / this.settings.particlesPerSecond // milliseconds
        this.tempLocalOffset = new THREE.Vector3(-0.8, 0, -0.2)
        this.tempWorldOffset = new THREE.Vector3()
        this.tempQuaternion = new THREE.Quaternion()

        this.setGeometry()
        this.setMaterial()
        this.setMesh()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('particleTrails')
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'particlesPerSecond').min(10).max(120).step(10).name('particlesPerSecond').onChange(() => {
                this.emitInterval = 1000 / this.settings.particlesPerSecond
            })
            this.debugFolder.add(this.settings, 'particleLifetime').min(0.5).max(3).step(0.1).name('lifetime')
            this.debugFolder.add(this.settings, 'particleSize').min(0.05).max(0.5).step(0.05).name('size').onChange(() => {
                this.material.size = this.settings.particleSize
            })
            this.debugFolder.add(this.settings, 'speedThreshold').min(0).max(0.1).step(0.01).name('speedThreshold')
            this.debugFolder.add(this.settings, 'colorIntensity').min(0).max(2).step(0.1).name('colorIntensity')
        }
    }

    setGeometry()
    {
        this.geometry = new THREE.BufferGeometry()

        // Create arrays for particle data
        const positions = new Float32Array(this.maxParticles * 3)
        const colors = new Float32Array(this.maxParticles * 3)
        const alphas = new Float32Array(this.maxParticles)
        const sizes = new Float32Array(this.maxParticles)

        // Initialize with default values
        for(let i = 0; i < this.maxParticles; i++)
        {
            positions[i * 3 + 0] = 0
            positions[i * 3 + 1] = 0
            positions[i * 3 + 2] = -100 // Start below the world

            colors[i * 3 + 0] = 1
            colors[i * 3 + 1] = 1
            colors[i * 3 + 2] = 1

            alphas[i] = 0
            sizes[i] = this.settings.particleSize

            // Create particle data object
            this.particles.push({
                active: false,
                life: 0,
                maxLife: this.settings.particleLifetime,
                position: new THREE.Vector3(0, 0, -100),
                velocity: new THREE.Vector3(0, 0, 0)
            })
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
        this.geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    }

    setMaterial()
    {
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: particleTrailVertex,
            fragmentShader: particleTrailFragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    }

    setMesh()
    {
        this.mesh = new THREE.Points(this.geometry, this.material)
        this.mesh.frustumCulled = false
        this.mesh.renderOrder = 999 // Render on top
        this.container.add(this.mesh)
    }

    emitParticle()
    {
        if(!this.settings.enabled) return
        if(!this.car || !this.car.chassis || !this.car.chassis.body) return

        // Check if car is moving fast enough
        const carSpeed = this.physics.car.speed
        if(carSpeed < this.settings.speedThreshold) return

        // Get particle from pool
        const particle = this.particles[this.particleIndex]

        // Reset particle
        particle.active = true
        particle.life = 0
        particle.maxLife = this.settings.particleLifetime

        // Get car position and orientation
        const carPosition = this.car.chassis.body.position
        const carQuaternion = this.car.chassis.body.quaternion

        // Calculate emission position (behind the car, near the ground)
        this.tempQuaternion.set(
            carQuaternion.x,
            carQuaternion.y,
            carQuaternion.z,
            carQuaternion.w
        )
        this.tempWorldOffset.copy(this.tempLocalOffset).applyQuaternion(this.tempQuaternion)

        particle.position.set(
            carPosition.x + this.tempWorldOffset.x,
            carPosition.y + this.tempWorldOffset.y,
            carPosition.z + this.tempWorldOffset.z + Math.random() * 0.1 - 0.05
        )

        // Add some random spread
        particle.position.x += (Math.random() - 0.5) * 0.3
        particle.position.y += (Math.random() - 0.5) * 0.3

        // Particle velocity (slight upward drift and slow down)
        particle.velocity.set(
            (Math.random() - 0.5) * 0.01,
            (Math.random() - 0.5) * 0.01,
            Math.random() * 0.02 // Slight upward drift
        )

        // Update geometry
        const positions = this.geometry.attributes.position.array
        positions[this.particleIndex * 3 + 0] = particle.position.x
        positions[this.particleIndex * 3 + 1] = particle.position.y
        positions[this.particleIndex * 3 + 2] = particle.position.z

        // Set initial color based on boost state
        const colors = this.geometry.attributes.color.array
        const isBoosting = this.physics.car.accelerating !== 0 && Math.abs(this.physics.car.speed) > 0.03
        const color = isBoosting ? this.settings.boostColor : this.settings.baseColor

        colors[this.particleIndex * 3 + 0] = color.r * this.settings.colorIntensity
        colors[this.particleIndex * 3 + 1] = color.g * this.settings.colorIntensity
        colors[this.particleIndex * 3 + 2] = color.b * this.settings.colorIntensity

        // Set initial alpha
        const alphas = this.geometry.attributes.alpha.array
        alphas[this.particleIndex] = 1.0

        // Move to next particle in pool
        this.particleIndex = (this.particleIndex + 1) % this.maxParticles
    }

    update()
    {
        if(!this.settings.enabled) return

        // Emit new particles based on time
        this.timeSinceLastEmit += this.time.delta
        if(this.timeSinceLastEmit >= this.emitInterval)
        {
            this.emitParticle()
            this.timeSinceLastEmit = 0
        }

        // Update existing particles
        const positions = this.geometry.attributes.position.array
        const alphas = this.geometry.attributes.alpha.array
        const sizes = this.geometry.attributes.size.array
        const deltaSeconds = this.time.delta / 1000

        let activeCount = 0
        let dirty = false

        for(let i = 0; i < this.maxParticles; i++)
        {
            const particle = this.particles[i]

            if(particle.active)
            {
                dirty = true

                // Update life
                particle.life += deltaSeconds

                if(particle.life >= particle.maxLife)
                {
                    // Particle died
                    particle.active = false
                    alphas[i] = 0
                    positions[i * 3 + 2] = -100 // Move below world
                }
                else
                {
                    activeCount++

                    // Update position with velocity
                    particle.position.add(particle.velocity)

                    positions[i * 3 + 0] = particle.position.x
                    positions[i * 3 + 1] = particle.position.y
                    positions[i * 3 + 2] = particle.position.z

                    // Fade out over lifetime
                    const lifeRatio = particle.life / particle.maxLife
                    alphas[i] = 1.0 - lifeRatio

                    // Grow size slightly over time
                    sizes[i] = this.settings.particleSize * (1.0 + lifeRatio * 0.5)
                }
            }
        }

        this.activeCount = activeCount

        // Only flag GPU upload when something actually changed
        if(dirty)
        {
            this.geometry.attributes.position.needsUpdate = true
            this.geometry.attributes.alpha.needsUpdate = true
            this.geometry.attributes.size.needsUpdate = true
        }
    }
}
