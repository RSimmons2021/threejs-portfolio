import * as THREE from 'three'
import Materials from './Materials.js'
import Floor from './Floor.js'
import Shadows from './Shadows.js'
import Physics from './Physics.js'
import Zones from './Zones.js'
import Objects from './Objects.js'
import Car from './Car.js'
import Areas from './Areas.js'
import Tiles from './Tiles.js'
import Walls from './Walls.js'
import IntroSection from './Sections/IntroSection.js'
import ProjectsSection from './Sections/ProjectsSection.js'
import CrossroadsSection from './Sections/CrossroadsSection.js'
import InformationSection from './Sections/InformationSection.js'
import PlaygroundSection from './Sections/PlaygroundSection.js'
import Controls from './Controls.js'
import Sounds from './Sounds.js'
import gsap from 'gsap'
import EasterEggs from './EasterEggs.js'
import ParticleTrails from './ParticleTrails.js'
import AdvancedLighting from './AdvancedLighting.js'
import DayNightCycle from './DayNightCycle.js'
import Sky from './Sky.js'
import Fireflies from './Fireflies.js'
import Weather from './Weather.js'
import TireEffects from './TireEffects.js'
import AmbientSounds from './AmbientSounds.js'
import Minimap from './Minimap.js'
import ExperienceHUD from './ExperienceHUD.js'
import GuidedTour from './GuidedTour.js'
import WorldDiagnostics from './WorldDiagnostics.js'
import ExperienceDirector from './ExperienceDirector.js'
import City from './City.js'
import Arcade from './Arcade.js'
import Explorer from './Explorer.js'
import Pedestrians from './Pedestrians.js'
import CareerRPG from './CareerRPG.js'
import Interiors from './Interiors.js'

