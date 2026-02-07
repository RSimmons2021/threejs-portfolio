import * as THREE from 'three'
import portalGlowVertex from '../../shaders/portalGlow/vertex.glsl'
import portalGlowFragment from '../../shaders/portalGlow/fragment.glsl'

export default class Portals
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.scene = _options.scene
        this.camera = _options.camera
        this.renderer = _options.renderer
        this.car = _options.car
        this.physics = _options.physics
        this.sounds = _options.sounds
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.portalSize = 3
        this.settings.glowIntensity = 1.5
        this.settings.animationSpeed = 1.0
        this.settings.renderResolution = 512
        this.settings.renderResolutionLow = 256
        this.settings.lodDistance = 20 // Distance threshold for low-res rendering
        this.settings.particleCount = 100
        this.settings.renderInterval = 2
        this.settings.maxRenderDistance = 45

        // Debug counter
        this.debugUpdateCount = 0
        this.renderFrameCount = 0
        this.verboseLogs = Boolean(this.debug)
        this.tempDirection = new THREE.Vector3()
        this.tempToPortal = new THREE.Vector3()

        // Portal pairs
        this.portals = []

        // Render targets for portal views
        this.renderTargets = []

        // Portal cameras
        this.portalCameras = []

        // Teleportation cooldown
        this.teleportCooldown = 0
        this.teleportCooldownDuration = 2000 // ms

        this.setupPortalLocations()
        this.createPortals()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        this.log('🌀 Portal system initialized -', this.portals.length, 'portals in intro section with labels!')

        // Log portal positions for debugging
        for(const portalPair of this.portals)
        {
            const entrance = portalPair.entrance
            this.log(`  📍 ${portalPair.name} portal at (${entrance.position.x.toFixed(2)}, ${entrance.position.y.toFixed(2)}) → Destination: (${entrance.destinationPos.x.toFixed(2)}, ${entrance.destinationPos.y.toFixed(2)})`)
        }

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('portals')
            this.debugFolder.open()
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'portalSize').min(1).max(5).step(0.5).name('size').onChange(() => {
                this.updatePortalSizes()
            })
            this.debugFolder.add(this.settings, 'glowIntensity').min(0).max(3).step(0.1).name('glowIntensity')
            this.debugFolder.add(this.settings, 'animationSpeed').min(0.1).max(3).step(0.1).name('animSpeed')
        }
    }

    log(..._args)
    {
        if(this.verboseLogs)
        {
            console.log(..._args)
        }
    }

    warn(..._args)
    {
        if(this.verboseLogs)
        {
            console.warn(..._args)
        }
    }

    setupPortalLocations()
    {
        // All portals behind intro section with custom positions
        this.portalLocations = [
            {
                name: 'Projects',
                label: 'PROJECTS',
                entrance: {
                    x: -14.93,
                    y: -12.00,
                    z: 0,
                    rotation: Math.PI / 3
                },
                exit: { x: 30, y: -30, z: 0, rotation: Math.PI },
                color: '#00ff88' // Cyan-green
            },
            {
                name: 'About',
                label: 'ABOUT',
                entrance: {
                    x: -3.00,
                    y: -23.00,
                    z: 0,
                    rotation: Math.PI / 2
                },
                exit: { x: -0.40, y: -54, z: 0, rotation: Math.PI / 2 },
                color: '#ff0088' // Magenta
            },
            {
                name: 'Games',
                label: 'GAMES',
                entrance: {
                    x: 3.93,
                    y: -13.00,
                    z: 0,
                    rotation: Math.PI * 2 / 3
                },
                exit: { x: -22, y: -36, z: 0, rotation: 0 },
                color: '#ffaa00' // Orange
            }
        ]
    }

    createPortals()
    {
        for(const location of this.portalLocations)
        {
            const portalPair = {
                name: location.name,
                entrance: this.createPortal(location.entrance, location.exit, location.color, true, location.label),
                exit: this.createPortal(location.exit, location.entrance, location.color, false, null),
                color: location.color
            }

            this.portals.push(portalPair)
        }
    }

    createPortal(position, destinationPos, color, isEntrance, labelText)
    {
        const portal = {
            position: new THREE.Vector3(position.x, position.y, position.z),
            rotation: position.rotation,
            destinationPos: new THREE.Vector3(destinationPos.x, destinationPos.y, destinationPos.z),
            color: new THREE.Color(color),
            isEntrance: isEntrance,
            labelText: labelText
        }

        // Create render targets for portal view (high and low resolution)
        const rtOptions = {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat
        }
        portal.renderTarget = new THREE.WebGLRenderTarget(
            this.settings.renderResolution,
            this.settings.renderResolution,
            rtOptions
        )
        portal.renderTargetLow = new THREE.WebGLRenderTarget(
            this.settings.renderResolutionLow,
            this.settings.renderResolutionLow,
            rtOptions
        )

        // Create portal camera
        portal.camera = new THREE.PerspectiveCamera(
            50,
            1,
            0.1,
            100
        )
        portal.camera.position.copy(portal.destinationPos)
        portal.camera.position.z = 3
        portal.camera.lookAt(portal.destinationPos.x, portal.destinationPos.y, 0)

        // Create portal frame geometry (ring)
        const portalGroup = new THREE.Group()
        portalGroup.position.copy(portal.position)
        portalGroup.rotation.z = portal.rotation

        // Portal ring (outer glow)
        const ringGeometry = new THREE.RingGeometry(
            this.settings.portalSize * 0.9,
            this.settings.portalSize * 1.0,
            64
        )
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: portal.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        portalGroup.add(ring)

        // Portal surface (shows destination)
        const portalGeometry = new THREE.CircleGeometry(this.settings.portalSize * 0.85, 64)
        const portalMaterial = new THREE.MeshBasicMaterial({
            map: portal.renderTarget.texture,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        })
        const portalMesh = new THREE.Mesh(portalGeometry, portalMaterial)
        portalGroup.add(portalMesh)

        portal.ring = ring
        portal.mesh = portalMesh
        portal.group = portalGroup

        // Create swirling particles around portal
        portal.particles = this.createPortalParticles(portal.color)
        portalGroup.add(portal.particles.mesh)

        // Add glow effect
        const glowGeometry = new THREE.CircleGeometry(this.settings.portalSize * 1.2, 64)
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: portal.color },
                uTime: { value: 0 }
            },
            vertexShader: portalGlowVertex,
            fragmentShader: portalGlowFragment,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        })
        const glow = new THREE.Mesh(glowGeometry, glowMaterial)
        glow.position.z = -0.1
        portalGroup.add(glow)
        portal.glow = glow

        // Add text label if provided
        if(labelText)
        {
            const labelCanvas = document.createElement('canvas')
            labelCanvas.width = 512
            labelCanvas.height = 128
            const ctx = labelCanvas.getContext('2d')

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
            ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height)

            // Border
            ctx.strokeStyle = color
            ctx.lineWidth = 4
            ctx.strokeRect(2, 2, labelCanvas.width - 4, labelCanvas.height - 4)

            // Text
            ctx.fillStyle = '#ffffff'
            ctx.font = 'bold 60px Arial, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(labelText, labelCanvas.width / 2, labelCanvas.height / 2)

            const labelTexture = new THREE.CanvasTexture(labelCanvas)
            labelTexture.needsUpdate = true

            const labelGeometry = new THREE.PlaneGeometry(4, 1)
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: labelTexture,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            })
            const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial)
            labelMesh.position.z = this.settings.portalSize * 1.5
            portalGroup.add(labelMesh)
            portal.label = labelMesh
        }

        this.container.add(portalGroup)

        return portal
    }

    createPortalParticles(color)
    {
        const particles = {
            count: this.settings.particleCount,
            positions: [],
            angles: [],
            radii: [],
            speeds: []
        }

        // Create particle geometry
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(particles.count * 3)
        const colors = new Float32Array(particles.count * 3)
        const sizes = new Float32Array(particles.count)

        for(let i = 0; i < particles.count; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const radius = this.settings.portalSize * (0.5 + Math.random() * 0.5)

            particles.angles.push(angle)
            particles.radii.push(radius)
            particles.speeds.push(0.5 + Math.random() * 0.5)

            positions[i * 3] = Math.cos(angle) * radius
            positions[i * 3 + 1] = Math.sin(angle) * radius
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5

            colors[i * 3] = color.r
            colors[i * 3 + 1] = color.g
            colors[i * 3 + 2] = color.b

            sizes[i] = 0.05 + Math.random() * 0.1
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        const material = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })

        particles.mesh = new THREE.Points(geometry, material)
        particles.geometry = geometry

        return particles
    }

    updatePortalSizes()
    {
        // Recreate portals with new size
        for(const child of [...this.container.children])
        {
            this.container.remove(child)
        }
        this.portals = []
        this.createPortals()
    }

    checkTeleportation()
    {
        if(!this.settings.enabled)
        {
            return
        }

        if(this.teleportCooldown > 0)
        {
            return
        }

        // FIXED: Access physics car body, not visual car
        if(!this.physics || !this.physics.car || !this.physics.car.chassis || !this.physics.car.chassis.body)
        {
                // Log once when car reference is missing
                if(!this.carMissingLogged)
                {
                    this.warn('⚠️ Portal: Physics car missing. physics:', !!this.physics, 'physics.car:', !!this.physics?.car, 'chassis:', !!this.physics?.car?.chassis, 'body:', !!this.physics?.car?.chassis?.body)
                    this.carMissingLogged = true
                }
                return
        }

        // Car reference is valid, reset warning flag
        if(this.carMissingLogged)
        {
            this.log('✅ Portal: Physics car reference now valid!')
            this.carMissingLogged = false
        }

        const carPos = this.physics.car.chassis.body.position

        for(const portalPair of this.portals)
        {
            const entrance = portalPair.entrance

            // Check distance to entrance portal
            const distance = Math.sqrt(
                Math.pow(carPos.x - entrance.position.x, 2) +
                Math.pow(carPos.y - entrance.position.y, 2)
            )

            // Increased radius for easier detection
            const detectionRadius = this.settings.portalSize * 1.2

            // Debug: Log when car gets close to any portal
            if(distance < detectionRadius * 2)
            {
                this.log('🚗 Car near', portalPair.name, 'portal - Distance:', distance.toFixed(2), '/ Detection radius:', detectionRadius.toFixed(2))
            }

            if(distance < detectionRadius)
            {
                this.log('🌀 TELEPORTING through', portalPair.name, '- Distance:', distance.toFixed(2))

                // Teleport to the entrance's destination
                this.teleportCar(entrance)
                this.teleportCooldown = this.teleportCooldownDuration

                // Flash effect on entrance portal
                if(entrance.glow)
                {
                    const originalIntensity = this.settings.glowIntensity
                    this.settings.glowIntensity = 5.0
                    setTimeout(() => {
                        this.settings.glowIntensity = originalIntensity
                    }, 300)
                }

                break
            }
        }
    }

    teleportCar(portal)
    {
        if(!this.car || !this.physics || !this.physics.car || !this.physics.car.chassis) return

        const dest = portal.destinationPos

        this.log('✨ Teleporting car to:', dest.x.toFixed(2), dest.y.toFixed(2), dest.z.toFixed(2))

        // Teleport physics body
        this.physics.car.chassis.body.position.set(
            dest.x,
            dest.y,
            dest.z + 1.0  // Raised from 0.5 to 1.0 to ensure car is above ground
        )

        // Reset velocity to prevent flying out
        this.physics.car.chassis.body.velocity.set(0, 0, 0)
        this.physics.car.chassis.body.angularVelocity.set(0, 0, 0)

        // Wake up physics body
        this.physics.car.chassis.body.wakeUp()

        this.log('✅ Teleport complete!')
    }

    update()
    {
        // Debug: Log every 60 frames to confirm update is running
        this.debugUpdateCount++
        if(this.debugUpdateCount === 60)
        {
            this.log('🔄 Portal update() is running. Enabled:', this.settings.enabled, 'Car exists:', !!this.car, 'Physics exists:', !!this.physics)
            this.debugUpdateCount = 0
        }

        if(!this.settings.enabled)
        {
            return
        }

        const elapsed = this.time.elapsed * 0.001 * this.settings.animationSpeed

        // Update teleportation cooldown
        if(this.teleportCooldown > 0)
        {
            this.teleportCooldown -= this.time.delta
        }

        // Check for teleportation every frame
        this.checkTeleportation()

        // Update each portal
        for(const portalPair of this.portals)
        {
            for(const portal of [portalPair.entrance, portalPair.exit])
            {
                // Update glow animation
                if(portal.glow)
                {
                    portal.glow.material.uniforms.uTime.value = elapsed
                }

                // Rotate ring
                if(portal.ring)
                {
                    portal.ring.rotation.z = elapsed * 0.5
                }

                // Animate particles
                if(portal.particles)
                {
                    const positions = portal.particles.geometry.attributes.position.array

                    for(let i = 0; i < portal.particles.count; i++)
                    {
                        // Spiral motion
                        portal.particles.angles[i] += portal.particles.speeds[i] * 0.02

                        const angle = portal.particles.angles[i]
                        const radius = portal.particles.radii[i] * (0.8 + Math.sin(elapsed + i) * 0.2)

                        positions[i * 3] = Math.cos(angle) * radius
                        positions[i * 3 + 1] = Math.sin(angle) * radius
                        positions[i * 3 + 2] = Math.sin(elapsed * 2 + i) * 0.3
                    }

                    portal.particles.geometry.attributes.position.needsUpdate = true
                }

                // Update portal camera to look at destination from proper angle
                if(this.camera && this.camera.instance)
                {
                    // Position portal camera at destination
                    portal.camera.position.copy(portal.destinationPos)
                    portal.camera.position.z = 3

                    // Make it look in the opposite direction of the exit portal rotation
                    const lookAtOffset = 5
                    portal.camera.lookAt(
                        portal.destinationPos.x + Math.cos(portal.rotation + Math.PI) * lookAtOffset,
                        portal.destinationPos.y + Math.sin(portal.rotation + Math.PI) * lookAtOffset,
                        0
                    )
                }
            }
        }
    }

    renderPortalViews()
    {
        if(!this.settings.enabled) return
        if(!this.renderer || !this.scene) return
        if(!this.camera || !this.camera.instance) return

        // Skip all portal rendering during teleport cooldown (player is mid-transition)
        if(this.teleportCooldown > this.teleportCooldownDuration * 0.5)
        {
            return
        }

        this.renderFrameCount++
        if(this.renderFrameCount % this.settings.renderInterval !== 0)
        {
            return
        }

        const cameraPosition = this.camera.instance.position
        this.camera.instance.getWorldDirection(this.tempDirection)
        const maxDistanceSq = this.settings.maxRenderDistance * this.settings.maxRenderDistance
        const lodDistanceSq = this.settings.lodDistance * this.settings.lodDistance

        // Render each portal's view
        for(const portalPair of this.portals)
        {
            for(const portal of [portalPair.entrance, portalPair.exit])
            {
                this.tempToPortal.copy(portal.position).sub(cameraPosition)
                const distanceSq = this.tempToPortal.lengthSq()
                if(distanceSq > maxDistanceSq)
                {
                    continue
                }
                if(distanceSq < 0.0001)
                {
                    continue
                }

                // Skip rendering portals mostly behind camera
                const facing = this.tempDirection.dot(this.tempToPortal.normalize())
                if(facing < -0.3)
                {
                    continue
                }

                // Choose render target based on distance (LOD)
                const useLowRes = distanceSq > lodDistanceSq
                const target = useLowRes ? portal.renderTargetLow : portal.renderTarget

                // Swap the material texture to match the active target
                if(portal.mesh.material.map !== target.texture)
                {
                    portal.mesh.material.map = target.texture
                    portal.mesh.material.needsUpdate = true
                }

                // Temporarily hide this portal to avoid recursive rendering
                portal.group.visible = false

                // Render to texture
                this.renderer.setRenderTarget(target)
                this.renderer.render(this.scene, portal.camera)

                // Restore portal visibility
                portal.group.visible = true
            }
        }

        // Reset render target to screen
        this.renderer.setRenderTarget(null)
    }
}
