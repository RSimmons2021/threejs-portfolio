import * as THREE from 'three'

import Loader from './Utils/Loader.js'
import EventEmitter from './Utils/EventEmitter.js'

const CORE_RESOURCES = [
    { name: 'manhattan', source: './models/nyc/manhattan.glb' },
    { name: 'apartment', source: './models/nyc/apartment.glb' },
    { name: 'apartmentInterior', source: './models/nyc/apartment-interior.glb' },
    { name: 'arcadeCourtyard', source: './models/nyc/arcade-courtyard.glb' },
    { name: 'arcadePin', source: './models/nyc/arcade-pin.glb' },
    ...['github', 'linkedin', 'email', 'portfolio'].map((kind) => ({ name: `link${kind}`, source: `./models/nyc/link-${kind}.glb` })),
    // Matcaps
    { name: 'matcapBeige', source: './models/matcaps/beige.png', type: 'texture' },
    { name: 'matcapBlack', source: './models/matcaps/black.png', type: 'texture' },
    { name: 'matcapRed', source: './models/matcaps/red.png', type: 'texture' },
    { name: 'matcapWhite', source: './models/matcaps/white.png', type: 'texture' },
    { name: 'matcapGreen', source: './models/matcaps/green.png', type: 'texture' },
    { name: 'matcapBrown', source: './models/matcaps/brown.png', type: 'texture' },
    { name: 'matcapGray', source: './models/matcaps/gray.png', type: 'texture' },
    { name: 'matcapEmeraldGreen', source: './models/matcaps/emeraldGreen.png', type: 'texture' },
    { name: 'matcapPurple', source: './models/matcaps/purple.png', type: 'texture' },
    { name: 'matcapBlue', source: './models/matcaps/blue.png', type: 'texture' },
    { name: 'matcapYellow', source: './models/matcaps/yellow.png', type: 'texture' },
    { name: 'matcapMetal', source: './models/matcaps/metal.png', type: 'texture' },

    // Intro
    { name: 'introInstructionsLabels', source: './models/intro/instructions/labels.glb' },
    { name: 'introInstructionsArrows', source: './models/intro/instructions/arrows.png', type: 'texture' },
    { name: 'introInstructionsControls', source: './models/intro/instructions/controls.png', type: 'texture' },
    { name: 'introInstructionsOther', source: './models/intro/instructions/other.png', type: 'texture' },

    // Crossroads

    // Projects
    { name: 'projectsBoardStructure', source: './models/projects/board/structure.glb' },
    { name: 'projectsBoardCollision', source: './models/projects/board/collision.glb' },
    { name: 'projectsBoardStructureFloorShadow', source: './models/projects/board/floorShadow.png', type: 'texture' },
    { name: 'projectsBoardPlane', source: './models/projects/board/plane.glb' },

    // Information
    { name: 'informationContactTwitterLabel', source: './models/information/static/contactTwitterLabel.png', type: 'texture' },
    { name: 'informationContactGithubLabel', source: './models/information/static/contactGithubLabel.png', type: 'texture' },
    { name: 'informationContactLinkedinLabel', source: './models/information/static/contactLinkedinLabel.png', type: 'texture' },
    { name: 'informationContactMailLabel', source: './models/information/static/contactMailLabel.png', type: 'texture' },

    // Playground and interactive props
    { name: 'brickBase', source: './models/brick/base.glb' },
    { name: 'brickCollision', source: './models/brick/collision.glb' },
    { name: 'hornBase', source: './models/horn/base.glb' },
    { name: 'hornCollision', source: './models/horn/collision.glb' },
    { name: 'bowlingBallBase', source: './models/bowlingBall/base.glb' },
    { name: 'bowlingBallCollision', source: './models/bowlingBall/collision.glb' },
    { name: 'bowlingPinCollision', source: './models/bowlingPin/collision.glb' },

    // Interaction labels
    { name: 'areaKeyEnter', source: './models/area/keyEnter.png', type: 'texture' },
    { name: 'areaEnter', source: './models/area/enter.png', type: 'texture' },
    { name: 'areaOpen', source: './models/area/open.png', type: 'texture' },
    { name: 'areaReset', source: './models/area/reset.png', type: 'texture' },

    // Road tiles
]

