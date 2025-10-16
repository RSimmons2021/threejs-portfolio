import * as THREE from 'three'

export default class AdvancedLighting
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.scene = _options.scene
        this.car = _options.car
        this.physics = _options.physics
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.spotlightEnabled = true
        this.settings.spotlightIntensity = 3.0
        this.settings.spotlightDistance = 30
        this.settings.spotlightAngle = Math.PI * 0.25
        this.settings.spotlightPenumbra = 0.3
        this.settings.spotlightColor = '#ffffff'
        this.settings.spotlightHeight = 6
        this.settings.spotlightOffsetForward = 2
        this.settings.ambientIntensity = 0.4
        this.settings.ambientColor = '#6B7F3F' // Olive green
        this.settings.directionalIntensity = 0.6
        this.settings.directionalColor = '#ffffff'
        this.settings.dynamicShadows = false

        // Dynamic lighting settings
        this.settings.dynamicEnabled = true
        this.settings.speedColorShift = true
        this.settings.driftEffect = true
        this.settings.pulseEffect = true
        this.settings.collisionFlash = true

        // Dynamic state
        this.dynamicState = {
            speedFactor: 0,
            driftFactor: 0,
            pulseTime: 0,
            collisionIntensity: 0,
            previousVelocity: { x: 0, y: 0, z: 0 }
        }

        this.setAmbientLight()
        this.setDirectionalLight()
        this.setSpotlight()

        console.log('💡 Dynamic lighting initialized - Speed shifts, drift detection, collision flashes enabled!')

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('advancedLighting')
            this.debugFolder.open() // Open by default to see dynamic effects

            // Dynamic effects controls
            const dynamicFolder = this.debugFolder.addFolder('dynamicEffects')
            dynamicFolder.open()
            dynamicFolder.add(this.settings, 'dynamicEnabled').name('enabled')
            dynamicFolder.add(this.settings, 'speedColorShift').name('speedColorShift')
            dynamicFolder.add(this.settings, 'driftEffect').name('driftEffect')
            dynamicFolder.add(this.settings, 'pulseEffect').name('pulseEffect')
            dynamicFolder.add(this.settings, 'collisionFlash').name('collisionFlash')

            // Spotlight controls
            const spotlightFolder = this.debugFolder.addFolder('spotlight')
            spotlightFolder.add(this.settings, 'spotlightEnabled').name('enabled').onChange((value) => {
                this.spotlight.visible = value
            })
            spotlightFolder.add(this.settings, 'spotlightIntensity').min(0).max(5).step(0.1).name('intensity').onChange((value) => {
                this.spotlight.intensity = value
            })
            spotlightFolder.add(this.settings, 'spotlightDistance').min(5).max(50).step(1).name('distance').onChange((value) => {
                this.spotlight.distance = value
            })
            spotlightFolder.add(this.settings, 'spotlightAngle').min(0).max(Math.PI * 0.5).step(0.01).name('angle').onChange((value) => {
                this.spotlight.angle = value
            })
            spotlightFolder.add(this.settings, 'spotlightPenumbra').min(0).max(1).step(0.1).name('penumbra').onChange((value) => {
                this.spotlight.penumbra = value
            })
            spotlightFolder.add(this.settings, 'spotlightHeight').min(3).max(20).step(0.5).name('height')
            spotlightFolder.add(this.settings, 'spotlightOffsetForward').min(-5).max(10).step(0.5).name('offsetForward')
            spotlightFolder.addColor(this.settings, 'spotlightColor').name('color').onChange((value) => {
                this.spotlight.color.set(value)
            })

            // Ambient controls
            const ambientFolder = this.debugFolder.addFolder('ambient')
            ambientFolder.add(this.settings, 'ambientIntensity').min(0).max(2).step(0.1).name('intensity').onChange((value) => {
                this.ambientLight.intensity = value
            })
            ambientFolder.addColor(this.settings, 'ambientColor').name('color').onChange((value) => {
                this.ambientLight.color.set(value)
            })

            // Directional controls
            const directionalFolder = this.debugFolder.addFolder('directional')
            directionalFolder.add(this.settings, 'directionalIntensity').min(0).max(2).step(0.1).name('intensity').onChange((value) => {
                this.directionalLight.intensity = value
            })
            directionalFolder.addColor(this.settings, 'directionalColor').name('color').onChange((value) => {
                this.directionalLight.color.set(value)
            })
        }
    }

    setAmbientLight()
    {
        this.ambientLight = new THREE.AmbientLight(
            this.settings.ambientColor,
            this.settings.ambientIntensity
        )
        this.container.add(this.ambientLight)
    }

    setDirectionalLight()
    {
        this.directionalLight = new THREE.DirectionalLight(
            this.settings.directionalColor,
            this.settings.directionalIntensity
        )
        this.directionalLight.position.set(10, 10, 15)
        this.directionalLight.castShadow = this.settings.dynamicShadows

        // Configure shadow properties
        if(this.settings.dynamicShadows)
        {
            this.directionalLight.shadow.mapSize.width = 1024
            this.directionalLight.shadow.mapSize.height = 1024
            this.directionalLight.shadow.camera.near = 0.5
            this.directionalLight.shadow.camera.far = 50
            this.directionalLight.shadow.camera.left = -20
            this.directionalLight.shadow.camera.right = 20
            this.directionalLight.shadow.camera.top = 20
            this.directionalLight.shadow.camera.bottom = -20
        }

        this.container.add(this.directionalLight)
    }

    setSpotlight()
    {
        // Create spotlight
        this.spotlight = new THREE.SpotLight(
            this.settings.spotlightColor,
            this.settings.spotlightIntensity,
            this.settings.spotlightDistance,
            this.settings.spotlightAngle,
            this.settings.spotlightPenumbra,
            1 // decay
        )

        this.spotlight.position.set(0, 0, this.settings.spotlightHeight)
        this.spotlight.castShadow = this.settings.dynamicShadows

        // Configure shadow properties for spotlight
        if(this.settings.dynamicShadows)
        {
            this.spotlight.shadow.mapSize.width = 1024
            this.spotlight.shadow.mapSize.height = 1024
            this.spotlight.shadow.camera.near = 0.5
            this.spotlight.shadow.camera.far = this.settings.spotlightDistance
            this.spotlight.shadow.camera.fov = 50
        }

        // Create target object for spotlight
        this.spotlightTarget = new THREE.Object3D()
        this.spotlightTarget.position.set(0, 0, 0)
        this.spotlight.target = this.spotlightTarget

        this.container.add(this.spotlight)
        this.container.add(this.spotlightTarget)

        // Debug helper
        if(this.debug)
        {
            this.spotlightHelper = new THREE.SpotLightHelper(this.spotlight)
            this.container.add(this.spotlightHelper)
        }
    }

    update()
    {
        if(!this.car || !this.car.chassis || !this.car.chassis.body || !this.settings.spotlightEnabled) return

        // Get car data
        const carPosition = this.car.chassis.body.position
        const carQuaternion = this.car.chassis.body.quaternion
        const carVelocity = this.car.chassis.body.velocity
        const carSpeed = Math.abs(this.physics.car.speed)

        // Calculate forward direction from car orientation
        const forward = new THREE.Vector3(1, 0, 0)
        forward.applyQuaternion(new THREE.Quaternion(
            carQuaternion.x,
            carQuaternion.y,
            carQuaternion.z,
            carQuaternion.w
        ))

        // === DYNAMIC CALCULATIONS ===

        // 1. Speed factor (0 to 1)
        this.dynamicState.speedFactor = Math.min(carSpeed * 15, 1)

        // 2. Drift detection - compare velocity direction with car forward direction
        const velocityDir = new THREE.Vector3(carVelocity.x, carVelocity.y, 0).normalize()
        const forwardDir = new THREE.Vector2(forward.x, forward.y).normalize()
        const velocityDir2D = new THREE.Vector2(velocityDir.x, velocityDir.y)
        const alignment = velocityDir2D.dot(forwardDir)
        this.dynamicState.driftFactor = carSpeed > 0.02 ? Math.max(0, 1 - Math.abs(alignment)) : 0

        // 3. Acceleration detection (for collision flash)
        const accelMagnitude = Math.sqrt(
            Math.pow(carVelocity.x - this.dynamicState.previousVelocity.x, 2) +
            Math.pow(carVelocity.y - this.dynamicState.previousVelocity.y, 2) +
            Math.pow(carVelocity.z - this.dynamicState.previousVelocity.z, 2)
        )
        if(accelMagnitude > 0.5 && this.settings.collisionFlash)
        {
            this.dynamicState.collisionIntensity = Math.min(accelMagnitude * 0.3, 1)
        }
        else
        {
            this.dynamicState.collisionIntensity *= 0.9 // Decay
        }
        this.dynamicState.previousVelocity = { x: carVelocity.x, y: carVelocity.y, z: carVelocity.z }

        // 4. Pulse effect
        this.dynamicState.pulseTime += this.time.delta * 0.001
        const pulseValue = this.settings.pulseEffect ? Math.sin(this.dynamicState.pulseTime * 2) * 0.5 + 0.5 : 0.5

        // === SPOTLIGHT POSITIONING ===

        // Dynamic height based on speed (lower when going fast)
        const dynamicHeight = this.settings.spotlightHeight - (this.dynamicState.speedFactor * 2)

        // Dynamic forward offset (moves ahead when going fast)
        const dynamicOffset = this.settings.spotlightOffsetForward + (this.dynamicState.speedFactor * 3)

        this.spotlight.position.set(
            carPosition.x + forward.x * dynamicOffset,
            carPosition.y + forward.y * dynamicOffset,
            carPosition.z + dynamicHeight
        )

        this.spotlightTarget.position.set(
            carPosition.x + forward.x * (2 + this.dynamicState.speedFactor * 2),
            carPosition.y + forward.y * (2 + this.dynamicState.speedFactor * 2),
            carPosition.z
        )

        // === DYNAMIC INTENSITY ===

        let intensityMultiplier = 1.0

        // Speed boost
        intensityMultiplier += this.dynamicState.speedFactor * 0.5

        // Drift boost
        if(this.settings.driftEffect)
        {
            intensityMultiplier += this.dynamicState.driftFactor * 0.8
        }

        // Collision flash
        intensityMultiplier += this.dynamicState.collisionIntensity * 1.5

        // Subtle pulse
        intensityMultiplier *= (0.95 + pulseValue * 0.05)

        this.spotlight.intensity = this.settings.spotlightIntensity * intensityMultiplier

        // === DYNAMIC COLOR ===

        if(this.settings.speedColorShift && this.settings.dynamicEnabled)
        {
            // Base color (white/warm)
            const baseColor = new THREE.Color(1, 1, 1)

            // Speed color (cool blue)
            const speedColor = new THREE.Color(0.7, 0.9, 1.0)

            // Drift color (orange/red)
            const driftColor = new THREE.Color(1.0, 0.6, 0.3)

            // Collision flash (bright white)
            const collisionColor = new THREE.Color(1.5, 1.5, 1.5)

            // Blend colors based on state
            let finalColor = baseColor.clone()

            // Apply speed tint
            finalColor.lerp(speedColor, this.dynamicState.speedFactor * 0.3)

            // Apply drift tint (overrides speed)
            if(this.dynamicState.driftFactor > 0.3)
            {
                finalColor.lerp(driftColor, this.dynamicState.driftFactor * 0.6)
            }

            // Apply collision flash
            if(this.dynamicState.collisionIntensity > 0.1)
            {
                finalColor.lerp(collisionColor, this.dynamicState.collisionIntensity * 0.8)
            }

            this.spotlight.color.copy(finalColor)
        }

        // === DYNAMIC ANGLE ===

        // Widen angle when drifting
        const baseAngle = this.settings.spotlightAngle
        const dynamicAngle = baseAngle + (this.dynamicState.driftFactor * 0.3)
        this.spotlight.angle = dynamicAngle

        // === AMBIENT LIGHT DYNAMICS ===

        if(this.settings.dynamicEnabled)
        {
            // Ambient pulses slightly with speed
            const ambientMultiplier = 1.0 + (this.dynamicState.speedFactor * 0.2) + (pulseValue * 0.05)
            this.ambientLight.intensity = this.settings.ambientIntensity * ambientMultiplier
        }

        // Update spotlight helper if exists
        if(this.spotlightHelper)
        {
            this.spotlightHelper.update()
        }
    }
}
