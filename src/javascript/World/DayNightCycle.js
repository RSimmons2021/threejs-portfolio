import * as THREE from 'three'
import gsap from 'gsap'

export default class DayNightCycle
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.floor = _options.floor
        this.materials = _options.materials
        this.advancedLighting = _options.advancedLighting
        this.debug = _options.debug

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.cycleDuration = 60 // seconds for full day/night cycle
        this.settings.autoPlay = false
        this.settings.currentTime = 0.5 // 0 = night, 0.5 = day, 1 = night
        this.settings.transitionSpeed = 0.5 // Speed multiplier

        // Color schemes
        this.colorSchemes = {
            day: {
                floor: {
                    topLeft: '#8B9B7A',      // Sage green
                    topRight: '#7A8A69',     // Olive green
                    bottomRight: '#D4C5B0',  // Beige
                    bottomLeft: '#B8A999'    // Tan
                },
                ambient: '#6B7F3F',          // Olive green
                ambientIntensity: 0.3,
                directional: '#ffffff',
                directionalIntensity: 0.5,
                spotlight: '#ffffff',
                spotlightIntensity: 1.5,
                materialIndirect: '#800020' // Burgundy
            },
            night: {
                floor: {
                    topLeft: '#2C3E50',      // Dark blue-gray
                    topRight: '#34495E',     // Slightly lighter blue-gray
                    bottomRight: '#1A1A2E',  // Very dark blue
                    bottomLeft: '#16213E'    // Dark navy
                },
                ambient: '#1E3A5F',          // Dark blue
                ambientIntensity: 0.15,
                directional: '#8AB4F8',      // Cool blue
                directionalIntensity: 0.2,
                spotlight: '#B4C7E7',        // Cool light blue
                spotlightIntensity: 2.5,
                materialIndirect: '#4A5568' // Cool gray
            }
        }

        // Current values (will interpolate between day/night)
        this.currentColors = {
            floor: {
                topLeft: new THREE.Color(this.colorSchemes.day.floor.topLeft),
                topRight: new THREE.Color(this.colorSchemes.day.floor.topRight),
                bottomRight: new THREE.Color(this.colorSchemes.day.floor.bottomRight),
                bottomLeft: new THREE.Color(this.colorSchemes.day.floor.bottomLeft)
            },
            ambient: new THREE.Color(this.colorSchemes.day.ambient),
            ambientIntensity: this.colorSchemes.day.ambientIntensity,
            directional: new THREE.Color(this.colorSchemes.day.directional),
            directionalIntensity: this.colorSchemes.day.directionalIntensity,
            spotlight: new THREE.Color(this.colorSchemes.day.spotlight),
            spotlightIntensity: this.colorSchemes.day.spotlightIntensity,
            materialIndirect: new THREE.Color(this.colorSchemes.day.materialIndirect)
        }

        console.log('🌓 Day/Night cycle initialized - Current time:', this.settings.currentTime)

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('dayNightCycle')
            this.debugFolder.open() // Open by default so it's visible
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'autoPlay').name('autoPlay')
            this.debugFolder.add(this.settings, 'currentTime').min(0).max(1).step(0.01).name('time').listen()
            this.debugFolder.add(this.settings, 'cycleDuration').min(10).max(300).step(10).name('cycleDuration(s)')
            this.debugFolder.add(this.settings, 'transitionSpeed').min(0.1).max(2).step(0.1).name('transitionSpeed')
            this.debugFolder.add(this, 'transitionToDay').name('→ Day')
            this.debugFolder.add(this, 'transitionToNight').name('→ Night')
            this.debugFolder.add(this, 'transitionToSunset').name('→ Sunset')
        }
    }

    transitionToDay()
    {
        gsap.to(this.settings, {
            currentTime: 0.5,
            duration: 3 / this.settings.transitionSpeed,
            ease: 'power2.inOut'
        })
    }

    transitionToNight()
    {
        gsap.to(this.settings, {
            currentTime: 0,
            duration: 3 / this.settings.transitionSpeed,
            ease: 'power2.inOut'
        })
    }

    transitionToSunset()
    {
        gsap.to(this.settings, {
            currentTime: 0.75,
            duration: 2 / this.settings.transitionSpeed,
            ease: 'power2.inOut'
        })
    }

    update()
    {
        if(!this.settings.enabled) return

        // Update cycle time if auto-playing
        if(this.settings.autoPlay)
        {
            const delta = this.time.delta / 1000
            const increment = delta / this.settings.cycleDuration
            this.settings.currentTime = (this.settings.currentTime + increment * this.settings.transitionSpeed) % 1
        }

        // Calculate interpolation factor
        // 0.0 = night, 0.5 = day, 1.0 = night
        let factor
        if(this.settings.currentTime <= 0.5)
        {
            // Night to day (0 -> 0.5)
            factor = this.settings.currentTime * 2 // 0 to 1
        }
        else
        {
            // Day to night (0.5 -> 1)
            factor = 1 - (this.settings.currentTime - 0.5) * 2 // 1 to 0
        }

        // Apply smooth easing
        factor = this.easeInOutSine(factor)

        // Interpolate floor colors
        this.currentColors.floor.topLeft.lerpColors(
            new THREE.Color(this.colorSchemes.night.floor.topLeft),
            new THREE.Color(this.colorSchemes.day.floor.topLeft),
            factor
        )
        this.currentColors.floor.topRight.lerpColors(
            new THREE.Color(this.colorSchemes.night.floor.topRight),
            new THREE.Color(this.colorSchemes.day.floor.topRight),
            factor
        )
        this.currentColors.floor.bottomRight.lerpColors(
            new THREE.Color(this.colorSchemes.night.floor.bottomRight),
            new THREE.Color(this.colorSchemes.day.floor.bottomRight),
            factor
        )
        this.currentColors.floor.bottomLeft.lerpColors(
            new THREE.Color(this.colorSchemes.night.floor.bottomLeft),
            new THREE.Color(this.colorSchemes.day.floor.bottomLeft),
            factor
        )

        // Update floor colors
        if(this.floor)
        {
            this.floor.colors.topLeft = '#' + this.currentColors.floor.topLeft.getHexString()
            this.floor.colors.topRight = '#' + this.currentColors.floor.topRight.getHexString()
            this.floor.colors.bottomRight = '#' + this.currentColors.floor.bottomRight.getHexString()
            this.floor.colors.bottomLeft = '#' + this.currentColors.floor.bottomLeft.getHexString()
            this.floor.updateMaterial()
        }

        // Interpolate lighting colors and intensities
        if(this.advancedLighting)
        {
            // Ambient
            this.currentColors.ambient.lerpColors(
                new THREE.Color(this.colorSchemes.night.ambient),
                new THREE.Color(this.colorSchemes.day.ambient),
                factor
            )
            this.currentColors.ambientIntensity =
                this.colorSchemes.night.ambientIntensity +
                (this.colorSchemes.day.ambientIntensity - this.colorSchemes.night.ambientIntensity) * factor

            this.advancedLighting.ambientLight.color.copy(this.currentColors.ambient)
            this.advancedLighting.ambientLight.intensity = this.currentColors.ambientIntensity

            // Directional
            this.currentColors.directional.lerpColors(
                new THREE.Color(this.colorSchemes.night.directional),
                new THREE.Color(this.colorSchemes.day.directional),
                factor
            )
            this.currentColors.directionalIntensity =
                this.colorSchemes.night.directionalIntensity +
                (this.colorSchemes.day.directionalIntensity - this.colorSchemes.night.directionalIntensity) * factor

            this.advancedLighting.directionalLight.color.copy(this.currentColors.directional)
            this.advancedLighting.directionalLight.intensity = this.currentColors.directionalIntensity

            // Spotlight
            this.currentColors.spotlight.lerpColors(
                new THREE.Color(this.colorSchemes.night.spotlight),
                new THREE.Color(this.colorSchemes.day.spotlight),
                factor
            )
            this.currentColors.spotlightIntensity =
                this.colorSchemes.night.spotlightIntensity +
                (this.colorSchemes.day.spotlightIntensity - this.colorSchemes.night.spotlightIntensity) * factor

            this.advancedLighting.spotlight.color.copy(this.currentColors.spotlight)
            this.advancedLighting.settings.spotlightIntensity = this.currentColors.spotlightIntensity
        }

        // Interpolate material colors
        if(this.materials)
        {
            this.currentColors.materialIndirect.lerpColors(
                new THREE.Color(this.colorSchemes.night.materialIndirect),
                new THREE.Color(this.colorSchemes.day.materialIndirect),
                factor
            )
            this.materials.shades.indirectColor = '#' + this.currentColors.materialIndirect.getHexString()
        }
    }

    easeInOutSine(x)
    {
        return -(Math.cos(Math.PI * x) - 1) / 2
    }
}