const DEFAULT_CAR_RESOURCES = [
    { name: 'carDefaultChassis', source: './models/nyc/f1-chassis.glb' },
    { name: 'carDefaultWheel', source: './models/nyc/f1-wheel.glb' },
    { name: 'carDefaultBackLightsBrake', source: './models/nyc/f1-brake.glb' },
    { name: 'carDefaultBackLightsReverse', source: './models/nyc/f1-reverse.glb' },
    { name: 'carDefaultAntena', source: './models/nyc/f1-antenna.glb' }
]

const HOVER_CAR_RESOURCES = [
    { name: 'carDefaultChassis', source: './models/cyber/hover-chassis.glb' },
    { name: 'carDefaultWheel', source: './models/cyber/hover-wheel.glb' },
    { name: 'carDefaultBackLightsBrake', source: './models/cyber/hover-brake.glb' },
    { name: 'carDefaultBackLightsReverse', source: './models/cyber/hover-reverse.glb' },
    { name: 'carDefaultAntena', source: './models/cyber/hover-antenna.glb' },
    { name: 'carDefaultThrusters', source: './models/cyber/hover-thrusters.glb' },
    { name: 'hoverCarSpec', source: './models/cyber/hover-car.json' }
]

const NEON_RESOURCES = [
    { name: 'cyberApartmentWindow', source: './models/cyber/textures/apartment_window.jpg', type: 'texture' },
    { name: 'cyberKit', source: './models/cyber/city-kit.glb' },
    { name: 'cyberLayout', source: './models/cyber/district-layout.json' },
    { name: 'cyberSigns', source: './models/cyber/signs-atlas.json' },
    { name: 'cyberLightVolume', source: './models/cyber/light-volume.json' },
    { name: 'cyberTraffic', source: './models/cyber/traffic.glb' },
    ...['kit_color', 'kit_mask', 'signs_color', 'signs_halo', 'light_volume', 'light_sun'].map(name =>
        ({ name: `cyber_${name}`, source: `./models/cyber/textures/${name}.png`, type: 'texture' }))
]

const CYBER_TRUCK_RESOURCES = [
    { name: 'carCyberTruckChassis', source: './models/car/cyberTruck/chassis.glb' },
    { name: 'carCyberTruckWheel', source: './models/car/cyberTruck/wheel.glb' },
    { name: 'carCyberTruckBackLightsBrake', source: './models/car/cyberTruck/backLightsBrake.glb' },
    { name: 'carCyberTruckBackLightsReverse', source: './models/car/cyberTruck/backLightsReverse.glb' },
    { name: 'carCyberTruckAntena', source: './models/car/cyberTruck/antena.glb' }
]

const CHARACTER_RESOURCES = [
    { name: 'cyberPlayer', source: './models/cyber/player.glb' },
    { name: 'cyberSkateboard', source: './models/cyber/skateboard.glb' },
    { name: 'cyberNpc', source: './models/cyber/npc.glb' },
    { name: 'cyberVat', source: './models/cyber/npc-vat.json' },
    { name: 'cyberNpcVat', source: './models/cyber/textures/npc_vat.png', type: 'texture' }
]

const MINIGAME_RESOURCES = [
    { name: 'cyberMiniGames', source: './models/cyber/minigames.glb' },
    { name: 'cyberMiniGameSpec', source: './models/cyber/minigames.json' },
    { name: 'cyberMiniGameAtlas', source: './models/cyber/minigame-atlas.json' },
    { name: 'cyberMiniGameCards', source: './models/cyber/textures/minigame_atlas.png', type: 'texture' },
    { name: 'cyberArenaWindow', source: './models/cyber/textures/apartment_window.jpg', type: 'texture' }
]

