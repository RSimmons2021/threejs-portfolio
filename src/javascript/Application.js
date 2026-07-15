import * as THREE from 'three'
import * as dat from 'dat.gui'

import Sizes from './Utils/Sizes.js'
import Time from './Utils/Time.js'
import World from './World/index.js'
import Resources from './Resources.js'
import Camera from './Camera.js'
import Journey from './ThreejsJourney.js'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import BlurPass from './Passes/Blur.js'
import ScreenFxPass from './Passes/ScreenFx.js'

export default class Application
{
    /**
     * Constructor
     */
    constructor(_options)
    {
        // Options
        this.$canvas = _options.$canvas
        this.$status = document.querySelector('.js-app-status')
        this.$fallback = document.querySelector('.js-app-fallback')
        this.$fallbackMessage = document.querySelector('.js-app-fallback-message')
        this.$fallbackRetry = document.querySelector('.js-app-fallback-retry')

        // Set up
        this.time = new Time()
        this.sizes = new Sizes()
        this.setConfig()
        this.resources = new Resources({ config: this.config })
        this.setApplicationState()
        this.setPerformanceProfile()
        this.setDebug()
        this.setRenderer()
        this.setCamera()
        this.setPasses()
        this.setWorld()
        this.setJourney()
        this.setLifecycle()
        this.startLoading()
    }

    /**
     * Set config
     */
    setConfig()
    {
        this.config = {}
        this.config.debug = window.location.hash === '#debug'
        this.config.cyberTruck = window.location.hash === '#cybertruck'
        this.config.touch = false
        this.config.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        window.addEventListener('touchstart', () =>
        {
            this.config.touch = true
            this.world.controls.setTouch()

            this.passes.horizontalBlurPass.strength = 1
            this.passes.horizontalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(this.passes.horizontalBlurPass.strength, 0)
            this.passes.verticalBlurPass.strength = 1
            this.passes.verticalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(0, this.passes.verticalBlurPass.strength)
        }, { once: true })
    }

    setApplicationState()
    {
        this.fatalError = false
        this.webglContextLost = false

        this.onFallbackRetry = () => window.location.reload()
        this.$fallbackRetry?.addEventListener('click', this.onFallbackRetry)

        this.resources.on('progress', (_progress) =>
        {
            this.showStatus(`Loading 3D portfolio… ${Math.round(_progress * 100)}%`)
        })

        this.resources.on('ready', () =>
        {
            this.showStatus('Portfolio ready. Select START to enter.')
            this.statusHideTimeout = window.setTimeout(() => this.hideStatus(), 2500)
        })

        this.resources.on('error', (_details) =>
        {
            if(_details.fatal)
            {
                console.error('Core portfolio assets failed to load.', _details.error)
                this.showFallback('Some 3D assets could not be loaded. You can reload the experience or use the portfolio links below.')
            }
        })
    }

    startLoading()
    {
        this.showStatus('Loading 3D portfolio… 0%')
        this.resources.loadCore().catch(() =>
        {
            // The resource error event owns the user-facing fallback state.
        })
    }

    showStatus(_message)
    {
        if(!this.$status)
        {
            return
        }

        this.$status.textContent = _message
        this.$status.hidden = false
    }

    hideStatus()
    {
        if(this.$status)
        {
            this.$status.hidden = true
        }
    }

    showFallback(_message, _options = {})
    {
        if(_options.fatal !== false)
        {
            this.fatalError = true
        }

        this.hideStatus()
        this.pause()

        if(this.$fallbackMessage)
        {
            this.$fallbackMessage.textContent = _message
        }

        if(this.$fallback)
        {
            this.$fallback.hidden = false
        }

        document.body.classList.add('has-app-fallback')
    }

    hideFallback()
    {
        if(this.fatalError)
        {
            return
        }

        if(this.$fallback)
        {
            this.$fallback.hidden = true
        }

        document.body.classList.remove('has-app-fallback')
    }

