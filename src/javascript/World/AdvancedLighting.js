import * as THREE from 'three'

/**
 * Virtual lighting rig.
 *
 * Every object in the world uses matcap ShaderMaterials which ignore real
 * Three.js lights, so instead of THREE.SpotLight/AmbientLight this drives
 * shared shader uniforms: a fake spotlight (cone falloff computed in the
 * matcap fragment shader) plus a light pool projected on the ground in the
 * background shader. The ambient/directional "lights" are kept as plain
 * data objects consumed by the DayNightCycle.
 */
export default class AdvancedLighting
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.scene = _options.scene
        this.car = _options.car
        this.physics = _options.physics
        this.materials = _options.materials
        this.floor = _options.floor
        this.camera = _options.camera
        this.config = _options.config
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.spotlightEnabled = true
        this.settings.spotlightIntensity = 1.5
        this.settings.spotlightDistance = 30
        this.settings.spotlightAngle = Math.PI * 0.25
        this.settings.spotlightPenumbra = 0.3
        this.settings.spotlightColor = '#ffffff'
        this.settings.spotlightHeight = 6
        this.settings.spotlightOffsetForward = 2
        this.settings.floorPoolStrength = 0.16
        this.settings.headlightConesEnabled = false
        this.settings.headlightConesAutoNight = true
        this.settings.ambientIntensity = 0.4
        this.settings.ambientColor = '#6B7F3F'
        this.settings.directionalIntensity = 0.6
        this.settings.directionalColor = '#ffffff'

        // Dynamic lighting settings
        this.settings.dynamicEnabled = true
        this.settings.speedColorShift = true
        this.settings.driftEffect = true

        // How much of the day/night cycle is "night" right now (written by DayNightCycle)
        this.nightFactor = 0

        // Dynamic state
        this.dynamicState = {
            speedFactor: 0,
            driftFactor: 0
        }

        // Spotlight intensity is smoothed over time so it never flickers
        this.smoothedIntensity = 0

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
        this.spotWorldPosition = new THREE.Vector3()
        this.spotTargetPosition = new THREE.Vector3()
        this.spotDirection = new THREE.Vector3()
        this.cameraWorldPosition = new THREE.Vector3()

        this.baseColor = new THREE.Color(1, 1, 1)
        this.speedColor = new THREE.Color(0.7, 0.9, 1.0)
        this.driftColor = new THREE.Color(1.0, 0.6, 0.3)
        this.flashColor = new THREE.Color(1.75, 1.8, 2.0)
        this.finalSpotColor = new THREE.Color(1, 1, 1)

        this.setVirtualLights()
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

            const spotlightFolder = this.debugFolder.addFolder('spotlight')
            spotlightFolder.open()
            spotlightFolder.add(this.settings, 'spotlightEnabled').name('enabled')
            spotlightFolder.add(this.settings, 'spotlightIntensity').min(0).max(5).step(0.1).name('intensity').listen()
            spotlightFolder.add(this.settings, 'spotlightDistance').min(5).max(50).step(1).name('distance')
            spotlightFolder.add(this.settings, 'spotlightAngle').min(0).max(Math.PI * 0.5).step(0.01).name('angle')
            spotlightFolder.add(this.settings, 'spotlightPenumbra').min(0).max(1).step(0.1).name('penumbra')
            spotlightFolder.add(this.settings, 'spotlightHeight').min(3).max(20).step(0.5).name('height')
            spotlightFolder.add(this.settings, 'spotlightOffsetForward').min(- 5).max(10).step(0.5).name('offsetForward')
            spotlightFolder.add(this.settings, 'floorPoolStrength').min(0).max(1).step(0.01).name('floorPool')
            spotlightFolder.add(this, 'nightFactor').min(0).max(1).step(0.01).name('nightFactor').listen()

            const conesFolder = this.debugFolder.addFolder('headlightCones')
            conesFolder.add(this.settings, 'headlightConesEnabled').name('alwaysOn')
            conesFolder.add(this.settings, 'headlightConesAutoNight').name('autoAtNight')
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

    setVirtualLights()
    {
        // Plain data objects: the DayNightCycle writes to these, the matcap night
        // tint and spotlight uniforms are what actually reach the screen
        this.ambientLight = {
            color: new THREE.Color(this.settings.ambientColor),
            intensity: this.settings.ambientIntensity
        }

        this.directionalLight = {
            color: new THREE.Color(this.settings.directionalColor),
            intensity: this.settings.directionalIntensity
        }

        this.spotlight = {
            color: new THREE.Color(this.settings.spotlightColor)
        }
    }

    setHeadlightCones()
    {
        this.headlightCones = {}
        this.headlightCones.group = new THREE.Group()

        // Apex at the origin, body extending along +Z so lookAt() aims the beam
        // at the target (lookAt points local +Z toward the target)
        const geometry = new THREE.ConeGeometry(0.95, 6.5, 18, 1, true)
        geometry.translate(0, - 3.25, 0)
        geometry.rotateX(- Math.PI * 0.5)

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
        this.headlightCones.group.visible = false

        this.container.add(this.headlightCones.group)
    }

    update()
    {
        // The physics body lives on physics.car (world.car.chassis only has the visual object)
        const chassisBody = this.physics && this.physics.car && this.physics.car.chassis ? this.physics.car.chassis.body : null
        if(!chassisBody || !this.settings.spotlightEnabled)
        {
            return
        }

        const lightUniforms = this.materials && this.materials.shades ? this.materials.shades.lightUniforms : null
        if(!lightUniforms)
        {
            return
        }

        const carPosition = chassisBody.position
        const carQuaternion = chassisBody.quaternion
        const carVelocity = chassisBody.velocity
        const carSpeed = Math.abs(this.physics.car.speed)

        this.tempQuaternion.set(carQuaternion.x, carQuaternion.y, carQuaternion.z, carQuaternion.w)
        this.forwardVector.set(1, 0, 0).applyQuaternion(this.tempQuaternion).normalize()
        this.sideVector.crossVectors(this.upVector, this.forwardVector).normalize()

        // Speed factor (0 to 1) — car speed is in units/ms, boost max ≈ 0.017
        this.dynamicState.speedFactor = Math.min(carSpeed * 70, 1)

        // Drift detection: lateral share of the velocity (sin of the slip angle),
        // which grows linearly with slip instead of quadratically
        this.velocityVector.set(carVelocity.x, carVelocity.y, 0)
        const velocityLength = this.velocityVector.length()
        if(velocityLength > 0.0001 && carSpeed > 0.004)
        {
            this.velocityVector.multiplyScalar(1 / velocityLength)
            this.flatForwardVector.set(this.forwardVector.x, this.forwardVector.y, 0).normalize()
            const lateral = this.velocityVector.x * this.flatForwardVector.y - this.velocityVector.y * this.flatForwardVector.x
            this.dynamicState.driftFactor = Math.min(Math.abs(lateral) * 2.2, 1)
        }
        else
        {
            this.dynamicState.driftFactor = 0
        }

        // Dynamic spotlight placement
        const dynamicHeight = this.settings.spotlightHeight - (this.dynamicState.speedFactor * 2)
        const dynamicOffset = this.settings.spotlightOffsetForward + (this.dynamicState.speedFactor * 3)

        this.spotWorldPosition.set(
            carPosition.x + this.forwardVector.x * dynamicOffset,
            carPosition.y + this.forwardVector.y * dynamicOffset,
            carPosition.z + dynamicHeight
        )

        this.spotTargetPosition.set(
            carPosition.x + this.forwardVector.x * (2 + this.dynamicState.speedFactor * 2),
            carPosition.y + this.forwardVector.y * (2 + this.dynamicState.speedFactor * 2),
            carPosition.z
        )

        this.spotDirection.subVectors(this.spotTargetPosition, this.spotWorldPosition).normalize()

        // Dynamic intensity (kept gentle and smoothed below so the light never flickers)
        let intensityMultiplier = 1.0
        intensityMultiplier += this.dynamicState.speedFactor * 0.25

        if(this.settings.driftEffect)
        {
            intensityMultiplier += this.dynamicState.driftFactor * 0.25
        }

        intensityMultiplier *= this.weatherState.spotlightBoost
        intensityMultiplier += this.weatherState.flash * 0.3

        // Subtle during the day, strong at night
        const nightBlend = 0.12 + this.nightFactor * 0.88
        const targetIntensity = this.settings.spotlightIntensity * intensityMultiplier * nightBlend

        // Heavy smoothing: intensity drifts toward its target instead of jumping
        this.smoothedIntensity += (targetIntensity - this.smoothedIntensity) * Math.min(this.time.delta / 400, 1)
        const effectiveIntensity = this.smoothedIntensity

        // Dynamic color (base color comes from the day/night cycle)
        this.finalSpotColor.copy(this.spotlight.color)

        if(this.settings.speedColorShift && this.settings.dynamicEnabled)
        {
            this.finalSpotColor.lerp(this.speedColor, this.dynamicState.speedFactor * 0.3)

            if(this.dynamicState.driftFactor > 0.3)
            {
                this.finalSpotColor.lerp(this.driftColor, this.dynamicState.driftFactor * 0.6)
            }

            if(this.weatherState.flash > 0.05)
            {
                this.finalSpotColor.lerp(this.flashColor, this.weatherState.flash * 0.7)
            }
        }

        // Widen cone while drifting
        const dynamicAngle = this.settings.spotlightAngle + (this.dynamicState.driftFactor * 0.3)
        const penumbraAngle = dynamicAngle * (1 - this.settings.spotlightPenumbra)

        // Push everything into the shared matcap uniforms
        lightUniforms.uSpotPosition.value.copy(this.spotWorldPosition)
        lightUniforms.uSpotDirection.value.copy(this.spotDirection)
        lightUniforms.uSpotColor.value.copy(this.finalSpotColor)
        lightUniforms.uSpotIntensity.value = effectiveIntensity
        lightUniforms.uSpotAngleCos.value = Math.cos(dynamicAngle)
        lightUniforms.uSpotPenumbraCos.value = Math.cos(penumbraAngle)
        lightUniforms.uSpotDistance.value = this.settings.spotlightDistance

        // And into the floor light pool
        if(this.floor && this.floor.material && this.camera)
        {
            const floorUniforms = this.floor.material.uniforms
            const cameraInstance = this.camera.instance

            this.cameraWorldPosition.setFromMatrixPosition(cameraInstance.matrixWorld)
            floorUniforms.uCameraPosition.value.copy(this.cameraWorldPosition)
            floorUniforms.uInverseViewProjection.value.multiplyMatrices(cameraInstance.matrixWorld, cameraInstance.projectionMatrixInverse)

            floorUniforms.uSpotPosition.value.set(this.spotTargetPosition.x, this.spotTargetPosition.y)
            floorUniforms.uSpotColor.value.copy(this.finalSpotColor)
            // The ground pool only exists at night (daytime pools read as a glitchy flash)
            floorUniforms.uSpotIntensity.value = effectiveIntensity * this.settings.floorPoolStrength * this.nightFactor
            floorUniforms.uSpotRadius.value = Math.tan(dynamicAngle) * dynamicHeight + 2
        }

        this.updateHeadlightCones(carPosition)
    }

    updateHeadlightCones(_carPosition)
    {
        if(!this.headlightCones)
        {
            return
        }

        // Cones show when forced on, or automatically once night falls
        const autoNight = this.settings.headlightConesAutoNight && this.nightFactor > 0.4
        const visible = this.settings.headlightConesEnabled || autoNight
        this.headlightCones.group.visible = visible

        if(!visible)
        {
            return
        }

        const nightOpacity = this.settings.headlightConesEnabled ? 1 : Math.min((this.nightFactor - 0.4) / 0.35, 1)
        const coneLengthScale = 0.95 + this.dynamicState.speedFactor * 1.35 + this.weatherState.fogDensity * 40
        const coneOpacity = (0.12 + this.dynamicState.speedFactor * 0.08 + this.weatherState.wetness * 0.1) * nightOpacity

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
        left.scale.set(1, 1, coneLengthScale)
        left.material.opacity = coneOpacity

        const right = this.headlightCones.right
        right.position.set(
            _carPosition.x + this.forwardVector.x * frontOffset - this.sideVector.x * sideOffset,
            _carPosition.y + this.forwardVector.y * frontOffset - this.sideVector.y * sideOffset,
            _carPosition.z + zOffset
        )
        right.lookAt(this.lookTarget)
        right.scale.set(1, 1, coneLengthScale)
        right.material.opacity = coneOpacity
    }
}
