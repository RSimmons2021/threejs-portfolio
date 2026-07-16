import * as THREE from 'three'
import particleTrailVertex from '../../shaders/particleTrail/vertex.glsl'
import particleTrailFragment from '../../shaders/particleTrail/fragment.glsl'

/**
 * Tire feedback while drifting: dark skid-mark decals laid under the rear
 * wheels (one draw call, circular buffer of quads) plus soft smoke puffs
 * (reuses the particleTrail point shaders).
 * Drift detection comes from AdvancedLighting.dynamicState.driftFactor.
 */
export default class TireEffects
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.config = _options.config
        this.physics = _options.physics
        this.advancedLighting = _options.advancedLighting
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.driftThreshold = 0.35
        this.settings.speedThreshold = 0.004
        this.settings.markInterval = 35 // ms between skid quads while drifting
        this.settings.markFadeHalfLife = 2200 // ms for a mark to lose half its alpha
        this.settings.smokeEnabled = !(this.config && this.config.reducedMotion)
        this.settings.smokeInterval = 70

        this.timeSinceLastMark = 0
        this.timeSinceLastSmoke = 0
        this.tempVelocity = new THREE.Vector2()

        this.setMarks()
        this.setSmoke()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('tireEffects')
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'smokeEnabled').name('smoke')
            this.debugFolder.add(this.settings, 'driftThreshold').min(0.1).max(0.9).step(0.05).name('driftThreshold')
        }
    }

    setMarks()
    {
        this.marks = {}
        this.marks.max = 240
        this.marks.index = 0
        this.marks.anyVisible = false

        this.marks.geometry = new THREE.BufferGeometry()

        const positions = new Float32Array(this.marks.max * 4 * 3)
        const alphas = new Float32Array(this.marks.max * 4)
        const indices = new Uint16Array(this.marks.max * 6)

        for(let i = 0; i < this.marks.max; i++)
        {
            const v = i * 4
            indices[i * 6 + 0] = v
            indices[i * 6 + 1] = v + 1
            indices[i * 6 + 2] = v + 2
            indices[i * 6 + 3] = v
            indices[i * 6 + 4] = v + 2
            indices[i * 6 + 5] = v + 3
        }

        this.marks.positionAttribute = new THREE.BufferAttribute(positions, 3)
        this.marks.alphaAttribute = new THREE.BufferAttribute(alphas, 1)
        this.marks.geometry.setAttribute('position', this.marks.positionAttribute)
        this.marks.geometry.setAttribute('alpha', this.marks.alphaAttribute)
        this.marks.geometry.setIndex(new THREE.BufferAttribute(indices, 1))

        this.marks.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms:
            {
                uColor: { value: new THREE.Color('#1c1a18') }
            },
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main()
                {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main()
                {
                    gl_FragColor = vec4(uColor, vAlpha);
                }
            `
        })

        this.marks.mesh = new THREE.Mesh(this.marks.geometry, this.marks.material)
        this.marks.mesh.frustumCulled = false
        this.marks.mesh.matrixAutoUpdate = false
        this.marks.mesh.updateMatrix()
        this.container.add(this.marks.mesh)
    }

    addMark(_x, _y, _directionX, _directionY, _alpha)
    {
        const halfLength = 0.3
        const halfWidth = 0.11

        // Perpendicular of the sliding direction
        const perpX = - _directionY
        const perpY = _directionX

        const positions = this.marks.positionAttribute.array
        const alphas = this.marks.alphaAttribute.array
        const v = this.marks.index * 4

        const z = 0.02

        positions[(v + 0) * 3 + 0] = _x - _directionX * halfLength - perpX * halfWidth
        positions[(v + 0) * 3 + 1] = _y - _directionY * halfLength - perpY * halfWidth
        positions[(v + 0) * 3 + 2] = z

        positions[(v + 1) * 3 + 0] = _x + _directionX * halfLength - perpX * halfWidth
        positions[(v + 1) * 3 + 1] = _y + _directionY * halfLength - perpY * halfWidth
        positions[(v + 1) * 3 + 2] = z

        positions[(v + 2) * 3 + 0] = _x + _directionX * halfLength + perpX * halfWidth
        positions[(v + 2) * 3 + 1] = _y + _directionY * halfLength + perpY * halfWidth
        positions[(v + 2) * 3 + 2] = z

        positions[(v + 3) * 3 + 0] = _x - _directionX * halfLength + perpX * halfWidth
        positions[(v + 3) * 3 + 1] = _y - _directionY * halfLength + perpY * halfWidth
        positions[(v + 3) * 3 + 2] = z

        alphas[v + 0] = _alpha
        alphas[v + 1] = _alpha
        alphas[v + 2] = _alpha
        alphas[v + 3] = _alpha

        this.marks.index = (this.marks.index + 1) % this.marks.max
        this.marks.positionAttribute.needsUpdate = true
        this.marks.anyVisible = true
    }

    setSmoke()
    {
        this.smoke = {}
        this.smoke.max = 60
        this.smoke.index = 0

        this.smoke.geometry = new THREE.BufferGeometry()

        const positions = new Float32Array(this.smoke.max * 3)
        const colors = new Float32Array(this.smoke.max * 3)
        const alphas = new Float32Array(this.smoke.max)
        const sizes = new Float32Array(this.smoke.max)

        this.smoke.velocities = new Float32Array(this.smoke.max * 3)
        this.smoke.lives = new Float32Array(this.smoke.max) // remaining life in ms, 0 = dead

        for(let i = 0; i < this.smoke.max; i++)
        {
            colors[i * 3 + 0] = 0.62
            colors[i * 3 + 1] = 0.6
            colors[i * 3 + 2] = 0.58
        }

        this.smoke.positionAttribute = new THREE.BufferAttribute(positions, 3)
        this.smoke.colorAttribute = new THREE.BufferAttribute(colors, 3)
        this.smoke.alphaAttribute = new THREE.BufferAttribute(alphas, 1)
        this.smoke.sizeAttribute = new THREE.BufferAttribute(sizes, 1)

        this.smoke.geometry.setAttribute('position', this.smoke.positionAttribute)
        this.smoke.geometry.setAttribute('color', this.smoke.colorAttribute)
        this.smoke.geometry.setAttribute('alpha', this.smoke.alphaAttribute)
        this.smoke.geometry.setAttribute('size', this.smoke.sizeAttribute)

        this.smoke.material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
            uniforms:
            {
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: particleTrailVertex,
            fragmentShader: particleTrailFragment
        })

        this.smoke.points = new THREE.Points(this.smoke.geometry, this.smoke.material)
        this.smoke.points.frustumCulled = false
        this.smoke.points.matrixAutoUpdate = false
        this.smoke.points.updateMatrix()
        this.container.add(this.smoke.points)
    }

    addSmoke(_x, _y)
    {
        const i = this.smoke.index

        this.smoke.positionAttribute.array[i * 3 + 0] = _x + (Math.random() - 0.5) * 0.3
        this.smoke.positionAttribute.array[i * 3 + 1] = _y + (Math.random() - 0.5) * 0.3
        this.smoke.positionAttribute.array[i * 3 + 2] = 0.15

        this.smoke.velocities[i * 3 + 0] = (Math.random() - 0.5) * 0.8
        this.smoke.velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.8
        this.smoke.velocities[i * 3 + 2] = 0.9 + Math.random() * 0.8

        this.smoke.lives[i] = 850
        this.smoke.sizeAttribute.array[i] = 0.12
        this.smoke.alphaAttribute.array[i] = 0.55

        this.smoke.index = (i + 1) % this.smoke.max
    }

    update()
    {
        if(!this.settings.enabled)
        {
            return
        }

        const delta = Math.min(this.time.delta, 60)

        // Fade existing marks
        if(this.marks.anyVisible)
        {
            const decay = Math.pow(0.5, delta / this.settings.markFadeHalfLife)
            const alphas = this.marks.alphaAttribute.array
            let maxAlpha = 0

            for(let i = 0; i < alphas.length; i++)
            {
                alphas[i] *= decay
                if(alphas[i] > maxAlpha)
                {
                    maxAlpha = alphas[i]
                }
            }

            if(maxAlpha < 0.005)
            {
                this.marks.anyVisible = false
            }

            this.marks.alphaAttribute.needsUpdate = true
        }

        // Advance smoke particles
        if(this.settings.smokeEnabled)
        {
            const deltaSeconds = delta / 1000
            const positions = this.smoke.positionAttribute.array
            const alphas = this.smoke.alphaAttribute.array
            const sizes = this.smoke.sizeAttribute.array
            let smokeDirty = false

            for(let i = 0; i < this.smoke.max; i++)
            {
                if(this.smoke.lives[i] <= 0)
                {
                    continue
                }

                this.smoke.lives[i] -= delta
                smokeDirty = true

                if(this.smoke.lives[i] <= 0)
                {
                    alphas[i] = 0
                    continue
                }

                const lifeRatio = this.smoke.lives[i] / 850

                positions[i * 3 + 0] += this.smoke.velocities[i * 3 + 0] * deltaSeconds
                positions[i * 3 + 1] += this.smoke.velocities[i * 3 + 1] * deltaSeconds
                positions[i * 3 + 2] += this.smoke.velocities[i * 3 + 2] * deltaSeconds

                alphas[i] = lifeRatio * 0.55
                sizes[i] = 0.12 + (1 - lifeRatio) * 0.22
            }

            if(smokeDirty)
            {
                this.smoke.positionAttribute.needsUpdate = true
                this.smoke.alphaAttribute.needsUpdate = true
                this.smoke.sizeAttribute.needsUpdate = true
            }
        }

        // Emit new marks/smoke while drifting
        const driftFactor = this.advancedLighting ? this.advancedLighting.dynamicState.driftFactor : 0
        const carSpeed = this.physics && this.physics.car ? Math.abs(this.physics.car.speed) : 0

        if(driftFactor < this.settings.driftThreshold || carSpeed < this.settings.speedThreshold)
        {
            return
        }

        const chassisBody = this.physics.car.chassis ? this.physics.car.chassis.body : null
        const wheels = this.physics.car.wheels
        if(!chassisBody || !wheels || !wheels.bodies)
        {
            return
        }

        // Marks follow the actual sliding direction (the velocity)
        this.tempVelocity.set(chassisBody.velocity.x, chassisBody.velocity.y)
        if(this.tempVelocity.lengthSq() < 0.0001)
        {
            return
        }
        this.tempVelocity.normalize()

        const backLeft = wheels.bodies[wheels.indexes.backLeft]
        const backRight = wheels.bodies[wheels.indexes.backRight]

        this.timeSinceLastMark += delta
        if(this.timeSinceLastMark >= this.settings.markInterval)
        {
            this.timeSinceLastMark = 0
            const alpha = Math.min(driftFactor, 1) * 0.42

            this.addMark(backLeft.position.x, backLeft.position.y, this.tempVelocity.x, this.tempVelocity.y, alpha)
            this.addMark(backRight.position.x, backRight.position.y, this.tempVelocity.x, this.tempVelocity.y, alpha)
        }

        if(this.settings.smokeEnabled)
        {
            this.timeSinceLastSmoke += delta
            if(this.timeSinceLastSmoke >= this.settings.smokeInterval)
            {
                this.timeSinceLastSmoke = 0
                this.addSmoke(backLeft.position.x, backLeft.position.y)
                this.addSmoke(backRight.position.x, backRight.position.y)
            }
        }
    }
}