    /**
     * Performance profile
     */
    setPerformanceProfile()
    {
        const coarsePointer = window.matchMedia('(pointer: coarse)').matches
        const touchDevice = coarsePointer || navigator.maxTouchPoints > 0

        this.performance = {}
        this.performance.minDpr = 1
        this.performance.maxDpr = touchDevice ? 1.5 : 2
        this.performance.currentDpr = Math.min(window.devicePixelRatio, this.performance.maxDpr)
        this.performance.sampleSize = 120
        this.performance.samples = []
    }

    /**
     * Set debug
     */
    setDebug()
    {
        if(this.config.debug)
        {
            this.debug = new dat.GUI({ width: 420 })
        }
    }

    /**
     * Set renderer
     */
    setRenderer()
    {
        // Scene
        this.scene = new THREE.Scene()

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.$canvas,
            alpha: true,
            powerPreference: 'high-performance'
        })
        // this.renderer.setClearColor(0x414141, 1)
        this.renderer.setClearColor(0x000000, 1)
        this.renderer.setPixelRatio(this.performance.currentDpr)
        this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
        this.renderer.autoClear = false

        this.onWebglContextLost = (_event) =>
        {
            _event.preventDefault()
            this.webglContextLost = true
            this.showFallback('The 3D graphics context was interrupted. Reload the experience, or use the portfolio links below.', { fatal: false })
        }

        this.onWebglContextRestored = () =>
        {
            this.webglContextLost = false
            this.hideFallback()
            this.resume()
        }

        this.$canvas.addEventListener('webglcontextlost', this.onWebglContextLost, false)
        this.$canvas.addEventListener('webglcontextrestored', this.onWebglContextRestored, false)

        // Resize event
        this.sizes.on('resize', () =>
        {
            this.performance.currentDpr = Math.min(window.devicePixelRatio, this.performance.maxDpr)
            this.renderer.setPixelRatio(this.performance.currentDpr)
            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
        })
    }

    /**
     * Set camera
     */
    setCamera()
    {
        this.camera = new Camera({
            time: this.time,
            sizes: this.sizes,
            renderer: this.renderer,
            debug: this.debug,
            config: this.config
        })

        this.scene.add(this.camera.container)

        this.time.on('tick', () =>
        {
            if(this.world && this.world.car)
            {
                this.camera.target.x = this.world.car.chassis.object.position.x
                this.camera.target.y = this.world.car.chassis.object.position.y

                // Feed normalized speed into the FOV kick (boost max speed ≈ 0.017
                // units/ms, so full kick is only reached while boosting)
                if(this.world.physics && this.world.physics.car)
                {
                    const carSpeed = Math.abs(this.world.physics.car.speed)
                    this.camera.fovKick.target = Math.min(carSpeed * 60, 1)
                }
            }
        })
    }

    setPasses()
    {
        this.passes = {}

        // Debug
        if(this.debug)
        {
            this.passes.debugFolder = this.debug.addFolder('postprocess')
            // this.passes.debugFolder.open()
        }

        // MSAA render target (WebGL2): smooths the aliased matcap edges cheaply.
        // Fewer samples on touch devices to keep fill-rate cost down.
        const touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
        const composerTarget = new THREE.WebGLRenderTarget(
            this.sizes.viewport.width,
            this.sizes.viewport.height,
            {
                type: THREE.HalfFloatType,
                samples: this.renderer.capabilities.isWebGL2 ? (touchDevice ? 2 : 4) : 0
            }
        )

        this.passes.composer = new EffectComposer(this.renderer, composerTarget)
        this.passes.composer.setPixelRatio(this.performance.currentDpr)

        // Create passes
        this.passes.renderPass = new RenderPass(this.scene, this.camera.instance)

        this.passes.horizontalBlurPass = new ShaderPass(BlurPass)
        this.passes.horizontalBlurPass.strength = this.config.touch ? 0 : 1
        this.passes.horizontalBlurPass.material.uniforms.uResolution.value = new THREE.Vector2(this.sizes.viewport.width, this.sizes.viewport.height)
        this.passes.horizontalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(this.passes.horizontalBlurPass.strength, 0)

        this.passes.verticalBlurPass = new ShaderPass(BlurPass)
        this.passes.verticalBlurPass.strength = this.config.touch ? 0 : 1
        this.passes.verticalBlurPass.material.uniforms.uResolution.value = new THREE.Vector2(this.sizes.viewport.width, this.sizes.viewport.height)
        this.passes.verticalBlurPass.material.uniforms.uStrength.value = new THREE.Vector2(0, this.passes.verticalBlurPass.strength)

        // Debug
        if(this.debug)
        {
            const folder = this.passes.debugFolder.addFolder('blur')
            folder.open()

            folder.add(this.passes.horizontalBlurPass.material.uniforms.uStrength.value, 'x').step(0.001).min(0).max(10)
            folder.add(this.passes.verticalBlurPass.material.uniforms.uStrength.value, 'y').step(0.001).min(0).max(10)
        }

        // Combined glow + vignette pass (one fullscreen pass instead of two)
        this.passes.screenFxPass = new ShaderPass(ScreenFxPass)
        this.passes.screenFxPass.color = '#ffcfe0'
        this.passes.screenFxPass.material.uniforms.uGlowPosition.value = new THREE.Vector2(0, 0.25)
        this.passes.screenFxPass.material.uniforms.uGlowRadius.value = 0.7
        this.passes.screenFxPass.material.uniforms.uGlowColor.value = new THREE.Color(this.passes.screenFxPass.color)
        this.passes.screenFxPass.material.uniforms.uGlowColor.value.convertLinearToSRGB()
        this.passes.screenFxPass.material.uniforms.uGlowAlpha.value = 0.55
        this.passes.screenFxPass.material.uniforms.uVignetteIntensity.value = 0.35
        this.passes.screenFxPass.material.uniforms.uVignetteSmoothness.value = 0.65
        this.passes.screenFxPass.material.uniforms.uFogColor.value = new THREE.Color('#c3cad4')
        this.passes.screenFxPass.material.uniforms.uFogIntensity.value = 0
        this.passes.screenFxPass.material.uniforms.uCameraPosition.value = new THREE.Vector3()
        this.passes.screenFxPass.material.uniforms.uInverseViewProjection.value = new THREE.Matrix4()

        // Debug
        if(this.debug)
        {
            const folder = this.passes.debugFolder.addFolder('screenFx')
            folder.open()

            folder.add(this.passes.screenFxPass.material.uniforms.uGlowPosition.value, 'x').step(0.001).min(- 1).max(2).name('glowPositionX')
            folder.add(this.passes.screenFxPass.material.uniforms.uGlowPosition.value, 'y').step(0.001).min(- 1).max(2).name('glowPositionY')
            folder.add(this.passes.screenFxPass.material.uniforms.uGlowRadius, 'value').step(0.001).min(0).max(2).name('glowRadius')
            folder.addColor(this.passes.screenFxPass, 'color').name('glowColor').onChange(() =>
            {
                this.passes.screenFxPass.material.uniforms.uGlowColor.value.set(this.passes.screenFxPass.color)
            })
            folder.add(this.passes.screenFxPass.material.uniforms.uGlowAlpha, 'value').step(0.001).min(0).max(1).name('glowAlpha')
            folder.add(this.passes.screenFxPass.material.uniforms.uVignetteIntensity, 'value').step(0.01).min(0).max(1).name('vignetteIntensity')
            folder.add(this.passes.screenFxPass.material.uniforms.uVignetteSmoothness, 'value').step(0.01).min(0.1).max(1).name('vignetteSmoothness')
        }

        // Add passes
        this.passes.composer.addPass(this.passes.renderPass)
        this.passes.composer.addPass(this.passes.horizontalBlurPass)
        this.passes.composer.addPass(this.passes.verticalBlurPass)
        this.passes.composer.addPass(this.passes.screenFxPass)

        // Time tick
        this.time.on('tick', () =>
        {
            this.performance.samples.push(this.time.delta)
            if(this.performance.samples.length >= this.performance.sampleSize)
            {
                const total = this.performance.samples.reduce((sum, value) => sum + value, 0)
                const averageDelta = total / this.performance.samples.length
                this.performance.samples.length = 0

                let nextDpr = this.performance.currentDpr
                if(averageDelta > 24)
                {
                    nextDpr = Math.max(this.performance.minDpr, this.performance.currentDpr - 0.1)
                }
                else if(averageDelta < 18)
                {
                    nextDpr = Math.min(this.performance.maxDpr, this.performance.currentDpr + 0.1)
                }

                if(Math.abs(nextDpr - this.performance.currentDpr) > 0.01)
                {
                    this.performance.currentDpr = nextDpr
                    this.renderer.setPixelRatio(this.performance.currentDpr)
                    this.passes.composer.setPixelRatio(this.performance.currentDpr)
                    this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
                    this.passes.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
                }
            }

            this.passes.horizontalBlurPass.enabled = this.passes.horizontalBlurPass.material.uniforms.uStrength.value.x > 0
            this.passes.verticalBlurPass.enabled = this.passes.verticalBlurPass.material.uniforms.uStrength.value.y > 0

            // Ground-mist reconstruction uniforms (world-anchored fog in ScreenFx)
            const screenFxUniforms = this.passes.screenFxPass.material.uniforms
            screenFxUniforms.uTime.value = this.time.elapsed
            screenFxUniforms.uCameraPosition.value.setFromMatrixPosition(this.camera.instance.matrixWorld)
            screenFxUniforms.uInverseViewProjection.value.multiplyMatrices(this.camera.instance.matrixWorld, this.camera.instance.projectionMatrixInverse)

            // Renderer
            this.passes.composer.render()
            // this.renderer.domElement.style.background = 'black'
            // this.renderer.render(this.scene, this.camera.instance)
        })

        // Resize event
        this.sizes.on('resize', () =>
        {
            this.renderer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.passes.composer.setSize(this.sizes.viewport.width, this.sizes.viewport.height)
            this.passes.composer.setPixelRatio(this.performance.currentDpr)
            this.passes.horizontalBlurPass.material.uniforms.uResolution.value.x = this.sizes.viewport.width
            this.passes.horizontalBlurPass.material.uniforms.uResolution.value.y = this.sizes.viewport.height
            this.passes.verticalBlurPass.material.uniforms.uResolution.value.x = this.sizes.viewport.width
            this.passes.verticalBlurPass.material.uniforms.uResolution.value.y = this.sizes.viewport.height
        })
    }

    /**
     * Set world
     */
    setWorld()
    {
        this.world = new World({
            config: this.config,
            debug: this.debug,
            resources: this.resources,
            time: this.time,
            sizes: this.sizes,
            camera: this.camera,
            scene: this.scene,
            renderer: this.renderer,
            passes: this.passes
        })
        this.scene.add(this.world.container)
    }

    /**
     * Set Journey
     */
    setJourney()
    {
        this.journey = new Journey({
            config: this.config,
            time: this.time,
            world: this.world
        })
    }

    setLifecycle()
    {
        this.onVisibilityChange = () =>
        {
            if(document.hidden)
            {
                this.pause()
            }
            else
            {
                this.resume()
            }
        }

        document.addEventListener('visibilitychange', this.onVisibilityChange)

        if(document.hidden)
        {
            this.pause()
        }
    }

    pause()
    {
        this.time.stop()
        this.world?.sounds?.suspend()
    }

    resume()
    {
        if(document.hidden || this.webglContextLost || this.fatalError)
        {
            return
        }

        this.performance.samples.length = 0
        this.world?.sounds?.resume()
        this.time.resume()
    }

    /**
     * Destructor
     */
    destructor()
    {
        window.clearTimeout(this.statusHideTimeout)
        document.removeEventListener('visibilitychange', this.onVisibilityChange)
        this.$canvas.removeEventListener('webglcontextlost', this.onWebglContextLost, false)
        this.$canvas.removeEventListener('webglcontextrestored', this.onWebglContextRestored, false)
        this.$fallbackRetry?.removeEventListener('click', this.onFallbackRetry)

        this.time.stop()
        this.time.off('tick')
        this.sizes.off('resize')

        this.world?.sounds?.dispose()
        this.resources.dispose()
        this.camera.dispose()
        this.passes.composer.dispose()
        this.renderer.dispose()

        if(this.debug)
        {
            this.debug.destroy()
        }
    }
}
