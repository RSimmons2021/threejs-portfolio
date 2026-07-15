import * as THREE from 'three'

/**
 * Weather system driving the pre-existing hooks:
 * - AdvancedLighting.setWeatherState()  (spotlight boost, cones, flash)
 * - DayNightCycle.setWeatherInfluence() (light/floor/material dimming, flash)
 * - Floor uWetness                      (procedural puddles + reflections)
 * - ScreenFx uFog*                      (mist overlay)
 * Plus its own rain particle field that follows the car.
 */
export default class Weather
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.config = _options.config
        this.physics = _options.physics
        this.floor = _options.floor
        this.advancedLighting = _options.advancedLighting
        this.dayNightCycle = _options.dayNightCycle
        this.passes = _options.passes
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()

        // States and their target values (rain is night-only)
        this.statesOrder = ['clear', 'rain', 'fog']
        this.states = {
            clear: { wetness: 0,    rain: 0,   fog: 0,   ambient: 1,    directional: 1,   spotlight: 1,    floorDarkness: 0,    indirect: 1 },
            rain:  { wetness: 0.75, rain: 0.7, fog: 0.1, ambient: 0.82, directional: 0.65, spotlight: 1.2, floorDarkness: 0.4,  indirect: 0.85 },
            fog:   { wetness: 0.15, rain: 0,   fog: 1,   ambient: 0.88, directional: 0.7,  spotlight: 1.2, floorDarkness: 0.2,  indirect: 0.9 }
        }

        // Settings
        this.settings = {}
        this.settings.autoCycle = true
        this.settings.transitionEasing = 0.015
        this.settings.minStateDuration = 40 // seconds
        this.settings.maxStateDuration = 90
        this.settings.fogStrength = 0.32
        this.settings.rainEnabled = !(this.config && this.config.reducedMotion)

        // Current state
        this.state = 'clear'
        this.stateTimeLeft = this.randomDuration()

        // Smoothed values (start at clear)
        this.values = { ...this.states.clear }

        // Fog colors (blended by time of day)
        this.fogDayColor = new THREE.Color('#c3cad4')
        this.fogNightColor = new THREE.Color('#232c3d')
        this.fogColor = new THREE.Color()

        this.setRain()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('weather')
            this.debugFolder.open()
            this.debugFolder.add(this, 'state', this.statesOrder).name('state').listen().onChange((value) =>
            {
                this.setWeather(value)
            })
            this.debugFolder.add(this.settings, 'autoCycle').name('autoCycle').listen()
            this.debugFolder.add(this.settings, 'rainEnabled').name('rainEnabled')
            this.debugFolder.add(this.settings, 'fogStrength').min(0).max(1).step(0.01).name('fogStrength')
        }
    }

    randomDuration()
    {
        return this.settings.minStateDuration + Math.random() * (this.settings.maxStateDuration - this.settings.minStateDuration)
    }

    isNight()
    {
        return (this.dayNightCycle ? this.dayNightCycle.nightFactor : 0) >= 0.5
    }

    pickNextState()
    {
        // Clear weather is the most common; rain only happens at night;
        // never repeat the current state
        const weighted = ['clear', 'clear', 'clear', 'rain', 'rain', 'fog']
        const candidates = weighted.filter((_name) =>
        {
            if(_name === this.state)
            {
                return false
            }
            if(_name === 'rain' && !this.isNight())
            {
                return false
            }
            return true
        })
        return candidates[Math.floor(Math.random() * candidates.length)]
    }

    setWeather(_name)
    {
        if(!this.states[_name])
        {
            return
        }

        this.state = _name
        this.stateTimeLeft = this.randomDuration()
    }

    // HUD button: manual control stops the auto cycle (skips rain during the day)
    cycleWeather()
    {
        this.settings.autoCycle = false

        let index = this.statesOrder.indexOf(this.state)
        let next = this.statesOrder[(index + 1) % this.statesOrder.length]

        if(next === 'rain' && !this.isNight())
        {
            next = this.statesOrder[(index + 2) % this.statesOrder.length]
        }

        this.setWeather(next)
    }

    setRain()
    {
        this.rain = {}
        this.rain.count = 350
        this.rain.areaSize = 36 // box around the car
        this.rain.height = 14
        this.rain.minFallSpeed = 16 // units per second
        this.rain.maxFallSpeed = 24

        this.rain.geometry = new THREE.BufferGeometry()

        const positions = new Float32Array(this.rain.count * 3)
        this.rain.fallSpeeds = new Float32Array(this.rain.count)

        for(let i = 0; i < this.rain.count; i++)
        {
            positions[i * 3 + 0] = (Math.random() - 0.5) * this.rain.areaSize
            positions[i * 3 + 1] = (Math.random() - 0.5) * this.rain.areaSize
            positions[i * 3 + 2] = Math.random() * this.rain.height
            this.rain.fallSpeeds[i] = this.rain.minFallSpeed + Math.random() * (this.rain.maxFallSpeed - this.rain.minFallSpeed)
        }

        this.rain.positionAttribute = new THREE.BufferAttribute(positions, 3)
        this.rain.geometry.setAttribute('position', this.rain.positionAttribute)

        // Small vertical streak sprite (rain falls straight down in this world)
        const canvas = document.createElement('canvas')
        canvas.width = 16
        canvas.height = 64
        const context = canvas.getContext('2d')
        const gradient = context.createLinearGradient(0, 0, 0, 64)
        gradient.addColorStop(0, 'rgba(200, 220, 255, 0)')
        gradient.addColorStop(0.5, 'rgba(200, 220, 255, 0.9)')
        gradient.addColorStop(1, 'rgba(200, 220, 255, 0)')
        context.fillStyle = gradient
        context.fillRect(6, 0, 4, 64)

        this.rain.material = new THREE.PointsMaterial({
            size: 0.7,
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            sizeAttenuation: true
        })

        this.rain.points = new THREE.Points(this.rain.geometry, this.rain.material)
        this.rain.points.frustumCulled = false
        this.rain.points.visible = false
        this.container.add(this.rain.points)
    }

    updateRain(_rainValue)
    {
        const targetOpacity = this.settings.rainEnabled ? _rainValue * 0.55 : 0
        this.rain.material.opacity += (targetOpacity - this.rain.material.opacity) * 0.06

        const visible = this.rain.material.opacity > 0.01
        this.rain.points.visible = visible

        if(!visible)
        {
            return
        }

        // Follow the car so rain always surrounds the action
        const chassisBody = this.physics && this.physics.car && this.physics.car.chassis ? this.physics.car.chassis.body : null
        if(chassisBody)
        {
            this.rain.points.position.x = chassisBody.position.x
            this.rain.points.position.y = chassisBody.position.y
        }

        // Fall and recycle
        const deltaSeconds = Math.min(this.time.delta, 60) / 1000
        const positions = this.rain.positionAttribute.array

        for(let i = 0; i < this.rain.count; i++)
        {
            positions[i * 3 + 2] -= this.rain.fallSpeeds[i] * deltaSeconds

            if(positions[i * 3 + 2] < 0)
            {
                positions[i * 3 + 0] = (Math.random() - 0.5) * this.rain.areaSize
                positions[i * 3 + 1] = (Math.random() - 0.5) * this.rain.areaSize
                positions[i * 3 + 2] = this.rain.height
            }
        }

        this.rain.positionAttribute.needsUpdate = true
    }

    update()
    {
        const deltaSeconds = Math.min(this.time.delta, 60) / 1000

        // Rain is night-only: if day breaks while it rains, clear up
        if(this.state === 'rain' && !this.isNight())
        {
            this.setWeather('clear')
        }

        // Auto cycle
        if(this.settings.autoCycle)
        {
            this.stateTimeLeft -= deltaSeconds
            if(this.stateTimeLeft <= 0)
            {
                this.setWeather(this.pickNextState())
            }
        }

        // Ease every value toward the active state's targets
        const target = this.states[this.state]
        const easing = 1 - Math.pow(1 - this.settings.transitionEasing, this.time.delta / 16.67)

        this.values.wetness += (target.wetness - this.values.wetness) * easing
        this.values.rain += (target.rain - this.values.rain) * easing
        this.values.fog += (target.fog - this.values.fog) * easing
        this.values.ambient += (target.ambient - this.values.ambient) * easing
        this.values.directional += (target.directional - this.values.directional) * easing
        this.values.spotlight += (target.spotlight - this.values.spotlight) * easing
        this.values.floorDarkness += (target.floorDarkness - this.values.floorDarkness) * easing
        this.values.indirect += (target.indirect - this.values.indirect) * easing

        // Push into the lighting rig
        if(this.advancedLighting)
        {
            this.advancedLighting.setWeatherState({
                spotlightBoost: this.values.spotlight,
                ambientBoost: this.values.ambient,
                fogDensity: this.values.fog * 0.02,
                wetness: this.values.wetness,
                flash: 0
            })
        }

        // Push into the day/night cycle (floor colors, virtual lights, matcap indirect)
        if(this.dayNightCycle)
        {
            this.dayNightCycle.setWeatherInfluence({
                ambientMultiplier: this.values.ambient,
                directionalMultiplier: this.values.directional,
                spotlightMultiplier: this.values.spotlight,
                floorDarkness: this.values.floorDarkness,
                materialIndirectMultiplier: this.values.indirect,
                flash: 0
            })
        }

        // Puddles and reflections on the floor
        if(this.floor && this.floor.setWetness)
        {
            this.floor.setWetness(this.values.wetness)
        }

        // Mist overlay, tinted by time of day
        if(this.passes && this.passes.screenFxPass)
        {
            const nightFactor = this.dayNightCycle ? this.dayNightCycle.nightFactor : 0
            this.fogColor.lerpColors(this.fogDayColor, this.fogNightColor, nightFactor)

            this.passes.screenFxPass.material.uniforms.uFogColor.value.copy(this.fogColor)
            this.passes.screenFxPass.material.uniforms.uFogIntensity.value = this.values.fog * this.settings.fogStrength
        }

        this.updateRain(this.values.rain)
    }
}
