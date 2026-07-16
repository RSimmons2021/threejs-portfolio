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
        this.passes = _options.passes
        this.shadows = _options.shadows
        this.debug = _options.debug

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.realTime = true // sync with the visitor's actual clock (midnight = 0, noon = 0.5)
        this.settings.cycleDuration = 300 // seconds for a full cycle when realTime is off (debug)
        this.settings.autoPlay = false
        this.settings.currentTime = 0.5 // 0 = night, 0.5 = day, 1 = night
        this.settings.transitionSpeed = 0.5

        this.weatherInfluence = {
            ambientMultiplier: 1,
            directionalMultiplier: 1,
            spotlightMultiplier: 1,
            floorDarkness: 0,
            materialIndirectMultiplier: 1,
            flash: 0
        }

        // Color schemes
        this.colorSchemes = {
            day: {
                floor: {
                    topLeft: '#8B9B7A',
                    topRight: '#7A8A69',
                    bottomRight: '#D4C5B0',
                    bottomLeft: '#B8A999'
                },
                ambient: '#6B7F3F',
                ambientIntensity: 0.3,
                directional: '#ffffff',
                directionalIntensity: 0.5,
                spotlight: '#ffffff',
                spotlightIntensity: 1.5,
                materialIndirect: '#800020',
                matcapTint: '#ffffff',
                glow: '#ffcfe0',
                vignetteIntensity: 0.35,
                nightFactor: 0
            },
            sunrise: {
                floor: {
                    topLeft: '#6D7D6C',
                    topRight: '#7E7562',
                    bottomRight: '#D0A279',
                    bottomLeft: '#A97A65'
                },
                ambient: '#7B6652',
                ambientIntensity: 0.25,
                directional: '#FFD2A1',
                directionalIntensity: 0.4,
                spotlight: '#FFE2BF',
                spotlightIntensity: 1.8,
                materialIndirect: '#92503A',
                matcapTint: '#f2e0cc',
                glow: '#ffd9b0',
                vignetteIntensity: 0.38,
                nightFactor: 0.35
            },
            sunset: {
                floor: {
                    topLeft: '#5A5B6E',
                    topRight: '#785D6A',
                    bottomRight: '#B97F64',
                    bottomLeft: '#8B5E57'
                },
                ambient: '#5A4A63',
                ambientIntensity: 0.2,
                directional: '#FFB38A',
                directionalIntensity: 0.35,
                spotlight: '#FFD7C2',
                spotlightIntensity: 2.1,
                materialIndirect: '#6A3F56',
                matcapTint: '#e0c0ae',
                glow: '#ff9d7a',
                vignetteIntensity: 0.42,
                nightFactor: 0.55
            },
            night: {
                floor: {
                    topLeft: '#2C3E50',
                    topRight: '#34495E',
                    bottomRight: '#1A1A2E',
                    bottomLeft: '#16213E'
                },
                ambient: '#1E3A5F',
                ambientIntensity: 0.15,
                directional: '#8AB4F8',
                directionalIntensity: 0.2,
                spotlight: '#B4C7E7',
                spotlightIntensity: 2.5,
                materialIndirect: '#4A5568',
                matcapTint: '#5d6d8e',
                glow: '#16203a',
                vignetteIntensity: 0.5,
                nightFactor: 1
            }
        }

        this.timeline = [
            { time: 0.0, scheme: 'night' },
            { time: 0.23, scheme: 'sunrise' },
            { time: 0.5, scheme: 'day' },
            { time: 0.77, scheme: 'sunset' },
            { time: 1.0, scheme: 'night' }
        ]

        this.schemeColors = this.prepareColorSchemes()

        this.currentColors = {
            floor: {
                topLeft: new THREE.Color(),
                topRight: new THREE.Color(),
                bottomRight: new THREE.Color(),
                bottomLeft: new THREE.Color()
            },
            ambient: new THREE.Color(),
            ambientIntensity: 0,
            directional: new THREE.Color(),
            directionalIntensity: 0,
            spotlight: new THREE.Color(),
            spotlightIntensity: 0,
            materialIndirect: new THREE.Color(),
            matcapTint: new THREE.Color(),
            glow: new THREE.Color()
        }

        // Blended 0-1 "how night is it" value, readable by other systems
        this.nightFactor = 0

        this.floorColorOutput = {
            topLeft: new THREE.Color(),
            topRight: new THREE.Color(),
            bottomRight: new THREE.Color(),
            bottomLeft: new THREE.Color()
        }

        this.tempFlashColor = new THREE.Color(0xffffff)

        // Sun path for the blob shadows (azimuth sweeps over the day, moon at night)
        this.sunDayPosition = new THREE.Vector3()
        this.sunMoonPosition = new THREE.Vector3(2.2, 2.4, 3.4)

        // Season comes from the visitor's real calendar (northern hemisphere)
        this.setSeason(this.getSeasonFromDate(new Date()))

        this.lastAppliedTime = -1
        this.lastWeatherSignature = ''

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('dayNightCycle')
            this.debugFolder.open()
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this, 'season', ['winter', 'spring', 'summer', 'fall']).name('season').onChange((value) =>
            {
                this.setSeason(value)
            })
            this.debugFolder.add(this.settings, 'realTime').name('realTime')
            this.debugFolder.add(this.settings, 'autoPlay').name('autoPlay')
            this.debugFolder.add(this.settings, 'currentTime').min(0).max(1).step(0.01).name('time').listen()
            this.debugFolder.add(this.settings, 'cycleDuration').min(10).max(300).step(10).name('cycleDuration(s)')
            this.debugFolder.add(this.settings, 'transitionSpeed').min(0.1).max(2).step(0.1).name('transitionSpeed')
            this.debugFolder.add(this, 'transitionToDay').name('→ Day')
            this.debugFolder.add(this, 'transitionToNight').name('→ Night')
            this.debugFolder.add(this, 'transitionToSunrise').name('→ Sunrise')
            this.debugFolder.add(this, 'transitionToSunset').name('→ Sunset')
        }
    }

    prepareColorSchemes()
    {
        const result = {}

        for(const key in this.colorSchemes)
        {
            const source = this.colorSchemes[key]
            result[key] = {
                floor: {
                    topLeft: new THREE.Color(source.floor.topLeft),
                    topRight: new THREE.Color(source.floor.topRight),
                    bottomRight: new THREE.Color(source.floor.bottomRight),
                    bottomLeft: new THREE.Color(source.floor.bottomLeft)
                },
                ambient: new THREE.Color(source.ambient),
                ambientIntensity: source.ambientIntensity,
                directional: new THREE.Color(source.directional),
                directionalIntensity: source.directionalIntensity,
                spotlight: new THREE.Color(source.spotlight),
                spotlightIntensity: source.spotlightIntensity,
                materialIndirect: new THREE.Color(source.materialIndirect),
                matcapTint: new THREE.Color(source.matcapTint),
                glow: new THREE.Color(source.glow),
                vignetteIntensity: source.vignetteIntensity,
                nightFactor: source.nightFactor
            }
        }

        return result
    }

    setWeatherInfluence(_influence = {})
    {
        if(typeof _influence.ambientMultiplier === 'number') this.weatherInfluence.ambientMultiplier = _influence.ambientMultiplier
        if(typeof _influence.directionalMultiplier === 'number') this.weatherInfluence.directionalMultiplier = _influence.directionalMultiplier
        if(typeof _influence.spotlightMultiplier === 'number') this.weatherInfluence.spotlightMultiplier = _influence.spotlightMultiplier
        if(typeof _influence.floorDarkness === 'number') this.weatherInfluence.floorDarkness = _influence.floorDarkness
        if(typeof _influence.materialIndirectMultiplier === 'number') this.weatherInfluence.materialIndirectMultiplier = _influence.materialIndirectMultiplier
        if(typeof _influence.flash === 'number') this.weatherInfluence.flash = _influence.flash
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

    transitionToSunrise()
    {
        gsap.to(this.settings, {
            currentTime: 0.23,
            duration: 2.5 / this.settings.transitionSpeed,
            ease: 'power2.inOut'
        })
    }

    transitionToSunset()
    {
        gsap.to(this.settings, {
            currentTime: 0.77,
            duration: 2.5 / this.settings.transitionSpeed,
            ease: 'power2.inOut'
        })
    }

    getSeasonFromDate(_date)
    {
        const month = _date.getMonth() // 0 = January
        if(month === 11 || month <= 1) return 'winter'
        if(month <= 4) return 'spring'
        if(month <= 7) return 'summer'
        return 'fall'
    }

    setSeason(_name)
    {
        // Each season tints the floor and matcaps toward a signature color
        const seasonTints = {
            winter: { color: '#dfe6ee', floorStrength: 0.3, matcapColor: '#dbe4f0', matcapStrength: 0.18 },
            spring: { color: '#9fc27a', floorStrength: 0.12, matcapColor: '#ffffff', matcapStrength: 0 },
            summer: { color: '#ffffff', floorStrength: 0, matcapColor: '#ffffff', matcapStrength: 0 },
            fall:   { color: '#c07a45', floorStrength: 0.22, matcapColor: '#e0b58f', matcapStrength: 0.12 }
        }

        const tint = seasonTints[_name] || seasonTints.summer

        this.season = _name
        this.seasonFloorColor = new THREE.Color(tint.color)
        this.seasonFloorStrength = tint.floorStrength
        this.seasonMatcapColor = new THREE.Color(tint.matcapColor)
        this.seasonMatcapStrength = tint.matcapStrength

        // Force a re-apply on the next update
        this.lastAppliedTime = - 1
    }

    getTimelineBlend(_time)
    {
        for(let i = 0; i < this.timeline.length - 1; i++)
        {
            const start = this.timeline[i]
            const end = this.timeline[i + 1]
            if(_time >= start.time && _time <= end.time)
            {
                const range = end.time - start.time
                const ratio = range > 0 ? (_time - start.time) / range : 0
                return { from: start.scheme, to: end.scheme, ratio: this.easeInOutSine(ratio) }
            }
        }

        return { from: 'night', to: 'night', ratio: 0 }
    }

    update()
    {
        if(!this.settings.enabled)
        {
            return
        }

        if(this.settings.realTime)
        {
            // Map the visitor's local clock onto the cycle: midnight = 0, noon = 0.5.
            // With the timeline below that puts sunrise ~5:30am and sunset ~6:30pm.
            const now = new Date()
            this.settings.currentTime = (now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600) / 24
        }
        else if(this.settings.autoPlay)
        {
            const delta = this.time.delta / 1000
            const increment = delta / this.settings.cycleDuration
            this.settings.currentTime = (this.settings.currentTime + increment * this.settings.transitionSpeed) % 1
        }

        const weatherSignature = `${this.weatherInfluence.ambientMultiplier.toFixed(3)}-${this.weatherInfluence.directionalMultiplier.toFixed(3)}-${this.weatherInfluence.spotlightMultiplier.toFixed(3)}-${this.weatherInfluence.floorDarkness.toFixed(3)}-${this.weatherInfluence.materialIndirectMultiplier.toFixed(3)}-${this.weatherInfluence.flash.toFixed(3)}`
        const timeChanged = Math.abs(this.settings.currentTime - this.lastAppliedTime) > 0.0008
        const weatherChanged = weatherSignature !== this.lastWeatherSignature

        if(!timeChanged && !weatherChanged)
        {
            return
        }

        this.lastAppliedTime = this.settings.currentTime
        this.lastWeatherSignature = weatherSignature

        const blend = this.getTimelineBlend(this.settings.currentTime)
        const from = this.schemeColors[blend.from]
        const to = this.schemeColors[blend.to]
        const t = blend.ratio

        // Interpolate floor colors
        this.currentColors.floor.topLeft.lerpColors(from.floor.topLeft, to.floor.topLeft, t)
        this.currentColors.floor.topRight.lerpColors(from.floor.topRight, to.floor.topRight, t)
        this.currentColors.floor.bottomRight.lerpColors(from.floor.bottomRight, to.floor.bottomRight, t)
        this.currentColors.floor.bottomLeft.lerpColors(from.floor.bottomLeft, to.floor.bottomLeft, t)

        // Apply weather darkening and lightning flash to floor
        const floorDarkness = Math.min(Math.max(this.weatherInfluence.floorDarkness, 0), 1)
        const floorFlash = Math.min(Math.max(this.weatherInfluence.flash * 0.35, 0), 0.35)

        this.floorColorOutput.topLeft.copy(this.currentColors.floor.topLeft).multiplyScalar(1 - floorDarkness * 0.55).lerp(this.tempFlashColor, floorFlash)
        this.floorColorOutput.topRight.copy(this.currentColors.floor.topRight).multiplyScalar(1 - floorDarkness * 0.55).lerp(this.tempFlashColor, floorFlash)
        this.floorColorOutput.bottomRight.copy(this.currentColors.floor.bottomRight).multiplyScalar(1 - floorDarkness * 0.6).lerp(this.tempFlashColor, floorFlash)
        this.floorColorOutput.bottomLeft.copy(this.currentColors.floor.bottomLeft).multiplyScalar(1 - floorDarkness * 0.6).lerp(this.tempFlashColor, floorFlash)

        // Seasonal tint (frosty in winter, warm in fall)
        if(this.seasonFloorStrength > 0)
        {
            this.floorColorOutput.topLeft.lerp(this.seasonFloorColor, this.seasonFloorStrength)
            this.floorColorOutput.topRight.lerp(this.seasonFloorColor, this.seasonFloorStrength)
            this.floorColorOutput.bottomRight.lerp(this.seasonFloorColor, this.seasonFloorStrength)
            this.floorColorOutput.bottomLeft.lerp(this.seasonFloorColor, this.seasonFloorStrength)
        }

        if(this.floor)
        {
            // Pass Color objects directly (no hex-string round-trip)
            this.floor.setColors(
                this.floorColorOutput.topLeft,
                this.floorColorOutput.topRight,
                this.floorColorOutput.bottomRight,
                this.floorColorOutput.bottomLeft
            )
        }

        // Night factor drives the spotlight strength, headlight cones and fireflies
        this.nightFactor = from.nightFactor + (to.nightFactor - from.nightFactor) * t
        if(this.advancedLighting)
        {
            this.advancedLighting.nightFactor = this.nightFactor
        }

        // Blob shadows follow the sun: azimuth sweeps ~180° over the day, the sun
        // sits low at sunrise/sunset (long shadows) and high at noon (short ones);
        // at night a fixed "moon" takes over and shadows fade
        if(this.shadows && this.shadows.sun)
        {
            const dayProgress = Math.min(Math.max((this.settings.currentTime - 0.23) / 0.54, 0), 1)
            const azimuth = (- 133 + (dayProgress - 0.5) * 180) * Math.PI / 180
            const elevation = 1.1 + Math.sin(Math.PI * dayProgress) * 2.65

            this.sunDayPosition.set(Math.cos(azimuth) * 3.6, Math.sin(azimuth) * 3.6, elevation)

            this.shadows.sun.position.lerpVectors(this.sunDayPosition, this.sunMoonPosition, this.nightFactor)
            this.shadows.sun.update()
            this.shadows.timeOfDayAlpha = 1 - this.nightFactor * 0.6
        }

        // Interpolate lighting colors and intensities
        if(this.advancedLighting)
        {
            this.currentColors.ambient.lerpColors(from.ambient, to.ambient, t)
            this.currentColors.directional.lerpColors(from.directional, to.directional, t)
            this.currentColors.spotlight.lerpColors(from.spotlight, to.spotlight, t)

            this.currentColors.ambientIntensity = (from.ambientIntensity + (to.ambientIntensity - from.ambientIntensity) * t) * this.weatherInfluence.ambientMultiplier + this.weatherInfluence.flash * 0.2
            this.currentColors.directionalIntensity = (from.directionalIntensity + (to.directionalIntensity - from.directionalIntensity) * t) * this.weatherInfluence.directionalMultiplier + this.weatherInfluence.flash * 0.75
            this.currentColors.spotlightIntensity = (from.spotlightIntensity + (to.spotlightIntensity - from.spotlightIntensity) * t) * this.weatherInfluence.spotlightMultiplier + this.weatherInfluence.flash * 0.45

            this.advancedLighting.ambientLight.color.copy(this.currentColors.ambient)
            this.advancedLighting.ambientLight.intensity = this.currentColors.ambientIntensity

            this.advancedLighting.directionalLight.color.copy(this.currentColors.directional)
            this.advancedLighting.directionalLight.intensity = this.currentColors.directionalIntensity

            this.advancedLighting.spotlight.color.copy(this.currentColors.spotlight)
            this.advancedLighting.settings.spotlightIntensity = this.currentColors.spotlightIntensity
        }

        if(this.materials)
        {
            this.currentColors.materialIndirect.lerpColors(from.materialIndirect, to.materialIndirect, t)
            this.currentColors.materialIndirect.multiplyScalar(this.weatherInfluence.materialIndirectMultiplier)
            this.currentColors.materialIndirect.lerp(this.tempFlashColor, Math.min(this.weatherInfluence.flash * 0.25, 0.2))

            for(const materialKey in this.materials.shades.items)
            {
                const material = this.materials.shades.items[materialKey]
                if(material.uniforms && material.uniforms.uIndirectColor)
                {
                    material.uniforms.uIndirectColor.value.copy(this.currentColors.materialIndirect)
                }
            }

            // Global matcap tint: objects actually darken at night (shared uniform,
            // one write updates every shade material)
            if(this.materials.shades.lightUniforms)
            {
                this.currentColors.matcapTint.lerpColors(from.matcapTint, to.matcapTint, t)
                this.currentColors.matcapTint.lerp(this.tempFlashColor, Math.min(this.weatherInfluence.flash * 0.4, 0.35))
                if(this.seasonMatcapStrength > 0)
                {
                    this.currentColors.matcapTint.lerp(this.seasonMatcapColor, this.seasonMatcapStrength)
                }
                this.materials.shades.lightUniforms.uNightTint.value.copy(this.currentColors.matcapTint)
            }
        }

        // Post-processing follows the time of day (warm glow at sunset, dark blue at
        // night, stronger vignette after dark)
        if(this.passes && this.passes.screenFxPass)
        {
            this.currentColors.glow.lerpColors(from.glow, to.glow, t)
            this.passes.screenFxPass.material.uniforms.uGlowColor.value.copy(this.currentColors.glow).convertLinearToSRGB()

            const vignetteIntensity = from.vignetteIntensity + (to.vignetteIntensity - from.vignetteIntensity) * t
            this.passes.screenFxPass.material.uniforms.uVignetteIntensity.value = vignetteIntensity
        }
    }

    easeInOutSine(x)
    {
        return -(Math.cos(Math.PI * x) - 1) / 2
    }
}
