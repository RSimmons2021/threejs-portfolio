import * as THREE from 'three'
import EventEmitter from '../Utils/EventEmitter.js'

export default class WorldDiagnostics extends EventEmitter
{
    constructor(_options)
    {
        super()

        this.time = _options.time
        this.scene = _options.scene
        this.renderer = _options.renderer
        this.physics = _options.physics
        this.zones = _options.zones
        this.areas = _options.areas
        this.camera = _options.camera

        this.enabled = false
        this.materialStates = new Map()
        this.lastUpdateAt = 0

        this.setContainer()
        this.setElement()
        this.setKeyboard()

        this.time.on('tick', () => this.update())
    }

    setContainer()
    {
        this.container = new THREE.Object3D()
        this.container.visible = false

        this.grid = new THREE.GridHelper(180, 90, '#8ed4ff', '#29465f')
        this.grid.rotation.x = Math.PI * 0.5
        this.grid.position.z = 0.035
        this.grid.material.transparent = true
        this.grid.material.opacity = 0.28
        this.grid.material.depthWrite = false
        this.grid.material.userData.xrayDebug = true
        this.container.add(this.grid)

        this.areaContainer = new THREE.Object3D()
        this.container.add(this.areaContainer)
        this.buildAreaBounds()
    }

    buildAreaBounds()
    {
        this.areaContainer.clear()

        for(const area of this.areas.items)
        {
            const geometry = new THREE.PlaneGeometry(area.halfExtents.x * 2, area.halfExtents.y * 2)
            const edges = new THREE.EdgesGeometry(geometry)
            geometry.dispose()

            const material = new THREE.LineBasicMaterial({
                color: '#f2cc94',
                transparent: true,
                opacity: 0.72,
                depthWrite: false
            })
            material.userData.xrayDebug = true

            const lines = new THREE.LineSegments(edges, material)
            lines.position.set(area.position.x, area.position.y, 0.07)
            this.areaContainer.add(lines)
        }
    }

    setElement()
    {
        this.$element = document.createElement('aside')
        this.$element.className = 'world-diagnostics'
        this.$element.setAttribute('aria-label', 'Three.js X-ray diagnostics')
        this.$element.hidden = true
        this.$element.innerHTML = `
            <div class="world-diagnostics__scan"></div>
            <div class="world-diagnostics__heading">
                <span>System X-ray</span>
                <strong>LIVE</strong>
            </div>
            <dl class="world-diagnostics__metrics">
                <div><dt>Frame</dt><dd class="js-xray-fps">—</dd></div>
                <div><dt>Draw calls</dt><dd class="js-xray-calls">—</dd></div>
                <div><dt>Triangles</dt><dd class="js-xray-triangles">—</dd></div>
                <div><dt>Physics bodies</dt><dd class="js-xray-bodies">—</dd></div>
                <div><dt>Camera</dt><dd class="js-xray-camera">follow</dd></div>
            </dl>
            <p>Blue/red geometry is Cannon collision data. Gold outlines are interaction areas.</p>
        `
        document.body.appendChild(this.$element)

        this.$fps = this.$element.querySelector('.js-xray-fps')
        this.$calls = this.$element.querySelector('.js-xray-calls')
        this.$triangles = this.$element.querySelector('.js-xray-triangles')
        this.$bodies = this.$element.querySelector('.js-xray-bodies')
        this.$camera = this.$element.querySelector('.js-xray-camera')
    }

    setKeyboard()
    {
        this.onKeyDown = (_event) =>
        {
            if(_event.code === 'KeyX' && !_event.repeat)
            {
                this.toggle()
            }
        }
        window.addEventListener('keydown', this.onKeyDown)
    }

    toggle()
    {
        this.setEnabled(!this.enabled)
    }

    setEnabled(_enabled)
    {
        const enabled = Boolean(_enabled)
        if(enabled === this.enabled)
        {
            return
        }

        this.enabled = enabled
        this.container.visible = enabled
        this.physics.models.container.visible = enabled
        this.zones.container.visible = enabled
        this.$element.hidden = !enabled
        document.body.classList.toggle('is-xray-mode', enabled)

        if(enabled)
        {
            this.buildAreaBounds()
            this.enableWireframes()
        }
        else
        {
            this.restoreMaterials()
        }

        this.trigger('change', [{ enabled }])
    }

    enableWireframes()
    {
        this.materialStates.clear()

        this.scene.traverse((_object) =>
        {
            if(!_object.isMesh)
            {
                return
            }

            const materials = Array.isArray(_object.material) ? _object.material : [_object.material]
            for(const material of materials)
            {
                if(!material || material.userData.xrayDebug || typeof material.wireframe !== 'boolean' || this.materialStates.has(material))
                {
                    continue
                }

                this.materialStates.set(material, material.wireframe)
                material.wireframe = true
                material.needsUpdate = true
            }
        })
    }

    restoreMaterials()
    {
        for(const [material, wireframe] of this.materialStates)
        {
            material.wireframe = wireframe
            material.needsUpdate = true
        }
        this.materialStates.clear()
    }

    update()
    {
        if(!this.enabled || this.time.elapsed - this.lastUpdateAt < 250)
        {
            return
        }

        const delta = Math.max(this.time.delta, 1)
        const info = this.renderer.info.render
        this.lastUpdateAt = this.time.elapsed

        this.$fps.textContent = `${Math.round(1000 / delta)} fps`
        this.$calls.textContent = `${info.calls}`
        this.$triangles.textContent = Number(info.triangles || 0).toLocaleString()
        this.$bodies.textContent = `${this.physics.world.bodies.length}`
        this.$camera.textContent = this.camera.targetOverride ? 'replay' : 'vehicle'
    }
}