const DEFERRED_RESOURCES = [
    { name: 'lemonBase', source: './models/lemon/base.glb' },
    { name: 'lemonCollision', source: './models/lemon/collision.glb' },
    { name: 'areaQuestionMark', source: './models/area/questionMark.png', type: 'texture' },
    { name: 'konamiLabel', source: './models/konami/label.png', type: 'texture' },
    { name: 'konamiLabelTouch', source: './models/konami/label-touch.png', type: 'texture' },
    { name: 'wig1', source: './models/wigs/wig1.glb' },
    { name: 'wig2', source: './models/wigs/wig2.glb' },
    { name: 'wig3', source: './models/wigs/wig3.glb' },
    { name: 'wig4', source: './models/wigs/wig4.glb' },
    { name: 'eggBase', source: './models/egg/base.glb' },
    { name: 'eggCollision', source: './models/egg/collision.glb' }
]

export default class Resources extends EventEmitter
{
    constructor(_options = {})
    {
        super()

        this.config = _options.config || {}
        this.loader = new Loader()
        this.items = {}
        this.stages = {
            core: { status: 'idle', promise: null, error: null },
            deferred: { status: 'idle', promise: null, error: null }
        }

        this.setLoaderEvents()
    }

    setLoaderEvents()
    {
        this.loader.on('fileEnd', (_resource, _data, _stage) =>
        {
            this.items[_resource.name] = _data

            if(_resource.type === 'texture')
            {
                const texture = new THREE.Texture(_data)
                if(_resource.name.startsWith('matcap')) texture.colorSpace = THREE.SRGBColorSpace
                texture.needsUpdate = true
                this.items[`${_resource.name}Texture`] = texture
            }

            this.trigger('fileEnd', [_resource, _data, _stage])
        })

        this.loader.on('fileError', (_resource, _error, _stage) =>
        {
            this.trigger('assetError', [{ resource: _resource, error: _error, stage: _stage }])
        })

        this.loader.on('progress', (_progress) =>
        {
            this.trigger('stageProgress', [_progress])

            if(_progress.batch === 'core')
            {
                this.trigger('progress', [_progress.ratio, _progress])
            }
        })
    }

    loadCore()
    {
        const baseCar = this.config.neon ? HOVER_CAR_RESOURCES : DEFAULT_CAR_RESOURCES
        const carResources = this.config.cyberTruck ? [...baseCar, ...CYBER_TRUCK_RESOURCES] : baseCar
        const core = CORE_RESOURCES.map(resource => this.config.neon && resource.name === 'apartmentInterior'
            ? { ...resource, source: './models/cyber/apartment-interior.glb' } : resource)
        return this.loadStage('core', [...core, ...carResources, ...(this.config.neon ? NEON_RESOURCES : [])])
    }

    loadDeferred()
    {
        return this.loadStage('deferred', DEFERRED_RESOURCES)
    }

    loadCharacters() { return this.loadStage('characters', CHARACTER_RESOURCES) }
    loadMiniGames() { return this.loadStage('minigames', MINIGAME_RESOURCES) }

    loadStage(_name, _resources)
    {
        const stage = this.stages[_name] ||= { status: 'idle', promise: null, error: null }

        if(stage.promise)
        {
            return stage.promise
        }

        stage.status = 'loading'
        stage.promise = this.loader.load(_resources, { batch: _name })
            .then((_summary) =>
            {
                stage.status = 'ready'
                const eventName = _name === 'core' ? 'ready' : `${_name}Ready`
                this.trigger(eventName, [_summary])
                return _summary
            })
            .catch((_error) =>
            {
                stage.status = 'error'
                stage.error = _error
                stage.promise = null // A transient network error can be retried.
                this.trigger('error', [{
                    stage: _name,
                    error: _error,
                    fatal: _name === 'core'
                }])
                throw _error
            })

        return stage.promise
    }

    isReady(_stage = 'core')
    {
        return this.stages[_stage]?.status === 'ready'
    }

    dispose()
    {
        for(const item of Object.values(this.items))
        {
            if(item && item.isTexture)
            {
                item.dispose()
            }
        }

        this.loader.dispose()
        this.off('fileEnd assetError stageProgress progress ready deferredReady error')
    }
}
