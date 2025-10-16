import * as THREE from 'three'

export default class GhostCar
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.car = _options.car
        this.physics = _options.physics
        this.materials = _options.materials
        this.sounds = _options.sounds
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.opacity = 0.4
        this.settings.color = '#32ffce' // Cyan ghost color
        this.settings.speed = 0.03
        this.settings.autoTour = true
        this.settings.showTrail = true
        this.settings.rotationSpeed = 2.0

        // Path system - defining key points for portfolio tour
        this.setupTourPath()

        // Ghost state
        this.state = {
            position: new THREE.Vector3(0, 0, 2),
            rotation: 0,
            currentPathIndex: 0,
            currentWaypointIndex: 0,
            pathProgress: 0,
            isMoving: true,
            pauseTime: 0,
            pauseDuration: 3000 // ms to pause at each project
        }

        this.setModel()
        this.setTrail()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        console.log('👻 AI Ghost Car initialized - Portfolio tour guide active!')

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('ghostCar')
            this.debugFolder.open()
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'opacity').min(0).max(1).step(0.1).name('opacity').onChange(() => {
                this.updateMaterials()
            })
            this.debugFolder.addColor(this.settings, 'color').name('color').onChange(() => {
                this.updateMaterials()
            })
            this.debugFolder.add(this.settings, 'speed').min(0.01).max(0.1).step(0.01).name('speed')
            this.debugFolder.add(this.settings, 'autoTour').name('autoTour')
            this.debugFolder.add(this.settings, 'showTrail').name('showTrail')
            this.debugFolder.add(this, 'resetToStart').name('Reset Tour')
        }
    }

    setupTourPath()
    {
        // Define the portfolio tour path with key locations
        this.tourPaths = [
            {
                name: 'Introduction',
                description: 'Starting point - SIM letters',
                waypoints: [
                    { x: 0, y: 5, z: 0, pause: true },
                    { x: -2, y: 3, z: 0, pause: false },
                    { x: 2, y: 3, z: 0, pause: false },
                    { x: 0, y: 0, z: 0, pause: false }
                ]
            },
            {
                name: 'Crossroads',
                description: 'Decision point',
                waypoints: [
                    { x: 0, y: -10, z: 0, pause: false },
                    { x: 0, y: -20, z: 0, pause: false },
                    { x: 0, y: -30, z: 0, pause: true }
                ]
            },
            {
                name: 'Projects Section',
                description: 'Showcasing portfolio work',
                waypoints: [
                    { x: 10, y: -30, z: 0, pause: false },
                    { x: 20, y: -30, z: 0, pause: false },
                    { x: 30, y: -30, z: 0, pause: true }, // Main project area
                    { x: 35, y: -30, z: 0, pause: false },
                    { x: 30, y: -35, z: 0, pause: false }
                ]
            },
            {
                name: 'Information Section',
                description: 'Contact and bio',
                waypoints: [
                    { x: 20, y: -40, z: 0, pause: false },
                    { x: 10, y: -50, z: 0, pause: false },
                    { x: 1.2, y: -55, z: 0, pause: true }
                ]
            },
            {
                name: 'Playground',
                description: 'Interactive area',
                waypoints: [
                    { x: -10, y: -50, z: 0, pause: false },
                    { x: -20, y: -40, z: 0, pause: false },
                    { x: -30, y: -34, z: 0, pause: false },
                    { x: -38, y: -34, z: 0, pause: true }
                ]
            },
            {
                name: 'Return to Start',
                description: 'Loop back',
                waypoints: [
                    { x: -30, y: -20, z: 0, pause: false },
                    { x: -20, y: -10, z: 0, pause: false },
                    { x: -10, y: 0, z: 0, pause: false },
                    { x: 0, y: 5, z: 0, pause: true }
                ]
            }
        ]

        console.log(`📍 Ghost car tour: ${this.tourPaths.length} sections with ${this.tourPaths.reduce((sum, path) => sum + path.waypoints.length, 0)} waypoints`)
    }

    setModel()
    {
        // Clone the car model for ghost
        if(!this.resources.items.carChassis) return

        this.model = {}
        this.model.container = new THREE.Object3D()
        this.model.container.matrixAutoUpdate = false

        // Clone chassis
        const chassisClone = this.resources.items.carChassis.scene.clone()
        this.model.chassis = chassisClone
        this.model.container.add(chassisClone)

        // Clone wheels
        this.model.wheels = []
        const wheelPositions = [
            { x: -0.65, y: -0.8, z: -0.4 },  // Front left
            { x: 0.65, y: -0.8, z: -0.4 },   // Front right
            { x: -0.65, y: 0.8, z: -0.4 },   // Back left
            { x: 0.65, y: 0.8, z: -0.4 }     // Back right
        ]

        for(const pos of wheelPositions)
        {
            if(this.resources.items.carWheel)
            {
                const wheelClone = this.resources.items.carWheel.scene.clone()
                wheelClone.position.set(pos.x, pos.y, pos.z)
                this.model.wheels.push(wheelClone)
                this.model.container.add(wheelClone)
            }
        }

        // Apply ghost materials
        this.updateMaterials()

        this.container.add(this.model.container)
    }

    updateMaterials()
    {
        if(!this.model) return

        const ghostColor = new THREE.Color(this.settings.color)

        // Create ghost material
        const ghostMaterial = new THREE.MeshPhongMaterial({
            color: ghostColor,
            transparent: true,
            opacity: this.settings.opacity,
            emissive: ghostColor,
            emissiveIntensity: 0.5,
            side: THREE.DoubleSide,
            depthWrite: false
        })

        // Apply to all meshes
        this.model.container.traverse((child) =>
        {
            if(child instanceof THREE.Mesh)
            {
                child.material = ghostMaterial
            }
        })
    }

    setTrail()
    {
        // Create glowing trail behind ghost car
        this.trail = {}
        this.trail.points = []
        this.trail.maxPoints = 50

        // Initialize with empty points
        for(let i = 0; i < this.trail.maxPoints; i++)
        {
            this.trail.points.push(new THREE.Vector3(0, 0, -100))
        }

        // Create trail geometry
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(this.trail.maxPoints * 3)
        const colors = new Float32Array(this.trail.maxPoints * 3)
        const sizes = new Float32Array(this.trail.maxPoints)

        const color = new THREE.Color(this.settings.color)

        for(let i = 0; i < this.trail.maxPoints; i++)
        {
            positions[i * 3] = 0
            positions[i * 3 + 1] = 0
            positions[i * 3 + 2] = -100

            colors[i * 3] = color.r
            colors[i * 3 + 1] = color.g
            colors[i * 3 + 2] = color.b

            const alpha = 1 - (i / this.trail.maxPoints)
            sizes[i] = alpha * 0.3
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        // Create trail material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;
                uniform float uPixelRatio;

                void main()
                {
                    vColor = color;
                    vAlpha = size * 3.0;

                    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                    vec4 viewPosition = viewMatrix * modelPosition;
                    vec4 projectionPosition = projectionMatrix * viewPosition;

                    gl_Position = projectionPosition;
                    gl_PointSize = size * uPixelRatio * 100.0;
                    gl_PointSize *= (1.0 / -viewPosition.z);
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vAlpha;

                void main()
                {
                    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                    float strength = 0.05 / distanceToCenter - 0.1;
                    strength = clamp(strength, 0.0, 1.0);

                    vec3 finalColor = vColor * strength;
                    float finalAlpha = vAlpha * strength;

                    gl_FragColor = vec4(finalColor, finalAlpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        this.trail.mesh = new THREE.Points(geometry, material)
        this.trail.mesh.renderOrder = 998
        this.container.add(this.trail.mesh)
    }

    getCurrentWaypoint()
    {
        const path = this.tourPaths[this.state.currentPathIndex]
        if(!path) return null
        return path.waypoints[this.state.currentWaypointIndex]
    }

    getNextWaypoint()
    {
        let pathIndex = this.state.currentPathIndex
        let waypointIndex = this.state.currentWaypointIndex + 1

        const currentPath = this.tourPaths[pathIndex]
        if(waypointIndex >= currentPath.waypoints.length)
        {
            // Move to next path
            pathIndex = (pathIndex + 1) % this.tourPaths.length
            waypointIndex = 0
        }

        const nextPath = this.tourPaths[pathIndex]
        return {
            waypoint: nextPath.waypoints[waypointIndex],
            pathIndex,
            waypointIndex
        }
    }

    update()
    {
        if(!this.settings.enabled || !this.settings.autoTour) return

        // Handle pause at waypoints
        if(!this.state.isMoving)
        {
            this.state.pauseTime += this.time.delta
            if(this.state.pauseTime >= this.state.pauseDuration)
            {
                this.state.isMoving = true
                this.state.pauseTime = 0

                // Move to next waypoint
                const next = this.getNextWaypoint()
                this.state.currentPathIndex = next.pathIndex
                this.state.currentWaypointIndex = next.waypointIndex
            }
            return
        }

        // Get current target waypoint
        const targetWaypoint = this.getCurrentWaypoint()
        if(!targetWaypoint) return

        const target = new THREE.Vector3(targetWaypoint.x, targetWaypoint.y, targetWaypoint.z)

        // Move towards target
        const direction = target.clone().sub(this.state.position)
        const distance = direction.length()

        if(distance < 0.5)
        {
            // Reached waypoint
            if(targetWaypoint.pause)
            {
                this.state.isMoving = false
                this.state.pauseTime = 0
            }
            else
            {
                // Move to next waypoint immediately
                const next = this.getNextWaypoint()
                this.state.currentPathIndex = next.pathIndex
                this.state.currentWaypointIndex = next.waypointIndex
            }
        }
        else
        {
            // Move towards target
            direction.normalize()
            this.state.position.add(direction.multiplyScalar(this.settings.speed))

            // Update rotation to face direction
            const targetRotation = Math.atan2(direction.y, direction.x)
            const rotationDiff = targetRotation - this.state.rotation

            // Normalize angle difference to -PI to PI
            let normalizedDiff = rotationDiff
            while(normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2
            while(normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2

            this.state.rotation += normalizedDiff * this.settings.rotationSpeed * this.time.delta * 0.001
        }

        // Update model position and rotation
        if(this.model && this.model.container)
        {
            const matrix = new THREE.Matrix4()
            matrix.makeRotationZ(this.state.rotation - Math.PI / 2)
            matrix.setPosition(this.state.position.x, this.state.position.y, this.state.position.z + 0.3)
            this.model.container.matrix.copy(matrix)
            this.model.container.matrixAutoUpdate = false
            this.model.container.updateMatrixWorld(true)

            // Animate wheels
            if(this.model.wheels)
            {
                const wheelRotation = this.time.elapsed * 0.005
                for(const wheel of this.model.wheels)
                {
                    wheel.rotation.x = wheelRotation
                }
            }
        }

        // Update trail
        if(this.settings.showTrail && this.trail)
        {
            // Shift trail points
            for(let i = this.trail.maxPoints - 1; i > 0; i--)
            {
                this.trail.points[i].copy(this.trail.points[i - 1])
            }
            this.trail.points[0].copy(this.state.position)

            // Update trail geometry
            const positions = this.trail.mesh.geometry.attributes.position.array
            for(let i = 0; i < this.trail.maxPoints; i++)
            {
                positions[i * 3] = this.trail.points[i].x
                positions[i * 3 + 1] = this.trail.points[i].y
                positions[i * 3 + 2] = this.trail.points[i].z + 0.2
            }
            this.trail.mesh.geometry.attributes.position.needsUpdate = true
        }
    }

    resetToStart()
    {
        this.state.currentPathIndex = 0
        this.state.currentWaypointIndex = 0
        this.state.isMoving = true
        this.state.pauseTime = 0
        const firstWaypoint = this.tourPaths[0].waypoints[0]
        this.state.position.set(firstWaypoint.x, firstWaypoint.y, firstWaypoint.z)
        console.log('👻 Ghost car reset to start')
    }
}
