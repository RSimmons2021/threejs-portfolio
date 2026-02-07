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
        this.settings.headlightConesEnabled = false
        this.settings.ambientIntensity = 0.4
        this.settings.ambientColor = '#6B7F3F'
        this.settings.directionalIntensity = 0.6
        this.settings.directionalColor = '#ffffff'
        this.settings.directionalShadows = false
        this.settings.spotlightShadows = true

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

        this.weatherState = {
            spotlightBoost: 1,
            ambientBoost: 1,
            fogDensity: 0,
            wetness: 0,
            flash: 0
        }

        // Reusable temp objects to reduce per-frame allocations
        this.forwardVector = new THREE.Vector3(1, 0, 0)
        this.sideVector = new THREE.Vector3()
        this.velocityVector = new THREE.Vector3()
        this.flatForwardVector = new THREE.Vector3()
        this.tempQuaternion = new THREE.Quaternion()
        this.upVector = new THREE.Vector3(0, 0, 1)
        this.lookTarget = new THREE.Vector3()

        this.baseColor = new THREE.Color(1, 1, 1)
        this.speedColor = new THREE.Color(0.7, 0.9, 1.0)
        this.driftColor = new THREE.Color(1.0, 0.6, 0.3)
        this.collisionColor = new THREE.Color(1.5, 1.5, 1.5)
        this.flashColor = new THREE.Color(1.75, 1.8, 2.0)
        this.finalSpotColor = new THREE.Color(1, 1, 1)

        this.setAmbientLight()
        this.setDirectionalLight()
        this.setSpotlight()
        this.setHeadlightCones()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('advancedLighting')
            this.debugFolder.open()

            const dynamicFolder = this.debugFolder.addFolder('dynamicEffects')
            dynamicFolder.open()
            dynamicFolder.add(this.settings, 'dynamicEnabled').name('enabled')
            dynamicFolder.add(this.settings, 'speedColorShift').name('speedColorShift')
            dynamicFolder.add(this.settings, 'driftEffect').name('driftEffect')
            dynamicFolder.add(this.settings, 'pulseEffect').name('pulseEffect')
            dynamicFolder.add(this.settings, 'collisionFlash').name('collisionFlash')

            const spotlightFolder = this.debugFolder.addFolder('spotlight')
            spotlightFolder.add(this.settings, 'spotlightEnabled').name('enabled').onChange((value) =>
            {
                this.spotlight.visible = value
                if(this.headlightCones && this.headlightCones.group)
                {
                    this.headlightCones.group.visible = value && this.settings.headlightConesEnabled
                }
            })
            spotlightFolder.add(this.settings, 'spotlightIntensity').min(0).max(5).step(0.1).name('intensity').onChange((value) =>
            {
                this.spotlight.intensity = value
            })
            spotlightFolder.add(this.settings, 'spotlightDistance').min(5).max(50).step(1).name('distance').onChange((value) =>
            {
                this.spotlight.distance = value
            })
            spotlightFolder.add(this.settings, 'spotlightAngle').min(0).max(Math.PI * 0.5).step(0.01).name('angle').onChange((value) =>
            {
                this.spotlight.angle = value
            })
            spotlightFolder.add(this.settings, 'spotlightPenumbra').min(0).max(1).step(0.1).name('penumbra').onChange((value) =>
            {
                this.spotlight.penumbra = value
            })
            spotlightFolder.add(this.settings, 'spotlightHeight').min(3).max(20).step(0.5).name('height')
            spotlightFolder.add(this.settings, 'spotlightOffsetForward').min(-5).max(10).step(0.5).name('offsetForward')
            spotlightFolder.addColor(this.settings, 'spotlightColor').name('color').onChange((value) =>
            {
                this.spotlight.color.set(value)
            })

            const ambientFolder = this.debugFolder.addFolder('ambient')
            ambientFolder.add(this.settings, 'ambientIntensity').min(0).max(2).step(0.1).name('intensity').onChange((value) =>
            {
                this.ambientLight.intensity = value
            })
            ambientFolder.addColor(this.settings, 'ambientColor').name('color').onChange((value) =>
            {
                this.ambientLight.color.set(value)
            })

            const directionalFolder = this.debugFolder.addFolder('directional')
            directionalFolder.add(this.settings, 'directionalIntensity').min(0).max(2).step(0.1).name('intensity').onChange((value) =>
            {
                this.directionalLight.intensity = value
            })
            directionalFolder.addColor(this.settings, 'directionalColor').name('color').onChange((value) =>
            {
                this.directionalLight.color.set(value)
            })
        }
    }

    setWeatherState(_state = {})
    {
        if(typeof _state.spotlightBoost === 'number') this.weatherState.spotlightBoost = _state.spotlightBoost
        if(typeof _state.ambientBoost === 'number') this.weatherState.ambientBoost = _state.ambientBoost
        if(typeof _state.fogDensity === 'number') this.weatherState.fogDensity = _state.fogDensity
        if(typeof _state.wetness === 'number') this.weatherState.wetness = _state.wetness
        if(typeof _state.flash === 'number') this.weatherState.flash = _state.flash
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
        this.directionalLight.castShadow = this.settings.directionalShadows
        this.container.add(this.directionalLight)
    }

    setSpotlight()
    {
        this.spotlight = new THREE.SpotLight(
            this.settings.spotlightColor,
            this.settings.spotlightIntensity,
            this.settings.spotlightDistance,
            this.settings.spotlightAngle,
            this.settings.spotlightPenumbra,
            1
        )

        this.spotlight.position.set(0, 0, this.settings.spotlightHeight)
        this.spotlight.castShadow = this.settings.spotlightShadows

        if(this.settings.spotlightShadows)
        {
            this.spotlight.shadow.mapSize.width = 1024
            this.spotlight.shadow.mapSize.height = 1024
            this.spotlight.shadow.camera.near = 0.35
            this.spotlight.shadow.camera.far = this.settings.spotlightDistance
            this.spotlight.shadow.camera.fov = 48
            this.spotlight.shadow.bias = -0.00015
        }

        this.spotlightTarget = new THREE.Object3D()
        this.spotlightTarget.position.set(0, 0, 0)
        this.spotlight.target = this.spotlightTarget

        this.container.add(this.spotlight)
        this.container.add(this.spotlightTarget)

        if(this.debug)
        {
            this.spotlightHelper = new THREE.SpotLightHelper(this.spotlight)
            this.container.add(this.spotlightHelper)
        }
    }

    setHeadlightCones()
    {
        this.headlightCones = {}
        this.headlightCones.group = new THREE.Group()

        const geometry = new THREE.ConeGeometry(0.95, 6.5, 18, 1, true)
        geometry.translate(0, -3.25, 0)
        geometry.rotateX(Math.PI * 0.5)

        const material = new THREE.MeshBasicMaterial({
            color: '#cfe5ff',
            transparent: true,
            opacity: 0.18,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        })

        this.headlightCones.left = new THREE.Mesh(geometry, material.clone())
        this.headlightCones.right = new THREE.Mesh(geometry, material.clone())
        this.headlightCones.group.add(this.headlightCones.left)
        this.headlightCones.group.add(this.headlightCones.right)
        this.headlightCones.group.visible = this.settings.headlightConesEnabled

        this.container.add(this.headlightCones.group)
    }

    update()
    {
        if(!this.car || !this.car.chassis || !this.car.chassis.body || !this.settings.spotlightEnabled)
        {
            return
        }

        const carPosition = this.car.chassis.body.position
        const carQuaternion = this.car.chassis.body.quaternion
        const carVelocity = this.car.chassis.body.velocity
        const carSpeed = Math.abs(this.physics.car.speed)

        this.tempQuaternion.set(carQuaternion.x, carQuaternion.y, carQuaternion.z, carQuaternion.w)
        this.forwardVector.set(1, 0, 0).applyQuaternion(this.tempQuaternion).normalize()
        this.sideVector.crossVectors(this.upVector, this.forwardVector).normalize()

        // Speed factor (0 to 1)
        this.dynamicState.speedFactor = Math.min(carSpeed * 15, 1)

        // Drift detection
        this.velocityVector.set(carVelocity.x, carVelocity.y, 0)
        const velocityLength = this.velocityVector.length()
        if(velocityLength > 0.0001 && carSpeed > 0.02)
        {
            this.velocityVector.multiplyScalar(1 / velocityLength)
            this.flatForwardVector.set(this.forwardVector.x, this.forwardVector.y, 0).normalize()
            const alignment = this.velocityVector.dot(this.flatForwardVector)
            this.dynamicState.driftFactor = Math.max(0, 1 - Math.abs(alignment))
        }
        else
        {
            this.dynamicState.driftFactor = 0
        }

        // Acceleration detection for collision flash
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
            this.dynamicState.collisionIntensity *= 0.9
        }
        this.dynamicState.previousVelocity = { x: carVelocity.x, y: carVelocity.y, z: carVelocity.z }

        this.dynamicState.pulseTime += this.time.delta * 0.001
        const pulseValue = this.settings.pulseEffect ? Math.sin(this.dynamicState.pulseTime * 2) * 0.5 + 0.5 : 0.5

        // Dynamic spotlight placement
        const dynamicHeight = this.settings.spotlightHeight - (this.dynamicState.speedFactor * 2)
        const dynamicOffset = this.settings.spotlightOffsetForward + (this.dynamicState.speedFactor * 3)

        this.spotlight.position.set(
            carPosition.x + this.forwardVector.x * dynamicOffset,
            carPosition.y + this.forwardVector.y * dynamicOffset,
            carPosition.z + dynamicHeight
        )

        this.spotlightTarget.position.set(
            carPosition.x + this.forwardVector.x * (2 + this.dynamicState.speedFactor * 2),
            carPosition.y + this.forwardVector.y * (2 + this.dynamicState.speedFactor * 2),
            carPosition.z
        )

        // Dynamic intensity
        let intensityMultiplier = 1.0
        intensityMultiplier += this.dynamicState.speedFactor * 0.5

        if(this.settings.driftEffect)
        {
            intensityMultiplier += this.dynamicState.driftFactor * 0.8
        }

        intensityMultiplier += this.dynamicState.collisionIntensity * 1.5
        intensityMultiplier *= (0.95 + pulseValue * 0.05)
        intensityMultiplier *= this.weatherState.spotlightBoost
        intensityMultiplier += this.weatherState.flash * 0.3

        this.spotlight.intensity = this.settings.spotlightIntensity * intensityMultiplier

        // Dynamic color
        if(this.settings.speedColorShift && this.settings.dynamicEnabled)
        {
            this.finalSpotColor.copy(this.baseColor)
            this.finalSpotColor.lerp(this.speedColor, this.dynamicState.speedFactor * 0.3)

            if(this.dynamicState.driftFactor > 0.3)
            {
                this.finalSpotColor.lerp(this.driftColor, this.dynamicState.driftFactor * 0.6)
            }

            if(this.dynamicState.collisionIntensity > 0.1)
            {
                this.finalSpotColor.lerp(this.collisionColor, this.dynamicState.collisionIntensity * 0.8)
            }

            if(this.weatherState.flash > 0.05)
            {
                this.finalSpotColor.lerp(this.flashColor, this.weatherState.flash * 0.7)
            }

            this.spotlight.color.copy(this.finalSpotColor)
        }

        // Widen cone while drifting
        const baseAngle = this.settings.spotlightAngle
        const dynamicAngle = baseAngle + (this.dynamicState.driftFactor * 0.3)
        this.spotlight.angle = dynamicAngle

        // Ambient dynamics
        if(this.settings.dynamicEnabled)
        {
            const ambientMultiplier = (1.0 + (this.dynamicState.speedFactor * 0.2) + (pulseValue * 0.05)) * this.weatherState.ambientBoost
            this.ambientLight.intensity = this.settings.ambientIntensity * ambientMultiplier + this.weatherState.flash * 0.08
        }

        // Keep shadows focused around the active zone
        if(this.spotlight.castShadow)
        {
            this.spotlight.shadow.camera.far = this.settings.spotlightDistance + this.dynamicState.speedFactor * 8
            this.spotlight.shadow.camera.updateProjectionMatrix()
        }

        this.updateHeadlightCones(carPosition)

        if(this.spotlightHelper)
        {
            this.spotlightHelper.update()
        }
    }

    updateHeadlightCones(_carPosition)
    {
        if(!this.settings.headlightConesEnabled || !this.headlightCones || !this.headlightCones.group.visible)
        {
            return
        }

        const coneLengthScale = 0.95 + this.dynamicState.speedFactor * 1.35 + this.weatherState.fogDensity * 40
        const coneOpacity = 0.12 + this.dynamicState.speedFactor * 0.08 + this.weatherState.wetness * 0.1

        const frontOffset = 1.25
        const sideOffset = 0.42
        const zOffset = 0.32

        this.lookTarget.set(
            _carPosition.x + this.forwardVector.x * 8,
            _carPosition.y + this.forwardVector.y * 8,
            _carPosition.z + 0.05
        )

        const left = this.headlightCones.left
        left.position.set(
            _carPosition.x + this.forwardVector.x * frontOffset + this.sideVector.x * sideOffset,
            _carPosition.y + this.forwardVector.y * frontOffset + this.sideVector.y * sideOffset,
            _carPosition.z + zOffset
        )
        left.lookAt(this.lookTarget)
        left.scale.set(1, coneLengthScale, 1)
        left.material.opacity = coneOpacity

        const right = this.headlightCones.right
        right.position.set(
            _carPosition.x + this.forwardVector.x * frontOffset - this.sideVector.x * sideOffset,
            _carPosition.y + this.forwardVector.y * frontOffset - this.sideVector.y * sideOffset,
            _carPosition.z + zOffset
        )
        right.lookAt(this.lookTarget)
        right.scale.set(1, coneLengthScale, 1)
        right.material.opacity = coneOpacity
    }
}