export default class World
{
    constructor(_options)
    {
        // Options
        this.config = _options.config
        this.debug = _options.debug
        this.resources = _options.resources
        this.time = _options.time
        this.sizes = _options.sizes
        this.camera = _options.camera
        this.scene = _options.scene
        this.renderer = _options.renderer
        this.passes = _options.passes

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('world')
            this.debugFolder.open()
        }

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // this.setAxes()
        this.setSounds()
        this.setControls()
        this.setFloor()
        this.setAreas()
        this.setStartingScreen()
    }

    start()
    {
        if(this.started)
        {
            return
        }

        this.started = true
        document.body.classList.add('has-started')
        this.sounds.startEngine()

        // Remove data left by the retired reactive-world tracking feature.
        try
        {
            window.localStorage.removeItem('portfolio-world-memory-v1')
        }
        catch(_error)
        {
            // Storage may be unavailable in privacy-restricted contexts.
        }

        window.setTimeout(() =>
        {
            this.camera.pan.enable()
        }, 2000)

        this.setReveal()
        this.setMaterials()
        this.setShadows()
        this.setPhysics()
        this.setZones()
        this.setObjects()
        this.setCar()
        this.areas.car = this.car
        this.setTiles()
        this.setWalls()
        this.setSections()
        this.setParticleTrails()
        this.setAdvancedLighting()
        this.city = new City({ resources: this.resources, materials: this.materials, physics: this.physics, time: this.time, lighting: this.advancedLighting })
        this.container.add(this.city.container)
        this.setDayNightCycle()
        this.setSky()
        this.setWeather()
        this.setFireflies()
        this.setTireEffects()
        this.setAmbientSounds()
        this.setExperienceHUD()
        this.setMinimap()
        this.setGuidedTour()
        this.setDiagnostics()
        this.setExperienceDirector()
        this.arcade = new Arcade(this)
        this.container.add(this.arcade.container)
        this.explorer = new Explorer(this)
        this.pedestrians = new Pedestrians(this)
        this.container.add(this.pedestrians.container)
        // After Explorer, so the career areas inherit the walker-aware proximity
        // object and the avatar it rebuilds for cosmetics already exists.
        this.careerRPG = new CareerRPG(this)
        this.container.add(this.careerRPG.container)
        // After CareerRPG: the room's stations register themselves as career
        // zones so they share the same walk-up prompt as the street doors.
        this.interiors = new Interiors(this)
        this.container.add(this.interiors.container)
        this.loadDeferredContent()
    }

    setReveal()
    {
        this.reveal = {}
        this.reveal.matcapsProgress = 0
        this.reveal.floorShadowsProgress = 0
        this.reveal.previousMatcapsProgress = null
        this.reveal.previousFloorShadowsProgress = null

        // Go method
        this.reveal.go = () =>
        {
            gsap.fromTo(this.reveal, { matcapsProgress: 0 }, { matcapsProgress: 1, duration: 3 })
            gsap.fromTo(this.reveal, { floorShadowsProgress: 0 }, { floorShadowsProgress: 1, duration: 3, delay: 0.5 })
            gsap.fromTo(this.shadows, { alpha: 0 }, { alpha: 0.5, duration: 3, delay: 0.5 })

            if(this.sections.intro)
            {
                gsap.fromTo(this.sections.intro.instructions.arrows.label.material, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.5 })
                if(this.sections.intro.otherInstructions)
                {
                    gsap.fromTo(this.sections.intro.otherInstructions.label.material, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.75 })
                }
            }

            // Car
            this.physics.car.chassis.body.sleep()
            this.physics.car.chassis.body.position.set(0, 0, 12)

            window.setTimeout(() =>
            {
                this.physics.car.chassis.body.wakeUp()
            }, 300)

            // Sound
            gsap.fromTo(this.sounds.engine.volume, { master: 0 }, { master: 0.7, duration: 0.5, delay: 0.3, ease: 'power2.in' })
            window.setTimeout(() =>
            {
                this.sounds.play('reveal')
            }, 400)

            // Controls
            if(this.controls.touch)
            {
                window.setTimeout(() =>
                {
                    this.controls.touch.reveal()
                }, 400)
            }
        }

        // Time tick
        this.time.on('tick',() =>
        {
            // Matcap progress changed
            if(this.reveal.matcapsProgress !== this.reveal.previousMatcapsProgress)
            {
                // Update each material
                for(const _materialKey in this.materials.shades.items)
                {
                    const material = this.materials.shades.items[_materialKey]
                    material.uniforms.uRevealProgress.value = this.reveal.matcapsProgress
                }

                // Save
                this.reveal.previousMatcapsProgress = this.reveal.matcapsProgress
            }

            // Matcap progress changed
            if(this.reveal.floorShadowsProgress !== this.reveal.previousFloorShadowsProgress)
            {
                // Update each floor shadow
                for(const _mesh of this.objects.floorShadows)
                {
                    _mesh.material.uniforms.uAlpha.value = this.reveal.floorShadowsProgress
                }

                // Save
                this.reveal.previousFloorShadowsProgress = this.reveal.floorShadowsProgress
            }
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this.reveal, 'matcapsProgress').step(0.0001).min(0).max(1).name('matcapsProgress')
            this.debugFolder.add(this.reveal, 'floorShadowsProgress').step(0.0001).min(0).max(1).name('floorShadowsProgress')
            this.debugFolder.add(this.reveal, 'go').name('reveal')
        }
    }

    setStartingScreen()
    {
        this.startingScreen = {}

        // The visible start pad is gone: the HTML intro's ENTER SITE button is
        // the real entry point and calls area.interact() directly, so the white
        // box that rose out of the ground with the car was a second, redundant
        // invitation. The Area itself stays — invisible — because it still owns
        // the interact handler that reveals the world, and dropping it would
        // mean rewiring the entry flow for no gain.
        this.startingScreen.area = this.areas.add({
            position: new THREE.Vector2(0, 0),
            halfExtents: new THREE.Vector2(2.35, 1.5),
            hasKey: false,
            testCar: false,
            active: false
        })
        this.startingScreen.area.container.visible = false

        this.resources.on('ready', () =>
        {
            window.requestAnimationFrame(() =>
            {
                this.startingScreen.area.activate()
            })
        })

        this.startingScreen.area.on('interact', () =>
        {
            this.startingScreen.area.deactivate()
            this.start()

            window.setTimeout(() =>
            {
                this.reveal.go()
            }, 600)
        })
    }


    setSounds()
    {
        this.sounds = new Sounds({
            debug: this.debugFolder,
            time: this.time
        })
    }

    setAxes()
    {
        this.axis = new THREE.AxesHelper()
        this.container.add(this.axis)
    }

    setControls()
    {
        this.controls = new Controls({
            config: this.config,
            sizes: this.sizes,
            time: this.time,
            camera: this.camera,
            sounds: this.sounds
        })
    }

    setMaterials()
    {
        this.materials = new Materials({
            resources: this.resources,
            debug: this.debugFolder
        })
    }

    setFloor()
    {
        this.floor = new Floor({
            time: this.time,
            debug: this.debugFolder
        })

        this.container.add(this.floor.container)
    }

    setShadows()
    {
        this.shadows = new Shadows({
            time: this.time,
            debug: this.debugFolder,
            renderer: this.renderer,
            camera: this.camera
        })
        this.container.add(this.shadows.container)
    }

    setPhysics()
    {
        this.physics = new Physics({
            config: this.config,
            debug: this.debug,
            scene: this.scene,
            time: this.time,
            sizes: this.sizes,
            controls: this.controls,
            sounds: this.sounds,
            camera: this.camera
        })

        this.container.add(this.physics.models.container)
    }

    setZones()
    {
        this.zones = new Zones({
            time: this.time,
            physics: this.physics,
            debug: this.debugFolder
        })
        this.container.add(this.zones.container)
    }

    setAreas()
    {
        this.areas = new Areas({
            config: this.config,
            resources: this.resources,
            debug: this.debug,
            renderer: this.renderer,
            camera: this.camera,
            car: this.car,
            sounds: this.sounds,
            time: this.time
        })

        this.container.add(this.areas.container)
    }

    setTiles()
    {
        this.tiles = new Tiles({
            resources: this.resources,
            objects: this.objects,
            debug: this.debug
        })
    }

    setWalls()
    {
        this.walls = new Walls({
            resources: this.resources,
            objects: this.objects
        })
    }

    setObjects()
    {
        this.objects = new Objects({
            time: this.time,
            resources: this.resources,
            materials: this.materials,
            physics: this.physics,
            shadows: this.shadows,
            sounds: this.sounds,
            debug: this.debugFolder
        })
        this.container.add(this.objects.container)

        // window.requestAnimationFrame(() =>
        // {
        //     this.objects.merge.update()
        // })
    }

    setCar()
    {
        this.car = new Car({
            time: this.time,
            resources: this.resources,
            objects: this.objects,
            physics: this.physics,
            shadows: this.shadows,
            materials: this.materials,
            controls: this.controls,
            sounds: this.sounds,
            renderer: this.renderer,
            camera: this.camera,
            debug: this.debugFolder,
            config: this.config
        })
        this.container.add(this.car.container)
    }

    setSections()
    {
        this.sections = {}

        // Generic options
        const options = {
            config: this.config,
            time: this.time,
            resources: this.resources,
            camera: this.camera,
            passes: this.passes,
            objects: this.objects,
            areas: this.areas,
            zones: this.zones,
            walls: this.walls,
            tiles: this.tiles,
            debug: this.debugFolder
        }

        // Intro
        this.sections.intro = new IntroSection({
            ...options,
            x: 0,
            y: 0
        })
        this.container.add(this.sections.intro.container)

        // Crossroads
        this.sections.crossroads = new CrossroadsSection({
            ...options,
            x: 0,
            y: - 30
        })
        this.container.add(this.sections.crossroads.container)

        // Projects
        this.sections.projects = new ProjectsSection({
            ...options,
            x: 30,
            y: - 30
            // x: 0,
            // y: 0
        })
        this.container.add(this.sections.projects.container)

        // Information
        this.sections.information = new InformationSection({
            ...options,
            x: 1.2,
            y: - 55
            // x: 0,
            // y: - 10
        })
        this.container.add(this.sections.information.container)

        // Playground
        this.sections.playground = new PlaygroundSection({
            ...options,
            physics: this.physics,
            car: this.car,
            scene: this.scene,
            x: - 38,
            y: - 34
            // x: - 15,
            // y: - 4
        })
        this.container.add(this.sections.playground.container)
    }

    setParticleTrails()
    {
        this.particleTrails = new ParticleTrails({
            time: this.time,
            car: this.car,
            physics: this.physics,
            camera: this.camera,
            config: this.config,
            debug: this.debugFolder
        })
        this.container.add(this.particleTrails.container)
    }

    setAdvancedLighting()
    {
        this.advancedLighting = new AdvancedLighting({
            time: this.time,
            scene: this.scene,
            car: this.car,
            physics: this.physics,
            materials: this.materials,
            floor: this.floor,
            camera: this.camera,
            config: this.config,
            debug: this.debugFolder
        })
        this.scene.add(this.advancedLighting.container)

        this.sounds.setVehicleStateProvider(() => ({
            speed: this.advancedLighting.dynamicState.speedFactor,
            braking: this.controls.actions.brake ? 1 : 0,
            // Normalised steering angle, so the tyre layer can tell a hard
            // corner from a lane change rather than squealing at any input.
            cornering: Math.min(Math.abs(this.physics.car.steering) / this.physics.car.options.controlsSteeringMax, 1)
        }))
    }

    setDayNightCycle()
    {
        this.dayNightCycle = new DayNightCycle({
            time: this.time,
            floor: this.floor,
            materials: this.materials,
            advancedLighting: this.advancedLighting,
            passes: this.passes,
            shadows: this.shadows,
            debug: this.debugFolder
        })

        // Let the car's brake/reverse glows react to the time of day
        if(this.car)
        {
            this.car.dayNightCycle = this.dayNightCycle
        }
    }

    setSky()
    {
        this.sky = new Sky({
            time: this.time,
            camera: this.camera,
            config: this.config,
            scene: this.scene,
            floor: this.floor,
            dayNightCycle: this.dayNightCycle
        })
        // Straight onto the scene, not world.container: that container keeps
        // matrixAutoUpdate off, and the dome has to track the camera every frame.
        this.scene.add(this.sky.container)
    }

    setWeather()
    {
        this.weather = new Weather({
            time: this.time,
            config: this.config,
            physics: this.physics,
            floor: this.floor,
            advancedLighting: this.advancedLighting,
            dayNightCycle: this.dayNightCycle,
            passes: this.passes,
            debug: this.debugFolder
        })
        this.container.add(this.weather.container)
    }

    setTireEffects()
    {
        this.tireEffects = new TireEffects({
            time: this.time,
            config: this.config,
            physics: this.physics,
            advancedLighting: this.advancedLighting,
            debug: this.debugFolder
        })
        this.container.add(this.tireEffects.container)
    }

    setAmbientSounds()
    {
        this.ambientSounds = new AmbientSounds({
            time: this.time,
            weather: this.weather,
            dayNightCycle: this.dayNightCycle,
            debug: this.debugFolder
        })
    }

    setMinimap()
    {
        this.minimap = new Minimap({
            time: this.time,
            config: this.config,
            physics: this.physics
        })
    }


    setFireflies()
    {
        this.fireflies = new Fireflies({
            time: this.time,
            config: this.config,
            dayNightCycle: this.dayNightCycle,
            weather: this.weather,
            debug: this.debugFolder
        })
        this.container.add(this.fireflies.container)
    }

    setExperienceHUD()
    {
        this.experienceHUD = new ExperienceHUD({
            config: this.config,
            time: this.time,
            physics: this.physics,
            sounds: this.sounds
        })
    }


    setGuidedTour()
    {
        this.guidedTour = new GuidedTour({
            camera: this.camera,
            physics: this.physics,
            controls: this.controls
        })
    }

    setDiagnostics()
    {
        this.diagnostics = new WorldDiagnostics({
            time: this.time,
            scene: this.scene,
            renderer: this.renderer,
            physics: this.physics,
            zones: this.zones,
            areas: this.areas,
            camera: this.camera
        })
        this.container.add(this.diagnostics.container)
    }

    setExperienceDirector()
    {
        this.experienceDirector = new ExperienceDirector({
            config: this.config,
            time: this.time,
            camera: this.camera,
            physics: this.physics,
            controls: this.controls,
            sounds: this.sounds,
            dayNightCycle: this.dayNightCycle,
            diagnostics: this.diagnostics,
            projects: this.sections.projects.items
        })
    }

    loadDeferredContent()
    {
        this.resources.loadDeferred()
            .then(() =>
            {
                if(!this.easterEggs)
                {
                    this.setEasterEggs()
                }
            })
            .catch((_error) =>
            {
                // Bonus interactions should never prevent the portfolio itself
                // from being usable when one of their assets is unavailable.
                console.warn('Optional portfolio content was skipped.', _error)
            })
    }

    setEasterEggs()
    {
        this.easterEggs = new EasterEggs({
            resources: this.resources,
            car: this.car,
            walls: this.walls,
            objects: this.objects,
            materials: this.materials,
            areas: this.areas,
            config: this.config,
            physics: this.physics
        })
        this.container.add(this.easterEggs.container)
    }
}
